import pytest
import sqlite3
from app.services.accounting import calculate_spending_summary
from app.database import migrate_db
from app.services.learning_engine import answer_payee_question

def get_test_conn():
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
            direction TEXT NOT NULL DEFAULT 'debit',
            type TEXT NOT NULL,
            currency TEXT NOT NULL DEFAULT 'INR',
            fingerprint TEXT UNIQUE NOT NULL,
            is_user_modified INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            ref_id TEXT
        );
        CREATE TABLE learned_payees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            payee_key TEXT UNIQUE NOT NULL,
            clean_name TEXT NOT NULL,
            category TEXT NOT NULL,
            transaction_type TEXT NOT NULL DEFAULT 'expense',
            notes TEXT,
            user_classified INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE payee_questions (
            id TEXT PRIMARY KEY,
            payee_key TEXT NOT NULL,
            payee_name TEXT NOT NULL,
            prompt TEXT NOT NULL,
            options_json TEXT NOT NULL,
            transaction_count INTEGER NOT NULL,
            total_amount REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
    """)
    return conn

def test_accounting_calculations():
    conn = get_test_conn()

    sample_txs = [
        # Normal purchases (debit, expense)
        ("2026-09-10", "Swiggy", "Swiggy", "Food & Dining", 400.0, "debit", "expense", "fp1"),
        ("2026-09-15", "Amazon", "Amazon", "Shopping", 1200.0, "debit", "expense", "fp2"),
        # Credit card transfer out (debit, transfer - must NOT be in consumer expenses)
        ("2026-09-05", "CRED Payment", "CRED Payment", "Transfers", 15000.0, "debit", "transfer", "fp3"),
        # P2P Outgoing (debit, p2p)
        ("2026-09-12", "Paid to Friend", "Friend", "Personal & Peer", 3000.0, "debit", "p2p", "fp4"),
        # Refund (credit, refund)
        ("2026-09-16", "Swiggy Refund", "Swiggy", "Refund", 400.0, "credit", "refund", "fp5"),
        # Salary Income (credit, income)
        ("2026-09-01", "Salary Tech Corp", "Salary", "Income", 80000.0, "credit", "income", "fp6"),
        # P2P Incoming (credit, p2p)
        ("2026-09-20", "Received from Relative", "Relative", "Personal & Peer", 5000.0, "credit", "p2p", "fp7"),
        # Transfer in (credit, transfer)
        ("2026-09-22", "Transfer from Savings", "Savings Account", "Transfers", 10000.0, "credit", "transfer", "fp8"),
    ]

    cur = conn.cursor()
    for tx in sample_txs:
        cur.execute("""
            INSERT INTO transactions (date, raw_description, clean_merchant, category, amount, direction, type, fingerprint, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026-09-20')
        """, tx)
    conn.commit()

    summary = calculate_spending_summary(conn)

    # 1. Component checks
    assert summary["total_expenses"] == 1600.0  # Swiggy (400) + Amazon (1200)
    assert summary["total_transfers"] == 15000.0
    assert summary["total_transfers_in"] == 10000.0
    assert summary["total_p2p_outgoing"] == 3000.0
    assert summary["total_p2p_incoming"] == 5000.0
    assert summary["total_income"] == 80000.0
    assert summary["total_refunds"] == 400.0

    # 2. Invariant: Gross Debits = Living Expenses + Transfers Out + P2P Out
    expected_gross_debit = 1600.0 + 15000.0 + 3000.0  # 19600.0
    assert summary["gross_debit_outflow"] == expected_gross_debit

    # 3. Invariant: Gross Credits = Income + P2P In + Refunds + Transfers In
    expected_gross_credit = 80000.0 + 5000.0 + 400.0 + 10000.0  # 95400.0
    assert summary["gross_credit_inflow"] == expected_gross_credit

    # 4. Invariant: Net Account Balance Delta = Gross Credit Inflow - Gross Debit Outflow
    assert summary["net_balance_change"] == round(expected_gross_credit - expected_gross_debit, 2)
    assert summary["net_balance_change"] == 75800.0

    # 5. Invariant: Consumer Margin = External Inflows (Income + P2P In + Refunds) - Living Expenses
    # (excludes non-consumer internal account transfers of 15000 out and 10000 in)
    expected_consumer_margin = (80000.0 + 5000.0 + 400.0) - 1600.0  # 83800.0
    assert summary["consumer_margin"] == expected_consumer_margin
    assert summary["net_cash_flow"] == expected_consumer_margin

    # 6. Transaction count is exact
    assert summary["transaction_count"] == 8

def test_credits_never_become_expenses_via_payee_learning():
    """
    Ensures that answering a payee question (even with 'Not sure yet' or 'expense')
    never flips or overrides credit transactions to 'expense'.
    """
    conn = get_test_conn()
    cur = conn.cursor()

    # Insert a credit transaction (e.g. Received from a contact)
    cur.execute("""
        INSERT INTO transactions (date, raw_description, clean_merchant, category, amount, direction, type, fingerprint, created_at)
        VALUES ('2024-08-15', 'Received from Contact A', 'Contact A', 'General', 2000.0, 'credit', 'p2p', 'fp_cred', '2024-08-15')
    """)
    # Insert a debit transaction for same contact
    cur.execute("""
        INSERT INTO transactions (date, raw_description, clean_merchant, category, amount, direction, type, fingerprint, created_at)
        VALUES ('2024-08-16', 'Paid to Contact A', 'Contact A', 'General', 500.0, 'debit', 'expense', 'fp_deb', '2024-08-16')
    """)

    # Create a payee question for Contact A
    cur.execute("""
        INSERT INTO payee_questions (id, payee_key, payee_name, prompt, options_json, transaction_count, total_amount, status, created_at, updated_at)
        VALUES ('q_contact_a', 'contact a', 'Contact A', 'Who is this?', '[{"id": "not_sure", "label": "Not sure yet", "category": "General", "transaction_type": "expense"}]', 2, 2500.0, 'pending', '2024-08-16', '2024-08-16')
    """)
    conn.commit()

    # User selects 'not_sure' which has transaction_type = 'expense'
    answer_payee_question(conn, 'q_contact_a', 'not_sure')

    # Debit should update to expense
    deb_row = conn.execute("SELECT direction, type FROM transactions WHERE fingerprint = 'fp_deb'").fetchone()
    assert deb_row["direction"] == "debit"
    assert deb_row["type"] == "expense"

    # Credit MUST NOT become expense! It must remain p2p
    cred_row = conn.execute("SELECT direction, type FROM transactions WHERE fingerprint = 'fp_cred'").fetchone()
    assert cred_row["direction"] == "credit"
    assert cred_row["type"] != "expense"
    assert cred_row["type"] in ("p2p", "income", "refund", "transfer")

