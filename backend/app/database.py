import sqlite3
from app.config import DB_PATH

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_connection()
    with conn:
        conn.executescript("""
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
        """)
    conn.close()
