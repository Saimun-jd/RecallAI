"""
Integration and Retrieval Tests for Knowledge Hub & Semantic Search Backend.
Tests semantic, keyword, and hybrid search, multi-tenant isolation,
document filtering, diversity suppression, context builder, related documents,
and reindexing.
"""

import os
import shutil
import tempfile
import unittest
from fastapi.testclient import TestClient

from app.main import app
from app.api.middleware import auth_rate_limiter
from app.api.v1.search import search_rate_limiter
from app.core.database import set_db_path
from app.models.schema_init import init_foundation_db
from app.models.repositories import (
    DocumentRepository,
    ChunkRepository,
)
from app.services.storage import StorageService
from app.services.pipeline import DocumentProcessingPipeline
from app.services.retrieval import RetrievalService, SearchResultItem


class TestRetrievalAndKnowledge(unittest.TestCase):
    def setUp(self):
        auth_rate_limiter.reset()
        search_rate_limiter.reset()

        # 1. Isolated temporary database
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db_path = self.temp_db.name
        self.temp_db.close()

        set_db_path(self.temp_db_path)
        init_foundation_db(self.temp_db_path)

        # 2. Isolated storage
        self.temp_storage_dir = tempfile.mkdtemp(prefix="recall_search_storage_")
        StorageService.set_root_dir(self.temp_storage_dir)

        # 3. TestClient
        self.client = TestClient(app)

        # 4. Register two users for isolation testing
        uid = os.urandom(4).hex()
        self.user_a_token, self.user_a_workspace_id = self._register_user(f"user_a_{uid}@example.com", "Password123!")
        self.user_b_token, self.user_b_workspace_id = self._register_user(f"user_b_{uid}@example.com", "Password123!")

    def tearDown(self):
        try:
            if os.path.exists(self.temp_db_path):
                os.remove(self.temp_db_path)
        except Exception:
            pass

        try:
            if os.path.exists(self.temp_storage_dir):
                shutil.rmtree(self.temp_storage_dir, ignore_errors=True)
        except Exception:
            pass

    def _register_user(self, email: str, password: str) -> tuple[str, str]:
        res = self.client.post("/api/v1/auth/signup", json={
            "email": email,
            "password": password,
            "full_name": "Test User"
        })
        self.assertEqual(res.status_code, 201)
        data = res.json()["data"]
        return data["access_token"], data["workspace"]["id"]

    def _auth_headers(self, token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}

    def _upload_and_process_document(self, token: str, workspace_id: str, filename: str, content: bytes) -> str:
        """Helper to upload and synchronously execute pipeline for testing."""
        res = self.client.post(
            "/api/v1/documents/upload",
            headers=self._auth_headers(token),
            files={"file": (filename, content, "text/markdown")}
        )
        self.assertEqual(res.status_code, 202)
        doc_id = res.json()["data"]["document_id"]
        job_id = res.json()["data"]["job_id"]

        success = DocumentProcessingPipeline.process_document(
            document_id=doc_id,
            job_id=job_id,
            workspace_id=workspace_id
        )
        self.assertTrue(success)
        return doc_id

    def test_semantic_search_relevance(self):
        """Semantic search finds conceptually relevant chunks and scores them appropriately."""
        quantum_doc = b"""# Quantum Mechanics and Entanglement

Quantum entanglement is a phenomenon where particles become interconnected.
The physical state of each entangled particle cannot be described independently.

## Superposition

In quantum computing, qubits exist in superpositions of 0 and 1 simultaneously.
"""
        cooking_doc = b"""# Classical French Cuisine

Croissant dough requires precise laminating of butter and dough layers.
Baking at high temperature produces flaky French pastries.
"""
        doc_q_id = self._upload_and_process_document(
            self.user_a_token, self.user_a_workspace_id, "quantum.md", quantum_doc
        )
        doc_c_id = self._upload_and_process_document(
            self.user_a_token, self.user_a_workspace_id, "cooking.md", cooking_doc
        )

        # Search for quantum topics in semantic mode
        res = self.client.get(
            "/api/v1/search?query=particles+entangled+state&mode=semantic",
            headers=self._auth_headers(self.user_a_token)
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertGreater(data["total_results"], 0)
        top_result = data["results"][0]
        self.assertEqual(top_result["document_id"], doc_q_id)
        self.assertIn("entangled", top_result["content"].lower())

    def test_keyword_search_mode(self):
        """Keyword search mode surfaces exact term matches."""
        pastry_doc = b"""# Pastry Recipes
Croissant dough requires multiple folding turns to create flaky golden butter layers.
"""
        doc_id = self._upload_and_process_document(
            self.user_a_token, self.user_a_workspace_id, "pastry.md", pastry_doc
        )

        res = self.client.get(
            "/api/v1/search?query=croissant+dough&mode=keyword",
            headers=self._auth_headers(self.user_a_token)
        )
        self.assertEqual(res.status_code, 200)
        results = res.json()["data"]["results"]
        self.assertGreater(len(results), 0)
        self.assertEqual(results[0]["document_id"], doc_id)
        self.assertEqual(results[0]["match_type"], "keyword")

    def test_hybrid_search_mode(self):
        """Hybrid search mode combines vector similarity and lexical matching."""
        doc_content = b"""# Distributed Systems
Raft consensus algorithm ensures fault-tolerant replicated state machines.
Leader election occurs when heartbeats timeout.
"""
        doc_id = self._upload_and_process_document(
            self.user_a_token, self.user_a_workspace_id, "raft.md", doc_content
        )

        res = self.client.get(
            "/api/v1/search?query=raft+consensus+heartbeats&mode=hybrid",
            headers=self._auth_headers(self.user_a_token)
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertGreater(data["total_results"], 0)
        self.assertEqual(data["results"][0]["match_type"], "hybrid")
        self.assertGreater(data["results"][0]["score"], 0.25)

    def test_search_multi_tenant_isolation(self):
        """User B cannot retrieve User A's private documents or chunks via search."""
        secret_doc = b"""# Project Starlight Alpha
Top secret project specs for proprietary quantum teleportation hardware.
"""
        self._upload_and_process_document(
            self.user_a_token, self.user_a_workspace_id, "starlight.md", secret_doc
        )

        # User B searches for exact secret project title
        res = self.client.get(
            "/api/v1/search?query=Project+Starlight+Alpha&mode=hybrid",
            headers=self._auth_headers(self.user_b_token)
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        # Must return 0 results
        self.assertEqual(data["total_results"], 0)
        self.assertEqual(len(data["results"]), 0)

    def test_document_filter(self):
        """Filtering by document_id restricts results exclusively to that document."""
        doc1_content = b"# Document One\nInformation about machine learning optimization."
        doc2_content = b"# Document Two\nInformation about machine learning loss functions."

        doc1_id = self._upload_and_process_document(
            self.user_a_token, self.user_a_workspace_id, "doc1.md", doc1_content
        )
        doc2_id = self._upload_and_process_document(
            self.user_a_token, self.user_a_workspace_id, "doc2.md", doc2_content
        )

        res = self.client.get(
            f"/api/v1/search?query=machine+learning&document_id={doc1_id}",
            headers=self._auth_headers(self.user_a_token)
        )
        self.assertEqual(res.status_code, 200)
        results = res.json()["data"]["results"]
        self.assertGreater(len(results), 0)
        for r in results:
            self.assertEqual(r["document_id"], doc1_id)

    def test_document_filter_unauthorized_idor(self):
        """Supplying another user's document_id in search query triggers 404 NOT_FOUND."""
        doc_content = b"# Classified Data\nConfidential research findings."
        doc_a_id = self._upload_and_process_document(
            self.user_a_token, self.user_a_workspace_id, "classified.md", doc_content
        )

        # User B tries to filter by User A's document_id
        res = self.client.get(
            f"/api/v1/search?query=research&document_id={doc_a_id}",
            headers=self._auth_headers(self.user_b_token)
        )
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()["error"]["code"], "NOT_FOUND")

    def test_empty_and_short_queries(self):
        """Empty or <2 char queries return empty results without error or AI cost."""
        res = self.client.get(
            "/api/v1/search?query=a",
            headers=self._auth_headers(self.user_a_token)
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["total_results"], 0)

    def test_context_builder(self):
        """Tests building structured prompt context with citation blocks and token budgets."""
        items = [
            SearchResultItem(
                chunk_id="chunk-1",
                document_id="doc-1",
                document_title="Calculus Vol 1",
                content="Derivatives represent instantaneous rate of change.",
                page_number=14,
                token_count=12,
                score=0.92,
                match_type="hybrid"
            ),
            SearchResultItem(
                chunk_id="chunk-2",
                document_id="doc-2",
                document_title="Linear Algebra",
                content="Eigenvalues scale eigenvectors along their span.",
                page_number=45,
                token_count=14,
                score=0.88,
                match_type="hybrid"
            ),
        ]

        structured = RetrievalService.build_context(items, max_tokens=100)
        self.assertIn("Calculus Vol 1", structured.text)
        self.assertIn("(Page 14)", structured.text)
        self.assertIn("Derivatives represent", structured.text)
        self.assertIn("Linear Algebra", structured.text)
        self.assertEqual(len(structured.sources), 2)
        self.assertGreater(structured.total_tokens, 0)

    def test_related_documents(self):
        """Identifies related documents in the same workspace based on chunk embeddings."""
        doc1 = b"# Neural Networks\nDeep learning models with backpropagation and gradient descent."
        doc2 = b"# Deep Learning Optimization\nGradient descent with momentum and Adam optimizer for neural networks."
        doc3 = b"# Gardening 101\nHow to grow organic tomatoes and water seedlings in spring."

        d1_id = self._upload_and_process_document(self.user_a_token, self.user_a_workspace_id, "d1.md", doc1)
        d2_id = self._upload_and_process_document(self.user_a_token, self.user_a_workspace_id, "d2.md", doc2)
        d3_id = self._upload_and_process_document(self.user_a_token, self.user_a_workspace_id, "d3.md", doc3)

        res = self.client.get(
            f"/api/v1/documents/{d1_id}/related?limit=2",
            headers=self._auth_headers(self.user_a_token)
        )
        self.assertEqual(res.status_code, 200)
        related = res.json()["data"]["related_documents"]
        self.assertGreater(len(related), 0)
        # Deep learning doc should be most related
        self.assertEqual(related[0]["document_id"], d2_id)

    def test_document_reindex(self):
        """POST /{id}/reindex re-triggers pipeline, cleans old chunks, and produces fresh chunks."""
        content = b"# Document For Reindexing\nOriginal content that will be re-indexed."
        doc_id = self._upload_and_process_document(
            self.user_a_token, self.user_a_workspace_id, "reindex.md", content
        )

        initial_count = ChunkRepository.count_by_document(doc_id)
        self.assertGreater(initial_count, 0)

        # Trigger reindex
        res = self.client.post(
            f"/api/v1/documents/{doc_id}/reindex",
            headers=self._auth_headers(self.user_a_token)
        )
        self.assertEqual(res.status_code, 202)
        reindex_data = res.json()["data"]
        self.assertEqual(reindex_data["document_id"], doc_id)
        self.assertEqual(reindex_data["status"], "processing")
        new_job_id = reindex_data["job_id"]

        # Run pipeline
        success = DocumentProcessingPipeline.process_document(
            document_id=doc_id,
            job_id=new_job_id,
            workspace_id=self.user_a_workspace_id
        )
        self.assertTrue(success)

        # Chunks count should remain healthy and document ready
        new_count = ChunkRepository.count_by_document(doc_id)
        self.assertEqual(new_count, initial_count)

        doc = DocumentRepository.get_by_id_and_workspace(doc_id, self.user_a_workspace_id)
        self.assertEqual(doc["status"], "ready")

    def test_deleted_documents_excluded_from_search(self):
        """Deleted documents must immediately disappear from search candidates."""
        content = b"# Temporary Document\nUniqueKeywordForDeletionTesting will vanish."
        doc_id = self._upload_and_process_document(
            self.user_a_token, self.user_a_workspace_id, "temp.md", content
        )

        # Confirm searchable
        res1 = self.client.get(
            "/api/v1/search?query=UniqueKeywordForDeletionTesting",
            headers=self._auth_headers(self.user_a_token)
        )
        self.assertEqual(res1.status_code, 200)
        self.assertGreater(res1.json()["data"]["total_results"], 0)

        # Delete document
        del_res = self.client.delete(
            f"/api/v1/documents/{doc_id}",
            headers=self._auth_headers(self.user_a_token)
        )
        self.assertEqual(del_res.status_code, 200)

        # Confirm no longer searchable
        res2 = self.client.get(
            "/api/v1/search?query=UniqueKeywordForDeletionTesting",
            headers=self._auth_headers(self.user_a_token)
        )
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.json()["data"]["total_results"], 0)


if __name__ == "__main__":
    unittest.main()
