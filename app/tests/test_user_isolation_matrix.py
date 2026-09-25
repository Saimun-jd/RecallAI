"""
Comprehensive Multi-Tenant User Isolation Matrix Test Suite.
Fulfills Prompt 38 (Section 7 and Section 18) of the Recall AI production roadmap:
Explicitly verifies that User A and User B cannot access, mutate, delete, or
indirectly discover each other's resources across:
1. Documents (Read, Update, Delete)
2. Summaries and Extracted Concepts
3. Chunks & Vector Retrieval (Direct IDOR & Indirect Search queries)
4. Conversations & RAG Chat Messages
5. Flashcard Sets and Flashcard Items
6. Quizzes, Questions, and Quiz Attempts
7. Spaced Repetition Review Queues and Sessions
8. Usage Records & Monetization Data
9. BYOK Provider Credentials & Secrets
10. Learning Progress & Analytics
"""

import json
import os
import shutil
import tempfile
import unittest
import uuid
from fastapi.testclient import TestClient

from app.main import app
from app.api.middleware import auth_rate_limiter
from app.api.v1.search import search_rate_limiter
from app.api.v1.quizzes import quiz_rate_limiter
from app.core.database import set_db_path, get_db
from app.models.schema_init import init_foundation_db
from app.models.repositories import (
    DocumentRepository,
    ChunkRepository,
    DocumentSummaryRepository,
    ConceptRepository,
    ConversationRepository,
    MessageRepository,
    FlashcardSetRepository,
    FlashcardRepository,
    QuizRepository,
    QuizQuestionRepository,
    LearningItemRepository,
    UsageRepository,
    ProviderCredentialRepository,
)
from app.services.embedding import TARGET_DIMENSION
from app.services.storage import StorageService


