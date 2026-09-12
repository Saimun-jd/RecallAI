"""
Document and Ingestion Schemas for Recall AI API.
Defines contracts for upload, processing status, document detail, and chunks.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DocumentUploadResponse(BaseModel):
    """Returned immediately after successful file upload and job creation."""
    document_id: str = Field(..., description="Unique ID of created document")
    job_id: str = Field(..., description="Unique ID of background processing job")
    status: str = Field(..., description="Current status of the document (uploading/processing)")
    filename: str = Field(..., description="Original filename uploaded")
    size_bytes: int = Field(..., description="Size of uploaded file in bytes")


class DocumentDetailResponse(BaseModel):
    """Full detail view of an ingested document."""
    id: str
    workspace_id: str
    file_id: Optional[str] = None
    title: str
    source_type: str
    total_pages: int
    status: str
    processing_error: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str


class DocumentStatusResponse(BaseModel):
    """Live processing status and stage progress."""
    document_id: str
    status: str
    current_stage: Optional[str] = None
    stage_progress: int = 0
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    attempt_count: int = 0
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class ChunkItemResponse(BaseModel):
    """A single semantic text chunk from an indexed document."""
    id: str
    document_id: str
    chunk_index: int
    content: str
    page_number: Optional[int] = None
    token_count: int
    embedding_model: str = "text-embedding-3-small"
    embedding_version: int = 1
    created_at: str


class ChunkListResponse(BaseModel):
    """Paginated list of document chunks."""
    total: int
    limit: int
    offset: int
    chunks: List[ChunkItemResponse]


class DocumentListResponse(BaseModel):
    """Paginated list of workspace documents."""
    total: int
    limit: int
    offset: int
    documents: List[DocumentDetailResponse]
