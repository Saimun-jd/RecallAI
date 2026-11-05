"""
Comprehensive Test Suite for Prompt 13: Learning Dashboard, Progress Analytics & Study Activity Backend.
Tests:
1. Dashboard Overview (new user empty state with null averages, user with mixed learning data)
2. Review Metrics (workload, FSRS rating distributions with counts and percentages, retention rate)
3. Quiz Performance Analytics (attempts, completed vs in-progress, min/max/average score, accuracy rate)
4. Flashcard Performance Analytics (total cards, active cards, cards due, mastery/review state)
5. Continuous-Time Study Activity (7d, 30d, custom date range, continuous date fill with 0s)
6. Document-Level Learning Progress (learning status broken down per document)
7. Concept-Level Learning Progress (knowledge progress per concept/topic)
8. Historical Study Sessions (pagination, ordering, duration in seconds, rating distribution)
9. Multi-Tenant Isolation & IDOR Defense (cross-user data isolation)
10. Strict Read-Only Guarantee (0 credit debits, zero state mutations across all analytics calls)
"""

from datetime import datetime, timedelta, timezone
import json
import os
import shutil
import tempfile
import unittest
import uuid
from fastapi.testclient import TestClient

from app.main import app
from app.api.middleware import auth_rate_limiter
from app.api.v1.quizzes import quiz_rate_limiter
from app.core.database import set_db_path, get_db
from app.models.schema_init import init_foundation_db
from app.models.repositories import (
    DocumentRepository,
    FlashcardRepository,
    FlashcardSetRepository,
    LearningItemRepository,
    QuizAttemptRepository,
    QuizQuestionRepository,
    QuizRepository,
    ReviewEventRepository,
    ReviewSessionItemRepository,
    ReviewSessionRepository,
    UsageRepository,
)
from app.services.storage import StorageService


