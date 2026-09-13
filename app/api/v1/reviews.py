"""
Reviews, Sessions & Spaced Repetition API Router for Recall AI.
Provides review queue previews, study sessions, answer reveals, idempotent rating,
and memory statistics powered by FSRS.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_current_user, get_current_workspace
from app.schemas.common import ResponseEnvelope
from app.schemas.review import (
    MaskedReviewContentResponse,
    RateReviewRequest,
    RateReviewResponse,
    RevealedReviewContentResponse,
    ReviewQueueItemResponse,
    ReviewSessionResponse,
    ReviewStatisticsResponse,
    StartReviewSessionRequest,
)
from app.services.review_queue import ReviewQueueService
from app.services.reviews import ReviewSessionService

router = APIRouter(prefix="/reviews", tags=["Reviews & Spaced Repetition"])


@router.get(
    "/queue",
    response_model=ResponseEnvelope[List[ReviewQueueItemResponse]],
    summary="Get upcoming due items for spaced repetition review"
)
def get_review_queue(
    limit: int = Query(50, ge=1, le=100),
    content_type: Optional[str] = Query(None, description="Filter by 'flashcard' or 'quiz_question'"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[List[ReviewQueueItemResponse]]:
    """
    Returns prioritized list of due items (overdue -> due now -> new).
    """
    items = ReviewQueueService.get_due_queue(
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        limit=limit,
        content_type=content_type
    )
    return ResponseEnvelope(data=items)


@router.get(
    "/statistics",
    response_model=ResponseEnvelope[ReviewStatisticsResponse],
    summary="Get review volume and memory retention statistics"
)
def get_review_statistics(
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[ReviewStatisticsResponse]:
    """
    Calculates due counts, overdue counts, reviews today, and success rates.
    """
    stats = ReviewSessionService.get_statistics(
        workspace_id=workspace["id"],
        user_id=current_user["id"]
    )
    return ResponseEnvelope(data=stats)


@router.post(
    "/sessions",
    response_model=ResponseEnvelope[ReviewSessionResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Start a new review session with due items"
)
def start_review_session(
    payload: StartReviewSessionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[ReviewSessionResponse]:
    """
    Creates an active review session containing due items.
    """
    session = ReviewSessionService.start_session(
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        limit=payload.limit,
        content_type=payload.content_type
    )
    return ResponseEnvelope(data=session)


@router.get(
    "/sessions/{session_id}",
    response_model=ResponseEnvelope[ReviewSessionResponse],
    summary="Get details and progress of a review session"
)
def get_review_session(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[ReviewSessionResponse]:
    """
    Retrieves progress of an active, completed, or abandoned session.
    """
    session = ReviewSessionService.get_session(
        session_id=session_id,
        workspace_id=workspace["id"],
        user_id=current_user["id"]
    )
    return ResponseEnvelope(data=session)


@router.get(
    "/sessions/{session_id}/next",
    response_model=ResponseEnvelope[Optional[MaskedReviewContentResponse]],
    summary="Get next review item with answer strictly hidden"
)
def get_next_review_item(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[Optional[MaskedReviewContentResponse]]:
    """
    Returns the next unreviewed item with front prompt only.
    Flashcard back and quiz correct answer/explanation are completely omitted.
    """
    item = ReviewSessionService.get_next_item(
        session_id=session_id,
        workspace_id=workspace["id"],
        user_id=current_user["id"]
    )
    return ResponseEnvelope(data=item)


@router.post(
    "/{review_id}/reveal",
    response_model=ResponseEnvelope[RevealedReviewContentResponse],
    summary="Reveal the back/answer of a review item without consuming AI credits"
)
def reveal_review_item(
    review_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[RevealedReviewContentResponse]:
    """
    Transitions the item to revealed and returns stored answer and explanation.
    Runs 100% locally with zero AI tokens.
    """
    revealed = ReviewSessionService.reveal_item(
        review_id=review_id,
        workspace_id=workspace["id"],
        user_id=current_user["id"]
    )
    return ResponseEnvelope(data=revealed)


@router.post(
    "/{review_id}/rate",
    response_model=ResponseEnvelope[RateReviewResponse],
    summary="Submit a controlled rating (again, hard, good, easy) and update FSRS memory state"
)
def rate_review_item(
    review_id: str,
    payload: RateReviewRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[RateReviewResponse]:
    """
    Applies the controlled rating, updates FSRS state atomically,
    logs an immutable review event, and increments session progress.
    Idempotent: prevents duplicate submission.
    """
    result = ReviewSessionService.rate_item(
        review_id=review_id,
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        rating=payload.rating
    )
    return ResponseEnvelope(data=result)


@router.post(
    "/sessions/{session_id}/complete",
    response_model=ResponseEnvelope[ReviewSessionResponse],
    summary="Finish an active review session"
)
def complete_review_session(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[ReviewSessionResponse]:
    """
    Marks the session completed. All completed reviews remain recorded.
    """
    session = ReviewSessionService.complete_session(
        session_id=session_id,
        workspace_id=workspace["id"],
        user_id=current_user["id"]
    )
    return ResponseEnvelope(data=session)


@router.post(
    "/sessions/{session_id}/abandon",
    response_model=ResponseEnvelope[ReviewSessionResponse],
    summary="Abandon an active review session"
)
def abandon_review_session(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[ReviewSessionResponse]:
    """
    Marks the session abandoned. Completed reviews remain intact; unreviewed items are not penalized.
    """
    session = ReviewSessionService.abandon_session(
        session_id=session_id,
        workspace_id=workspace["id"],
        user_id=current_user["id"]
    )
    return ResponseEnvelope(data=session)
