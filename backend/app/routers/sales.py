from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from app.core import database
from .. import models, schemas
from datetime import datetime
from ..core.database import get_db
from .auth import get_current_user
from ..services import audit

router = APIRouter(prefix="/api", tags=["sales"])

@router.get("/sales", response_model=list[schemas.SaleSchema])
def get_sales(db: Session = Depends(get_db)):
    sales = db.query(models.Sale).all()
    if not sales:
        raise HTTPException(status_code=404, detail="No sales records found")
    return sales

@router.get("/sales-history")
def get_all_sales_history(
    search: str = None,
    program: str = None,
    category: str = None,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(database.get_db)
):
    conditions = ["s.is_deleted = 0"]
    params = {}

    if search:
        conditions.append("(s.or_number LIKE :search OR s.student_name LIKE :search)")
        params["search"] = f"%{search}%"
    if program:
        conditions.append("s.student_program LIKE :program")
        params["program"] = f"%{program}%"
    if category:
        conditions.append("i.category = :category")
        params["category"] = category
    if start_date and end_date:
        conditions.append("s.sale_date BETWEEN :start_date AND :end_date")
        params["start_date"] = start_date
        params["end_date"] = end_date

    # FIX: Added si.price and si.item_id to the GROUP_CONCAT
    query = text(f"""
        SELECT 
            s.sale_date, 
            s.or_number, 
            s.student_name, 
            s.student_program,
            s.total_amount, 
            s.sale_id,
            GROUP_CONCAT(i.item_name SEPARATOR '||') as names,
            GROUP_CONCAT(IFNULL(i.size, 'N/A') SEPARATOR '||') as sizes,
            GROUP_CONCAT(si.quantity SEPARATOR '||') as qtys,
            GROUP_CONCAT(si.price SEPARATOR '||') as prices,
            GROUP_CONCAT(si.item_id SEPARATOR '||') as ids
        FROM sales s
        JOIN sale_items si ON s.sale_id = si.sale_id
        JOIN items i ON si.item_id = i.item_id
        WHERE {' AND '.join(conditions)}
        GROUP BY s.sale_id
        ORDER BY s.sale_date DESC
    """)
    
    results = db.execute(query, params).fetchall()
    history = []

    for row in results:
        names = row.names.split('||')
        sizes = row.sizes.split('||')
        qtys = row.qtys.split('||')
        prices = row.prices.split('||')
        ids = row.ids.split('||')
        
        items_list = []
        for i in range(len(names)):
            items_list.append({
                "item_id": int(ids[i]),
                "item_name": names[i],
                "size": sizes[i],
                "quantity": int(qtys[i]),
                "price": float(prices[i]) # This fixes the toLocaleString error
            })

        history.append({
            "date": row.sale_date.strftime("%Y-%m-%d %H:%M:%S"),
            "or_number": row.or_number,
            "student_name": row.student_name,
            "program": row.student_program,
            "items_list": items_list,
            "total": float(row.total_amount),
            "sale_id": row.sale_id
        })
        
    return history

@router.get("/history-summary")
def get_history_summary(
    search: str = None, 
    program: str = None, 
    category: str = None, 
    start_date: str = None, 
    end_date: str = None, 
    db: Session = Depends(database.get_db)
):
    # Base Query
    query = db.query(models.Sale).join(models.SaleItem).join(models.Item).filter(models.Sale.is_deleted == 0)

    # Apply Filters
    if search:
        query = query.filter(models.Sale.or_number.ilike(f"%{search}%") | models.Sale.student_name.ilike(f"%{search}%"))
    if program:
        query = query.filter(models.Sale.student_program.ilike(f"%{program}%"))
    if category:
        query = query.filter(models.Item.category == category)
    if start_date and end_date:
        query = query.filter(models.Sale.sale_date.between(start_date, end_date))

    sales = query.distinct().all()

    # Calculate Totals
    total_revenue = sum(s.total_amount for s in sales)
    total_items = db.query(func.sum(models.SaleItem.quantity)).filter(models.SaleItem.sale_id.in_([s.sale_id for s in sales])).scalar() or 0
    
    # Get Most Sold Item Name
    most_sold = db.query(models.Item.item_name, func.sum(models.SaleItem.quantity).label('total'))\
        .join(models.SaleItem).filter(models.SaleItem.sale_id.in_([s.sale_id for s in sales]))\
        .group_by(models.Item.item_id).order_by(text('total DESC')).first()

    return {
        "totalSales": float(total_revenue),
        "totalItemsSold": int(total_items),
        "mostSoldItem": most_sold[0] if most_sold else "N/A"
    }


@router.delete("/sales/void/{sale_id}")
def void_sale(sale_id: int, db: Session = Depends(database.get_db)):
    # Soft-delete the sale and restock items
    sale = db.query(models.Sale).filter(models.Sale.sale_id == sale_id, models.Sale.is_deleted == 0).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    # Fetch sale items
    sale_items = db.query(models.SaleItem).filter(models.SaleItem.sale_id == sale_id).all()
    for si in sale_items:
        item = db.query(models.Item).filter(models.Item.item_id == si.item_id).first()
        if item:
            item.stock_quantity = (item.stock_quantity or 0) + (si.quantity or 0)

    sale.is_deleted = 1
    db.commit()
    return {"status": "success", "message": "Sale voided and items restocked"}

