"""
Learning Progress, Analytics & Spaced Repetition API Router for Recall AI.
Provides dashboard metrics, continuous-time study activity, detailed review/quiz/flashcard statistics,
document-level progress, concept-level progress, and study session histories.
Strictly read-only: never modifies scheduler state or debits AI credits.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, get_current_workspace
from app.schemas.analytics import (
    ConceptLearningProgress,
    DashboardSummaryResponse,
    DocumentLearningProgress,
    FlashcardPerformanceStats,
    QuizPerformanceStats,
    ReviewDetailedStats,
    StudyActivityResponse,
    StudySessionSummary,
)
from app.schemas.attempt import (
    LearningItemResponse,
    LearningProgressSummaryResponse,
)
from app.schemas.common import ResponseEnvelope
from app.services.learning import LearningProgressService
from app.services.learning_analytics import LearningAnalyticsService

router = APIRouter(prefix="/learning", tags=["Learning Progress & Analytics"])


@router.get(
    "/dashboard",
    response_model=ResponseEnvelope[DashboardSummaryResponse],
    summary="Get high-level learning dashboard overview"
)
def get_dashboard(
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[DashboardSummaryResponse]:
    """
    Returns high-level learning dashboard metrics:
    - review_workload: due, overdue, new, and total active items
    - learning_states: FSRS state distribution (new, learning, review, relearning)
    - today: reviews and quiz attempts completed today
    - quizzes: total/completed attempts, average/min/max score, accuracy
    - flashcards: total cards, active, reviewed, due, and review state counts
    """
    summary = LearningAnalyticsService.get_dashboard(
        workspace_id=workspace["id"],
        user_id=current_user["id"]
    )
    return ResponseEnvelope(data=summary)


@router.get(
    "/activity",
    response_model=ResponseEnvelope[StudyActivityResponse],
    summary="Get continuous daily study activity time series"
)
def get_study_activity(
    range: str = Query(default="7d", description="Time range: '7d', '30d', '90d', or 'custom'"),
    start_date: Optional[str] = Query(default=None, description="Start date (YYYY-MM-DD) for 'custom' range"),
    end_date: Optional[str] = Query(default=None, description="End date (YYYY-MM-DD) for 'custom' range"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[StudyActivityResponse]:
    """
    Returns daily aggregates of reviews, quizzes, and correct/incorrect answers.
    Zero-fills days with no activity to guarantee a continuous timeline.
    """
    activity = LearningAnalyticsService.get_activity(
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        range_type=range,
        start_date=start_date,
        end_date=end_date
    )
    return ResponseEnvelope(data=activity)


@router.get(
    "/statistics/reviews",
    response_model=ResponseEnvelope[ReviewDetailedStats],
    summary="Get detailed spaced-repetition statistics and rating distribution"
)
def get_review_statistics(
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[ReviewDetailedStats]:
    """
    Returns detailed workload statistics, rating counts and percentages (again, hard, good, easy),
    retention success rate, and average reviews per active day.
    """
    stats = LearningAnalyticsService.get_review_statistics(
        workspace_id=workspace["id"],
        user_id=current_user["id"]
    )
    return ResponseEnvelope(data=stats)


@router.get(
    "/statistics/quizzes",
    response_model=ResponseEnvelope[QuizPerformanceStats],
    summary="Get granular quiz assessment metrics"
)
def get_quiz_statistics(
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[QuizPerformanceStats]:
    """
    Returns quiz metrics: total attempts, completed attempts, average score,
    highest/lowest score, questions answered, and accuracy percentage.
    """
    stats = LearningAnalyticsService.get_quiz_statistics(
        workspace_id=workspace["id"],
        user_id=current_user["id"]
    )
    return ResponseEnvelope(data=stats)


@router.get(
    "/statistics/flashcards",
    response_model=ResponseEnvelope[FlashcardPerformanceStats],
    summary="Get flashcard learning and mastery metrics"
)
def get_flashcard_statistics(
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[FlashcardPerformanceStats]:
    """
    Returns flashcard metrics: total cards, active cards, reviewed count,
    due count, and cards in FSRS review/mastery state.
    """
    stats = LearningAnalyticsService.get_flashcard_statistics(
        workspace_id=workspace["id"],
        user_id=current_user["id"]
    )
    return ResponseEnvelope(data=stats)


@router.get(
    "/progress/documents",
    response_model=ResponseEnvelope[List[DocumentLearningProgress]],
    summary="Get learning progress per document"
)
def get_document_progress(
    limit: int = Query(default=50, ge=1, le=100, description="Max documents to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[List[DocumentLearningProgress]]:
    """
    Answers 'How much have I learned from each document?'.
    Returns total items, new items, learning items, review items, due items, and correct rate.
    """
    progress = LearningAnalyticsService.get_document_progress(
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        limit=limit,
        offset=offset
    )
    return ResponseEnvelope(data=progress)


@router.get(
    "/progress/concepts",
    response_model=ResponseEnvelope[List[ConceptLearningProgress]],
    summary="Get learning progress per concept or topic"
)
def get_concept_progress(
    limit: int = Query(default=50, ge=1, le=100, description="Max concepts to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[List[ConceptLearningProgress]]:
    """
    Returns learning progress aggregated across concepts/topics.
    """
    progress = LearningAnalyticsService.get_concept_progress(
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        limit=limit,
        offset=offset
    )
    return ResponseEnvelope(data=progress)


@router.get(
    "/sessions",
    response_model=ResponseEnvelope[List[StudySessionSummary]],
    summary="List historical study review sessions"
)
def list_study_sessions(
    limit: int = Query(default=20, ge=1, le=100, description="Max sessions to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    status: Optional[str] = Query(default=None, description="Filter by status ('active', 'completed', 'abandoned')"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[List[StudySessionSummary]]:
    """
    Returns paginated historical study sessions with duration, items reviewed, and rating distribution.
    """
    sessions = LearningAnalyticsService.get_study_sessions(
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        limit=limit,
        offset=offset,
        status=status
    )
    return ResponseEnvelope(data=sessions)


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
