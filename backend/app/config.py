import os
import re
from pathlib import Path
from typing import List

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("USUALLY_DATA_DIR", str(BASE_DIR / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)

WORKSPACES_DIR = Path(os.environ.get("USUALLY_WORKSPACES_DIR", str(DATA_DIR / "workspaces")))
WORKSPACES_DIR.mkdir(parents=True, exist_ok=True)

AUTH_DB_PATH = os.environ.get("USUALLY_AUTH_DB_PATH", str(DATA_DIR / "auth.db"))

def get_deployment_mode() -> str:
    """Returns the current deployment mode, e.g. 'public_demo', 'hosted', or 'local'."""
    return os.environ.get("USUALLY_DEPLOYMENT_MODE", "local").strip().lower()

def is_public_demo() -> bool:
    """Returns True if the server is running strictly in legacy public synthetic demo mode."""
    return get_deployment_mode() == "public_demo"

def is_hosted_mode() -> bool:
    """Returns True if running in a cloud deployment environment (e.g. Render, Railway)."""
    return get_deployment_mode() in ("hosted", "production", "public_demo") or bool(os.environ.get("RENDER")) or bool(os.environ.get("RAILWAY_ENVIRONMENT"))

def get_demo_db_path() -> str:
    """Returns the authoritative path for the synthetic demo SQLite database."""
    custom_demo = os.environ.get("USUALLY_DEMO_DB_PATH")
    if custom_demo:
        return custom_demo
    # If a custom personal path was provided in local testing, derive demo path
    custom_personal = os.environ.get("USUALLY_DB_PATH")
    if custom_personal:
        if custom_personal.endswith(".db"):
            return custom_personal[:-3] + "_demo.db"
        return custom_personal + "_demo"
    return str(DATA_DIR / "usually_demo.db")

def get_personal_db_path() -> str:
    """
    Returns the personal SQLite database path for local single-user use.
    In hosted public demo mode, raises PermissionError to guarantee zero local personal data exposure.
    """
    if is_public_demo():
        raise PermissionError("Access to server-local personal database path is strictly forbidden in public_demo mode.")
    custom_personal = os.environ.get("USUALLY_DB_PATH")
    return custom_personal if custom_personal else str(DATA_DIR / "usually.db")

def get_user_workspace_path(user_id: str) -> str:
    """
    Returns the isolated SQLite database path for a specific user workspace.
    Sanitizes user_id against path traversal attacks.
    """
    clean_id = re.sub(r"[^a-zA-Z0-9_\-]", "", user_id)
    if not clean_id:
        raise ValueError("Invalid user_id for workspace path")
    return str(WORKSPACES_DIR / f"workspace_{clean_id}.db")

DB_PATH = os.environ.get("USUALLY_DB_PATH", str(DATA_DIR / "usually.db"))
DEMO_DB_PATH = os.environ.get("USUALLY_DEMO_DB_PATH", str(DATA_DIR / "usually_demo.db"))
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma2:2b")

def get_allowed_origins() -> List[str]:
    """Returns the list of allowed CORS origins."""
    custom = os.environ.get("USUALLY_ALLOWED_ORIGINS", "").strip()
    if custom:
        return [o.strip() for o in custom.split(",") if o.strip()]
    # Default local development origins
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
