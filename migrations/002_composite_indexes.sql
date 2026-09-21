-- =============================================================================
-- Recall AI Performance Optimization: Composite Indexes
-- Migration: 002_composite_indexes.sql
-- Description: Adds high-selectivity composite indexes for primary listing,
--              status filtering, and temporal sort query paths.
-- =============================================================================

-- Composite index for document listing filtered by workspace, excluding deleted records, ordered by creation time
CREATE INDEX IF NOT EXISTS idx_documents_ws_active_created 
ON documents (workspace_id, deleted_at, created_at DESC);

-- Composite index for flashcard sets listing filtered by workspace, excluding deleted records, ordered by update time
CREATE INDEX IF NOT EXISTS idx_flashcard_sets_ws_active 
ON flashcard_sets (workspace_id, deleted_at, updated_at DESC);

-- Composite index for quizzes listing filtered by workspace, excluding deleted records, ordered by update time
CREATE INDEX IF NOT EXISTS idx_quizzes_ws_active 
ON quizzes (workspace_id, deleted_at, updated_at DESC);

-- Composite index for chunk candidate retrieval by document and creation timestamp
CREATE INDEX IF NOT EXISTS idx_chunks_doc_created 
ON document_chunks (document_id, created_at DESC);

-- Composite index for learning items due queue evaluation
CREATE INDEX IF NOT EXISTS idx_learning_items_due_eval 
ON learning_items (workspace_id, user_id, content_type, next_review_at ASC);
