"""
Spaced Repetition Scheduler Abstraction and FSRS Engine for Recall AI.
Provides the pluggable ReviewScheduler interface and implements the production
FSRS (Free Spaced Repetition Scheduler, v6.3.2) algorithm alongside the graduated
interval scheduler.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from enum import Enum
import logging
from typing import Any, Dict, Optional, Tuple, Union

try:
    from fsrs import Card as FSRSCard, Rating as FSRSRating, Scheduler as FSRSLibScheduler, State as FSRSState
    FSRS_AVAILABLE = True
except ImportError:
    FSRS_AVAILABLE = False

logger = logging.getLogger(__name__)


class ReviewRating(str, Enum):
    """
    Controlled 4-grade rating vocabulary for spaced repetition reviews.
    """
    AGAIN = "again"
    HARD = "hard"
    GOOD = "good"
    EASY = "easy"

    @classmethod
    def from_string(cls, val: Any) -> "ReviewRating":
        """
        Normalizes string, boolean, or enum representations into a controlled ReviewRating.
        """
        if isinstance(val, ReviewRating):
            return val
        if hasattr(val, "value"):
            val = val.value
        val_lower = str(val).lower().strip()
        if val_lower in ("again", "1", "false", "incorrect"):
            return cls.AGAIN
        if val_lower in ("hard", "2"):
            return cls.HARD
        if val_lower in ("good", "3", "true", "correct"):
            return cls.GOOD
        if val_lower in ("easy", "4"):
            return cls.EASY
        raise ValueError(f"Invalid review rating: '{val}'. Must be one of 'again', 'hard', 'good', 'easy'.")


class ReviewScheduler(ABC):
    """
    Abstract interface for spaced repetition scheduling algorithms.
    Decouples core review scheduling from UI, database routes, and content types.
    """

    @abstractmethod
    def schedule(
        self,
        previous_correct_count: int = 0,
        previous_incorrect_count: int = 0,
        is_correct: Optional[bool] = None,
        last_seen_at: Optional[datetime] = None,
        current_metadata: Optional[Dict[str, Any]] = None,
        rating: Optional[Union[str, ReviewRating]] = None,
        review_time: Optional[datetime] = None
    ) -> Tuple[datetime, Dict[str, Any]]:
        """
        Calculates the next review timestamp and updated scheduling metadata.
        
        Args:
            previous_correct_count: Cumulative correct answers.
            previous_incorrect_count: Cumulative incorrect answers.
            is_correct: Optional boolean for binary assessments (True -> Good, False -> Again).
            last_seen_at: Timestamp of the previous review (if any).
            current_metadata: Algorithm-specific state parameters.
            rating: Controlled 4-grade rating ('again', 'hard', 'good', 'easy').
            review_time: Explicit evaluation timestamp for test determinism.

        Returns:
            Tuple of (next_review_at, updated_metadata).
        """
        pass


class FSRSScheduler(ReviewScheduler):
    """
    Production implementation of the Free Spaced Repetition Scheduler (FSRS v6).
    Employs the 4-grade rating vocabulary (again, hard, good, easy) to compute
    continuous memory stability, difficulty, state transitions, and optimal review intervals.
    """

    def __init__(
        self,
        desired_retention: float = 0.9,
        maximum_interval: int = 36500,
        enable_fuzzing: bool = False
    ):
        if not FSRS_AVAILABLE:
            raise RuntimeError("The 'fsrs' library is required for FSRSScheduler but is not installed.")
        self._fsrs = FSRSLibScheduler(
            desired_retention=desired_retention,
            maximum_interval=maximum_interval,
            enable_fuzzing=enable_fuzzing
        )
        self._rating_map = {
            ReviewRating.AGAIN: FSRSRating.Again,
            ReviewRating.HARD: FSRSRating.Hard,
            ReviewRating.GOOD: FSRSRating.Good,
            ReviewRating.EASY: FSRSRating.Easy,
        }

    @classmethod
    def init_card_metadata(cls) -> Dict[str, Any]:
        """
        Generates initial FSRS scheduling metadata for newly created learning items.
        """
        if not FSRS_AVAILABLE:
            return {"scheduler_type": "graduated_interval"}
        card = FSRSCard()
        return {
            "fsrs_card": card.to_dict(),
            "state": "new",
            "stability": None,
            "difficulty": None,
            "step": 0,
            "reps": 0,
            "lapses": 0,
            "scheduler_type": "fsrs_v6"
        }

    def schedule(
        self,
        previous_correct_count: int = 0,
        previous_incorrect_count: int = 0,
        is_correct: Optional[bool] = None,
        last_seen_at: Optional[datetime] = None,
        current_metadata: Optional[Dict[str, Any]] = None,
        rating: Optional[Union[str, ReviewRating]] = None,
        review_time: Optional[datetime] = None
    ) -> Tuple[datetime, Dict[str, Any]]:
        # 1. Determine evaluation timestamp (preserve deterministic test timestamps)
        eval_time = review_time or datetime.now(timezone.utc)
        if eval_time.tzinfo is None:
            eval_time = eval_time.replace(tzinfo=timezone.utc)

        # 2. Resolve rating
        if rating is not None:
            rating_enum = ReviewRating.from_string(rating)
        elif is_correct is not None:
            rating_enum = ReviewRating.GOOD if is_correct else ReviewRating.AGAIN
        else:
            rating_enum = ReviewRating.GOOD

        fsrs_rating = self._rating_map[rating_enum]

        # 3. Restore or initialize FSRS Card
        meta = dict(current_metadata or {})
        card_data = meta.get("fsrs_card")
        if card_data and isinstance(card_data, dict):
            try:
                card = FSRSCard.from_dict(card_data)
            except Exception as e:
                logger.warning("Failed to restore FSRS card from dict: %s. Reinitializing.", e)
                card = FSRSCard()
        else:
            card = FSRSCard()

        # 4. Apply FSRS review calculation
        updated_card, review_log = self._fsrs.review_card(card, fsrs_rating, eval_time)

        # 5. Extract next review timestamp and interval
        next_review_at = updated_card.due
        if next_review_at.tzinfo is None:
            next_review_at = next_review_at.replace(tzinfo=timezone.utc)

        interval_seconds = max(0.0, (next_review_at - eval_time).total_seconds())
        scheduled_days = round(interval_seconds / 86400.0, 2)

        # 6. Map FSRS state representation
        state_name_map = {
            FSRSState.Learning: "learning",
            FSRSState.Review: "review",
            FSRSState.Relearning: "relearning",
        }
        state_name = state_name_map.get(updated_card.state, "learning")

        # 7. Update scheduling metadata
        meta["fsrs_card"] = updated_card.to_dict()
        meta["state"] = state_name
        meta["step"] = updated_card.step
        meta["stability"] = round(updated_card.stability, 4) if updated_card.stability is not None else None
        meta["difficulty"] = round(updated_card.difficulty, 4) if updated_card.difficulty is not None else None
        meta["reps"] = meta.get("reps", 0) + 1
        if rating_enum == ReviewRating.AGAIN:
            meta["lapses"] = meta.get("lapses", 0) + 1
        else:
            meta["lapses"] = meta.get("lapses", 0)

        meta["last_rating"] = rating_enum.value
        meta["last_review_at"] = eval_time.strftime("%Y-%m-%dT%H:%M:%SZ")
        meta["scheduled_days"] = scheduled_days
        meta["scheduler_type"] = "fsrs_v6"

        return next_review_at, meta


class GraduatedIntervalScheduler(ReviewScheduler):
    """
    Configurable graduated interval scheduler.
    Expands review intervals upon consecutive correct answers and resets on lapses.
    Maintained for baseline testing and environments without FSRS.
    """
    # Interval schedule in days based on consecutive streak: 1d -> 3d -> 7d -> 14d -> 30d -> 60d
    INTERVAL_STAGES = [1, 3, 7, 14, 30, 60]

    def schedule(
        self,
        previous_correct_count: int = 0,
        previous_incorrect_count: int = 0,
        is_correct: Optional[bool] = None,
        last_seen_at: Optional[datetime] = None,
        current_metadata: Optional[Dict[str, Any]] = None,
        rating: Optional[Union[str, ReviewRating]] = None,
        review_time: Optional[datetime] = None
    ) -> Tuple[datetime, Dict[str, Any]]:
        now = review_time or datetime.now(timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        meta = dict(current_metadata or {})
        current_streak = meta.get("consecutive_correct", 0)

        # Resolve correctness from rating or boolean
        if rating is not None:
            rating_enum = ReviewRating.from_string(rating)
            correct = rating_enum in (ReviewRating.GOOD, ReviewRating.EASY)
        elif is_correct is not None:
            correct = is_correct
            rating_enum = ReviewRating.GOOD if is_correct else ReviewRating.AGAIN
        else:
            correct = True
            rating_enum = ReviewRating.GOOD

        if correct:
            new_streak = current_streak + 1
            stage_idx = min(new_streak - 1, len(self.INTERVAL_STAGES) - 1)
            days = self.INTERVAL_STAGES[stage_idx]
            meta["consecutive_correct"] = new_streak
            meta["last_interval_days"] = days
            meta["lapse_count"] = meta.get("lapse_count", 0)
        else:
            new_streak = 0
            days = 1  # Reset to 1 day on lapse
            meta["consecutive_correct"] = 0
            meta["last_interval_days"] = days
            meta["lapse_count"] = meta.get("lapse_count", 0) + 1

        next_review_at = now + timedelta(days=days)
        meta["scheduled_days"] = days
        meta["last_rating"] = rating_enum.value
        meta["scheduler_type"] = "graduated_interval"

        return next_review_at, meta


# Global default scheduler instance: production FSRS v6 (deterministic fuzzing=False)
default_scheduler: ReviewScheduler = FSRSScheduler(enable_fuzzing=False) if FSRS_AVAILABLE else GraduatedIntervalScheduler()
