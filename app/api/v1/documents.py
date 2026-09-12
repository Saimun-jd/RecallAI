"""
Document Ingestion and Management API for Recall AI.
Handles secure file uploads, asynchronous processing orchestration,
status polling, chunk retrieval, and cascading deletion.
"""

import os
import uuid
import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, File, Query, UploadFile, status

from app.api.deps import get_current_user, get_current_workspace, require_document_owner
from app.core.errors import ValidationError, PayloadTooLargeError
from app.models.repositories import (
    DocumentRepository,
    FileRepository,
    ChunkRepository,
    ProcessingJobRepository,
)
from app.schemas.common import ResponseEnvelope
from app.schemas.document import (
    DocumentUploadResponse,
    DocumentDetailResponse,
    DocumentStatusResponse,
    ChunkListResponse,
    ChunkItemResponse,
    DocumentListResponse,
)
from app.services.storage import StorageService
from app.services.extractor import ExtractionService, ExtractionError
from app.services.pipeline import DocumentProcessingPipeline
from app.services.knowledge import RelatedKnowledgeService, ReindexingService
from app.schemas.search import RelatedDocumentsResponse, ReindexResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])

# Size constraints
MAX_PDF_BYTES = 50 * 1024 * 1024      # 50 MB
MAX_TEXT_BYTES = 10 * 1024 * 1024     # 10 MB


@router.post(
    "/upload",
    response_model=ResponseEnvelope[DocumentUploadResponse],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload learning material for AI processing"
)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Document file (.pdf, .txt, .md)"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[DocumentUploadResponse]:
    """
    Ingests and securely stores a learning document.
    Enqueues asynchronous background processing (extraction, normalization, chunking, embedding).
    """
    raw_filename = file.filename or "uploaded_document"
    filename = os.path.basename(raw_filename).strip()
    if not filename:
        raise ValidationError("Invalid filename.")

    content = await file.read()
    if not content or len(content) == 0:
        raise ValidationError("Uploaded file is empty (0 bytes).")

    ext = os.path.splitext(filename.lower())[1]
    mime = (file.content_type or "").lower()

    # Determine source type and size bounds
    if ext == ".pdf" or mime == "application/pdf":
        source_type = "pdf"
        if len(content) > MAX_PDF_BYTES:
            raise PayloadTooLargeError(
                f"PDF file size ({len(content) / (1024*1024):.1f}MB) exceeds maximum limit of 50MB."
            )
    elif ext in [".md", ".markdown"] or mime in ["text/markdown", "text/x-markdown"]:
        source_type = "markdown"
        if len(content) > MAX_TEXT_BYTES:
            raise PayloadTooLargeError(
                f"Markdown file size ({len(content) / (1024*1024):.1f}MB) exceeds maximum limit of 10MB."
            )
    elif ext in [".txt"] or mime.startswith("text/plain"):
        source_type = "text"
        if len(content) > MAX_TEXT_BYTES:
            raise PayloadTooLargeError(
                f"Text file size ({len(content) / (1024*1024):.1f}MB) exceeds maximum limit of 10MB."
            )
    else:
        raise ValidationError(
            f"Unsupported file format '{ext}'. Allowed formats: .pdf, .txt, .md"
        )

    # Magic byte and content integrity validation
    try:
        ExtractionService.validate_file(
            content=content,
            filename=filename,
            mime_type=file.content_type or "application/octet-stream"
        )
    except ExtractionError as e:
        raise ValidationError(str(e))

    doc_id = str(uuid.uuid4())
    file_id = str(uuid.uuid4())

    # Generate server-controlled storage path
    storage_path = StorageService.generate_storage_path(
        user_id=current_user["id"],
        document_id=doc_id,
        file_id=file_id,
        original_filename=filename
    )

    # Save to storage
    StorageService.save_file(storage_path, content)
    sha256 = StorageService.compute_sha256(content)

    # Save file record
    FileRepository.create_file(
        workspace_id=workspace["id"],
        storage_path=storage_path,
        original_filename=filename,
        mime_type=file.content_type or f"application/{source_type}",
        size_bytes=len(content),
        sha256_checksum=sha256,
        file_id=file_id
    )

    # Clean title
    doc_title = os.path.splitext(filename)[0].replace("_", " ").replace("-", " ").strip()
    if not doc_title:
        doc_title = "Untitled Document"

    # Create document record
    DocumentRepository.create_document(
        workspace_id=workspace["id"],
        title=doc_title,
        source_type=source_type,
        status="uploading",
        file_id=file_id,
        doc_id=doc_id
    )

    # Create processing job
    job = ProcessingJobRepository.create_job(
        workspace_id=workspace["id"],
        document_id=doc_id
    )

    # Queue async processing
    background_tasks.add_task(
        DocumentProcessingPipeline.process_document,
        document_id=doc_id,
        job_id=job["id"],
        workspace_id=workspace["id"]
    )

    logger.info(
        "Uploaded document doc_id=%s, file_id=%s, job_id=%s for workspace=%s",
        doc_id, file_id, job["id"], workspace["id"]
    )

    return ResponseEnvelope(
        data=DocumentUploadResponse(
            document_id=doc_id,
            job_id=job["id"],
            status="uploading",
            filename=filename,
            size_bytes=len(content)
        )
    )


