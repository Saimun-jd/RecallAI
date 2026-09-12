"""
Pydantic Schemas for Quiz Attempts, Scoring, and Learning Progress.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MaskedQuizQuestionResponse(BaseModel):
    """
    Quiz question representation for active attempts.
    STRICTLY hides correct_answer, explanation, and source_metadata to prevent answer leaks.
    """
    id: str
    type: str
    question: str
    options: List[str] = []
    position: int = 0


class QuizAttemptStartResponse(BaseModel):
    id: str
    quiz_id: str
    status: str
    started_at: str
    total_questions: int
    questions: List[MaskedQuizQuestionResponse] = []


class SubmitAnswerItem(BaseModel):
    question_id: str
    selected_answer: str = Field(description="Selected option index (e.g. '0') or 'true'/'false'")


class SubmitAnswersRequest(BaseModel):
    answers: List[SubmitAnswerItem] = Field(default=[], description="List of submitted question answers")


class QuestionEvaluationResult(BaseModel):
    """
    Detailed question evaluation returned after attempt submission.
    """
    question_id: str
    type: str
    question: str
    options: List[str] = []
    selected_answer: str
    correct_answer: str
    is_correct: bool
    explanation: str
    source_metadata: List[Dict[str, Any]] = []


class QuizAttemptResultResponse(BaseModel):
    id: str
    quiz_id: str
    status: str
    started_at: str
    submitted_at: Optional[str] = None
    score: float
    percentage: float
    total_questions: int
    correct_answers: int
    incorrect_answers: int
    unanswered: int
    duration_seconds: Optional[int] = None
    question_results: List[QuestionEvaluationResult] = []


class QuizAttemptSummaryResponse(BaseModel):
    id: str
    quiz_id: str
    status: str
    started_at: str
    submitted_at: Optional[str] = None
    score: float
    percentage: float
    total_questions: int
    correct_answers: int


class LearningProgressSummaryResponse(BaseModel):
    total_items: int
    reviewed_items: int
    correct_rate: float
    due_items_count: int


class LearningItemResponse(BaseModel):
    id: str
    content_type: str
    content_id: str
    source_reference: Dict[str, Any] = {}
    correct_count: int = 0
    incorrect_count: int = 0
    last_seen_at: Optional[str] = None
    next_review_at: Optional[str] = None
