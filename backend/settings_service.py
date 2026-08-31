from typing import Optional
from sqlalchemy.orm import Session
from models import UserSettings


def to_api_config(row: UserSettings) -> dict:
    return {
        "crmEndpoint": row.crm_endpoint or "",
        "crmApiKey": row.crm_api_key or "",
        "vapiApiKey": row.vapi_api_key or "",
        "vapiPhoneNumberId": row.vapi_phone_number_id or "",
        "vapiAssistantId": row.vapi_assistant_id or "",
        "webhookUrl": row.webhook_url or "",
        "voiceAiProvider": row.voice_ai_provider or "",
        "aiAgentPrompt": row.ai_agent_prompt or "",
    }


def get_settings(db: Session, user_id: int) -> Optional[dict]:
    row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    return to_api_config(row) if row else None


def upsert_settings(db: Session, user_id: int, payload: dict) -> dict:
    row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if row:
        row.crm_endpoint = (payload.get("crmEndpoint") or "").strip()
        row.crm_api_key = (payload.get("crmApiKey") or "").strip()
        row.vapi_api_key = (payload.get("vapiApiKey") or "").strip()
        row.vapi_phone_number_id = (payload.get("vapiPhoneNumberId") or "").strip()
        row.vapi_assistant_id = (payload.get("vapiAssistantId") or "").strip()
        row.webhook_url = (payload.get("webhookUrl") or "").strip()
        if "voiceAiProvider" in payload:
            row.voice_ai_provider = (payload.get("voiceAiProvider") or "").strip()
        if "aiAgentPrompt" in payload:
            row.ai_agent_prompt = (payload.get("aiAgentPrompt") or "").strip()
        db.commit()
        db.refresh(row)
        return to_api_config(row)
    row = UserSettings(
        user_id=user_id,
        crm_endpoint=(payload.get("crmEndpoint") or "").strip(),
        crm_api_key=(payload.get("crmApiKey") or "").strip(),
        vapi_api_key=(payload.get("vapiApiKey") or "").strip(),
        vapi_phone_number_id=(payload.get("vapiPhoneNumberId") or "").strip(),
        vapi_assistant_id=(payload.get("vapiAssistantId") or "").strip(),
        webhook_url=(payload.get("webhookUrl") or "").strip(),
        voice_ai_provider=(payload.get("voiceAiProvider") or "").strip(),
        ai_agent_prompt=(payload.get("aiAgentPrompt") or "").strip(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return to_api_config(row)
