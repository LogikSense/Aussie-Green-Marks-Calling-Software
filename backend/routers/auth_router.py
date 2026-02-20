from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import JWT_SECRET
from database import get_db
from models import User
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_user_by_email,
    validate_email,
    get_current_user_jwt,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]

    class Config:
        from_attributes = True


@router.post("/register", response_model=TokenResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if not JWT_SECRET:
        raise HTTPException(status_code=503, detail="Auth not configured (JWT_SECRET missing)")
    email = data.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if not validate_email(email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if not data.password or len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if get_user_by_email(db, email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=email,
        password_hash=hash_password(data.password),
        full_name=(data.full_name or "").strip() or None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), user.email)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    if not JWT_SECRET:
        raise HTTPException(status_code=503, detail="Auth not configured (JWT_SECRET missing)")
    email = data.email.strip().lower()
    user = get_user_by_email(db, email)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is disabled")
    token = create_access_token(str(user.id), user.email)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user_jwt)):
    return UserResponse(id=current_user.id, email=current_user.email, full_name=current_user.full_name)
