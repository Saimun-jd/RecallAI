"""
Database Schema Initialization for Recall AI Foundation.
Creates tables for users, workspaces, user_preferences, plans, documents,
and provider_credentials with constraints and indexes.
"""

import sqlite3
import logging
from typing import Optional

from app.core.database import get_db

logger = logging.getLogger(__name__)


def init_foundation_db(db_path: Optional[str] = None) -> None:
    """Initializes the production foundation schema."""
    with get_db(db_path) as conn:
        cursor = conn.cursor()

        # 1. Users Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                full_name TEXT,
                avatar_url TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                deleted_at TEXT
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")

        # 2. Workspaces Table (Single-personal workspace invariant)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS workspaces (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL DEFAULT 'Personal Workspace',
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id)")

        # 3. User Preferences Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_preferences (
                user_id TEXT PRIMARY KEY,
                theme TEXT NOT NULL DEFAULT 'neo-brutalist',
                daily_review_goal INTEGER NOT NULL DEFAULT 20 CHECK (daily_review_goal > 0),
                preferred_llm_provider TEXT NOT NULL DEFAULT 'auto',
                preferences TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        # 4. Plans Table (SaaS pricing & entitlement limits)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS plans (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                price_cents INTEGER NOT NULL DEFAULT 0,
                billing_interval TEXT NOT NULL DEFAULT 'month',
                monthly_credits INTEGER NOT NULL DEFAULT 50,
                max_documents INTEGER NOT NULL DEFAULT 3,
                max_storage_mb INTEGER NOT NULL DEFAULT 50,
                byok_allowed INTEGER NOT NULL DEFAULT 1,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            )
        """)

        # 5. Files Table (Uploaded asset metadata)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                storage_provider TEXT NOT NULL DEFAULT 'local',
                storage_path TEXT NOT NULL UNIQUE,
                original_filename TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                sha256_checksum TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_files_workspace ON files(workspace_id)")

        # 6. Core Documents Table (Foundation ownership entity)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                file_id TEXT,
                title TEXT NOT NULL,
                source_type TEXT NOT NULL DEFAULT 'pdf',
                total_pages INTEGER NOT NULL DEFAULT 1 CHECK (total_pages >= 0),
                status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('uploading', 'processing', 'ready', 'failed', 'deleted')),
                processing_error TEXT,
                metadata TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                deleted_at TEXT,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id, status)")

        # Migration: Add file_id to documents if it was created in an earlier migration
        cursor.execute("PRAGMA table_info(documents)")
        doc_cols = [row["name"] for row in cursor.fetchall()]
        if "file_id" not in doc_cols:
            cursor.execute("ALTER TABLE documents ADD COLUMN file_id TEXT REFERENCES files(id) ON DELETE SET NULL")

        # 7. Document Chunks Table (Normalized text chunks for indexing/search)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS document_chunks (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
                content TEXT NOT NULL,
                page_number INTEGER,
                token_count INTEGER NOT NULL CHECK (token_count > 0),
                embedding TEXT,
                embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
                embedding_version INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
                CONSTRAINT uq_document_chunk UNIQUE (document_id, chunk_index)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_doc ON document_chunks(document_id, chunk_index)")

        # 8. Processing Jobs Table (Asynchronous pipeline state machine)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS processing_jobs (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                document_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending' 
                    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'retrying', 'cancelled')),
                current_stage TEXT NOT NULL DEFAULT 'validation',
                attempt_count INTEGER NOT NULL DEFAULT 0,
                max_attempts INTEGER NOT NULL DEFAULT 3,
                error_code TEXT,
                error_message TEXT,
                stage_progress INTEGER NOT NULL DEFAULT 0 CHECK (stage_progress BETWEEN 0 AND 100),
                idempotency_key TEXT UNIQUE,
                started_at TEXT,
                completed_at TEXT,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_processing_jobs_doc ON processing_jobs(document_id, status)")

        # 9. BYOK Provider Credentials (AES-256-GCM Vault)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS provider_credentials (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                provider TEXT NOT NULL CHECK (provider IN ('gemini', 'openai', 'groq', 'ollama')),
                encrypted_key TEXT NOT NULL,
                key_nonce TEXT NOT NULL,
                key_tag TEXT NOT NULL,
                key_version INTEGER NOT NULL DEFAULT 1,
                key_hint TEXT NOT NULL,
                is_valid INTEGER NOT NULL DEFAULT 1,
                last_tested_at TEXT,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT uq_workspace_provider UNIQUE (workspace_id, provider)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_provider_credentials_ws ON provider_credentials(workspace_id)")

        # 10. Conversations Table (Knowledge Hub Chat Sessions)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL DEFAULT 'New Conversation',
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                deleted_at TEXT,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON conversations(workspace_id, updated_at DESC)")

        # 11. Messages Table (Conversation History with Source Citations)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
                content TEXT NOT NULL,
                sources TEXT NOT NULL DEFAULT '[]',
                token_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC)")

        # 12. Usage Records Table (Token and Credit Tracking)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS usage_records (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                operation_type TEXT NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                input_tokens INTEGER NOT NULL DEFAULT 0,
                output_tokens INTEGER NOT NULL DEFAULT 0,
                credits_used INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_usage_records_ws ON usage_records(workspace_id, created_at)")

        # 13. Flashcard Sets Table (Study material collections)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS flashcard_sets (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                source_document_ids TEXT NOT NULL DEFAULT '[]',
                card_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                deleted_at TEXT,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_flashcard_sets_ws ON flashcard_sets(workspace_id, updated_at DESC)")

        # 14. Flashcards Table (Individual atomic study cards)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS flashcards (
                id TEXT PRIMARY KEY,
                flashcard_set_id TEXT NOT NULL,
                front TEXT NOT NULL,
                back TEXT NOT NULL,
                source_metadata TEXT NOT NULL DEFAULT '[]',
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (flashcard_set_id) REFERENCES flashcard_sets(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_flashcards_set ON flashcards(flashcard_set_id, position ASC)")

        # 15. Quizzes Table (Assessment sets)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS quizzes (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                source_document_ids TEXT NOT NULL DEFAULT '[]',
                question_count INTEGER NOT NULL DEFAULT 0,
                difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                deleted_at TEXT,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_quizzes_ws ON quizzes(workspace_id, updated_at DESC)")

        # 16. Quiz Questions Table (Atomic multiple-choice & true/false questions)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS quiz_questions (
                id TEXT PRIMARY KEY,
                quiz_id TEXT NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'true_false')),
                question TEXT NOT NULL,
                options TEXT NOT NULL DEFAULT '[]',
                correct_answer TEXT NOT NULL,
                explanation TEXT NOT NULL,
                source_metadata TEXT NOT NULL DEFAULT '[]',
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id, position ASC)")

        # 17. Quiz Attempts Table (One user's active/submitted attempt at a quiz)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS quiz_attempts (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                quiz_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'abandoned')),
                started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                submitted_at TEXT,
                score REAL NOT NULL DEFAULT 0.0,
                percentage REAL NOT NULL DEFAULT 0.0,
                total_questions INTEGER NOT NULL DEFAULT 0,
                correct_answers INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_quiz_attempts_ws_user ON quiz_attempts(workspace_id, user_id, updated_at DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id)")

        # 18. Quiz Answers Table (User's individual response to an assessment question)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS quiz_answers (
                id TEXT PRIMARY KEY,
                attempt_id TEXT NOT NULL,
                question_id TEXT NOT NULL,
                selected_answer TEXT NOT NULL,
                is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
                answered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
                FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
                CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt ON quiz_answers(attempt_id)")

        # 19. Learning Items Table (Durable knowledge progress state for spaced repetition)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS learning_items (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                content_type TEXT NOT NULL CHECK (content_type IN ('quiz_question', 'flashcard', 'concept')),
                content_id TEXT NOT NULL,
                source_reference TEXT NOT NULL DEFAULT '{}',
                correct_count INTEGER NOT NULL DEFAULT 0,
                incorrect_count INTEGER NOT NULL DEFAULT 0,
                last_seen_at TEXT,
                next_review_at TEXT,
                scheduling_metadata TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT uq_learning_item UNIQUE (workspace_id, user_id, content_type, content_id)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_learning_items_due ON learning_items(workspace_id, user_id, next_review_at ASC)")

        # 20. Review Events Table (Append-only historical log of all review interactions)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS review_events (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                learning_item_id TEXT,
                content_type TEXT NOT NULL,
                content_id TEXT NOT NULL,
                result TEXT NOT NULL CHECK (result IN ('correct', 'incorrect')),
                source_type TEXT NOT NULL DEFAULT 'quiz_attempt',
                source_id TEXT,
                reviewed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (learning_item_id) REFERENCES learning_items(id) ON DELETE SET NULL
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_review_events_user ON review_events(workspace_id, user_id, reviewed_at DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_review_events_item ON review_events(learning_item_id)")



        # Seed default plans if table is empty
        cursor.execute("SELECT COUNT(*) FROM plans")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                INSERT INTO plans (id, name, price_cents, billing_interval, monthly_credits, max_documents, max_storage_mb, byok_allowed, is_active)
                VALUES 
                    ('free', 'Starter Free', 0, 'month', 50, 3, 50, 1, 1),
                    ('pro', 'Pro Scholar', 1500, 'month', 500, 100, 2048, 1, 1)
            """)
            logger.info("Default plans (free, pro) seeded successfully.")

    logger.info("Foundation database schema initialized.")
