import hashlib
import os
from datetime import datetime
from pathlib import Path

load_dotenv = __import__("dotenv", fromlist=["load_dotenv"]).load_dotenv
_ENV_FILE = Path(__file__).resolve().parent / ".env"
load_dotenv(_ENV_FILE, override=True)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{Path(__file__).resolve().parent / 'app.db'}",
)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {}

JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ACCESS_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_EXPIRE_MINUTES", "60"))

TWILIO_ACCOUNT_SID = (os.getenv("TWILIO_ACCOUNT_SID") or "").strip()
TWILIO_AUTH_TOKEN = (os.getenv("TWILIO_AUTH_TOKEN") or "").strip()
TWILIO_API_KEY = (os.getenv("TWILIO_API_KEY") or "").strip()
TWILIO_API_SECRET = (os.getenv("TWILIO_API_SECRET") or "").strip()
TWILIO_TWIML_APP_SID = (os.getenv("TWILIO_TWIML_APP_SID") or "").strip()

TELNYX_API_KEY = (os.getenv("TELNYX_API_KEY") or "").strip()

SIGNALWIRE_SPACE_URL = (os.getenv("SIGNALWIRE_SPACE_URL") or "").strip()
SIGNALWIRE_PROJECT_ID = (os.getenv("SIGNALWIRE_PROJECT_ID") or "").strip()
SIGNALWIRE_API_TOKEN = (os.getenv("SIGNALWIRE_API_TOKEN") or "").strip()
SIGNALWIRE_PUBLIC_BASE_URL = (os.getenv("SIGNALWIRE_PUBLIC_BASE_URL") or "").strip().rstrip("/")
SIGNALWIRE_WEBHOOK_SECRET = (os.getenv("SIGNALWIRE_WEBHOOK_SECRET") or "").strip()
SIGNALWIRE_SIGNING_KEY = (os.getenv("SIGNALWIRE_SIGNING_KEY") or "").strip()

CALL_CREDIT_COST = float(os.getenv("CALL_CREDIT_COST", "0.50"))

_api_keys_raw = os.getenv("API_KEYS", "")
API_KEYS = [k.strip() for k in _api_keys_raw.split(",") if k.strip()] if _api_keys_raw else []
if not API_KEYS:
    _default = hashlib.sha256(f"default_{datetime.now().isoformat()}".encode()).hexdigest()[:32]
    API_KEYS = [_default]
