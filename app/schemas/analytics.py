"""
Learning Analytics & Progress Dashboard Schemas for Recall AI.
Defines explicit read-only projection schemas for dashboard overviews,
study activity time series, detailed performance breakdowns, and progress tracking.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class ReviewWorkloadStats(BaseModel):
    """Current spaced-repetition review workload."""
    due: int = Field(0, description="Items due for review now or in the past")
    overdue: int = Field(0, description="Items overdue by more than 24 hours")
    new: int = Field(0, description="New items not yet reviewed")
    total_active: int = Field(0, description="Total learning items in workspace")


class LearningStateDistribution(BaseModel):
    """Distribution of knowledge items across authoritative FSRS memory states."""
    total: int = Field(0, description="Total active items tracked")
    by_state: Dict[str, int] = Field(
        default_factory=lambda: {"new": 0, "learning": 0, "review": 0, "relearning": 0},
        description="Item counts by FSRS state (new, learning, review, relearning)"
    )


class TodayActivityStats(BaseModel):
    """Activity completed in the current calendar day."""
    reviews_completed: int = Field(0, description="Spaced-repetition reviews completed today")
    quiz_attempts: int = Field(0, description="Quiz attempts submitted today")


class QuizPerformanceStats(BaseModel):
    """Aggregate performance across all assessment attempts."""
    total_attempts: int = Field(0, description="Total quiz attempts initiated")
    completed_attempts: int = Field(0, description="Attempts completed and submitted")
    average_score: Optional[float] = Field(None, description="Average percentage score on submitted attempts (null if 0 attempts)")
    highest_score: Optional[float] = Field(None, description="Highest percentage score achieved")
    lowest_score: Optional[float] = Field(None, description="Lowest percentage score achieved")
    questions_answered: int = Field(0, description="Total individual questions answered")
    correct_answers: int = Field(0, description="Total questions answered correctly")
    incorrect_answers: int = Field(0, description="Total questions answered incorrectly")
    accuracy_rate: Optional[float] = Field(None, description="Overall answer accuracy percentage (null if 0 answered)")


class FlashcardPerformanceStats(BaseModel):
    """Aggregate learning progress across flashcards."""
    total_cards: int = Field(0, description="Total flashcards created in workspace")
    active_cards: int = Field(0, description="Cards registered as learning items")
    cards_reviewed: int = Field(0, description="Cards reviewed at least once")
    cards_due: int = Field(0, description="Cards currently due for review")
    cards_in_review_state: int = Field(0, description="Cards graduated to FSRS review/mastery state")


class RatingDistributionItem(BaseModel):
    """Itemized rating count and percentage."""
    rating: str = Field(..., description="Rating identifier (again, hard, good, easy)")
    count: int = Field(0, description="Number of times rating was selected")
    percentage: float = Field(0.0, description="Percentage of total ratings")


class ReviewDetailedStats(BaseModel):
    """Comprehensive spaced-repetition statistics and rating breakdown."""
    workload: ReviewWorkloadStats = Field(..., description="Current review workload")
    total_reviews: int = Field(0, description="Lifetime review interactions logged")
    reviewed_today: int = Field(0, description="Reviews completed in the last 24 hours")
    correct_rate: float = Field(0.0, description="Overall percentage of successful reviews")
    ratings: Dict[str, RatingDistributionItem] = Field(
        default_factory=dict,
        description="Breakdown of reviews by FSRS rating (again, hard, good, easy)"
    )
    average_reviews_per_active_day: float = Field(0.0, description="Average reviews on days with study activity")


class DashboardSummaryResponse(BaseModel):
    """High-level learning dashboard overview."""
    review_workload: ReviewWorkloadStats = Field(..., description="Current review queue workload")
    learning_states: LearningStateDistribution = Field(..., description="FSRS state distribution")
    today: TodayActivityStats = Field(..., description="Today's study completions")
    quizzes: QuizPerformanceStats = Field(..., description="Overall quiz assessment metrics")
    flashcards: FlashcardPerformanceStats = Field(..., description="Overall flashcard learning metrics")


class DailyStudyActivity(BaseModel):
    """Daily study activity entry for a single calendar date."""
    date: str = Field(..., description="Calendar date in YYYY-MM-DD format")
    reviews_count: int = Field(0, description="Number of reviews completed on this date")
    quiz_attempts_count: int = Field(0, description="Number of quizzes submitted on this date")
    correct_answers: int = Field(0, description="Correct responses on this date")
    incorrect_answers: int = Field(0, description="Incorrect responses on this date")


class StudyActivityResponse(BaseModel):
    """Continuous time series of study activity over a requested period."""
    range: str = Field(..., description="Requested time range (7d, 30d, 90d, custom)")
    start_date: str = Field(..., description="Start date of period (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date of period (YYYY-MM-DD)")
    total_active_days: int = Field(0, description="Days with at least one review or quiz submission")
    total_reviews: int = Field(0, description="Total reviews in the period")
    total_quiz_attempts: int = Field(0, description="Total quiz attempts in the period")
    activity: List[DailyStudyActivity] = Field(
        default_factory=list,
        description="Continuous list of daily activities (including 0-activity days)"
    )


class DocumentLearningProgress(BaseModel):
    """Learning progress metrics associated with a single document."""
    document_id: str = Field(..., description="Unique document ID")
    title: str = Field(..., description="Document title")
    total_learning_items: int = Field(0, description="Total learning items linked to document")
    new_items: int = Field(0, description="Items not yet reviewed")
    learning_items: int = Field(0, description="Items in FSRS learning/relearning state")
    review_items: int = Field(0, description="Items graduated to FSRS review state")
    due_items: int = Field(0, description="Items currently due for review")
    correct_rate: float = Field(0.0, description="Correct retention percentage on this document's items")


class ConceptLearningProgress(BaseModel):
    """Learning progress metrics associated with a knowledge concept/topic."""
    concept: str = Field(..., description="Concept or topic name")
    total_learning_items: int = Field(0, description="Total learning items covering this concept")
    new_items: int = Field(0, description="Items not yet reviewed")
    learning_items: int = Field(0, description="Items in learning state")
    review_items: int = Field(0, description="Items in review state")
    due_items: int = Field(0, description="Items currently due")
    correct_rate: float = Field(0.0, description="Correct retention percentage")


class StudySessionSummary(BaseModel):
    """Historical study session summary with completion details."""
    id: str = Field(..., description="Review session ID")
    status: str = Field(..., description="Session status (active, completed, abandoned)")
    started_at: str = Field(..., description="Session start ISO timestamp")
    completed_at: Optional[str] = Field(None, description="Session completion ISO timestamp")
    duration_seconds: Optional[int] = Field(None, description="Session duration in seconds (if completed)")
    total_items: int = Field(0, description="Total items queued in session")
    reviewed_items: int = Field(0, description="Number of items reviewed")
    rating_distribution: Dict[str, int] = Field(
        default_factory=dict,
        description="Counts of ratings given in this session (again, hard, good, easy)"
    )
