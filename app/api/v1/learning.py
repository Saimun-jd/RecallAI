"""
Learning Progress & Spaced Repetition API Router for Recall AI.
Provides aggregate knowledge progress statistics and queries for due review items.
"""

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, get_current_workspace
from app.schemas.attempt import (
    LearningItemResponse,
    LearningProgressSummaryResponse,
)
from app.schemas.common import ResponseEnvelope
from app.services.learning import LearningProgressService

router = APIRouter(prefix="/learning", tags=["Learning Progress & Spaced Repetition"])


@router.get(
    "/progress",
    response_model=ResponseEnvelope[LearningProgressSummaryResponse],
    summary="Get aggregated learning progress statistics"
)
def get_progress_summary(
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[LearningProgressSummaryResponse]:
    """
    Returns summary statistics: total items, reviewed items, correct rate, and items currently due.
    """
    summary = LearningProgressService.get_progress_summary(
        workspace_id=workspace["id"],
        user_id=current_user["id"]
    )
    return ResponseEnvelope(data=summary)


@router.get(
    "/due",
    response_model=ResponseEnvelope[List[LearningItemResponse]],
    summary="List learning items scheduled for review"
)
def list_due_items(
    limit: int = Query(default=50, ge=1, le=100, description="Max due items to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[List[LearningItemResponse]]:
    """
    Returns learning items whose next_review_at timestamp is past or equal to the current time.
    """
    items = LearningProgressService.list_due_items(
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        limit=limit,
        offset=offset
    )
    return ResponseEnvelope(data=items)
