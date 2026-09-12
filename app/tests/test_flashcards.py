"""
Comprehensive Test Suite for Flashcards & Study Material Generation Backend.
Tests authentication, multi-tenant IDOR protection, grounded knowledge retrieval,
citation validation, AI hallucination filtering, deduplication, atomic persistence,
card-level editing, usage credit accounting, and zero-key leakage.
"""

import json
import os
import shutil
import tempfile
import unittest
from fastapi.testclient import TestClient

from app.main import app
from app.api.middleware import auth_rate_limiter
from app.api.v1.flashcards import flashcard_rate_limiter
from app.api.v1.search import search_rate_limiter
from app.core.database import set_db_path
from app.models.schema_init import init_foundation_db
from app.models.repositories import (
    FlashcardRepository,
    FlashcardSetRepository,
    UsageRepository,
)
from app.schemas.search import SearchResultItem
from app.services.flashcards import FlashcardGenerationService
from app.services.pipeline import DocumentProcessingPipeline
from app.services.storage import StorageService


class TestFlashcardsAndStudyMaterial(unittest.TestCase):
    def setUp(self):
        auth_rate_limiter.reset()
        flashcard_rate_limiter.reset()
        search_rate_limiter.reset()

        # 1. Isolated temporary database
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db_path = self.temp_db.name
        self.temp_db.close()

        set_db_path(self.temp_db_path)
        init_foundation_db(self.temp_db_path)

        # 2. Isolated storage
        self.temp_storage_dir = tempfile.mkdtemp(prefix="recall_flashcard_storage_")
        StorageService.set_root_dir(self.temp_storage_dir)

        # 3. TestClient
        self.client = TestClient(app)

        # 4. Register two isolated tenants
        uid = os.urandom(4).hex()
        self.user_a_token, self.user_a_ws_id, self.user_a_id = self._register_user(f"user_a_{uid}@test.com", "Password123!")
        self.user_b_token, self.user_b_ws_id, self.user_b_id = self._register_user(f"user_b_{uid}@test.com", "Password123!")

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

    def _register_user(self, email: str, password: str):
        res = self.client.post("/api/v1/auth/signup", json={
            "email": email,
            "password": password,
            "full_name": "Test User"
        })
        self.assertEqual(res.status_code, 201)
        data = res.json()["data"]
        return data["access_token"], data["workspace"]["id"], data["user"]["id"]

    def _auth_header(self, token: str):
        return {"Authorization": f"Bearer {token}"}

    def _upload_and_process_document(self, token: str, workspace_id: str, filename: str, content: bytes) -> str:
        res = self.client.post(
            "/api/v1/documents/upload",
            headers=self._auth_header(token),
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

    def test_unauthenticated_generation_rejected(self):
        res = self.client.post("/api/v1/flashcards/generate", json={"count": 5})
        self.assertEqual(res.status_code, 401)

    def test_foreign_document_generation_rejected(self):
        # User A uploads a document
        doc_content = b"Database Normalization reduces redundancy and prevents insertion anomalies."
        doc_a_id = self._upload_and_process_document(
            self.user_a_token, self.user_a_ws_id, "db_normalization.txt", doc_content
        )

        # User B attempts to generate flashcards using User A's document ID
        res = self.client.post(
            "/api/v1/flashcards/generate",
            json={"document_ids": [doc_a_id], "count": 5},
            headers=self._auth_header(self.user_b_token)
        )
        self.assertEqual(res.status_code, 404)

    def test_foreign_flashcard_set_inaccessible(self):
        # User A creates a set in DB
        created_set = FlashcardSetRepository.create_set(
            workspace_id=self.user_a_ws_id,
            user_id=self.user_a_id,
            title="User A Secret Cards",
            card_count=1
        )
        set_id = created_set["id"]

        # User B attempts to view, patch, or delete User A's set
        b_headers = self._auth_header(self.user_b_token)

        res = self.client.get(f"/api/v1/flashcards/sets/{set_id}", headers=b_headers)
        self.assertEqual(res.status_code, 404)

        res = self.client.patch(f"/api/v1/flashcards/sets/{set_id}", json={"title": "Hacked"}, headers=b_headers)
        self.assertEqual(res.status_code, 404)

        res = self.client.delete(f"/api/v1/flashcards/sets/{set_id}", headers=b_headers)
        self.assertEqual(res.status_code, 404)

        # Test alias endpoint as well
        res = self.client.get(f"/api/v1/flashcard-sets/{set_id}", headers=b_headers)
        self.assertEqual(res.status_code, 404)

    def test_generation_with_grounded_citations(self):
        # 1. Ingest document for User A
        doc_content = (
            "Photosynthesis is the process by which green plants transform light energy into chemical energy. "
            "During photosynthesis, light energy is captured by chlorophyll to convert water and carbon dioxide into oxygen and glucose."
        ).encode('utf-8')

        doc_id = self._upload_and_process_document(
            self.user_a_token, self.user_a_ws_id, "photosynthesis_biology.txt", doc_content
        )

        # 2. Generate flashcards
        res = self.client.post(
            "/api/v1/flashcards/generate",
            json={
                "document_ids": [doc_id],
                "title": "Photosynthesis Study Cards",
                "count": 5
            },
            headers=self._auth_header(self.user_a_token)
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()["data"]

        # Verify set metadata
        self.assertEqual(data["title"], "Photosynthesis Study Cards")
        self.assertEqual(data["workspace_id"], self.user_a_ws_id)
        self.assertGreaterEqual(len(data["cards"]), 1)

        # Verify card structure & citation grounding
        first_card = data["cards"][0]
        self.assertTrue(len(first_card["front"]) >= 5)
        self.assertTrue(len(first_card["back"]) >= 2)
        self.assertGreaterEqual(len(first_card["source_metadata"]), 1)
        self.assertIn("photosynthesis", first_card["source_metadata"][0]["document_title"].lower())

        set_id = data["id"]

        # 3. Retrieve set via /sets/{set_id} and alias /flashcard-sets/{set_id}
        res_get = self.client.get(f"/api/v1/flashcards/sets/{set_id}", headers=self._auth_header(self.user_a_token))
        self.assertEqual(res_get.status_code, 200)
        self.assertEqual(len(res_get.json()["data"]["cards"]), len(data["cards"]))

        res_alias = self.client.get(f"/api/v1/flashcard-sets/{set_id}", headers=self._auth_header(self.user_a_token))
        self.assertEqual(res_alias.status_code, 200)

        # 4. List sets
        res_list = self.client.get("/api/v1/flashcards/sets", headers=self._auth_header(self.user_a_token))
        self.assertEqual(res_list.status_code, 200)
        self.assertGreaterEqual(res_list.json()["data"]["total"], 1)

    def test_citation_validation_and_stripping_hallucinations(self):
        # Mock source mapping
        mock_chunk = SearchResultItem(
            chunk_id="chunk-abc",
            document_id="doc-xyz",
            document_title="Organic Chemistry",
            content="Alkanes are saturated hydrocarbons containing single bonds.",
            token_count=15,
            match_type="hybrid",
            score=0.92
        )
        source_map = {"S1": mock_chunk}

        # Raw AI JSON containing valid citation "S1" and hallucinated citation "S99"
        raw_ai_json = json.dumps({
            "flashcards": [
                {
                    "front": "What are alkanes?",
                    "back": "Alkanes are saturated hydrocarbons characterized by single carbon-carbon bonds.",
                    "source_ids": ["S1", "S99"]
                }
            ]
        })

        cards = FlashcardGenerationService._parse_and_validate_cards(
            raw_text=raw_ai_json,
            source_map=source_map,
            max_count=5
        )

        self.assertEqual(len(cards), 1)
        sources = cards[0]["source_metadata"]
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]["document_id"], "doc-xyz")
        self.assertEqual(sources[0]["source_index"], "S1")

    def test_deduplication_of_cards(self):
        mock_chunk = SearchResultItem(
            chunk_id="chunk-1",
            document_id="doc-1",
            document_title="Physics",
            content="Newton's First Law states an object at rest stays at rest.",
            token_count=12,
            match_type="hybrid",
            score=0.9
        )
        source_map = {"S1": mock_chunk}

        # 3 cards where 2 have identical questions with minor punctuation difference
        raw_ai_json = json.dumps({
            "flashcards": [
                {
                    "front": "What is Newton's First Law?",
                    "back": "An object at rest stays at rest unless acted upon by an external force.",
                    "source_ids": ["S1"]
                },
                {
                    "front": "What is newtons first law!",
                    "back": "Law of inertia: object maintains velocity unless force acts.",
                    "source_ids": ["S1"]
                },
                {
                    "front": "What is the definition of inertia?",
                    "back": "The resistance of an object to changes in its velocity.",
                    "source_ids": ["S1"]
                }
            ]
        })

        cards = FlashcardGenerationService._parse_and_validate_cards(
            raw_text=raw_ai_json,
            source_map=source_map,
            max_count=5
        )

        # Duplicate should be filtered out
        self.assertEqual(len(cards), 2)
        self.assertEqual(cards[0]["front"], "What is Newton's First Law?")
        self.assertEqual(cards[1]["front"], "What is the definition of inertia?")

    def test_empty_document_insufficient_material_error(self):
        # Empty workspace with no documents
        res = self.client.post(
            "/api/v1/flashcards/generate",
            json={"count": 5},
            headers=self._auth_header(self.user_b_token)
        )
        # Should return 422 error
        self.assertEqual(res.status_code, 422)
        error_msg = res.json()["error"]["message"].lower()
        self.assertIn("not enough source material", error_msg)

    def test_card_crud_editing(self):
        # 1. Create set and card directly
        created_set = FlashcardSetRepository.create_set(
            workspace_id=self.user_a_ws_id,
            user_id=self.user_a_id,
            title="Editing Test Set",
            card_count=2
        )
        set_id = created_set["id"]

        cards = FlashcardRepository.create_flashcards_batch(
            flashcard_set_id=set_id,
            cards=[
                {"front": "Old Question 1", "back": "Old Answer 1"},
                {"front": "Question 2", "back": "Answer 2"}
            ]
        )
        card_id = cards[0]["id"]

        # 2. Patch card
        res = self.client.patch(
            f"/api/v1/flashcards/cards/{card_id}",
            json={"front": "New Question 1", "back": "New Answer 1"},
            headers=self._auth_header(self.user_a_token)
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["front"], "New Question 1")
        self.assertEqual(res.json()["data"]["back"], "New Answer 1")

        # 3. Delete card
        res_del = self.client.delete(
            f"/api/v1/flashcards/cards/{card_id}",
            headers=self._auth_header(self.user_a_token)
        )
        self.assertEqual(res_del.status_code, 200)
        self.assertTrue(res_del.json()["data"]["success"])

        # Check set card_count decremented
        updated_set = FlashcardSetRepository.get_by_id_and_workspace(set_id, self.user_a_ws_id)
        self.assertEqual(updated_set["card_count"], 1)

    def test_usage_accounting(self):
        # Ingest document
        doc_content = b"Microeconomics studies the behavior of individuals and firms in decision making."
        doc_id = self._upload_and_process_document(
            self.user_a_token, self.user_a_ws_id, "microeconomics.txt", doc_content
        )

        initial_credits = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)

        # Generate flashcards
        res = self.client.post(
            "/api/v1/flashcards/generate",
            json={"document_ids": [doc_id], "count": 5},
            headers=self._auth_header(self.user_a_token)
        )
        self.assertEqual(res.status_code, 201)

        after_credits = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)
        self.assertEqual(after_credits, initial_credits + 1)

    def test_zero_secret_leak(self):
        # Ingest document and generate cards
        doc_content = b"Linear Algebra involves vector spaces and linear mappings between these spaces."
        doc_id = self._upload_and_process_document(
            self.user_a_token, self.user_a_ws_id, "linear_algebra.txt", doc_content
        )

        res = self.client.post(
            "/api/v1/flashcards/generate",
            json={"document_ids": [doc_id], "count": 5},
            headers=self._auth_header(self.user_a_token)
        )
        response_text = res.text.lower()
        self.assertNotIn("sk-", response_text)
        self.assertNotIn("bearer", response_text)
        self.assertNotIn("encrypted_key", response_text)
        self.assertNotIn("key_nonce", response_text)
        self.assertNotIn("key_tag", response_text)


if __name__ == "__main__":
    unittest.main()
