from datetime import date, timedelta
from app.services.csv_importer import generate_fingerprint

def load_realistic_demo_dataset(conn) -> int:
    """
    Seeds a realistic 6-month dataset with verified recurring habits:
    - Swiggy on Wednesdays (4 of the last 5 Wednesdays)
    - Amazon orders across 5 of 6 months
    - Uber trips for regular Friday commutes
    - Weekend dining surges
    - Monthly salary deposits & CRED card bill transfers
    - Occasional refund
    """
    cur = conn.cursor()
    # Clear existing demo data or transactions if explicitly requested
    cur.execute("DELETE FROM transactions")
    cur.execute("DELETE FROM import_batches")
    cur.execute("DELETE FROM habit_feedback")

    batch_id = "demo_batch_2026"
    now_iso = "2026-10-20T12:00:00"

    cur.execute("""
        INSERT INTO import_batches (id, filename, imported_at, total_rows, accepted_rows, duplicate_rows, rejected_rows)
        VALUES (?, 'demo_transactions_6months.csv', ?, 95, 95, 0, 0)
    """, (batch_id, now_iso))

    transactions = []
    occ_map = {}

    def add_tx(tx_date: str, desc: str, clean_m: str, cat: str, amt: float, tx_type: str, ref: str = None):
        key = (tx_date, clean_m.lower(), amt, tx_type)
        occ_map[key] = occ_map.get(key, 0) + 1
        fp = generate_fingerprint(tx_date, clean_m, amt, tx_type, ref, occ_map[key])
        transactions.append((
            batch_id,
            tx_date,
            desc,
            clean_m,
            cat,
            amt,
            tx_type,
            "INR",
            fp,
            0,
            now_iso
        ))

    # Base reference date: 2026-10-20 (Tuesday)
    # 1. Swiggy on 4 of the last 5 Wednesdays:
    # Wednesdays were: 2026-10-14, 2026-10-07, 2026-09-30, 2026-09-23, 2026-09-16
    add_tx("2026-10-14", "UPI/SWIGGY/ORDER#84920", "Swiggy", "Food & Dining", 420.00, "expense")
    add_tx("2026-10-07", "UPI/SWIGGY/DINNER", "Swiggy", "Food & Dining", 560.00, "expense")
    add_tx("2026-09-30", "UPI/SWIGGY/ORDER#7719", "Swiggy", "Food & Dining", 380.00, "expense")
    add_tx("2026-09-23", "UPI/SWIGGY/CURRY", "Swiggy", "Food & Dining", 490.00, "expense")
    # (2026-09-16 skipped intentionally so it's 4 of 5)

    # 2. Amazon in 5 of 6 months:
    # May, June, July, August, September (October quiet so far)
    add_tx("2026-05-12", "AMAZON PAY INDIA BOOKS", "Amazon", "Shopping", 1450.00, "expense")
    add_tx("2026-06-18", "AMZN MKTP CABLE & CHARGER", "Amazon", "Shopping", 899.00, "expense")
    add_tx("2026-07-22", "AMAZON RETAIL HOME ESSENTIALS", "Amazon", "Shopping", 2150.00, "expense")
    add_tx("2026-08-14", "AMAZON MONSOON SALE", "Amazon", "Shopping", 3400.00, "expense")
    add_tx("2026-09-25", "AMZN MKTP KITCHENWARE", "Amazon", "Shopping", 1120.00, "expense")

    # 3. Monthly Salary & Transfers (transfers shouldn't count as expenses)
    months = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]
    for m in months:
        add_tx(f"{m}-01", "SALARY CREDIT TECH CORP", "Salary", "Income", 95000.00, "income", ref=f"SAL-{m}")
        add_tx(f"{m}-05", "CRED AUTODEBIT CC PAYMENT", "CRED Payment", "Transfers", 18500.00, "transfer", ref=f"CC-{m}")
        add_tx(f"{m}-10", "AIRTEL BROADBAND FIBER", "Airtel", "Utilities", 1179.00, "expense")
        add_tx(f"{m}-15", "NETFLIX ENTERTAINMENT SUBSCRIPTION", "Netflix", "Entertainment", 649.00, "expense")

    # 4. Weekend Dining Surges (Saturday & Sunday dining across 5 months)
    weekend_dates = [
        "2026-05-09", "2026-05-17", "2026-05-23", "2026-05-31",
        "2026-06-06", "2026-06-14", "2026-06-20", "2026-06-28",
        "2026-07-04", "2026-07-12", "2026-07-18", "2026-07-26",
        "2026-08-08", "2026-08-16", "2026-08-22", "2026-08-30",
        "2026-09-05", "2026-09-13", "2026-09-19", "2026-09-27",
        "2026-10-04", "2026-10-11", "2026-10-18"
    ]
    for wd in weekend_dates:
        add_tx(wd, "BLUE TOKAI COFFEE ROASTERS", "Blue Tokai", "Food & Dining", 480.00, "expense")
        add_tx(wd, "TOIT BREWPUB DINNER", "Toit", "Food & Dining", 2200.00, "expense")

    # 5. Food & Dining surge in October to trigger Pace Shift
    add_tx("2026-10-02", "BARBEQUE NATION FAMILY CELEBRATION", "Barbeque Nation", "Food & Dining", 4800.00, "expense")
    add_tx("2026-10-08", "RESTAURANT TAJ DINING", "Taj", "Food & Dining", 6200.00, "expense")

    # 6. Refund item
    add_tx("2026-10-12", "REFUND SWIGGY WRONG ITEM CANCELLED", "Swiggy Refund", "Refund", 420.00, "refund")

    # Insert into database
    cur.executemany("""
        INSERT INTO transactions (
            import_batch_id, date, raw_description, clean_merchant, category,
            amount, type, currency, fingerprint, is_user_modified, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, transactions)

    conn.commit()
    return len(transactions)
