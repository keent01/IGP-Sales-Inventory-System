import mysql.connector
from datetime import datetime, timedelta
import random

# Database Configuration
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': '', # Add your password here
    'database': 'evsu_igp_db'
}

def seed_database():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        print("Connected to database.")

        # 1. FIX SCHEMA: Add customer_name to sales table if missing (needed for UI)
        cursor.execute("SHOW COLUMNS FROM sales LIKE 'customer_name'")
        if not cursor.fetchone():
            print("Adding missing 'customer_name' column to sales table...")
            cursor.execute("ALTER TABLE sales ADD COLUMN customer_name VARCHAR(255) AFTER or_number")

        # 2. CLEAR DATA (Optional - uncomment if you want a fresh start)
        # cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        # cursor.execute("TRUNCATE TABLE sale_items")
        # cursor.execute("TRUNCATE TABLE sales")
        # cursor.execute("SET FOREIGN_KEY_CHECKS = 1")

        # 3. PREPARE DATA
        programs = ["BSIT", "BSCE", "BSHRM", "BSED", "BSME", "BSHM"]
        students = ["John Doe", "Jane Smith", "Michael Ross", "Harvey Specter", "Donna Paulsen", "Rachel Zane", "Mike Wazowski", "James Sullivan"]
        statuses = ["PAID", "PENDING"]
        
        # Get existing items from your database
        cursor.execute("SELECT item_id, price, item_name FROM items WHERE is_deleted = 0")
        db_items = cursor.fetchall()
        
        if not db_items:
            print("No items found in database. Please run your SQL dump first.")
            return

        print(f"Seeding 23 transactions to match your UI summary...")

        # 4. GENERATE 23 TRANSACTIONS
        total_revenue = 0
        for i in range(1, 24):
            # To match your UI: first 17 are PAID, remaining 6 are PENDING
            status = "PAID" if i <= 17 else "PENDING"
            
            # Use today for majority of records to show in "Today's Summary"
            sale_date = datetime.now() - timedelta(minutes=random.randint(1, 480))
            
            student = random.choice(students)
            prog = random.choice(programs)
            cust_info = f"{student} ({prog})"
            or_val = f"1516{1350 + i}" # Example OR sequence
            
            # Insert Sale Record (Total set to 0 initially)
            cursor.execute("""
                INSERT INTO sales (user_id, total_amount, sale_date, or_number, customer_name, payment_status) 
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (1, 0, sale_date, or_val, cust_info, status))
            
            sale_id = cursor.lastrowid
            
            # Select 1-3 random items for this transaction
            transaction_items = random.sample(db_items, random.randint(1, 3))
            running_total = 0
            
            for item_id, price, name in transaction_items:
                qty = random.randint(1, 2)
                subtotal = float(price) * qty
                running_total += subtotal
                
                # Insert Sale Items
                cursor.execute("""
                    INSERT INTO sale_items (sale_id, item_id, quantity, price, subtotal) 
                    VALUES (%s, %s, %s, %s, %s)
                """, (sale_id, item_id, qty, price, subtotal))
            
            # Update the main sale record with the calculated total
            cursor.execute("UPDATE sales SET total_amount = %s WHERE sale_id = %s", (running_total, sale_id))
            total_revenue += running_total

        conn.commit()
        print("--------------------------------------------------")
        print(f"SUCCESS: Seeded 23 transactions.")
        print(f"Stats: 17 PAID, 6 PENDING.")
        print(f"Estimated Total Revenue: P{total_revenue:,.2f}")
        print("--------------------------------------------------")

    except mysql.connector.Error as err:
        print(f"Error: {err}")
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

if __name__ == "__main__":
    seed_database()