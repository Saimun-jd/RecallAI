"""
Review Session Service for Recall AI.
Orchestrates active study sessions, masked question delivery, answer reveal,
idempotent atomic rating, and FSRS memory state updates with zero AI credit consumption.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional, Union

from app.core.database import get_db
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.models.repositories import (
    FlashcardRepository,
    LearningItemRepository,
    QuizQuestionRepository,
    ReviewEventRepository,
    ReviewSessionItemRepository,
    ReviewSessionRepository,
)
from app.schemas.review import (
    MaskedReviewContentResponse,
    RateReviewResponse,
    RevealedReviewContentResponse,
    ReviewRatingEnum,
    ReviewSessionResponse,
    ReviewStatisticsResponse,
)
from app.services.scheduler import ReviewRating, default_scheduler

logger = logging.getLogger(__name__)


class ReviewSessionService:
    """
    Coordinates review session lifecycle, masked learning content,
    answer reveals, and atomic FSRS updates.
    """

    @classmethod
    def start_session(
        cls,
        workspace_id: str,
        user_id: str,
        limit: int = 20,
        content_type: Optional[str] = None
    ) -> ReviewSessionResponse:
        """
        Creates a new active review session from due learning items.
        """
        due_items = LearningItemRepository.get_due_queue(
            workspace_id=workspace_id,
            user_id=user_id,
            limit=limit,
            content_type=content_type
        )

        total_count = len(due_items)
        if total_count == 0:
            # If no items are due, create an immediately completed empty session
            session = ReviewSessionRepository.create_session(
                workspace_id=workspace_id,
                user_id=user_id,
                total_items=0,
                metadata={"content_type": content_type}
            )
            ReviewSessionRepository.update_status(session["id"], "completed")
            return ReviewSessionResponse(
                id=session["id"],
                workspace_id=workspace_id,
                user_id=user_id,
                status="completed",
                started_at=session["started_at"],
                completed_at=session["started_at"],
                total_items=0,
                reviewed_items=0,
                progress_percentage=100.0
            )

        with get_db() as conn:
            session = ReviewSessionRepository.create_session(
                workspace_id=workspace_id,
                user_id=user_id,
                total_items=total_count,
                metadata={"content_type": content_type},
                db_conn=conn
            )
            item_ids = [it["id"] for it in due_items]
            ReviewSessionItemRepository.create_items_batch(
                session_id=session["id"],
                learning_item_ids=item_ids,
                db_conn=conn
            )

        return ReviewSessionResponse(
            id=session["id"],
            workspace_id=workspace_id,
            user_id=user_id,
            status="active",
            started_at=session["started_at"],
            completed_at=None,
            total_items=total_count,
            reviewed_items=0,
            progress_percentage=0.0
        )

    @classmethod
    def get_session(
        cls,
        session_id: str,
        workspace_id: str,
        user_id: str
    ) -> ReviewSessionResponse:
        """
        Retrieves review session details with IDOR verification.
        """
        session = ReviewSessionRepository.get_by_id_and_workspace(
            session_id=session_id,
            workspace_id=workspace_id,
            user_id=user_id
        )
        if not session:
            raise NotFoundError(f"Review session '{session_id}' not found.")

        total = session.get("total_items", 0)
        reviewed = session.get("reviewed_items", 0)
        pct = round((reviewed / total) * 100.0, 1) if total > 0 else 0.0

        return ReviewSessionResponse(
            id=session["id"],
            workspace_id=session["workspace_id"],
            user_id=session["user_id"],
            status=session["status"],
            started_at=session["started_at"],
            completed_at=session.get("completed_at"),
            total_items=total,
            reviewed_items=reviewed,
            progress_percentage=pct
        )

    @classmethod
    def get_next_item(
        cls,
        session_id: str,
        workspace_id: str,
        user_id: str
    ) -> Optional[MaskedReviewContentResponse]:
        """
        Retrieves the next unreviewed item with answer strictly masked.
        """
        session = ReviewSessionRepository.get_by_id_and_workspace(
            session_id=session_id,
            workspace_id=workspace_id,
            user_id=user_id
        )
        if not session:
            raise NotFoundError(f"Review session '{session_id}' not found.")

        if session["status"] != "active":
            return None

        next_item = ReviewSessionItemRepository.get_next_pending(session_id)
        if not next_item:
            # Session finished
            ReviewSessionRepository.update_status(session_id, "completed")
            return None

        learning_item = LearningItemRepository.get_by_id(
            item_id=next_item["learning_item_id"],
            workspace_id=workspace_id
        )
        if not learning_item:
            raise NotFoundError("Learning item not found.")

        content_type = learning_item["content_type"]
        content_id = learning_item["content_id"]
        front = ""
        options = None
        source_metadata = None

        if content_type == "flashcard":
            card = FlashcardRepository.get_by_id(content_id)
            if card:
                front = card.get("front", "")
                source_metadata = card.get("source_metadata", [])
            else:
                front = learning_item.get("source_reference", {}).get("front", "Flashcard Question")
        elif content_type == "quiz_question":
            question = QuizQuestionRepository.get_by_id(content_id)
            if question:
                front = question.get("question") or question.get("question_text") or "Quiz Question"
                options = question.get("options", [])
                source_metadata = question.get("source_metadata", [])
            else:
                ref = learning_item.get("source_reference") or {}
                front = ref.get("question") or ref.get("question_text") or ref.get("front") or "Quiz Question"
        else:
            front = str(learning_item.get("source_reference", {}).get("front", "Study Concept"))

        return MaskedReviewContentResponse(
            review_id=next_item["id"],
            session_id=session_id,
            learning_item_id=learning_item["id"],
            content_type=content_type,
            content_id=content_id,
            front=front,
            options=options,
            source_metadata=source_metadata,
            order_index=next_item["order_index"],
            status=next_item["status"],
            revealed=next_item["status"] == "revealed"
        )

    @classmethod
    def reveal_item(
        cls,
        review_id: str,
        workspace_id: str,
        user_id: str
    ) -> RevealedReviewContentResponse:
        """
        Reveals the back/answer of a review item without AI credits.
        """
        review_item = ReviewSessionItemRepository.get_by_id(review_id)
        if not review_item:
            raise NotFoundError(f"Review item '{review_id}' not found.")

        session = ReviewSessionRepository.get_by_id_and_workspace(
            session_id=review_item["session_id"],
            workspace_id=workspace_id,
            user_id=user_id
        )
        if not session:
            raise NotFoundError(f"Review session not found or unauthorized.")

        if session["status"] != "active":
            raise ValidationError(f"Cannot reveal item in a '{session['status']}' session.")

        # Transition status to revealed if pending
        if review_item["status"] == "pending":
            ReviewSessionItemRepository.mark_revealed(review_id)

        learning_item = LearningItemRepository.get_by_id(
            item_id=review_item["learning_item_id"],
            workspace_id=workspace_id
        )
        if not learning_item:
            raise NotFoundError("Learning item not found.")

        content_type = learning_item["content_type"]
        content_id = learning_item["content_id"]
        front = ""
        back = ""
        explanation = None
        options = None
        source_metadata = None

        if content_type == "flashcard":
            card = FlashcardRepository.get_by_id(content_id)
            if card:
                front = card.get("front", "")
                back = card.get("back", "")
                source_metadata = card.get("source_metadata", [])
            else:
                front = learning_item.get("source_reference", {}).get("front", "Flashcard Question")
                back = "Answer details unavailable."
        elif content_type == "quiz_question":
            question = QuizQuestionRepository.get_by_id(content_id)
            if question:
                front = question.get("question") or question.get("question_text") or "Quiz Question"
                back = question.get("correct_answer", "")
                explanation = question.get("explanation")
                options = question.get("options", [])
                source_metadata = question.get("source_metadata", [])
            else:
                ref = learning_item.get("source_reference") or {}
                front = ref.get("question") or ref.get("question_text") or ref.get("front") or "Quiz Question"
                back = ref.get("correct_answer") or "Correct Answer"
        else:
            front = "Study Concept"
            back = "Concept Definition"

        return RevealedReviewContentResponse(
            review_id=review_id,
            session_id=review_item["session_id"],
            learning_item_id=learning_item["id"],
            content_type=content_type,
            content_id=content_id,
            front=front,
            options=options,
            source_metadata=source_metadata,
            order_index=review_item["order_index"],
            status="revealed",
            revealed=True,
            back=back,
            explanation=explanation
        )

    @classmethod
    def rate_item(
        cls,
        review_id: str,
        workspace_id: str,
        user_id: str,
        rating: Union[str, ReviewRatingEnum],
        review_time: Optional[datetime] = None
    ) -> RateReviewResponse:
        """
        Applies controlled rating to an active review item, updates FSRS state,
        logs immutable review event, and updates session counts atomically.
        """
        review_item = ReviewSessionItemRepository.get_by_id(review_id)
        if not review_item:
            raise NotFoundError(f"Review item '{review_id}' not found.")

        session = ReviewSessionRepository.get_by_id_and_workspace(
            session_id=review_item["session_id"],
            workspace_id=workspace_id,
            user_id=user_id
        )
        if not session:
            raise NotFoundError("Review session not found or unauthorized.")

        # Idempotency guard: prevent duplicate ratings
        if review_item["status"] == "completed":
            raise ConflictError(f"Review item '{review_id}' has already been completed.")

        if session["status"] != "active":
            raise ValidationError(f"Cannot rate review in a '{session['status']}' session.")

        # Validate rating
        rating_enum = ReviewRating.from_string(rating)
        eval_time = review_time or datetime.now(timezone.utc)
        eval_iso = eval_time.strftime("%Y-%m-%dT%H:%M:%SZ")

        with get_db() as conn:
            learning_item = LearningItemRepository.get_by_id(
                item_id=review_item["learning_item_id"],
                workspace_id=workspace_id,
                db_conn=conn
            )
            if not learning_item:
                raise NotFoundError("Learning item not found.")

            prev_state = learning_item.get("scheduling_metadata") or {}
            prev_due = learning_item.get("next_review_at")

            # Apply FSRS scheduler
            next_review_at, updated_metadata = default_scheduler.schedule(
                previous_correct_count=learning_item.get("correct_count", 0),
                previous_incorrect_count=learning_item.get("incorrect_count", 0),
                current_metadata=prev_state,
                rating=rating_enum,
                review_time=eval_time
            )
            next_review_iso = next_review_at.strftime("%Y-%m-%dT%H:%M:%SZ")

            is_correct = rating_enum in (ReviewRating.GOOD, ReviewRating.EASY)

            # Update learning progress
            LearningItemRepository.update_learning_progress(
                item_id=learning_item["id"],
                is_correct=is_correct,
                next_review_at=next_review_iso,
                scheduling_metadata=updated_metadata,
                db_conn=conn
            )

            # Record immutable review event
            event = ReviewEventRepository.create_event(
                workspace_id=workspace_id,
                user_id=user_id,
                content_type=learning_item["content_type"],
                content_id=learning_item["content_id"],
                result="correct" if is_correct else "incorrect",
                rating=rating_enum.value,
                previous_state=prev_state,
                new_state=updated_metadata,
                previous_due=prev_due,
                new_due=next_review_iso,
                source_type="review_session",
                source_id=session["id"],
                learning_item_id=learning_item["id"],
                session_id=session["id"],
                reviewed_at=eval_iso,
                db_conn=conn
            )

            # Mark item completed
            ReviewSessionItemRepository.mark_completed(
                item_id=review_id,
                rating=rating_enum.value,
                review_event_id=event["id"],
                reviewed_at=eval_iso,
                db_conn=conn
            )

            # Increment session count
            counts = ReviewSessionRepository.increment_reviewed_count(
                session_id=session["id"],
                db_conn=conn
            )

            session_status = "active"
            if counts["reviewed_items"] >= counts["total_items"]:
                ReviewSessionRepository.update_status(
                    session_id=session["id"],
                    status="completed",
                    completed_at=eval_iso,
                    db_conn=conn
                )
                session_status = "completed"

        return RateReviewResponse(
            review_id=review_id,
            session_id=session["id"],
            learning_item_id=learning_item["id"],
            rating=rating_enum.value,
            next_review_at=next_review_iso,
            stability=updated_metadata.get("stability"),
            difficulty=updated_metadata.get("difficulty"),
            state=updated_metadata.get("state", "review"),
            reviewed_items=counts["reviewed_items"],
            total_items=counts["total_items"],
            session_status=session_status
        )

    @classmethod
    def complete_session(
        cls,
        session_id: str,
        workspace_id: str,
        user_id: str
    ) -> ReviewSessionResponse:
        """
        Explicitly completes an active review session.
        """
        session = ReviewSessionRepository.get_by_id_and_workspace(
            session_id=session_id,
            workspace_id=workspace_id,
            user_id=user_id
        )
        if not session:
            raise NotFoundError(f"Review session '{session_id}' not found.")

        ReviewSessionRepository.update_status(session_id, "completed")
        return cls.get_session(session_id, workspace_id, user_id)

    @classmethod
    def abandon_session(
        cls,
        session_id: str,
        workspace_id: str,
        user_id: str
    ) -> ReviewSessionResponse:
        """
        Abandons a review session. Completed reviews are preserved; unreviewed items are not penalized.
        """
        session = ReviewSessionRepository.get_by_id_and_workspace(
            session_id=session_id,
            workspace_id=workspace_id,
            user_id=user_id
        )
        if not session:
            raise NotFoundError(f"Review session '{session_id}' not found.")

        ReviewSessionRepository.update_status(session_id, "abandoned")
        return cls.get_session(session_id, workspace_id, user_id)

    @classmethod
    def get_statistics(
        cls,
        workspace_id: str,
        user_id: str
    ) -> ReviewStatisticsResponse:
        """
        Retrieves high-level memory statistics and review performance.
        """
        stats = LearningItemRepository.get_statistics(workspace_id, user_id)
        return ReviewStatisticsResponse(
            due_count=stats["due_count"],
            overdue_count=stats["overdue_count"],
            reviewed_today=stats["reviewed_today"],
            correct_rate=stats["correct_rate"],
            total_items=stats["total_items"]
        )
