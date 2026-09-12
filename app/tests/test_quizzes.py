"""
Comprehensive Test Suite for AI Quiz Generation & Assessment Backend.
Tests authentication, multi-tenant IDOR protection, grounded knowledge retrieval,
citation validation, AI hallucination filtering, option validation, deduplication,
atomic persistence, question-level editing, usage credit accounting, and zero-key leakage.
"""

import json
import os
import shutil
import tempfile
import unittest
from fastapi.testclient import TestClient

from app.main import app
from app.api.middleware import auth_rate_limiter
from app.api.v1.quizzes import quiz_rate_limiter
from app.api.v1.search import search_rate_limiter
from app.core.database import set_db_path
from app.models.schema_init import init_foundation_db
from app.models.repositories import (
    QuizQuestionRepository,
    QuizRepository,
    UsageRepository,
)
from app.schemas.search import SearchResultItem
from app.services.pipeline import DocumentProcessingPipeline
from app.services.quizzes import QuizGenerationService
from app.services.storage import StorageService


class TestQuizAndAssessmentBackend(unittest.TestCase):
    def setUp(self):
        auth_rate_limiter.reset()
        quiz_rate_limiter.reset()
        search_rate_limiter.reset()

        # 1. Isolated temporary database
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db_path = self.temp_db.name
        self.temp_db.close()

        set_db_path(self.temp_db_path)
        init_foundation_db(self.temp_db_path)

        # 2. Isolated storage
        self.temp_storage_dir = tempfile.mkdtemp(prefix="recall_quiz_storage_")
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
        """Unauthenticated requests to generate quizzes must be rejected with 401."""
        res = self.client.post("/api/v1/quizzes/generate", json={"question_count": 5})
        self.assertEqual(res.status_code, 401)

    def test_foreign_document_generation_rejected(self):
        """User A must not be able to generate a quiz referencing User B's document."""
        doc_b = self._upload_and_process_document(
            self.user_b_token,
            self.user_b_ws_id,
            "secret_b.md",
            b"# User B Proprietary Architecture\n\nConfidential algorithms for quantum annealing."
        )

        res = self.client.post(
            "/api/v1/quizzes/generate",
            headers=self._auth_header(self.user_a_token),
            json={"document_ids": [doc_b], "question_count": 5}
        )
        self.assertEqual(res.status_code, 404)
        err = res.json()
        self.assertEqual(err["error"]["code"], "NOT_FOUND")

    def test_foreign_quiz_inaccessible(self):
        """Quizzes created by User A cannot be retrieved, updated, or deleted by User B."""
        doc_a = self._upload_and_process_document(
            self.user_a_token,
            self.user_a_ws_id,
            "physics.md",
            b"# Thermodynamics\n\nThe second law of thermodynamics establishes entropy irreversibility."
        )

        # User A generates quiz
        gen_res = self.client.post(
            "/api/v1/quizzes/generate",
            headers=self._auth_header(self.user_a_token),
            json={"document_ids": [doc_a], "question_count": 5, "title": "Thermodynamics Quiz"}
        )
        self.assertEqual(gen_res.status_code, 201)
        quiz_id = gen_res.json()["data"]["id"]

        # User B cannot access User A's quiz
        get_res = self.client.get(
            f"/api/v1/quizzes/{quiz_id}",
            headers=self._auth_header(self.user_b_token)
        )
        self.assertEqual(get_res.status_code, 404)

        # User B cannot update User A's quiz
        patch_res = self.client.patch(
            f"/api/v1/quizzes/{quiz_id}",
            headers=self._auth_header(self.user_b_token),
            json={"title": "Hacked Title"}
        )
        self.assertEqual(patch_res.status_code, 404)

        # User B cannot delete User A's quiz
        del_res = self.client.delete(
            f"/api/v1/quizzes/{quiz_id}",
            headers=self._auth_header(self.user_b_token)
        )
        self.assertEqual(del_res.status_code, 404)

    def test_generation_with_grounded_citations(self):
        """Verifies full generation pipeline with multiple-choice and true/false questions grounded in source."""
        doc_a = self._upload_and_process_document(
            self.user_a_token,
            self.user_a_ws_id,
            "relational_algebra.md",
            b"# Relational Database Theory\n\n"
            b"First normal form (1NF) mandates that each column contains atomic values.\n"
            b"Second normal form (2NF) eliminates partial key functional dependencies.\n"
            b"Third normal form (3NF) strictly resolves transitive dependencies."
        )

        gen_res = self.client.post(
            "/api/v1/quizzes/generate",
            headers=self._auth_header(self.user_a_token),
            json={
                "document_ids": [doc_a],
                "question_count": 6,
                "question_types": ["multiple_choice", "true_false"],
                "difficulty": "medium",
                "title": "Database Normalization Exam"
            }
        )
        self.assertEqual(gen_res.status_code, 201)
        quiz_data = gen_res.json()["data"]

        self.assertEqual(quiz_data["title"], "Database Normalization Exam")
        self.assertEqual(quiz_data["difficulty"], "medium")
        self.assertGreater(len(quiz_data["questions"]), 0)

        # Check question fields
        types_found = set()
        for q in quiz_data["questions"]:
            self.assertIn(q["type"], ["multiple_choice", "true_false"])
            types_found.add(q["type"])
            self.assertGreater(len(q["question"]), 5)
            self.assertGreater(len(q["explanation"]), 3)
            self.assertIsNotNone(q["correct_answer"])

            # Check source grounding
            self.assertGreater(len(q["source_metadata"]), 0)
            citation = q["source_metadata"][0]
            self.assertEqual(citation["document_id"], doc_a)
            self.assertIn("relational", citation["document_title"].lower())

            if q["type"] == "multiple_choice":
                self.assertGreaterEqual(len(q["options"]), 2)
                # Ensure correct answer is within options bounds
                ans_idx = int(q["correct_answer"])
                self.assertGreaterEqual(ans_idx, 0)
                self.assertLess(ans_idx, len(q["options"]))
            elif q["type"] == "true_false":
                self.assertIn(q["correct_answer"], ["true", "false"])

        self.assertIn("multiple_choice", types_found)
        self.assertIn("true_false", types_found)

    def test_citation_validation_and_stripping_hallucinations(self):
        """Simulated model hallucinations citing S99 or unknown documents must be stripped."""
        dummy_chunk = SearchResultItem(
            chunk_id="chk_real_1",
            document_id="doc_real_1",
            document_title="Real Document.md",
            content="Real verified content",
            token_count=15,
            match_type="hybrid",
            page_number=1,
            score=0.95
        )
        source_map = {"S1": dummy_chunk}


        mock_ai_output = json.dumps({
            "questions": [
                {
                    "type": "multiple_choice",
                    "question": "What is the primary function of the real document?",
                    "options": ["Real function A", "Distractor B", "Distractor C"],
                    "correct_answer": "0",
                    "explanation": "Because S1 confirms this.",
                    "source_ids": ["S1", "S99", "doc_fake_external"]
                }
            ]
        })

        validated = QuizGenerationService._parse_and_validate_questions(
            raw_text=mock_ai_output,
            source_map=source_map,
            max_count=5,
            allowed_types=["multiple_choice", "true_false"]
        )

        self.assertEqual(len(validated), 1)
        q = validated[0]
        # Only S1 must remain
        sources = q["source_metadata"]
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]["source_index"], "S1")
        self.assertEqual(sources[0]["document_id"], "doc_real_1")

    def test_option_validation_and_guardrails(self):
        """Questions with duplicate options or out-of-bound answers must be rejected."""
        dummy_chunk = SearchResultItem(
            chunk_id="chk_1",
            document_id="doc_1",
            document_title="Doc 1",
            content="Content for options testing",
            token_count=15,
            match_type="hybrid",
            page_number=1,
            score=0.9
        )
        source_map = {"S1": dummy_chunk}

        # 1. Question with duplicate options
        bad_output_dup_options = json.dumps({
            "questions": [
                {
                    "type": "multiple_choice",
                    "question": "What is valid syntax?",
                    "options": ["Duplicate Option", "Duplicate Option", "Option C"],
                    "correct_answer": "0",
                    "explanation": "Explanation here",
                    "source_ids": ["S1"]
                }
            ]
        })
        val_dup = QuizGenerationService._parse_and_validate_questions(
            raw_text=bad_output_dup_options,
            source_map=source_map,
            max_count=5,
            allowed_types=["multiple_choice"]
        )
        self.assertEqual(len(val_dup), 0)

        # 2. Question with out-of-bounds correct answer
        bad_output_oob = json.dumps({
            "questions": [
                {
                    "type": "multiple_choice",
                    "question": "What is valid syntax in this context?",
                    "options": ["Option A", "Option B", "Option C"],
                    "correct_answer": "5",  # index 5 doesn't exist
                    "explanation": "Explanation here",
                    "source_ids": ["S1"]
                }
            ]
        })
        val_oob = QuizGenerationService._parse_and_validate_questions(
            raw_text=bad_output_oob,
            source_map=source_map,
            max_count=5,
            allowed_types=["multiple_choice"]
        )
        self.assertEqual(len(val_oob), 0)

        # 3. Question with conversational filler
        bad_output_filler = json.dumps({
            "questions": [
                {
                    "type": "true_false",
                    "question": "Here is your quiz: Is principle X true?",
                    "options": ["True", "False"],
                    "correct_answer": "true",
                    "explanation": "Because source confirms.",
                    "source_ids": ["S1"]
                }
            ]
        })
        val_filler = QuizGenerationService._parse_and_validate_questions(
            raw_text=bad_output_filler,
            source_map=source_map,
            max_count=5,
            allowed_types=["true_false"]
        )
        self.assertEqual(len(val_filler), 0)

    def test_deduplication_of_questions(self):
        """Near-identical or duplicate questions must be deduplicated."""
        dummy_chunk = SearchResultItem(
            chunk_id="chk_1",
            document_id="doc_1",
            document_title="Doc 1",
            content="Content for deduplication testing",
            token_count=15,
            match_type="hybrid",
            page_number=1,
            score=0.9
        )
        source_map = {"S1": dummy_chunk}

        duplicate_payload = json.dumps({
            "questions": [
                {
                    "type": "multiple_choice",
                    "question": "What is the primary function of system caching?",
                    "options": ["Speed", "Cost", "Latency"],
                    "correct_answer": "0",
                    "explanation": "Speed is primary.",
                    "source_ids": ["S1"]
                },
                {
                    "type": "multiple_choice",
                    "question": "what is the primary function of system caching?",  # Duplicate
                    "options": ["Speed", "Cost", "Latency"],
                    "correct_answer": "0",
                    "explanation": "Speed is primary.",
                    "source_ids": ["S1"]
                },
                {
                    "type": "true_false",
                    "question": "Does cache invalidation present known challenges?",
                    "options": ["True", "False"],
                    "correct_answer": "true",
                    "explanation": "Yes it does.",
                    "source_ids": ["S1"]
                }
            ]
        })

        validated = QuizGenerationService._parse_and_validate_questions(
            raw_text=duplicate_payload,
            source_map=source_map,
            max_count=5,
            allowed_types=["multiple_choice", "true_false"]
        )
        # Should have 2 unique questions, not 3
        self.assertEqual(len(validated), 2)

    def test_empty_document_insufficient_material_error(self):
        """When workspace or scope has no source content, generation must return HTTP 422."""
        res = self.client.post(
            "/api/v1/quizzes/generate",
            headers=self._auth_header(self.user_b_token),
            json={"question_count": 5}
        )
        self.assertEqual(res.status_code, 422)
        err = res.json()["error"]
        self.assertEqual(err["code"], "VALIDATION_ERROR")
        self.assertIn("not enough source material", err["message"].lower())

    def test_quiz_and_question_crud(self):
        """Tests updating quiz details, editing question fields, and deleting questions with count sync."""
        doc = self._upload_and_process_document(
            self.user_a_token,
            self.user_a_ws_id,
            "algorithms.md",
            b"# Graph Algorithms\n\nDijkstra's algorithm finds shortest paths in weighted graphs without negative edges."
        )

        gen_res = self.client.post(
            "/api/v1/quizzes/generate",
            headers=self._auth_header(self.user_a_token),
            json={"document_ids": [doc], "question_count": 4}
        )
        self.assertEqual(gen_res.status_code, 201)
        quiz = gen_res.json()["data"]
        quiz_id = quiz["id"]
        initial_count = quiz["question_count"]
        self.assertGreater(initial_count, 1)

        first_q = quiz["questions"][0]
        q_id = first_q["id"]

        # 1. Update quiz title and description
        patch_quiz = self.client.patch(
            f"/api/v1/quizzes/{quiz_id}",
            headers=self._auth_header(self.user_a_token),
            json={"title": "Updated Algorithms Exam", "description": "Comprehensive evaluation"}
        )
        self.assertEqual(patch_quiz.status_code, 200)
        self.assertEqual(patch_quiz.json()["data"]["title"], "Updated Algorithms Exam")

        # 2. Update single question
        patch_q = self.client.patch(
            f"/api/v1/quizzes/questions/{q_id}",
            headers=self._auth_header(self.user_a_token),
            json={
                "question": "What specific graph constraint is required for Dijkstra's algorithm?",
                "explanation": "Negative edge weights will cause Dijkstra to produce incorrect results."
            }
        )
        self.assertEqual(patch_q.status_code, 200)
        self.assertEqual(patch_q.json()["data"]["question"], "What specific graph constraint is required for Dijkstra's algorithm?")

        # 3. Delete single question and check parent quiz count sync
        del_q = self.client.delete(
            f"/api/v1/quizzes/questions/{q_id}",
            headers=self._auth_header(self.user_a_token)
        )
        self.assertEqual(del_q.status_code, 204)

        detail_after_q_del = self.client.get(
            f"/api/v1/quizzes/{quiz_id}",
            headers=self._auth_header(self.user_a_token)
        )
        self.assertEqual(detail_after_q_del.status_code, 200)
        new_count = detail_after_q_del.json()["data"]["question_count"]
        self.assertEqual(new_count, initial_count - 1)

        # 4. Delete entire quiz
        del_quiz = self.client.delete(
            f"/api/v1/quizzes/{quiz_id}",
            headers=self._auth_header(self.user_a_token)
        )
        self.assertEqual(del_quiz.status_code, 204)

        # 5. Verify quiz is no longer accessible
        get_deleted = self.client.get(
            f"/api/v1/quizzes/{quiz_id}",
            headers=self._auth_header(self.user_a_token)
        )
        self.assertEqual(get_deleted.status_code, 404)

    def test_usage_accounting(self):
        """Verifies that quiz generation properly records usage and deducts user credits."""
        doc = self._upload_and_process_document(
            self.user_a_token,
            self.user_a_ws_id,
            "machine_learning.md",
            b"# Supervised Learning\n\nGradient descent iteratively adjusts parameters by moving opposite the loss gradient."
        )

        used_before = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)

        gen_res = self.client.post(
            "/api/v1/quizzes/generate",
            headers=self._auth_header(self.user_a_token),
            json={"document_ids": [doc], "question_count": 4}
        )
        self.assertEqual(gen_res.status_code, 201)

        used_after = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)
        self.assertEqual(used_after, used_before + 1)

    def test_zero_secret_leak(self):
        """Verifies that no secrets, keys, or passwords appear anywhere in quiz endpoints."""
        doc = self._upload_and_process_document(
            self.user_a_token,
            self.user_a_ws_id,
            "networks.md",
            b"# TCP/IP Stack\n\nThe Transport layer handles end-to-end communication via TCP or UDP."
        )

        gen_res = self.client.post(
            "/api/v1/quizzes/generate",
            headers=self._auth_header(self.user_a_token),
            json={"document_ids": [doc], "question_count": 4}
        )
        self.assertEqual(gen_res.status_code, 201)
        raw_text = gen_res.text.lower()

        for forbidden in ["api_key", "sk-", "bearer", "password_hash", "encrypted_key", "nonce"]:
            self.assertNotIn(forbidden, raw_text)


if __name__ == "__main__":
    unittest.main()
