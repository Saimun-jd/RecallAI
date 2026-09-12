"""
Knowledge Hub Backend Services for Recall AI.
Provides:
- RelatedKnowledgeService: Computes document similarity via embedding centroids.
- ReindexingService: Cleans and triggers asynchronous reprocessing of existing documents.
"""

import json
import logging
from typing import Any, Dict, List, Optional

try:
    import numpy as np
    HAVE_NUMPY = True
except ImportError:
    HAVE_NUMPY = False

from app.core.errors import NotFoundError, ValidationError
from app.models.repositories import (
    ChunkRepository,
    DocumentRepository,
    FileRepository,
    ProcessingJobRepository,
)
from app.schemas.search import RelatedDocumentItem, RelatedDocumentsResponse, ReindexResponse
from app.services.pipeline import DocumentProcessingPipeline
from app.services.retrieval import VectorSearcher

logger = logging.getLogger(__name__)


class RelatedKnowledgeService:
    """Computes semantic similarity between documents to surface related knowledge."""

    @classmethod
    def get_related_documents(
        cls,
        document_id: str,
        workspace_id: str,
        limit: int = 5,
        min_similarity: float = 0.2
    ) -> RelatedDocumentsResponse:
        # 1. Verify target document exists
        doc = DocumentRepository.get_by_id_and_workspace(document_id, workspace_id)
        if not doc:
            raise NotFoundError("Document not found.")

        # 2. Get embeddings of target document
        target_chunks = ChunkRepository.get_document_embeddings(document_id, workspace_id)
        if not target_chunks:
            return RelatedDocumentsResponse(
                document_id=document_id,
                total=0,
                related_documents=[]
            )

        # Parse target vectors
        target_vectors: List[List[float]] = []
        for tc in target_chunks:
            raw_emb = tc.get("embedding")
            if raw_emb:
                try:
                    vec = json.loads(raw_emb) if isinstance(raw_emb, str) else raw_emb
                    if isinstance(vec, list) and len(vec) == 1536:
                        target_vectors.append(vec)
                except Exception:
                    continue

        if not target_vectors:
            return RelatedDocumentsResponse(
                document_id=document_id,
                total=0,
                related_documents=[]
            )

        # Compute centroid vector for target document
        if HAVE_NUMPY:
            t_mat = np.array(target_vectors, dtype=np.float32)
            centroid = np.mean(t_mat, axis=0)
            norm = np.linalg.norm(centroid) or 1.0
            centroid_vec = (centroid / norm).tolist()
        else:
            dim = len(target_vectors[0])
            centroid_vec = [0.0] * dim
            for v in target_vectors:
                for i in range(dim):
                    centroid_vec[i] += v[i]
            centroid_vec = [v / len(target_vectors) for v in centroid_vec]

        # 3. Retrieve chunks from all OTHER documents in the same workspace
        candidates = ChunkRepository.search_candidates(
            workspace_id=workspace_id,
            limit=500
        )

        # Group other chunks by document
        other_docs: Dict[str, Dict[str, Any]] = {}
        for c in candidates:
            other_doc_id = c["document_id"]
            if other_doc_id == document_id:
                continue

            raw_emb = c.get("embedding")
            if not raw_emb:
                continue

            try:
                c_vec = json.loads(raw_emb) if isinstance(raw_emb, str) else raw_emb
                if not isinstance(c_vec, list) or len(c_vec) != 1536:
                    continue
            except Exception:
                continue

            sim = VectorSearcher.compute_similarity(centroid_vec, c_vec)
            if other_doc_id not in other_docs:
                other_docs[other_doc_id] = {
                    "document_id": other_doc_id,
                    "title": c["document_title"],
                    "max_sim": sim,
                    "snippet": c["content"][:200]
                }
            else:
                if sim > other_docs[other_doc_id]["max_sim"]:
                    other_docs[other_doc_id]["max_sim"] = sim
                    other_docs[other_doc_id]["snippet"] = c["content"][:200]

        # Filter by threshold and sort descending
        qualified = [
            d for d in other_docs.values()
            if d["max_sim"] >= min_similarity
        ]
        qualified.sort(key=lambda x: x["max_sim"], reverse=True)

        items = [
            RelatedDocumentItem(
                document_id=item["document_id"],
                title=item["title"],
                similarity_score=round(item["max_sim"], 4),
                snippet=item["snippet"]
            )
            for item in qualified[:limit]
        ]

        return RelatedDocumentsResponse(
            document_id=document_id,
            total=len(items),
            related_documents=items
        )


class ReindexingService:
    """Manages idempotent re-indexing of documents."""

    @classmethod
    def reindex_document(
        cls,
        document_id: str,
        workspace_id: str,
    ) -> ReindexResponse:
        doc = DocumentRepository.get_by_id_and_workspace(document_id, workspace_id)
        if not doc:
            raise NotFoundError("Document not found.")

        file_id = doc.get("file_id")
        if not file_id:
            raise ValidationError("Document has no associated file record for re-indexing.")

        file_rec = FileRepository.get_by_id(file_id)
        if not file_rec:
            raise ValidationError("Underlying file record could not be found.")

        # 1. Mark document status back to processing
        DocumentRepository.update_status(document_id, status="processing")

        # 2. Clear old chunks for clean idempotent rebuild
        ChunkRepository.delete_by_document(document_id)

        # 3. Create a new processing job
        job = ProcessingJobRepository.create_job(
            workspace_id=workspace_id,
            document_id=document_id
        )

        logger.info(
            "Reindexing initiated for document_id=%s, new job_id=%s",
            document_id, job["id"]
        )

        return ReindexResponse(
            document_id=document_id,
            job_id=job["id"],
            status="processing",
            message="Document re-indexing enqueued successfully."
        )
