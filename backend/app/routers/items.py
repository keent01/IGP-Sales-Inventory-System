from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core import database
from .. import models
import os
import shutil
from uuid import uuid4
from .auth import get_current_user
from app.services import audit

UPLOAD_DIR = "assets/uploads/products"
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/api/items", tags=["items"])

@router.get("/")
def get_all_items(db: Session = Depends(database.get_db)):
    items = db.query(models.Item).filter(models.Item.is_deleted == False).all()
    return items

@router.get("/{item_id}")
def get_item_details(item_id: int, db: Session = Depends(database.get_db)):
    item = db.query(models.Item).filter(models.Item.item_id == item_id, models.Item.is_deleted == False).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.post("/")
async def add_new_item(
    item_name: str = Form(...),
    category: str = Form(...),
    price: float = Form(...),
    stock_quantity: int = Form(...),
    low_stock_threshold: int = Form(10),
    size: str = Form("N/A"),
    photo: UploadFile = File(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    file_url = None

    if photo:
        safe_filename = f"{uuid4().hex}_{photo.filename.replace(' ', '_')}"
        file_path = os.path.join(UPLOAD_DIR, safe_filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(photo.file, buffer)
        file_url = f"https://evsu-igp-backend.onrender.com/static/uploads/products/{safe_filename}"

    new_item = models.Item(
        item_name=item_name,
        category=category,
        price=price,
        stock_quantity=stock_quantity,
        low_stock_threshold=low_stock_threshold,
        size=size,
        item_photo=file_url,
        is_deleted=False
    )

    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    db.flush()

    audit.log_action(
        db=db,
        user_id=current_user.user_id,
        action="added",
        table_name="items",
        record_id=new_item.item_id,
        reason=f"Added new item: {item_name} (Initial Qty: {stock_quantity})"
    )

    
    return {"status": "success", "data": new_item}

@router.put("/{item_id}")
async def update_item(
    item_id: int,
    item_name: str = Form(...),
    category: str = Form(...),
    price: float = Form(...),
    stock_quantity: int = Form(...),
    low_stock_threshold: int = Form(10),
    size: str = Form("N/A"),
    photo: UploadFile = File(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    item = db.query(models.Item).filter(models.Item.item_id == item_id, models.Item.is_deleted == False).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item.item_name = item_name
    item.category = category
    item.price = price
    item.stock_quantity = stock_quantity
    item.low_stock_threshold = low_stock_threshold
    item.size = size

    if photo:
        safe_filename = f"{uuid4().hex}_{photo.filename.replace(' ', '_')}"
        file_path = os.path.join(UPLOAD_DIR, safe_filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(photo.file, buffer)
        item.item_photo = f"https://evsu-igp-backend.onrender.com/static/uploads/products/{safe_filename}"

    audit.log_action(
        db=db,
        user_id=current_user.user_id,
        action="edited",
        table_name="items",
        record_id=item_id,
        reason=f"Updated details for item: {item_name} (ID: {item_id})"
    )

    db.commit()
    db.refresh(item)
    return {"status": "success", "data": item}

@router.delete("/{item_id}")
def delete_item(
    item_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)):

    item = db.query(models.Item).filter(models.Item.item_id == item_id, models.Item.is_deleted == False).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item.is_deleted = True

    audit.log_action(
        db=db,
        user_id=current_user.user_id,
        action="deleted",
        table_name="items",
        record_id=item_id,
        reason=f"Archived item: {item.item_name} (ID: {item_id})"
    )

    db.commit()
    return {"status": "success", "message": "Item deleted"}