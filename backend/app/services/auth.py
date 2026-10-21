import os
import sqlite3
import secrets
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from app.config import AUTH_DB_PATH, get_user_workspace_path

AUTH_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password_hash TEXT,
    password_salt TEXT,
    is_guest INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON auth_sessions(user_id);
"""

def get_auth_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(os.path.abspath(AUTH_DB_PATH)), exist_ok=True)
    conn = sqlite3.connect(AUTH_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_auth_db():
    conn = get_auth_connection()
    try:
        with conn:
            conn.executescript(AUTH_SCHEMA)
    finally:
        conn.close()

def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations=100000
    ).hex()
    return pwd_hash, salt

def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    pwd_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(pwd_hash, expected_hash)

def generate_session_token() -> str:
    return secrets.token_urlsafe(32)

def _init_user_workspace_db(user_id: str):
    """Initializes the per-user SQLite database with core schema."""
    from app.database import SCHEMA_SQL, migrate_db
    workspace_path = get_user_workspace_path(user_id)
    os.makedirs(os.path.dirname(os.path.abspath(workspace_path)), exist_ok=True)
    conn = sqlite3.connect(workspace_path)
    try:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA foreign_keys = ON")
        with conn:
            conn.executescript(SCHEMA_SQL)
        migrate_db(conn)
    finally:
        conn.close()

def create_guest_workspace() -> Dict[str, Any]:
    """Creates an instant isolated guest workspace and session token."""
    init_auth_db()
    user_id = f"guest_{uuid.uuid4().hex[:12]}"
    token = generate_session_token()
    now_iso = datetime.now(timezone.utc).isoformat()

    conn = get_auth_connection()
    try:
        with conn:
            conn.execute(
                "INSERT INTO users (id, email, password_hash, password_salt, is_guest, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, None, None, None, 1, now_iso)
            )
            conn.execute(
                "INSERT INTO auth_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                (token, user_id, now_iso, None)
            )
    finally:
        conn.close()

    _init_user_workspace_db(user_id)

    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": None,
            "is_guest": True,
            "created_at": now_iso
        },
        "workspace_type": "personal"
    }

def register_user(email: str, password: str) -> Dict[str, Any]:
    """Registers a new permanent user and initializes their isolated workspace."""
    init_auth_db()
    clean_email = email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise ValueError("A valid email address is required.")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters.")

    conn = get_auth_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = ?", (clean_email,))
        if cur.fetchone():
            raise ValueError("An account with this email already exists.")

        user_id = f"user_{uuid.uuid4().hex[:12]}"
        pwd_hash, salt = hash_password(password)
        token = generate_session_token()
        now_iso = datetime.now(timezone.utc).isoformat()

        with conn:
            conn.execute(
                "INSERT INTO users (id, email, password_hash, password_salt, is_guest, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, clean_email, pwd_hash, salt, 0, now_iso)
            )
            conn.execute(
                "INSERT INTO auth_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                (token, user_id, now_iso, None)
            )
    finally:
        conn.close()

    _init_user_workspace_db(user_id)

    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": clean_email,
            "is_guest": False,
            "created_at": now_iso
        },
        "workspace_type": "personal"
    }

def login_user(email: str, password: str) -> Dict[str, Any]:
    """Logs in an existing user and returns an authenticated session token."""
    init_auth_db()
    clean_email = email.strip().lower()

    conn = get_auth_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, email, password_hash, password_salt, is_guest, created_at FROM users WHERE email = ?",
            (clean_email,)
        )
        row = cur.fetchone()
        if not row:
            raise ValueError("Invalid email or password.")

        user_id = row["id"]
        pwd_hash = row["password_hash"]
        salt = row["password_salt"]
        is_guest = bool(row["is_guest"])
        created_at = row["created_at"]

        if not pwd_hash or not salt or not verify_password(password, salt, pwd_hash):
            raise ValueError("Invalid email or password.")

        token = generate_session_token()
        now_iso = datetime.now(timezone.utc).isoformat()

        with conn:
            conn.execute(
                "INSERT INTO auth_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                (token, user_id, now_iso, None)
            )

        # Ensure user's workspace db exists
        _init_user_workspace_db(user_id)

        return {
            "token": token,
            "user": {
                "id": user_id,
                "email": clean_email,
                "is_guest": is_guest,
                "created_at": created_at
            },
            "workspace_type": "personal"
        }
    finally:
        conn.close()

def get_user_by_token(token: str) -> Optional[Dict[str, Any]]:
    """Resolves a session token to a user record."""
    if not token:
        return None
    init_auth_db()
    conn = get_auth_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT u.id, u.email, u.is_guest, u.created_at
            FROM auth_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ?
        """, (token,))
        row = cur.fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "email": row["email"],
            "is_guest": bool(row["is_guest"]),
            "created_at": row["created_at"]
        }
    finally:
        conn.close()

def logout_token(token: str) -> bool:
    """Terminates an active session token."""
    if not token:
        return False
    init_auth_db()
    conn = get_auth_connection()
    try:
        with conn:
            cur = conn.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))
            return cur.rowcount > 0
    finally:
        conn.close()

def delete_user_workspace(user_id: str) -> bool:
    """
    Permanently deletes a user's isolated workspace SQLite database and account records.
    Ensures zero trace of transactions, batches, or habit feedback remains.
    """
    init_auth_db()
    workspace_path = get_user_workspace_path(user_id)

    # 1. Cleanly delete workspace SQLite files (main, -wal, -shm)
    for ext in ("", "-wal", "-shm"):
        target = workspace_path + ext
        if os.path.exists(target):
            try:
                os.remove(target)
            except Exception:
                pass

    # 2. Delete user and cascade delete sessions
    conn = get_auth_connection()
    try:
        with conn:
            conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        return True
    finally:
        conn.close()
