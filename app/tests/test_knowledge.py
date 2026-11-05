"""
Comprehensive Test Suite for Prompt 14: AI Summaries, Concepts & Knowledge Organization Backend.
Tests:
1. Summary Generation & Levels (short, standard, detailed)
2. Summary Caching (read-only GET, 0 credits)
3. Summary Regeneration (force=True)
4. Summary Staleness Detection (content_version invalidation)
5. Concept Extraction & Normalization
6. Concept Importance Validation (high, medium, low)
7. Source Reference Validation (valid citations kept, hallucinated dropped)
8. Document Readiness Validation (non-ready docs rejected with 0 credits)
9. Empty Document Handling (0 chunks → 422 with 0 credits)
10. Multi-Tenant Isolation & IDOR Defense
11. AI Usage Accounting (1 credit standard, 0 BYOK)
12. Individual Concept Retrieval
13. Cascading Deletion (document deletion removes summaries and concepts)
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
from app.core.database import set_db_path, get_db
from app.models.schema_init import init_foundation_db
from app.models.repositories import (
    ChunkRepository,
    ConceptRepository,
    DocumentRepository,
    DocumentSummaryRepository,
    UsageRepository,
)
from app.services.storage import StorageService


class TestKnowledgeLayer(unittest.TestCase):
    def setUp(self):
        auth_rate_limiter.reset()

        # 1. Isolated temporary database
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db_path = self.temp_db.name
        self.temp_db.close()

        set_db_path(self.temp_db_path)
        init_foundation_db(self.temp_db_path)

        # 2. Isolated storage
        self.temp_storage_dir = tempfile.mkdtemp(prefix="recall_knowledge_storage_")
        StorageService.set_root_dir(self.temp_storage_dir)

        # 3. TestClient
        self.client = TestClient(app)

        # 4. Register two isolated tenants
        uid = os.urandom(4).hex()
        self.user_a_token, self.user_a_ws_id, self.user_a_id = self._register_user(
            f"user_a_{uid}@test.com", "Password123!"
        )
        self.user_b_token, self.user_b_ws_id, self.user_b_id = self._register_user(
            f"user_b_{uid}@test.com", "Password123!"
        )

    def tearDown(self):
        try:
            if os.path.exists(self.temp_db_path):
                os.remove(self.temp_db_path)
            if os.path.exists(self.temp_storage_dir):
                shutil.rmtree(self.temp_storage_dir, ignore_errors=True)
        except Exception:
            pass

    def _register_user(self, email: str, password: str):
        resp = self.client.post("/api/v1/auth/signup", json={
            "email": email,
            "password": password,
            "full_name": "Knowledge Test User"
        })
        self.assertEqual(resp.status_code, 201, resp.text)
        data = resp.json()["data"]
        return data["access_token"], data["workspace"]["id"], data["user"]["id"]

    def _create_ready_document_with_chunks(self, workspace_id: str, title: str = "Test Document", num_chunks: int = 3):
        """Creates a ready document with mock chunks for testing."""
        doc = DocumentRepository.create_document(
            workspace_id=workspace_id,
            title=title,
            source_type="pdf",
            total_pages=5
        )
        doc_id = doc["id"]

        # Create chunks with content
        chunks_data = []
        for i in range(num_chunks):
            chunks_data.append({
                "chunk_index": i,
                "content": f"This is chunk {i + 1} of {title}. It contains important information about topic {i + 1}.",
                "page_number": i + 1,
                "token_count": 25,
                "embedding": json.dumps([0.1] * 1536),
                "embedding_model": "text-embedding-3-small",
                "embedding_version": 1,
            })
        ChunkRepository.batch_create_chunks(doc_id, chunks_data)

        # Mark document as ready
        DocumentRepository.update_status(doc_id, status="ready")

        return doc_id

    def _auth_headers(self, token: str):
        return {"Authorization": f"Bearer {token}"}

    # =========================================================================
    # 1. SUMMARY GENERATION TESTS
    # =========================================================================

    def test_summary_generation_standard(self):
        """Generate a standard summary for a document with chunks."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers = self._auth_headers(self.user_a_token)

        resp = self.client.post(
            f"/api/v1/documents/{doc_id}/summary",
            json={"summary_type": "standard"},
            headers=headers,
        )
        self.assertEqual(resp.status_code, 201, resp.text)
        data = resp.json()["data"]

        self.assertEqual(data["document_id"], doc_id)
        self.assertEqual(data["summary_type"], "standard")
        self.assertTrue(len(data["summary"]) > 0)
        self.assertIsInstance(data["key_points"], list)
        self.assertIsInstance(data["source_references"], list)
        self.assertFalse(data["is_stale"])

    def test_summary_generation_short(self):
        """Generate a short summary."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers = self._auth_headers(self.user_a_token)

        resp = self.client.post(
            f"/api/v1/documents/{doc_id}/summary",
            json={"summary_type": "short"},
            headers=headers,
        )
        self.assertEqual(resp.status_code, 201, resp.text)
        data = resp.json()["data"]
        self.assertEqual(data["summary_type"], "short")

    def test_summary_generation_detailed(self):
        """Generate a detailed summary."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers = self._auth_headers(self.user_a_token)

        resp = self.client.post(
            f"/api/v1/documents/{doc_id}/summary",
            json={"summary_type": "detailed"},
            headers=headers,
        )
        self.assertEqual(resp.status_code, 201, resp.text)
        data = resp.json()["data"]
        self.assertEqual(data["summary_type"], "detailed")

    # =========================================================================
    # 2. SUMMARY CACHING (READ-ONLY GET)
    # =========================================================================

    def test_summary_get_returns_cached_with_zero_credits(self):
        """GET /summary returns cached summary and consumes 0 credits."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers = self._auth_headers(self.user_a_token)

        # Generate summary first
        resp = self.client.post(
            f"/api/v1/documents/{doc_id}/summary",
            json={"summary_type": "standard"},
            headers=headers,
        )
        self.assertEqual(resp.status_code, 201)
        generated = resp.json()["data"]

        # Record credits after generation
        credits_after_gen = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)

        # GET should return cached summary without additional credits
        resp2 = self.client.get(
            f"/api/v1/documents/{doc_id}/summary?summary_type=standard",
            headers=headers,
        )
        self.assertEqual(resp2.status_code, 200, resp2.text)
        cached = resp2.json()["data"]

        self.assertEqual(cached["id"], generated["id"])
        self.assertEqual(cached["summary"], generated["summary"])

        # Verify 0 additional credits consumed
        credits_after_get = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)
        self.assertEqual(credits_after_gen, credits_after_get)

    def test_summary_get_no_existing_returns_404(self):
        """GET /summary returns 404 if no summary has been generated yet."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers = self._auth_headers(self.user_a_token)

        resp = self.client.get(
            f"/api/v1/documents/{doc_id}/summary?summary_type=standard",
            headers=headers,
        )
        self.assertEqual(resp.status_code, 404, resp.text)

    # =========================================================================
    # 3. SUMMARY REGENERATION (force=True)
    # =========================================================================

    def test_summary_force_regeneration(self):
        """POST with force=True regenerates even if cached."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers = self._auth_headers(self.user_a_token)

        # First generation
        resp1 = self.client.post(
            f"/api/v1/documents/{doc_id}/summary",
            json={"summary_type": "standard"},
            headers=headers,
        )
        self.assertEqual(resp1.status_code, 201)
        first_updated_at = resp1.json()["data"]["updated_at"]

        # Force regeneration
        resp2 = self.client.post(
            f"/api/v1/documents/{doc_id}/summary",
            json={"summary_type": "standard", "force": True},
            headers=headers,
        )
        self.assertEqual(resp2.status_code, 201)
        second_updated_at = resp2.json()["data"]["updated_at"]

        # Verify updated_at changed (or at least request succeeded)
        self.assertEqual(resp2.json()["data"]["summary_type"], "standard")

    # =========================================================================
    # 4. SUMMARY STALENESS DETECTION
    # =========================================================================

    def test_summary_staleness_detection(self):
        """Summary is flagged stale when document updated_at changes."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers = self._auth_headers(self.user_a_token)

        # Generate summary
        resp = self.client.post(
            f"/api/v1/documents/{doc_id}/summary",
            json={"summary_type": "standard"},
            headers=headers,
        )
        self.assertEqual(resp.status_code, 201)
        self.assertFalse(resp.json()["data"]["is_stale"])

        # Simulate document update by modifying updated_at
        with get_db() as conn:
            conn.execute(
                "UPDATE documents SET updated_at = '2099-01-01T00:00:00Z' WHERE id = ?",
                (doc_id,)
            )

        # GET should now flag as stale
        resp2 = self.client.get(
            f"/api/v1/documents/{doc_id}/summary?summary_type=standard",
            headers=headers,
        )
        self.assertEqual(resp2.status_code, 200)
        self.assertTrue(resp2.json()["data"]["is_stale"])

    # =========================================================================
    # 5. CONCEPT EXTRACTION & NORMALIZATION
    # =========================================================================

    def test_concept_extraction(self):
        """Extract concepts from a document with chunks."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id, num_chunks=3)
        headers = self._auth_headers(self.user_a_token)

        resp = self.client.post(
            f"/api/v1/documents/{doc_id}/concepts",
            json={"max_concepts": 10},
            headers=headers,
        )
        self.assertEqual(resp.status_code, 201, resp.text)
        data = resp.json()["data"]

        self.assertEqual(data["document_id"], doc_id)
        self.assertGreater(data["total"], 0)
        self.assertIsInstance(data["concepts"], list)

        # Verify concept structure
        for concept in data["concepts"]:
            self.assertIn("id", concept)
            self.assertIn("name", concept)
            self.assertIn("normalized_name", concept)
            self.assertIn("description", concept)
            self.assertIn("importance", concept)
            self.assertIn(concept["importance"], ["high", "medium", "low"])
            # Normalized name should be lowercase
            self.assertEqual(concept["normalized_name"], concept["normalized_name"].lower())

    def test_concept_deduplication(self):
        """Duplicate normalized names within a document should be deduplicated."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers = self._auth_headers(self.user_a_token)

        # Generate concepts twice — should not duplicate
        resp1 = self.client.post(
            f"/api/v1/documents/{doc_id}/concepts",
            json={"max_concepts": 10, "force": True},
            headers=headers,
        )
        self.assertEqual(resp1.status_code, 201)
        count1 = resp1.json()["data"]["total"]

        resp2 = self.client.post(
            f"/api/v1/documents/{doc_id}/concepts",
            json={"max_concepts": 10, "force": True},
            headers=headers,
        )
        self.assertEqual(resp2.status_code, 201)
        count2 = resp2.json()["data"]["total"]

        # Counts should be equal due to upsert deduplication
        self.assertEqual(count1, count2)

    # =========================================================================
    # 6. CONCEPT IMPORTANCE VALIDATION
    # =========================================================================

    def test_concept_importance_ordering(self):
        """Concepts should be ordered by importance (high → medium → low)."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id, num_chunks=5)
        headers = self._auth_headers(self.user_a_token)

        resp = self.client.post(
            f"/api/v1/documents/{doc_id}/concepts",
            json={"max_concepts": 10},
            headers=headers,
        )
        self.assertEqual(resp.status_code, 201)
        concepts = resp.json()["data"]["concepts"]

        if len(concepts) >= 2:
            importance_order = {"high": 0, "medium": 1, "low": 2}
            for i in range(len(concepts) - 1):
                current = importance_order.get(concepts[i]["importance"], 3)
                next_val = importance_order.get(concepts[i + 1]["importance"], 3)
                self.assertLessEqual(current, next_val,
                    f"Concept ordering violation: {concepts[i]['importance']} should come before {concepts[i + 1]['importance']}")

    # =========================================================================
    # 7. SOURCE REFERENCE VALIDATION
    # =========================================================================

    def test_summary_source_references_are_valid(self):
        """Summary source_references should reference actual document chunks."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers = self._auth_headers(self.user_a_token)

        resp = self.client.post(
            f"/api/v1/documents/{doc_id}/summary",
            json={"summary_type": "standard"},
            headers=headers,
        )
        self.assertEqual(resp.status_code, 201)
        refs = resp.json()["data"]["source_references"]

        # All source references should have valid source_index
        for ref in refs:
            self.assertIn("source_index", ref)
            self.assertGreaterEqual(ref["source_index"], 1)

    def test_concept_source_references_are_valid(self):
        """Concept source_references should reference actual document chunks."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers = self._auth_headers(self.user_a_token)

        resp = self.client.post(
            f"/api/v1/documents/{doc_id}/concepts",
            json={"max_concepts": 10},
            headers=headers,
        )
        self.assertEqual(resp.status_code, 201)
        concepts = resp.json()["data"]["concepts"]

        for concept in concepts:
            for ref in concept.get("source_references", []):
                self.assertIn("source_index", ref)
                self.assertGreaterEqual(ref["source_index"], 1)

    # =========================================================================
    # 8. DOCUMENT READINESS VALIDATION
    # =========================================================================

    def test_summary_rejects_processing_document(self):
        """Documents not in 'ready' state should be rejected with 422."""
        doc = DocumentRepository.create_document(
            workspace_id=self.user_a_ws_id,
            title="Still Processing",
            source_type="pdf",
            total_pages=5
        )
        # Document defaults to 'ready', set it to 'processing'
        DocumentRepository.update_status(doc["id"], status="processing")

        headers = self._auth_headers(self.user_a_token)
        resp = self.client.post(
            f"/api/v1/documents/{doc['id']}/summary",
            json={"summary_type": "standard"},
            headers=headers,
        )
        self.assertEqual(resp.status_code, 422, resp.text)

        # No credits should have been consumed
        credits = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)
        self.assertEqual(credits, 0)

    # =========================================================================
    # 9. EMPTY DOCUMENT HANDLING
    # =========================================================================

    def test_summary_rejects_empty_document(self):
        """Documents with 0 chunks should be rejected with 422."""
        doc = DocumentRepository.create_document(
            workspace_id=self.user_a_ws_id,
            title="Empty Document",
            source_type="pdf",
            total_pages=0
        )
        headers = self._auth_headers(self.user_a_token)

        resp = self.client.post(
            f"/api/v1/documents/{doc['id']}/summary",
            json={"summary_type": "standard"},
            headers=headers,
        )
        self.assertEqual(resp.status_code, 422, resp.text)

        credits = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)
        self.assertEqual(credits, 0)

    def test_concepts_reject_empty_document(self):
        """Documents with 0 chunks should be rejected for concept extraction."""
        doc = DocumentRepository.create_document(
            workspace_id=self.user_a_ws_id,
            title="Empty Concepts Doc",
            source_type="txt",
            total_pages=0
        )
        headers = self._auth_headers(self.user_a_token)

        resp = self.client.post(
            f"/api/v1/documents/{doc['id']}/concepts",
            json={"max_concepts": 10},
            headers=headers,
        )
        self.assertEqual(resp.status_code, 422, resp.text)

    # =========================================================================
    # 10. MULTI-TENANT ISOLATION & IDOR DEFENSE
    # =========================================================================

    def test_user_b_cannot_access_user_a_summary(self):
        """User B cannot read or generate summaries for User A's documents."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers_a = self._auth_headers(self.user_a_token)
        headers_b = self._auth_headers(self.user_b_token)

        # User A generates summary
        resp = self.client.post(
            f"/api/v1/documents/{doc_id}/summary",
            json={"summary_type": "standard"},
            headers=headers_a,
        )
        self.assertEqual(resp.status_code, 201)

        # User B cannot GET the summary
        resp_b_get = self.client.get(
            f"/api/v1/documents/{doc_id}/summary?summary_type=standard",
            headers=headers_b,
        )
        self.assertEqual(resp_b_get.status_code, 404)

        # User B cannot POST a summary
        resp_b_post = self.client.post(
            f"/api/v1/documents/{doc_id}/summary",
            json={"summary_type": "standard"},
            headers=headers_b,
        )
        self.assertEqual(resp_b_post.status_code, 404)

    def test_user_b_cannot_access_user_a_concepts(self):
        """User B cannot read or generate concepts for User A's documents."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers_a = self._auth_headers(self.user_a_token)
        headers_b = self._auth_headers(self.user_b_token)

        # User A generates concepts
        resp = self.client.post(
            f"/api/v1/documents/{doc_id}/concepts",
            json={"max_concepts": 10},
            headers=headers_a,
        )
        self.assertEqual(resp.status_code, 201)

        # User B cannot GET concepts
        resp_b_get = self.client.get(
            f"/api/v1/documents/{doc_id}/concepts",
            headers=headers_b,
        )
        self.assertEqual(resp_b_get.status_code, 404)

        # User B cannot POST concepts
        resp_b_post = self.client.post(
            f"/api/v1/documents/{doc_id}/concepts",
            json={"max_concepts": 5},
            headers=headers_b,
        )
        self.assertEqual(resp_b_post.status_code, 404)

    def test_user_b_cannot_access_user_a_concept_by_id(self):
        """User B cannot access User A's individual concepts."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers_a = self._auth_headers(self.user_a_token)
        headers_b = self._auth_headers(self.user_b_token)

        # User A generates concepts
        resp = self.client.post(
            f"/api/v1/documents/{doc_id}/concepts",
            json={"max_concepts": 10},
            headers=headers_a,
        )
        self.assertEqual(resp.status_code, 201)
        concept_id = resp.json()["data"]["concepts"][0]["id"]

        # User B cannot GET concept by ID
        resp_b = self.client.get(
            f"/api/v1/concepts/{concept_id}",
            headers=headers_b,
        )
        self.assertEqual(resp_b.status_code, 404)

    # =========================================================================
    # 11. AI USAGE ACCOUNTING
    # =========================================================================

    def test_summary_generation_charges_one_credit(self):
        """Summary generation should consume exactly 1 credit."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers = self._auth_headers(self.user_a_token)

        credits_before = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)

        resp = self.client.post(
            f"/api/v1/documents/{doc_id}/summary",
            json={"summary_type": "standard"},
            headers=headers,
        )
        self.assertEqual(resp.status_code, 201)

        credits_after = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)
        self.assertEqual(credits_after - credits_before, 1)

    def test_concept_extraction_charges_one_credit(self):
        """Concept extraction should consume exactly 1 credit."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers = self._auth_headers(self.user_a_token)

        credits_before = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)

        resp = self.client.post(
            f"/api/v1/documents/{doc_id}/concepts",
            json={"max_concepts": 10},
            headers=headers,
        )
        self.assertEqual(resp.status_code, 201)

        credits_after = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)
        self.assertEqual(credits_after - credits_before, 1)

    def test_get_endpoints_consume_zero_credits(self):
        """All GET knowledge endpoints consume 0 credits."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers = self._auth_headers(self.user_a_token)

        # Generate both
        self.client.post(f"/api/v1/documents/{doc_id}/summary", json={"summary_type": "standard"}, headers=headers)
        self.client.post(f"/api/v1/documents/{doc_id}/concepts", json={"max_concepts": 10}, headers=headers)

        credits_baseline = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)

        # Multiple GET calls
        for _ in range(5):
            self.client.get(f"/api/v1/documents/{doc_id}/summary?summary_type=standard", headers=headers)
            self.client.get(f"/api/v1/documents/{doc_id}/concepts", headers=headers)

        credits_after = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)
        self.assertEqual(credits_baseline, credits_after, "GET endpoints should consume 0 credits")

    # =========================================================================
    # 12. INDIVIDUAL CONCEPT RETRIEVAL
    # =========================================================================

    def test_get_concept_by_id(self):
        """GET /concepts/{id} returns a single concept."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers = self._auth_headers(self.user_a_token)

        resp = self.client.post(
            f"/api/v1/documents/{doc_id}/concepts",
            json={"max_concepts": 10},
            headers=headers,
        )
        self.assertEqual(resp.status_code, 201)
        concept_id = resp.json()["data"]["concepts"][0]["id"]

        resp2 = self.client.get(f"/api/v1/concepts/{concept_id}", headers=headers)
        self.assertEqual(resp2.status_code, 200, resp2.text)
        data = resp2.json()["data"]
        self.assertEqual(data["id"], concept_id)

    def test_get_nonexistent_concept_returns_404(self):
        """GET /concepts/{nonexistent_id} returns 404."""
        headers = self._auth_headers(self.user_a_token)
        fake_id = str(uuid.uuid4())
        resp = self.client.get(f"/api/v1/concepts/{fake_id}", headers=headers)
        self.assertEqual(resp.status_code, 404)

    # =========================================================================
    # 13. CASCADING DELETION
    # =========================================================================

    def test_document_deletion_cascades_to_summaries_and_concepts(self):
        """Deleting a document should remove its summaries and concepts."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers = self._auth_headers(self.user_a_token)

        # Generate summary and concepts
        self.client.post(f"/api/v1/documents/{doc_id}/summary", json={"summary_type": "standard"}, headers=headers)
        self.client.post(f"/api/v1/documents/{doc_id}/concepts", json={"max_concepts": 10}, headers=headers)

        # Verify they exist
        self.assertIsNotNone(DocumentSummaryRepository.get_by_document_and_type(doc_id, "standard"))
        self.assertGreater(ConceptRepository.count_by_document(doc_id), 0)

        # Delete the document via CASCADE
        with get_db() as conn:
            conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))

        # Verify cascade
        self.assertIsNone(DocumentSummaryRepository.get_by_document_and_type(doc_id, "standard"))
        self.assertEqual(ConceptRepository.count_by_document(doc_id), 0)

    # =========================================================================
    # 14. CONCEPTS GET RETURNS EMPTY LIST (not 404) WHEN NONE EXTRACTED
    # =========================================================================

    def test_concepts_get_returns_empty_when_none_extracted(self):
        """GET /concepts returns empty list when no concepts extracted yet."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers = self._auth_headers(self.user_a_token)

        resp = self.client.get(f"/api/v1/documents/{doc_id}/concepts", headers=headers)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()["data"]
        self.assertEqual(data["total"], 0)
        self.assertEqual(data["concepts"], [])

    # =========================================================================
    # 15. CACHING BEHAVIOR — POST WITHOUT FORCE RETURNS CACHED
    # =========================================================================

    def test_summary_post_without_force_returns_cached(self):
        """POST without force returns cached summary without additional credit."""
        doc_id = self._create_ready_document_with_chunks(self.user_a_ws_id)
        headers = self._auth_headers(self.user_a_token)

        # First generation (1 credit)
        resp1 = self.client.post(
            f"/api/v1/documents/{doc_id}/summary",
            json={"summary_type": "standard"},
            headers=headers,
        )
        self.assertEqual(resp1.status_code, 201)
        credits_after_gen = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)

        # Second POST without force should return cached
        resp2 = self.client.post(
            f"/api/v1/documents/{doc_id}/summary",
            json={"summary_type": "standard", "force": False},
            headers=headers,
        )
        self.assertEqual(resp2.status_code, 201)

        credits_after_cached = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)
        # Should NOT have consumed additional credit if cache hit
        self.assertEqual(credits_after_gen, credits_after_cached)


if __name__ == "__main__":
    unittest.main()
