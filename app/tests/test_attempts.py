"""
Comprehensive Test Suite for Quiz Attempts, Deterministic Scoring, and Spaced Repetition Foundation.
Tests question masking, answer validation, deterministic scoring, double submission prevention,
learning progress tracking, review scheduler intervals, and zero AI credit consumption.
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
from app.core.database import set_db_path, get_db
from app.models.schema_init import init_foundation_db
from app.models.repositories import (
    LearningItemRepository,
    QuizQuestionRepository,
    ReviewEventRepository,
    UsageRepository,
)
from app.services.pipeline import DocumentProcessingPipeline
from app.services.scheduler import GraduatedIntervalScheduler
from app.services.storage import StorageService


class TestQuizAttemptsAndScoring(unittest.TestCase):
    def setUp(self):
        auth_rate_limiter.reset()
        quiz_rate_limiter.reset()

        # 1. Isolated temporary database
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db_path = self.temp_db.name
        self.temp_db.close()

        set_db_path(self.temp_db_path)
        init_foundation_db(self.temp_db_path)

        # 2. Isolated storage
        self.temp_storage_dir = tempfile.mkdtemp(prefix="recall_attempt_storage_")
        StorageService.set_root_dir(self.temp_storage_dir)

        # 3. TestClient
        self.client = TestClient(app)

        # 4. Register two isolated tenants
        uid = os.urandom(4).hex()
        self.user_a_token, self.user_a_ws_id, self.user_a_id = self._register_user(f"user_a_{uid}@test.com", "Password123!")
        self.user_b_token, self.user_b_ws_id, self.user_b_id = self._register_user(f"user_b_{uid}@test.com", "Password123!")

        # 5. Create a standard quiz for User A
        self.quiz_a_id = self._create_test_quiz(self.user_a_token, self.user_a_ws_id)

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
            "full_name": "Attempt Tester"
        })
        self.assertEqual(res.status_code, 201)
        data = res.json()["data"]
        return data["access_token"], data["workspace"]["id"], data["user"]["id"]

    def _auth_header(self, token: str):
        return {"Authorization": f"Bearer {token}"}

    def _create_test_quiz(self, token: str, workspace_id: str) -> str:
        # Upload study material
        res = self.client.post(
            "/api/v1/documents/upload",
            headers=self._auth_header(token),
            files={"file": ("distributed_systems.md", b"# Consensus Protocols\n\nRaft uses leader election and log replication to achieve consensus.", "text/markdown")}
        )
        self.assertEqual(res.status_code, 202)
        doc_id = res.json()["data"]["document_id"]
        job_id = res.json()["data"]["job_id"]

        DocumentProcessingPipeline.process_document(
            document_id=doc_id,
            job_id=job_id,
            workspace_id=workspace_id
        )

        # Generate quiz
        gen_res = self.client.post(
            "/api/v1/quizzes/generate",
            headers=self._auth_header(token),
            json={
                "document_ids": [doc_id],
                "question_count": 4,
                "question_types": ["multiple_choice", "true_false"],
                "title": "Distributed Consensus Quiz"
            }
        )
        self.assertEqual(gen_res.status_code, 201)
        return gen_res.json()["data"]["id"]

    def test_start_attempt_and_mask_answers(self):
        """Starting an attempt must return 201 and NEVER leak correct answers or explanations."""
        res = self.client.post(
            f"/api/v1/quizzes/{self.quiz_a_id}/attempts",
            headers=self._auth_header(self.user_a_token)
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()["data"]

        self.assertEqual(data["quiz_id"], self.quiz_a_id)
        self.assertEqual(data["status"], "in_progress")
        self.assertGreater(data["total_questions"], 0)
        self.assertGreater(len(data["questions"]), 0)

        # Verify active question masking
        for q in data["questions"]:
            self.assertIn("id", q)
            self.assertIn("type", q)
            self.assertIn("question", q)
            self.assertIn("options", q)
            self.assertIn("position", q)

            # Assert ZERO answer leakage
            self.assertNotIn("correct_answer", q)
            self.assertNotIn("explanation", q)
            self.assertNotIn("source_metadata", q)

    def test_foreign_quiz_attempt_rejected(self):
        """User B must not be able to start an attempt on User A's quiz."""
        res = self.client.post(
            f"/api/v1/quizzes/{self.quiz_a_id}/attempts",
            headers=self._auth_header(self.user_b_token)
        )
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()["error"]["code"], "NOT_FOUND")

    def test_foreign_attempt_access_rejected(self):
        """User B cannot read or submit an attempt started by User A."""
        start_res = self.client.post(
            f"/api/v1/quizzes/{self.quiz_a_id}/attempts",
            headers=self._auth_header(self.user_a_token)
        )
        self.assertEqual(start_res.status_code, 201)
        attempt_id = start_res.json()["data"]["id"]

        # User B cannot read
        get_res = self.client.get(
            f"/api/v1/quiz-attempts/{attempt_id}",
            headers=self._auth_header(self.user_b_token)
        )
        self.assertEqual(get_res.status_code, 404)

        # User B cannot submit answers
        sub_res = self.client.post(
            f"/api/v1/quiz-attempts/{attempt_id}/submit",
            headers=self._auth_header(self.user_b_token),
            json={"answers": []}
        )
        self.assertEqual(sub_res.status_code, 404)

    def test_answer_submission_and_interim_save(self):
        """Interim answers can be saved while the attempt is in progress."""
        start_res = self.client.post(
            f"/api/v1/quizzes/{self.quiz_a_id}/attempts",
            headers=self._auth_header(self.user_a_token)
        )
        attempt = start_res.json()["data"]
        attempt_id = attempt["id"]
        q_id = attempt["questions"][0]["id"]

        ans_res = self.client.post(
            f"/api/v1/quiz-attempts/{attempt_id}/answers",
            headers=self._auth_header(self.user_a_token),
            json={"question_id": q_id, "selected_answer": "0"}
        )
        self.assertEqual(ans_res.status_code, 200)
        self.assertEqual(ans_res.json()["data"]["status"], "saved")

    def test_deterministic_scoring_all_correct(self):
        """Submitting all correct answers results in 100% score and reveals explanations."""
        start_res = self.client.post(
            f"/api/v1/quizzes/{self.quiz_a_id}/attempts",
            headers=self._auth_header(self.user_a_token)
        )
        attempt = start_res.json()["data"]
        attempt_id = attempt["id"]

        # Look up true answers from database (as server authority)
        stored_questions = QuizQuestionRepository.list_by_quiz(self.quiz_a_id)
        answers_payload = [
            {"question_id": q["id"], "selected_answer": q["correct_answer"]}
            for q in stored_questions
        ]

        submit_res = self.client.post(
            f"/api/v1/quiz-attempts/{attempt_id}/submit",
            headers=self._auth_header(self.user_a_token),
            json={"answers": answers_payload}
        )
        self.assertEqual(submit_res.status_code, 200)
        result = submit_res.json()["data"]

        self.assertEqual(result["status"], "submitted")
        self.assertEqual(result["score"], 1.0)
        self.assertEqual(result["percentage"], 100.0)
        self.assertEqual(result["correct_answers"], len(stored_questions))
        self.assertEqual(result["incorrect_answers"], 0)
        self.assertEqual(result["unanswered"], 0)

        # Verify educational explanations are now revealed
        for q_res in result["question_results"]:
            self.assertTrue(q_res["is_correct"])
            self.assertGreater(len(q_res["explanation"]), 0)
            self.assertIn("correct_answer", q_res)

    def test_deterministic_scoring_mixed_and_unanswered(self):
        """Unanswered questions count as incorrect and score reflects accurate fraction."""
        start_res = self.client.post(
            f"/api/v1/quizzes/{self.quiz_a_id}/attempts",
            headers=self._auth_header(self.user_a_token)
        )
        attempt = start_res.json()["data"]
        attempt_id = attempt["id"]
        stored_questions = QuizQuestionRepository.list_by_quiz(self.quiz_a_id)
        self.assertGreaterEqual(len(stored_questions), 2)

        # Answer 1st correctly, 2nd incorrectly, leave remaining unanswered
        q1 = stored_questions[0]
        q2 = stored_questions[1]
        wrong_ans = "99" if q1["type"] == "multiple_choice" else ("false" if q2["correct_answer"].lower() == "true" else "true")

        answers_payload = [
            {"question_id": q1["id"], "selected_answer": q1["correct_answer"]},
            {"question_id": q2["id"], "selected_answer": wrong_ans}
        ]

        submit_res = self.client.post(
            f"/api/v1/quiz-attempts/{attempt_id}/submit",
            headers=self._auth_header(self.user_a_token),
            json={"answers": answers_payload}
        )
        self.assertEqual(submit_res.status_code, 200)
        result = submit_res.json()["data"]

        self.assertEqual(result["correct_answers"], 1)
        self.assertGreaterEqual(result["incorrect_answers"], 1)
        expected_score = round(1 / len(stored_questions), 4)
        self.assertEqual(result["score"], expected_score)

    def test_prevent_double_submission(self):
        """Attempting to submit an already submitted attempt must be rejected with 409 Conflict."""
        start_res = self.client.post(
            f"/api/v1/quizzes/{self.quiz_a_id}/attempts",
            headers=self._auth_header(self.user_a_token)
        )
        attempt_id = start_res.json()["data"]["id"]

        # 1. First submission succeeds
        first_sub = self.client.post(
            f"/api/v1/quiz-attempts/{attempt_id}/submit",
            headers=self._auth_header(self.user_a_token),
            json={"answers": []}
        )
        self.assertEqual(first_sub.status_code, 200)

        # 2. Second submission rejected with 409 CONFLICT
        second_sub = self.client.post(
            f"/api/v1/quiz-attempts/{attempt_id}/submit",
            headers=self._auth_header(self.user_a_token),
            json={"answers": []}
        )
        self.assertEqual(second_sub.status_code, 409)
        self.assertEqual(second_sub.json()["error"]["code"], "CONFLICT")

    def test_explanation_revealed_only_after_submission(self):
        """GET /quiz-attempts/{id} masks questions before submission and reveals explanations after."""
        start_res = self.client.post(
            f"/api/v1/quizzes/{self.quiz_a_id}/attempts",
            headers=self._auth_header(self.user_a_token)
        )
        attempt_id = start_res.json()["data"]["id"]

        # Before submit: masked
        get_before = self.client.get(
            f"/api/v1/quiz-attempts/{attempt_id}",
            headers=self._auth_header(self.user_a_token)
        )
        self.assertEqual(get_before.status_code, 200)
        before_data = get_before.json()["data"]
        self.assertEqual(before_data["status"], "in_progress")
        self.assertNotIn("correct_answer", before_data["questions"][0])

        # Submit
        self.client.post(
            f"/api/v1/quiz-attempts/{attempt_id}/submit",
            headers=self._auth_header(self.user_a_token),
            json={"answers": []}
        )

        # After submit: unmasked
        get_after = self.client.get(
            f"/api/v1/quiz-attempts/{attempt_id}",
            headers=self._auth_header(self.user_a_token)
        )
        self.assertEqual(get_after.status_code, 200)
        after_data = get_after.json()["data"]
        self.assertEqual(after_data["status"], "submitted")
        self.assertIn("correct_answer", after_data["question_results"][0])
        self.assertIn("explanation", after_data["question_results"][0])

    def test_learning_progress_updated_on_submission(self):
        """Submitting an attempt must update learning items and record review events."""
        start_res = self.client.post(
            f"/api/v1/quizzes/{self.quiz_a_id}/attempts",
            headers=self._auth_header(self.user_a_token)
        )
        attempt_id = start_res.json()["data"]["id"]

        # Submit attempt
        self.client.post(
            f"/api/v1/quiz-attempts/{attempt_id}/submit",
            headers=self._auth_header(self.user_a_token),
            json={"answers": []}
        )

        # Check learning progress endpoint
        prog_res = self.client.get(
            "/api/v1/learning/progress",
            headers=self._auth_header(self.user_a_token)
        )
        self.assertEqual(prog_res.status_code, 200)
        prog = prog_res.json()["data"]
        self.assertGreater(prog["total_items"], 0)
        self.assertGreater(prog["reviewed_items"], 0)

        # Verify review events in repository
        events = ReviewEventRepository.list_by_user(
            workspace_id=self.user_a_ws_id,
            user_id=self.user_a_id
        )
        self.assertGreater(len(events), 0)
        self.assertEqual(events[0]["source_id"], attempt_id)

    def test_scheduler_intervals(self):
        """GraduatedIntervalScheduler scales intervals on successive correct reviews and resets on lapse."""
        scheduler = GraduatedIntervalScheduler()

        # Review 1: First correct -> 1 day
        next_rev, meta = scheduler.schedule(
            previous_correct_count=0,
            previous_incorrect_count=0,
            is_correct=True
        )
        self.assertEqual(meta["consecutive_correct"], 1)
        self.assertEqual(meta["scheduled_days"], 1)

        # Review 2: Second correct -> 3 days
        next_rev2, meta2 = scheduler.schedule(
            previous_correct_count=1,
            previous_incorrect_count=0,
            is_correct=True,
            current_metadata=meta
        )
        self.assertEqual(meta2["consecutive_correct"], 2)
        self.assertEqual(meta2["scheduled_days"], 3)

        # Review 3: Lapse (incorrect) -> resets to 1 day
        next_rev3, meta3 = scheduler.schedule(
            previous_correct_count=2,
            previous_incorrect_count=0,
            is_correct=False,
            current_metadata=meta2
        )
        self.assertEqual(meta3["consecutive_correct"], 0)
        self.assertEqual(meta3["scheduled_days"], 1)
        self.assertEqual(meta3["lapse_count"], 1)

    def test_zero_ai_credits_used(self):
        """Taking quizzes and deterministic scoring must consume ZERO AI credits."""
        credits_before = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)

        # 1. Start attempt
        start_res = self.client.post(
            f"/api/v1/quizzes/{self.quiz_a_id}/attempts",
            headers=self._auth_header(self.user_a_token)
        )
        attempt_id = start_res.json()["data"]["id"]

        # 2. Record answer
        self.client.post(
            f"/api/v1/quiz-attempts/{attempt_id}/answers",
            headers=self._auth_header(self.user_a_token),
            json={"question_id": start_res.json()["data"]["questions"][0]["id"], "selected_answer": "0"}
        )

        # 3. Submit attempt
        self.client.post(
            f"/api/v1/quiz-attempts/{attempt_id}/submit",
            headers=self._auth_header(self.user_a_token),
            json={"answers": []}
        )

        credits_after = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)
        # Asserts ZERO credit delta
        self.assertEqual(credits_after, credits_before)


if __name__ == "__main__":
    unittest.main()
