"""
Data Access Repositories for Recall AI Foundation.
Enforces tenant scoping, parameterized queries, and transactional safety.
"""

from datetime import datetime, timezone, timedelta
import json
import uuid
from typing import Any, Dict, List, Optional, Union
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

    @staticmethod
    def ensure_user(
        user_id: str,
        email: str,
        full_name: Optional[str] = None,
        avatar_url: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        existing = UserRepository.get_by_id(user_id, db_conn=db_conn)
        if existing:
            return existing
        existing_email = UserRepository.get_by_email(email, db_conn=db_conn)
        if existing_email:
            return existing_email

        sql = """
            INSERT INTO users (id, email, password_hash, full_name, avatar_url, is_active)
            VALUES (?, ?, 'supabase_oauth_user', ?, ?, 1)
        """
        params = (user_id, email.strip().lower(), full_name, avatar_url)
        if db_conn:
            db_conn.execute(sql, params)
            user = UserRepository.get_by_id(user_id, db_conn=db_conn)
        else:
            with get_db() as conn:
                conn.execute(sql, params)
                user = UserRepository.get_by_id(user_id, db_conn=conn)

        # Ensure default preferences exist for user
        if user:
            try:
                PreferencesRepository.create_preferences(
                    user_id=user["id"],
                    theme="neo-brutalist",
                    daily_review_goal=20,
                    preferred_llm_provider="auto",
                    db_conn=db_conn
                )
            except Exception:
                pass
        return user  # type: ignore


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

    @staticmethod
    def get_total_storage_bytes(workspace_id: str, db_conn: Optional[sqlite3.Connection] = None) -> int:
        sql = "SELECT COALESCE(SUM(size_bytes), 0) FROM files WHERE workspace_id = ?"
        params = (workspace_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.fetchone()[0]
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.fetchone()[0]


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
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> int:
        if start_date and end_date:
            sql = """
                SELECT COALESCE(SUM(credits_used), 0) FROM usage_records
                WHERE workspace_id = ? AND created_at >= ? AND created_at <= ?
            """
            params = (workspace_id, start_date, end_date)
        elif year_month:
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
    def _parse_plan(row: Optional[sqlite3.Row]) -> Optional[Dict[str, Any]]:
        if not row:
            return None
        res = dict(row)
        raw_features = res.get("features")
        if isinstance(raw_features, str):
            try:
                res["features"] = json.loads(raw_features)
            except Exception:
                res["features"] = {}
        elif not isinstance(raw_features, dict):
            res["features"] = {}
        return res

    @staticmethod
    def get_plan(plan_id: str = "free", db_conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM plans WHERE id = ? AND is_active = 1"
        params = (plan_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return PlanRepository._parse_plan(cursor.fetchone())
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return PlanRepository._parse_plan(cursor.fetchone())

    @staticmethod
    def list_plans(active_only: bool = True, db_conn: Optional[sqlite3.Connection] = None) -> List[Dict[str, Any]]:
        sql = "SELECT * FROM plans WHERE is_active = 1 ORDER BY price_cents ASC" if active_only else "SELECT * FROM plans ORDER BY price_cents ASC"
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql)
            return [PlanRepository._parse_plan(row) for row in cursor.fetchall() if row]  # type: ignore
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql)
            return [PlanRepository._parse_plan(row) for row in cursor.fetchall() if row]  # type: ignore

    @staticmethod
    def get_workspace_plan(workspace_id: str, db_conn: Optional[sqlite3.Connection] = None) -> Dict[str, Any]:
        # Check active subscription first
        sub = SubscriptionRepository.get_active_by_workspace(workspace_id, db_conn=db_conn)
        if sub and sub.get("plan_id"):
            plan = PlanRepository.get_plan(sub["plan_id"], db_conn=db_conn)
            if plan:
                return plan

        plan = PlanRepository.get_plan("free", db_conn=db_conn)
        return plan or {
            "id": "free",
            "name": "Starter Free",
            "price_cents": 0,
            "billing_interval": "month",
            "monthly_credits": 50,
            "max_documents": 10,
            "max_storage_mb": 50,
            "byok_allowed": 1,
            "features": {
                "documents": True,
                "document_storage": True,
                "ai_chat": True,
                "semantic_search": True,
                "summaries": True,
                "concepts": True,
                "flashcards": True,
                "quizzes": True,
                "reviews": True,
                "analytics": True,
                "byok": True,
                "exports": False,
            }
        }


class SubscriptionRepository:
    @staticmethod
    def create_subscription(
        workspace_id: str,
        plan_id: str,
        user_id: Optional[str] = None,
        status: str = "active",
        provider: str = "stripe",
        provider_customer_id: Optional[str] = None,
        provider_subscription_id: Optional[str] = None,
        current_period_start: Optional[str] = None,
        current_period_end: Optional[str] = None,
        cancel_at_period_end: int = 0,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        sub_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        now_iso = now.strftime('%Y-%m-%dT%H:%M:%SZ')
        period_start = current_period_start or now_iso
        period_end = current_period_end or (now + timedelta(days=30)).strftime('%Y-%m-%dT%H:%M:%SZ')
        prov_sub_id = provider_subscription_id or f"sub_mock_{uuid.uuid4().hex[:12]}"

        # Resolve user_id from workspace owner if missing or placeholder
        actual_user_id = user_id
        if not actual_user_id or actual_user_id == "system":
            ws = WorkspaceRepository.get_by_id(workspace_id, db_conn=db_conn)
            if ws:
                actual_user_id = ws.get("owner_id")
            else:
                actual_user_id = None

        sql = """
            INSERT INTO subscriptions (
                id, workspace_id, user_id, plan_id, status, provider,
                provider_customer_id, provider_subscription_id,
                current_period_start, current_period_end, cancel_at_period_end
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            sub_id, workspace_id, actual_user_id, plan_id, status, provider,
            provider_customer_id, prov_sub_id, period_start, period_end,
            cancel_at_period_end
        )
        if db_conn:
            db_conn.execute(sql, params)
            return SubscriptionRepository.get_by_id(sub_id, db_conn=db_conn)  # type: ignore
        with get_db() as conn:
            conn.execute(sql, params)
            return SubscriptionRepository.get_by_id(sub_id, db_conn=conn)  # type: ignore

    @staticmethod
    def get_by_id(subscription_id: str, db_conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM subscriptions WHERE id = ?"
        params = (subscription_id,)
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
    def get_active_by_workspace(workspace_id: str, db_conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
        now_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        sql = """
            SELECT * FROM subscriptions
            WHERE workspace_id = ?
              AND (
                status IN ('active', 'trialing')
                OR (status = 'canceled' AND current_period_end > ?)
              )
            ORDER BY created_at DESC
            LIMIT 1
        """
        params = (workspace_id, now_iso)
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
    def get_latest_by_workspace(workspace_id: str, db_conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM subscriptions WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 1"
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

    @staticmethod
    def get_by_provider_subscription_id(provider_sub_id: str, db_conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM subscriptions WHERE provider_subscription_id = ?"
        params = (provider_sub_id,)
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
    def update_subscription(
        subscription_id: str,
        status: Optional[str] = None,
        plan_id: Optional[str] = None,
        current_period_start: Optional[str] = None,
        current_period_end: Optional[str] = None,
        cancel_at_period_end: Optional[int] = None,
        canceled_at: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        updates = ["updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))"]
        params: List[Any] = []
        if status is not None:
            updates.append("status = ?")
            params.append(status)
        if plan_id is not None:
            updates.append("plan_id = ?")
            params.append(plan_id)
        if current_period_start is not None:
            updates.append("current_period_start = ?")
            params.append(current_period_start)
        if current_period_end is not None:
            updates.append("current_period_end = ?")
            params.append(current_period_end)
        if cancel_at_period_end is not None:
            updates.append("cancel_at_period_end = ?")
            params.append(cancel_at_period_end)
        if canceled_at is not None:
            updates.append("canceled_at = ?")
            params.append(canceled_at)

        params.append(subscription_id)
        sql = f"UPDATE subscriptions SET {', '.join(updates)} WHERE id = ?"
        if db_conn:
            db_conn.execute(sql, tuple(params))
            return SubscriptionRepository.get_by_id(subscription_id, db_conn=db_conn)
        with get_db() as conn:
            conn.execute(sql, tuple(params))
            return SubscriptionRepository.get_by_id(subscription_id, db_conn=conn)

    @staticmethod
    def cancel_subscription(
        subscription_id: str,
        at_period_end: bool = True,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        now_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        if at_period_end:
            return SubscriptionRepository.update_subscription(
                subscription_id,
                cancel_at_period_end=1,
                canceled_at=now_iso,
                db_conn=db_conn
            )
        else:
            return SubscriptionRepository.update_subscription(
                subscription_id,
                status="canceled",
                current_period_end=now_iso,
                cancel_at_period_end=0,
                canceled_at=now_iso,
                db_conn=db_conn
            )

    @staticmethod
    def reactivate_subscription(
        subscription_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        return SubscriptionRepository.update_subscription(
            subscription_id,
            status="active",
            cancel_at_period_end=0,
            canceled_at=None,
            db_conn=db_conn
        )


class BillingEventRepository:
    @staticmethod
    def record_event(
        event_id: str,
        provider: str,
        event_type: str,
        payload: Union[str, Dict[str, Any]],
        status: str = "processed",
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        rec_id = str(uuid.uuid4())
        payload_str = json.dumps(payload) if isinstance(payload, dict) else str(payload)
        sql = """
            INSERT INTO billing_events (id, event_id, provider, event_type, payload, status)
            VALUES (?, ?, ?, ?, ?, ?)
        """
        params = (rec_id, event_id, provider, event_type, payload_str, status)
        if db_conn:
            db_conn.execute(sql, params)
            return {"id": rec_id, "event_id": event_id, "status": status}
        with get_db() as conn:
            conn.execute(sql, params)
            return {"id": rec_id, "event_id": event_id, "status": status}

    @staticmethod
    def has_event(event_id: str, db_conn: Optional[sqlite3.Connection] = None) -> bool:
        sql = "SELECT 1 FROM billing_events WHERE event_id = ?"
        params = (event_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.fetchone() is not None
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.fetchone() is not None


class UsageReservationRepository:
    @staticmethod
    def create_reservation(
        workspace_id: str,
        user_id: str,
        feature: str,
        quantity: int = 1,
        ttl_seconds: int = 300,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        res_id = str(uuid.uuid4())
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).strftime('%Y-%m-%dT%H:%M:%SZ')
        sql = """
            INSERT INTO usage_reservations (id, workspace_id, user_id, feature, quantity, status, expires_at)
            VALUES (?, ?, ?, ?, ?, 'pending', ?)
        """
        params = (res_id, workspace_id, user_id, feature, quantity, expires_at)
        if db_conn:
            db_conn.execute(sql, params)
            return {
                "id": res_id,
                "workspace_id": workspace_id,
                "user_id": user_id,
                "feature": feature,
                "quantity": quantity,
                "status": "pending",
                "expires_at": expires_at
            }
        with get_db() as conn:
            conn.execute(sql, params)
            return {
                "id": res_id,
                "workspace_id": workspace_id,
                "user_id": user_id,
                "feature": feature,
                "quantity": quantity,
                "status": "pending",
                "expires_at": expires_at
            }

    @staticmethod
    def get_active_reserved_quantity(
        workspace_id: str,
        feature: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> int:
        now_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        if feature:
            sql = """
                SELECT COALESCE(SUM(quantity), 0) FROM usage_reservations
                WHERE workspace_id = ? AND feature = ? AND status = 'pending' AND expires_at > ?
            """
            params = (workspace_id, feature, now_iso)
        else:
            sql = """
                SELECT COALESCE(SUM(quantity), 0) FROM usage_reservations
                WHERE workspace_id = ? AND status = 'pending' AND expires_at > ?
            """
            params = (workspace_id, now_iso)

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.fetchone()[0]
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.fetchone()[0]

    @staticmethod
    def finalize_reservation(
        reservation_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        sql = """
            UPDATE usage_reservations
            SET status = 'finalized', finalized_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            WHERE id = ? AND status = 'pending'
        """
        params = (reservation_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0

    @staticmethod
    def release_reservation(
        reservation_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        sql = """
            UPDATE usage_reservations
            SET status = 'released', released_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            WHERE id = ? AND status = 'pending'
        """
        params = (reservation_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0

    @staticmethod
    def cleanup_expired(db_conn: Optional[sqlite3.Connection] = None) -> int:
        now_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        sql = "UPDATE usage_reservations SET status = 'expired' WHERE status = 'pending' AND expires_at <= ?"
        params = (now_iso,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount


class AccountOverrideRepository:
    @staticmethod
    def get_overrides(workspace_id: str, db_conn: Optional[sqlite3.Connection] = None) -> Dict[str, Any]:
        sql = "SELECT feature_or_limit, override_value FROM account_overrides WHERE workspace_id = ?"
        params = (workspace_id,)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                rows = cursor.fetchall()

        overrides = {}
        for r in rows:
            key = r[0]
            val_str = r[1]
            try:
                overrides[key] = json.loads(val_str)
            except Exception:
                overrides[key] = val_str
        return overrides

    @staticmethod
    def set_override(
        workspace_id: str,
        feature_or_limit: str,
        override_value: Any,
        reason: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> None:
        val_str = json.dumps(override_value)
        sql = """
            INSERT INTO account_overrides (id, workspace_id, feature_or_limit, override_value, reason)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(workspace_id, feature_or_limit) DO UPDATE SET
                override_value = excluded.override_value,
                reason = excluded.reason,
                updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        """
        params = (str(uuid.uuid4()), workspace_id, feature_or_limit, val_str, reason)
        if db_conn:
            db_conn.execute(sql, params)
        else:
            with get_db() as conn:
                conn.execute(sql, params)

    @staticmethod
    def delete_override(workspace_id: str, feature_or_limit: str, db_conn: Optional[sqlite3.Connection] = None) -> bool:
        sql = "DELETE FROM account_overrides WHERE workspace_id = ? AND feature_or_limit = ?"
        params = (workspace_id, feature_or_limit)
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0


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
    def create_card(
        flashcard_set_id: str,
        front: str,
        back: str,
        source_metadata: Optional[List[Dict[str, Any]]] = None,
        position: int = 0,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        cards = FlashcardRepository.create_flashcards_batch(
            flashcard_set_id=flashcard_set_id,
            cards=[{"front": front, "back": back, "source_metadata": source_metadata or [], "position": position}],
            db_conn=db_conn
        )
        return cards[0]

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
    def get_by_id(
        card_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM flashcards WHERE id = ?"
        params = (card_id,)
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

        from app.services.scheduler import FSRSScheduler
        initial_meta = FSRSScheduler.init_card_metadata()
        meta_json = json.dumps(initial_meta)

        item_id = str(uuid.uuid4())
        ref_json = json.dumps(source_reference or {})
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        insert_sql = """
            INSERT INTO learning_items (
                id, workspace_id, user_id, content_type, content_id,
                source_reference, correct_count, incorrect_count, next_review_at, scheduling_metadata
            )
            VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
        """
        insert_params = (item_id, workspace_id, user_id, content_type, content_id, ref_json, now_iso, meta_json)

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
            "next_review_at": now_iso,
            "scheduling_metadata": initial_meta
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

    @staticmethod
    def get_by_id(
        item_id: str,
        workspace_id: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM learning_items WHERE id = ?"
        params: List[Any] = [item_id]
        if workspace_id:
            sql += " AND workspace_id = ?"
            params.append(workspace_id)

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, tuple(params))
            row = cursor.fetchone()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, tuple(params))
                row = cursor.fetchone()

        if not row:
            return None
        res = dict(row)
        for field in ("source_reference", "scheduling_metadata"):
            if isinstance(res.get(field), str):
                try:
                    res[field] = json.loads(res[field])
                except Exception:
                    res[field] = {}
        return res

    @staticmethod
    def init_items_for_content(
        workspace_id: str,
        user_id: str,
        content_type: str,
        items: List[Dict[str, Any]],
        db_conn: Optional[sqlite3.Connection] = None
    ) -> int:
        """
        Batch creates learning items for newly generated content (e.g. flashcards)
        with initial 'new' FSRS state if they do not already exist.
        Each item in items dict should have 'id' and optional 'source_reference'.
        """
        from app.services.scheduler import FSRSScheduler
        initial_meta = json.dumps(FSRSScheduler.init_card_metadata())
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        sql = """
            INSERT OR IGNORE INTO learning_items (
                id, workspace_id, user_id, content_type, content_id,
                source_reference, correct_count, incorrect_count, last_seen_at,
                next_review_at, scheduling_metadata, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 0, 0, NULL, ?, ?, ?, ?)
        """
        rows = [
            (
                str(uuid.uuid4()),
                workspace_id,
                user_id,
                content_type,
                str(item["id"]),
                json.dumps(item.get("source_reference", {})),
                now_iso,  # Initial cards can be scheduled due immediately
                initial_meta,
                now_iso,
                now_iso
            )
            for item in items
        ]

        def _exec(conn: sqlite3.Connection) -> int:
            cursor = conn.cursor()
            cursor.executemany(sql, rows)
            return cursor.rowcount

        if db_conn:
            return _exec(db_conn)
        with get_db() as conn:
            return _exec(conn)

    @staticmethod
    def get_due_queue(
        workspace_id: str,
        user_id: str,
        limit: int = 50,
        content_type: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        """
        Queries due items with deterministic priority ordering:
        1. Overdue items (next_review_at < now - 24 hours)
        2. Due now items (next_review_at <= now)
        3. New items (last_seen_at IS NULL)
        """
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        type_filter = "AND content_type = ?" if content_type else ""
        sql = f"""
            SELECT *,
                CASE 
                    WHEN last_seen_at IS NULL THEN 'new'
                    WHEN next_review_at < datetime(?, '-1 day') THEN 'overdue'
                    ELSE 'due_now'
                END as priority_group
            FROM learning_items
            WHERE workspace_id = ? AND user_id = ?
              AND (next_review_at IS NULL OR next_review_at <= ?)
              {type_filter}
            ORDER BY 
                CASE 
                    WHEN next_review_at < datetime(?, '-1 day') THEN 1
                    WHEN next_review_at <= ? THEN 2
                    ELSE 3
                END ASC,
                next_review_at ASC,
                created_at ASC
            LIMIT ?
        """
        params: List[Any] = [now_iso, workspace_id, user_id, now_iso]
        if content_type:
            params.append(content_type)
        params.extend([now_iso, now_iso, limit])

        def _fetch(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
            cursor = conn.cursor()
            cursor.execute(sql, tuple(params))
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

        if db_conn:
            return _fetch(db_conn)
        with get_db() as conn:
            return _fetch(conn)

    @staticmethod
    def get_statistics(
        workspace_id: str,
        user_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        """
        Calculates memory and review statistics for the workspace user:
        - due_count: items with next_review_at <= now
        - overdue_count: items with next_review_at < now - 24 hours
        - reviewed_today: reviews in last 24 hours
        - correct_rate: percentage of successful reviews
        - total_items: count of learning items
        """
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        sql_items = """
            SELECT 
                COUNT(*) as total_items,
                SUM(CASE WHEN next_review_at IS NOT NULL AND next_review_at <= ? THEN 1 ELSE 0 END) as due_count,
                SUM(CASE WHEN next_review_at IS NOT NULL AND next_review_at < datetime(?, '-1 day') THEN 1 ELSE 0 END) as overdue_count
            FROM learning_items
            WHERE workspace_id = ? AND user_id = ?
        """
        sql_events = """
            SELECT 
                COUNT(*) as reviewed_today,
                SUM(CASE WHEN rating IN ('good', 'easy', 'correct') OR result = 'correct' THEN 1 ELSE 0 END) as correct_today
            FROM review_events
            WHERE workspace_id = ? AND user_id = ?
              AND reviewed_at >= datetime(?, '-1 day')
        """

        def _calc(conn: sqlite3.Connection) -> Dict[str, Any]:
            cur = conn.cursor()
            cur.execute(sql_items, (now_iso, now_iso, workspace_id, user_id))
            item_stats = dict(cur.fetchone() or {})

            cur.execute(sql_events, (workspace_id, user_id, now_iso))
            event_stats = dict(cur.fetchone() or {})

            total_items = item_stats.get("total_items") or 0
            due_count = item_stats.get("due_count") or 0
            overdue_count = item_stats.get("overdue_count") or 0
            reviewed_today = event_stats.get("reviewed_today") or 0
            correct_today = event_stats.get("correct_today") or 0

            correct_rate = round((correct_today / reviewed_today) * 100.0, 2) if reviewed_today > 0 else 0.0

            return {
                "total_items": total_items,
                "due_count": due_count,
                "overdue_count": overdue_count,
                "reviewed_today": reviewed_today,
                "correct_rate": correct_rate
            }

        if db_conn:
            return _calc(db_conn)
        with get_db() as conn:
            return _calc(conn)


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
        rating: str = "good",
        previous_state: Optional[Dict[str, Any]] = None,
        new_state: Optional[Dict[str, Any]] = None,
        previous_due: Optional[str] = None,
        new_due: Optional[str] = None,
        session_id: Optional[str] = None,
        reviewed_at: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        event_id = str(uuid.uuid4())
        reviewed_iso = reviewed_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        prev_json = json.dumps(previous_state or {})
        new_json = json.dumps(new_state or {})

        sql = """
            INSERT INTO review_events (
                id, workspace_id, user_id, learning_item_id, content_type,
                content_id, result, rating, previous_state, new_state,
                previous_due, new_due, source_type, source_id, session_id, reviewed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            event_id, workspace_id, user_id, learning_item_id, content_type,
            content_id, result, rating, prev_json, new_json,
            previous_due, new_due, source_type, source_id, session_id, reviewed_iso
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
            "rating": rating,
            "previous_state": previous_state or {},
            "new_state": new_state or {},
            "previous_due": previous_due,
            "new_due": new_due,
            "source_type": source_type,
            "source_id": source_id,
            "session_id": session_id,
            "reviewed_at": reviewed_iso
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


class ReviewSessionRepository:
    """
    Manages review sessions grouping active study reviews.
    """

    @staticmethod
    def create_session(
        workspace_id: str,
        user_id: str,
        total_items: int,
        metadata: Optional[Dict[str, Any]] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        session_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        meta_json = json.dumps(metadata or {})

        sql = """
            INSERT INTO review_sessions (
                id, workspace_id, user_id, status, started_at,
                completed_at, total_items, reviewed_items, metadata,
                created_at, updated_at
            )
            VALUES (?, ?, ?, 'active', ?, NULL, ?, 0, ?, ?, ?)
        """
        params = (
            session_id, workspace_id, user_id, now_iso,
            total_items, meta_json, now_iso, now_iso
        )

        if db_conn:
            db_conn.execute(sql, params)
        else:
            with get_db() as conn:
                conn.execute(sql, params)

        return {
            "id": session_id,
            "workspace_id": workspace_id,
            "user_id": user_id,
            "status": "active",
            "started_at": now_iso,
            "completed_at": None,
            "total_items": total_items,
            "reviewed_items": 0,
            "metadata": metadata or {},
            "created_at": now_iso,
            "updated_at": now_iso
        }

    @staticmethod
    def get_by_id_and_workspace(
        session_id: str,
        workspace_id: str,
        user_id: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM review_sessions WHERE id = ? AND workspace_id = ?"
        params: List[Any] = [session_id, workspace_id]
        if user_id:
            sql += " AND user_id = ?"
            params.append(user_id)

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, tuple(params))
            row = cursor.fetchone()
        else:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, tuple(params))
                row = cursor.fetchone()

        if not row:
            return None
        res = dict(row)
        if isinstance(res.get("metadata"), str):
            try:
                res["metadata"] = json.loads(res["metadata"])
            except Exception:
                res["metadata"] = {}
        return res

    @staticmethod
    def update_status(
        session_id: str,
        status: str,
        completed_at: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        comp_time = completed_at or (now_iso if status == "completed" else None)
        sql = """
            UPDATE review_sessions
            SET status = ?, completed_at = ?, updated_at = ?
            WHERE id = ?
        """
        params = (status, comp_time, now_iso, session_id)

        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount > 0

    @staticmethod
    def increment_reviewed_count(
        session_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, int]:
        """
        Atomically increments reviewed_items count and returns updated (reviewed_items, total_items).
        """
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        sql = """
            UPDATE review_sessions
            SET reviewed_items = reviewed_items + 1, updated_at = ?
            WHERE id = ?
        """
        sql_fetch = "SELECT reviewed_items, total_items FROM review_sessions WHERE id = ?"

        def _run(conn: sqlite3.Connection) -> Dict[str, int]:
            cur = conn.cursor()
            cur.execute(sql, (now_iso, session_id))
            cur.execute(sql_fetch, (session_id,))
            row = cur.fetchone()
            if not row:
                return {"reviewed_items": 0, "total_items": 0}
            return {"reviewed_items": row["reviewed_items"], "total_items": row["total_items"]}

        if db_conn:
            return _run(db_conn)
        with get_db() as conn:
            return _run(conn)

    @staticmethod
    def list_by_user(
        workspace_id: str,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        sql = """
            SELECT * FROM review_sessions
            WHERE workspace_id = ? AND user_id = ?
            ORDER BY started_at DESC
            LIMIT ? OFFSET ?
        """
        params = (workspace_id, user_id, limit, offset)

        def _fetch(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
            cur = conn.cursor()
            cur.execute(sql, params)
            rows = cur.fetchall()
            results = []
            for r in rows:
                item = dict(r)
                if isinstance(item.get("metadata"), str):
                    try:
                        item["metadata"] = json.loads(item["metadata"])
                    except Exception:
                        item["metadata"] = {}
                results.append(item)
            return results

        if db_conn:
            return _fetch(db_conn)
        with get_db() as conn:
            return _fetch(conn)


class ReviewSessionItemRepository:
    """
    Manages individual review items queued inside a review session.
    """

    @staticmethod
    def create_items_batch(
        session_id: str,
        learning_item_ids: List[str],
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        rows = [
            (str(uuid.uuid4()), session_id, item_id, idx, "pending", now_iso)
            for idx, item_id in enumerate(learning_item_ids)
        ]
        sql = """
            INSERT INTO review_session_items (
                id, session_id, learning_item_id, order_index, status, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """

        def _exec(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
            cur = conn.cursor()
            cur.executemany(sql, rows)
            return [
                {
                    "id": r[0],
                    "session_id": r[1],
                    "learning_item_id": r[2],
                    "order_index": r[3],
                    "status": r[4],
                    "created_at": r[5]
                }
                for r in rows
            ]

        if db_conn:
            return _exec(db_conn)
        with get_db() as conn:
            return _exec(conn)

    @staticmethod
    def get_by_id(
        item_id: str,
        session_id: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM review_session_items WHERE id = ?"
        params: List[Any] = [item_id]
        if session_id:
            sql += " AND session_id = ?"
            params.append(session_id)

        if db_conn:
            cur = db_conn.cursor()
            cur.execute(sql, tuple(params))
            row = cur.fetchone()
        else:
            with get_db() as conn:
                cur = conn.cursor()
                cur.execute(sql, tuple(params))
                row = cur.fetchone()

        return dict(row) if row else None

    @staticmethod
    def get_next_pending(
        session_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieves the next pending or revealed (in-progress) item in the session.
        """
        sql = """
            SELECT * FROM review_session_items
            WHERE session_id = ? AND status IN ('pending', 'revealed')
            ORDER BY order_index ASC
            LIMIT 1
        """

        if db_conn:
            cur = db_conn.cursor()
            cur.execute(sql, (session_id,))
            row = cur.fetchone()
        else:
            with get_db() as conn:
                cur = conn.cursor()
                cur.execute(sql, (session_id,))
                row = cur.fetchone()

        return dict(row) if row else None

    @staticmethod
    def mark_revealed(
        item_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        sql = """
            UPDATE review_session_items
            SET status = 'revealed'
            WHERE id = ? AND status = 'pending'
        """
        if db_conn:
            cur = db_conn.cursor()
            cur.execute(sql, (item_id,))
            return cur.rowcount > 0
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(sql, (item_id,))
            return cur.rowcount > 0

    @staticmethod
    def mark_completed(
        item_id: str,
        rating: str,
        review_event_id: str,
        reviewed_at: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        reviewed_iso = reviewed_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        sql = """
            UPDATE review_session_items
            SET status = 'completed', rating = ?, review_event_id = ?, reviewed_at = ?
            WHERE id = ?
        """
        params = (rating, review_event_id, reviewed_iso, item_id)
        if db_conn:
            cur = db_conn.cursor()
            cur.execute(sql, params)
            return cur.rowcount > 0
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(sql, params)
            return cur.rowcount > 0

    @staticmethod
    def list_by_session(
        session_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        sql = """
            SELECT * FROM review_session_items
            WHERE session_id = ?
            ORDER BY order_index ASC
        """
        if db_conn:
            cur = db_conn.cursor()
            cur.execute(sql, (session_id,))
            return [dict(r) for r in cur.fetchall()]
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(sql, (session_id,))
            return [dict(r) for r in cur.fetchall()]


class AnalyticsRepository:
    """
    Database-side SQL aggregation queries for learning analytics,
    dashboard summaries, study activity, and progress projections.
    Read-only: never mutates learning state or consumes credits.
    """

    @staticmethod
    def get_dashboard_summary(
        workspace_id: str,
        user_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        today_start_iso = now_dt.replace(hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")

        # 1. Review Workload
        sql_workload = """
            SELECT 
                COUNT(*) as total_active,
                SUM(CASE WHEN last_seen_at IS NULL THEN 1 ELSE 0 END) as new_count,
                SUM(CASE WHEN next_review_at IS NOT NULL AND next_review_at <= ? THEN 1 ELSE 0 END) as due_count,
                SUM(CASE WHEN next_review_at IS NOT NULL AND next_review_at < datetime(?, '-1 day') THEN 1 ELSE 0 END) as overdue_count
            FROM learning_items
            WHERE workspace_id = ? AND user_id = ?
        """

        # 2. Learning States (FSRS vocabulary: new, learning, review, relearning)
        sql_states = """
            SELECT 
                CASE 
                    WHEN last_seen_at IS NULL THEN 'new'
                    WHEN json_extract(scheduling_metadata, '$.state') = 'review' THEN 'review'
                    WHEN json_extract(scheduling_metadata, '$.state') = 'relearning' THEN 'relearning'
                    ELSE 'learning'
                END as state_name,
                COUNT(*) as cnt
            FROM learning_items
            WHERE workspace_id = ? AND user_id = ?
            GROUP BY state_name
        """

        # 3. Today's Completions
        sql_today_reviews = """
            SELECT COUNT(*) as reviews_today
            FROM review_events
            WHERE workspace_id = ? AND user_id = ? AND reviewed_at >= ?
        """
        sql_today_quizzes = """
            SELECT COUNT(*) as quizzes_today
            FROM quiz_attempts
            WHERE workspace_id = ? AND user_id = ? AND status = 'submitted' AND submitted_at >= ?
        """

        # 4. Quiz Performance
        sql_quizzes = """
            SELECT 
                COUNT(*) as total_attempts,
                SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as completed_attempts,
                AVG(CASE WHEN status = 'submitted' THEN percentage ELSE NULL END) as avg_score,
                MAX(CASE WHEN status = 'submitted' THEN percentage ELSE NULL END) as max_score,
                MIN(CASE WHEN status = 'submitted' THEN percentage ELSE NULL END) as min_score,
                SUM(CASE WHEN status = 'submitted' THEN total_questions ELSE 0 END) as questions_answered,
                SUM(CASE WHEN status = 'submitted' THEN correct_answers ELSE 0 END) as correct_answers
            FROM quiz_attempts
            WHERE workspace_id = ? AND user_id = ?
        """

        # 5. Flashcard Performance
        sql_cards_total = """
            SELECT COUNT(f.id) as total_cards
            FROM flashcards f
            JOIN flashcard_sets fs ON f.flashcard_set_id = fs.id
            WHERE fs.workspace_id = ? AND fs.user_id = ? AND fs.deleted_at IS NULL
        """
        sql_cards_learning = """
            SELECT 
                COUNT(*) as active_cards,
                SUM(CASE WHEN correct_count > 0 OR incorrect_count > 0 THEN 1 ELSE 0 END) as reviewed_cards,
                SUM(CASE WHEN next_review_at IS NOT NULL AND next_review_at <= ? THEN 1 ELSE 0 END) as due_cards,
                SUM(CASE WHEN json_extract(scheduling_metadata, '$.state') = 'review' THEN 1 ELSE 0 END) as in_review_state
            FROM learning_items
            WHERE workspace_id = ? AND user_id = ? AND content_type = 'flashcard'
        """

        def _execute(conn: sqlite3.Connection) -> Dict[str, Any]:
            cur = conn.cursor()

            # Workload
            cur.execute(sql_workload, (now_iso, now_iso, workspace_id, user_id))
            w_row = dict(cur.fetchone() or {})
            total_active = w_row.get("total_active") or 0
            new_count = w_row.get("new_count") or 0
            due_count = w_row.get("due_count") or 0
            overdue_count = w_row.get("overdue_count") or 0

            # States
            cur.execute(sql_states, (workspace_id, user_id))
            state_counts: Dict[str, int] = {"new": 0, "learning": 0, "review": 0, "relearning": 0}
            for row in cur.fetchall():
                st_name = row["state_name"]
                if st_name in state_counts:
                    state_counts[st_name] = row["cnt"]
                else:
                    state_counts[st_name] = row["cnt"]

            # Today
            cur.execute(sql_today_reviews, (workspace_id, user_id, today_start_iso))
            reviews_today = cur.fetchone()["reviews_today"] or 0

            cur.execute(sql_today_quizzes, (workspace_id, user_id, today_start_iso))
            quizzes_today = cur.fetchone()["quizzes_today"] or 0

            # Quizzes
            cur.execute(sql_quizzes, (workspace_id, user_id))
            q_row = dict(cur.fetchone() or {})
            q_total_attempts = q_row.get("total_attempts") or 0
            q_completed_attempts = q_row.get("completed_attempts") or 0
            q_avg_score = round(q_row["avg_score"], 2) if q_row.get("avg_score") is not None else None
            q_max_score = round(q_row["max_score"], 2) if q_row.get("max_score") is not None else None
            q_min_score = round(q_row["min_score"], 2) if q_row.get("min_score") is not None else None
            q_answered = q_row.get("questions_answered") or 0
            q_correct = q_row.get("correct_answers") or 0
            q_incorrect = q_answered - q_correct
            q_accuracy = round((q_correct / q_answered) * 100.0, 2) if q_answered > 0 else None

            # Flashcards
            cur.execute(sql_cards_total, (workspace_id, user_id))
            fc_total = cur.fetchone()["total_cards"] or 0

            cur.execute(sql_cards_learning, (now_iso, workspace_id, user_id))
            fc_l_row = dict(cur.fetchone() or {})
            fc_active = fc_l_row.get("active_cards") or 0
            fc_reviewed = fc_l_row.get("reviewed_cards") or 0
            fc_due = fc_l_row.get("due_cards") or 0
            fc_review_state = fc_l_row.get("in_review_state") or 0

            return {
                "review_workload": {
                    "due": due_count,
                    "overdue": overdue_count,
                    "new": new_count,
                    "total_active": total_active
                },
                "learning_states": {
                    "total": total_active,
                    "by_state": state_counts
                },
                "today": {
                    "reviews_completed": reviews_today,
                    "quiz_attempts": quizzes_today
                },
                "quizzes": {
                    "total_attempts": q_total_attempts,
                    "completed_attempts": q_completed_attempts,
                    "average_score": q_avg_score,
                    "highest_score": q_max_score,
                    "lowest_score": q_min_score,
                    "questions_answered": q_answered,
                    "correct_answers": q_correct,
                    "incorrect_answers": q_incorrect,
                    "accuracy_rate": q_accuracy
                },
                "flashcards": {
                    "total_cards": fc_total,
                    "active_cards": fc_active,
                    "cards_reviewed": fc_reviewed,
                    "cards_due": fc_due,
                    "cards_in_review_state": fc_review_state
                }
            }

        if db_conn:
            return _execute(db_conn)
        with get_db() as conn:
            return _execute(conn)

    @staticmethod
    def get_review_detailed_statistics(
        workspace_id: str,
        user_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        # Workload
        sql_workload = """
            SELECT 
                COUNT(*) as total_active,
                SUM(CASE WHEN last_seen_at IS NULL THEN 1 ELSE 0 END) as new_count,
                SUM(CASE WHEN next_review_at IS NOT NULL AND next_review_at <= ? THEN 1 ELSE 0 END) as due_count,
                SUM(CASE WHEN next_review_at IS NOT NULL AND next_review_at < datetime(?, '-1 day') THEN 1 ELSE 0 END) as overdue_count
            FROM learning_items
            WHERE workspace_id = ? AND user_id = ?
        """

        # Ratings breakdown
        sql_ratings = """
            SELECT rating, COUNT(*) as count
            FROM review_events
            WHERE workspace_id = ? AND user_id = ?
            GROUP BY rating
        """

        # Summary & active days
        sql_summary = """
            SELECT 
                COUNT(*) as total_reviews,
                SUM(CASE WHEN rating IN ('good', 'easy', 'correct') OR result = 'correct' THEN 1 ELSE 0 END) as correct_reviews,
                COUNT(DISTINCT strftime('%Y-%m-%d', reviewed_at)) as active_days
            FROM review_events
            WHERE workspace_id = ? AND user_id = ?
        """

        # Reviewed in last 24h
        sql_reviewed_today = """
            SELECT COUNT(*) as reviewed_today
            FROM review_events
            WHERE workspace_id = ? AND user_id = ?
              AND reviewed_at >= datetime(?, '-1 day')
        """

        def _execute(conn: sqlite3.Connection) -> Dict[str, Any]:
            cur = conn.cursor()

            # Workload
            cur.execute(sql_workload, (now_iso, now_iso, workspace_id, user_id))
            w_row = dict(cur.fetchone() or {})

            # Summary
            cur.execute(sql_summary, (workspace_id, user_id))
            s_row = dict(cur.fetchone() or {})
            total_reviews = s_row.get("total_reviews") or 0
            correct_reviews = s_row.get("correct_reviews") or 0
            active_days = s_row.get("active_days") or 0
            correct_rate = round((correct_reviews / total_reviews) * 100.0, 2) if total_reviews > 0 else 0.0
            avg_per_day = round(total_reviews / active_days, 2) if active_days > 0 else 0.0

            # Today
            cur.execute(sql_reviewed_today, (workspace_id, user_id, now_iso))
            reviewed_today = cur.fetchone()["reviewed_today"] or 0

            # Ratings
            cur.execute(sql_ratings, (workspace_id, user_id))
            raw_ratings = {r["rating"]: r["count"] for r in cur.fetchall()}

            rating_keys = ["again", "hard", "good", "easy"]
            ratings_dict: Dict[str, Dict[str, Any]] = {}
            for k in rating_keys:
                c = raw_ratings.get(k, 0)
                pct = round((c / total_reviews) * 100.0, 2) if total_reviews > 0 else 0.0
                ratings_dict[k] = {
                    "rating": k,
                    "count": c,
                    "percentage": pct
                }

            return {
                "workload": {
                    "due": w_row.get("due_count") or 0,
                    "overdue": w_row.get("overdue_count") or 0,
                    "new": w_row.get("new_count") or 0,
                    "total_active": w_row.get("total_active") or 0
                },
                "total_reviews": total_reviews,
                "reviewed_today": reviewed_today,
                "correct_rate": correct_rate,
                "ratings": ratings_dict,
                "average_reviews_per_active_day": avg_per_day
            }

        if db_conn:
            return _execute(db_conn)
        with get_db() as conn:
            return _execute(conn)

    @staticmethod
    def get_quiz_performance_statistics(
        workspace_id: str,
        user_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        sql = """
            SELECT 
                COUNT(*) as total_attempts,
                SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as completed_attempts,
                AVG(CASE WHEN status = 'submitted' THEN percentage ELSE NULL END) as avg_score,
                MAX(CASE WHEN status = 'submitted' THEN percentage ELSE NULL END) as max_score,
                MIN(CASE WHEN status = 'submitted' THEN percentage ELSE NULL END) as min_score,
                SUM(CASE WHEN status = 'submitted' THEN total_questions ELSE 0 END) as questions_answered,
                SUM(CASE WHEN status = 'submitted' THEN correct_answers ELSE 0 END) as correct_answers
            FROM quiz_attempts
            WHERE workspace_id = ? AND user_id = ?
        """

        def _execute(conn: sqlite3.Connection) -> Dict[str, Any]:
            cur = conn.cursor()
            cur.execute(sql, (workspace_id, user_id))
            row = dict(cur.fetchone() or {})

            total = row.get("total_attempts") or 0
            completed = row.get("completed_attempts") or 0
            avg_score = round(row["avg_score"], 2) if row.get("avg_score") is not None else None
            max_score = round(row["max_score"], 2) if row.get("max_score") is not None else None
            min_score = round(row["min_score"], 2) if row.get("min_score") is not None else None
            answered = row.get("questions_answered") or 0
            correct = row.get("correct_answers") or 0
            incorrect = answered - correct
            accuracy = round((correct / answered) * 100.0, 2) if answered > 0 else None

            return {
                "total_attempts": total,
                "completed_attempts": completed,
                "average_score": avg_score,
                "highest_score": max_score,
                "lowest_score": min_score,
                "questions_answered": answered,
                "correct_answers": correct,
                "incorrect_answers": incorrect,
                "accuracy_rate": accuracy
            }

        if db_conn:
            return _execute(db_conn)
        with get_db() as conn:
            return _execute(conn)

    @staticmethod
    def get_flashcard_performance_statistics(
        workspace_id: str,
        user_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        sql_total = """
            SELECT COUNT(f.id) as total_cards
            FROM flashcards f
            JOIN flashcard_sets fs ON f.flashcard_set_id = fs.id
            WHERE fs.workspace_id = ? AND fs.user_id = ? AND fs.deleted_at IS NULL
        """
        sql_learning = """
            SELECT 
                COUNT(*) as active_cards,
                SUM(CASE WHEN correct_count > 0 OR incorrect_count > 0 THEN 1 ELSE 0 END) as reviewed_cards,
                SUM(CASE WHEN next_review_at IS NOT NULL AND next_review_at <= ? THEN 1 ELSE 0 END) as due_cards,
                SUM(CASE WHEN json_extract(scheduling_metadata, '$.state') = 'review' THEN 1 ELSE 0 END) as in_review_state
            FROM learning_items
            WHERE workspace_id = ? AND user_id = ? AND content_type = 'flashcard'
        """

        def _execute(conn: sqlite3.Connection) -> Dict[str, Any]:
            cur = conn.cursor()
            cur.execute(sql_total, (workspace_id, user_id))
            fc_total = cur.fetchone()["total_cards"] or 0

            cur.execute(sql_learning, (now_iso, workspace_id, user_id))
            row = dict(cur.fetchone() or {})

            return {
                "total_cards": fc_total,
                "active_cards": row.get("active_cards") or 0,
                "cards_reviewed": row.get("reviewed_cards") or 0,
                "cards_due": row.get("due_cards") or 0,
                "cards_in_review_state": row.get("in_review_state") or 0
            }

        if db_conn:
            return _execute(db_conn)
        with get_db() as conn:
            return _execute(conn)

    @staticmethod
    def get_study_activity_timeseries(
        workspace_id: str,
        user_id: str,
        start_iso: str,
        end_iso: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Dict[str, int]]:
        sql_reviews = """
            SELECT 
                strftime('%Y-%m-%d', reviewed_at) as day,
                COUNT(*) as review_count
            FROM review_events
            WHERE workspace_id = ? AND user_id = ?
              AND reviewed_at >= ? AND reviewed_at <= ?
            GROUP BY day
        """
        sql_quizzes = """
            SELECT 
                strftime('%Y-%m-%d', submitted_at) as day,
                COUNT(*) as attempt_count,
                SUM(correct_answers) as correct_count,
                SUM(total_questions - correct_answers) as incorrect_count
            FROM quiz_attempts
            WHERE workspace_id = ? AND user_id = ?
              AND status = 'submitted'
              AND submitted_at >= ? AND submitted_at <= ?
            GROUP BY day
        """

        def _execute(conn: sqlite3.Connection) -> Dict[str, Dict[str, int]]:
            cur = conn.cursor()
            cur.execute(sql_reviews, (workspace_id, user_id, start_iso, end_iso))
            reviews_by_day = {r["day"]: r["review_count"] for r in cur.fetchall()}

            cur.execute(sql_quizzes, (workspace_id, user_id, start_iso, end_iso))
            quizzes_by_day = {
                r["day"]: {
                    "attempts": r["attempt_count"] or 0,
                    "correct": r["correct_count"] or 0,
                    "incorrect": r["incorrect_count"] or 0
                }
                for r in cur.fetchall()
            }

            all_days = set(reviews_by_day.keys()).union(set(quizzes_by_day.keys()))
            merged: Dict[str, Dict[str, int]] = {}
            for d in all_days:
                q_info = quizzes_by_day.get(d, {"attempts": 0, "correct": 0, "incorrect": 0})
                merged[d] = {
                    "reviews_count": reviews_by_day.get(d, 0),
                    "quiz_attempts_count": q_info["attempts"],
                    "correct_answers": q_info["correct"],
                    "incorrect_answers": q_info["incorrect"]
                }
            return merged

        if db_conn:
            return _execute(db_conn)
        with get_db() as conn:
            return _execute(conn)

    @staticmethod
    def get_document_learning_progress(
        workspace_id: str,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        sql = """
            SELECT 
                d.id as document_id,
                d.title as title,
                COUNT(li.id) as total_learning_items,
                SUM(CASE WHEN li.last_seen_at IS NULL THEN 1 ELSE 0 END) as new_items,
                SUM(CASE WHEN li.last_seen_at IS NOT NULL AND json_extract(li.scheduling_metadata, '$.state') != 'review' THEN 1 ELSE 0 END) as learning_items,
                SUM(CASE WHEN json_extract(li.scheduling_metadata, '$.state') = 'review' THEN 1 ELSE 0 END) as review_items,
                SUM(CASE WHEN li.next_review_at IS NOT NULL AND li.next_review_at <= ? THEN 1 ELSE 0 END) as due_items,
                SUM(li.correct_count) as total_correct,
                SUM(li.correct_count + li.incorrect_count) as total_reviews
            FROM documents d
            LEFT JOIN learning_items li ON (
                li.workspace_id = d.workspace_id 
                AND li.user_id = ? 
                AND (
                    json_extract(li.source_reference, '$.document_id') = d.id
                    OR json_extract(li.source_reference, '$.flashcard_set_id') IN (
                        SELECT id FROM flashcard_sets WHERE source_document_ids LIKE '%' || d.id || '%'
                    )
                    OR li.source_reference LIKE '%' || d.id || '%'
                )
            )
            WHERE d.workspace_id = ? AND d.deleted_at IS NULL
            GROUP BY d.id, d.title
            ORDER BY d.created_at DESC
            LIMIT ? OFFSET ?
        """

        def _execute(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
            cur = conn.cursor()
            cur.execute(sql, (now_iso, user_id, workspace_id, limit, offset))
            results = []
            for row in cur.fetchall():
                r = dict(row)
                t_items = r.get("total_learning_items") or 0
                new_items = r.get("new_items") or 0
                learning_items = r.get("learning_items") or 0
                review_items = r.get("review_items") or 0
                due_items = r.get("due_items") or 0
                total_correct = r.get("total_correct") or 0
                total_reviews = r.get("total_reviews") or 0
                rate = round((total_correct / total_reviews) * 100.0, 2) if total_reviews > 0 else 0.0
                results.append({
                    "document_id": r["document_id"],
                    "title": r["title"],
                    "total_learning_items": t_items,
                    "new_items": new_items,
                    "learning_items": learning_items,
                    "review_items": review_items,
                    "due_items": due_items,
                    "correct_rate": rate
                })
            return results

        if db_conn:
            return _execute(db_conn)
        with get_db() as conn:
            return _execute(conn)

    @staticmethod
    def get_concept_learning_progress(
        workspace_id: str,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        sql = """
            SELECT 
                COALESCE(json_extract(source_reference, '$.concept'), content_id) as concept,
                COUNT(*) as total_learning_items,
                SUM(CASE WHEN last_seen_at IS NULL THEN 1 ELSE 0 END) as new_items,
                SUM(CASE WHEN last_seen_at IS NOT NULL AND json_extract(scheduling_metadata, '$.state') != 'review' THEN 1 ELSE 0 END) as learning_items,
                SUM(CASE WHEN json_extract(scheduling_metadata, '$.state') = 'review' THEN 1 ELSE 0 END) as review_items,
                SUM(CASE WHEN next_review_at IS NOT NULL AND next_review_at <= ? THEN 1 ELSE 0 END) as due_items,
                SUM(correct_count) as total_correct,
                SUM(correct_count + incorrect_count) as total_reviews
            FROM learning_items
            WHERE workspace_id = ? AND user_id = ?
              AND (content_type = 'concept' OR json_extract(source_reference, '$.concept') IS NOT NULL)
            GROUP BY concept
            ORDER BY total_learning_items DESC
            LIMIT ? OFFSET ?
        """

        def _execute(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
            cur = conn.cursor()
            cur.execute(sql, (now_iso, workspace_id, user_id, limit, offset))
            results = []
            for row in cur.fetchall():
                r = dict(row)
                t_correct = r.get("total_correct") or 0
                t_reviews = r.get("total_reviews") or 0
                rate = round((t_correct / t_reviews) * 100.0, 2) if t_reviews > 0 else 0.0
                results.append({
                    "concept": r["concept"],
                    "total_learning_items": r.get("total_learning_items") or 0,
                    "new_items": r.get("new_items") or 0,
                    "learning_items": r.get("learning_items") or 0,
                    "review_items": r.get("review_items") or 0,
                    "due_items": r.get("due_items") or 0,
                    "correct_rate": rate
                })
            return results

        if db_conn:
            return _execute(db_conn)
        with get_db() as conn:
            return _execute(conn)

    @staticmethod
    def get_study_sessions_history(
        workspace_id: str,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
        status: Optional[str] = None,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        status_clause = "AND status = ?" if status else ""
        sql_sessions = f"""
            SELECT id, status, started_at, completed_at, total_items, reviewed_items
            FROM review_sessions
            WHERE workspace_id = ? AND user_id = ? {status_clause}
            ORDER BY started_at DESC
            LIMIT ? OFFSET ?
        """
        params: List[Any] = [workspace_id, user_id]
        if status:
            params.append(status)
        params.extend([limit, offset])

        sql_ratings = """
            SELECT session_id, rating, COUNT(*) as cnt
            FROM review_session_items
            WHERE session_id IN ({}) AND rating IS NOT NULL
            GROUP BY session_id, rating
        """

        def _execute(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
            cur = conn.cursor()
            cur.execute(sql_sessions, tuple(params))
            sessions = [dict(r) for r in cur.fetchall()]
            if not sessions:
                return []

            session_ids = [s["id"] for s in sessions]
            placeholders = ",".join("?" for _ in session_ids)
            cur.execute(sql_ratings.format(placeholders), session_ids)

            ratings_by_session: Dict[str, Dict[str, int]] = {sid: {} for sid in session_ids}
            for r in cur.fetchall():
                ratings_by_session[r["session_id"]][r["rating"]] = r["cnt"]

            results = []
            for s in sessions:
                sid = s["id"]
                # Calculate duration in seconds
                duration: Optional[int] = None
                if s.get("started_at") and s.get("completed_at"):
                    try:
                        t0 = datetime.fromisoformat(s["started_at"].replace("Z", "+00:00"))
                        t1 = datetime.fromisoformat(s["completed_at"].replace("Z", "+00:00"))
                        duration = max(0, int((t1 - t0).total_seconds()))
                    except Exception:
                        duration = None

                results.append({
                    "id": sid,
                    "status": s["status"],
                    "started_at": s["started_at"],
                    "completed_at": s["completed_at"],
                    "duration_seconds": duration,
                    "total_items": s["total_items"],
                    "reviewed_items": s["reviewed_items"],
                    "rating_distribution": ratings_by_session.get(sid, {})
                })
            return results

        if db_conn:
            return _execute(db_conn)
        with get_db() as conn:
            return _execute(conn)


class DocumentSummaryRepository:
    """Repository for AI-generated document summaries with upsert caching."""

    @staticmethod
    def get_by_document_and_type(
        document_id: str,
        summary_type: str = "standard",
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        sql = """
            SELECT * FROM document_summaries
            WHERE document_id = ? AND summary_type = ?
        """
        params = (document_id, summary_type)
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
    def upsert_summary(
        document_id: str,
        workspace_id: str,
        user_id: str,
        summary_type: str,
        summary: str,
        key_points: str,
        source_references: str,
        content_version: str,
        model_metadata: str = "{}",
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        rec_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        sql = """
            INSERT INTO document_summaries (
                id, document_id, workspace_id, user_id, summary_type,
                summary, key_points, source_references, content_version,
                model_metadata, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (document_id, summary_type) DO UPDATE SET
                summary = excluded.summary,
                key_points = excluded.key_points,
                source_references = excluded.source_references,
                content_version = excluded.content_version,
                model_metadata = excluded.model_metadata,
                updated_at = excluded.updated_at
        """
        params = (
            rec_id, document_id, workspace_id, user_id, summary_type,
            summary, key_points, source_references, content_version,
            model_metadata, now, now
        )

        def _execute(c: sqlite3.Connection) -> Dict[str, Any]:
            c.execute(sql, params)
            # Retrieve the final record (may have existing id if updated)
            cur = c.cursor()
            cur.execute(
                "SELECT * FROM document_summaries WHERE document_id = ? AND summary_type = ?",
                (document_id, summary_type)
            )
            row = cur.fetchone()
            return dict(row) if row else {"id": rec_id}

        if db_conn:
            return _execute(db_conn)
        with get_db() as conn:
            return _execute(conn)

    @staticmethod
    def delete_by_document(
        document_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> int:
        sql = "DELETE FROM document_summaries WHERE document_id = ?"
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, (document_id,))
            return cursor.rowcount
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, (document_id,))
            return cursor.rowcount

    @staticmethod
    def list_by_document(
        document_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        sql = "SELECT * FROM document_summaries WHERE document_id = ? ORDER BY summary_type"
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, (document_id,))
            return [dict(r) for r in cursor.fetchall()]
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, (document_id,))
            return [dict(r) for r in cursor.fetchall()]


class ConceptRepository:
    """Repository for AI-extracted, deduplicated concepts per document."""

    @staticmethod
    def get_by_id(
        concept_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM concepts WHERE id = ?"
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, (concept_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, (concept_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_by_id_and_workspace(
        concept_id: str,
        workspace_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM concepts WHERE id = ? AND workspace_id = ?"
        params = (concept_id, workspace_id)
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
    def list_by_document(
        document_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        sql = """
            SELECT * FROM concepts
            WHERE document_id = ?
            ORDER BY
                CASE importance
                    WHEN 'high' THEN 1
                    WHEN 'medium' THEN 2
                    WHEN 'low' THEN 3
                END,
                name ASC
        """
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, (document_id,))
            return [dict(r) for r in cursor.fetchall()]
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, (document_id,))
            return [dict(r) for r in cursor.fetchall()]

    @staticmethod
    def batch_upsert_concepts(
        concepts_data: List[Dict[str, Any]],
        db_conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        """
        Atomically upserts concepts within a transaction.
        Each item in concepts_data must have: document_id, workspace_id, user_id,
        name, normalized_name, description, importance, source_references, content_version.
        """
        sql = """
            INSERT INTO concepts (
                id, document_id, workspace_id, user_id, name, normalized_name,
                description, importance, source_references, content_version,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (document_id, normalized_name) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                importance = excluded.importance,
                source_references = excluded.source_references,
                content_version = excluded.content_version,
                updated_at = excluded.updated_at
        """
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        def _execute(c: sqlite3.Connection) -> List[Dict[str, Any]]:
            document_id = None
            for cd in concepts_data:
                rec_id = str(uuid.uuid4())
                document_id = cd["document_id"]
                c.execute(sql, (
                    rec_id,
                    cd["document_id"],
                    cd["workspace_id"],
                    cd["user_id"],
                    cd["name"],
                    cd["normalized_name"],
                    cd["description"],
                    cd["importance"],
                    cd.get("source_references", "[]"),
                    cd["content_version"],
                    now, now
                ))
            # Return all concepts for the document
            if document_id:
                cur = c.cursor()
                cur.execute(
                    "SELECT * FROM concepts WHERE document_id = ? ORDER BY "
                    "CASE importance WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, name ASC",
                    (document_id,)
                )
                return [dict(r) for r in cur.fetchall()]
            return []

        if db_conn:
            return _execute(db_conn)
        with get_db() as conn:
            return _execute(conn)

    @staticmethod
    def delete_by_document(
        document_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> int:
        sql = "DELETE FROM concepts WHERE document_id = ?"
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, (document_id,))
            return cursor.rowcount
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, (document_id,))
            return cursor.rowcount

    @staticmethod
    def count_by_document(
        document_id: str,
        db_conn: Optional[sqlite3.Connection] = None
    ) -> int:
        sql = "SELECT COUNT(*) FROM concepts WHERE document_id = ?"
        if db_conn:
            cursor = db_conn.cursor()
            cursor.execute(sql, (document_id,))
            return cursor.fetchone()[0]
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, (document_id,))
            return cursor.fetchone()[0]
