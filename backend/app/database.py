import sqlite3
import os
from typing import Optional
from app.config import DATA_DIR

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS import_batches (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    imported_at TEXT NOT NULL,
    total_rows INTEGER NOT NULL,
    accepted_rows INTEGER NOT NULL,
    duplicate_rows INTEGER NOT NULL,
    rejected_rows INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
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
    created_at TEXT NOT NULL,
    FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_tx_merchant ON transactions(clean_merchant);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);

CREATE TABLE IF NOT EXISTS habit_feedback (
    habit_key TEXT PRIMARY KEY,
    status TEXT NOT NULL, -- 'confirmed', 'muted', 'active'
    notes TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Persistent learning: stores user classifications for payees
CREATE TABLE IF NOT EXISTS learned_payees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payee_key TEXT UNIQUE NOT NULL, -- lowercase normalized payee name
    clean_name TEXT NOT NULL,
    category TEXT NOT NULL,
    transaction_type TEXT NOT NULL DEFAULT 'expense', -- 'expense', 'transfer', 'income', 'p2p'
    notes TEXT,
    user_classified INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_learned_payee_key ON learned_payees(payee_key);

-- Contextual one-tap questions for ambiguous or recurring unclassified payees
CREATE TABLE IF NOT EXISTS payee_questions (
    id TEXT PRIMARY KEY,
    payee_key TEXT NOT NULL,
    payee_name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    options_json TEXT NOT NULL,
    transaction_count INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'answered', 'dismissed'
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_status ON payee_questions(status);
"""

_ACTIVE_CONTEXT: str = "personal"

def get_db_path(context: str = "personal") -> str:
    custom_personal = os.environ.get("USUALLY_DB_PATH")
    if context == "demo":
        custom_demo = os.environ.get("USUALLY_DEMO_DB_PATH")
        if custom_demo:
            return custom_demo
        if custom_personal:
            if custom_personal.endswith(".db"):
                return custom_personal[:-3] + "_demo.db"
            return custom_personal + "_demo"
        return str(DATA_DIR / "usually_demo.db")
    return custom_personal if custom_personal else str(DATA_DIR / "usually.db")

def get_active_context() -> str:
    global _ACTIVE_CONTEXT
    personal_path = get_db_path("personal")
    try:
        if os.path.exists(personal_path):
            conn = sqlite3.connect(personal_path)
            cur = conn.cursor()
            cur.execute("SELECT value FROM user_settings WHERE key = 'active_context'")
            row = cur.fetchone()
            conn.close()
            if row and row[0] in ("personal", "demo"):
                _ACTIVE_CONTEXT = row[0]
    except Exception:
        pass
    return _ACTIVE_CONTEXT

def set_active_context(context: str):
    global _ACTIVE_CONTEXT
    if context not in ("personal", "demo"):
        raise ValueError(f"Invalid context '{context}', must be 'personal' or 'demo'")
    _ACTIVE_CONTEXT = context
    personal_path = get_db_path("personal")
    try:
        conn = sqlite3.connect(personal_path)
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)
            """)
            conn.execute("""
                INSERT INTO user_settings (key, value)
                VALUES ('active_context', ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """, (context,))
        conn.close()
    except Exception:
        pass

def get_connection(context: Optional[str] = None) -> sqlite3.Connection:
    ctx = context if context is not None else get_active_context()
    path = get_db_path(ctx)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db(context: Optional[str] = None):
    contexts = [context] if context else ["personal", "demo"]
    for ctx in contexts:
        path = get_db_path(ctx)
        conn = sqlite3.connect(path)
        with conn:
            conn.executescript(SCHEMA_SQL)
        conn.close()