@router.post("/sales", status_code=status.HTTP_201_CREATED)
def create_sale(
    payload: schemas.SaleCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)):

    try:
        # Create the Master Sale Record (assign current authenticated user)
        new_sale = models.Sale(
            user_id=current_user.user_id,
            or_number=payload.or_number,
            student_name=payload.student_name,
            student_program=payload.student_program,
            total_amount=payload.total_amount,
            #removable
            #sale_date=datetime.now(),
            #is_deleted=False
        )
        db.add(new_sale)
        db.flush()  # This gets us the new_sale.sale_id without committing yet

        # 2. Process Cart Items
        for item_in_cart in payload.items:
            # Fetch item from DB to check current stock
            db_item = db.query(models.Item).filter(models.Item.item_id == item_in_cart.item_id).first()

            if not db_item:
                raise HTTPException(status_code=404, detail=f"Item ID {item_in_cart.item_id} not found")

            if db_item.stock_quantity < item_in_cart.quantity:
                db.rollback() # Cancel everything
                raise HTTPException(status_code=400, detail=f"Not enough stock for {db_item.item_name}")

            # Create Sale Detail entry
            sale_item = models.SaleItem(
                sale_id=new_sale.sale_id,
                item_id=item_in_cart.item_id,
                quantity=item_in_cart.quantity,
                price=db_item.price,
                subtotal=db_item.price * item_in_cart.quantity
            )
            
            # 3. Deduct Inventory (The "CRUD" update)
            db_item.stock_quantity -= item_in_cart.quantity
            
            db.add(sale_item)

        # 4. Finalize
        db.commit()
        return {"status": "success", "message": "Order created successfully", "sale_id": new_sale.sale_id}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sales/create", status_code=status.HTTP_201_CREATED)
def create_sale_v2(payload: schemas.SaleCreate, db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)):
    # Accepts same payload but will enforce current_user.user_id
    # Ensure payload.user_id is ignored in favor of authenticated user
    return create_sale(payload, db, current_user)

@router.put("/sales/{sale_id}", status_code=status.HTTP_200_OK)
def edit_sale(
    sale_id: int,
    edit_request: schemas.SaleEditRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Edit a completed sales transaction and adjust stock."""
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    sale = db.query(models.Sale).filter(models.Sale.sale_id == sale_id, models.Sale.is_deleted == 0).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    # 1. Return old quantities to stock
    old_items = db.query(models.SaleItem).filter(models.SaleItem.sale_id == sale_id).all()
    for oi in old_items:
        item = db.query(models.Item).filter(models.Item.item_id == oi.item_id).first()
        if item:
            item.stock_quantity = (item.stock_quantity or 0) + oi.quantity

    # 2. Update Master Sale Info
    sale.student_name = edit_request.student_name
    sale.student_program = edit_request.program
    sale.or_number = edit_request.or_number
    sale.modification_reason = edit_request.modification_reason
    sale.last_modified_by = current_user.user_id
    sale.last_modified_at = datetime.utcnow()

    # 3. Process Updated Items
    db.query(models.SaleItem).filter(models.SaleItem.sale_id == sale_id).delete()
    
    new_total = 0
    for req_item in edit_request.items:
        db_item = db.query(models.Item).filter(models.Item.item_id == req_item.item_id).first()
        if not db_item:
            db.rollback()
            raise HTTPException(status_code=404, detail=f"Item {req_item.item_id} not found")
        
        # Deduct new stock
        db_item.stock_quantity -= req_item.quantity
        subtotal = db_item.price * req_item.quantity
        new_total += subtotal
        
        db.add(models.SaleItem(
            sale_id=sale_id,
            item_id=req_item.item_id,
            quantity=req_item.quantity,
            price=db_item.price,
            subtotal=subtotal
        ))

    sale.total_amount = new_total
    
    audit.log_action(db, current_user.user_id, "edited", "sales", sale_id, edit_request.modification_reason)
    
    db.commit()
    return {"status": "success", "message": "Sale updated and stock adjusted"}

@router.delete("/sales/{sale_id}", status_code=status.HTTP_200_OK)
def delete_sale(
    sale_id: int, 
    reason: str, # <-- 1. Accept the required reason from the frontend
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Delete/void a completed sales transaction (Admin only)."""
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    sale = db.query(models.Sale).filter(
        models.Sale.sale_id == sale_id,
        models.Sale.is_deleted == 0
    ).first()
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    # 2. Return quantities to stock
    sale_items = db.query(models.SaleItem).filter(models.SaleItem.sale_id == sale_id).all()
    for sale_item in sale_items:
        item = db.query(models.Item).filter(models.Item.item_id == sale_item.item_id).first()
        if item:
            item.stock_quantity = (item.stock_quantity or 0) + sale_item.quantity
            db.add(item)
    
    # 3. Soft delete and record the reason on the sale itself
    sale.is_deleted = 1
    sale.modification_reason = reason 
    db.add(sale)
    
    # 4. Use the custom reason in the Audit Log
    audit.log_action(
        db=db,
        user_id=current_user.user_id,
        action="deleted",
        table_name="sales",
        record_id=sale_id,
        reason=reason # <-- No longer hardcoded
    )
    
    db.commit()
    return {"status": "success", "message": "Sale voided successfully"}
