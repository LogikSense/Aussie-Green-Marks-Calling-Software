import re
from datetime import datetime, timedelta
from typing import Optional, Union

import bcrypt
from fastapi import Depends, HTTPException, Header, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config import JWT_SECRET, JWT_ALGORITHM, JWT_ACCESS_EXPIRE_MINUTES
from database import get_db
from models import User

security = HTTPBearer(auto_error=False)
BCRYPT_MAX_PASSWORD_BYTES = 72

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


def _password_bytes(password: str) -> bytes:
    raw = password.encode("utf-8")
    return raw[:BCRYPT_MAX_PASSWORD_BYTES] if len(raw) > BCRYPT_MAX_PASSWORD_BYTES else raw


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(_password_bytes(plain), hashed.encode("utf-8"))


def create_access_token(sub: str, email: str) -> str:
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET must be set for auth (e.g. in .env)")
    expire = datetime.utcnow() + timedelta(minutes=JWT_ACCESS_EXPIRE_MINUTES)
    payload = {"sub": str(sub), "email": email, "exp": expire, "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        if not JWT_SECRET:
            return None
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.strip().lower()).first()


def validate_email(email: str) -> bool:
    return bool(email and EMAIL_REGEX.match(email.strip()))


def get_current_user_jwt(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.replace("Bearer ", "").strip()
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == int(user_id), User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def verify_jwt_or_api_key(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> Union[User, str]:
    from config import API_KEYS
    token = None
    if credentials:
        token = credentials.credentials
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authorization required")
    payload = decode_token(token)
    if payload and payload.get("type") == "access":
        user_id = payload.get("sub")
        if user_id:
            user = db.query(User).filter(User.id == int(user_id), User.is_active == True).first()
            if user:
                return user
    if token in API_KEYS:
        return token
    raise HTTPException(status_code=401, detail="Invalid or expired credentials")
