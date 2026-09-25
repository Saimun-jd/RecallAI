"""
Database Schema Initialization for Recall AI Foundation.
Creates tables for users, workspaces, user_preferences, plans, documents,
and provider_credentials with constraints and indexes.
"""

import json
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
                max_documents INTEGER NOT NULL DEFAULT 5,
                max_storage_mb INTEGER NOT NULL DEFAULT 50,
                byok_allowed INTEGER NOT NULL DEFAULT 1,
                features TEXT NOT NULL DEFAULT '{}',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            )
        """)

        cursor.execute("PRAGMA table_info(plans)")
        plan_cols = [row["name"] for row in cursor.fetchall()]
        if "features" not in plan_cols:
            cursor.execute("ALTER TABLE plans ADD COLUMN features TEXT NOT NULL DEFAULT '{}'")

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
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_documents_ws_created ON documents(workspace_id, deleted_at, created_at DESC)")

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
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_doc_created ON document_chunks(document_id, created_at DESC)")

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
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_flashcard_sets_ws_active ON flashcard_sets(workspace_id, deleted_at, updated_at DESC)")

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
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_quizzes_ws_active ON quizzes(workspace_id, deleted_at, updated_at DESC)")

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
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_quiz_attempts_submitted ON quiz_attempts(workspace_id, user_id, status, submitted_at DESC)")

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
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_learning_items_ws_user_content ON learning_items(workspace_id, user_id, content_type)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_learning_items_due_eval ON learning_items(workspace_id, user_id, content_type, next_review_at ASC)")

        # 20. Review Events Table (Append-only historical log of all review interactions)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS review_events (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                learning_item_id TEXT,
                content_type TEXT NOT NULL,
                content_id TEXT NOT NULL,
                result TEXT NOT NULL,
                rating TEXT NOT NULL DEFAULT 'good' CHECK (rating IN ('again', 'hard', 'good', 'easy', 'correct', 'incorrect')),
                previous_state TEXT NOT NULL DEFAULT '{}',
                new_state TEXT NOT NULL DEFAULT '{}',
                previous_due TEXT,
                new_due TEXT,
                source_type TEXT NOT NULL DEFAULT 'quiz_attempt',
                source_id TEXT,
                session_id TEXT,
                reviewed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (learning_item_id) REFERENCES learning_items(id) ON DELETE SET NULL
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_review_events_user ON review_events(workspace_id, user_id, reviewed_at DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_review_events_item ON review_events(learning_item_id)")

        # Defensive column migration for existing review_events table
        cursor.execute("PRAGMA table_info(review_events)")
        existing_cols = {row[1] for row in cursor.fetchall()}
        for col_def in [
            ("rating", "TEXT NOT NULL DEFAULT 'good'"),
            ("previous_state", "TEXT NOT NULL DEFAULT '{}'"),
            ("new_state", "TEXT NOT NULL DEFAULT '{}'"),
            ("previous_due", "TEXT"),
            ("new_due", "TEXT"),
            ("session_id", "TEXT"),
        ]:
            if col_def[0] not in existing_cols:
                cursor.execute(f"ALTER TABLE review_events ADD COLUMN {col_def[0]} {col_def[1]}")

        # 21. Review Sessions Table (Groups active study reviews performed in a session)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS review_sessions (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
                started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                completed_at TEXT,
                total_items INTEGER NOT NULL DEFAULT 0,
                reviewed_items INTEGER NOT NULL DEFAULT 0,
                metadata TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_review_sessions_user ON review_sessions(workspace_id, user_id, status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_review_sessions_started ON review_sessions(workspace_id, user_id, started_at DESC)")

        # 22. Review Session Items Table (Individual cards/questions queued in a session)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS review_session_items (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                learning_item_id TEXT NOT NULL,
                order_index INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'revealed', 'completed', 'skipped')),
                rating TEXT CHECK (rating IN ('again', 'hard', 'good', 'easy')),
                reviewed_at TEXT,
                review_event_id TEXT,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (session_id) REFERENCES review_sessions(id) ON DELETE CASCADE,
                FOREIGN KEY (learning_item_id) REFERENCES learning_items(id) ON DELETE CASCADE,
                FOREIGN KEY (review_event_id) REFERENCES review_events(id) ON DELETE SET NULL,
                CONSTRAINT uq_session_item UNIQUE (session_id, learning_item_id)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_session_items_order ON review_session_items(session_id, order_index ASC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_session_items_status ON review_session_items(session_id, status)")

        # 23. Document Summaries Table (AI-generated cached summaries per document)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS document_summaries (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                workspace_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                summary_type TEXT NOT NULL DEFAULT 'standard'
                    CHECK (summary_type IN ('short', 'standard', 'detailed')),
                summary TEXT NOT NULL,
                key_points TEXT NOT NULL DEFAULT '[]',
                source_references TEXT NOT NULL DEFAULT '[]',
                content_version TEXT NOT NULL,
                model_metadata TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT uq_doc_summary UNIQUE (document_id, summary_type)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_doc_summaries_doc ON document_summaries(document_id, summary_type)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_doc_summaries_user ON document_summaries(workspace_id, user_id)")

        # 24. Concepts Table (AI-extracted normalized concepts per document)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS concepts (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                workspace_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                normalized_name TEXT NOT NULL,
                description TEXT NOT NULL,
                importance TEXT NOT NULL DEFAULT 'medium'
                    CHECK (importance IN ('high', 'medium', 'low')),
                source_references TEXT NOT NULL DEFAULT '[]',
                content_version TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT uq_doc_concept UNIQUE (document_id, normalized_name)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_concepts_doc ON concepts(document_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_concepts_ws_user ON concepts(workspace_id, user_id)")

        # 25. Subscriptions Table (SaaS subscription state machine)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS subscriptions (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                user_id TEXT,
                plan_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired')),
                provider TEXT NOT NULL DEFAULT 'stripe',
                provider_customer_id TEXT,
                provider_subscription_id TEXT UNIQUE,
                current_period_start TEXT NOT NULL,
                current_period_end TEXT NOT NULL,
                cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
                canceled_at TEXT,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (plan_id) REFERENCES plans(id)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_subscriptions_ws ON subscriptions(workspace_id, status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON subscriptions(provider_subscription_id)")

        # 26. Billing Events Table (Webhook audit log and idempotency guard)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS billing_events (
                id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL UNIQUE,
                provider TEXT NOT NULL DEFAULT 'stripe',
                event_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'processed',
                processed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_billing_events_id ON billing_events(event_id)")

        # 27. Usage Reservations Table (Atomic concurrency-safe credit locking)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS usage_reservations (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                feature TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'finalized', 'released', 'expired')),
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                finalized_at TEXT,
                released_at TEXT,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_reservations_ws_status ON usage_reservations(workspace_id, status, expires_at)")

        # 28. Account Overrides Table (Internal/promotional plan overrides)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS account_overrides (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                feature_or_limit TEXT NOT NULL,
                override_value TEXT NOT NULL,
                reason TEXT,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                CONSTRAINT uq_ws_override UNIQUE (workspace_id, feature_or_limit)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_overrides_ws ON account_overrides(workspace_id)")

        # Seed or update default plans with features
        free_features = json.dumps({
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
            "exports": False
        })
        pro_features = json.dumps({
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
            "exports": True
        })

        cursor.execute("SELECT COUNT(*) FROM plans")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                INSERT INTO plans (id, name, price_cents, billing_interval, monthly_credits, max_documents, max_storage_mb, byok_allowed, features, is_active)
                VALUES 
                    ('free', 'Starter Free', 0, 'month', 50, 10, 50, 1, ?, 1),
                    ('pro', 'Pro Scholar', 1500, 'month', 500, 100, 2048, 1, ?, 1)
            """, (free_features, pro_features))
            logger.info("Default plans (free, pro) seeded successfully.")
        else:
            cursor.execute("UPDATE plans SET features = ? WHERE id = 'free' AND (features IS NULL OR features = '{}' OR features = '')", (free_features,))
            cursor.execute("UPDATE plans SET features = ? WHERE id = 'pro' AND (features IS NULL OR features = '{}' OR features = '')", (pro_features,))

    logger.info("Foundation database schema initialized.")
