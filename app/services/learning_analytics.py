"""
Learning Analytics & Progress Dashboard Service for Recall AI.
Coordinates read-only projections of learning activity, memory retention,
study workload, continuous-time study activity, and progress metrics.
Strictly read-only: never modifies scheduler state or debits AI credits.
"""

from datetime import datetime, timedelta, timezone
import logging
from typing import List, Optional, Tuple

from app.core.errors import ValidationError
from app.models.repositories import AnalyticsRepository
from app.schemas.analytics import (
    ConceptLearningProgress,
    DailyStudyActivity,
    DashboardSummaryResponse,
    DocumentLearningProgress,
    FlashcardPerformanceStats,
    QuizPerformanceStats,
    ReviewDetailedStats,
    StudyActivityResponse,
    StudySessionSummary,
)

logger = logging.getLogger(__name__)


class LearningAnalyticsService:
    """
    Dedicated read-model projection service for learning analytics.
    Observes learning engine activity without controlling or mutating it.
    """

    @classmethod
    def get_dashboard(cls, workspace_id: str, user_id: str) -> DashboardSummaryResponse:
        """
        Calculates top-level dashboard metrics across review workload, FSRS states,
        today's completions, quiz attempts, and flashcards.
        """
        raw = AnalyticsRepository.get_dashboard_summary(workspace_id, user_id)
        return DashboardSummaryResponse(**raw)

    @classmethod
    def get_review_statistics(cls, workspace_id: str, user_id: str) -> ReviewDetailedStats:
        """
        Retrieves detailed spaced-repetition statistics, rating distributions,
        and daily averages.
        """
        raw = AnalyticsRepository.get_review_detailed_statistics(workspace_id, user_id)
        return ReviewDetailedStats(**raw)

    @classmethod
    def get_quiz_statistics(cls, workspace_id: str, user_id: str) -> QuizPerformanceStats:
        """
        Retrieves granular assessment and quiz attempt metrics.
        """
        raw = AnalyticsRepository.get_quiz_performance_statistics(workspace_id, user_id)
        return QuizPerformanceStats(**raw)

    @classmethod
    def get_flashcard_statistics(cls, workspace_id: str, user_id: str) -> FlashcardPerformanceStats:
        """
        Retrieves flashcard volume and mastery metrics.
        """
        raw = AnalyticsRepository.get_flashcard_performance_statistics(workspace_id, user_id)
        return FlashcardPerformanceStats(**raw)

    @classmethod
    def get_activity(
        cls,
        workspace_id: str,
        user_id: str,
        range_type: str = "7d",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> StudyActivityResponse:
        """
        Builds a continuous daily time series of study activity over the requested window.
        Guarantees zero-fill for days with no activity so frontend charts do not have missing dates.
        """
        start_dt, end_dt, date_keys = cls._parse_time_range(
            range_type=range_type,
            start_date=start_date,
            end_date=end_date
        )

        start_iso = start_dt.strftime("%Y-%m-%dT00:00:00Z")
        end_iso = end_dt.strftime("%Y-%m-%dT23:59:59Z")

        raw_activity = AnalyticsRepository.get_study_activity_timeseries(
            workspace_id=workspace_id,
            user_id=user_id,
            start_iso=start_iso,
            end_iso=end_iso
        )

        daily_list: List[DailyStudyActivity] = []
        total_active_days = 0
        total_reviews = 0
        total_quizzes = 0

        for d_str in date_keys:
            act = raw_activity.get(d_str, {
                "reviews_count": 0,
                "quiz_attempts_count": 0,
                "correct_answers": 0,
                "incorrect_answers": 0
            })
            r_cnt = act.get("reviews_count", 0)
            q_cnt = act.get("quiz_attempts_count", 0)
            c_cnt = act.get("correct_answers", 0)
            i_cnt = act.get("incorrect_answers", 0)

            if r_cnt > 0 or q_cnt > 0:
                total_active_days += 1
            total_reviews += r_cnt
            total_quizzes += q_cnt

            daily_list.append(
                DailyStudyActivity(
                    date=d_str,
                    reviews_count=r_cnt,
                    quiz_attempts_count=q_cnt,
                    correct_answers=c_cnt,
                    incorrect_answers=i_cnt
                )
            )

        return StudyActivityResponse(
            range=range_type,
            start_date=date_keys[0] if date_keys else start_dt.strftime("%Y-%m-%d"),
            end_date=date_keys[-1] if date_keys else end_dt.strftime("%Y-%m-%d"),
            total_active_days=total_active_days,
            total_reviews=total_reviews,
            total_quiz_attempts=total_quizzes,
            activity=daily_list
        )

    @classmethod
    def get_document_progress(
        cls,
        workspace_id: str,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[DocumentLearningProgress]:
        """
        Retrieves learning progress breakdown per document in the workspace.
        """
        raw_list = AnalyticsRepository.get_document_learning_progress(
            workspace_id=workspace_id,
            user_id=user_id,
            limit=limit,
            offset=offset
        )
        return [DocumentLearningProgress(**item) for item in raw_list]

    @classmethod
    def get_concept_progress(
        cls,
        workspace_id: str,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[ConceptLearningProgress]:
        """
        Retrieves learning progress breakdown across atomic concepts/topics.
        """
        raw_list = AnalyticsRepository.get_concept_learning_progress(
            workspace_id=workspace_id,
            user_id=user_id,
            limit=limit,
            offset=offset
        )
        return [ConceptLearningProgress(**item) for item in raw_list]

    @classmethod
    def get_study_sessions(
        cls,
        workspace_id: str,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
        status: Optional[str] = None
    ) -> List[StudySessionSummary]:
        """
        Retrieves historical study review sessions with durations and rating breakdowns.
        """
        raw_list = AnalyticsRepository.get_study_sessions_history(
            workspace_id=workspace_id,
            user_id=user_id,
            limit=limit,
            offset=offset,
            status=status
        )
        return [StudySessionSummary(**item) for item in raw_list]

    @staticmethod
    def _parse_time_range(
        range_type: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Tuple[datetime, datetime, List[str]]:
        """
        Centralized date utility validating range type and building an inclusive,
        continuous date list in UTC.
        """
        now = datetime.now(timezone.utc)
        today = now.date()

        if range_type == "7d":
            start_d = today - timedelta(days=6)
            end_d = today
        elif range_type == "30d":
            start_d = today - timedelta(days=29)
            end_d = today
        elif range_type == "90d":
            start_d = today - timedelta(days=89)
            end_d = today
        elif range_type == "custom":
            if not start_date or not end_date:
                raise ValidationError("Custom time range requires both 'start_date' and 'end_date' (YYYY-MM-DD).")
            try:
                start_d = datetime.strptime(start_date.strip(), "%Y-%m-%d").date()
                end_d = datetime.strptime(end_date.strip(), "%Y-%m-%d").date()
            except ValueError:
                raise ValidationError("Dates must be in 'YYYY-MM-DD' format.")

            if start_d > end_d:
                raise ValidationError("'start_date' cannot be later than 'end_date'.")

            # Cap custom range to 365 days max to guard against excessive query ranges
            if (end_d - start_d).days > 365:
                raise ValidationError("Custom date range cannot exceed 365 days.")
        else:
            raise ValidationError(f"Unsupported time range '{range_type}'. Supported: '7d', '30d', '90d', 'custom'.")

        # Generate continuous list of dates
        date_keys: List[str] = []
        cur_d = start_d
        while cur_d <= end_d:
            date_keys.append(cur_d.strftime("%Y-%m-%d"))
            cur_d += timedelta(days=1)

        start_dt = datetime(start_d.year, start_d.month, start_d.day, 0, 0, 0, tzinfo=timezone.utc)
        end_dt = datetime(end_d.year, end_d.month, end_d.day, 23, 59, 59, tzinfo=timezone.utc)

        return start_dt, end_dt, date_keys
