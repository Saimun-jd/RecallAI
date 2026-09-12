"""
Pydantic Schemas for Knowledge Hub & RAG Chat System.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ConversationCreateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=150, description="Optional custom title for the conversation")


class ConversationUpdateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=150, description="New title for the conversation")


class ConversationResponse(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    title: str
    created_at: str
    updated_at: str


class SourceCitation(BaseModel):
    source_index: int = Field(description="1-based index corresponding to [S1], [S2] tags in the response")
    document_id: str
    document_title: str
    chunk_id: str
    page_number: Optional[int] = None
    score: Optional[float] = None


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    sources: List[SourceCitation] = []
    token_count: int = 0
    created_at: str


class ConversationDetailResponse(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    title: str
    created_at: str
    updated_at: str
    messages: List[MessageResponse] = []


class ConversationListResponse(BaseModel):
    conversations: List[ConversationResponse]
    total: int


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=10000, description="User query or message")
    document_id: Optional[str] = Field(default=None, description="Optional document filter for scoped RAG")
    provider: Optional[str] = Field(default=None, description="Provider override (e.g. openai, gemini, groq, ollama)")
    stream: bool = Field(default=False, description="Whether to stream response tokens via Server-Sent Events (SSE)")


class RAGResponse(BaseModel):
    message: MessageResponse
    conversation_title: str
    credits_remaining: Optional[int] = None
    is_byok: bool = False
    provider: str = ""
    model: str = ""
