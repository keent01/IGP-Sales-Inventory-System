from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text, func
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.core import database
from .. import models

router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.get("/analytics")
def get_detailed_reports(
    start_date: str = None, 
    end_date: str = None, 
    db: Session = Depends(database.get_db)
):
    """Generate dynamic financial analytics for given parameters or fallback gracefully."""
    
    # "All Time" fallback filter structure configuration
    if not start_date or not end_date:
        start_date_obj = datetime.strptime("1970-01-01", "%Y-%m-%d").date()
        end_date_obj = datetime.strptime("2099-12-31", "%Y-%m-%d").date()
    else:
        try:
            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format structure. Expected YYYY-MM-DD.")

    params = {
        "start": start_date_obj.strftime("%Y-%m-%d"), 
        "end": end_date_obj.strftime("%Y-%m-%d")
    }

    summary_query = text("""
        SELECT 
            SUM(si.subtotal) as gross_revenue,
            SUM(si.quantity) as items_sold,
            (SELECT i2.item_name FROM sale_items si2 
             JOIN items i2 ON si2.item_id = i2.item_id
             JOIN sales s2 ON si2.sale_id = s2.sale_id
             WHERE s2.is_deleted = 0 AND DATE(s2.sale_date) BETWEEN :start AND :end
             GROUP BY i2.item_id, i2.item_name
             ORDER BY SUM(si2.quantity) DESC LIMIT 1) as most_sold
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.sale_id
        WHERE s.is_deleted = 0 AND DATE(s.sale_date) BETWEEN :start AND :end
    """)

    distribution_query = text("""
        SELECT 
            i.category as category, 
            SUM(si.subtotal) as value
        FROM sale_items si
        JOIN items i ON si.item_id = i.item_id
        JOIN sales s ON si.sale_id = s.sale_id
        WHERE s.is_deleted = 0 AND DATE(s.sale_date) BETWEEN :start AND :end
        GROUP BY i.category
    """)

    daily_query = text("""
        SELECT 
            DATE(s.sale_date) as day,
            COUNT(DISTINCT s.sale_id) as orders,
            SUM(si.quantity) as items_sold,
            SUM(si.subtotal) as daily_total
        FROM sales s
        LEFT JOIN sale_items si ON s.sale_id = si.sale_id
        WHERE s.is_deleted = 0 AND DATE(s.sale_date) BETWEEN :start AND :end
        GROUP BY DATE(s.sale_date)
        ORDER BY DATE(s.sale_date) ASC
    """)

    top_products_query = text("""
        SELECT 
            i.item_name,
            i.category,
            SUM(si.quantity) as quantity,
            SUM(si.subtotal) as revenue
        FROM sale_items si
        JOIN items i ON si.item_id = i.item_id
        JOIN sales s ON si.sale_id = s.sale_id
        WHERE s.is_deleted = 0 AND DATE(s.sale_date) BETWEEN :start AND :end
        GROUP BY i.item_id, i.item_name, i.category
        ORDER BY quantity DESC
        LIMIT 10
    """)

    summary = db.execute(summary_query, params).mappings().first()
    distribution = db.execute(distribution_query, params).mappings().all()
    daily = db.execute(daily_query, params).mappings().all()
    top_products = db.execute(top_products_query, params).mappings().all()

    return {
        "gross_revenue": float(summary['gross_revenue'] or 0),
        "items_sold": int(summary['items_sold'] or 0),
        "most_sold_item": summary['most_sold'] or "N/A",
        "distribution": {d['category']: float(d['value']) for d in distribution},
        "daily_breakdown": [
            {
                "date": str(day['day']),
                "orders": int(day['orders']),
                "items_sold": int(day['items_sold'] or 0),
                "revenue": float(day['daily_total'] or 0)
            }
            for day in daily
        ],
        "top_products": [
            {
                "item_name": p['item_name'],
                "category": p['category'],
                "quantity": int(p['quantity']),
                "revenue": float(p['revenue'])
            }
            for p in top_products
        ]
    }