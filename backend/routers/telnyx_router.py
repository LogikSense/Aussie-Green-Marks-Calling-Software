import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from auth import get_current_user_jwt
from config import TELNYX_API_KEY
from database import get_db
from models import TwilioPhoneNumber, User

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/telnyx",
    tags=["telnyx"]
)

TELNYX_BASE = "https://api.telnyx.com/v2"


def _get_headers():
    if not TELNYX_API_KEY:
        raise HTTPException(status_code=503, detail="Telnyx API key not configured on this server.")
    if not TELNYX_API_KEY.startswith("KEY_"):
        raise HTTPException(
            status_code=503,
            detail="Telnyx API key is not a v2 key. In Mission Control → API Keys, copy a key that starts with KEY_.",
        )
    return {
        "Authorization": f"Bearer {TELNYX_API_KEY}",
        "Content-Type": "application/json",
    }


def _raise_for_telnyx(res: httpx.Response, fallback: str) -> None:
    if res.status_code < 400:
        return
    logger.error("Telnyx API error: %s", res.text)
    if res.status_code in (401, 403):
        raise HTTPException(
            status_code=401,
            detail="Telnyx rejected the API key. Copy a v2 key from Mission Control (starts with KEY_).",
        )
    raise HTTPException(status_code=res.status_code if res.status_code < 500 else 502, detail=fallback)

@router.get("/numbers")
async def search_telnyx_numbers(country: str = "US", area_code: str = None, current_user: User = Depends(get_current_user_jwt)):
    headers = _get_headers()
    params = {
        "filter[country_code]": country,
        "filter[limit]": 20
    }
    if area_code:
        params["filter[national_destination_code]"] = area_code
        
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{TELNYX_BASE}/available_phone_numbers", headers=headers, params=params)
            _raise_for_telnyx(res, "Failed to fetch available numbers from Telnyx.")
            
            data = res.json().get("data", [])
            results = []
            for item in data:
                results.append({
                    "friendly_name": item.get("phone_number"),
                    "phone_number": item.get("phone_number"),
                    "locality": item.get("locality", ""),
                    "region": item.get("administrative_area", "")
                })
            return {"numbers": results}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error searching Telnyx numbers: %s", e)
        raise HTTPException(status_code=502, detail="Failed to search numbers from Telnyx API.")

class TelnyxPurchaseRequest(BaseModel):
    phone_number: str

@router.post("/numbers/purchase")
async def purchase_telnyx_number(req: TelnyxPurchaseRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_jwt)):
    headers = _get_headers()
    body = {
        "phone_numbers": [{"phone_number": req.phone_number}]
    }
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(f"{TELNYX_BASE}/number_orders", headers=headers, json=body)
            _raise_for_telnyx(res, "Failed to order number from Telnyx.")
                
            db_num = TwilioPhoneNumber(
                phone_number=req.phone_number,
                friendly_name=req.phone_number,
                status="active",
                assigned_to=current_user.id,
                assignment_type="primary",
                provider="telnyx",
                tenant_id=current_user.tenant_id
            )
            db.add(db_num)
            db.commit()
            db.refresh(db_num)
            return {"success": True, "phone_number": db_num.phone_number}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error purchasing Telnyx number: %s", e)
        raise HTTPException(status_code=502, detail="Failed to order number from Telnyx.")

@router.get("/my-numbers")
async def get_my_telnyx_numbers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user_jwt)):
    numbers = db.query(TwilioPhoneNumber).filter(
        TwilioPhoneNumber.assigned_to == current_user.id,
        TwilioPhoneNumber.provider == "telnyx"
    ).all()
    return {"numbers": [{"id": n.id, "phone_number": n.phone_number, "type": n.assignment_type} for n in numbers]}
