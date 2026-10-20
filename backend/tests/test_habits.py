import pytest
import sqlite3
from app.services.habit_engine import detect_habits
from app.services.demo_data import load_realistic_demo_dataset

def get_empty_db():
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
    """)
    return conn

def test_no_habits_on_sparse_history():
    conn = get_empty_db()
    cur = conn.cursor()
    # Insert only 2 transactions
    cur.execute("INSERT INTO transactions (date, raw_description, clean_merchant, category, amount, type, fingerprint, created_at) VALUES ('2026-10-01', 'Swiggy', 'Swiggy', 'Food & Dining', 200, 'expense', 'f1', '2026-10-01')")
    cur.execute("INSERT INTO transactions (date, raw_description, clean_merchant, category, amount, type, fingerprint, created_at) VALUES ('2026-10-02', 'Swiggy', 'Swiggy', 'Food & Dining', 200, 'expense', 'f2', '2026-10-02')")
    conn.commit()

    # Engine must not manufacture a habit from 2 transactions
    habits = detect_habits(conn)
    assert len(habits) == 0

def test_habits_detected_with_demo_dataset():
    conn = get_empty_db()
    load_realistic_demo_dataset(conn)

    # Reference date is Wednesday 2026-10-14 or 2026-10-20
    habits = detect_habits(conn, reference_date="2026-10-20")
    assert len(habits) >= 3

    habit_types = {h["habit_type"] for h in habits}
    assert "weekday_cadence" in habit_types
    assert "multi_month_recurrent" in habit_types
    assert "weekend_surge" in habit_types

    # Find Swiggy Wednesday habit
    swiggy_habit = next(h for h in habits if h["habit_key"] == "weekday_swiggy_wednesday")
    assert swiggy_habit["merchant"] == "Swiggy"
    assert swiggy_habit["evidence"]["target_weekday"] == "Wednesday"
    assert swiggy_habit["evidence"]["matching_days_count"] == 4
    assert swiggy_habit["evidence"]["total_target_days"] == 5
    assert swiggy_habit["confidence"] == 0.8

    # Find Amazon multi-month habit
    amazon_habit = next(h for h in habits if h["habit_key"] == "multimonth_amazon")
    assert amazon_habit["merchant"] == "Amazon"
    assert amazon_habit["evidence"]["active_months"] == 5
    assert amazon_habit["evidence"]["total_months"] == 6

def test_habit_muting_suppresses_notification():
    conn = get_empty_db()
    load_realistic_demo_dataset(conn)

    # Verify habit appears before muting
    habits = detect_habits(conn, reference_date="2026-10-20")
    assert any(h["habit_key"] == "weekday_swiggy_wednesday" for h in habits)

    # Mute the habit
    cur = conn.cursor()
    cur.execute("INSERT INTO habit_feedback (habit_key, status, updated_at) VALUES ('weekday_swiggy_wednesday', 'muted', '2026-10-20')")
    conn.commit()

    # Now verify it is suppressed
    habits_after = detect_habits(conn, reference_date="2026-10-20")
    assert not any(h["habit_key"] == "weekday_swiggy_wednesday" for h in habits_after)
