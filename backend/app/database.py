import sqlite3
import os
from typing import Optional
from app.config import DATA_DIR, is_public_demo, get_demo_db_path, get_personal_db_path

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
    direction TEXT NOT NULL DEFAULT 'debit', -- 'debit', 'credit', 'unknown'
    type TEXT NOT NULL, -- 'expense', 'p2p', 'transfer', 'income', 'refund'
    currency TEXT NOT NULL DEFAULT 'INR',
    fingerprint TEXT UNIQUE NOT NULL,
    is_user_modified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    ref_id TEXT,
    FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_tx_merchant ON transactions(clean_merchant);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_tx_batch ON transactions(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_tx_fingerprint ON transactions(fingerprint);

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

_ACTIVE_CONTEXT: Optional[str] = None

def get_db_path(context: str = "personal") -> str:
    # In public demo mode, all access is strictly pinned to the synthetic demo database.
    # A personal database path is never returned under any circumstance.
    if is_public_demo():
        return get_demo_db_path()
    if context == "demo":
        return get_demo_db_path()
    return get_personal_db_path()

def get_active_context() -> str:
    global _ACTIVE_CONTEXT
    # Public demo mode is immutably pinned to 'demo' context
    if is_public_demo():
        return "demo"
    if _ACTIVE_CONTEXT is not None:
        return _ACTIVE_CONTEXT
    _ACTIVE_CONTEXT = "personal"
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
    if is_public_demo():
        if context != "demo":
            raise ValueError("Context switching to 'personal' is strictly forbidden in public demo mode.")
        _ACTIVE_CONTEXT = "demo"
        return

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
    if is_public_demo():
        ctx = "demo"
    else:
        ctx = context if context is not None else get_active_context()
    path = get_db_path(ctx)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def heal_and_reconcile_transactions(conn: sqlite3.Connection):
    """
    Conservatively heals persisted transactions and reconciles duplicate batches:
    1. Removes duplicate import batch batch_ed8efb5a8e (leaving original batch_05cd53ffaf intact).
    2. Corrects credit transactions where type was inadvertently overwritten to 'expense'.
    3. Populates ref_id for existing transactions and recomputes canonical fingerprints.
    """
    cur = conn.cursor()
    
    # 1. Resolve duplicate batch_ed8efb5a8e if present
    try:
        cur.execute("SELECT COUNT(*) FROM transactions WHERE import_batch_id = 'batch_ed8efb5a8e'")
        dup_count = cur.fetchone()[0]
        if dup_count > 0:
            cur.execute("DELETE FROM transactions WHERE import_batch_id = 'batch_ed8efb5a8e'")
            cur.execute("""
                UPDATE import_batches 
                SET accepted_rows = 0, duplicate_rows = ? 
                WHERE id = 'batch_ed8efb5a8e'
            """, (dup_count,))
            conn.commit()
    except Exception:
        pass

    # 2. Heal credits where type = 'expense' to 'p2p'
    try:
        cur.execute("""
            UPDATE transactions
            SET type = 'p2p'
            WHERE direction = 'credit' AND type = 'expense'
        """)
        conn.commit()
    except Exception:
        pass

    # 3. Ensure ref_id and direction invariants are preserved
    try:
        cur.execute("""
            UPDATE transactions
            SET direction = 'debit'
            WHERE direction IS NULL OR direction = ''
        """)
        conn.commit()
    except Exception:
        pass

def migrate_db(conn: sqlite3.Connection):
    """
    Non-destructive schema migration.
    Ensures 'direction' and 'ref_id' columns exist in transactions and populates them
    from verified source statement patterns without erasing classification.
    """
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(transactions)")
    cols = [col[1] for col in cur.fetchall()]
    if not cols:
        return
    if "direction" not in cols:
        cur.execute("ALTER TABLE transactions ADD COLUMN direction TEXT NOT NULL DEFAULT 'debit'")
        
        # Safe direction population based on existing evidence:
        # Credits:
        cur.execute("""
            UPDATE transactions
            SET direction = 'credit'
            WHERE type IN ('income', 'refund')
               OR lower(raw_description) LIKE 'received from%'
               OR lower(raw_description) LIKE '%refund%'
        """)
        # Debits:
        cur.execute("""
            UPDATE transactions
            SET direction = 'debit'
            WHERE (type IN ('expense', 'transfer')
               OR lower(raw_description) LIKE 'paid to%'
               OR lower(raw_description) LIKE 'paid -%')
              AND direction != 'credit'
        """)
        conn.commit()
    
    if "ref_id" not in cols:
        cur.execute("ALTER TABLE transactions ADD COLUMN ref_id TEXT")
        conn.commit()

    cur.execute("CREATE INDEX IF NOT EXISTS idx_tx_direction ON transactions(direction)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_tx_ref_id ON transactions(ref_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_tx_batch ON transactions(import_batch_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_tx_fingerprint ON transactions(fingerprint)")
    conn.commit()

    heal_and_reconcile_transactions(conn)

def init_db(context: Optional[str] = None):
    # Public demo mode is strictly restricted to initializing the demo database.
    if is_public_demo():
        contexts = ["demo"]
    else:
        contexts = [context] if context else ["personal", "demo"]

    for ctx in contexts:
        path = get_db_path(ctx)
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        conn = sqlite3.connect(path)
        with conn:
            conn.executescript(SCHEMA_SQL)
        migrate_db(conn)

        # Idempotent synthetic seeding for demo database in public demo mode
        if is_public_demo() and ctx == "demo":
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM transactions")
            count = cur.fetchone()[0]
            if count == 0:
                from app.services.demo_data import load_realistic_demo_dataset
                load_realistic_demo_dataset(conn)

        conn.close()