class TestLearningAnalyticsAndDashboard(unittest.TestCase):
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
        self.temp_storage_dir = tempfile.mkdtemp(prefix="recall_analytics_storage_")
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
            if os.path.exists(self.temp_storage_dir):
                shutil.rmtree(self.temp_storage_dir, ignore_errors=True)
        except Exception:
            pass

    def _register_user(self, email: str, password: str):
        resp = self.client.post("/api/v1/auth/signup", json={
            "email": email,
            "password": password,
            "full_name": "Analytics Learner"
        })
        self.assertEqual(resp.status_code, 201, resp.text)
        data = resp.json()["data"]
        return data["access_token"], data["workspace"]["id"], data["user"]["id"]

    # =========================================================================
    # 1. DASHBOARD OVERVIEW TESTS
    # =========================================================================

    def test_dashboard_new_user_empty_state(self):
        """A brand-new user receives clean zero-counts and null averages without 500 error."""
        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        resp = self.client.get("/api/v1/learning/dashboard", headers=headers)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()["data"]

        # Review workload
        workload = data["review_workload"]
        self.assertEqual(workload["due"], 0)
        self.assertEqual(workload["overdue"], 0)
        self.assertEqual(workload["new"], 0)
        self.assertEqual(workload["total_active"], 0)

        # Learning states
        states = data["learning_states"]
        self.assertEqual(states["total"], 0)
        self.assertEqual(states["by_state"]["new"], 0)
        self.assertEqual(states["by_state"]["learning"], 0)
        self.assertEqual(states["by_state"]["review"], 0)

        # Today's activity
        today = data["today"]
        self.assertEqual(today["reviews_completed"], 0)
        self.assertEqual(today["quiz_attempts"], 0)

        # Quizzes
        quizzes = data["quizzes"]
        self.assertEqual(quizzes["total_attempts"], 0)
        self.assertEqual(quizzes["completed_attempts"], 0)
        self.assertIsNone(quizzes["average_score"])
        self.assertIsNone(quizzes["highest_score"])
        self.assertIsNone(quizzes["lowest_score"])
        self.assertEqual(quizzes["questions_answered"], 0)
        self.assertIsNone(quizzes["accuracy_rate"])

        # Flashcards
        flashcards = data["flashcards"]
        self.assertEqual(flashcards["total_cards"], 0)
        self.assertEqual(flashcards["active_cards"], 0)

    def test_dashboard_with_mixed_learning_data(self):
        """User with flashcards, quizzes, attempts, and reviews receives accurate aggregated metrics."""
        ws_id = self.user_a_ws_id
        u_id = self.user_a_id

        # 1. Create a flashcard set with 3 cards
        fset = FlashcardSetRepository.create_set(
            workspace_id=ws_id, user_id=u_id, title="Biology", card_count=3
        )
        c1 = FlashcardRepository.create_card(fset["id"], "Cell", "Basic unit of life")
        c2 = FlashcardRepository.create_card(fset["id"], "DNA", "Genetic blueprint")
        c3 = FlashcardRepository.create_card(fset["id"], "RNA", "Messenger")

        # 2. Register items in learning_items with various FSRS states
        # c1: new item
        LearningItemRepository.get_or_create(ws_id, u_id, "flashcard", c1["id"])

        # c2: item in learning state
        item2 = LearningItemRepository.get_or_create(ws_id, u_id, "flashcard", c2["id"])
        LearningItemRepository.update_learning_progress(
            item_id=item2["id"],
            is_correct=True,
            next_review_at="2026-09-15T12:00:00Z",
            scheduling_metadata={"state": "learning", "stability": 1.5, "difficulty": 4.0}
        )

        # c3: item graduated to review state
        item3 = LearningItemRepository.get_or_create(ws_id, u_id, "flashcard", c3["id"])
        LearningItemRepository.update_learning_progress(
            item_id=item3["id"],
            is_correct=True,
            next_review_at="2026-09-20T12:00:00Z",
            scheduling_metadata={"state": "review", "stability": 10.0, "difficulty": 3.0}
        )

        # 3. Create review events (today)
        ReviewEventRepository.create_event(
            workspace_id=ws_id, user_id=u_id, content_type="flashcard",
            content_id=c2["id"], result="correct", rating="good"
        )
        ReviewEventRepository.create_event(
            workspace_id=ws_id, user_id=u_id, content_type="flashcard",
            content_id=c3["id"], result="correct", rating="easy"
        )

        # 4. Create a quiz with 2 attempts (1 submitted with score 80%, 1 in_progress)
        quiz = QuizRepository.create_quiz(
            workspace_id=ws_id, user_id=u_id, title="Bio Quiz", question_count=5
        )
        att1 = QuizAttemptRepository.create_attempt(ws_id, u_id, quiz["id"], total_questions=5)
        QuizAttemptRepository.finalize_attempt(
            attempt_id=att1["id"], score=0.8, percentage=80.0, correct_answers=4
        )
        # Attempt 2 left in_progress
        QuizAttemptRepository.create_attempt(ws_id, u_id, quiz["id"], total_questions=5)

        # Fetch dashboard
        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        resp = self.client.get("/api/v1/learning/dashboard", headers=headers)
        self.assertEqual(resp.status_code, 200)
        d = resp.json()["data"]

        # Workload & states
        self.assertEqual(d["review_workload"]["total_active"], 3)
        self.assertEqual(d["learning_states"]["by_state"]["new"], 1)
        self.assertEqual(d["learning_states"]["by_state"]["learning"], 1)
        self.assertEqual(d["learning_states"]["by_state"]["review"], 1)

        # Today's activity
        self.assertEqual(d["today"]["reviews_completed"], 2)
        self.assertEqual(d["today"]["quiz_attempts"], 1)

        # Quizzes
        self.assertEqual(d["quizzes"]["total_attempts"], 2)
        self.assertEqual(d["quizzes"]["completed_attempts"], 1)
        self.assertEqual(d["quizzes"]["average_score"], 80.0)
        self.assertEqual(d["quizzes"]["highest_score"], 80.0)
        self.assertEqual(d["quizzes"]["questions_answered"], 5)
        self.assertEqual(d["quizzes"]["correct_answers"], 4)
        self.assertEqual(d["quizzes"]["incorrect_answers"], 1)
        self.assertEqual(d["quizzes"]["accuracy_rate"], 80.0)

        # Flashcards
        self.assertEqual(d["flashcards"]["total_cards"], 3)
        self.assertEqual(d["flashcards"]["active_cards"], 3)
        self.assertEqual(d["flashcards"]["cards_reviewed"], 2)
        self.assertEqual(d["flashcards"]["cards_in_review_state"], 1)

    # =========================================================================
    # 2. REVIEW DETAILED METRICS TESTS
    # =========================================================================

    def test_review_detailed_statistics(self):
        """Calculates workload, rating distribution (again, hard, good, easy) and success rates."""
        ws_id = self.user_a_ws_id
        u_id = self.user_a_id

        # Log 4 review events with different ratings
        ratings = ["again", "hard", "good", "good", "easy"]
        for r in ratings:
            ReviewEventRepository.create_event(
                workspace_id=ws_id,
                user_id=u_id,
                content_type="flashcard",
                content_id=str(uuid.uuid4()),
                result="correct" if r in ("good", "easy") else "incorrect",
                rating=r
            )

        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        resp = self.client.get("/api/v1/learning/statistics/reviews", headers=headers)
        self.assertEqual(resp.status_code, 200)
        stats = resp.json()["data"]

        self.assertEqual(stats["total_reviews"], 5)
        self.assertEqual(stats["reviewed_today"], 5)
        self.assertEqual(stats["correct_rate"], 60.0)  # 3 of 5 were good/easy
        self.assertGreater(stats["average_reviews_per_active_day"], 0)

        # Check rating distribution
        r_dict = stats["ratings"]
        self.assertEqual(r_dict["again"]["count"], 1)
        self.assertEqual(r_dict["again"]["percentage"], 20.0)
        self.assertEqual(r_dict["hard"]["count"], 1)
        self.assertEqual(r_dict["hard"]["percentage"], 20.0)
        self.assertEqual(r_dict["good"]["count"], 2)
        self.assertEqual(r_dict["good"]["percentage"], 40.0)
        self.assertEqual(r_dict["easy"]["count"], 1)
        self.assertEqual(r_dict["easy"]["percentage"], 20.0)

    # =========================================================================
    # 3. QUIZ PERFORMANCE ANALYTICS TESTS
    # =========================================================================

    def test_quiz_performance_analytics(self):
        """Aggregates multiple quiz attempts with average, min, and max percentages."""
        ws_id = self.user_a_ws_id
        u_id = self.user_a_id

        quiz = QuizRepository.create_quiz(
            workspace_id=ws_id, user_id=u_id, title="Calculus Quiz", question_count=10
        )

        # Attempt 1: 100% (10/10)
        a1 = QuizAttemptRepository.create_attempt(ws_id, u_id, quiz["id"], total_questions=10)
        QuizAttemptRepository.finalize_attempt(a1["id"], score=1.0, percentage=100.0, correct_answers=10)

        # Attempt 2: 60% (6/10)
        a2 = QuizAttemptRepository.create_attempt(ws_id, u_id, quiz["id"], total_questions=10)
        QuizAttemptRepository.finalize_attempt(a2["id"], score=0.6, percentage=60.0, correct_answers=6)

        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        resp = self.client.get("/api/v1/learning/statistics/quizzes", headers=headers)
        self.assertEqual(resp.status_code, 200)
        q_stats = resp.json()["data"]

        self.assertEqual(q_stats["total_attempts"], 2)
        self.assertEqual(q_stats["completed_attempts"], 2)
        self.assertEqual(q_stats["average_score"], 80.0)
        self.assertEqual(q_stats["highest_score"], 100.0)
        self.assertEqual(q_stats["lowest_score"], 60.0)
        self.assertEqual(q_stats["questions_answered"], 20)
        self.assertEqual(q_stats["correct_answers"], 16)
        self.assertEqual(q_stats["incorrect_answers"], 4)
        self.assertEqual(q_stats["accuracy_rate"], 80.0)

    # =========================================================================
    # 4. FLASHCARD PERFORMANCE ANALYTICS TESTS
    # =========================================================================

    def test_flashcard_performance_analytics(self):
        """Retrieves total, active, due, and mastery counts for flashcards."""
        ws_id = self.user_a_ws_id
        u_id = self.user_a_id

        fset = FlashcardSetRepository.create_set(workspace_id=ws_id, user_id=u_id, title="History", card_count=2)
        c1 = FlashcardRepository.create_card(fset["id"], "1776", "US Independence")
        c2 = FlashcardRepository.create_card(fset["id"], "1789", "French Revolution")

        # Initialize both as learning items
        LearningItemRepository.get_or_create(ws_id, u_id, "flashcard", c1["id"])
        item2 = LearningItemRepository.get_or_create(ws_id, u_id, "flashcard", c2["id"])

        # Mark c2 in FSRS review state
        LearningItemRepository.update_learning_progress(
            item_id=item2["id"],
            is_correct=True,
            next_review_at="2026-09-30T10:00:00Z",
            scheduling_metadata={"state": "review"}
        )

        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        resp = self.client.get("/api/v1/learning/statistics/flashcards", headers=headers)
        self.assertEqual(resp.status_code, 200)
        fc_stats = resp.json()["data"]

        self.assertEqual(fc_stats["total_cards"], 2)
        self.assertEqual(fc_stats["active_cards"], 2)
        self.assertEqual(fc_stats["cards_reviewed"], 1)
        self.assertEqual(fc_stats["cards_in_review_state"], 1)

    # =========================================================================
    # 5. STUDY ACTIVITY & CONTINUOUS DATE-FILL TESTS
    # =========================================================================

    def test_study_activity_continuous_date_fill(self):
        """7-day activity time series includes every calendar day with zero-fill for inactive days."""
        ws_id = self.user_a_ws_id
        u_id = self.user_a_id

        now = datetime.now(timezone.utc)
        today_iso = now.strftime("%Y-%m-%dT12:00:00Z")
        three_days_ago_iso = (now - timedelta(days=3)).strftime("%Y-%m-%dT12:00:00Z")

        # Activity on today and 3 days ago
        ReviewEventRepository.create_event(
            workspace_id=ws_id, user_id=u_id, content_type="flashcard",
            content_id="card-today", result="correct", rating="good", reviewed_at=today_iso
        )
        ReviewEventRepository.create_event(
            workspace_id=ws_id, user_id=u_id, content_type="flashcard",
            content_id="card-past", result="correct", rating="easy", reviewed_at=three_days_ago_iso
        )

        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        resp = self.client.get("/api/v1/learning/activity?range=7d", headers=headers)
        self.assertEqual(resp.status_code, 200)
        act = resp.json()["data"]

        self.assertEqual(act["range"], "7d")
        self.assertEqual(len(act["activity"]), 7)  # Exactly 7 consecutive days
        self.assertEqual(act["total_reviews"], 2)
        self.assertEqual(act["total_active_days"], 2)

        # Verify dates are consecutive without any gaps
        dates = [item["date"] for item in act["activity"]]
        for i in range(len(dates) - 1):
            d1 = datetime.strptime(dates[i], "%Y-%m-%d").date()
            d2 = datetime.strptime(dates[i + 1], "%Y-%m-%d").date()
            self.assertEqual(d2 - d1, timedelta(days=1))

        # Check inactive day has 0 counts
        yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        yesterday_item = next(item for item in act["activity"] if item["date"] == yesterday_str)
        self.assertEqual(yesterday_item["reviews_count"], 0)
        self.assertEqual(yesterday_item["quiz_attempts_count"], 0)

    def test_study_activity_30d_and_custom_range(self):
        """Supports 30d range and custom start_date/end_date range with input validation."""
        headers = {"Authorization": f"Bearer {self.user_a_token}"}

        # 30d range
        resp_30d = self.client.get("/api/v1/learning/activity?range=30d", headers=headers)
        self.assertEqual(resp_30d.status_code, 200)
        self.assertEqual(len(resp_30d.json()["data"]["activity"]), 30)

        # Custom range (5 days)
        resp_custom = self.client.get(
            "/api/v1/learning/activity?range=custom&start_date=2026-09-01&end_date=2026-09-05",
            headers=headers
        )
        self.assertEqual(resp_custom.status_code, 200)
        act_custom = resp_custom.json()["data"]
        self.assertEqual(len(act_custom["activity"]), 5)
        self.assertEqual(act_custom["start_date"], "2026-09-01")
        self.assertEqual(act_custom["end_date"], "2026-09-05")

        # Invalid custom range (start > end)
        resp_inv = self.client.get(
            "/api/v1/learning/activity?range=custom&start_date=2026-09-10&end_date=2026-09-01",
            headers=headers
        )
        self.assertEqual(resp_inv.status_code, 422)

        # Unsupported range name
        resp_bad = self.client.get("/api/v1/learning/activity?range=1year", headers=headers)
        self.assertEqual(resp_bad.status_code, 422)

    # =========================================================================
    # 6. DOCUMENT-LEVEL LEARNING PROGRESS TESTS
    # =========================================================================

    def test_document_level_learning_progress(self):
        """Reports learning status breakdown per document in the workspace."""
        ws_id = self.user_a_ws_id
        u_id = self.user_a_id

        # Document 1 with learning items
        doc1 = DocumentRepository.create_document(
            workspace_id=ws_id, title="Operating Systems Notes", source_type="pdf", total_pages=10
        )
        # Document 2 with no learning items
        doc2 = DocumentRepository.create_document(
            workspace_id=ws_id, title="Clean Code Guidelines", source_type="txt", total_pages=2
        )

        # Create learning items linked to doc1
        item1 = LearningItemRepository.get_or_create(
            workspace_id=ws_id,
            user_id=u_id,
            content_type="flashcard",
            content_id=str(uuid.uuid4()),
            source_reference={"document_id": doc1["id"]}
        )
        item2 = LearningItemRepository.get_or_create(
            workspace_id=ws_id,
            user_id=u_id,
            content_type="quiz_question",
            content_id=str(uuid.uuid4()),
            source_reference={"document_id": doc1["id"]}
        )
        # Mark item2 as reviewed and in review state
        LearningItemRepository.update_learning_progress(
            item_id=item2["id"],
            is_correct=True,
            next_review_at="2026-09-25T10:00:00Z",
            scheduling_metadata={"state": "review"}
        )

        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        resp = self.client.get("/api/v1/learning/progress/documents", headers=headers)
        self.assertEqual(resp.status_code, 200)
        docs_progress = resp.json()["data"]

        self.assertGreaterEqual(len(docs_progress), 2)
        doc1_entry = next(d for d in docs_progress if d["document_id"] == doc1["id"])
        self.assertEqual(doc1_entry["title"], "Operating Systems Notes")
        self.assertEqual(doc1_entry["total_learning_items"], 2)
        self.assertEqual(doc1_entry["new_items"], 1)
        self.assertEqual(doc1_entry["review_items"], 1)
        self.assertEqual(doc1_entry["correct_rate"], 100.0)

        doc2_entry = next(d for d in docs_progress if d["document_id"] == doc2["id"])
        self.assertEqual(doc2_entry["total_learning_items"], 0)

    # =========================================================================
    # 7. CONCEPT-LEVEL LEARNING PROGRESS TESTS
    # =========================================================================

    def test_concept_learning_progress(self):
        """Reports learning progress aggregated by concept/topic."""
        ws_id = self.user_a_ws_id
        u_id = self.user_a_id

        # Register concept items
        LearningItemRepository.get_or_create(
            workspace_id=ws_id,
            user_id=u_id,
            content_type="concept",
            content_id="concept-virtual-memory",
            source_reference={"concept": "Virtual Memory"}
        )
        LearningItemRepository.get_or_create(
            workspace_id=ws_id,
            user_id=u_id,
            content_type="concept",
            content_id="concept-paging",
            source_reference={"concept": "Paging"}
        )

        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        resp = self.client.get("/api/v1/learning/progress/concepts", headers=headers)
        self.assertEqual(resp.status_code, 200)
        concepts = resp.json()["data"]

        self.assertEqual(len(concepts), 2)
        c_names = {c["concept"] for c in concepts}
        self.assertIn("Virtual Memory", c_names)
        self.assertIn("Paging", c_names)

    # =========================================================================
    # 8. HISTORICAL STUDY SESSIONS TESTS
    # =========================================================================

    def test_study_sessions_history_pagination(self):
        """Lists historical study sessions with pagination, duration calculation, and rating distribution."""
        ws_id = self.user_a_ws_id
        u_id = self.user_a_id

        # 1. Session 1: completed with 120s duration and ratings
        s1 = ReviewSessionRepository.create_session(workspace_id=ws_id, user_id=u_id, total_items=2)
        item_a = LearningItemRepository.get_or_create(ws_id, u_id, "flashcard", str(uuid.uuid4()))
        item_b = LearningItemRepository.get_or_create(ws_id, u_id, "flashcard", str(uuid.uuid4()))
        q_items = ReviewSessionItemRepository.create_items_batch(s1["id"], [item_a["id"], item_b["id"]])

        ev1 = ReviewEventRepository.create_event(ws_id, u_id, "flashcard", item_a["content_id"], "correct", rating="good", session_id=s1["id"])
        ev2 = ReviewEventRepository.create_event(ws_id, u_id, "flashcard", item_b["content_id"], "correct", rating="easy", session_id=s1["id"])
        ReviewSessionItemRepository.mark_completed(q_items[0]["id"], "good", ev1["id"])
        ReviewSessionItemRepository.mark_completed(q_items[1]["id"], "easy", ev2["id"])

        t_start = "2026-09-12T10:00:00Z"
        t_end = "2026-09-12T10:02:30Z"  # 150 seconds
        with get_db() as conn:
            conn.execute(
                "UPDATE review_sessions SET status = 'completed', started_at = ?, completed_at = ?, reviewed_items = 2 WHERE id = ?",
                (t_start, t_end, s1["id"])
            )

        # 2. Session 2: active
        ReviewSessionRepository.create_session(workspace_id=ws_id, user_id=u_id, total_items=5)

        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        # Pagination limit=1
        resp = self.client.get("/api/v1/learning/sessions?limit=1&offset=0", headers=headers)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["data"]), 1)

        # Filter by status=completed
        resp_completed = self.client.get("/api/v1/learning/sessions?status=completed", headers=headers)
        self.assertEqual(resp_completed.status_code, 200)
        comp_list = resp_completed.json()["data"]
        self.assertEqual(len(comp_list), 1)

        entry = comp_list[0]
        self.assertEqual(entry["id"], s1["id"])
        self.assertEqual(entry["status"], "completed")
        self.assertEqual(entry["duration_seconds"], 150)
        self.assertEqual(entry["reviewed_items"], 2)
        self.assertEqual(entry["rating_distribution"]["good"], 1)
        self.assertEqual(entry["rating_distribution"]["easy"], 1)

    # =========================================================================
    # 9. MULTI-TENANT ISOLATION & IDOR TESTS
    # =========================================================================

    def test_cross_user_tenant_isolation_idor(self):
        """User A has full study activity; User B queries analytics and receives zero of User A's data."""
        ws_a = self.user_a_ws_id
        u_a = self.user_a_id

        # Setup User A with documents, cards, quiz attempts, and review events
        doc = DocumentRepository.create_document(ws_a, "Top Secret Research", "pdf", 10)
        fset = FlashcardSetRepository.create_set(ws_a, u_a, "Classified Cards", card_count=5)
        c = FlashcardRepository.create_card(fset["id"], "Secret", "Data")
        LearningItemRepository.get_or_create(ws_a, u_a, "flashcard", c["id"])
        ReviewEventRepository.create_event(ws_a, u_a, "flashcard", c["id"], "correct", rating="good")

        quiz = QuizRepository.create_quiz(ws_a, u_a, "Secret Quiz", question_count=10)
        att = QuizAttemptRepository.create_attempt(ws_a, u_a, quiz["id"], total_questions=10)
        QuizAttemptRepository.finalize_attempt(att["id"], score=0.9, percentage=90.0, correct_answers=9)

        ReviewSessionRepository.create_session(ws_a, u_a, total_items=5)

        # User B queries all endpoints
        headers_b = {"Authorization": f"Bearer {self.user_b_token}"}

        # 1. Dashboard
        resp_dash = self.client.get("/api/v1/learning/dashboard", headers=headers_b)
        self.assertEqual(resp_dash.status_code, 200)
        d_b = resp_dash.json()["data"]
        self.assertEqual(d_b["review_workload"]["total_active"], 0)
        self.assertEqual(d_b["today"]["reviews_completed"], 0)
        self.assertEqual(d_b["quizzes"]["total_attempts"], 0)
        self.assertEqual(d_b["flashcards"]["total_cards"], 0)

        # 2. Activity
        resp_act = self.client.get("/api/v1/learning/activity?range=7d", headers=headers_b)
        self.assertEqual(resp_act.status_code, 200)
        self.assertEqual(resp_act.json()["data"]["total_reviews"], 0)
        self.assertEqual(resp_act.json()["data"]["total_quiz_attempts"], 0)

        # 3. Document progress
        resp_doc = self.client.get("/api/v1/learning/progress/documents", headers=headers_b)
        self.assertEqual(resp_doc.status_code, 200)
        self.assertEqual(len(resp_doc.json()["data"]), 0)

        # 4. Sessions
        resp_sess = self.client.get("/api/v1/learning/sessions", headers=headers_b)
        self.assertEqual(resp_sess.status_code, 200)
        self.assertEqual(len(resp_sess.json()["data"]), 0)

    # =========================================================================
    # 10. STRICT READ-ONLY & ZERO CREDIT GUARANTEE TESTS
    # =========================================================================

    def test_analytics_endpoints_are_strictly_read_only(self):
        """Repeated analytics calls produce zero state mutations, zero review events, and zero credit debits."""
        ws_id = self.user_a_ws_id
        u_id = self.user_a_id

        # Setup initial state
        fset = FlashcardSetRepository.create_set(ws_id, u_id, "Set A", card_count=1)
        c = FlashcardRepository.create_card(fset["id"], "Q", "A")
        item = LearningItemRepository.get_or_create(ws_id, u_id, "flashcard", c["id"])

        # Initial snapshots
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM review_events WHERE workspace_id = ?", (ws_id,))
            initial_events = cur.fetchone()[0]

            cur.execute("SELECT correct_count, incorrect_count, next_review_at FROM learning_items WHERE id = ?", (item["id"],))
            initial_item = dict(cur.fetchone())

        initial_credits = UsageRepository.get_monthly_credits_used(ws_id)

        # Make 5 rounds of calls to all analytics endpoints
        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        endpoints = [
            "/api/v1/learning/dashboard",
            "/api/v1/learning/activity?range=7d",
            "/api/v1/learning/statistics/reviews",
            "/api/v1/learning/statistics/quizzes",
            "/api/v1/learning/statistics/flashcards",
            "/api/v1/learning/progress/documents",
            "/api/v1/learning/progress/concepts",
            "/api/v1/learning/sessions"
        ]

        for _ in range(5):
            for ep in endpoints:
                res = self.client.get(ep, headers=headers)
                self.assertEqual(res.status_code, 200, f"Endpoint {ep} failed: {res.text}")

        # Final verification: zero changes
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM review_events WHERE workspace_id = ?", (ws_id,))
            final_events = cur.fetchone()[0]

            cur.execute("SELECT correct_count, incorrect_count, next_review_at FROM learning_items WHERE id = ?", (item["id"],))
            final_item = dict(cur.fetchone())

        final_credits = UsageRepository.get_monthly_credits_used(ws_id)

        self.assertEqual(initial_events, final_events, "Analytics call created review events!")
        self.assertEqual(initial_item, final_item, "Analytics call mutated learning item!")
        self.assertEqual(initial_credits, final_credits, "Analytics call debited usage credits!")


if __name__ == "__main__":
    unittest.main()
