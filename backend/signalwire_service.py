"""SignalWire number inventory and native AI (SWML) calls.

Telephony uses the Compatibility API. Outbound AI uses the Calling API with
inline SWML so localhost does not need a public webhook.
https://signalwire.com/docs/compatibility-api.md
https://signalwire.com/docs/swml/reference/calling/ai.md
https://signalwire.com/docs/apis/rest/calls/call-commands
"""
from __future__ import annotations

import logging
from typing import Any, Optional
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import TwilioPhoneNumber, User, UserSettings
from signalwire_client import (
    PROVIDER,
    calling_dial,
    inbound_swml_url,
    laml_request,
    laml_request_sync,
    raise_for_signalwire,
    status_callback_url,
)

logger = logging.getLogger(__name__)

VOICE_AI_PROVIDER = "signalwire"


def _https_callback(url: Optional[str]) -> Optional[str]:
    value = (url or "").strip()
    if not value.startswith("https://"):
        return None
    host = (urlparse(value).hostname or "").lower()
    if host in {"localhost", "127.0.0.1"}:
        return None
    return value


def as_e164(number: str, label: str) -> str:
    raw = (number or "").strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    if raw.startswith("+"):
        candidate = f"+{digits}"
    else:
        candidate = f"+{digits}"
    if len(digits) < 10 or len(digits) > 15:
        raise HTTPException(
            status_code=400,
            detail=f"{label} must be a valid E.164 number (include country code).",
        )
    return candidate


def map_available_number(item: dict) -> dict:
    locality = item.get("locality") or item.get("rate_center") or ""
    return {
        "friendly_name": item.get("friendly_name") or item.get("phone_number"),
        "phone_number": item.get("phone_number"),
        "locality": locality or "",
        "region": item.get("region") or "",
    }


def _filter_available(items: list, country: str) -> list[dict]:
    requested = (country or "US").strip().upper() or "US"
    mapped = []
    for item in items:
        if not item.get("phone_number"):
            continue
        item_iso = (item.get("iso_country") or requested).strip().upper()
        if item_iso != requested:
            continue
        mapped.append(map_available_number(item))
    return mapped


def search_local_numbers_sync(country: str, area_code: Optional[str] = None) -> list[dict]:
    iso = (country or "US").strip().upper() or "US"
    params: dict[str, Any] = {}
    if area_code:
        params["AreaCode"] = area_code.strip()
    res = laml_request_sync("GET", f"/AvailablePhoneNumbers/{iso}/Local", params=params or None)
    raise_for_signalwire(res, "Failed to search SignalWire numbers.")
    payload = res.json() if res.content else {}
    items = payload.get("available_phone_numbers") or []
    return _filter_available(items, iso)


async def search_local_numbers(country: str, area_code: Optional[str] = None) -> list[dict]:
    iso = (country or "US").strip().upper() or "US"
    params: dict[str, Any] = {}
    if area_code:
        params["AreaCode"] = area_code.strip()
    res = await laml_request("GET", f"/AvailablePhoneNumbers/{iso}/Local", params=params or None)
    raise_for_signalwire(res, "Failed to search SignalWire numbers.")
    payload = res.json() if res.content else {}
    items = payload.get("available_phone_numbers") or []
    return _filter_available(items, iso)


def purchase_number_sync(phone_number: str) -> dict:
    data: dict[str, str] = {"PhoneNumber": phone_number}
    voice_url = inbound_swml_url()
    if voice_url:
        data["VoiceUrl"] = voice_url
        data["VoiceMethod"] = "POST"
    res = laml_request_sync("POST", "/IncomingPhoneNumbers", data=data)
    raise_for_signalwire(res, "Failed to purchase SignalWire number.")
    return res.json() if res.content else {"phone_number": phone_number}


async def purchase_number(phone_number: str) -> dict:
    data: dict[str, str] = {"PhoneNumber": phone_number}
    voice_url = inbound_swml_url()
    if voice_url:
        data["VoiceUrl"] = voice_url
        data["VoiceMethod"] = "POST"
    res = await laml_request("POST", "/IncomingPhoneNumbers", data=data)
    raise_for_signalwire(res, "Failed to purchase SignalWire number.")
    return res.json() if res.content else {"phone_number": phone_number}


