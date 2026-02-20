import hashlib
import os
from datetime import datetime
from pathlib import Path

load_dotenv = __import__("dotenv", fromlist=["load_dotenv"]).load_dotenv
load_dotenv()

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

_api_keys_raw = os.getenv("API_KEYS", "")
API_KEYS = [k.strip() for k in _api_keys_raw.split(",") if k.strip()] if _api_keys_raw else []
if not API_KEYS:
    _default = hashlib.sha256(f"default_{datetime.now().isoformat()}".encode()).hexdigest()[:32]
    API_KEYS = [_default]
