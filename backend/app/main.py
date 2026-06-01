import os
from pathlib import Path
from datetime import date, datetime, timedelta
from pydantic import BaseModel, EmailStr
from fastapi import FastAPI, Depends, HTTPException, status, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, inspect, text
from sqlalchemy.orm import Session
from app.core import database
from . import models, schemas
from .schemas import SaleSchema
from app.core import database
from app.core.database import get_db, engine, Base
from jose import JWTError, jwt
from app.routers import dashboard, items, sales, reports, users, audit, auth, backups
from app.routers.auth import get_current_user
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from app.services.backup import perform_automated_backup

# Define the lifespan manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # START SCHEDULER ON BOOT
    scheduler = BackgroundScheduler()
    # SRS Requirement: Run at exactly 12:00 AM every day

    scheduler.add_job(perform_automated_backup, 'cron', hour=0, minute=0)
    scheduler.start()
    
    yield 
    scheduler.shutdown()

app = FastAPI(title="EVSU-OC IGP API", lifespan=lifespan)
app.mount("/static", StaticFiles(directory="assets"), name="static")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")
LOCKOUT_THRESHOLD = 5
LOCKOUT_PERIOD_MINUTES = 15

app.include_router(sales.router)
app.include_router(reports.router)
app.include_router(dashboard.router)
app.include_router(items.router)
app.include_router(users.router)
app.include_router(audit.router)
app.include_router(auth.router)
app.include_router(backups.router)

# Enable CORS so your HTML file can talk to this API
origins = [
    "https://igp-sales-inventory-system-production.up.railway.app",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

def load_dotenv_file():
    env_path = Path(__file__).resolve().parents[1] / '.env'
    if not env_path.exists():
        return
    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#'):
            continue
        key, sep, value = line.partition('=')
        if sep and key and value and key.strip() not in os.environ:
            cleaned_value = value.split('#', 1)[0].strip()
            os.environ[key.strip()] = cleaned_value


load_dotenv_file()

# Initialize tables
models.Base.metadata.create_all(bind=database.engine)

@app.get("/")
def root():
    return {"message": "EVSU-IGP Backend API is running successfully!"}

# Ensure any legacy database has the required users column
inspector = inspect(database.engine)
if 'users' in inspector.get_table_names():
    columns = [column['name'] for column in inspector.get_columns('users')]
    if 'force_password_change' not in columns:
        with database.engine.connect() as conn:
            conn.execute(text('ALTER TABLE users ADD COLUMN force_password_change TINYINT(1) DEFAULT 0'))
            conn.commit()
    if 'failed_login_attempts' not in columns:
        with database.engine.connect() as conn:
            conn.execute(text('ALTER TABLE users ADD COLUMN failed_login_attempts INT DEFAULT 0'))
            conn.commit()
    if 'locked_until' not in columns:
        with database.engine.connect() as conn:
            conn.execute(text('ALTER TABLE users ADD COLUMN locked_until DATETIME NULL'))
            conn.commit()


def reset_failed_attempts(db: Session, user: models.User):
    if user.failed_login_attempts != 0 or user.locked_until is not None:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.add(user)
        db.commit()
        db.refresh(user)


def increment_failed_attempt(db: Session, user: models.User):
    user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
    if user.failed_login_attempts >= LOCKOUT_THRESHOLD:
        user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_PERIOD_MINUTES)
    db.add(user)
    db.commit()
    db.refresh(user)


def authenticate_user(db: Session, email: str, password: str):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        return None, "invalid_credentials"
    if user.locked_until and datetime.utcnow() < user.locked_until:
        return user, "locked"
    if not auth.verify_password(password, user.password):
        increment_failed_attempt(db, user)
        return None, "invalid_credentials"
    reset_failed_attempts(db, user)
    return user, "success"

# Login / token route used by the frontend (OAuth2 password flow)
@app.post("/api/token")
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user, status_code = authenticate_user(db, form_data.username, form_data.password)
    if status_code == "locked":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account locked due to multiple failed login attempts. Please try again after 15 minutes.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Username or Password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = auth.create_access_token(data={"sub": str(user.user_id)})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "force_password_change": user.force_password_change,
    }

@app.get("/api/users/me")
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return {
        "user_id": current_user.user_id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role,
        "is_deleted": current_user.is_deleted,
    }


@app.post("/login")
def login(login_data: LoginRequest, db: Session = Depends(database.get_db)):
    user, status_code = authenticate_user(db, login_data.email, login_data.password)
    if status_code == "locked":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account locked due to multiple failed login attempts. Please try again after 15 minutes.",
        )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Username or Password",
        )

    return {
        "full_name": user.full_name,
        "role": user.role,
        "status": "success",
        "force_password_change": user.force_password_change,
    }

@app.get("/api/sale_items")
def get_sale_items(db: Session = Depends(database.get_db)):
    return db.query(models.SaleItem).all()

