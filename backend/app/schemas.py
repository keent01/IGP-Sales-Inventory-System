from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

class UserBase(BaseModel):
    full_name: str
    email: EmailStr
    role: str

class UserCreate(UserBase):
    pass # No password field here!

class UserOut(UserBase):
    user_id: int
    is_deleted: bool = False
    force_password_change: bool = False

    class Config:
        from_attributes = True

class ChangePasswordRequest(BaseModel):
    new_password: str
    current_password: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ForgotPasswordConfirm(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

# Individual items within a sale
class SaleItemSchema(BaseModel):
    item_id: int
    quantity: int
    price: Decimal
    subtotal: Decimal

    class Config:
        from_attributes = True

# The main Sale record
class SaleSchema(BaseModel):
    sale_id: int
    user_id: int
    total_amount: Decimal
    sale_date: datetime
    or_number: str
    items: List[SaleItemSchema] = []

    class Config:
        from_attributes = True

class SaleItemCreate(BaseModel):
    item_id: int
    quantity: int

class SaleCreate(BaseModel):
    user_id: int
    or_number: str
    student_name: str
    student_program: str
    total_amount: float
    items: List[SaleItemCreate]

class ItemCreate(BaseModel):
    item_name: str
    category: str
    price: float
    stock_quantity: int
    low_stock_threshold: int = 10 
    size: str = "N/A"
    photo_path: Optional[str] = None


class AuditLogSchema(BaseModel):
    audit_id: int
    user_id: int
    action: str
    table_name: str
    record_id: int
    action_timestamp: datetime
    reason: Optional[str] = None

    class Config:
        from_attributes = True


class AuditLogWithUserSchema(AuditLogSchema):
    """Extended audit log schema including user information."""
    user_name: str


class AuditLogsResponseSchema(BaseModel):
    """Paginated audit logs response."""
    total: int
    page: int
    per_page: int
    total_pages: int
    logs: List[AuditLogSchema]


class SaleEditRequest(BaseModel):
    """Request schema for editing a sale transaction."""
    modification_reason: str

    class Config:
        from_attributes = True

# Add this to schemas.py
class SaleEditItem(BaseModel):
    item_id: int
    quantity: int

class SaleEditRequest(BaseModel):
    student_name: str
    program: str
    or_number: str
    sale_date: datetime
    modification_reason: str
    items: List[SaleEditItem]

class UserProfileUpdate(BaseModel):
    full_name: str