async def list_incoming_numbers(page_size: int = 50) -> list[dict]:
    res = await laml_request("GET", "/IncomingPhoneNumbers", params={"PageSize": page_size})
    raise_for_signalwire(res, "Failed to list SignalWire numbers.")
    payload = res.json() if res.content else {}
    return payload.get("incoming_phone_numbers") or []


def list_incoming_numbers_sync(page_size: int = 50) -> list[dict]:
    res = laml_request_sync("GET", "/IncomingPhoneNumbers", params={"PageSize": page_size})
    raise_for_signalwire(res, "Failed to list SignalWire numbers.")
    payload = res.json() if res.content else {}
    return payload.get("incoming_phone_numbers") or []


def _sid_for_e164_sync(phone_number: str) -> Optional[str]:
    res = laml_request_sync(
        "GET",
        "/IncomingPhoneNumbers",
        params={"PhoneNumber": phone_number, "PageSize": 20},
    )
    if res.status_code >= 400:
        logger.error("SignalWire lookup failed for %s: %s", phone_number, res.text[:500])
        return None
    payload = res.json() if res.content else {}
    for item in payload.get("incoming_phone_numbers") or []:
        if item.get("phone_number") == phone_number:
            return item.get("sid")
    return None


def release_number_sync(phone_number: str) -> bool:
    sid = _sid_for_e164_sync(phone_number)
    if not sid:
        return False
    res = laml_request_sync("DELETE", f"/IncomingPhoneNumbers/{sid}")
    if res.status_code in (200, 204):
        return True
    logger.error("SignalWire release failed for %s: %s", phone_number, res.text[:500])
    return False


async def search_and_purchase_one(country: str) -> Optional[dict]:
    available = await search_local_numbers(country)
    if not available:
        return None
    return await purchase_number(available[0]["phone_number"])


def upsert_owned_number(db: Session, user: User, item: dict) -> TwilioPhoneNumber:
    e164 = item.get("phone_number")
    if not e164:
        raise HTTPException(status_code=502, detail="SignalWire did not return a phone number.")
    row = db.query(TwilioPhoneNumber).filter(TwilioPhoneNumber.phone_number == e164).first()
    caps = item.get("capabilities")
    if row:
        row.friendly_name = item.get("friendly_name") or row.friendly_name
        row.provider = PROVIDER
        if caps:
            row.capabilities = caps
        if row.assigned_to is None:
            row.assigned_to = user.id
            row.assignment_type = row.assignment_type or "primary"
        if not row.tenant_id:
            row.tenant_id = user.tenant_id
        return row
    row = TwilioPhoneNumber(
        phone_number=e164,
        friendly_name=item.get("friendly_name") or e164,
        locality=item.get("locality") or None,
        region=item.get("region") or None,
        status="active",
        assigned_to=user.id,
        assignment_type="primary",
        provider=PROVIDER,
        capabilities=caps if isinstance(caps, dict) else None,
        tenant_id=user.tenant_id,
    )
    db.add(row)
    return row


async def sync_incoming_numbers(db: Session, user: User) -> None:
    try:
        for item in await list_incoming_numbers():
            upsert_owned_number(db, user, item)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        logger.error("Failed to sync SignalWire incoming numbers: %s", exc)
        db.rollback()


def assigned_from_number(db: Session, user_id: int) -> Optional[TwilioPhoneNumber]:
    return (
        db.query(TwilioPhoneNumber)
        .filter(
            TwilioPhoneNumber.assigned_to == user_id,
            TwilioPhoneNumber.provider == PROVIDER,
            TwilioPhoneNumber.status == "active",
        )
        .order_by(TwilioPhoneNumber.id.asc())
        .first()
    )


def uses_signalwire_ai(settings: Optional[dict]) -> bool:
    if not settings:
        return False
    return (settings.get("voiceAiProvider") or "").strip().lower() == VOICE_AI_PROVIDER


def build_ai_swml(
    prompt: str,
    *,
    caller_name: Optional[str] = None,
    post_prompt_url: Optional[str] = None,
    inbound: bool = False,
) -> dict:
    text = (prompt or "").strip()
    if caller_name:
        text = f"{text}\n\nThe person you are calling is {caller_name}.".strip()
    ai: dict[str, Any] = {
        "prompt": {"text": text},
        "post_prompt": {
            "text": "Summarize the conversation, the outcome, and any follow-up the business should take."
        },
    }
    report_url = _https_callback(post_prompt_url) or _https_callback(status_callback_url())
    if report_url:
        ai["post_prompt_url"] = report_url
    steps: list[dict[str, Any]] = [{"ai": ai}]
    if inbound:
        steps = [{"answer": {}}, {"ai": ai}]
    return {"version": "1.0.0", "sections": {"main": steps}}


