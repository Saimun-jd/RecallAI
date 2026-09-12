"""
Document Processing Pipeline for Recall AI.
Executes multi-stage asynchronous processing:
VALIDATE -> EXTRACT -> NORMALIZE -> CHUNK -> EMBED -> INDEX -> READY
Idempotent, crash-resilient, and tenant-isolated.
"""

import logging
import traceback
from typing import Any, Dict, List, Optional

from app.models.repositories import (
    DocumentRepository,
    FileRepository,
    ChunkRepository,
    ProcessingJobRepository,
)
from app.services.storage import StorageService
from app.services.extractor import ExtractionService, ExtractionError
from app.services.chunker import SemanticChunker
from app.services.embedding import EmbeddingService

logger = logging.getLogger(__name__)


class PipelineError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class DocumentProcessingPipeline:
    """
    Orchestrates the 7-stage document processing workflow.
    Designed to run inside background tasks or workers safely.
    """

    @classmethod
    def process_document(
        cls,
        document_id: str,
        job_id: str,
        workspace_id: str,
    ) -> bool:
        """
        Executes the end-to-end processing pipeline for a given document.
        Returns True on success, False on failure.
        """
        logger.info(
            "Starting pipeline for document_id=%s, job_id=%s, workspace_id=%s",
            document_id, job_id, workspace_id
        )

        try:
            # -------------------------------------------------------------
            # Stage 1: Validation
            # -------------------------------------------------------------
            ProcessingJobRepository.update_stage(
                job_id=job_id,
                current_stage="validation",
                stage_progress=10,
                status="running"
            )
            DocumentRepository.update_status(document_id, status="processing")

            doc = DocumentRepository.get_by_id_and_workspace(document_id, workspace_id)
            if not doc:
                raise PipelineError("DOCUMENT_NOT_FOUND", f"Document {document_id} not found in workspace")

            file_id = doc.get("file_id")
            if not file_id:
                raise PipelineError("FILE_NOT_FOUND", f"No file attached to document {document_id}")

            file_record = FileRepository.get_by_id(file_id)
            if not file_record:
                raise PipelineError("FILE_RECORD_MISSING", f"File record {file_id} not found")

            storage_path = file_record["storage_path"]
            if not StorageService.file_exists(storage_path):
                raise PipelineError("FILE_ON_DISK_MISSING", "Document file could not be found in storage")

            content = StorageService.read_file(storage_path)
            if not content:
                raise PipelineError("EMPTY_FILE", "Uploaded file contains zero bytes")

            # Validate magic bytes and format
            try:
                ExtractionService.validate_file(
                    content=content,
                    filename=file_record["original_filename"],
                    mime_type=file_record["mime_type"],
                )
            except ExtractionError as e:
                raise PipelineError("FILE_VALIDATION_FAILED", str(e))

            # -------------------------------------------------------------
            # Stage 2: Extraction
            # -------------------------------------------------------------
            ProcessingJobRepository.update_stage(
                job_id=job_id,
                current_stage="extraction",
                stage_progress=30,
                status="running"
            )

            try:
                extracted = ExtractionService.extract(
                    content=content,
                    filename=file_record["original_filename"],
                    mime_type=file_record["mime_type"],
                )
            except ExtractionError as e:
                raise PipelineError("EXTRACTION_ERROR", str(e))

            # Update document total pages
            DocumentRepository.update_status(
                document_id=document_id,
                status="processing",
                total_pages=extracted.total_pages
            )

            # -------------------------------------------------------------
            # Stage 3: Normalization
            # -------------------------------------------------------------
            # ExtractedDocument already contains normalized text in each PageContent
            ProcessingJobRepository.update_stage(
                job_id=job_id,
                current_stage="normalization",
                stage_progress=45,
                status="running"
            )

            # -------------------------------------------------------------
            # Stage 4: Semantic Chunking
            # -------------------------------------------------------------
            ProcessingJobRepository.update_stage(
                job_id=job_id,
                current_stage="chunking",
                stage_progress=60,
                status="running"
            )

            chunker = SemanticChunker(target_chunk_size=1500, overlap_size=150)
            chunks = chunker.chunk_document(extracted.pages)

            if not chunks:
                # Handle empty or zero-text documents with a fallback single chunk
                chunks = [
                    SemanticChunker.chunk_text(
                        text=extracted.full_text or "No extractable text content found.",
                        page_number=1,
                        start_index=0
                    )[0]
                ]

            # -------------------------------------------------------------
            # Stage 5: Embedding Generation
            # -------------------------------------------------------------
            ProcessingJobRepository.update_stage(
                job_id=job_id,
                current_stage="embedding",
                stage_progress=80,
                status="running"
            )

            chunk_texts = [c.content for c in chunks]
            embeddings = EmbeddingService.generate_embeddings(
                texts=chunk_texts,
                workspace_id=workspace_id
            )

            # -------------------------------------------------------------
            # Stage 6: Indexing & Persistence
            # -------------------------------------------------------------
            ProcessingJobRepository.update_stage(
                job_id=job_id,
                current_stage="indexing",
                stage_progress=95,
                status="running"
            )

            chunks_data: List[Dict[str, Any]] = []
            for i, chunk in enumerate(chunks):
                emb = embeddings[i] if i < len(embeddings) else None
                chunks_data.append({
                    "chunk_index": chunk.chunk_index,
                    "content": chunk.content,
                    "page_number": chunk.page_number,
                    "token_count": chunk.token_count,
                    "embedding": emb,
                    "embedding_model": "text-embedding-3-small",
                    "embedding_version": 1,
                })

            ChunkRepository.batch_create_chunks(document_id, chunks_data)

            # -------------------------------------------------------------
            # Stage 7: Finalization (Ready)
            # -------------------------------------------------------------
            ProcessingJobRepository.complete_job(job_id)
            DocumentRepository.update_status(
                document_id=document_id,
                status="ready",
                total_pages=extracted.total_pages
            )

            logger.info(
                "Document %s successfully processed into %d chunks",
                document_id, len(chunks)
            )
            return True

        except PipelineError as e:
            logger.error("Pipeline error for document %s: [%s] %s", document_id, e.code, e.message)
            ProcessingJobRepository.fail_job(job_id, error_code=e.code, error_message=e.message)
            DocumentRepository.update_status(document_id, status="failed", processing_error=e.message)
            return False

        except Exception as e:
            err_msg = f"Unexpected processing error: {str(e)}"
            logger.error("Unexpected error in pipeline for document %s:\n%s", document_id, traceback.format_exc())
            ProcessingJobRepository.fail_job(job_id, error_code="INTERNAL_ERROR", error_message=err_msg)
            DocumentRepository.update_status(document_id, status="failed", processing_error=err_msg)
            return False
