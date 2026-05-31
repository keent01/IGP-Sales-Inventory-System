import re
import random
import string
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.schemas import ForgotPasswordRequest, ResetPasswordWithOtpRequest
from pydantic import BaseModel, EmailStr
from .. import models
from app.core import database

router = APIRouter(prefix="/api/auth", tags=["auth"])
# OAuth2 token endpoint used by the frontend login form
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

SECRET_KEY = "YOUR_SUPER_SECRET_KEY_HERE"  # Keep this safe; prefer env var in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def validate_password_complexity(password: str) -> None:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter.")
    if not re.search(r"[0-9]", password):
        raise ValueError("Password must contain at least one number.")
    if not re.search(r"[!@#$%^&*()_+\-=[\]{};':\\\",.<>/?|`~]", password):
        raise ValueError("Password must contain at least one special character.")


def get_current_user(db: Session = Depends(database.get_db), token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Expect the token subject to be the numeric user_id (stringified)
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise credentials_exception

    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(database.get_db)):
    from .users import send_otp_email
    
    user = db.query(models.User).filter(models.User.email == payload.email, models.User.is_deleted == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="No active account found with this email address.")
    
    # 1. Generate a secure 6-digit numerical OTP (This is the RAW one)
    raw_otp = "".join(random.choices(string.digits, k=6))
    
    # 2. Hash it BEFORE saving! (Notice no 'auth.' prefix here)
    user.reset_otp = get_password_hash(raw_otp)
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=15)
    db.commit()

    # 3. Send the RAW OTP via email
    email_sent, email_error = send_otp_email(user.email, raw_otp)
    if not email_sent:
        raise HTTPException(status_code=502, detail=f"Failed to dispatch OTP verification email: {email_error}")

    return {"status": "success", "message": "OTP verification code sent successfully!"}

# --- Step 2: Verify & Reset ---
@router.post("/reset-password-with-otp")
def reset_password_with_otp(payload: ResetPasswordWithOtpRequest, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email, models.User.is_deleted == False).first()
    if not user or not user.reset_otp or not user.otp_expiry:
        raise HTTPException(status_code=400, detail="Invalid request state. Please request a code first.")

    # Validate Expiration
    if datetime.utcnow() > user.otp_expiry:
        raise HTTPException(status_code=400, detail="The validation token has expired. Please try again.")

    # Check OTP Match Securely!
    if not verify_password(payload.otp, user.reset_otp):
        raise HTTPException(status_code=400, detail="The security code entered is incorrect.")

    # Apply Complexity Guardrails
    try:
        validate_password_complexity(payload.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Commit Changes & Clear OTP tracks
    user.password = get_password_hash(payload.new_password)
    user.force_password_change = False
    user.reset_otp = None
    user.otp_expiry = None
    db.commit()

    return {"status": "success", "message": "Password updated successfully! You can now log in."}