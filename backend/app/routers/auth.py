import re
import random
import string
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.schemas import ForgotPasswordRequest, ForgotPasswordConfirm 
from pydantic import BaseModel, EmailStr
from .. import models
from app.core import database
from app.core.database import get_db

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

@router.post("/forgot-password-request")
def forgot_password_request(
    payload: ForgotPasswordRequest, 
    db: Session = Depends(get_db)
):
    # 1. Verify the user exists in the system
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account registered with this email address.")
    
    if user.is_deleted:
        raise HTTPException(status_code=400, detail="This user account is currently inactive.")

    # 2. Generate a secure 6-digit numeric OTP
    generated_otp = "".join(random.choices(string.digits, k=6))
    
    # 3. Save the OTP and set the expiration time (e.g., 15 minutes from now)
    user.reset_otp = generated_otp
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=15)
    
    db.add(user)
    db.commit()

    # 4. Return data back to frontend so EmailJS can intercept it
    return {
        "status": "success",
        "full_name": user.full_name,
        "otp": generated_otp
    }

@router.post("/forgot-password-confirm")
def forgot_password_confirm(
    payload: ForgotPasswordConfirm, 
    db: Session = Depends(get_db)
):
    # 1. Locate the user
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User accounts out of sync.")

    # 2. Validate that the OTP matches
    if not user.reset_otp or user.reset_otp != payload.otp:
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    # 3. Verify the OTP has not expired
    if user.otp_expiry and datetime.utcnow() > user.otp_expiry:
        # If expired, wipe it clean so they can't keep guessing
        user.reset_otp = None
        user.otp_expiry = None
        db.commit()
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    # 4. Run complexity check against your auth engine
    try:
        validate_password_complexity(payload.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 5. Hash new password, wipe out the OTP tokens, and reset forced change flag
    user.password = get_password_hash(payload.new_password)
    user.reset_otp = None
    user.otp_expiry = None
    user.force_password_change = 0 
    
    db.add(user)
    db.commit()

    return {"status": "success", "message": "Password recovered successfully!"}
