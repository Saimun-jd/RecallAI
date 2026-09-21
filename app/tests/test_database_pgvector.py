"""
Comprehensive Regression & Validation Tests for Recall AI Database Layer & pgvector.
Verifies migrations, pgvector DDL, embedding pipeline consistency, vector tenant isolation,
document scoping, foreign key cascade behaviors, FSRS persistence, and unique constraints.
"""

import os
import json
import math
import tempfile
import unittest

from app.core.database import set_db_path, get_db, get_database_engine, get_connection_pool_status
from app.core.migrations import (
    run_migrations,
    get_migration_status,
    verify_migration_integrity,
    get_available_migrations,
    MIGRATIONS_DIR
)
from app.models.schema_init import init_foundation_db
from app.models.repositories import (
    UserRepository,
    WorkspaceRepository,
    DocumentRepository,
    ChunkRepository,
    FlashcardSetRepository,
    FlashcardRepository,
    QuizRepository,
    QuizQuestionRepository,
    QuizAttemptRepository,
    QuizAnswerRepository,
    LearningItemRepository
)
from app.services.embedding import EmbeddingService, TARGET_DIMENSION
from app.services.retrieval import VectorSearcher, RetrievalService


class TestDatabasePgvectorProduction(unittest.TestCase):
    def setUp(self):
        # Dedicated isolated temporary SQLite database for test execution
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db_path = self.temp_db.name
        self.temp_db.close()

        set_db_path(self.temp_db_path)
        init_foundation_db(self.temp_db_path)

    def tearDown(self):
        try:
            if os.path.exists(self.temp_db_path):
                os.remove(self.temp_db_path)
        except Exception:
            pass

    def test_migration_runner_bootstrap_and_idempotency(self):
        """Verifies migration discovery, execution, tracking, and idempotency."""
        # 1. Verify migration integrity
        self.assertTrue(verify_migration_integrity(), "Migration files must be consecutively numbered and valid.")

        # 2. Available migrations
        available = get_available_migrations()
        self.assertGreaterEqual(len(available), 2, "Must discover at least 001 and 002 migrations.")

        # 3. Run migrations on clean database
        applied = run_migrations(self.temp_db_path)
        self.assertGreaterEqual(len(applied), 2)

        # 4. Status should now be up to date
        status = get_migration_status(self.temp_db_path)
        self.assertEqual(status["status"], "up_to_date")
        self.assertEqual(len(status["pending_versions"]), 0)

        # 5. Idempotency: Running again should apply 0 new migrations
        second_run = run_migrations(self.temp_db_path)
        self.assertEqual(len(second_run), 0, "Second migration run must be idempotent and apply 0 migrations.")

    def test_pgvector_schema_ddl_integrity(self):
        """Validates that PostgreSQL migration DDL contains native pgvector and HNSW index specifications."""
        init_migration_path = os.path.join(MIGRATIONS_DIR, "001_initial_schema.sql")
        self.assertTrue(os.path.exists(init_migration_path), "001_initial_schema.sql must exist.")

        with open(init_migration_path, "r", encoding="utf-8") as f:
            ddl_content = f.read()

        # Check pgvector extension
        self.assertIn('CREATE EXTENSION IF NOT EXISTS "vector"', ddl_content)
        # Check vector dimension
        self.assertIn("vector(1536)", ddl_content)
        # Check HNSW index with cosine distance operator
        self.assertIn("USING hnsw (embedding vector_cosine_ops)", ddl_content)
        # Check UUID primary keys and JSONB types
        self.assertIn("UUID PRIMARY KEY DEFAULT gen_random_uuid()", ddl_content)
        self.assertIn("JSONB NOT NULL DEFAULT '{}'::jsonb", ddl_content)

        # Verify composite indexes migration
        idx_migration_path = os.path.join(MIGRATIONS_DIR, "002_composite_indexes.sql")
        self.assertTrue(os.path.exists(idx_migration_path), "002_composite_indexes.sql must exist.")

        with open(idx_migration_path, "r", encoding="utf-8") as f:
            idx_content = f.read()

        self.assertIn("idx_documents_ws_active_created", idx_content)
        self.assertIn("idx_flashcard_sets_ws_active", idx_content)
        self.assertIn("idx_quizzes_ws_active", idx_content)

    def test_embedding_consistency_and_normalization(self):
        """Verifies that embeddings are 1536-dimensional, unit L2-normalized, and cosine-comparable."""
        service = EmbeddingService(mock_mode=True)
        text = "Recall AI active recall and spaced repetition engine"
        emb = service.generate_embedding(text)

        self.assertEqual(len(emb), TARGET_DIMENSION)
        self.assertEqual(len(emb), 1536)

        # Check unit L2-norm: ||v|| = sqrt(sum(v^2)) == 1.0
        norm = math.sqrt(sum(v * v for v in emb))
        self.assertAlmostEqual(norm, 1.0, places=3, msg="Embedding vector must be L2-normalized to unit length.")

        # Test cosine similarity calculation
        sim_self = VectorSearcher.compute_similarity(emb, emb)
        self.assertAlmostEqual(sim_self, 1.0, places=3, msg="Self-similarity must equal 1.0.")

        # Test orthogonality / distinct vector comparison
        other_emb = service.generate_embedding("Completely unrelated quantum mechanics concepts")
        sim_diff = VectorSearcher.compute_similarity(emb, other_emb)
        self.assertGreaterEqual(sim_diff, 0.0)
        self.assertLess(sim_diff, 1.0)

    def test_vector_search_tenant_isolation(self):
        """
        Critical security test: verifies that User A's vector candidate search
        CAN NEVER return chunks belonging to User B's workspace.
        """
        # 1. Setup User A & Workspace A
        user_a = UserRepository.create_user(email="alice@tenant-a.com", password_hash="hash_a")
        ws_a = WorkspaceRepository.create_workspace(owner_id=user_a["id"], name="Alice Workspace")
        doc_a = DocumentRepository.create_document(workspace_id=ws_a["id"], title="Alice Document", status="ready")

        emb_service = EmbeddingService(mock_mode=True)
        emb_a = emb_service.generate_embedding("Confidential Project Alpha Financials")
        ChunkRepository.batch_create_chunks(
            document_id=doc_a["id"],
            chunks_data=[{
                "chunk_index": 0,
                "content": "Secret revenue projection for Company A is $10M.",
                "token_count": 15,
                "embedding": emb_a,
                "embedding_model": "text-embedding-3-small",
                "embedding_version": 1
            }]
        )

        # 2. Setup User B & Workspace B
        user_b = UserRepository.create_user(email="bob@tenant-b.com", password_hash="hash_b")
        ws_b = WorkspaceRepository.create_workspace(owner_id=user_b["id"], name="Bob Workspace")
        doc_b = DocumentRepository.create_document(workspace_id=ws_b["id"], title="Bob Document", status="ready")

        emb_b = emb_service.generate_embedding("Secret revenue projection for Company A is $10M.")
        ChunkRepository.batch_create_chunks(
            document_id=doc_b["id"],
            chunks_data=[{
                "chunk_index": 0,
                "content": "Bob private data chunk.",
                "token_count": 10,
                "embedding": emb_b,
                "embedding_model": "text-embedding-3-small",
                "embedding_version": 1
            }]
        )

        # 3. Query for Workspace A candidates
        candidates_a = ChunkRepository.search_candidates(workspace_id=ws_a["id"])
        self.assertEqual(len(candidates_a), 1)
        self.assertEqual(candidates_a[0]["document_id"], doc_a["id"])
        self.assertEqual(candidates_a[0]["document_title"], "Alice Document")

        # 4. Verify Bob's chunk can NEVER appear in Alice's candidates
        chunk_ids_a = {c["id"] for c in candidates_a}
        chunks_b = ChunkRepository.list_by_document(doc_b["id"])
        self.assertEqual(len(chunks_b), 1)
        self.assertNotIn(chunks_b[0]["id"], chunk_ids_a, "Bob's chunk MUST NOT appear in Alice's candidate pool.")

        # 5. Full RetrievalService search verification
        search_res = RetrievalService.search(
            query="Secret revenue projection",
            workspace_id=ws_a["id"],
            mode="semantic"
        )
        for item in search_res.results:
            self.assertEqual(item.document_id, doc_a["id"], "All retrieved items must belong strictly to Workspace A.")

    def test_multi_document_scoped_vector_search(self):
        """Verifies candidate retrieval scoped to a specific list of document IDs."""
        user = UserRepository.create_user(email="scoped@example.com", password_hash="hash")
        ws = WorkspaceRepository.create_workspace(owner_id=user["id"], name="Scoped WS")

        doc1 = DocumentRepository.create_document(workspace_id=ws["id"], title="Doc One", status="ready")
        doc2 = DocumentRepository.create_document(workspace_id=ws["id"], title="Doc Two", status="ready")
        doc3 = DocumentRepository.create_document(workspace_id=ws["id"], title="Doc Three", status="ready")

        for d, title in [(doc1, "Alpha"), (doc2, "Beta"), (doc3, "Gamma")]:
            ChunkRepository.batch_create_chunks(
                document_id=d["id"],
                chunks_data=[{
                    "chunk_index": 0,
                    "content": f"Content for {title}",
                    "token_count": 10,
                    "embedding": [0.1] * 1536
                }]
            )

        # Search scoped to doc1 and doc2 only
        scoped_candidates = ChunkRepository.search_candidates(
            workspace_id=ws["id"],
            document_ids=[doc1["id"], doc2["id"]]
        )
        returned_doc_ids = {c["document_id"] for c in scoped_candidates}

        self.assertEqual(len(scoped_candidates), 2)
        self.assertIn(doc1["id"], returned_doc_ids)
        self.assertIn(doc2["id"], returned_doc_ids)
        self.assertNotIn(doc3["id"], returned_doc_ids, "Doc 3 must be excluded from scoped candidates.")

    def test_foreign_key_cascades_and_soft_delete(self):
        """Verifies foreign key cascade deletes and soft-delete exclusions."""
        user = UserRepository.create_user(email="cascade@example.com", password_hash="hash")
        ws = WorkspaceRepository.create_workspace(owner_id=user["id"], name="Cascade WS")
        doc = DocumentRepository.create_document(workspace_id=ws["id"], title="To Cascade", status="ready")

        # Create chunk
        ChunkRepository.batch_create_chunks(
            document_id=doc["id"],
            chunks_data=[{"chunk_index": 0, "content": "Sample chunk", "token_count": 5}]
        )
        self.assertEqual(ChunkRepository.count_by_document(doc["id"]), 1)

        # Cascade delete document
        deleted = DocumentRepository.delete_document_cascade(doc["id"], ws["id"])
        self.assertIsNotNone(deleted)
        # Chunks should be automatically deleted via cascade
        self.assertEqual(ChunkRepository.count_by_document(doc["id"]), 0)

        # Test soft delete on flashcard sets
        fset = FlashcardSetRepository.create_set(workspace_id=ws["id"], user_id=user["id"], title="Set 1")
        FlashcardRepository.create_card(flashcard_set_id=fset["id"], front="Q1", back="A1")
        self.assertIsNotNone(FlashcardSetRepository.get_by_id_and_workspace(fset["id"], ws["id"]))

        # Soft delete set
        FlashcardSetRepository.delete_set(fset["id"], ws["id"])
        # Should now be excluded from active list and lookup
        self.assertIsNone(FlashcardSetRepository.get_by_id_and_workspace(fset["id"], ws["id"]))
        active_sets = FlashcardSetRepository.list_by_workspace(ws["id"])
        self.assertEqual(len(active_sets), 0)

        # Test learning item cleanup
        LearningItemRepository.init_items_for_content(
            workspace_id=ws["id"],
            user_id=user["id"],
            content_type="flashcard",
            items=[{"id": "card-123", "source_reference": {}}]
        )
        del_count = LearningItemRepository.delete_by_content_id(ws["id"], "flashcard", "card-123")
        self.assertEqual(del_count, 1)

    def test_fsrs_scheduler_persistence(self):
        """Validates that spaced repetition FSRS scheduling metadata is persisted accurately."""
        user = UserRepository.create_user(email="fsrs@example.com", password_hash="hash")
        ws = WorkspaceRepository.create_workspace(owner_id=user["id"], name="FSRS WS")

        # Initialize learning item
        LearningItemRepository.init_items_for_content(
            workspace_id=ws["id"],
            user_id=user["id"],
            content_type="flashcard",
            items=[{"id": "card-fsrs-1"}]
        )

        item = LearningItemRepository.get_or_create(ws["id"], user["id"], "flashcard", "card-fsrs-1")
        self.assertIsNotNone(item)
        self.assertEqual(item["content_id"], "card-fsrs-1")

        # Update learning progress with FSRS metadata
        updated = LearningItemRepository.update_learning_progress(
            item_id=item["id"],
            is_correct=True,
            next_review_at="2026-09-25T12:00:00Z",
            scheduling_metadata={
                "state": "review",
                "difficulty": 4.5,
                "stability": 7.2,
                "reps": 3
            }
        )
        self.assertTrue(updated)

        fetched = LearningItemRepository.get_by_id(item["id"])
        self.assertEqual(fetched["correct_count"], 1)
        self.assertEqual(fetched["next_review_at"], "2026-09-25T12:00:00Z")
        self.assertEqual(fetched["scheduling_metadata"]["stability"], 7.2)
        self.assertEqual(fetched["scheduling_metadata"]["difficulty"], 4.5)

    def test_unique_constraints_and_idempotency(self):
        """Verifies database unique constraints prevent duplicate records."""
        user = UserRepository.create_user(email="unique@example.com", password_hash="hash")
        ws = WorkspaceRepository.create_workspace(owner_id=user["id"], name="Unique WS")
        doc = DocumentRepository.create_document(workspace_id=ws["id"], title="Unique Doc")

        # 1. document_chunks (document_id, chunk_index) uniqueness
        ChunkRepository.batch_create_chunks(
            document_id=doc["id"],
            chunks_data=[{"chunk_index": 0, "content": "Chunk 0 Initial", "token_count": 5}]
        )
        # Inserting chunk 0 again updates on conflict
        ChunkRepository.batch_create_chunks(
            document_id=doc["id"],
            chunks_data=[{"chunk_index": 0, "content": "Chunk 0 Updated", "token_count": 6}]
        )
        chunks = ChunkRepository.list_by_document(doc["id"])
        self.assertEqual(len(chunks), 1, "Should upsert rather than creating duplicate chunk index.")
        self.assertEqual(chunks[0]["content"], "Chunk 0 Updated")

        # 2. quiz_answers (attempt_id, question_id) uniqueness
        quiz = QuizRepository.create_quiz(workspace_id=ws["id"], user_id=user["id"], title="Quiz Unique")
        questions = QuizQuestionRepository.create_questions_batch(
            quiz_id=quiz["id"],
            questions=[{
                "type": "multiple_choice",
                "question": "What is 2+2?",
                "options": ["3", "4", "5"],
                "correct_answer": "4",
                "explanation": "Math"
            }]
        )
        attempt = QuizAttemptRepository.create_attempt(workspace_id=ws["id"], user_id=user["id"], quiz_id=quiz["id"])
        q_id = questions[0]["id"]

        ans1 = QuizAnswerRepository.save_answer(attempt_id=attempt["id"], question_id=q_id, selected_answer="4", is_correct=True)
        self.assertIsNotNone(ans1)

        # Recording answer for same question in same attempt should update or be rejected by constraint
        with self.assertRaises(Exception):
            with get_db() as conn:
                conn.execute(
                    "INSERT INTO quiz_answers (id, attempt_id, question_id, selected_answer, is_correct) VALUES ('a2', ?, ?, '3', 0)",
                    (attempt["id"], q_id)
                )


if __name__ == "__main__":
    unittest.main()
