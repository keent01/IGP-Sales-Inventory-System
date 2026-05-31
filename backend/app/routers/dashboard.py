from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
import zoneinfo
from app.core import database
from .. import models  # Adjust based on your folder structure

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

PH_TZ = zoneinfo.ZoneInfo("Asia/Manila")

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(database.get_db)):
    # FORCE "today" to be the current date in the Philippines
    today = datetime.now(PH_TZ).date()
    
    # ... the rest of your queries remain exactly the same ...
    today_sales = db.query(func.sum(models.Sale.total_amount))\
        .filter(models.Sale.sale_date >= today, models.Sale.is_deleted == 0).scalar() or 0
        
    total_transactions = db.query(models.Sale)\
        .filter(models.Sale.sale_date >= today, models.Sale.is_deleted == 0).count()
        
    low_stock = db.query(models.Item)\
        .filter(models.Item.stock_quantity <= models.Item.low_stock_threshold, models.Item.is_deleted == 0).count()
        
    items_sold_today = db.query(func.sum(models.SaleItem.quantity))\
        .join(models.Sale)\
        .filter(models.Sale.sale_date >= today, models.Sale.is_deleted == 0).scalar() or 0

    return {
        "todaySales": float(today_sales),
        "totalItemsSold": int(items_sold_today),
        "lowStock": low_stock,
        "transactions": total_transactions
    }

@router.get("/recent-sales")
def get_recent_sales(db: Session = Depends(database.get_db)):
    # Limit to 5 for "Recent" view
    return db.query(models.Sale)\
        .filter(models.Sale.is_deleted == 0)\
        .order_by(models.Sale.sale_date.desc())\
        .limit(5).all()

@router.get("/inventory-summary")
def get_inventory_summary(db: Session = Depends(database.get_db)):
    # Filter: Only items where stock_quantity <= low_stock_threshold
    items = db.query(models.Item).filter(
        models.Item.stock_quantity <= models.Item.low_stock_threshold,
        models.Item.is_deleted == 0
    ).all()
    
    summary = []
    for item in items:
        # Define Status
        if item.stock_quantity <= 0:
            status, color = "Out of Stock", "red"
            percentage = 0
        else:
            status, color = "Low Stock", "amber"
            # Calculate percentage based on the threshold (e.g., if threshold is 10 and stock is 5, it's 50%)
            percentage = (item.stock_quantity / item.low_stock_threshold) * 100

        summary.append({
            "name": item.item_name,
            "quantity": item.stock_quantity,
            "status": status,
            "color": color,
            "percentage": min(percentage, 100)
        })
    return summary