"""
Review, Session, and Spaced Repetition Pydantic Schemas for Recall AI.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ReviewRatingEnum(str, Enum):
    """
    Controlled 4-grade rating vocabulary for spaced repetition.
    """
    AGAIN = "again"
    HARD = "hard"
    GOOD = "good"
    EASY = "easy"


class StartReviewSessionRequest(BaseModel):
    """
    Request parameters for starting a new review session.
    """
    limit: int = Field(20, ge=1, le=100, description="Maximum number of due items to include in this session.")
    content_type: Optional[str] = Field(None, description="Optional filter for 'flashcard' or 'quiz_question'.")


class ReviewSessionResponse(BaseModel):
    """
    Summary of an active or completed review session.
    """
    id: str
    workspace_id: str
    user_id: str
    status: str
    started_at: str
    completed_at: Optional[str] = None
    total_items: int
    reviewed_items: int
    progress_percentage: float = 0.0


class MaskedReviewContentResponse(BaseModel):
    """
    Learning item presented to user during active review.
    Zero answer leakage: answer/back/explanation is completely omitted.
    """
    review_id: str
    session_id: str
    learning_item_id: str
    content_type: str
    content_id: str
    front: str
    options: Optional[List[str]] = None
    source_metadata: Optional[List[Dict[str, Any]]] = None
    order_index: int
    status: str
    revealed: bool = False


class RevealedReviewContentResponse(MaskedReviewContentResponse):
    """
    Learning item with answer/back revealed after explicit user action.
    """
    back: str
    explanation: Optional[str] = None
    revealed: bool = True


class RateReviewRequest(BaseModel):
    """
    Controlled rating submission for an active review item.
    """
    rating: ReviewRatingEnum


class RateReviewResponse(BaseModel):
    """
    Evaluation result and updated memory state after rating.
    """
    review_id: str
    session_id: str
    learning_item_id: str
    rating: str
    next_review_at: str
    stability: Optional[float] = None
    difficulty: Optional[float] = None
    state: str
    reviewed_items: int
    total_items: int
    session_status: str


class ReviewQueueItemResponse(BaseModel):
    """
    Individual item in the upcoming review queue.
    """
    id: str
    content_type: str
    content_id: str
    priority_group: str
    next_review_at: Optional[str] = None
    front: Optional[str] = None
    source_reference: Dict[str, Any] = Field(default_factory=dict)


class ReviewStatisticsResponse(BaseModel):
    """
    Durable learning statistics and review volume.
    """
    due_count: int
    overdue_count: int
    reviewed_today: int
    correct_rate: float
    total_items: int
