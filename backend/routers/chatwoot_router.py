import os
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from database import get_db
from models import UserSettings, Customer
from auth import get_current_user_jwt
import httpx

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/chatwoot",
    tags=["chatwoot"]
)

class ChatwootConfigReq(BaseModel):
    chatwoot_url: str
    account_id: str
    access_token: str

class SendMessageReq(BaseModel):
    conversation_id: str
    content: str
    message_type: str = "outgoing" # outgoing, template

@router.get("/config")
async def get_chatwoot_config(db: Session = Depends(get_db), current_user=Depends(get_current_user_jwt)):
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings:
        return {"configured": False, "chatwoot_url": "", "account_id": ""}
    return {
        "configured": bool(settings.chatwoot_url and settings.chatwoot_account_id),
        "chatwoot_url": settings.chatwoot_url or "https://app.chatwoot.com",
        "account_id": settings.chatwoot_account_id or "",
        "has_access_token": bool(settings.chatwoot_access_token)
    }

@router.post("/config")
async def save_chatwoot_config(req: ChatwootConfigReq, db: Session = Depends(get_db), current_user=Depends(get_current_user_jwt)):
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        
    settings.chatwoot_url = req.chatwoot_url.rstrip("/")
    settings.chatwoot_account_id = req.account_id
    settings.chatwoot_access_token = req.access_token
    db.commit()
    return {"success": True, "message": "Chatwoot credentials saved successfully."}

@router.post("/webhook")
async def chatwoot_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receives incoming webhook events from Chatwoot (WhatsApp, Messenger, Instagram, WebChat messages).
    """
    try:
        payload = await request.json()
        event_type = payload.get("event")
        logger.info(f"Received Chatwoot webhook event: {event_type}")
        
        # Sync customer phone/email if new contact created
        if event_type == "contact_created":
            meta = payload.get("meta", {})
            sender = payload.get("sender", {})
            phone = sender.get("phone_number")
            email = sender.get("email")
            name = sender.get("name", "Chatwoot Lead")
            
            if phone:
                existing = db.query(Customer).filter(Customer.phone == phone).first()
                if not existing:
                    new_cust = Customer(
                        customer_id=f"CW_{sender.get('id')}",
                        first_name=name.split(" ")[0] if name else "Lead",
                        last_name=" ".join(name.split(" ")[1:]) if len(name.split(" ")) > 1 else "",
                        phone=phone,
                        email=email or "",
                        status="new_omnichannel_lead"
                    )
                    db.add(new_cust)
                    db.commit()
                    
        return {"status": "success", "event": event_type}
    except Exception as e:
        logger.error(f"Error handling Chatwoot webhook: {e}")
        return {"status": "error", "message": str(e)}

@router.post("/conversations/{conversation_id}/messages")
async def send_chatwoot_message(conversation_id: str, req: SendMessageReq, db: Session = Depends(get_db), current_user=Depends(get_current_user_jwt)):
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings or not settings.chatwoot_access_token:
        # Fallback to server env if user settings not populated
        chatwoot_url = os.getenv("CHATWOOT_URL", "https://app.chatwoot.com")
        account_id = os.getenv("CHATWOOT_ACCOUNT_ID", "")
        token = os.getenv("CHATWOOT_ACCESS_TOKEN", "")
    else:
        chatwoot_url = settings.chatwoot_url
        account_id = settings.chatwoot_account_id
        token = settings.chatwoot_access_token
        
    if not all([chatwoot_url, account_id, token]):
        raise HTTPException(status_code=400, detail="Chatwoot is not configured.")
        
    url = f"{chatwoot_url}/api/v1/accounts/{account_id}/conversations/{conversation_id}/messages"
    headers = {
        "api_access_token": token,
        "Content-Type": "application/json"
    }
    body = {
        "content": req.content,
        "message_type": req.message_type,
        "private": False
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.post(url, json=body, headers=headers)
        if res.status_code not in (200, 201):
            logger.error(f"Chatwoot API error ({res.status_code}): {res.text}")
            raise HTTPException(status_code=res.status_code, detail=f"Chatwoot API returned error: {res.text}")
        return {"success": True, "data": res.json()}
