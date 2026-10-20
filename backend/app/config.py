import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DB_PATH = os.environ.get("USUALLY_DB_PATH", str(DATA_DIR / "usually.db"))
DEMO_DB_PATH = os.environ.get("USUALLY_DEMO_DB_PATH", str(DATA_DIR / "usually_demo.db"))
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma2:2b")
