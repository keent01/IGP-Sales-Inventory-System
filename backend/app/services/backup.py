import os
import time
import subprocess
from datetime import datetime, timedelta
from email.message import EmailMessage
import smtplib
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.services import audit
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Use a separate drive or cloud mount path here (SRS Requirement: Separate Location)
BACKUP_DIR = os.getenv("BACKUP_DIR", "./database_backups")
os.makedirs(BACKUP_DIR, exist_ok=True)

import os
import subprocess
import smtplib
from email.message import EmailMessage
from datetime import datetime
from dotenv import load_dotenv

BACKUP_DIR = "database_backups" 

def send_backup_failure_email(error_details: str):
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    smtp_from = os.getenv("SMTP_FROM") or smtp_user

    admin_email = os.getenv("ADMIN_EMAIL", smtp_user) 
    
    if not all([smtp_host, smtp_user, smtp_pass]):
        print("⚠️ SMTP credentials missing. Cannot send failure email.")
        return

    try:
        msg = EmailMessage()
        msg.set_content(
            f"Hello Admin,\n\n"
            f"The automated database backup for your system FAILED at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}.\n\n"
            f"Error Details:\n{error_details}\n\n"
            f"Please check the server immediately to ensure data safety."
        )
        msg["Subject"] = "🚨 URGENT: Database Backup Failed"
        msg["From"] = smtp_from
        msg["To"] = admin_email

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        print("📧 Backup failure alert email sent successfully.")
    except Exception as e:
        print(f"⚠️ Failed to send the alert email: {str(e)}")


def perform_automated_backup():
    print("⏳ Starting automated backup process...")
    
    load_dotenv()
    os.makedirs(BACKUP_DIR, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filepath = os.path.join(BACKUP_DIR, f"backup_{timestamp}.sql")
    
    db_user = os.getenv("DB_USER", "root")
    db_pass = os.getenv("DB_PASS", "")
    db_name = os.getenv("DB_NAME", "evsu_igp_db") # Make sure this is your actual DB name!

    # Path to mysqldump
    mysqldump_cmd = r"C:\xampp\mysql\bin\mysqldump.exe"

    cmd = [mysqldump_cmd, "-u", db_user, db_name]
    
    env = os.environ.copy()
    if db_pass:
        env["MYSQL_PWD"] = db_pass

    try:
        with open(filepath, "w") as outfile:
            subprocess.run(cmd, env=env, stdout=outfile, check=True)
        print(f"✅ Backup successfully created at: {filepath}")
        
    except FileNotFoundError:
        error_msg = "Windows cannot find 'mysqldump'. Is it in your PATH?"
        print(f"❌ ERROR: {error_msg}")
        send_backup_failure_email(error_msg)
        
    except subprocess.CalledProcessError as e:
        error_msg = f"mysqldump failed with error code {e.returncode}. Is the DB running?"
        print(f"❌ ERROR: {error_msg}")
        if os.path.exists(filepath):
            os.remove(filepath)
        send_backup_failure_email(error_msg)
        
    except Exception as e:
        error_msg = f"An unexpected error occurred: {str(e)}"
        print(f"❌ ERROR: {error_msg}")
        send_backup_failure_email(error_msg)

def cleanup_old_backups():
    """SRS Requirement: Keep backups for at least 30 days"""
    now = time.time()
    cutoff = now - (30 * 86400) # 30 days in seconds

    for filename in os.listdir(BACKUP_DIR):
        filepath = os.path.join(BACKUP_DIR, filename)
        if os.path.isfile(filepath):
            file_modified = os.stat(filepath).st_mtime
            if file_modified < cutoff:
                os.remove(filepath)

