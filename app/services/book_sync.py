"""
Book Sync Service for Recall AI.
Bridges legacy/desktop books and topics from the active SQLite database
into Foundation's `documents` and `document_chunks` tables in `recall_saas.db`.
Ensures unified access for Knowledge Hub grounded RAG search and document management.
"""

import logging
import os
from typing import Any, Dict, List, Optional

from app.core.database import get_db
from app.database import get_connection
from app.models.repositories import DocumentRepository, ChunkRepository
from app.services.extractor import ExtractionService
from app.services.chunker import SemanticChunker
from app.services.embedding import EmbeddingService

logger = logging.getLogger(__name__)


class BookSyncService:
    """
    Synchronizes local books and their parsed content into the Foundation SaaS schema.
    Idempotent and safe to run on document listing, chat initiation, or book upload.
    """

    @staticmethod
    def _get_active_db_owner_id() -> Optional[str]:
        """Returns the user ID associated with the active SQLite database, if any."""
        import re
        from app.database import ACTIVE_DB_PATH
        basename = os.path.basename(ACTIVE_DB_PATH)
        m = re.match(r"user_(.+)_recall\.db", basename)
        return m.group(1) if m else None

    @classmethod
    def sync_workspace_books(cls, workspace_id: str) -> int:
        """
        Scans active books and ensures each book is represented as a 'ready'
        document with semantic chunks in the specified workspace.
        Enforces tenant isolation by checking that the workspace belongs to
        the active SQLite database user.
        """
        if not workspace_id:
            return 0

        # Multi-tenant isolation check: only sync if the workspace matches the active DB owner
        db_user_id = cls._get_active_db_owner_id()
        if db_user_id:
            from app.models.repositories import WorkspaceRepository
            ws = WorkspaceRepository.get_by_id(workspace_id)
            if ws and ws.get("owner_id") != db_user_id:
                # Do not sync local books into another user's workspace
                return 0
        elif workspace_id != "default":
            # If no user-specific active DB (e.g. recall.db), only sync to default workspace
            from app.models.repositories import WorkspaceRepository
            ws = WorkspaceRepository.get_by_id(workspace_id)
            if ws:
                return 0

        try:
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='books'"
                )
                if cursor.fetchone()[0] == 0:
                    return 0

                cursor.execute(
                    """
                    SELECT id, title, file_path, file_hash, total_pages, created_at, updated_at
                    FROM books
                    WHERE deleted_at IS NULL
                    ORDER BY id ASC
                    """
                )
                books = [dict(r) for r in cursor.fetchall()]
        except Exception as e:
            logger.debug(f"Could not read books from active database: {e}")
            return 0

        synced_count = 0
        for book in books:
            try:
                cls.sync_single_book(book, workspace_id)
                synced_count += 1
            except Exception as e:
                logger.warning(f"Failed to sync book {book.get('id')} into workspace {workspace_id}: {e}")

        return synced_count

    @classmethod
    def sync_book_to_all_workspaces(cls, book_id: int) -> None:
        """
        Syncs a single book into the workspace belonging to the active database user,
        or 'default'.
        """
        try:
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT id, title, file_path, file_hash, total_pages, created_at, updated_at
                    FROM books
                    WHERE id = ? AND deleted_at IS NULL
                    """,
                    (book_id,)
                )
                row = cursor.fetchone()
                if not row:
                    return
                book = dict(row)
        except Exception as e:
            logger.debug(f"Could not fetch book {book_id}: {e}")
            return

        db_user_id = cls._get_active_db_owner_id()
        target_ws_ids = []
        if db_user_id:
            from app.models.repositories import WorkspaceRepository
            ws = WorkspaceRepository.get_by_owner_id(db_user_id)
            if ws:
                target_ws_ids.append(ws["id"])
        if not target_ws_ids:
            target_ws_ids.append("default")

        for ws_id in set(target_ws_ids):
            try:
                cls.sync_single_book(book, ws_id)
            except Exception as e:
                logger.warning(f"Failed to sync book {book_id} to workspace {ws_id}: {e}")

    @classmethod
    def sync_single_book(cls, book: Dict[str, Any], workspace_id: str) -> Optional[Dict[str, Any]]:
        """
        Mirrors a single book record into `documents` and generates semantic chunks
        if not already present.
        """
        book_id = book["id"]
        doc_id = str(book_id)

        # 1. Check if document already exists in this workspace
        doc = DocumentRepository.get_by_id_and_workspace(doc_id, workspace_id)
        if not doc:
            # Check by metadata.book_id
            existing = DocumentRepository.list_by_workspace(workspace_id=workspace_id, limit=200)
            for d in existing:
                if str(d.get("metadata", {}).get("book_id")) == str(book_id):
                    doc = d
                    doc_id = d["id"]
                    break

        if not doc:
            doc_title = book.get("title") or f"Book {book_id}"
            doc = DocumentRepository.create_document(
                workspace_id=workspace_id,
                title=doc_title,
                source_type="pdf",
                total_pages=book.get("total_pages") or 1,
                status="processing",
                metadata={"book_id": book_id, "file_hash": book.get("file_hash")},
                doc_id=doc_id,
            )
            logger.info("Created mirrored document %s for book_id=%s in workspace=%s (status=processing)", doc_id, book_id, workspace_id)

        # 2. Check chunk count for this document
        chunk_count = ChunkRepository.count_by_document(doc_id)
        if chunk_count > 0:
            if doc.get("status") != "ready":
                DocumentRepository.update_status(doc_id, status="ready")
                doc["status"] = "ready"
            return doc

        # 3. Chunks missing: generate from PDF file if available
        file_path = book.get("file_path")
        if file_path and os.path.exists(file_path):
            try:
                with open(file_path, "rb") as f:
                    pdf_bytes = f.read()

                extracted = ExtractionService.extract(
                    content=pdf_bytes,
                    filename=book.get("title", f"book_{book_id}") + ".pdf",
                    mime_type="application/pdf",
                )

                chunker = SemanticChunker(target_chunk_size=1500, overlap_size=150)
                chunks = chunker.chunk_document(extracted.pages)
                if not chunks and extracted.full_text:
                    chunks = [
                        SemanticChunker.chunk_text(
                            text=extracted.full_text,
                            page_number=1,
                            start_index=0
                        )[0]
                    ]

                if chunks:
                    chunk_texts = [c.content for c in chunks]
                    embeddings = EmbeddingService.generate_embeddings(
                        texts=chunk_texts,
                        workspace_id=workspace_id
                    )

                    chunks_data: List[Dict[str, Any]] = []
                    for i, c in enumerate(chunks):
                        emb = embeddings[i] if i < len(embeddings) else None
                        chunks_data.append({
                            "chunk_index": c.chunk_index,
                            "content": c.content,
                            "page_number": c.page_number,
                            "token_count": c.token_count,
                            "embedding": emb,
                            "embedding_model": "text-embedding-3-small",
                            "embedding_version": 1,
                        })

                    ChunkRepository.batch_create_chunks(doc_id, chunks_data)
                    DocumentRepository.update_status(doc_id, status="ready")
                    doc["status"] = "ready"
                    logger.info("Generated %d semantic chunks for mirrored document %s", len(chunks_data), doc_id)
                    return doc
            except Exception as e:
                logger.warning(f"Direct PDF chunking failed for book {book_id}: {e}")

        # 4. Fallback: chunk from topics with markdown content
        try:
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT id, title, start_page, end_page, content_md
                    FROM topics
                    WHERE book_id = ? AND content_md IS NOT NULL AND trim(content_md) != ''
                    ORDER BY start_page ASC, sort_order ASC
                    """,
                    (book_id,)
                )
                topics = [dict(r) for r in cursor.fetchall()]

            if topics:
                fallback_chunks: List[Dict[str, Any]] = []
                idx = 0
                for top in topics:
                    content = top.get("content_md", "").strip()
                    if not content:
                        continue
                    tokens = SemanticChunker.estimate_tokens(content)
                    emb = EmbeddingService.generate_embedding(content[:3000], workspace_id=workspace_id)
                    fallback_chunks.append({
                        "chunk_index": idx,
                        "content": f"# {top.get('title')}\n\n{content}",
                        "page_number": top.get("start_page"),
                        "token_count": tokens,
                        "embedding": emb,
                        "embedding_model": "text-embedding-3-small",
                        "embedding_version": 1,
                    })
                    idx += 1

                if fallback_chunks:
                    ChunkRepository.batch_create_chunks(doc_id, fallback_chunks)
                    DocumentRepository.update_status(doc_id, status="ready")
                    doc["status"] = "ready"
                    logger.info("Generated %d chunks from topics for document %s", len(fallback_chunks), doc_id)
                    return doc
        except Exception as e:
            logger.warning(f"Topic-based chunking failed for book {book_id}: {e}")

        if ChunkRepository.count_by_document(doc_id) == 0:
            DocumentRepository.update_status(
                doc_id,
                status="failed",
                processing_error="No content could be extracted from PDF or topics"
            )
            doc["status"] = "failed"

        return doc
