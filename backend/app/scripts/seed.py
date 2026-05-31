from sqlalchemy.orm import Session
from .database import SessionLocal, engine
from . import models
from datetime import datetime
from decimal import Decimal
from .auth import get_password_hash

def seed_db():
    db: Session = SessionLocal()
    
    # 1. Seed Users (Including a test Staff account)
    # Note: In a real app, use passlib.hash to hash these passwords
    admin_user = models.User(
        full_name="System Admin",
        email="admin@evsu.edu.ph",
        password=get_password_hash("admin123"), # Hashed!
        role="Admin"
    )
    staff_user = models.User(
        full_name="Sample Staff",
        email="staff@evsu.edu.ph",
        password=get_password_hash("hashed_staff_password"),
        role="Staff"
    )
    db.add_all([admin_user, staff_user])
    db.commit()
    db.refresh(admin_user)
    db.refresh(staff_user)

    # 2. Seed Inventory (Items)
    items_to_add = [
        models.Item(
            item_name="EVSU Men’s Polo", category="Uniforms", size="M", 
            price=Decimal("450.00"), stock_quantity=50, low_stock_threshold=10
        ),
        models.Item(
            item_name="EVSU Women’s Blouse", category="Uniforms", size="L", 
            price=Decimal("420.00"), stock_quantity=8, low_stock_threshold=10
        ),
        models.Item(
            item_name="EVSU Official Necktie", category="Neckties", size="N/A", 
            price=Decimal("150.00"), stock_quantity=0, low_stock_threshold=5
        ),
        models.Item(
            item_name="Physical Education Shirt", category="Uniforms", size="XL", 
            price=Decimal("350.00"), stock_quantity=25, low_stock_threshold=10
        ),
        models.Item(
            item_name="College Patch (Logo)", category="Accessories", size="N/A", 
            price=Decimal("35.00"), stock_quantity=100, low_stock_threshold=20
        ),
        models.Item(
            item_name="Lanyard (EVSU-OC)", category="Accessories", size="N/A", 
            price=Decimal("85.00"), stock_quantity=12, low_stock_threshold=15
        )
    ]
    db.add_all(items_to_add)
    db.commit()

    # 3. Seed a Sample Sale
    # We fetch the first item to create a valid transaction
    sample_item = db.query(models.Item).first()
    
    new_sale = models.Sale(
        user_id=staff_user.user_id,
        total_amount=Decimal("450.00"),
        or_number="OR-2026-0001",
        payment_status="Paid",
        payment_date=datetime.utcnow()
    )
    db.add(new_sale)
    db.commit()
    db.refresh(new_sale)

    # 4. Seed Sale Items (linking the sale to the item)
    sale_detail = models.SaleItem(
        sale_id=new_sale.sale_id,
        item_id=sample_item.item_id,
        quantity=1,
        price=sample_item.price,
        subtotal=sample_item.price
    )
    db.add(sale_detail)
    
    # 5. Seed Audit Log for initial setup
    setup_log = models.AuditLog(
        user_id=admin_user.user_id,
        action="System Initialized",
        table_name="Multiple",
        record_id=0,
        reason="Initial database seeding for testing"
    )
    db.add(setup_log)

    db.commit()
    db.close()
    print("Database seeded successfully!")

if __name__ == "__main__":
    seed_db()