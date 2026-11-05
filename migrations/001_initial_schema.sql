-- =============================================================================
-- Recall AI PostgreSQL + pgvector Production Foundation Schema
-- Migration: 001_initial_schema.sql
-- Description: Creates extensions, core SaaS tables, pgvector HNSW index,
--              foreign keys, check constraints, and performance indexes.
-- =============================================================================

-- 1. PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- -----------------------------------------------------------------------------
-- 1. Users Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));

-- -----------------------------------------------------------------------------
-- 2. Workspaces Table (Single personal workspace invariant)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Personal Workspace',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);

-- -----------------------------------------------------------------------------
-- 3. User Preferences Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(50) NOT NULL DEFAULT 'neo-brutalist',
    daily_review_goal INTEGER NOT NULL DEFAULT 20 CHECK (daily_review_goal > 0),
    preferred_llm_provider VARCHAR(50) NOT NULL DEFAULT 'auto',
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- -----------------------------------------------------------------------------
-- 4. Plans Table (SaaS pricing & entitlement limits)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price_cents INTEGER NOT NULL DEFAULT 0,
    billing_interval VARCHAR(20) NOT NULL DEFAULT 'month',
    monthly_credits INTEGER NOT NULL DEFAULT 50,
    max_documents INTEGER NOT NULL DEFAULT 5,
    max_storage_mb INTEGER NOT NULL DEFAULT 50,
    byok_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- -----------------------------------------------------------------------------
-- 5. Files Table (Uploaded asset storage metadata)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    storage_provider VARCHAR(50) NOT NULL DEFAULT 'local',
    storage_path TEXT NOT NULL UNIQUE,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256_checksum VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_files_workspace ON files(workspace_id);

