from fastapi import APIRouter, Depends, HTTPException, Form, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from auth import get_current_user_jwt
from config import (
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY,
    TWILIO_API_SECRET,
    TWILIO_AUTH_TOKEN,
    TWILIO_TWIML_APP_SID,
)
from database import get_db
from models import TwilioPhoneNumber, User
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from twilio.rest import Client
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/twilio",
    tags=["twilio"]
)

VOICE_SDK_UNAVAILABLE = (
    "Voice telephony is not configured on this server. "
    "An administrator must set Twilio Voice SDK credentials."
)
REST_API_UNAVAILABLE = (
    "Phone number provisioning is not configured on this server. "
    "An administrator must set Twilio REST credentials."
)


def _missing_names(pairs):
    return [name for name, value in pairs if not value]


def _require_voice_sdk():
    missing = _missing_names([
        ("TWILIO_ACCOUNT_SID", TWILIO_ACCOUNT_SID),
        ("TWILIO_API_KEY", TWILIO_API_KEY),
        ("TWILIO_API_SECRET", TWILIO_API_SECRET),
        ("TWILIO_TWIML_APP_SID", TWILIO_TWIML_APP_SID),
    ])
    if missing:
        logger.error("Twilio Voice SDK not configured; missing %s", ", ".join(missing))
        raise HTTPException(status_code=503, detail=VOICE_SDK_UNAVAILABLE)


def _require_rest_client():
    missing = _missing_names([
        ("TWILIO_ACCOUNT_SID", TWILIO_ACCOUNT_SID),
        ("TWILIO_AUTH_TOKEN", TWILIO_AUTH_TOKEN),
    ])
    if missing:
        logger.error("Twilio REST API not configured; missing %s", ", ".join(missing))
        raise HTTPException(status_code=503, detail=REST_API_UNAVAILABLE)


class TwilioTokenRequest(BaseModel):
    client_name: str

@router.post("/token")
async def generate_token(req: TwilioTokenRequest, current_user: User = Depends(get_current_user_jwt)):
    """Generate a Twilio Voice SDK access token for the softphone."""
    _require_voice_sdk()

    try:
        identity = (req.client_name or "").strip() or current_user.email
        token = AccessToken(
            TWILIO_ACCOUNT_SID,
            TWILIO_API_KEY,
            TWILIO_API_SECRET,
            identity=identity
        )

        voice_grant = VoiceGrant(
            outgoing_application_sid=TWILIO_TWIML_APP_SID,
            incoming_allow=True,
        )
        token.add_grant(voice_grant)

        return {"token": token.to_jwt()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error generating Twilio token: %s", e)
        raise HTTPException(status_code=502, detail="Failed to issue voice token from telephony provider.")

@router.get("/numbers")
async def list_available_numbers(country: str = "US", area_code: str = None, current_user: User = Depends(get_current_user_jwt)):
    """Search for available Twilio phone numbers to purchase."""
    _require_rest_client()
    client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

    try:
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error searching Twilio numbers: %s", e)
        raise HTTPException(status_code=502, detail="Failed to search numbers from telephony provider.")

class PurchaseNumberRequest(BaseModel):
    phone_number: str

@router.post("/numbers/purchase")
async def purchase_number(req: PurchaseNumberRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_jwt)):
    _require_rest_client()
    client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    try:
        incoming_phone_number = client.incoming_phone_numbers.create(
            phone_number=req.phone_number
        )

        db_num = TwilioPhoneNumber(
            phone_number=incoming_phone_number.phone_number,
            friendly_name=incoming_phone_number.friendly_name,
            status="active",
            assigned_to=current_user.id,
            provider="twilio",
        )
        db.add(db_num)
        db.commit()
        db.refresh(db_num)

        return {"success": True, "phone_number": db_num.phone_number}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error purchasing Twilio number: %s", e)
        raise HTTPException(status_code=502, detail="Failed to purchase number from telephony provider.")

class AssignNumberRequest(BaseModel):
    user_id: int
    assignment_type: str # 'primary' or 'secondary'

@router.post("/numbers/{number_id}/assign")
async def assign_number(number_id: int, req: AssignNumberRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_jwt)):
    db_num = db.query(TwilioPhoneNumber).filter(TwilioPhoneNumber.id == number_id).first()
    if not db_num:
        raise HTTPException(status_code=404, detail="Number not found")

    db_num.assigned_to = req.user_id
    db_num.assignment_type = req.assignment_type
    db.commit()
    return {"success": True, "assigned_to": req.user_id}

@router.get("/my-numbers")
async def get_my_numbers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user_jwt)):
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
        try:
            client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            for incoming in client.incoming_phone_numbers.list(limit=50):
                e164 = incoming.phone_number
                row = db.query(TwilioPhoneNumber).filter(TwilioPhoneNumber.phone_number == e164).first()
                if not row:
                    row = TwilioPhoneNumber(
                        phone_number=e164,
                        friendly_name=incoming.friendly_name,
                        status="active",
                        assigned_to=current_user.id,
                        assignment_type="primary",
                        provider="twilio",
                        tenant_id=current_user.tenant_id,
                    )
                    db.add(row)
                elif row.assigned_to is None:
                    row.assigned_to = current_user.id
                    if not row.assignment_type:
                        row.assignment_type = "primary"
            db.commit()
        except Exception as e:
            logger.error("Failed to sync Twilio incoming numbers: %s", e)
            db.rollback()

    numbers = db.query(TwilioPhoneNumber).filter(TwilioPhoneNumber.assigned_to == current_user.id).all()
    return {"numbers": [{"id": n.id, "phone_number": n.phone_number, "type": n.assignment_type, "provider": n.provider or "twilio"} for n in numbers]}


@router.post("/voice")
async def voice_webhook(
    To: str = Form(...),
    From: str = Form(...),
    callerId: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    TwiML webhook for Twilio Client outgoing calls.
    Twilio POSTs here when a browser client starts a call.
    """
    logger.info("Incoming Twilio voice webhook. To: %s, From: %s, callerId: %s", To, From, callerId)
    
    twiml = "<Response>"
    
    # If the target starts with "client:", it's an internal agent-to-agent call
    if To.startswith("client:"):
        twiml += f"<Dial><Client>{To.replace('client:', '')}</Client></Dial>"
    else:
        # Determine caller ID (must be a verified Twilio number)
        active_caller_id = callerId
        if not active_caller_id:
            # Try to find a number assigned to this user
            client_identity = From.replace("client:", "")
            user = db.query(User).filter(User.email == client_identity).first()
            if user:
                num_row = db.query(TwilioPhoneNumber).filter(
                    TwilioPhoneNumber.assigned_to == user.id,
                    TwilioPhoneNumber.status == "active"
                ).first()
                if num_row:
                    active_caller_id = num_row.phone_number
                    
        if active_caller_id:
            # Dial out to the phone number using the specified callerId
            twiml += f'<Dial callerId="{active_caller_id}"><Number>{To}</Number></Dial>'
        else:
            # Fallback/error if no caller ID is configured
            twiml += "<Say>No outgoing phone number configured for this agent.</Say>"
            
    twiml += "</Response>"
    return Response(content=twiml, media_type="application/xml")
