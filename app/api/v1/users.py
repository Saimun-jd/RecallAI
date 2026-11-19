"""
User Profile and Preferences Router for Recall AI.
Endpoints:
- GET /api/v1/users/me/preferences
- PUT /api/v1/users/me/preferences
"""

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, get_current_workspace
from app.models.repositories import PreferencesRepository
from app.schemas.common import ResponseEnvelope
from app.schemas.user import UserPreferencesResponse, UserPreferencesUpdateRequest

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "/me",
    response_model=ResponseEnvelope[dict],
    summary="Get current user profile (alias for /api/v1/auth/me)"
)
async def get_current_user_profile(
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


@router.get(
    "/me/preferences",
    response_model=ResponseEnvelope[UserPreferencesResponse],
    summary="Get preferences for current authenticated user"
)
async def get_preferences(current_user: dict = Depends(get_current_user)):
    prefs = PreferencesRepository.get_by_user_id(current_user["id"])
    if not prefs:
        prefs = PreferencesRepository.create_preferences(
            user_id=current_user["id"],
            theme="neo-brutalist",
            daily_review_goal=20,
            preferred_llm_provider="auto"
        )
    return ResponseEnvelope(data=UserPreferencesResponse(**prefs))


@router.put(
    "/me/preferences",
    response_model=ResponseEnvelope[UserPreferencesResponse],
    summary="Update preferences for current authenticated user"
)
async def update_preferences(
    body: UserPreferencesUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    updated = PreferencesRepository.update_preferences(
        user_id=current_user["id"],
        theme=body.theme,
        daily_review_goal=body.daily_review_goal,
        preferred_llm_provider=body.preferred_llm_provider,
        preferences=body.preferences
    )
    return ResponseEnvelope(data=UserPreferencesResponse(**updated))
