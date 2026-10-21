from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.services.auth import (
    create_guest_workspace,
    register_user,
    login_user,
    logout_token,
    delete_user_workspace
)
from app.workspace import get_current_workspace, require_personal_workspace, WorkspaceContext

router = APIRouter(prefix="/api/auth", tags=["Authentication & Workspaces"])

class RegisterPayload(BaseModel):
    email: str
    password: str

class LoginPayload(BaseModel):
    email: str
    password: str

@router.post("/guest")
def instant_guest_workspace():
    """Generates an instant private workspace with physical SQLite isolation."""
    try:
        return create_guest_workspace()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create guest workspace: {str(e)}")

@router.post("/register")
def register(payload: RegisterPayload):
    """Registers a permanent user account and creates their private workspace."""
    try:
        return register_user(payload.email, payload.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@router.post("/login")
def login(payload: LoginPayload):
    """Authenticates a user and issues a session token."""
    try:
        return login_user(payload.email, payload.password)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@router.get("/me")
def get_current_user_and_workspace(
    workspace: WorkspaceContext = Depends(get_current_workspace)
):
    """Returns the current authenticated user identity and active workspace context."""
    return {
        "workspace_type": workspace.workspace_type,
        "user_id": workspace.user_id,
        "email": workspace.email,
        "is_guest": workspace.is_guest,
        "is_authenticated": workspace.is_authenticated
    }

@router.post("/logout")
def logout(
    workspace: WorkspaceContext = Depends(get_current_workspace)
):
    """Terminates the active session token."""
    if workspace.token:
        logout_token(workspace.token)
    return {"status": "success", "message": "Logged out successfully"}

@router.delete("/workspace")
def delete_workspace(
    workspace: WorkspaceContext = Depends(require_personal_workspace)
):
    """
    Privacy control: permanently deletes the user's isolated workspace database
    file and account credentials.
    """
    if not workspace.user_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete server-default or anonymous workspace."
        )

    success = delete_user_workspace(workspace.user_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete workspace data")

    return {
        "status": "success",
        "message": "Personal workspace and all associated financial records permanently deleted."
    }
