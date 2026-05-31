import zoneinfo
from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from .core.database import Base

PH_TZ = zoneinfo.ZoneInfo("Asia/Manila")

def get_ph_time():
    return datetime.now(PH_TZ)

class User(Base):
    __tablename__ = "users"
    
    user_id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    is_deleted = Column(Boolean, default=False)
    force_password_change = Column(Boolean, default=False)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    reset_otp =  Column(String(255), nullable=True)
    otp_expiry = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Item(Base):
    __tablename__ = "items"
    
    item_id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)
    size = Column(Enum('N/A', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'), default='N/A')
    price = Column(Numeric(10, 2), nullable=False)
    stock_quantity = Column(Integer, nullable=False)
    low_stock_threshold = Column(Integer, default=10)
    item_photo = Column(String(255), nullable=True)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Sale(Base):
    __tablename__ = "sales"
    
    sale_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    student_name = Column(String(100), nullable=True)  
    student_program = Column(String(100), nullable=True)  
    total_amount = Column(Numeric(10, 2), nullable=False)
    sale_date = Column(DateTime, default=get_ph_time)
    or_number = Column(String(50), unique=True, nullable=False)
    
    last_modified_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    last_modified_at = Column(DateTime, nullable=True)
    modification_reason = Column(Text, nullable=True)
    is_deleted = Column(Boolean, default=False)

    items = relationship("SaleItem", back_populates="sale")

class SaleItem(Base):
    __tablename__ = "sale_items"
    
    sale_item_id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.sale_id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.item_id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(Numeric(10, 2), nullable=False) 
    subtotal = Column(Numeric(10, 2), nullable=False)

    sale = relationship("Sale", back_populates="items")
    item = relationship("Item")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    audit_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    action = Column(String(50), nullable=False)
    table_name = Column(String(50), nullable=False)
    record_id = Column(Integer, nullable=False)
    reason = Column(Text, nullable=True)
    action_timestamp = Column(DateTime, default=datetime.utcnow)