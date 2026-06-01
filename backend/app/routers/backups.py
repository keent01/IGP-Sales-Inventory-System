import os
import subprocess
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core import database
from app.routers import auth
from app.services import audit
from app import models
from app.services.backup import BACKUP_DIR
from datetime import datetime

router = APIRouter(prefix="/api/backups", tags=["backups"])

@router.get("/")
def list_backups(current_user: models.User = Depends(auth.get_current_user)):
    """List all available backups for the admin."""
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    backups = []
    if os.path.exists(BACKUP_DIR):
        for file in sorted(os.listdir(BACKUP_DIR), reverse=True):
            if file.endswith(".sql"):
                filepath = os.path.join(BACKUP_DIR, file)
                size_mb = os.path.getsize(filepath) / (1024 * 1024)
                backups.append({
                    "filename": file,
                    "date_created": datetime.fromtimestamp(os.path.getctime(filepath)),
                    "size_mb": round(size_mb, 2)
                })
    return backups

@router.post("/restore/{filename}")
def restore_backup(
    filename: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """SRS Requirement: Restore database from backup."""
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Backup file not found")

    db_user = os.getenv("DB_USER", "root")
    db_pass = os.getenv("DB_PASS", "")
    db_name = os.getenv("DB_NAME", "evsu_igp_db")

    env = os.environ.copy()
    env["MYSQL_PWD"] = db_pass

    try:
        # SRS Requirement: Restore Database
        cmd = ["mysql", "-u", db_user, db_name]
        with open(filepath, "r") as infile:
            subprocess.run(cmd, env=env, stdin=infile, check=True)
            
        # SRS Requirement: Log activity
        audit.log_action(db, current_user.user_id, "restore", "system", 0, f"Restored database from {filename}")
        db.commit()
        
        return {"message": "Database restored successfully. System is back online."}
        
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail="Restore failed. Please contact IT support.")