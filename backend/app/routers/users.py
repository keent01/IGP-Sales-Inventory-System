import os, re
import secrets
import smtplib
import string
from email.message import EmailMessage
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from .. import models, schemas
from app.routers import auth
from ..services import audit 

router = APIRouter(prefix="/api/users", tags=["users"])

def generate_otp(length=12):
    characters = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"
    return ''.join(secrets.choice(characters) for i in range(length))


def send_otp_email(recipient: str, otp_password: str) -> tuple[bool, str]:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    smtp_from = os.getenv("SMTP_FROM") or smtp_user

    if not smtp_host or not smtp_user or not smtp_pass:
        return False, "SMTP_HOST, SMTP_USER, and SMTP_PASS must be configured to send email."

    print(f"SMTP config: host={smtp_host!r}, port={smtp_port}, user={smtp_user!r}, from={smtp_from!r}")
    msg = EmailMessage()
    msg["Subject"] = "EVSU-OC IGP Temporary Password"
    msg["From"] = smtp_from
    msg["To"] = recipient
    msg.set_content(
        f"Hello {recipient},\n\n"
        f"Your EVSU-OC IGP temporary password is: {otp_password}\n\n"
        "Use this one-time password to sign in, then change your password immediately.\n\n"
        "Thanks,\nEVSU-OC IGP Team"
    )

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as smtp:
            smtp.starttls()
            smtp.login(smtp_user, smtp_pass)
            smtp.send_message(msg)
        return True, "Email sent"
    except Exception as error:
        print("OTP email delivery failed:", error)
        return False, str(error)


def validate_evsu_email(email: str) -> None:
    if not email.lower().endswith("@evsu.edu.ph"):
        raise HTTPException(status_code=400, detail="Email must end with @evsu.edu.ph")


@router.post("/register")
def create_user(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    validate_evsu_email(user_in.email)

    if db.query(models.User).filter(models.User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    # 1. Generate the random password
    otp_password = generate_otp()
 
    hashed_password = auth.get_password_hash(otp_password)

    new_user = models.User(
        full_name=user_in.full_name,
        email=user_in.email,
        password=hashed_password,
        role=user_in.role,
        is_deleted=False,
        force_password_change=True
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 3. Return the plain password directly back to the frontend
    return {
        "message": "User created successfully",
        "email_sent": False,
        "temporary_password": otp_password
    }

@router.post("/change-password")
def change_password(
    payload: schemas.ChangePasswordRequest, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # --- NEW: Password Complexity Check ---
    pwd = payload.new_password
    try:
        auth.validate_password_complexity(payload.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # --------------------------------------

    # 1. Check if the user is forced to change their password
    is_first_login = current_user.force_password_change

    # 2. If it is NOT their first login, strictly require the current password
    if not is_first_login:
        if not payload.current_password:
            raise HTTPException(status_code=400, detail="Current password is required.")
        
        # Verify the current password matches the database
        if not auth.verify_password(payload.current_password, current_user.password):
            raise HTTPException(status_code=400, detail="Incorrect current password.")

    # 3. Hash and save the new password
    current_user.password = auth.get_password_hash(payload.new_password)
    
    # 4. Turn off the forced change flag
    current_user.force_password_change = 0
    
    db.add(current_user)
    db.commit()
    
    return {"status": "success", "message": "Password updated successfully!"}

@router.get("/", response_model=list[schemas.UserOut])
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(models.User).filter(models.User.is_deleted == False).all()
    
    return [
        {
            "user_id": user.user_id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "is_deleted": user.is_deleted,
            "force_password_change": user.force_password_change
        }
        for user in users
    ]

@router.put("/me")
def update_my_profile(
    payload: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    current_user.full_name = payload.full_name
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    
    return {"message": "Profile updated successfully", "full_name": current_user.full_name}

@router.put("/{user_id}")
def update_user(
    user_id: int, 
    payload: schemas.UserCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    user = db.query(models.User).filter(models.User.user_id == user_id, models.User.is_deleted == 0).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    changes = []
    if user.full_name != payload.full_name: changes.append("name")
    if user.role != payload.role: changes.append("role")
    
    user.full_name = payload.full_name
    user.role = payload.role
    db.add(user)
    
    if changes:
        audit.log_action(db, current_user.user_id, "edited", "users", user_id, f"Updated user {', '.join(changes)}")
        
    db.commit()
    return {"message": "User updated successfully"}


@router.delete("/{user_id}")
def delete_user(
    user_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    if current_user.user_id == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
        
    user = db.query(models.User).filter(models.User.user_id == user_id, models.User.is_deleted == 0).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_deleted = 1
    db.add(user)
    
    audit.log_action(db, current_user.user_id, "deleted", "users", user_id, f"Deactivated user account for {user.email}")
    
    db.commit()
    return {"message": "User deactivated successfully"}

@router.post("/{user_id}/reset-password")
def admin_reset_password(
    user_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    user = db.query(models.User).filter(models.User.user_id == user_id, models.User.is_deleted == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Generate random password and hash it
    new_password = generate_otp()
    user.password = auth.get_password_hash(new_password)
    user.force_password_change = True # Forces them to change it on next login
    
    db.add(user)
    
    # Log the action
    audit.log_action(db, current_user.user_id, "reset_password", "users", user_id, f"Admin reset password for {user.email}")
    
    db.commit()
    
    return {
        "message": "Password reset successfully", 
        "temporary_password": new_password
    }