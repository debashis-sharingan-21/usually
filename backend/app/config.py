import os
from pathlib import Path
from typing import List

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

def get_deployment_mode() -> str:
    """Returns the current deployment mode, e.g. 'public_demo' or 'local'."""
    return os.environ.get("USUALLY_DEPLOYMENT_MODE", "local").strip().lower()

def is_public_demo() -> bool:
    """Returns True if the server is running in public synthetic demo mode."""
    return get_deployment_mode() == "public_demo"

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
    Returns the personal SQLite database path for local use.
    Raises PermissionError in public demo mode to guarantee zero personal data access.
    """
    if is_public_demo():
        raise PermissionError("Access to personal database path is strictly forbidden in public_demo mode.")
    custom_personal = os.environ.get("USUALLY_DB_PATH")
    return custom_personal if custom_personal else str(DATA_DIR / "usually.db")

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
