import pytest
import sqlite3
from app.services.csv_importer import execute_import
from app.services.habit_engine import detect_habits
from app.services.accounting import calculate_spending_summary

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
        CREATE TABLE habit_feedback (
            habit_key TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            notes TEXT,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE user_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
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

def test_successive_statement_imports_evolve_habits_and_pace():
    conn = get_test_db()
    mapping = {"date": "Date", "description": "Description", "amount": "Amount", "type": "Type"}

    # Month 1 statement: May 2026
    month1_csv = """Date,Description,Amount,Type
2026-05-06,Swiggy Lunch,400.00,DR
2026-05-13,Swiggy Dinner,450.00,DR
2026-05-20,Swiggy Meal,420.00,DR
2026-05-27,Swiggy Food,480.00,DR
2026-05-15,Amazon Books,1200.00,DR
2026-05-25,Uber Commute,320.00,DR
"""
    res1 = execute_import(conn, "batch_m1", "may_statement.csv", month1_csv, mapping)
    assert res1["accepted_rows"] == 6

    # With only 1 month of sparse data, multi-month habit requires >= 3 months
    habits_m1 = detect_habits(conn, reference_date="2026-05-31")
    assert not any(h["habit_type"] == "multi_month_recurrent" for h in habits_m1)

    # Month 2 statement: June 2026
    month2_csv = """Date,Description,Amount,Type
2026-06-03,Swiggy Lunch,410.00,DR
2026-06-10,Swiggy Dinner,460.00,DR
2026-06-17,Swiggy Meal,430.00,DR
2026-06-24,Swiggy Food,490.00,DR
2026-06-15,Amazon Cable,800.00,DR
2026-06-28,Uber Commute,350.00,DR
"""
    res2 = execute_import(conn, "batch_m2", "june_statement.csv", month2_csv, mapping)
    assert res2["accepted_rows"] == 6

    # Month 3 statement: July 2026 (including an overlapping row from June)
    month3_csv = """Date,Description,Amount,Type
2026-06-24,Swiggy Food,490.00,DR
2026-07-01,Swiggy Lunch,420.00,DR
2026-07-08,Swiggy Dinner,470.00,DR
2026-07-15,Swiggy Meal,440.00,DR
2026-07-22,Swiggy Food,500.00,DR
2026-07-15,Amazon Household,2100.00,DR
"""
    res3 = execute_import(conn, "batch_m3", "july_statement.csv", month3_csv, mapping)
    # The duplicate row from June 24 is recognized and skipped
    assert res3["duplicate_rows"] == 1
    assert res3["accepted_rows"] == 5

    # Now with 3 full months of data, multi-month habit triggers for Amazon and Swiggy!
    habits_m3 = detect_habits(conn, reference_date="2026-07-31")
    multi_month_habits = [h for h in habits_m3 if h["habit_type"] == "multi_month_recurrent"]
    assert len(multi_month_habits) >= 2
    merchants = {h["merchant"] for h in multi_month_habits}
    assert "Swiggy" in merchants
    assert "Amazon" in merchants