def unconfigured_swml() -> dict:
    return {
        "version": "1.0.0",
        "sections": {
            "main": [
                {"answer": {}},
                {"play": {"url": "say:This number is not configured for an AI agent."}},
                {"hangup": {}},
            ]
        },
    }


def prompt_from_vapi_assistant(assistant: dict) -> Optional[str]:
    if not isinstance(assistant, dict):
        return None
    parts = []
    first = (assistant.get("firstMessage") or "").strip()
    if first:
        parts.append(f"Open with: {first}")
    model = assistant.get("model") if isinstance(assistant.get("model"), dict) else {}
    messages = model.get("messages") if isinstance(model, dict) else None
    if isinstance(messages, list):
        for message in messages:
            if not isinstance(message, dict):
                continue
            if (message.get("role") or "").strip().lower() != "system":
                continue
            content = message.get("content")
            if isinstance(content, str) and content.strip():
                parts.append(content.strip())
            elif isinstance(content, list):
                texts = [
                    part.get("text", "").strip()
                    for part in content
                    if isinstance(part, dict) and part.get("text")
                ]
                if texts:
                    parts.append("\n".join(texts))
    if not parts:
        name = (assistant.get("name") or "").strip()
        if name:
            parts.append(f"You are {name}, a professional outbound calling agent.")
    return "\n\n".join(parts).strip() or None


async def resolve_agent_prompt(settings: Optional[dict]) -> str:
    if settings:
        stored = (settings.get("aiAgentPrompt") or "").strip()
        if stored:
            return stored
        vapi_key = (settings.get("vapiApiKey") or "").strip()
        assistant_id = (settings.get("vapiAssistantId") or "").strip()
        if vapi_key and assistant_id:
            try:
                async with httpx.AsyncClient() as client:
                    res = await client.get(
                        f"https://api.vapi.ai/assistant/{assistant_id}",
                        headers={"Authorization": f"Bearer {vapi_key}"},
                        timeout=20.0,
                    )
                if res.status_code < 400:
                    prompt = prompt_from_vapi_assistant(res.json())
                    if prompt:
                        return prompt
            except Exception as exc:
                logger.warning("Could not load Vapi assistant prompt for SignalWire: %s", exc)
    raise HTTPException(
        status_code=400,
        detail=(
            "SignalWire AI needs an agent prompt. Save it under Platform Settings → AI agent prompt, "
            "or keep a Vapi assistant configured so the prompt can be loaded."
        ),
    )


def prompt_for_user(db: Session, user_id: int) -> Optional[str]:
    row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if not row:
        return None
    return (row.ai_agent_prompt or "").strip() or None


def settings_webhook_url(settings: Optional[dict]) -> Optional[str]:
    if not settings:
        return None
    url = (settings.get("webhookUrl") or "").strip()
    return url or None


async def place_ai_call(
    *,
    from_number: str,
    to_number: str,
    prompt: str,
    caller_name: Optional[str] = None,
    status_url: Optional[str] = None,
    post_prompt_url: Optional[str] = None,
    custom_variables: Optional[dict[str, str]] = None,
) -> dict:
    origin = as_e164(from_number, "SignalWire caller ID")
    dest = as_e164(to_number, "Destination")
    params: dict[str, Any] = {
        "from": origin,
        "to": dest,
        "caller_id": origin,
    }
    callback = _https_callback(status_url) or _https_callback(status_callback_url())
    if callback:
        params["status_url"] = callback
        params["status_events"] = ["answered", "ended"]
    if custom_variables:
        params["custom_variables"] = custom_variables
    result = await calling_dial(
        params=params,
        swml=build_ai_swml(
            prompt,
            caller_name=caller_name,
            post_prompt_url=post_prompt_url,
            inbound=False,
        ),
    )
    if not result.get("id"):
        raise HTTPException(status_code=502, detail="SignalWire did not return a call id.")
    result["provider"] = PROVIDER
    return result