-- -----------------------------------------------------------------------------
-- 6. Core Documents Table (Foundation ownership entity)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    file_id UUID REFERENCES files(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL DEFAULT 'pdf',
    total_pages INTEGER NOT NULL DEFAULT 1 CHECK (total_pages >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'ready' CHECK (status IN ('uploading', 'processing', 'ready', 'failed', 'deleted')),
    processing_error TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_ws_created ON documents(workspace_id, deleted_at, created_at DESC);

-- -----------------------------------------------------------------------------
-- 7. Document Chunks Table with pgvector vector(1536) & HNSW Index
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    content TEXT NOT NULL,
    page_number INTEGER,
    token_count INTEGER NOT NULL CHECK (token_count > 0),
    embedding vector(1536),
    embedding_model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',
    embedding_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_document_chunk UNIQUE (document_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON document_chunks(document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- -----------------------------------------------------------------------------
-- 8. Processing Jobs Table (Asynchronous pipeline state machine)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'retrying', 'cancelled')),
    current_stage VARCHAR(100) NOT NULL DEFAULT 'validation',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    error_code VARCHAR(100),
    error_message TEXT,
    stage_progress INTEGER NOT NULL DEFAULT 0 CHECK (stage_progress BETWEEN 0 AND 100),
    idempotency_key VARCHAR(255) UNIQUE,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_doc ON processing_jobs(document_id, status);

-- -----------------------------------------------------------------------------
-- 9. Provider Credentials Table (AES-256-GCM Vault)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provider_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('gemini', 'openai', 'groq', 'ollama', 'anthropic', 'deepseek')),
    encrypted_key TEXT NOT NULL,
    key_nonce TEXT NOT NULL,
    key_tag TEXT NOT NULL,
    key_version INTEGER NOT NULL DEFAULT 1,
    key_hint VARCHAR(50) NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    last_tested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_workspace_provider UNIQUE (workspace_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_provider_credentials_ws ON provider_credentials(workspace_id);

-- -----------------------------------------------------------------------------
-- 10. Conversations Table (Knowledge Hub Chat Sessions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON conversations(workspace_id, updated_at DESC);

-- -----------------------------------------------------------------------------
-- 11. Messages Table (Conversation History with Source Citations)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    token_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);

-- -----------------------------------------------------------------------------
-- 12. Usage Records Table (Token and Credit Tracking)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation_type VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    credits_used INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_usage_records_ws ON usage_records(workspace_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 13. Flashcard Sets Table (Study material collections)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flashcard_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    source_document_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    card_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_flashcard_sets_ws ON flashcard_sets(workspace_id, updated_at DESC);

-- -----------------------------------------------------------------------------
-- 14. Flashcards Table (Individual atomic study cards)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flashcard_set_id UUID NOT NULL REFERENCES flashcard_sets(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    source_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_flashcards_set ON flashcards(flashcard_set_id, position ASC);

-- -----------------------------------------------------------------------------
-- 15. Quizzes Table (Assessment sets)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    source_document_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    question_count INTEGER NOT NULL DEFAULT 0,
    difficulty VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_quizzes_ws ON quizzes(workspace_id, updated_at DESC);

-- -----------------------------------------------------------------------------
-- 16. Quiz Questions Table (Atomic assessment questions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('multiple_choice', 'true_false')),
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_answer TEXT NOT NULL,
    explanation TEXT NOT NULL,
    source_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id, position ASC);

-- -----------------------------------------------------------------------------
-- 17. Quiz Attempts Table (One user's active/submitted attempt)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'abandoned')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    submitted_at TIMESTAMPTZ,
    score REAL NOT NULL DEFAULT 0.0,
    percentage REAL NOT NULL DEFAULT 0.0,
    total_questions INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_ws_user ON quiz_attempts(workspace_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_submitted ON quiz_attempts(workspace_id, user_id, status, submitted_at DESC);

-- -----------------------------------------------------------------------------
-- 18. Quiz Answers Table (User's response to an assessment question)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    selected_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt ON quiz_answers(attempt_id);

-- -----------------------------------------------------------------------------
-- 19. Learning Items Table (Durable knowledge progress state for FSRS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('quiz_question', 'flashcard', 'concept')),
    content_id VARCHAR(255) NOT NULL,
    source_reference JSONB NOT NULL DEFAULT '{}'::jsonb,
    correct_count INTEGER NOT NULL DEFAULT 0,
    incorrect_count INTEGER NOT NULL DEFAULT 0,
    last_seen_at TIMESTAMPTZ,
    next_review_at TIMESTAMPTZ,
    scheduling_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_learning_item UNIQUE (workspace_id, user_id, content_type, content_id)
);
CREATE INDEX IF NOT EXISTS idx_learning_items_due ON learning_items(workspace_id, user_id, next_review_at ASC);
CREATE INDEX IF NOT EXISTS idx_learning_items_ws_user_content ON learning_items(workspace_id, user_id, content_type);

-- -----------------------------------------------------------------------------
-- 20. Review Events Table (Append-only historical log of all review interactions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    learning_item_id UUID REFERENCES learning_items(id) ON DELETE SET NULL,
    content_type VARCHAR(50) NOT NULL,
    content_id VARCHAR(255) NOT NULL,
    result VARCHAR(50) NOT NULL,
    rating VARCHAR(20) NOT NULL DEFAULT 'good' CHECK (rating IN ('again', 'hard', 'good', 'easy', 'correct', 'incorrect')),
    previous_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    new_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    previous_due TIMESTAMPTZ,
    new_due TIMESTAMPTZ,
    source_type VARCHAR(50) NOT NULL DEFAULT 'quiz_attempt',
    source_id VARCHAR(255),
    session_id VARCHAR(255),
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_review_events_user ON review_events(workspace_id, user_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_events_item ON review_events(learning_item_id);

-- -----------------------------------------------------------------------------
-- 21. Review Sessions Table (Groups active study reviews performed in a session)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    completed_at TIMESTAMPTZ,
    total_items INTEGER NOT NULL DEFAULT 0,
    reviewed_items INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_review_sessions_user ON review_sessions(workspace_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_review_sessions_started ON review_sessions(workspace_id, user_id, started_at DESC);

-- -----------------------------------------------------------------------------
-- 22. Review Session Items Table (Individual queued items in a session)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_session_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
    learning_item_id UUID NOT NULL REFERENCES learning_items(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'revealed', 'completed', 'skipped')),
    rating VARCHAR(20) CHECK (rating IN ('again', 'hard', 'good', 'easy')),
    reviewed_at TIMESTAMPTZ,
    review_event_id UUID REFERENCES review_events(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_session_item UNIQUE (session_id, learning_item_id)
);
CREATE INDEX IF NOT EXISTS idx_session_items_order ON review_session_items(session_id, order_index ASC);
CREATE INDEX IF NOT EXISTS idx_session_items_status ON review_session_items(session_id, status);

-- -----------------------------------------------------------------------------
-- 23. Document Summaries Table (AI-generated cached summaries per document)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    summary_type VARCHAR(30) NOT NULL DEFAULT 'standard' CHECK (summary_type IN ('short', 'standard', 'detailed')),
    summary TEXT NOT NULL,
    key_points JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    content_version VARCHAR(50) NOT NULL,
    model_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_doc_summary UNIQUE (document_id, summary_type)
);
CREATE INDEX IF NOT EXISTS idx_doc_summaries_doc ON document_summaries(document_id, summary_type);
CREATE INDEX IF NOT EXISTS idx_doc_summaries_user ON document_summaries(workspace_id, user_id);

-- -----------------------------------------------------------------------------
-- 24. Concepts Table (AI-extracted normalized concepts per document)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS concepts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    importance VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (importance IN ('high', 'medium', 'low')),
    source_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    content_version VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_doc_concept UNIQUE (document_id, normalized_name)
);
CREATE INDEX IF NOT EXISTS idx_concepts_doc ON concepts(document_id);
CREATE INDEX IF NOT EXISTS idx_concepts_ws_user ON concepts(workspace_id, user_id);

-- -----------------------------------------------------------------------------
-- 25. Subscriptions Table (SaaS subscription state machine)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    plan_id VARCHAR(50) NOT NULL REFERENCES plans(id),
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired')),
    provider VARCHAR(50) NOT NULL DEFAULT 'stripe',
    provider_customer_id VARCHAR(255),
    provider_subscription_id VARCHAR(255) UNIQUE,
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_ws ON subscriptions(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON subscriptions(provider_subscription_id);

-- -----------------------------------------------------------------------------
-- 26. Billing Events Table (Webhook audit log and idempotency guard)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) NOT NULL UNIQUE,
    provider VARCHAR(50) NOT NULL DEFAULT 'stripe',
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'processed',
    processed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_billing_events_id ON billing_events(event_id);

-- -----------------------------------------------------------------------------
-- 27. Usage Reservations Table (Atomic concurrency-safe credit locking)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'finalized', 'released', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    finalized_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reservations_ws_status ON usage_reservations(workspace_id, status, expires_at);

-- -----------------------------------------------------------------------------
-- 28. Account Overrides Table (Internal/promotional plan overrides)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    feature_or_limit VARCHAR(100) NOT NULL,
    override_value VARCHAR(255) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_ws_override UNIQUE (workspace_id, feature_or_limit)
);
CREATE INDEX IF NOT EXISTS idx_overrides_ws ON account_overrides(workspace_id);

-- -----------------------------------------------------------------------------
-- Seed Initial Plans
-- -----------------------------------------------------------------------------
INSERT INTO plans (id, name, price_cents, billing_interval, monthly_credits, max_documents, max_storage_mb, byok_allowed, features, is_active)
VALUES 
    ('free', 'Starter Free', 0, 'month', 50, 10, 50, TRUE, '{"documents": true, "document_storage": true, "ai_chat": true, "semantic_search": true, "summaries": true, "concepts": true, "flashcards": true, "quizzes": true, "reviews": true, "analytics": true, "byok": true, "exports": false}'::jsonb, TRUE),
    ('pro', 'Pro Scholar', 1500, 'month', 500, 100, 2048, TRUE, '{"documents": true, "document_storage": true, "ai_chat": true, "semantic_search": true, "summaries": true, "concepts": true, "flashcards": true, "quizzes": true, "reviews": true, "analytics": true, "byok": true, "exports": true}'::jsonb, TRUE)
ON CONFLICT (id) DO NOTHING;
