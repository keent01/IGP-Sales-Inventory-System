import os
import re
import random
import string
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.schemas import ForgotPasswordRequest, ForgotPasswordConfirm
from .. import models
from app.core import database
from app.core.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

# ---------------------------------------------------------------------------
# Config — prefer environment variables in production
# ---------------------------------------------------------------------------
SECRET_KEY                  = os.getenv("SECRET_KEY", "YOUR_SUPER_SECRET_KEY_HERE")
ALGORITHM                   = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
OTP_EXPIRE_MINUTES          = 15

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def validate_password_complexity(password: str) -> None:
    """
    Raises ValueError if the password does not meet complexity requirements.
    Rules are mirrored on the frontend (forgot-password.js → validatePasswordComplexity).
    """
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter.")
    if not re.search(r"[0-9]", password):
        raise ValueError("Password must contain at least one number.")
    if not re.search(r"[!@#$%^&*()\-_=+\[\]{};':\"\\|,.<>/?`~]", password):
        raise ValueError("Password must contain at least one special character.")


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire    = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    db:    Session = Depends(database.get_db),
    token: str     = Depends(oauth2_scheme),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub     = payload.get("sub")
        if sub is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise credentials_exception

    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if user is None:
        raise credentials_exception

    return user


# ---------------------------------------------------------------------------
# Forgot-password routes
# ---------------------------------------------------------------------------

@router.post("/forgot-password-request")
def forgot_password_request(
    payload: ForgotPasswordRequest,
    db:      Session = Depends(get_db),
):
    """
    Step 1 — Verify the account exists, generate a 6-digit OTP, persist it,
    then return it to the frontend so EmailJS can deliver it to the user.

    NOTE: Returning the OTP in the response is an intentional trade-off
    required by the client-side EmailJS integration. Treat the endpoint as
    internal / admin-only and ensure it is rate-limited in production.
    """
    # 1. Locate the account
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account registered with this email address.",
        )

    if user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This user account is currently inactive.",
        )

    # 2. Generate a secure 6-digit numeric OTP
    generated_otp = "".join(random.choices(string.digits, k=6))

    # 3. Persist the OTP and its expiry window
    user.reset_otp  = generated_otp
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)
    db.add(user)
    db.commit()

    # 4. Return data to the frontend for EmailJS dispatch
    return {
        "status":    "success",
        "full_name": user.full_name,
        "otp":       generated_otp,
    }


@router.post("/forgot-password-confirm")
def forgot_password_confirm(
    payload: ForgotPasswordConfirm,
    db:      Session = Depends(get_db),
):
    """
    Step 2 — Validate the OTP and update the user's password.
    All checks (existence, OTP match, expiry, complexity) are enforced
    server-side regardless of what the frontend already validated.
    """
    # 1. Locate the account
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found.",
        )

    # 2. OTP match check
    if not user.reset_otp or user.reset_otp != payload.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code.",
        )

    # 3. OTP expiry check — wipe the token so it cannot be brute-forced
    if user.otp_expiry and datetime.utcnow() > user.otp_expiry:
        user.reset_otp  = None
        user.otp_expiry = None
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new one.",
        )

    # 4. Password complexity check
    try:
        validate_password_complexity(payload.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    # 5. Commit the new password and clear the OTP tokens
    user.password             = get_password_hash(payload.new_password)
    user.reset_otp            = None
    user.otp_expiry           = None
    user.force_password_change = 0

    db.add(user)
    db.commit()

    return {"status": "success", "message": "Password recovered successfully!"}