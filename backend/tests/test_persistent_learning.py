import pytest
import sqlite3
from app.services.csv_importer import execute_import
from app.services.learning_engine import (
    generate_payee_questions_for_batch,
    get_pending_questions,
    answer_payee_question,
    dismiss_payee_question,
    list_learned_payees
)

def get_test_db():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript("""
        CREATE TABLE import_batches (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            imported_at TEXT NOT NULL,
            total_rows INTEGER NOT NULL,
            accepted_rows INTEGER NOT NULL,
            duplicate_rows INTEGER NOT NULL,
            rejected_rows INTEGER NOT NULL
        );
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

def test_payee_question_generation_and_one_tap_learning():
    conn = get_test_db()

    csv_data = """Date,Description,Amount
2026-10-01,Paid to Ramu,1500.00
2026-10-05,Paid to Ramu,450.00
2026-10-10,Paid to Ramu,1200.00
2026-10-12,Swiggy Lunch,350.00
"""
    mapping = {"date": "Date", "description": "Description", "amount": "Amount"}
    import_res = execute_import(conn, "b1", "statement1.csv", csv_data, mapping)
    assert import_res["accepted_rows"] == 4

    questions = get_pending_questions(conn)
    assert len(questions) >= 1
    ramu_q = next((q for q in questions if "ramu" in q["payee_key"]), None)
    assert ramu_q is not None
    assert ramu_q["transaction_count"] == 3
    assert ramu_q["total_amount"] == 3150.0
    assert "Ramu" in ramu_q["prompt"]

    ans_res = answer_payee_question(
        conn=conn,
        question_id=ramu_q["id"],
        selected_option_id="friend_family"
    )
    assert ans_res["status"] == "success"
    assert ans_res["category"] == "Personal & Peer"
    assert ans_res["transaction_type"] == "p2p"

    cur = conn.cursor()
    cur.execute("SELECT category, type FROM transactions WHERE clean_merchant = 'Ramu'")
    rows = cur.fetchall()
    assert len(rows) == 3
    for r in rows:
        assert r[0] == "Personal & Peer"
        assert r[1] == "p2p"

    learned = list_learned_payees(conn)
    assert len(learned) == 1
    assert learned[0]["payee_key"] == "ramu"
    assert learned[0]["category"] == "Personal & Peer"

    pending_after = get_pending_questions(conn)
    assert len(pending_after) == 0

    csv_data_2 = """Date,Description,Amount
2026-10-18,Paid to Ramu,600.00
"""
    import_res_2 = execute_import(conn, "b2", "statement2.csv", csv_data_2, mapping)
    assert import_res_2["accepted_rows"] == 1

    cur.execute("SELECT category, type FROM transactions WHERE date = '2026-10-18' AND clean_merchant = 'Ramu'")
    new_row = cur.fetchone()
    assert new_row is not None
    assert new_row[0] == "Personal & Peer"
    assert new_row[1] == "p2p"

def test_dismiss_question_does_not_block():
    conn = get_test_db()
    csv_data = """Date,Description,Amount
2026-10-01,Paid to Unknown Contact,1500.00
2026-10-02,Paid to Unknown Contact,1500.00
"""
    mapping = {"date": "Date", "description": "Description", "amount": "Amount"}
    execute_import(conn, "b1", "statement.csv", csv_data, mapping)

    questions = get_pending_questions(conn)
    assert len(questions) == 1
    q_id = questions[0]["id"]

    dismiss_res = dismiss_payee_question(conn, q_id)
    assert dismiss_res["status"] == "dismissed"
    assert len(get_pending_questions(conn)) == 0
