"""Voice-call provider sync and artifact extraction.

Stores the provider Call object on CampaignLead.result and exposes a stable
API shape (transcript, summary, recordingUrl, endedReason) so clients do not
parse provider-specific envelopes.
"""
from typing import Any, Optional

import httpx

from models import CampaignLead

VAPI_BASE = "https://api.vapi.ai"
_EMPTY = (None, "", [], {})
_LIVE_STATUSES = {"queued", "ringing", "in-progress", "calling", "pending", "scheduled"}
_ENDED_STATUSES = {"ended", "completed"}
_FAILED_STATUSES = {"failed", "error"}
_NON_SPOKEN_ROLES = {"system", "tool", "function", "tool_call", "tool_call_result"}
_ASSISTANT_ROLES = {"bot", "assistant", "ai"}
_USER_ROLES = {"user", "customer"}
_FULL_REPORT_TYPES = {"end-of-call-report", "status-update", "hang"}


class VoiceProviderError(Exception):
    def __init__(self, detail: str, status_code: int = 502):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def _is_mapping(value: Any) -> bool:
    return isinstance(value, dict)


def _nonempty_str(value: Any) -> Optional[str]:
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return None


def _message_text(message: dict) -> Optional[str]:
    text = message.get("message") or message.get("content") or message.get("transcript")
    if isinstance(text, list):
        parts = []
        for part in text:
            if isinstance(part, dict) and _nonempty_str(part.get("text")):
                parts.append(part["text"].strip())
            elif _nonempty_str(part):
                parts.append(str(part).strip())
        text = " ".join(parts)
    return _nonempty_str(text)


def transcript_from_messages(messages: Any) -> Optional[str]:
    if not isinstance(messages, list):
        return None
    lines = []
    for item in messages:
        if not _is_mapping(item):
            continue
        role = (item.get("role") or item.get("speaker") or "").strip().lower()
        if role in _NON_SPOKEN_ROLES:
            continue
        text = _message_text(item)
        if not text:
            continue
        if role in _ASSISTANT_ROLES:
            label = "Assistant"
        elif role in _USER_ROLES:
            label = "User"
        else:
            label = (item.get("role") or item.get("speaker") or "Speaker").strip() or "Speaker"
        lines.append(f"{label}: {text}")
    return "\n".join(lines) if lines else None


def unwrap_provider_payload(payload: Any) -> dict:
    """Normalize Vapi GET /call, list item, or webhook body into a Call dict."""
    if not _is_mapping(payload):
        return {}

    message = payload.get("message") if _is_mapping(payload.get("message")) else None
    if message:
        call = message.get("call") if _is_mapping(message.get("call")) else {}
        msg_type = message.get("type") or ""
        if msg_type in _FULL_REPORT_TYPES or call.get("id"):
            merged = dict(call)
            if msg_type == "end-of-call-report":
                artifact = message.get("artifact") if _is_mapping(message.get("artifact")) else {}
                if artifact:
                    existing = merged.get("artifact") if _is_mapping(merged.get("artifact")) else {}
                    merged["artifact"] = {**existing, **artifact}
                if _is_mapping(message.get("analysis")):
                    merged["analysis"] = message["analysis"]
                if _nonempty_str(message.get("transcript")):
                    merged["transcript"] = message["transcript"].strip()
                if _nonempty_str(message.get("endedReason")) and not merged.get("endedReason"):
                    merged["endedReason"] = message["endedReason"]
                if _nonempty_str(message.get("summary")) and not merged.get("summary"):
                    merged["summary"] = message["summary"]
            elif _nonempty_str(message.get("endedReason")) and not merged.get("endedReason"):
                merged["endedReason"] = message["endedReason"]
            if _nonempty_str(message.get("status")) and not merged.get("status"):
                merged["status"] = message["status"]
            return merged
        return {}

    if _is_mapping(payload.get("call")) and payload.get("call", {}).get("id"):
        return dict(payload["call"])
    return dict(payload)


def merge_provider_call(existing: Any, incoming: Any) -> dict:
    """Merge a new provider snapshot onto stored result without wiping artifacts."""
    base = dict(existing) if _is_mapping(existing) else {}
    incoming = unwrap_provider_payload(incoming)
    merged = dict(base)
    for key, value in incoming.items():
        if value in _EMPTY:
            continue
        if key in ("artifact", "analysis") and _is_mapping(value):
            prior = merged.get(key) if _is_mapping(merged.get(key)) else {}
            merged[key] = {
                **prior,
                **{k: v for k, v in value.items() if v not in _EMPTY},
            }
        else:
            merged[key] = value
    return merged


def extract_ended_reason(call: Any) -> Optional[str]:
    if not _is_mapping(call):
        return None
    nested = call.get("call") if _is_mapping(call.get("call")) else {}
    return _nonempty_str(call.get("endedReason")) or _nonempty_str(nested.get("endedReason"))


