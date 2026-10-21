from fastapi import HTTPException
from app.config import is_public_demo

def verify_write_permission():
    """
    FastAPI dependency that enforces the read-only policy for public demo mode.
    Rejects any database mutation attempt with HTTP 403 Forbidden.
    """
    if is_public_demo():
        raise HTTPException(
            status_code=403,
            detail="Mutations are disabled in public demo mode. Run Usually locally for private data and statement imports."
        )
