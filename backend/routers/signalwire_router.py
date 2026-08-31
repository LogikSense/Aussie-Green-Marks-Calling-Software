import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user_jwt
from config import SIGNALWIRE_WEBHOOK_SECRET
from database import get_db
from models import CampaignLead, TwilioPhoneNumber, User
from signalwire_client import PROVIDER, require_credentials
import signalwire_service as sw

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/signalwire", tags=["signalwire"])


class PurchaseRequest(BaseModel):
    phone_number: str


def _require_webhook_token(token: Optional[str]) -> None:
    if not SIGNALWIRE_WEBHOOK_SECRET:
        return
    if (token or "").strip() != SIGNALWIRE_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid SignalWire webhook token.")


def _called_number(payload: Any, form: Optional[dict] = None) -> Optional[str]:
    if isinstance(payload, dict):
        for key in ("to", "To", "called_id"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        call = payload.get("call") if isinstance(payload.get("call"), dict) else {}
        for key in ("to", "To"):
            value = call.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        params = payload.get("params") if isinstance(payload.get("params"), dict) else {}
        value = params.get("to") or params.get("To")
        if isinstance(value, str) and value.strip():
            return value.strip()
    if form:
        for key in ("To", "to", "Called"):
            value = form.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


@router.get("/numbers")
async def search_numbers(
    country: str = "US",
    area_code: Optional[str] = None,
    current_user: User = Depends(get_current_user_jwt),
):
    require_credentials()
    numbers = await sw.search_local_numbers(country, area_code)
    return {"numbers": numbers}


@router.post("/numbers/purchase")
async def purchase_number(
    req: PurchaseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_jwt),
):
    require_credentials()
    phone = (req.phone_number or "").strip()
    if not phone.startswith("+"):
        raise HTTPException(status_code=400, detail="Phone number must be in E.164 format.")
    purchased = await sw.purchase_number(phone)
    db_num = sw.upsert_owned_number(db, current_user, purchased)
    db.commit()
    db.refresh(db_num)
    return {"success": True, "phone_number": db_num.phone_number}


@router.get("/my-numbers")
async def get_my_numbers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_jwt),
):
    require_credentials()
    await sw.sync_incoming_numbers(db, current_user)
    numbers = (
        db.query(TwilioPhoneNumber)
        .filter(
            TwilioPhoneNumber.assigned_to == current_user.id,
            TwilioPhoneNumber.provider == PROVIDER,
        )
        .all()
    )
    return {
        "numbers": [
            {
                "id": n.id,
                "phone_number": n.phone_number,
                "type": n.assignment_type,
                "provider": n.provider or PROVIDER,
            }
            for n in numbers
        ]
    }


async def _inbound_swml_document(request: Request, token: Optional[str], db: Session):
    _require_webhook_token(token)
    payload: Any = {}
    form: dict = {}
    content_type = (request.headers.get("content-type") or "").lower()
    if request.method == "POST":
        if "application/json" in content_type:
            try:
                payload = await request.json()
            except Exception:
                payload = {}
        else:
            try:
                form = dict(await request.form())
            except Exception:
                form = {}
    called = _called_number(payload, form)
    prompt = None
    post_prompt_url = None
    if called:
        row = db.query(TwilioPhoneNumber).filter(TwilioPhoneNumber.phone_number == called).first()
        if row and row.assigned_to:
            from settings_service import get_settings

            settings = get_settings(db, row.assigned_to)
            post_prompt_url = sw.settings_webhook_url(settings)
            try:
                prompt = await sw.resolve_agent_prompt(settings)
            except HTTPException:
                prompt = None
    if not prompt:
        return sw.unconfigured_swml()
    return sw.build_ai_swml(prompt, post_prompt_url=post_prompt_url, inbound=True)


@router.post("/swml")
async def inbound_swml_post(
    request: Request,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """SWML document for inbound calls. Assign the number's voice handler to this URL."""
    return await _inbound_swml_document(request, token, db)


@router.get("/swml")
async def inbound_swml_get(
    request: Request,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return await _inbound_swml_document(request, token, db)


async def _call_status_payload(request: Request, token: Optional[str], db: Session):
    _require_webhook_token(token)
    payload: Any = {}
    if request.method == "POST":
        try:
            payload = await request.json()
        except Exception:
            payload = {}
    if not isinstance(payload, dict):
        return {"success": True}
    call_id = payload.get("id") or payload.get("call_id")
    call = payload.get("call") if isinstance(payload.get("call"), dict) else {}
    call_id = call_id or call.get("id")
    if not call_id:
        return {"success": True}
    lead = db.query(CampaignLead).filter(CampaignLead.vapi_call_id == str(call_id)).first()
    if not lead:
        return {"success": True}
    existing = lead.result if isinstance(lead.result, dict) else {}
    merged = {**existing, **payload, "provider": PROVIDER, "id": str(call_id)}
    lead.result = merged
    status = (payload.get("status") or call.get("status") or "").strip().lower()
    if status in {"ended", "completed", "failed", "canceled"}:
        lead.status = "failed" if status == "failed" else "completed"
    db.commit()
    return {"success": True}


@router.post("/status")
async def call_status_post(
    request: Request,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return await _call_status_payload(request, token, db)


@router.get("/status")
async def call_status_get(
    request: Request,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return await _call_status_payload(request, token, db)