def explain_ended_reason(reason: Optional[str]) -> Optional[str]:
    """User-facing outcome from a Vapi endedReason code. Never return the raw code."""
    code = (_nonempty_str(reason) or "").lower()
    if not code:
        return None
    if code.startswith("customer-ended-call"):
        return "The recipient hung up."
    if code.startswith("assistant-ended") or code == "assistant-said-end-call-phrase":
        return "The assistant ended the call."
    if code == "customer-did-not-answer":
        return "The recipient did not answer."
    if code == "customer-busy":
        return "The recipient's line was busy."
    if code == "voicemail":
        return "The call reached voicemail."
    if code == "silence-timed-out":
        return "The call ended after a period of silence."
    if code == "exceeded-max-duration":
        return "The call reached its maximum duration."
    if code == "manually-canceled":
        return "The call was canceled."
    if "twilio-completed-call" in code or "sip-completed-call" in code or code == "vonage-completed":
        return "The phone carrier ended the call."
    if "failed-to-connect" in code or code == "vonage-rejected":
        return "The phone carrier could not connect the call."
    if "misdialed" in code:
        return "The destination number was invalid."
    if code.startswith("call.start.error") or code in {"assistant-not-found", "assistant-not-valid"}:
        return "The call could not start."
    if "vapifault" in code or code == "worker-shutdown":
        return "The voice platform ended the call due to an internal error."
    if "providerfault" in code or "pipeline-error" in code or "pipeline-no-available" in code:
        return "A voice or telephony provider error ended the call."
    if "error" in code or "failed" in code:
        return "The call ended due to a provider error."
    return "The call ended."


def extract_transcript(call: Any) -> Optional[str]:
    if not _is_mapping(call):
        return None
    artifact = call.get("artifact") if _is_mapping(call.get("artifact")) else {}
    message = call.get("message") if _is_mapping(call.get("message")) else {}
    message_artifact = message.get("artifact") if _is_mapping(message.get("artifact")) else {}
    for candidate in (
        call.get("transcript"),
        artifact.get("transcript"),
        message.get("transcript"),
        message_artifact.get("transcript"),
    ):
        text = _nonempty_str(candidate)
        if text:
            return text
    return transcript_from_messages(
        artifact.get("messages")
        or call.get("messages")
        or message_artifact.get("messages")
        or message.get("messages")
    )


def extract_summary(call: Any) -> Optional[str]:
    if not _is_mapping(call):
        return None
    analysis = call.get("analysis") if _is_mapping(call.get("analysis")) else {}
    artifact = call.get("artifact") if _is_mapping(call.get("artifact")) else {}
    for candidate in (
        analysis.get("summary"),
        call.get("summary"),
        artifact.get("summary"),
    ):
        text = _nonempty_str(candidate)
        if text:
            return text
    return None


def extract_recording_url(call: Any) -> Optional[str]:
    if not _is_mapping(call):
        return None
    artifact = call.get("artifact") if _is_mapping(call.get("artifact")) else {}
    recording = artifact.get("recording") if _is_mapping(artifact.get("recording")) else {}
    for candidate in (
        call.get("recordingUrl"),
        artifact.get("recordingUrl"),
        artifact.get("stereoRecordingUrl"),
        recording.get("monoUrl") or recording.get("url") or recording.get("recordingUrl"),
    ):
        url = _nonempty_str(candidate)
        if url:
            return url
    return None


def map_lead_status(provider_status: Optional[str], ended_reason: Optional[str] = None) -> str:
    status = (provider_status or "").strip().lower()
    if status in _ENDED_STATUSES:
        return "completed"
    if status in _FAILED_STATUSES:
        return "failed"
    if ended_reason and status not in _LIVE_STATUSES:
        return "completed"
    return provider_status or "calling"


def apply_provider_call(lead: CampaignLead, payload: dict) -> None:
    merged = merge_provider_call(lead.result, payload)
    lead.result = merged
    lead.status = map_lead_status(merged.get("status"), extract_ended_reason(merged))
    call_id = merged.get("id")
    if _nonempty_str(call_id) and not lead.vapi_call_id:
        lead.vapi_call_id = call_id.strip()


def serialize_lead(lead: CampaignLead) -> dict:
    call = lead.result if _is_mapping(lead.result) else {}
    created_at = lead.created_at.isoformat() if lead.created_at else None
    scheduled_at = lead.scheduled_at.isoformat() if lead.scheduled_at else None
    return {
        "id": lead.id,
        "campaign_id": lead.campaign_id,
        "customer_id": lead.customer_id,
        "status": lead.status,
        "vapi_call_id": lead.vapi_call_id,
        "scheduled_at": scheduled_at,
        "created_at": created_at,
        "result": call,
        "transcript": extract_transcript(call),
        "summary": extract_summary(call),
        "recordingUrl": extract_recording_url(call),
        "endedReason": extract_ended_reason(call),
        "endedReasonLabel": explain_ended_reason(extract_ended_reason(call)),
    }


def _parse_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError as exc:
        raise VoiceProviderError("Voice provider returned an invalid call payload.") from exc


async def fetch_call(api_key: str, call_id: str) -> dict:
    headers = {"Authorization": f"Bearer {api_key}"}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(f"{VAPI_BASE}/call/{call_id}", headers=headers)
            if response.status_code == 404:
                raise VoiceProviderError("Call not found at voice provider.", status_code=404)
            if response.status_code != 200:
                raise VoiceProviderError(
                    f"Voice provider returned {response.status_code} while fetching the call.",
                )
            call = unwrap_provider_payload(_parse_json(response))
            status = (call.get("status") or "").strip().lower()
            if extract_transcript(call) or status not in _ENDED_STATUSES:
                return call
            listed = await client.get(
                f"{VAPI_BASE}/call",
                headers=headers,
                params={"id": call_id, "limit": 1},
            )
            if listed.status_code == 200:
                items = _parse_json(listed)
                match = None
                if isinstance(items, list) and items:
                    match = items[0] if _is_mapping(items[0]) else None
                elif _is_mapping(items):
                    match = items
                if match:
                    return merge_provider_call(call, match)
            return call
    except VoiceProviderError:
        raise
    except httpx.HTTPError as exc:
        raise VoiceProviderError("Failed to reach voice provider.") from exc
