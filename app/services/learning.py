"""
Learning Progress and Spaced Repetition Service for Recall AI.
Manages durable learning items, applies review scheduling, and records review events.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
import sqlite3

from app.models.repositories import (
    LearningItemRepository,
    ReviewEventRepository,
)
from app.schemas.attempt import (
    LearningItemResponse,
    LearningProgressSummaryResponse,
)
from app.services.scheduler import default_scheduler

logger = logging.getLogger(__name__)


class LearningProgressService:
    """
    Coordinates durable knowledge progress and review event history across quizzes and flashcards.
    """

    @classmethod
    def record_review_result(
        cls,
        workspace_id: str,
        user_id: str,
        content_type: str,
        content_id: str,
        is_correct: bool,
        source_reference: Optional[Dict[str, Any]] = None,
        source_id: Optional[str] = None,
        source_type: str = "quiz_attempt",
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        """
        Records the outcome of an assessment or flashcard review:
        1. Retrieves or creates durable LearningItem
        2. Computes next review date via ReviewScheduler
        3. Updates learning progress metrics
        4. Logs append-only ReviewEvent
        """
        item = LearningItemRepository.get_or_create(
            workspace_id=workspace_id,
            user_id=user_id,
            content_type=content_type,
            content_id=content_id,
            source_reference=source_reference,
            db_conn=db_conn
        )

        last_seen = None
        if item.get("last_seen_at"):
            try:
                last_seen = datetime.fromisoformat(item["last_seen_at"].replace("Z", "+00:00"))
            except Exception:
                pass

        next_review_at, updated_metadata = default_scheduler.schedule(
            previous_correct_count=item.get("correct_count", 0),
            previous_incorrect_count=item.get("incorrect_count", 0),
            is_correct=is_correct,
            last_seen_at=last_seen,
            current_metadata=item.get("scheduling_metadata")
        )

        next_review_iso = next_review_at.strftime("%Y-%m-%dT%H:%M:%SZ")

        LearningItemRepository.update_learning_progress(
            item_id=item["id"],
            is_correct=is_correct,
            next_review_at=next_review_iso,
            scheduling_metadata=updated_metadata,
            db_conn=db_conn
        )

        event = ReviewEventRepository.create_event(
            workspace_id=workspace_id,
            user_id=user_id,
            content_type=content_type,
            content_id=content_id,
            result="correct" if is_correct else "incorrect",
            source_type=source_type,
            source_id=source_id,
            learning_item_id=item["id"],
            db_conn=db_conn
        )

        return {
            "learning_item_id": item["id"],
            "next_review_at": next_review_iso,
            "event_id": event["id"]
        }

    @classmethod
    def get_progress_summary(
        cls,
        workspace_id: str,
        user_id: str
    ) -> LearningProgressSummaryResponse:
        """
        Returns aggregated learning progress statistics for the workspace user.
        """
        stats = LearningItemRepository.get_progress_summary(workspace_id, user_id)
        return LearningProgressSummaryResponse(
            total_items=stats["total_items"],
            reviewed_items=stats["reviewed_items"],
            correct_rate=stats["correct_rate"],
            due_items_count=stats["due_items_count"]
        )

    @classmethod
    def list_due_items(
        cls,
        workspace_id: str,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[LearningItemResponse]:
        """
        Lists learning items whose scheduled review date has arrived (next_review_at <= now).
        """
        items = LearningItemRepository.list_due_items(
            workspace_id=workspace_id,
            user_id=user_id,
            limit=limit,
            offset=offset
        )
        return [
            LearningItemResponse(
                id=i["id"],
                content_type=i["content_type"],
                content_id=i["content_id"],
                source_reference=i.get("source_reference") or {},
                correct_count=i.get("correct_count", 0),
                incorrect_count=i.get("incorrect_count", 0),
                last_seen_at=i.get("last_seen_at"),
                next_review_at=i.get("next_review_at")
            )
            for i in items
        ]
