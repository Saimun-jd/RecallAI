"""
Authorization & Authentication Dependencies for FastAPI.
Provides centralized access control, user resolution, and IDOR protection.
"""

from typing import Any, Dict, Optional
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token
from app.core.errors import AuthenticationError, AuthorizationError, NotFoundError
from app.models.repositories import UserRepository, WorkspaceRepository, DocumentRepository

security_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    Extracts and validates the JWT Bearer token.
    Resolves the authenticated user from the database.
    """
    raw_token: Optional[str] = None
    if credentials:
        raw_token = credentials.credentials
    elif authorization and authorization.startswith("Bearer "):
        raw_token = authorization[7:].strip()

    if not raw_token:
        raise AuthenticationError("Authentication credentials required. Please provide a Bearer token.")

    try:
        payload = decode_access_token(raw_token)
    except ValueError as e:
        raise AuthenticationError(f"Invalid authentication token: {str(e)}")

    user_id = payload.get("sub")
    if not user_id:
        raise AuthenticationError("Invalid token payload: missing subject identifier.")

    user = UserRepository.get_by_id(user_id)
    if not user:
        raise AuthenticationError("User account not found or has been removed.")

    if not user.get("is_active"):
        raise AuthenticationError("User account is currently disabled.")

    return user


def get_current_workspace(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Retrieves the authoritative personal workspace belonging to the authenticated user.
    """
    workspace = WorkspaceRepository.get_by_owner_id(current_user["id"])
    if not workspace:
        # Fallback: create default workspace if one was not initialized
        workspace = WorkspaceRepository.create_workspace(
            owner_id=current_user["id"],
            name="Personal Workspace"
        )
    return workspace


def require_workspace_owner(
    workspace_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Enforces that the workspace requested exists and is owned by the current user.
    Eliminates multi-tenant crosstalk.
    """
    workspace = WorkspaceRepository.get_by_id(workspace_id)
    if not workspace or workspace.get("owner_id") != current_user["id"]:
        raise AuthorizationError("You do not have permission to access this workspace.")
    return workspace


def require_document_owner(
    document_id: str,
    workspace: Dict[str, Any] = Depends(get_current_workspace)
) -> Dict[str, Any]:
    """
    Enforces that the document exists within the authenticated user's workspace.
    Guarantees 100% IDOR protection. Returns 404 to avoid leaking existence.
    """
    document = DocumentRepository.get_by_id_and_workspace(
        document_id=document_id,
        workspace_id=workspace["id"]
    )
    if not document:
        raise NotFoundError("Document not found.")
    return document
