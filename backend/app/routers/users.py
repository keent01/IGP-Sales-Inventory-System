import os, re
import secrets
import string, random
from datetime import datetime, timedelta
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