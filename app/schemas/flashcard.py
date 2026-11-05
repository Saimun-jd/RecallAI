"""
Pydantic Schemas for AI-Powered Flashcard & Study Material Generation.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class FlashcardGenerateRequest(BaseModel):
    document_ids: Optional[List[str]] = Field(default=None, description="Optional document IDs to scope generation")
    title: Optional[str] = Field(default=None, max_length=150, description="Optional custom title for the set")
    topic: Optional[str] = Field(default=None, max_length=200, description="Optional conceptual focus area or query")
    count: int = Field(default=10, ge=1, le=50, description="Target number of flashcards to generate (1-50)")
    provider: Optional[str] = Field(default=None, description="Optional provider override (openai, gemini, groq, ollama)")


class FlashcardResponse(BaseModel):
    id: str
    flashcard_set_id: str
    front: str
    back: str
    source_metadata: List[Dict[str, Any]] = []
    position: int = 0
    created_at: str
    updated_at: str


class FlashcardUpdateRequest(BaseModel):
    front: Optional[str] = Field(default=None, min_length=1, max_length=1000, description="Updated prompt/question")
    back: Optional[str] = Field(default=None, min_length=1, max_length=3000, description="Updated explanation/answer")
    position: Optional[int] = Field(default=None, ge=0, description="Updated zero-based index")


class FlashcardSetResponse(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    title: str
    description: Optional[str] = None
    source_document_ids: List[str] = []
    card_count: int = 0
    created_at: str
    updated_at: str


class FlashcardSetDetailResponse(FlashcardSetResponse):
    cards: List[FlashcardResponse] = []


class FlashcardSetUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=150, description="Updated title")
    description: Optional[str] = Field(default=None, max_length=1000, description="Updated description")


class FlashcardSetListResponse(BaseModel):
    sets: List[FlashcardSetResponse]
    total: int
