import os
from dotenv import load_dotenv # Add this
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Add this line to tell Python to read the .env file
load_dotenv() 

database_url = os.getenv("SQLALCHEMY_DATABASE_URL")

# Diagnostic check: This will tell us if the URL is still missing
if not database_url:
    raise ValueError("SQLALCHEMY_DATABASE_URL not found in environment variables. Check your .env file!")

engine = create_engine(database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()