class TestUserIsolationMatrix(unittest.TestCase):
    def setUp(self):
        auth_rate_limiter.reset()
        search_rate_limiter.reset()
        quiz_rate_limiter.reset()

        # 1. Isolated temporary test database
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db_path = self.temp_db.name
        self.temp_db.close()

        set_db_path(self.temp_db_path)
        init_foundation_db(self.temp_db_path)

        # 2. Isolated storage
        self.temp_storage_dir = tempfile.mkdtemp(prefix="recall_isolation_storage_")
        StorageService.set_root_dir(self.temp_storage_dir)

        # 3. TestClient
        self.client = TestClient(app)

        # 4. Register User A and User B
        uid_a = os.urandom(4).hex()
        uid_b = os.urandom(4).hex()
        self.token_a, self.ws_a, self.user_a_id = self._register_user(f"usera_{uid_a}@recall.test", "Password123!", "Alice Scholar")
        self.token_b, self.ws_b, self.user_b_id = self._register_user(f"userb_{uid_b}@recall.test", "Password123!", "Bob Researcher")

        self.headers_a = {"Authorization": f"Bearer {self.token_a}"}
        self.headers_b = {"Authorization": f"Bearer {self.token_b}"}

        # 5. Populate User A's complete resource universe
        self._populate_user_a_resources()

        # 6. Populate User B's complete resource universe
        self._populate_user_b_resources()

    def tearDown(self):
        try:
            if os.path.exists(self.temp_db_path):
                os.remove(self.temp_db_path)
            if os.path.exists(self.temp_storage_dir):
                shutil.rmtree(self.temp_storage_dir, ignore_errors=True)
        except Exception:
            pass

    def _register_user(self, email: str, password: str, full_name: str):
        resp = self.client.post("/api/v1/auth/signup", json={
            "email": email,
            "password": password,
            "full_name": full_name
        })
        self.assertEqual(resp.status_code, 201, resp.text)
        data = resp.json()["data"]
        return data["access_token"], data["workspace"]["id"], data["user"]["id"]

    def _populate_user_a_resources(self):
        # Document A & Chunks
        self.doc_a = DocumentRepository.create_document(
            workspace_id=self.ws_a,
            title="Alice Confidential Paper",
            source_type="pdf",
            total_pages=3
        )
        self.doc_a_id = self.doc_a["id"]

        self.chunk_a1_id = str(uuid.uuid4())
        mock_embedding = [0.1] * TARGET_DIMENSION
        ChunkRepository.batch_create_chunks(self.doc_a_id, [{
            "id": self.chunk_a1_id,
            "chunk_index": 0,
            "content": "Alice secret finding on CRISPR Cas9 gene editing mechanism.",
            "page_number": 1,
            "token_count": 15,
            "embedding": mock_embedding,
            "embedding_model": "text-embedding-3-small",
            "embedding_version": 1
        }])
        DocumentRepository.update_status(self.doc_a_id, status="ready")

        # Summary A
        self.summary_a = DocumentSummaryRepository.upsert_summary(
            document_id=self.doc_a_id,
            workspace_id=self.ws_a,
            user_id=self.user_a_id,
            summary_type="standard",
            summary="Summary of Alice confidential CRISPR paper.",
            key_points=json.dumps(["Cas9 edits genes", "Guide RNA targets DNA"]),
            source_references=json.dumps([{"chunk_id": self.chunk_a1_id, "page": 1}]),
            content_version="1",
            model_metadata="{}"
        )

        # Concept A
        concepts = ConceptRepository.batch_upsert_concepts([{
            "document_id": self.doc_a_id,
            "workspace_id": self.ws_a,
            "user_id": self.user_a_id,
            "name": "Cas9 Endonuclease",
            "normalized_name": "cas9 endonuclease",
            "description": "RNA-guided enzyme used in genome engineering.",
            "importance": "high",
            "source_references": json.dumps([{"chunk_id": self.chunk_a1_id, "page": 1}]),
            "content_version": "1"
        }])
        self.concept_a = concepts[0] if concepts else None

        # Conversation A & Message
        self.conv_a = ConversationRepository.create_conversation(
            workspace_id=self.ws_a,
            user_id=self.user_a_id,
            title="Alice CRISPR Q&A"
        )
        self.conv_a_id = self.conv_a["id"]
        MessageRepository.create_message(
            conversation_id=self.conv_a_id,
            role="user",
            content="How does Cas9 bind to target DNA?"
        )

        # Flashcards A
        self.fset_a = FlashcardSetRepository.create_set(
            workspace_id=self.ws_a,
            user_id=self.user_a_id,
            title="Alice CRISPR Flashcards",
            source_document_ids=[self.doc_a_id],
            card_count=1
        )
        self.fset_a_id = self.fset_a["id"]
        created_cards = FlashcardRepository.create_flashcards_batch(self.fset_a_id, [
            {"front": "What does Cas9 require?", "back": "A guide RNA and a PAM sequence.", "order_index": 0}
        ])
        self.card_a_id = created_cards[0]["id"]

        # Learning Item for Alice
        LearningItemRepository.init_items_for_content(
            workspace_id=self.ws_a,
            user_id=self.user_a_id,
            content_type="flashcard",
            items=[{"id": self.card_a_id, "source_reference": {"flashcard_set_id": self.fset_a_id}}]
        )

        # Quiz A
        self.quiz_a = QuizRepository.create_quiz(
            workspace_id=self.ws_a,
            user_id=self.user_a_id,
            title="Alice Genetics Quiz",
            source_document_ids=[self.doc_a_id],
            question_count=1
        )
        self.quiz_a_id = self.quiz_a["id"]
        q_created = QuizQuestionRepository.create_questions_batch(self.quiz_a_id, [
            {
                "question": "Which molecule guides Cas9?",
                "question_type": "multiple_choice",
                "options": ["gRNA", "mRNA", "tRNA", "rRNA"],
                "correct_answer": "gRNA",
                "explanation": "gRNA pairs with the target sequence.",
                "order_index": 0
            }
        ])
        self.q_a_id = q_created[0]["id"]

        # BYOK for Alice
        ProviderCredentialRepository.save_credential(
            workspace_id=self.ws_a,
            user_id=self.user_a_id,
            provider="openai",
            encrypted_key="enc_alice_secret_openai_key_xyz",
            key_nonce="nonce123",
            key_tag="tag123",
            key_hint="...axyz"
        )

        # Usage record for Alice
        UsageRepository.record_usage(
            workspace_id=self.ws_a,
            user_id=self.user_a_id,
            operation_type="flashcards",
            provider="mock",
            model="mock",
            input_tokens=100,
            output_tokens=50,
            credits_used=1
        )

    def _populate_user_b_resources(self):
        # Document B
        self.doc_b = DocumentRepository.create_document(
            workspace_id=self.ws_b,
            title="Bob Quantum Physics Document",
            source_type="pdf",
            total_pages=4
        )
        self.doc_b_id = self.doc_b["id"]

        self.chunk_b1_id = str(uuid.uuid4())
        mock_embedding = [0.2] * TARGET_DIMENSION
        ChunkRepository.batch_create_chunks(self.doc_b_id, [{
            "id": self.chunk_b1_id,
            "chunk_index": 0,
            "content": "Bob research on Quantum Entanglement and Bell inequalities.",
            "page_number": 1,
            "token_count": 15,
            "embedding": mock_embedding,
            "embedding_model": "text-embedding-3-small",
            "embedding_version": 1
        }])
        DocumentRepository.update_status(self.doc_b_id, status="ready")

        # Conversation B
        self.conv_b = ConversationRepository.create_conversation(
            workspace_id=self.ws_b,
            user_id=self.user_b_id,
            title="Bob Quantum Chat"
        )
        self.conv_b_id = self.conv_b["id"]

        # Flashcards B
        self.fset_b = FlashcardSetRepository.create_set(
            workspace_id=self.ws_b,
            user_id=self.user_b_id,
            title="Bob Quantum Cards",
            source_document_ids=[self.doc_b_id],
            card_count=0
        )
        self.fset_b_id = self.fset_b["id"]

        # Quiz B
        self.quiz_b = QuizRepository.create_quiz(
            workspace_id=self.ws_b,
            user_id=self.user_b_id,
            title="Bob Physics Exam",
            source_document_ids=[self.doc_b_id],
            question_count=0
        )
        self.quiz_b_id = self.quiz_b["id"]

        # BYOK for Bob
        ProviderCredentialRepository.save_credential(
            workspace_id=self.ws_b,
            user_id=self.user_b_id,
            provider="gemini",
            encrypted_key="enc_bob_secret_gemini_key_uvw",
            key_nonce="nonce456",
            key_tag="tag456",
            key_hint="...buvw"
        )

    # =========================================================================
    # 1. DOCUMENT ISOLATION TESTS
    # =========================================================================

    def test_user_a_cannot_read_user_b_document(self):
        """User A querying User B's document receives 404 (not 403, preventing existence leaks)."""
        res = self.client.get(f"/api/v1/documents/{self.doc_b_id}", headers=self.headers_a)
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()["error"]["code"], "NOT_FOUND")

    def test_user_b_cannot_read_user_a_document(self):
        """User B querying User A's document receives 404."""
        res = self.client.get(f"/api/v1/documents/{self.doc_a_id}", headers=self.headers_b)
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()["error"]["code"], "NOT_FOUND")

    def test_user_a_cannot_update_user_b_document(self):
        """User A attempting to reindex User B's document receives 404."""
        res = self.client.post(
            f"/api/v1/documents/{self.doc_b_id}/reindex",
            headers=self.headers_a
        )
        self.assertEqual(res.status_code, 404)
        doc = DocumentRepository.get_by_id_and_workspace(self.doc_b_id, self.ws_b)
        self.assertEqual(doc["title"], "Bob Quantum Physics Document")

    def test_user_a_cannot_delete_user_b_document(self):
        """User A attempting to delete User B's document receives 404."""
        res = self.client.delete(f"/api/v1/documents/{self.doc_b_id}", headers=self.headers_a)
        self.assertEqual(res.status_code, 404)
        # Document still exists in Bob's workspace
        self.assertIsNotNone(DocumentRepository.get_by_id_and_workspace(self.doc_b_id, self.ws_b))

    def test_document_listing_isolation(self):
        """User A document listing contains ONLY Alice documents, zero Bob documents."""
        res_a = self.client.get("/api/v1/documents", headers=self.headers_a)
        self.assertEqual(res_a.status_code, 200)
        items_a = res_a.json()["data"]["documents"]
        doc_ids_a = [d["id"] for d in items_a]
        self.assertIn(self.doc_a_id, doc_ids_a)
        self.assertNotIn(self.doc_b_id, doc_ids_a)

        res_b = self.client.get("/api/v1/documents", headers=self.headers_b)
        self.assertEqual(res_b.status_code, 200)
        items_b = res_b.json()["data"]["documents"]
        doc_ids_b = [d["id"] for d in items_b]
        self.assertIn(self.doc_b_id, doc_ids_b)
        self.assertNotIn(self.doc_a_id, doc_ids_b)

    # =========================================================================
    # 2. SUMMARIES & CONCEPTS ISOLATION
    # =========================================================================

    def test_user_b_cannot_access_user_a_summary(self):
        """User B requesting User A's document summary receives 404."""
        res = self.client.get(f"/api/v1/documents/{self.doc_a_id}/summary", headers=self.headers_b)
        self.assertEqual(res.status_code, 404)

    def test_user_b_cannot_access_user_a_concepts(self):
        """User B requesting User A's document concepts receives 404."""
        res = self.client.get(f"/api/v1/documents/{self.doc_a_id}/concepts", headers=self.headers_b)
        self.assertEqual(res.status_code, 404)

    def test_user_b_cannot_access_concept_by_direct_id(self):
        """User B requesting User A's concept ID receives 404."""
        if self.concept_a:
            res = self.client.get(f"/api/v1/concepts/{self.concept_a['id']}", headers=self.headers_b)
            self.assertEqual(res.status_code, 404)

    # =========================================================================
    # 3. CHUNKS & SEARCH / RETRIEVAL ISOLATION
    # =========================================================================

    def test_user_b_cannot_search_user_a_document_scope(self):
        """User B passing User A's document_id as search filter is rejected with 404."""
        res = self.client.get(
            f"/api/v1/search?query=CRISPR&document_id={self.doc_a_id}",
            headers=self.headers_b
        )
        self.assertEqual(res.status_code, 404)

    def test_indirect_search_isolation(self):
        """User B searching keywords present in User A's chunks returns 0 results from Document A."""
        res = self.client.get(
            "/api/v1/search?query=CRISPR+Cas9+mechanism&mode=keyword",
            headers=self.headers_b
        )
        self.assertEqual(res.status_code, 200)
        results = res.json()["data"]["results"]
        # Must not contain any chunk from Alice's document
        alice_chunk_ids = [self.chunk_a1_id]
        for r in results:
            self.assertNotIn(r["chunk_id"], alice_chunk_ids)

    # =========================================================================
    # 4. CONVERSATIONS & CHAT ISOLATION
    # =========================================================================

    def test_user_b_cannot_access_user_a_conversation(self):
        """User B requesting User A's conversation receives 404."""
        res = self.client.get(f"/api/v1/conversations/{self.conv_a_id}", headers=self.headers_b)
        self.assertEqual(res.status_code, 404)

    def test_user_b_cannot_post_message_to_user_a_conversation(self):
        """User B posting a message to User A's conversation receives 404."""
        res = self.client.post(
            f"/api/v1/conversations/{self.conv_a_id}/messages",
            json={"content": "Injected hostile message"},
            headers=self.headers_b
        )
        self.assertEqual(res.status_code, 404)

    def test_user_b_cannot_delete_user_a_conversation(self):
        """User B attempting to delete User A's conversation receives 404."""
        res = self.client.delete(f"/api/v1/conversations/{self.conv_a_id}", headers=self.headers_b)
        self.assertEqual(res.status_code, 404)
        # Conversation A still exists
        self.assertIsNotNone(ConversationRepository.get_by_id_and_workspace(self.conv_a_id, self.ws_a))

    def test_conversation_listing_isolation(self):
        """User A and User B conversation lists are strictly partitioned."""
        res_a = self.client.get("/api/v1/conversations", headers=self.headers_a)
        conv_ids_a = [c["id"] for c in res_a.json()["data"]["conversations"]]
        self.assertIn(self.conv_a_id, conv_ids_a)
        self.assertNotIn(self.conv_b_id, conv_ids_a)

        res_b = self.client.get("/api/v1/conversations", headers=self.headers_b)
        conv_ids_b = [c["id"] for c in res_b.json()["data"]["conversations"]]
        self.assertIn(self.conv_b_id, conv_ids_b)
        self.assertNotIn(self.conv_a_id, conv_ids_b)

    # =========================================================================
    # 5. FLASHCARDS ISOLATION
    # =========================================================================

    def test_user_b_cannot_read_user_a_flashcard_set(self):
        """User B accessing User A's flashcard set receives 404."""
        res = self.client.get(f"/api/v1/flashcards/sets/{self.fset_a_id}", headers=self.headers_b)
        self.assertEqual(res.status_code, 404)

    def test_user_b_cannot_delete_user_a_flashcard_set(self):
        """User B attempting to delete User A's flashcard set receives 404."""
        res = self.client.delete(f"/api/v1/flashcards/sets/{self.fset_a_id}", headers=self.headers_b)
        self.assertEqual(res.status_code, 404)
        self.assertIsNotNone(FlashcardSetRepository.get_by_id_and_workspace(self.fset_a_id, self.ws_a))

    def test_user_b_cannot_generate_flashcards_from_user_a_document(self):
        """User B attempting to generate flashcards from Alice's document is rejected."""
        res = self.client.post(
            "/api/v1/flashcards/generate",
            json={"document_ids": [self.doc_a_id], "card_count": 3},
            headers=self.headers_b
        )
        self.assertEqual(res.status_code, 404)

    # =========================================================================
    # 6. QUIZZES & ATTEMPTS ISOLATION
    # =========================================================================

    def test_user_b_cannot_read_user_a_quiz(self):
        """User B accessing User A's quiz receives 404."""
        res = self.client.get(f"/api/v1/quizzes/{self.quiz_a_id}", headers=self.headers_b)
        self.assertEqual(res.status_code, 404)

    def test_user_b_cannot_start_attempt_on_user_a_quiz(self):
        """User B attempting to take User A's quiz is rejected with 404."""
        res = self.client.post(
            f"/api/v1/quizzes/{self.quiz_a_id}/attempts",
            headers=self.headers_b
        )
        self.assertEqual(res.status_code, 404)

    def test_user_b_cannot_generate_quiz_from_user_a_document(self):
        """User B attempting to generate a quiz from Alice's document is rejected."""
        res = self.client.post(
            "/api/v1/quizzes/generate",
            json={"document_ids": [self.doc_a_id], "question_count": 3},
            headers=self.headers_b
        )
        self.assertEqual(res.status_code, 404)

    # =========================================================================
    # 7. SPACED REPETITION & REVIEW QUEUE ISOLATION
    # =========================================================================

    def test_review_queue_isolation(self):
        """Review queue only contains items owned by the requesting user."""
        res_b = self.client.get("/api/v1/reviews/queue", headers=self.headers_b)
        self.assertEqual(res_b.status_code, 200)
        items = res_b.json()["data"]
        # Bob should not have Alice's flashcard in his review queue
        card_ids = [item["content_id"] for item in items]
        self.assertNotIn(self.card_a_id, card_ids)

    def test_user_b_cannot_rate_user_a_review_item(self):
        """User B cannot submit ratings on User A's review session items."""
        # Alice creates a review session
        create_res = self.client.post(
            "/api/v1/reviews/sessions",
            json={"limit": 10},
            headers=self.headers_a
        )
        self.assertEqual(create_res.status_code, 201)
        session_id = create_res.json()["data"]["id"]

        # Bob attempts to fetch Alice's review session -> 404
        bob_fetch = self.client.get(
            f"/api/v1/reviews/sessions/{session_id}",
            headers=self.headers_b
        )
        self.assertEqual(bob_fetch.status_code, 404)

        # Bob attempts to rate next item in Alice's session -> 404
        bob_rate = self.client.post(
            f"/api/v1/reviews/sessions/{session_id}/rate",
            json={"item_id": self.card_a_id, "rating": "good"},
            headers=self.headers_b
        )
        self.assertEqual(bob_rate.status_code, 404)

    # =========================================================================
    # 8. BYOK PROVIDER CREDENTIALS & SECRETS ISOLATION
    # =========================================================================

    def test_byok_credentials_complete_isolation(self):
        """User A sees OpenAI (and masked key), User B sees Gemini; neither sees the other."""
        res_a = self.client.get("/api/v1/account/byok/credentials", headers=self.headers_a)
        self.assertEqual(res_a.status_code, 200)
        creds_a = res_a.json()["data"]
        providers_a = [c["provider"] for c in creds_a]
        self.assertIn("openai", providers_a)
        self.assertNotIn("gemini", providers_a)
        # Plaintext secrets never exposed
        for c in creds_a:
            self.assertNotIn("enc_alice", c.get("key_hint", ""))
            self.assertNotIn("enc_bob", c.get("key_hint", ""))

        res_b = self.client.get("/api/v1/account/byok/credentials", headers=self.headers_b)
        self.assertEqual(res_b.status_code, 200)
        creds_b = res_b.json()["data"]
        providers_b = [c["provider"] for c in creds_b]
        self.assertIn("gemini", providers_b)
        self.assertNotIn("openai", providers_b)

    def test_user_b_cannot_delete_user_a_byok_credential(self):
        """User B attempting to delete User A's OpenAI credential deletes nothing for User A."""
        # Bob does not have OpenAI configured, so deleting returns 200 with deleted=False
        res = self.client.delete("/api/v1/account/byok/credentials/openai", headers=self.headers_b)
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json()["data"]["deleted"])
        # Alice's OpenAI key is intact
        alice_cred = ProviderCredentialRepository.get_by_workspace_and_provider(self.ws_a, "openai")
        self.assertIsNotNone(alice_cred)

    # =========================================================================
    # 9. USAGE & LEARNING PROGRESS ISOLATION
    # =========================================================================

    def test_usage_summary_isolation(self):
        """Usage summary endpoint strictly scopes metrics to caller's workspace."""
        res_a = self.client.get("/api/v1/account/overview", headers=self.headers_a)
        self.assertEqual(res_a.status_code, 200)
        self.assertEqual(res_a.json()["data"]["usage"]["ai_credits"]["used"], 1)

        res_b = self.client.get("/api/v1/account/overview", headers=self.headers_b)
        self.assertEqual(res_b.status_code, 200)
        self.assertEqual(res_b.json()["data"]["usage"]["ai_credits"]["used"], 0)

    def test_learning_progress_metrics_isolation(self):
        """Learning overview metrics are strictly partitioned between User A and User B."""
        res_a = self.client.get("/api/v1/learning/dashboard", headers=self.headers_a)
        self.assertEqual(res_a.status_code, 200)
        self.assertEqual(res_a.json()["data"]["flashcards"]["total_cards"], 1)

        res_b = self.client.get("/api/v1/learning/dashboard", headers=self.headers_b)
        self.assertEqual(res_b.status_code, 200)
        self.assertEqual(res_b.json()["data"]["flashcards"]["total_cards"], 0)


if __name__ == "__main__":
    unittest.main()