@router.get(
    "",
    response_model=ResponseEnvelope[DocumentListResponse],
    summary="List workspace documents with pagination"
)
def list_documents(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status: Optional[str] = Query(default=None),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[DocumentListResponse]:
    """Retrieves all documents belonging to the authenticated user's workspace."""
    docs = DocumentRepository.list_by_workspace(
        workspace_id=workspace["id"],
        limit=limit,
        offset=offset,
        status=status
    )
    total = DocumentRepository.count_by_workspace(
        workspace_id=workspace["id"],
        status=status
    )

    return ResponseEnvelope(
        data=DocumentListResponse(
            total=total,
            limit=limit,
            offset=offset,
            documents=[DocumentDetailResponse(**d) for d in docs]
        )
    )


@router.get(
    "/{document_id}",
    response_model=ResponseEnvelope[DocumentDetailResponse],
    summary="Get document details by ID"
)
def get_document(
    document: Dict[str, Any] = Depends(require_document_owner),
) -> ResponseEnvelope[DocumentDetailResponse]:
    """Retrieves metadata and status of a specific document (IDOR protected)."""
    return ResponseEnvelope(data=DocumentDetailResponse(**document))


@router.get(
    "/{document_id}/status",
    response_model=ResponseEnvelope[DocumentStatusResponse],
    summary="Get processing status and stage progress"
)
def get_document_status(
    document: Dict[str, Any] = Depends(require_document_owner),
) -> ResponseEnvelope[DocumentStatusResponse]:
    """Returns the live stage progress and error details of a document's processing job."""
    job = ProcessingJobRepository.get_latest_by_document(document["id"])
    doc_status = document["status"]

    if job:
        stage = job.get("current_stage")
        progress = job.get("stage_progress", 0)
        err_code = job.get("error_code")
        err_msg = document.get("processing_error") or job.get("error_message")
        attempt_count = job.get("attempt_count", 0)
        started_at = job.get("started_at")
        completed_at = job.get("completed_at")
    else:
        stage = "completed" if doc_status == "ready" else "unknown"
        progress = 100 if doc_status == "ready" else 0
        err_code = None
        err_msg = document.get("processing_error")
        attempt_count = 0
        started_at = document.get("created_at")
        completed_at = document.get("updated_at") if doc_status in ["ready", "failed"] else None

    return ResponseEnvelope(
        data=DocumentStatusResponse(
            document_id=document["id"],
            status=doc_status,
            current_stage=stage,
            stage_progress=progress,
            error_code=err_code,
            error_message=err_msg,
            attempt_count=attempt_count,
            started_at=started_at,
            completed_at=completed_at
        )
    )


@router.get(
    "/{document_id}/chunks",
    response_model=ResponseEnvelope[ChunkListResponse],
    summary="List semantic chunks of an ingested document"
)
def get_document_chunks(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    document: Dict[str, Any] = Depends(require_document_owner),
) -> ResponseEnvelope[ChunkListResponse]:
    """Retrieves paginated semantic chunks extracted and stored for the document."""
    chunks = ChunkRepository.list_by_document(
        document_id=document["id"],
        limit=limit,
        offset=offset
    )
    total = ChunkRepository.count_by_document(document["id"])

    return ResponseEnvelope(
        data=ChunkListResponse(
            total=total,
            limit=limit,
            offset=offset,
            chunks=[ChunkItemResponse(**c) for c in chunks]
        )
    )


@router.delete(
    "/{document_id}",
    response_model=ResponseEnvelope[Dict[str, Any]],
    summary="Delete a document and cascade to chunks and storage"
)
def delete_document(
    document: Dict[str, Any] = Depends(require_document_owner),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[Dict[str, Any]]:
    """Cascading deletion of document, chunks, processing jobs, and stored physical file."""
    deleted = DocumentRepository.delete_document_cascade(
        document_id=document["id"],
        workspace_id=workspace["id"]
    )

    if deleted and deleted.get("file_id"):
        file_rec = FileRepository.get_by_id(deleted["file_id"])
        if file_rec:
            StorageService.delete_file(file_rec["storage_path"])
            FileRepository.delete_file(file_rec["id"])

    logger.info("Deleted document %s from workspace %s", document["id"], workspace["id"])

    return ResponseEnvelope(
        data={
            "message": "Document deleted successfully",
            "document_id": document["id"]
        }
    )


@router.get(
    "/{document_id}/related",
    response_model=ResponseEnvelope[RelatedDocumentsResponse],
    summary="Retrieve conceptually related documents based on semantic similarity"
)
def get_related_documents(
    limit: int = Query(default=5, ge=1, le=20, description="Max related documents to return"),
    document: Dict[str, Any] = Depends(require_document_owner),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[RelatedDocumentsResponse]:
    """Surfaces related documents in the same workspace using embedding centroid comparison."""
    result = RelatedKnowledgeService.get_related_documents(
        document_id=document["id"],
        workspace_id=workspace["id"],
        limit=limit
    )
    return ResponseEnvelope(data=result)


@router.post(
    "/{document_id}/reindex",
    response_model=ResponseEnvelope[ReindexResponse],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger asynchronous re-extraction, chunking, and embedding"
)
def reindex_document(
    background_tasks: BackgroundTasks,
    document: Dict[str, Any] = Depends(require_document_owner),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[ReindexResponse]:
    """Clears and re-processes document chunks idempotently."""
    resp = ReindexingService.reindex_document(
        document_id=document["id"],
        workspace_id=workspace["id"]
    )
    background_tasks.add_task(
        DocumentProcessingPipeline.process_document,
        document_id=document["id"],
        job_id=resp.job_id,
        workspace_id=workspace["id"]
    )
    return ResponseEnvelope(data=resp)
