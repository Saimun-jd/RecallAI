"""
Pydantic Schemas for AI-Powered Quiz & Assessment Backend.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class QuizGenerateRequest(BaseModel):
    document_ids: Optional[List[str]] = Field(default=None, description="Optional document IDs to scope generation")
    title: Optional[str] = Field(default=None, max_length=150, description="Optional custom title for the quiz")
    topic: Optional[str] = Field(default=None, max_length=200, description="Optional conceptual focus area or topic")
    question_count: int = Field(default=10, ge=1, le=50, description="Target number of questions to generate (1-50)")
    question_types: List[str] = Field(
        default=["multiple_choice", "true_false"],
        description="Allowed question types: 'multiple_choice', 'true_false'"
    )
    difficulty: str = Field(
        default="medium",
        description="Target difficulty: 'easy', 'medium', or 'hard'"
    )
    provider: Optional[str] = Field(default=None, description="Optional provider override (openai, gemini, groq, ollama)")


class QuizQuestionResponse(BaseModel):
    id: str
    quiz_id: str
    type: str
    question: str
    options: List[str] = []
    correct_answer: str
    explanation: str
    source_metadata: List[Dict[str, Any]] = []
    position: int = 0
    created_at: str
    updated_at: str


class QuizQuestionUpdateRequest(BaseModel):
    question: Optional[str] = Field(default=None, min_length=5, max_length=1000, description="Updated question text")
    options: Optional[List[str]] = Field(default=None, description="Updated options list for multiple choice")
    correct_answer: Optional[str] = Field(default=None, min_length=1, max_length=200, description="Updated correct answer")
    explanation: Optional[str] = Field(default=None, min_length=5, max_length=2000, description="Updated explanation")
    position: Optional[int] = Field(default=None, ge=0, description="Updated zero-based index")


class QuizResponse(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    title: str
    description: Optional[str] = None
    source_document_ids: List[str] = []
    question_count: int = 0
    difficulty: str = "medium"
    created_at: str
    updated_at: str


class QuizDetailResponse(QuizResponse):
    questions: List[QuizQuestionResponse] = []


class QuizUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=150, description="Updated quiz title")
    description: Optional[str] = Field(default=None, max_length=1000, description="Updated quiz description")


class QuizListResponse(BaseModel):
    quizzes: List[QuizResponse]
    total: int
