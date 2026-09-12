"""
Search, Retrieval, and Knowledge Hub Schemas for Recall AI API.
Defines contracts for hybrid search results, source citations,
related knowledge, and reindexing.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SearchResultItem(BaseModel):
    """A ranked knowledge retrieval result with source citation metadata."""
    chunk_id: str = Field(..., description="Unique ID of the matched chunk")
    document_id: str = Field(..., description="Parent document identifier")
    document_title: str = Field(..., description="Title of the source document")
    content: str = Field(..., description="Text content of the retrieved chunk")
    page_number: Optional[int] = Field(None, description="Page number where chunk appears")
    token_count: int = Field(..., description="Estimated token count of the chunk")
    score: float = Field(..., ge=0.0, le=1.0, description="Relevance score (0.0 to 1.0)")
    match_type: str = Field(..., description="Search mode that surfaced the match ('hybrid', 'semantic', 'keyword')")


class SearchResponse(BaseModel):
    """Normalized search query response container."""
    query: str = Field(..., description="Processed search query string")
    total_results: int = Field(..., description="Count of returned results")
    mode: str = Field(..., description="Search algorithm used ('hybrid', 'semantic', 'keyword')")
    results: List[SearchResultItem] = Field(default_factory=list, description="Ranked result items")


class RelatedDocumentItem(BaseModel):
    """A conceptually related document based on vector similarity."""
    document_id: str
    title: str
    similarity_score: float = Field(..., ge=0.0, le=1.0)
    snippet: Optional[str] = None


class RelatedDocumentsResponse(BaseModel):
    """Response container for related documents."""
    document_id: str
    total: int
    related_documents: List[RelatedDocumentItem] = Field(default_factory=list)


class ReindexResponse(BaseModel):
    """Response when a document re-indexing job is triggered."""
    document_id: str
    job_id: str
    status: str
    message: str


class StructuredContext(BaseModel):
    """Formatted prompt context ready for LLM consumption with token budget."""
    text: str = Field(..., description="Formatted markdown/xml citation block")
    sources: List[Dict[str, Any]] = Field(default_factory=list, description="Structured citation metadata")
    total_tokens: int = Field(..., description="Estimated token count of the structured context")
