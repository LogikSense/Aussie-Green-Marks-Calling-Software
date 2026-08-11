import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from auth import get_current_user_jwt
from database import get_db
from models import TwilioPhoneNumber
from sqlalchemy.orm import Session
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from twilio.rest import Client
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/twilio",
    tags=["twilio"]
)

class TwilioTokenRequest(BaseModel):
    client_name: str

@router.post("/token")
async def generate_token(req: TwilioTokenRequest, current_user=Depends(get_current_user_jwt)):
    """Generate a Twilio Voice SDK access token for the softphone."""
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    api_key = os.getenv("TWILIO_API_KEY")
    api_secret = os.getenv("TWILIO_API_SECRET")
    twiml_app_sid = os.getenv("TWILIO_TWIML_APP_SID")

    if not all([account_sid, api_key, api_secret, twiml_app_sid]):
        logger.error("Missing Twilio credentials in environment variables.")
        raise HTTPException(status_code=500, detail="Twilio is not configured properly on the server.")

    try:
        # Create access token with credentials
        token = AccessToken(
            account_sid,
            api_key,
            api_secret,
            identity=req.client_name
        )

        # Create a Voice grant and add to token
        voice_grant = VoiceGrant(
            outgoing_application_sid=twiml_app_sid,
            incoming_allow=True, # Allow incoming calls
        )
        token.add_grant(voice_grant)

        return {"token": token.to_jwt()}
    except Exception as e:
        logger.error(f"Error generating Twilio token: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/numbers")
async def list_available_numbers(country: str = "US", area_code: str = None, current_user=Depends(get_current_user_jwt)):
    """Search for available Twilio phone numbers to purchase."""
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    
    if not all([account_sid, auth_token]):
        raise HTTPException(status_code=500, detail="Twilio is not configured properly on the server.")
        
    client = Client(account_sid, auth_token)
    
    try:
        # Simplistic search
        params = {"limit": 20}
        if area_code:
            params["area_code"] = area_code
            
        local_numbers = client.available_phone_numbers(country).local.list(**params)
        
        results = []
        for n in local_numbers:
            results.append({
                "friendly_name": n.friendly_name,
                "phone_number": n.phone_number,
                "locality": n.locality,
                "region": n.region,
            })
            
        return {"numbers": results}
    except Exception as e:
        logger.error(f"Error searching Twilio numbers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class PurchaseNumberRequest(BaseModel):
    phone_number: str

@router.post("/numbers/purchase")
async def purchase_number(req: PurchaseNumberRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user_jwt)):
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    
    if not all([account_sid, auth_token]):
        raise HTTPException(status_code=500, detail="Twilio is not configured properly on the server.")
        
    client = Client(account_sid, auth_token)
    try:
        incoming_phone_number = client.incoming_phone_numbers.create(
            phone_number=req.phone_number
        )
        
        db_num = TwilioPhoneNumber(
            phone_number=incoming_phone_number.phone_number,
            friendly_name=incoming_phone_number.friendly_name,
            status="active"
        )
        db.add(db_num)
        db.commit()
        db.refresh(db_num)
        
        return {"success": True, "phone_number": db_num.phone_number}
    except Exception as e:
        logger.error(f"Error purchasing Twilio number: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class AssignNumberRequest(BaseModel):
    user_id: int
    assignment_type: str # 'primary' or 'secondary'

@router.post("/numbers/{number_id}/assign")
async def assign_number(number_id: int, req: AssignNumberRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user_jwt)):
    if current_user.email != "admin": # Basic admin check, improve later
        pass # In a real app we check role
        
    db_num = db.query(TwilioPhoneNumber).filter(TwilioPhoneNumber.id == number_id).first()
    if not db_num:
        raise HTTPException(status_code=404, detail="Number not found")
        
    db_num.assigned_to = req.user_id
    db_num.assignment_type = req.assignment_type
    db.commit()
    return {"success": True, "assigned_to": req.user_id}

@router.get("/my-numbers")
async def get_my_numbers(db: Session = Depends(get_db), current_user=Depends(get_current_user_jwt)):
    numbers = db.query(TwilioPhoneNumber).filter(TwilioPhoneNumber.assigned_to == current_user.id).all()
    return {"numbers": [{"id": n.id, "phone_number": n.phone_number, "type": n.assignment_type} for n in numbers]}
