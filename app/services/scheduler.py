"""
Spaced Repetition Scheduler Abstraction for Recall AI.
Defines a pluggable interface for scheduling reviews and an initial graduated interval scheduler.
Ready for future drop-in FSRS/SM-2 replacements without altering application or route code.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple


class ReviewScheduler(ABC):
    """
    Abstract interface for spaced repetition scheduling algorithms.
    """
    @abstractmethod
    def schedule(
        self,
        previous_correct_count: int,
        previous_incorrect_count: int,
        is_correct: bool,
        last_seen_at: Optional[datetime] = None,
        current_metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[datetime, Dict[str, Any]]:
        """
        Calculates the next review timestamp and updated scheduling metadata.
        
        Args:
            previous_correct_count: Number of times answered correctly in the past.
            previous_incorrect_count: Number of times answered incorrectly in the past.
            is_correct: Whether the current review/assessment was answered correctly.
            last_seen_at: Timestamp of the previous review (if any).
            current_metadata: Current algorithm-specific parameters (e.g. interval, stability).

        Returns:
            Tuple of (next_review_at, updated_metadata).
        """
        pass


class GraduatedIntervalScheduler(ReviewScheduler):
    """
    Configurable graduated interval scheduler.
    Expands review intervals upon consecutive correct answers and resets on lapses.
    Serves as the foundation before full FSRS/SM-2 activation.
    """
    # Interval schedule in days based on consecutive streak: 1d -> 3d -> 7d -> 14d -> 30d -> 60d
    INTERVAL_STAGES = [1, 3, 7, 14, 30, 60]

    def schedule(
        self,
        previous_correct_count: int,
        previous_incorrect_count: int,
        is_correct: bool,
        last_seen_at: Optional[datetime] = None,
        current_metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[datetime, Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        meta = dict(current_metadata or {})

        current_streak = meta.get("consecutive_correct", 0)

        if is_correct:
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
        meta["scheduler_type"] = "graduated_interval"

        return next_review_at, meta


# Global default scheduler instance
default_scheduler: ReviewScheduler = GraduatedIntervalScheduler()
