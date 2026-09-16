"""
Review Queue Service for Recall AI.
Determines due learning items, prioritizes review order (overdue -> due now -> new),
and enforces daily review limits.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional

from app.models.repositories import (
    LearningItemRepository,
    FlashcardRepository,
    QuizQuestionRepository,
)
from app.schemas.review import ReviewQueueItemResponse

logger = logging.getLogger(__name__)


class ReviewQueueService:
    """
    Computes deterministic, prioritized queues of items due for spaced repetition review.
    """

    @classmethod
    def get_due_queue(
        cls,
        workspace_id: str,
        user_id: str,
        limit: int = 50,
        content_type: Optional[str] = None
    ) -> List[ReviewQueueItemResponse]:
        """
        Retrieves due items ordered deterministically:
        1. Overdue items (next_review_at < now - 24 hours)
        2. Due now items (next_review_at <= now)
        3. New items (never reviewed yet)
        """
        items = LearningItemRepository.get_due_queue(
            workspace_id=workspace_id,
            user_id=user_id,
            limit=limit,
            content_type=content_type
        )

        results: List[ReviewQueueItemResponse] = []
        for it in items:
            front_text = None
            source_ref = it.get("source_reference") or {}
            if isinstance(source_ref, dict) and source_ref.get("front"):
                front_text = source_ref.get("front")
            elif isinstance(source_ref, dict) and (source_ref.get("question") or source_ref.get("question_text")):
                front_text = source_ref.get("question") or source_ref.get("question_text")

            results.append(
                ReviewQueueItemResponse(
                    id=it["id"],
                    content_type=it["content_type"],
                    content_id=it["content_id"],
                    priority_group=it.get("priority_group", "due_now"),
                    next_review_at=it.get("next_review_at"),
                    front=front_text,
                    source_reference=source_ref
                )
            )

        return results
