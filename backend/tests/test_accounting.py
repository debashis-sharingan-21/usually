import pytest
import sqlite3
from app.services.accounting import calculate_spending_summary

def test_accounting_calculations():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript("""
        CREATE TABLE transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            import_batch_id TEXT,
            date TEXT NOT NULL,
            raw_description TEXT NOT NULL,
            clean_merchant TEXT NOT NULL,
            category TEXT NOT NULL,
            amount REAL NOT NULL,
            type TEXT NOT NULL,
            currency TEXT NOT NULL DEFAULT 'INR',
            fingerprint TEXT UNIQUE NOT NULL,
            is_user_modified INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
    """)

    sample_txs = [
        # Normal purchases
        ("2026-09-10", "Swiggy", "Swiggy", "Food & Dining", 400.0, "expense", "fp1"),
        ("2026-09-15", "Amazon", "Amazon", "Shopping", 1200.0, "expense", "fp2"),
        # Credit card transfer (must NOT be counted in consumer expenses)
        ("2026-09-05", "CRED Payment", "CRED Payment", "Transfers", 15000.0, "transfer", "fp3"),
        # Refund (reduces net expenses)
        ("2026-09-16", "Swiggy Refund", "Swiggy", "Refund", 400.0, "refund", "fp4"),
        # Salary Income
        ("2026-09-01", "Salary Tech Corp", "Salary", "Income", 80000.0, "income", "fp5"),
    ]

    cur = conn.cursor()
    for tx in sample_txs:
        cur.execute("""
            INSERT INTO transactions (date, raw_description, clean_merchant, category, amount, type, fingerprint, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, '2026-09-20')
        """, tx)
    conn.commit()

    summary = calculate_spending_summary(conn)

    # Total expenses should only be Swiggy (400) + Amazon (1200) = 1600.0 (CRED transfer excluded!)
    assert summary["total_expenses"] == 1600.0
    assert summary["total_income"] == 80000.0
    assert summary["total_refunds"] == 400.0
    assert summary["total_transfers"] == 15000.0
    # Net cash flow = 80000 - 1600 + 400 = 78800.0
    assert summary["net_cash_flow"] == 78800.0
    assert summary["transaction_count"] == 5

    # Check category breakdown
    categories = {c["category"]: c["total_amount"] for c in summary["category_breakdown"]}
    assert categories["Shopping"] == 1200.0
    assert categories["Food & Dining"] == 400.0
    assert "Transfers" not in categories
