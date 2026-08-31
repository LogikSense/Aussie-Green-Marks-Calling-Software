"""SignalWire Compatibility (LaML) and Calling REST client.

Auth is HTTP Basic: Project ID as username, API token as password.
https://signalwire.com/docs/apis/authorization.md
"""
from __future__ import annotations

import logging
from typing import Any, Optional
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

from config import (
    SIGNALWIRE_API_TOKEN,
    SIGNALWIRE_PROJECT_ID,
    SIGNALWIRE_PUBLIC_BASE_URL,
    SIGNALWIRE_SPACE_URL,
    SIGNALWIRE_WEBHOOK_SECRET,
)

logger = logging.getLogger(__name__)

LAML_VERSION = "2010-04-01"
PROVIDER = "signalwire"


def iso_country_from_e164(phone: str) -> str:
    number = (phone or "").strip()
    if number.startswith("+61"):
        return "AU"
    if number.startswith("+44"):
        return "GB"
    if number.startswith("+64"):
        return "NZ"
    if number.startswith("+1"):
        return "US"
    return "US"


def space_host(raw: Optional[str] = None) -> str:
    value = (raw if raw is not None else SIGNALWIRE_SPACE_URL).strip()
    if not value:
        return ""
    if "://" not in value:
        value = f"https://{value}"
    host = (urlparse(value).hostname or "").strip().lower().rstrip(".")
    if host and "." not in host:
        host = f"{host}.signalwire.com"
    return host


def require_credentials() -> tuple[str, str, str]:
    host = space_host()
    project_id = SIGNALWIRE_PROJECT_ID
    token = SIGNALWIRE_API_TOKEN
    missing = []
    if not host:
        missing.append("SIGNALWIRE_SPACE_URL")
    if not project_id:
        missing.append("SIGNALWIRE_PROJECT_ID")
    if not token:
        missing.append("SIGNALWIRE_API_TOKEN")
    if missing:
        raise HTTPException(
            status_code=503,
            detail=(
                "SignalWire is not configured. In Dashboard → API Credentials copy Space URL "
                f"and Project ID, then set {', '.join(missing)} in backend/.env."
            ),
        )
    if not token.startswith("PT"):
        raise HTTPException(
            status_code=503,
            detail="SIGNALWIRE_API_TOKEN must be a SignalWire API token (starts with PT).",
        )
    return host, project_id, token


def laml_url(path: str) -> str:
    host, project_id, _ = require_credentials()
    suffix = path if path.startswith("/") else f"/{path}"
    return f"https://{host}/api/laml/{LAML_VERSION}/Accounts/{project_id}{suffix}"


def calling_url() -> str:
    host, _, _ = require_credentials()
    return f"https://{host}/api/calling/calls"


def _public_path(path: str) -> Optional[str]:
    if not SIGNALWIRE_PUBLIC_BASE_URL:
        return None
    url = f"{SIGNALWIRE_PUBLIC_BASE_URL}{path}"
    if SIGNALWIRE_WEBHOOK_SECRET:
        url = f"{url}?token={SIGNALWIRE_WEBHOOK_SECRET}"
    return url


def inbound_swml_url() -> Optional[str]:
    return _public_path("/api/signalwire/swml")


def status_callback_url() -> Optional[str]:
    return _public_path("/api/signalwire/status")


def _auth() -> tuple[str, str]:
    _, project_id, token = require_credentials()
    return (project_id, token)


def _error_detail(res: httpx.Response, fallback: str) -> str:
    text = (res.text or "").strip()
    try:
        body = res.json()
    except Exception:
        body = None
    if isinstance(body, dict):
        errors = body.get("errors")
        first = errors[0] if isinstance(errors, list) and errors and isinstance(errors[0], dict) else {}
        code = (first.get("code") or "").strip()
        message = first.get("message") or first.get("detail") or body.get("message") or body.get("detail")
        if code == "not_routable":
            return (
                "SignalWire cannot route this destination from this Space. "
                "Trial Spaces are typically US-only. Enable geographic permissions for the destination "
                "country in the Dashboard, verify the number if required, or dial a US number."
            )
        if message:
            return str(message)
    if text and len(text) < 400 and not text.startswith("<"):
        return text
    return fallback


def raise_for_signalwire(res: httpx.Response, fallback: str) -> None:
    if res.status_code < 400:
        return
    logger.error("SignalWire API error %s: %s", res.status_code, res.text[:1000])
    if res.status_code in (401, 403):
        raise HTTPException(
            status_code=401,
            detail=(
                "SignalWire rejected the credentials. Confirm Space URL, Project ID, and API token "
                "scopes (Numbers, Voice) in Dashboard → API Credentials."
            ),
        )
    detail = _error_detail(res, fallback)
    if res.status_code == 400 and (res.text or "").lstrip().startswith("<"):
        detail = (
            "SignalWire rejected the call request. Use an E.164 destination, a SignalWire From number "
            "you own, and on a trial Space only call numbers verified in the Dashboard."
        )
    status = res.status_code if res.status_code < 500 else 502
    if res.status_code == 422:
        status = 400
    raise HTTPException(status_code=status, detail=detail)


async def laml_request(
    method: str,
    path: str,
    *,
    params: Optional[dict] = None,
    data: Optional[dict] = None,
    timeout: float = 30.0,
) -> httpx.Response:
    require_credentials()
    async with httpx.AsyncClient() as client:
        res = await client.request(
            method,
            laml_url(path),
            params=params,
            data=data,
            auth=_auth(),
            timeout=timeout,
        )
    return res


def laml_request_sync(
    method: str,
    path: str,
    *,
    params: Optional[dict] = None,
    data: Optional[dict] = None,
    timeout: float = 30.0,
) -> httpx.Response:
    require_credentials()
    with httpx.Client() as client:
        return client.request(
            method,
            laml_url(path),
            params=params,
            data=data,
            auth=_auth(),
            timeout=timeout,
        )


async def calling_dial(*, params: dict[str, Any], swml: dict[str, Any], timeout: float = 30.0) -> dict:
    """Place an outbound call with inline SWML.

    SWML must be a top-level sibling of `command`/`params`, not nested in params.
    https://signalwire.com/docs/swml/guides/make-and-receive-calls
    """
    require_credentials()
    body = {"command": "dial", "params": params, "swml": swml}
    async with httpx.AsyncClient() as client:
        res = await client.post(
            calling_url(),
            json=body,
            auth=_auth(),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            timeout=timeout,
        )
    if res.status_code >= 400:
        logger.error(
            "SignalWire dial failed %s from=%s to=%s",
            res.status_code,
            params.get("from"),
            params.get("to"),
        )
    raise_for_signalwire(res, "Failed to place SignalWire call.")
    try:
        return res.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="SignalWire returned a non-JSON call response.") from exc
