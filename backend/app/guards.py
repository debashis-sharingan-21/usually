from fastapi import Depends
from app.workspace import require_personal_workspace, WorkspaceContext

def verify_write_permission(
    workspace: WorkspaceContext = Depends(require_personal_workspace)
) -> WorkspaceContext:
    """
    FastAPI dependency that enforces write security:
    - Rejects any mutation on the synthetic demo dataset (HTTP 403).
    - Requires authenticated session in hosted/public mode (HTTP 401).
    - Returns the active isolated WorkspaceContext.
    """
    return workspace
