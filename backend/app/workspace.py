from dataclasses import dataclass
from typing import Optional
from fastapi import Header, Query, HTTPException, Depends
from app.config import (
    is_public_demo,
    is_hosted_mode,
    get_demo_db_path,
    get_personal_db_path,
    get_user_workspace_path,
)
from app.services.auth import get_user_by_token

@dataclass
class WorkspaceContext:
    workspace_type: str  # "demo" | "personal"
    user_id: Optional[str] = None
    email: Optional[str] = None
    is_guest: bool = False
    db_path: str = ""
    token: Optional[str] = None
    is_authenticated: bool = False

def get_current_workspace(
    authorization: Optional[str] = Header(None),
    x_workspace_context: Optional[str] = Header(None),
    workspace_context: Optional[str] = Query(None)
) -> WorkspaceContext:
    """
    Resolves the authoritative workspace context for incoming API requests.
    Validates session token if present. Never trusts client-supplied user IDs.
    """
    requested_context = (x_workspace_context or workspace_context or "").strip().lower()

    token: Optional[str] = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1].strip()

    if token:
        user = get_user_by_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session token")

        # Authenticated user can explicitly choose to view demo, or default to personal
        if requested_context == "demo":
            return WorkspaceContext(
                workspace_type="demo",
                user_id=user["id"],
                email=user.get("email"),
                is_guest=user["is_guest"],
                db_path=get_demo_db_path(),
                token=token,
                is_authenticated=True
            )

        return WorkspaceContext(
            workspace_type="personal",
            user_id=user["id"],
            email=user.get("email"),
            is_guest=user["is_guest"],
            db_path=get_user_workspace_path(user["id"]),
            token=token,
            is_authenticated=True
        )

    # Unauthenticated requests:
    if is_public_demo():
        return WorkspaceContext(
            workspace_type="demo",
            db_path=get_demo_db_path(),
            is_authenticated=False
        )

    if requested_context == "demo":
        return WorkspaceContext(
            workspace_type="demo",
            db_path=get_demo_db_path(),
            is_authenticated=False
        )

    # In local development mode without auth headers:
    if not is_hosted_mode():
        from app.database import get_active_context
        active = get_active_context()
        if active == "demo":
            return WorkspaceContext(
                workspace_type="demo",
                db_path=get_demo_db_path(),
                is_authenticated=False
            )
        return WorkspaceContext(
            workspace_type="personal",
            db_path=get_personal_db_path(),
            is_authenticated=False
        )

    # In hosted cloud mode without an auth header, default safely to the read-only demo
    return WorkspaceContext(
        workspace_type="demo",
        db_path=get_demo_db_path(),
        is_authenticated=False
    )

def require_personal_workspace(
    workspace: WorkspaceContext = Depends(get_current_workspace)
) -> WorkspaceContext:
    """
    Guard for mutating endpoints.
    Fails closed:
    - 403 Forbidden with exact legacy message if unauthenticated in public demo mode.
    - 403 Forbidden if operating against the synthetic demo dataset when authenticated or hosted.
    - 401 Unauthorized if unauthenticated in hosted mode.
    """
    if is_public_demo() and not workspace.is_authenticated:
        raise HTTPException(
            status_code=403,
            detail="Mutations are disabled in public demo mode. Run Usually locally for private data and statement imports."
        )

    if workspace.workspace_type == "demo":
        if workspace.is_authenticated or is_hosted_mode() or is_public_demo():
            raise HTTPException(
                status_code=403,
                detail="The synthetic demo dataset is read-only. Create or open a private personal workspace to import statements and modify data."
            )

    if (is_hosted_mode() or is_public_demo()) and not workspace.is_authenticated:
        raise HTTPException(
            status_code=401,
            detail="Authentication or private workspace session required for statement imports and modifications."
        )

    return workspace
