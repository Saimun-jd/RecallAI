"""
Data Access Repositories for Recall AI Foundation.
Enforces tenant scoping, parameterized queries, and transactional safety.
"""

import json
import uuid
from typing import Any, Dict, List, Optional
import sqlite3

from app.core.database import get_db


class UserRepository:
    @staticmethod
    def create_user(
        email: str,
        password_hash: str,
        full_name: Optional[str] = None,
        avatar_url: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        user_id = str(uuid.uuid4())
        sql = """
            INSERT INTO users (id, email, password_hash, full_name, avatar_url, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        """
        params = (user_id, email.strip().lower(), password_hash, full_name, avatar_url)
        
        if db_conn:
            db_conn.execute(sql, params)
            return UserRepository.get_by_id(user_id, db_conn=db_conn)  # type: ignore

        with get_db() as conn:
            conn.execute(sql, params)
            return UserRepository.get_by_id(user_id, db_conn=conn)  # type: ignore

    @staticmethod
    def get_by_email(email: str, db_conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM users WHERE email = ? AND deleted_at IS NULL"
        params = (email.strip().lower(),)
        
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_by_id(user_id: str, db_conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM users WHERE id = ? AND deleted_at IS NULL"
        params = (user_id,)

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None


class WorkspaceRepository:
    @staticmethod
    def create_workspace(
        owner_id: str,
        name: str = "Personal Workspace",
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        workspace_id = str(uuid.uuid4())
        sql = """
            INSERT INTO workspaces (id, owner_id, name)
            VALUES (?, ?, ?)
        """
        params = (workspace_id, owner_id, name)

        if db_conn:
            db_conn.execute(sql, params)
            return WorkspaceRepository.get_by_id(workspace_id, db_conn=db_conn)  # type: ignore

        with get_db() as conn:
            conn.execute(sql, params)
            return WorkspaceRepository.get_by_id(workspace_id, db_conn=conn)  # type: ignore

    @staticmethod
    def get_by_owner_id(owner_id: str, db_conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM workspaces WHERE owner_id = ?"
        params = (owner_id,)

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_by_id(workspace_id: str, db_conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM workspaces WHERE id = ?"
        params = (workspace_id,)

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None


class PreferencesRepository:
    @staticmethod
    def create_preferences(
        user_id: str,
        theme: str = "neo-brutalist",
        daily_review_goal: int = 20,
        preferred_llm_provider: str = "auto",
        preferences: Optional[Dict[str, Any]] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        prefs_json = json.dumps(preferences or {})
        sql = """
            INSERT INTO user_preferences (user_id, theme, daily_review_goal, preferred_llm_provider, preferences)
            VALUES (?, ?, ?, ?, ?)
        """
        params = (user_id, theme, daily_review_goal, preferred_llm_provider, prefs_json)

        if db_conn:
            db_conn.execute(sql, params)
            return PreferencesRepository.get_by_user_id(user_id, db_conn=db_conn)  # type: ignore

        with get_db() as conn:
            conn.execute(sql, params)
            return PreferencesRepository.get_by_user_id(user_id, db_conn=conn)  # type: ignore

    @staticmethod
    def get_by_user_id(user_id: str, db_conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM user_preferences WHERE user_id = ?"
        params = (user_id,)

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            if not row:
                return None
            res = dict(row)
            res["preferences"] = json.loads(res.get("preferences") or "{}")
            return res

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            if not row:
                return None
            res = dict(row)
            res["preferences"] = json.loads(res.get("preferences") or "{}")
            return res

    @staticmethod
    def update_preferences(
        user_id: str,
        theme: Optional[str] = None,
        daily_review_goal: Optional[int] = None,
        preferred_llm_provider: Optional[str] = None,
        preferences: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        current = PreferencesRepository.get_by_user_id(user_id)
        if not current:
            return PreferencesRepository.create_preferences(
                user_id=user_id,
                theme=theme or "neo-brutalist",
                daily_review_goal=daily_review_goal or 20,
                preferred_llm_provider=preferred_llm_provider or "auto",
                preferences=preferences or {}
            )

        new_theme = theme if theme is not None else current["theme"]
        new_goal = daily_review_goal if daily_review_goal is not None else current["daily_review_goal"]
        new_provider = preferred_llm_provider if preferred_llm_provider is not None else current["preferred_llm_provider"]
        new_prefs = preferences if preferences is not None else current["preferences"]

        with get_db() as conn:
            conn.execute("""
                UPDATE user_preferences 
                SET theme = ?, daily_review_goal = ?, preferred_llm_provider = ?, preferences = ?,
                    updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
                WHERE user_id = ?
            """, (new_theme, new_goal, new_provider, json.dumps(new_prefs), user_id))

        return PreferencesRepository.get_by_user_id(user_id)  # type: ignore


class DocumentRepository:
    @staticmethod
    def create_document(
        workspace_id: str,
        title: str,
        source_type: str = "pdf",
        total_pages: int = 1,
        status: str = "uploading",
        file_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        doc_id: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        document_id = doc_id or str(uuid.uuid4())
        meta_json = json.dumps(metadata or {})
        sql = """
            INSERT INTO documents (id, workspace_id, title, source_type, total_pages, status, file_id, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (document_id, workspace_id, title, source_type, total_pages, status, file_id, meta_json)
        if db_conn:
            db_conn.execute(sql, params)
            return DocumentRepository.get_by_id_and_workspace(document_id, workspace_id, db_conn=db_conn)  # type: ignore

        with get_db() as conn:
            conn.execute(sql, params)
            return DocumentRepository.get_by_id_and_workspace(document_id, workspace_id, db_conn=conn)  # type: ignore

    @staticmethod
    def count_by_workspace(
        workspace_id: str,
        status: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> int:
        sql = "SELECT COUNT(*) FROM documents WHERE workspace_id = ? AND deleted_at IS NULL"
        params: List[Any] = [workspace_id]
        if status:
            sql += " AND status = ?"
            params.append(status)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, tuple(params))
            return cursor.fetchone()[0]
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, tuple(params))
            return cursor.fetchone()[0]

    @staticmethod
    def get_by_id_and_workspace(
        document_id: str,
        workspace_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM documents WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL"
        params = (document_id, workspace_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            if not row:
                return None
            res = dict(row)
            res["metadata"] = json.loads(res.get("metadata") or "{}")
            return res

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            if not row:
                return None
            res = dict(row)
            res["metadata"] = json.loads(res.get("metadata") or "{}")
            return res

    @staticmethod
    def list_by_workspace(
        workspace_id: str,
        limit: int = 20,
        offset: int = 0,
        status: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        sql = """
            SELECT * FROM documents 
            WHERE workspace_id = ? AND deleted_at IS NULL
        """
        params: List[Any] = [workspace_id]
        if status:
            sql += " AND status = ?"
            params.append(status)
        sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, tuple(params))
            rows = cursor.fetchall()
            results = []
            for r in rows:
                d = dict(r)
                d["metadata"] = json.loads(d.get("metadata") or "{}")
                results.append(d)
            return results

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, tuple(params))
            rows = cursor.fetchall()
            results = []
            for r in rows:
                d = dict(r)
                d["metadata"] = json.loads(d.get("metadata") or "{}")
                results.append(d)
            return results

    @staticmethod
    def update_status(
        document_id: str,
        status: str,
        processing_error: Optional[str] = None,
        total_pages: Optional[int] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        sql = """
            UPDATE documents 
            SET status = ?, 
                processing_error = ?,
                total_pages = COALESCE(?, total_pages),
                updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            WHERE id = ?
        """
        params = (status, processing_error, total_pages, document_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0

    @staticmethod
    def set_file_id(
        document_id: str,
        file_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        sql = """
            UPDATE documents 
            SET file_id = ?, updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            WHERE id = ?
        """
        params = (file_id, document_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0

    @staticmethod
    def delete_document_cascade(
        document_id: str,
        workspace_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Deletes the document and cascades to chunks and processing jobs.
        Returns the deleted document record including file_id for storage cleanup.
        """
        doc = DocumentRepository.get_by_id_and_workspace(document_id, workspace_id, db_conn=db_conn)
        if not doc:
            return None

        sql = "DELETE FROM documents WHERE id = ? AND workspace_id = ?"
        params = (document_id, workspace_id)
        if db_conn:
            db_conn.execute(sql, params)
            return doc
        with get_db() as conn:
            conn.execute(sql, params)
            return doc


class ProviderCredentialRepository:
    @staticmethod
    def save_credential(
        workspace_id: str,
        user_id: str,
        provider: str,
        encrypted_key: str,
        key_nonce: str,
        key_tag: str,
        key_hint: str,
        key_version: int = 1,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        cred_id = str(uuid.uuid4())
        sql = """
            INSERT INTO provider_credentials (
                id, workspace_id, user_id, provider, encrypted_key,
                key_nonce, key_tag, key_version, key_hint, is_valid
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(workspace_id, provider) DO UPDATE SET
                encrypted_key = excluded.encrypted_key,
                key_nonce = excluded.key_nonce,
                key_tag = excluded.key_tag,
                key_version = excluded.key_version,
                key_hint = excluded.key_hint,
                is_valid = 1
        """
        params = (
            cred_id, workspace_id, user_id, provider, encrypted_key,
            key_nonce, key_tag, key_version, key_hint
        )
        if db_conn:
            db_conn.execute(sql, params)
            return ProviderCredentialRepository.get_by_workspace_and_provider(workspace_id, provider, db_conn=db_conn)  # type: ignore

        with get_db() as conn:
            conn.execute(sql, params)
            return ProviderCredentialRepository.get_by_workspace_and_provider(workspace_id, provider, db_conn=conn)  # type: ignore

    @staticmethod
    def get_by_workspace_and_provider(
        workspace_id: str,
        provider: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM provider_credentials WHERE workspace_id = ? AND provider = ?"
        params = (workspace_id, provider)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def list_by_workspace(
        workspace_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        sql = "SELECT id, workspace_id, provider, key_version, key_hint, is_valid, last_tested_at, created_at FROM provider_credentials WHERE workspace_id = ?"
        params = (workspace_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return [dict(r) for r in cursor.fetchall()]

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return [dict(r) for r in cursor.fetchall()]


class FileRepository:
    @staticmethod
    def create_file(
        workspace_id: str,
        storage_path: str,
        original_filename: str,
        mime_type: str,
        size_bytes: int,
        sha256_checksum: str,
        storage_provider: str = "local",
        file_id: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        fid = file_id or str(uuid.uuid4())
        sql = """
            INSERT INTO files (
                id, workspace_id, storage_provider, storage_path,
                original_filename, mime_type, size_bytes, sha256_checksum
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (fid, workspace_id, storage_provider, storage_path, original_filename, mime_type, size_bytes, sha256_checksum)
        if db_conn:
            db_conn.execute(sql, params)
            return FileRepository.get_by_id(fid, db_conn=db_conn)  # type: ignore
        with get_db() as conn:
            conn.execute(sql, params)
            return FileRepository.get_by_id(fid, db_conn=conn)  # type: ignore

    @staticmethod
    def get_by_id(file_id: str, db_conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM files WHERE id = ?"
        params = (file_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def delete_file(file_id: str, db_conn: Optional[sqlite3.Connection] = None) -> bool:
        sql = "DELETE FROM files WHERE id = ?"
        params = (file_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0


class ChunkRepository:
    @staticmethod
    def batch_create_chunks(
        document_id: str,
        chunks_data: List[Dict[str, Any]],
        db_conn: Optional[sqlite3.Connection] = None
    ) -> int:
        """
        Inserts a batch of document chunks.
        chunks_data list of dicts with:
        chunk_index, content, page_number, token_count, embedding (optional list or str),
        embedding_model, embedding_version.
        """
        if not chunks_data:
            return 0

        sql = """
            INSERT INTO document_chunks (
                id, document_id, chunk_index, content, page_number,
                token_count, embedding, embedding_model, embedding_version
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(document_id, chunk_index) DO UPDATE SET
                content = excluded.content,
                page_number = excluded.page_number,
                token_count = excluded.token_count,
                embedding = excluded.embedding,
                embedding_model = excluded.embedding_model,
                embedding_version = excluded.embedding_version
        """
        rows = []
        for c in chunks_data:
            cid = c.get("id") or str(uuid.uuid4())
            emb = c.get("embedding")
            emb_str = json.dumps(emb) if isinstance(emb, list) else emb
            rows.append((
                cid,
                document_id,
                c["chunk_index"],
                c["content"],
                c.get("page_number"),
                c["token_count"],
                emb_str,
                c.get("embedding_model", "text-embedding-3-small"),
                c.get("embedding_version", 1)
            ))

        if db_conn:
            db_conn.executemany(sql, rows)
            return len(rows)
        with get_db() as conn:
            conn.executemany(sql, rows)
            return len(rows)

    @staticmethod
    def list_by_document(
        document_id: str,
        limit: int = 50,
        offset: int = 0,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        sql = """
            SELECT id, document_id, chunk_index, content, page_number,
                   token_count, embedding_model, embedding_version, created_at
            FROM document_chunks
            WHERE document_id = ?
            ORDER BY chunk_index ASC
            LIMIT ? OFFSET ?
        """
        params = (document_id, limit, offset)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return [dict(r) for r in cursor.fetchall()]
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return [dict(r) for r in cursor.fetchall()]

    @staticmethod
    def count_by_document(document_id: str, db_conn: Optional[sqlite3.Connection] = None) -> int:
        sql = "SELECT COUNT(*) FROM document_chunks WHERE document_id = ?"
        params = (document_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.fetchone()[0]
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.fetchone()[0]

    @staticmethod
    def delete_by_document(document_id: str, db_conn: Optional[sqlite3.Connection] = None) -> int:
        sql = "DELETE FROM document_chunks WHERE document_id = ?"
        params = (document_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount

    @staticmethod
    def search_candidates(
        workspace_id: str,
        document_id: Optional[str] = None,
        limit: int = 500,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieves chunk candidates belonging to active documents in the workspace.
        Enforces tenant boundary and document ready/active state.
        """
        sql = """
            SELECT c.id, c.document_id, c.chunk_index, c.content, c.page_number,
                   c.token_count, c.embedding, c.embedding_model, c.embedding_version,
                   d.title as document_title
            FROM document_chunks c
            JOIN documents d ON c.document_id = d.id
            WHERE d.workspace_id = ?
              AND d.deleted_at IS NULL
              AND d.status = 'ready'
        """
        params: List[Any] = [workspace_id]
        if document_id:
            sql += " AND d.id = ?"
            params.append(document_id)
        sql += " ORDER BY c.created_at DESC LIMIT ?"
        params.append(limit)

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, tuple(params))
            return [dict(r) for r in cursor.fetchall()]
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, tuple(params))
            return [dict(r) for r in cursor.fetchall()]

    @staticmethod
    def keyword_candidates(
        workspace_id: str,
        query_terms: List[str],
        document_id: Optional[str] = None,
        limit: int = 100,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieves chunk candidates matching any of the query terms in content or title.
        """
        if not query_terms:
            return []

        conditions = []
        params: List[Any] = [workspace_id]
        for term in query_terms:
            conditions.append("(c.content LIKE ? OR d.title LIKE ?)")
            term_param = f"%{term}%"
            params.extend([term_param, term_param])

        term_clause = " OR ".join(conditions)
        sql = f"""
            SELECT c.id, c.document_id, c.chunk_index, c.content, c.page_number,
                   c.token_count, c.embedding, c.embedding_model, c.embedding_version,
                   d.title as document_title
            FROM document_chunks c
            JOIN documents d ON c.document_id = d.id
            WHERE d.workspace_id = ?
              AND d.deleted_at IS NULL
              AND d.status = 'ready'
              AND ({term_clause})
        """
        if document_id:
            sql += " AND d.id = ?"
            params.append(document_id)
        sql += " LIMIT ?"
        params.append(limit)

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, tuple(params))
            return [dict(r) for r in cursor.fetchall()]
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, tuple(params))
            return [dict(r) for r in cursor.fetchall()]

    @staticmethod
    def get_document_embeddings(
        document_id: str,
        workspace_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieves all chunk embeddings for a specific document scoped to workspace.
        """
        sql = """
            SELECT c.id, c.chunk_index, c.content, c.embedding, c.embedding_model, c.embedding_version
            FROM document_chunks c
            JOIN documents d ON c.document_id = d.id
            WHERE d.id = ? AND d.workspace_id = ? AND d.deleted_at IS NULL
            ORDER BY c.chunk_index ASC
        """
        params = (document_id, workspace_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return [dict(r) for r in cursor.fetchall()]
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return [dict(r) for r in cursor.fetchall()]


class ProcessingJobRepository:
    @staticmethod
    def create_job(
        workspace_id: str,
        document_id: str,
        idempotency_key: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        job_id = str(uuid.uuid4())
        ikey = idempotency_key or f"job_{document_id}_{job_id[:8]}"
        sql = """
            INSERT INTO processing_jobs (
                id, workspace_id, document_id, status, current_stage,
                attempt_count, max_attempts, stage_progress, idempotency_key, started_at
            )
            VALUES (?, ?, ?, 'pending', 'validation', 0, 3, 0, ?, (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')))
        """
        params = (job_id, workspace_id, document_id, ikey)
        if db_conn:
            db_conn.execute(sql, params)
            return ProcessingJobRepository.get_by_id(job_id, db_conn=db_conn)  # type: ignore
        with get_db() as conn:
            conn.execute(sql, params)
            return ProcessingJobRepository.get_by_id(job_id, db_conn=conn)  # type: ignore

    @staticmethod
    def get_by_id(job_id: str, db_conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM processing_jobs WHERE id = ?"
        params = (job_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_latest_by_document(document_id: str, db_conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM processing_jobs WHERE document_id = ? ORDER BY created_at DESC LIMIT 1"
        params = (document_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def update_stage(
        job_id: str,
        current_stage: str,
        stage_progress: int,
        status: str = "running",
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        sql = """
            UPDATE processing_jobs
            SET current_stage = ?,
                stage_progress = ?,
                status = ?,
                updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            WHERE id = ?
        """
        params = (current_stage, stage_progress, status, job_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0

    @staticmethod
    def fail_job(
        job_id: str,
        error_code: str,
        error_message: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        sql = """
            UPDATE processing_jobs
            SET status = 'failed',
                error_code = ?,
                error_message = ?,
                completed_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            WHERE id = ?
        """
        params = (error_code, error_message, job_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0

    @staticmethod
    def complete_job(
        job_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        sql = """
            UPDATE processing_jobs
            SET status = 'completed',
                current_stage = 'completed',
                stage_progress = 100,
                completed_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            WHERE id = ?
        """
        params = (job_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0


class ConversationRepository:
    @staticmethod
    def create_conversation(
        workspace_id: str,
        user_id: str,
        title: str = "New Conversation",
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        conv_id = str(uuid.uuid4())
        sql = """
            INSERT INTO conversations (id, workspace_id, user_id, title)
            VALUES (?, ?, ?, ?)
        """
        params = (conv_id, workspace_id, user_id, title.strip() or "New Conversation")
        if db_conn:
            db_conn.execute(sql, params)
            return ConversationRepository.get_by_id_and_workspace(conv_id, workspace_id, db_conn=db_conn)  # type: ignore

        with get_db() as conn:
            conn.execute(sql, params)
            return ConversationRepository.get_by_id_and_workspace(conv_id, workspace_id, db_conn=conn)  # type: ignore

    @staticmethod
    def get_by_id_and_workspace(
        conversation_id: str,
        workspace_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        sql = """
            SELECT * FROM conversations 
            WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
        """
        params = (conversation_id, workspace_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def list_by_workspace(
        workspace_id: str,
        limit: int = 50,
        offset: int = 0,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        sql = """
            SELECT * FROM conversations 
            WHERE workspace_id = ? AND deleted_at IS NULL
            ORDER BY updated_at DESC
            LIMIT ? OFFSET ?
        """
        params = (workspace_id, limit, offset)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return [dict(row) for row in cursor.fetchall()]

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def update_title(
        conversation_id: str,
        workspace_id: str,
        title: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        sql = """
            UPDATE conversations
            SET title = ?,
                updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
        """
        params = (title.strip() or "Untitled", conversation_id, workspace_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0

    @staticmethod
    def touch_updated_at(
        conversation_id: str,
        workspace_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        sql = """
            UPDATE conversations
            SET updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
        """
        params = (conversation_id, workspace_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0

    @staticmethod
    def delete_conversation(
        conversation_id: str,
        workspace_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        sql = """
            UPDATE conversations
            SET deleted_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
        """
        params = (conversation_id, workspace_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0


class MessageRepository:
    @staticmethod
    def create_message(
        conversation_id: str,
        role: str,
        content: str,
        sources: Optional[List[Dict[str, Any]]] = None,
        token_count: int = 0,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        msg_id = str(uuid.uuid4())
        sources_json = json.dumps(sources or [])
        sql = """
            INSERT INTO messages (id, conversation_id, role, content, sources, token_count)
            VALUES (?, ?, ?, ?, ?, ?)
        """
        params = (msg_id, conversation_id, role, content, sources_json, token_count)
        if db_conn:
            db_conn.execute(sql, params)
            return MessageRepository.get_by_id(msg_id, db_conn=db_conn)  # type: ignore

        with get_db() as conn:
            conn.execute(sql, params)
            return MessageRepository.get_by_id(msg_id, db_conn=conn)  # type: ignore

    @staticmethod
    def get_by_id(
        message_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM messages WHERE id = ?"
        params = (message_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            if not row:
                return None
            res = dict(row)
            if isinstance(res.get("sources"), str):
                try:
                    res["sources"] = json.loads(res["sources"])
                except Exception:
                    res["sources"] = []
            return res

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            if not row:
                return None
            res = dict(row)
            if isinstance(res.get("sources"), str):
                try:
                    res["sources"] = json.loads(res["sources"])
                except Exception:
                    res["sources"] = []
            return res

    @staticmethod
    def list_by_conversation(
        conversation_id: str,
        limit: int = 100,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        sql = """
            SELECT * FROM messages 
            WHERE conversation_id = ?
            ORDER BY created_at ASC
            LIMIT ?
        """
        params = (conversation_id, limit)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                rows = cursor.fetchall()

        results = []
        for row in rows:
            item = dict(row)
            if isinstance(item.get("sources"), str):
                try:
                    item["sources"] = json.loads(item["sources"])
                except Exception:
                    item["sources"] = []
            results.append(item)
        return results

    @staticmethod
    def count_by_conversation(
        conversation_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> int:
        sql = "SELECT COUNT(*) FROM messages WHERE conversation_id = ?"
        params = (conversation_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.fetchone()[0]

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.fetchone()[0]


class UsageRepository:
    @staticmethod
    def record_usage(
        workspace_id: str,
        user_id: str,
        operation_type: str,
        provider: str,
        model: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        credits_used: int = 1,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        rec_id = str(uuid.uuid4())
        sql = """
            INSERT INTO usage_records (
                id, workspace_id, user_id, operation_type, provider,
                model, input_tokens, output_tokens, credits_used
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            rec_id, workspace_id, user_id, operation_type, provider,
            model, input_tokens, output_tokens, credits_used
        )
        if db_conn:
            db_conn.execute(sql, params)
            return UsageRepository.get_by_id(rec_id, db_conn=db_conn)  # type: ignore

        with get_db() as conn:
            conn.execute(sql, params)
            return UsageRepository.get_by_id(rec_id, db_conn=conn)  # type: ignore

    @staticmethod
    def get_by_id(
        record_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM usage_records WHERE id = ?"
        params = (record_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_monthly_credits_used(
        workspace_id: str,
        year_month: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> int:
        if year_month:
            sql = """
                SELECT COALESCE(SUM(credits_used), 0) FROM usage_records
                WHERE workspace_id = ? AND strftime('%Y-%m', created_at) = ?
            """
            params = (workspace_id, year_month)
        else:
            sql = """
                SELECT COALESCE(SUM(credits_used), 0) FROM usage_records
                WHERE workspace_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
            """
            params = (workspace_id,)

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.fetchone()[0]

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.fetchone()[0]


class PlanRepository:
    @staticmethod
    def get_plan(plan_id: str = "free", db_conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM plans WHERE id = ? AND is_active = 1"
        params = (plan_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_workspace_plan(workspace_id: str, db_conn: Optional[sqlite3.Connection] = None) -> Dict[str, Any]:
        plan = PlanRepository.get_plan("free", db_conn=db_conn)
        return plan or {
            "id": "free",
            "name": "Starter Free",
            "monthly_credits": 50,
            "max_documents": 3,
            "max_storage_mb": 50,
            "byok_allowed": 1,
        }


class FlashcardSetRepository:
    @staticmethod
    def create_set(
        workspace_id: str,
        user_id: str,
        title: str,
        description: Optional[str] = None,
        source_document_ids: Optional[List[str]] = None,
        card_count: int = 0,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        set_id = str(uuid.uuid4())
        doc_ids_json = json.dumps(source_document_ids or [])
        sql = """
            INSERT INTO flashcard_sets (id, workspace_id, user_id, title, description, source_document_ids, card_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        params = (set_id, workspace_id, user_id, title.strip() or "Untitled Flashcard Set", description, doc_ids_json, card_count)
        if db_conn:
            db_conn.execute(sql, params)
            return FlashcardSetRepository.get_by_id_and_workspace(set_id, workspace_id, db_conn=db_conn)  # type: ignore
        with get_db() as conn:
            conn.execute(sql, params)
            return FlashcardSetRepository.get_by_id_and_workspace(set_id, workspace_id, db_conn=conn)  # type: ignore

    @staticmethod
    def get_by_id_and_workspace(
        set_id: str,
        workspace_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        sql = """
            SELECT * FROM flashcard_sets 
            WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
        """
        params = (set_id, workspace_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                row = cursor.fetchone()
        if not row:
            return None
        res = dict(row)
        if isinstance(res.get("source_document_ids"), str):
            try:
                res["source_document_ids"] = json.loads(res["source_document_ids"])
            except Exception:
                res["source_document_ids"] = []
        return res

    @staticmethod
    def list_by_workspace(
        workspace_id: str,
        limit: int = 50,
        offset: int = 0,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        sql = """
            SELECT * FROM flashcard_sets
            WHERE workspace_id = ? AND deleted_at IS NULL
            ORDER BY updated_at DESC
            LIMIT ? OFFSET ?
        """
        params = (workspace_id, limit, offset)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                rows = cursor.fetchall()

        results = []
        for r in rows:
            item = dict(r)
            if isinstance(item.get("source_document_ids"), str):
                try:
                    item["source_document_ids"] = json.loads(item["source_document_ids"])
                except Exception:
                    item["source_document_ids"] = []
            results.append(item)
        return results

    @staticmethod
    def update_set(
        set_id: str,
        workspace_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        card_count: Optional[int] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        updates = []
        params = []
        if title is not None:
            updates.append("title = ?")
            params.append(title.strip() or "Untitled Flashcard Set")
        if description is not None:
            updates.append("description = ?")
            params.append(description)
        if card_count is not None:
            updates.append("card_count = ?")
            params.append(card_count)

        if not updates:
            return False

        updates.append("updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))")
        sql = f"""
            UPDATE flashcard_sets
            SET {", ".join(updates)}
            WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
        """
        params.extend([set_id, workspace_id])

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0

    @staticmethod
    def delete_set(
        set_id: str,
        workspace_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        sql = """
            UPDATE flashcard_sets
            SET deleted_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
        """
        params = (set_id, workspace_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0


class FlashcardRepository:
    @staticmethod
    def create_flashcards_batch(
        flashcard_set_id: str,
        cards: List[Dict[str, Any]],
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        created_cards = []
        sql = """
            INSERT INTO flashcards (id, flashcard_set_id, front, back, source_metadata, position)
            VALUES (?, ?, ?, ?, ?, ?)
        """
        params_list = []
        for idx, c in enumerate(cards):
            card_id = str(uuid.uuid4())
            sources_json = json.dumps(c.get("source_metadata") or [])
            pos = c.get("position", idx)
            front_text = c["front"].strip()
            back_text = c["back"].strip()
            params_list.append((card_id, flashcard_set_id, front_text, back_text, sources_json, pos))
            created_cards.append({
                "id": card_id,
                "flashcard_set_id": flashcard_set_id,
                "front": front_text,
                "back": back_text,
                "source_metadata": c.get("source_metadata") or [],
                "position": pos
            })

        if db_conn:
            db_conn.executemany(sql, params_list)
        else:
            with get_db() as conn:
                conn.executemany(sql, params_list)

        return created_cards

    @staticmethod
    def list_by_set(
        flashcard_set_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        sql = """
            SELECT * FROM flashcards
            WHERE flashcard_set_id = ?
            ORDER BY position ASC, created_at ASC
        """
        params = (flashcard_set_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                rows = cursor.fetchall()

        results = []
        for r in rows:
            item = dict(r)
            if isinstance(item.get("source_metadata"), str):
                try:
                    item["source_metadata"] = json.loads(item["source_metadata"])
                except Exception:
                    item["source_metadata"] = []
            results.append(item)
        return results

    @staticmethod
    def get_by_id_and_workspace(
        card_id: str,
        workspace_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        sql = """
            SELECT f.* FROM flashcards f
            JOIN flashcard_sets s ON f.flashcard_set_id = s.id
            WHERE f.id = ? AND s.workspace_id = ? AND s.deleted_at IS NULL
        """
        params = (card_id, workspace_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                row = cursor.fetchone()

        if not row:
            return None
        res = dict(row)
        if isinstance(res.get("source_metadata"), str):
            try:
                res["source_metadata"] = json.loads(res["source_metadata"])
            except Exception:
                res["source_metadata"] = []
        return res

    @staticmethod
    def update_card(
        card_id: str,
        front: Optional[str] = None,
        back: Optional[str] = None,
        position: Optional[int] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        updates = []
        params = []
        if front is not None:
            updates.append("front = ?")
            params.append(front.strip())
        if back is not None:
            updates.append("back = ?")
            params.append(back.strip())
        if position is not None:
            updates.append("position = ?")
            params.append(position)

        if not updates:
            return False

        updates.append("updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))")
        sql = f"""
            UPDATE flashcards
            SET {", ".join(updates)}
            WHERE id = ?
        """
        params.append(card_id)

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0

    @staticmethod
    def delete_card(
        card_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        sql = "DELETE FROM flashcards WHERE id = ?"
        params = (card_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0


class QuizRepository:
    @staticmethod
    def create_quiz(
        workspace_id: str,
        user_id: str,
        title: str,
        description: Optional[str] = None,
        source_document_ids: Optional[List[str]] = None,
        question_count: int = 0,
        difficulty: str = "medium",
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        quiz_id = str(uuid.uuid4())
        doc_ids_json = json.dumps(source_document_ids or [])
        diff_val = difficulty if difficulty in ("easy", "medium", "hard") else "medium"
        sql = """
            INSERT INTO quizzes (id, workspace_id, user_id, title, description, source_document_ids, question_count, difficulty)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (quiz_id, workspace_id, user_id, title.strip() or "Untitled Quiz", description, doc_ids_json, question_count, diff_val)
        if db_conn:
            db_conn.execute(sql, params)
            return QuizRepository.get_by_id_and_workspace(quiz_id, workspace_id, db_conn=db_conn)  # type: ignore
        with get_db() as conn:
            conn.execute(sql, params)
            return QuizRepository.get_by_id_and_workspace(quiz_id, workspace_id, db_conn=conn)  # type: ignore

    @staticmethod
    def get_by_id_and_workspace(
        quiz_id: str,
        workspace_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        sql = """
            SELECT * FROM quizzes 
            WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
        """
        params = (quiz_id, workspace_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                row = cursor.fetchone()
        if not row:
            return None
        res = dict(row)
        if isinstance(res.get("source_document_ids"), str):
            try:
                res["source_document_ids"] = json.loads(res["source_document_ids"])
            except Exception:
                res["source_document_ids"] = []
        return res

    @staticmethod
    def list_by_workspace(
        workspace_id: str,
        limit: int = 50,
        offset: int = 0,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        sql = """
            SELECT * FROM quizzes
            WHERE workspace_id = ? AND deleted_at IS NULL
            ORDER BY updated_at DESC
            LIMIT ? OFFSET ?
        """
        params = (workspace_id, limit, offset)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                rows = cursor.fetchall()

        results = []
        for r in rows:
            item = dict(r)
            if isinstance(item.get("source_document_ids"), str):
                try:
                    item["source_document_ids"] = json.loads(item["source_document_ids"])
                except Exception:
                    item["source_document_ids"] = []
            results.append(item)
        return results

    @staticmethod
    def update_quiz(
        quiz_id: str,
        workspace_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        question_count: Optional[int] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        updates = []
        params = []
        if title is not None:
            updates.append("title = ?")
            params.append(title.strip())
        if description is not None:
            updates.append("description = ?")
            params.append(description.strip())
        if question_count is not None:
            updates.append("question_count = ?")
            params.append(question_count)

        if not updates:
            return False

        updates.append("updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))")
        sql = f"""
            UPDATE quizzes
            SET {", ".join(updates)}
            WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
        """
        params.extend([quiz_id, workspace_id])

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, tuple(params))
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, tuple(params))
            return cursor.rowcount > 0

    @staticmethod
    def delete_quiz(
        quiz_id: str,
        workspace_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        sql = """
            UPDATE quizzes
            SET deleted_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL
        """
        params = (quiz_id, workspace_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0


class QuizQuestionRepository:
    @staticmethod
    def create_questions_batch(
        quiz_id: str,
        questions: List[Dict[str, Any]],
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        if not questions:
            return []

        sql = """
            INSERT INTO quiz_questions (
                id, quiz_id, type, question, options, correct_answer,
                explanation, source_metadata, position
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params_list = []
        created_records = []

        for idx, q in enumerate(questions):
            q_id = str(uuid.uuid4())
            q_type = q.get("type", "multiple_choice")
            q_text = str(q.get("question", "")).strip()
            options_val = q.get("options") or []
            options_json = json.dumps(options_val)
            correct_ans = str(q.get("correct_answer", "")).strip()
            explanation = str(q.get("explanation", "")).strip()
            sources_val = q.get("source_metadata") or []
            sources_json = json.dumps(sources_val)
            pos = q.get("position", idx)

            params_list.append((
                q_id, quiz_id, q_type, q_text, options_json, correct_ans,
                explanation, sources_json, pos
            ))
            created_records.append({
                "id": q_id,
                "quiz_id": quiz_id,
                "type": q_type,
                "question": q_text,
                "options": options_val,
                "correct_answer": correct_ans,
                "explanation": explanation,
                "source_metadata": sources_val,
                "position": pos
            })

        if db_conn:
            db_conn.executemany(sql, params_list)
        else:
            with get_db() as conn:
                conn.executemany(sql, params_list)

        return created_records

    @staticmethod
    def list_by_quiz(
        quiz_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        sql = """
            SELECT * FROM quiz_questions
            WHERE quiz_id = ?
            ORDER BY position ASC, created_at ASC
        """
        params = (quiz_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                rows = cursor.fetchall()

        results = []
        for r in rows:
            item = dict(r)
            for json_field in ("options", "source_metadata"):
                if isinstance(item.get(json_field), str):
                    try:
                        item[json_field] = json.loads(item[json_field])
                    except Exception:
                        item[json_field] = []
            results.append(item)
        return results

    @staticmethod
    def get_by_id_and_workspace(
        question_id: str,
        workspace_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        sql = """
            SELECT q.* FROM quiz_questions q
            JOIN quizzes z ON q.quiz_id = z.id
            WHERE q.id = ? AND z.workspace_id = ? AND z.deleted_at IS NULL
        """
        params = (question_id, workspace_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                row = cursor.fetchone()

        if not row:
            return None
        res = dict(row)
        for json_field in ("options", "source_metadata"):
            if isinstance(res.get(json_field), str):
                try:
                    res[json_field] = json.loads(res[json_field])
                except Exception:
                    res[json_field] = []
        return res

    @staticmethod
    def update_question(
        question_id: str,
        question: Optional[str] = None,
        options: Optional[List[str]] = None,
        correct_answer: Optional[str] = None,
        explanation: Optional[str] = None,
        position: Optional[int] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        updates = []
        params = []
        if question is not None:
            updates.append("question = ?")
            params.append(question.strip())
        if options is not None:
            updates.append("options = ?")
            params.append(json.dumps(options))
        if correct_answer is not None:
            updates.append("correct_answer = ?")
            params.append(str(correct_answer).strip())
        if explanation is not None:
            updates.append("explanation = ?")
            params.append(explanation.strip())
        if position is not None:
            updates.append("position = ?")
            params.append(position)

        if not updates:
            return False

        updates.append("updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))")
        sql = f"""
            UPDATE quiz_questions
            SET {", ".join(updates)}
            WHERE id = ?
        """
        params.append(question_id)

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, tuple(params))
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, tuple(params))
            return cursor.rowcount > 0

    @staticmethod
    def delete_question(
        question_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        find_sql = "SELECT quiz_id FROM quiz_questions WHERE id = ?"
        del_sql = "DELETE FROM quiz_questions WHERE id = ?"
        update_count_sql = """
            UPDATE quizzes 
            SET question_count = (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = ?),
                updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            WHERE id = ?
        """

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(find_sql, (question_id,))
            row = cursor.fetchone()
            if not row:
                return False
            quiz_id = row["quiz_id"] if isinstance(row, dict) else row[0]
            cursor.execute(del_sql, (question_id,))
            if cursor.rowcount > 0:
                cursor.execute(update_count_sql, (quiz_id, quiz_id))
                return True
            return False

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(find_sql, (question_id,))
            row = cursor.fetchone()
            if not row:
                return False
            quiz_id = row["quiz_id"] if isinstance(row, dict) else row[0]
            cursor.execute(del_sql, (question_id,))
            if cursor.rowcount > 0:
                cursor.execute(update_count_sql, (quiz_id, quiz_id))
                return True
            return False


class QuizAttemptRepository:
    @staticmethod
    def create_attempt(
        workspace_id: str,
        user_id: str,
        quiz_id: str,
        total_questions: int = 0,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        attempt_id = str(uuid.uuid4())
        sql = """
            INSERT INTO quiz_attempts (
                id, workspace_id, user_id, quiz_id, status, started_at,
                score, percentage, total_questions, correct_answers
            )
            VALUES (?, ?, ?, ?, 'in_progress', (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')), 0.0, 0.0, ?, 0)
        """
        params = (attempt_id, workspace_id, user_id, quiz_id, total_questions)
        if db_conn:
            db_conn.execute(sql, params)
            return QuizAttemptRepository.get_by_id_and_workspace(attempt_id, workspace_id, db_conn=db_conn)  # type: ignore
        with get_db() as conn:
            conn.execute(sql, params)
            return QuizAttemptRepository.get_by_id_and_workspace(attempt_id, workspace_id, db_conn=conn)  # type: ignore

    @staticmethod
    def get_by_id_and_workspace(
        attempt_id: str,
        workspace_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        sql = """
            SELECT * FROM quiz_attempts
            WHERE id = ? AND workspace_id = ?
        """
        params = (attempt_id, workspace_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                row = cursor.fetchone()
        return dict(row) if row else None

    @staticmethod
    def list_by_user_and_quiz(
        quiz_id: str,
        workspace_id: str,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        sql = """
            SELECT * FROM quiz_attempts
            WHERE quiz_id = ? AND workspace_id = ? AND user_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """
        params = (quiz_id, workspace_id, user_id, limit, offset)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                rows = cursor.fetchall()
        return [dict(r) for r in rows]

    @staticmethod
    def finalize_attempt(
        attempt_id: str,
        score: float,
        percentage: float,
        correct_answers: int,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        sql = """
            UPDATE quiz_attempts
            SET status = 'submitted',
                submitted_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                score = ?,
                percentage = ?,
                correct_answers = ?,
                updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            WHERE id = ? AND status = 'in_progress'
        """
        params = (score, percentage, correct_answers, attempt_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0

    @staticmethod
    def abandon_attempt(
        attempt_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        sql = """
            UPDATE quiz_attempts
            SET status = 'abandoned',
                updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            WHERE id = ? AND status = 'in_progress'
        """
        params = (attempt_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0


class QuizAnswerRepository:
    @staticmethod
    def save_answer(
        attempt_id: str,
        question_id: str,
        selected_answer: str,
        is_correct: bool = False,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        ans_id = str(uuid.uuid4())
        sql = """
            INSERT INTO quiz_answers (id, attempt_id, question_id, selected_answer, is_correct)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(attempt_id, question_id) DO UPDATE SET
                selected_answer = excluded.selected_answer,
                is_correct = excluded.is_correct,
                answered_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        """
        params = (ans_id, attempt_id, question_id, str(selected_answer).strip(), 1 if is_correct else 0)
        if db_conn:
            db_conn.execute(sql, params)
        else:
            with get_db() as conn:
                conn.execute(sql, params)
        return {
            "attempt_id": attempt_id,
            "question_id": question_id,
            "selected_answer": str(selected_answer).strip(),
            "is_correct": 1 if is_correct else 0
        }

    @staticmethod
    def save_answers_batch(
        attempt_id: str,
        answers: List[Dict[str, Any]],
        db_conn: Optional[sqlite3.Connection] = None
    ) -> None:
        if not answers:
            return
        sql = """
            INSERT INTO quiz_answers (id, attempt_id, question_id, selected_answer, is_correct)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(attempt_id, question_id) DO UPDATE SET
                selected_answer = excluded.selected_answer,
                is_correct = excluded.is_correct,
                answered_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        """
        params_list = [
            (str(uuid.uuid4()), attempt_id, a["question_id"], str(a.get("selected_answer", "")).strip(), 1 if a.get("is_correct") else 0)
            for a in answers
        ]
        if db_conn:
            db_conn.executemany(sql, params_list)
        else:
            with get_db() as conn:
                conn.executemany(sql, params_list)

    @staticmethod
    def list_by_attempt(
        attempt_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        sql = "SELECT * FROM quiz_answers WHERE attempt_id = ?"
        params = (attempt_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                rows = cursor.fetchall()
        return [dict(r) for r in rows]


class LearningItemRepository:
    @staticmethod
    def get_or_create(
        workspace_id: str,
        user_id: str,
        content_type: str,
        content_id: str,
        source_reference: Optional[Dict[str, Any]] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        find_sql = """
            SELECT * FROM learning_items
            WHERE workspace_id = ? AND user_id = ? AND content_type = ? AND content_id = ?
        """
        find_params = (workspace_id, user_id, content_type, content_id)

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(find_sql, find_params)
            row = cursor.fetchone()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(find_sql, find_params)
                row = cursor.fetchone()

        if row:
            res = dict(row)
            for field in ("source_reference", "scheduling_metadata"):
                if isinstance(res.get(field), str):
                    try:
                        res[field] = json.loads(res[field])
                    except Exception:
                        res[field] = {}
            return res

        item_id = str(uuid.uuid4())
        ref_json = json.dumps(source_reference or {})
        insert_sql = """
            INSERT INTO learning_items (
                id, workspace_id, user_id, content_type, content_id,
                source_reference, correct_count, incorrect_count, scheduling_metadata
            )
            VALUES (?, ?, ?, ?, ?, ?, 0, 0, '{}')
        """
        insert_params = (item_id, workspace_id, user_id, content_type, content_id, ref_json)

        if db_conn:
            db_conn.execute(insert_sql, insert_params)
        else:
            with get_db() as conn:
                conn.execute(insert_sql, insert_params)

        return {
            "id": item_id,
            "workspace_id": workspace_id,
            "user_id": user_id,
            "content_type": content_type,
            "content_id": content_id,
            "source_reference": source_reference or {},
            "correct_count": 0,
            "incorrect_count": 0,
            "last_seen_at": None,
            "next_review_at": None,
            "scheduling_metadata": {}
        }

    @staticmethod
    def update_learning_progress(
        item_id: str,
        is_correct: bool,
        next_review_at: str,
        scheduling_metadata: Optional[Dict[str, Any]] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        meta_json = json.dumps(scheduling_metadata or {})
        inc_correct = 1 if is_correct else 0
        inc_incorrect = 0 if is_correct else 1
        sql = """
            UPDATE learning_items
            SET correct_count = correct_count + ?,
                incorrect_count = incorrect_count + ?,
                last_seen_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                next_review_at = ?,
                scheduling_metadata = ?,
                updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            WHERE id = ?
        """
        params = (inc_correct, inc_incorrect, next_review_at, meta_json, item_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0

    @staticmethod
    def get_progress_summary(
        workspace_id: str,
        user_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        sql = """
            SELECT 
                COUNT(*) as total_items,
                SUM(CASE WHEN correct_count > 0 OR incorrect_count > 0 THEN 1 ELSE 0 END) as reviewed_items,
                SUM(correct_count) as total_correct,
                SUM(incorrect_count) as total_incorrect,
                SUM(CASE WHEN next_review_at IS NOT NULL AND next_review_at <= (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) THEN 1 ELSE 0 END) as due_items
            FROM learning_items
            WHERE workspace_id = ? AND user_id = ?
        """
        params = (workspace_id, user_id)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            row = cursor.fetchone()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                row = cursor.fetchone()

        row_dict = dict(row) if row else {}
        total_items = row_dict.get("total_items") or 0
        reviewed_items = row_dict.get("reviewed_items") or 0
        total_correct = row_dict.get("total_correct") or 0
        total_incorrect = row_dict.get("total_incorrect") or 0
        due_items = row_dict.get("due_items") or 0

        total_reviews = total_correct + total_incorrect
        correct_rate = round((total_correct / total_reviews) * 100.0, 2) if total_reviews > 0 else 0.0

        return {
            "total_items": total_items,
            "reviewed_items": reviewed_items,
            "correct_rate": correct_rate,
            "due_items_count": due_items
        }

    @staticmethod
    def list_due_items(
        workspace_id: str,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        sql = """
            SELECT * FROM learning_items
            WHERE workspace_id = ? AND user_id = ? 
              AND next_review_at IS NOT NULL 
              AND next_review_at <= (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            ORDER BY next_review_at ASC
            LIMIT ? OFFSET ?
        """
        params = (workspace_id, user_id, limit, offset)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                rows = cursor.fetchall()

        results = []
        for r in rows:
            item = dict(r)
            for field in ("source_reference", "scheduling_metadata"):
                if isinstance(item.get(field), str):
                    try:
                        item[field] = json.loads(item[field])
                    except Exception:
                        item[field] = {}
            results.append(item)
        return results


class ReviewEventRepository:
    @staticmethod
    def create_event(
        workspace_id: str,
        user_id: str,
        content_type: str,
        content_id: str,
        result: str,
        source_type: str = "quiz_attempt",
        source_id: Optional[str] = None,
        learning_item_id: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        event_id = str(uuid.uuid4())
        sql = """
            INSERT INTO review_events (
                id, workspace_id, user_id, learning_item_id, content_type,
                content_id, result, source_type, source_id, reviewed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')))
        """
        params = (
            event_id, workspace_id, user_id, learning_item_id, content_type,
            content_id, result, source_type, source_id
        )
        if db_conn:
            db_conn.execute(sql, params)
        else:
            with get_db() as conn:
                conn.execute(sql, params)

        return {
            "id": event_id,
            "workspace_id": workspace_id,
            "user_id": user_id,
            "learning_item_id": learning_item_id,
            "content_type": content_type,
            "content_id": content_id,
            "result": result,
            "source_type": source_type,
            "source_id": source_id
        }

    @staticmethod
    def list_by_user(
        workspace_id: str,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        sql = """
            SELECT * FROM review_events
            WHERE workspace_id = ? AND user_id = ?
            ORDER BY reviewed_at DESC
            LIMIT ? OFFSET ?
        """
        params = (workspace_id, user_id, limit, offset)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                rows = cursor.fetchall()
        return [dict(r) for r in rows]





