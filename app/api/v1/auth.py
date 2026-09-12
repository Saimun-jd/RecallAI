"""
Authentication API Router for Recall AI.
Endpoints:
- POST /api/v1/auth/signup
- POST /api/v1/auth/login
- POST /api/v1/auth/logout
- GET  /api/v1/auth/me
"""

from fastapi import APIRouter, Depends, Request, status

from app.api.deps import get_current_user, get_current_workspace
from app.api.middleware import auth_rate_limiter
from app.core.config import settings
from app.core.database import get_db
from app.core.errors import AuthenticationError, ConflictError, RateLimitError
from app.core.security import create_access_token, hash_password, verify_password
from app.models.repositories import PreferencesRepository, UserRepository, WorkspaceRepository
from app.schemas.auth import AuthResponse, UserLoginRequest, UserRegisterRequest, UserResponse, WorkspaceResponse
from app.schemas.common import ResponseEnvelope

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _check_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    if not auth_rate_limiter.is_allowed(client_ip):
        raise RateLimitError("Too many authentication attempts. Please try again in one minute.")


@router.post(
    "/signup",
    response_model=ResponseEnvelope[AuthResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user"
)
async def signup(body: UserRegisterRequest, request: Request):
    _check_rate_limit(request)

    existing = UserRepository.get_by_email(body.email)
    if existing:
        raise ConflictError("An account with this email address already exists.")

    password_hash = hash_password(body.password)

    # Atomic creation of User + Workspace + Preferences
    with get_db() as conn:
        user = UserRepository.create_user(
            email=body.email,
            password_hash=password_hash,
            full_name=body.full_name,
            db_conn=conn
        )
        workspace = WorkspaceRepository.create_workspace(
            owner_id=user["id"],
            name="Personal Workspace",
            db_conn=conn
        )
        PreferencesRepository.create_preferences(
            user_id=user["id"],
            theme="neo-brutalist",
            daily_review_goal=20,
            preferred_llm_provider="auto",
            db_conn=conn
        )

    token = create_access_token(
        subject=user["id"],
        workspace_id=workspace["id"]
    )

    user_resp = UserResponse(
        id=user["id"],
        email=user["email"],
        full_name=user.get("full_name"),
        avatar_url=user.get("avatar_url"),
        created_at=user["created_at"]
    )
    ws_resp = WorkspaceResponse(
        id=workspace["id"],
        owner_id=workspace["owner_id"],
        name=workspace["name"],
        created_at=workspace["created_at"]
    )

    return ResponseEnvelope(
        data=AuthResponse(
            access_token=token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_resp,
            workspace=ws_resp
        )
    )


@router.post(
    "/login",
    response_model=ResponseEnvelope[AuthResponse],
    summary="Authenticate user and issue session token"
)
async def login(body: UserLoginRequest, request: Request):
    _check_rate_limit(request)

    user = UserRepository.get_by_email(body.email)
    if not user:
        # Uniform error message to prevent account enumeration
        raise AuthenticationError("Invalid email or password.")

    if not verify_password(body.password, user["password_hash"]):
        raise AuthenticationError("Invalid email or password.")

    if not user.get("is_active"):
        raise AuthenticationError("This account is currently deactivated.")

    workspace = WorkspaceRepository.get_by_owner_id(user["id"])
    if not workspace:
        workspace = WorkspaceRepository.create_workspace(owner_id=user["id"])

    token = create_access_token(
        subject=user["id"],
        workspace_id=workspace["id"]
    )

    user_resp = UserResponse(
        id=user["id"],
        email=user["email"],
        full_name=user.get("full_name"),
        avatar_url=user.get("avatar_url"),
        created_at=user["created_at"]
    )
    ws_resp = WorkspaceResponse(
        id=workspace["id"],
        owner_id=workspace["owner_id"],
        name=workspace["name"],
        created_at=workspace["created_at"]
    )

    return ResponseEnvelope(
        data=AuthResponse(
            access_token=token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_resp,
            workspace=ws_resp
        )
    )


@router.post(
    "/logout",
    response_model=ResponseEnvelope[dict],
    summary="Log out active session"
)
async def logout(current_user: dict = Depends(get_current_user)):
    return ResponseEnvelope(data={"message": "Logged out successfully."})


@router.get(
    "/me",
    response_model=ResponseEnvelope[dict],
    summary="Get current user and workspace profile"
)
async def get_me(
    current_user: dict = Depends(get_current_user),
    current_workspace: dict = Depends(get_current_workspace)
):
    user_data = {
        "id": current_user["id"],
        "email": current_user["email"],
        "full_name": current_user.get("full_name"),
        "avatar_url": current_user.get("avatar_url"),
        "created_at": current_user["created_at"]
    }
    ws_data = {
        "id": current_workspace["id"],
        "owner_id": current_workspace["owner_id"],
        "name": current_workspace["name"],
        "created_at": current_workspace["created_at"]
    }
    return ResponseEnvelope(data={"user": user_data, "workspace": ws_data})
