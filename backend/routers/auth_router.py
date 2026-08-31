from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import JWT_SECRET
from database import get_db
from models import User, RefreshToken, PasswordResetToken
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_user_by_email,
    validate_email,
    get_current_user_jwt,
    create_db_refresh_token,
    hash_token,
    generate_secure_opaque_token,
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
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]

    class Config:
        from_attributes = True


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


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
    access_token = create_access_token(str(user.id), user.email)
    refresh_token = create_db_refresh_token(db, user.id)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    if not JWT_SECRET:
        raise HTTPException(status_code=503, detail="Auth not configured (JWT_SECRET missing)")
    email = data.email.strip().lower()
    user = get_user_by_email(db, email)
    
    print(f"LOGIN DEBUG: email='{email}', user_found={user is not None}")
    if user:
        verified = verify_password(data.password, user.password_hash)
        print(f"LOGIN DEBUG: password_verified={verified}, db_hash='{user.password_hash}', input_pass='{data.password}'")
        
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is disabled")
    access_token = create_access_token(str(user.id), user.email)
    refresh_token = create_db_refresh_token(db, user.id)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user_jwt)):
    return UserResponse(id=current_user.id, email=current_user.email, full_name=current_user.full_name)


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    from datetime import datetime
    hashed = hash_token(data.refresh_token)
    token_record = db.query(RefreshToken).filter(
        RefreshToken.token_hash == hashed,
        RefreshToken.revoked_at == None
    ).first()
    
    if not token_record:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
        
    if token_record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Refresh token expired")
        
    # Rotate refresh token: revoke current one
    token_record.revoked_at = datetime.utcnow()
    
    user = db.query(User).filter(User.id == token_record.user_id, User.is_active == True).first()
    if not user:
        db.commit()
        raise HTTPException(status_code=401, detail="User not found or inactive")
        
    new_access_token = create_access_token(str(user.id), user.email)
    new_refresh_token = create_db_refresh_token(db, user.id)
    
    db.commit()
    return TokenResponse(access_token=new_access_token, refresh_token=new_refresh_token)


@router.post("/logout")
def logout(data: LogoutRequest, db: Session = Depends(get_db)):
    from datetime import datetime
    hashed = hash_token(data.refresh_token)
    token_record = db.query(RefreshToken).filter(RefreshToken.token_hash == hashed).first()
    if token_record:
        token_record.revoked_at = datetime.utcnow()
        db.commit()
    return {"success": True, "message": "Logged out successfully"}


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    from datetime import datetime, timedelta
    email = data.email.strip().lower()
    user = get_user_by_email(db, email)
    if not user:
        # Avoid user enumeration: return success even if email doesn't exist
        return {"success": True, "message": "If the email exists, a password reset link has been printed to the server logs."}
        
    raw_token = generate_secure_opaque_token()
    token_hash = hash_token(raw_token)
    expires_at = datetime.utcnow() + timedelta(hours=1)
    
    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at
    )
    db.add(reset_record)
    db.commit()
    
    # Log reset link for local testing/dev
    reset_link = f"http://localhost:5173/reset-password?token={raw_token}"
    print("\n" + "="*80)
    print(f"PASSWORD RESET REQUESTED FOR: {user.email}")
    print(f"RESET LINK: {reset_link}")
    print("="*80 + "\n")
    
    return {"success": True, "message": "If the email exists, a password reset link has been printed to the server logs."}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    from datetime import datetime
    hashed = hash_token(data.token)
    reset_record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == hashed,
        PasswordResetToken.used_at == None
    ).first()
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        
    if reset_record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Reset token expired")
        
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        
    user = db.query(User).filter(User.id == reset_record.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Update password and mark token as used
    user.password_hash = hash_password(data.new_password)
    reset_record.used_at = datetime.utcnow()
    
    # Revoke all user refresh tokens for security
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked_at == None
    ).update({RefreshToken.revoked_at: datetime.utcnow()}, synchronize_session=False)
    
    db.commit()
    return {"success": True, "message": "Password has been reset successfully"}
