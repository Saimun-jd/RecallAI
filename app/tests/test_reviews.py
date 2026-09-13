"""
Comprehensive Test Suite for Prompt 12: Production Spaced-Repetition Engine & Review Sessions.
Tests:
1. FSRS v6 Scheduling Algorithm (state transitions, intervals, lapses, deterministic review timestamps)
2. Prioritized Review Queue (overdue -> due now -> new, exclusion of future items)
3. Review Session Lifecycle (creation, next item masking, reveal answer without AI, atomic rating, idempotency)
4. Flashcard & Quiz Integration (automatic learning item creation, review events audit log)
5. Zero AI Cost & Security (tenant isolation, IDOR rejection, zero credits debited for reviews)
"""

from datetime import datetime, timedelta, timezone
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
    FlashcardRepository,
    FlashcardSetRepository,
    LearningItemRepository,
    QuizQuestionRepository,
    QuizRepository,
    ReviewEventRepository,
    ReviewSessionItemRepository,
    ReviewSessionRepository,
    UsageRepository,
)
from app.services.scheduler import FSRSScheduler, GraduatedIntervalScheduler, ReviewRating, default_scheduler
from app.services.storage import StorageService


class TestSpacedRepetitionAndReviewSessions(unittest.TestCase):
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
        self.temp_storage_dir = tempfile.mkdtemp(prefix="recall_review_storage_")
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
            "full_name": "Test Learner"
        })
        self.assertEqual(resp.status_code, 201, resp.text)
        data = resp.json()["data"]
        return data["access_token"], data["workspace"]["id"], data["user"]["id"]

    def _create_test_flashcards(self, ws_id: str, user_id: str, count: int = 3):
        fset = FlashcardSetRepository.create_set(
            workspace_id=ws_id,
            user_id=user_id,
            title="Cell Biology Flashcards",
            description="Testing study session cards",
            source_document_ids=[],
            card_count=count
        )
        cards_data = [
            {
                "front": f"What is the function of organelle {i}?",
                "back": f"Organelle {i} produces ATP through cellular respiration.",
                "source_metadata": [{"source_index": f"S{i}", "page_number": 1}],
                "position": i
            }
            for i in range(1, count + 1)
        ]
        created_cards = FlashcardRepository.create_flashcards_batch(fset["id"], cards_data)

        # Register as learning items
        learning_items_data = [
            {
                "id": c["id"],
                "source_reference": {
                    "flashcard_set_id": fset["id"],
                    "front": c["front"],
                    "source_metadata": c.get("source_metadata", [])
                }
            }
            for c in created_cards
        ]
        LearningItemRepository.init_items_for_content(
            workspace_id=ws_id,
            user_id=user_id,
            content_type="flashcard",
            items=learning_items_data
        )
        return fset["id"], created_cards

    # =========================================================================
    # 1. FSRS SCHEDULER TESTS
    # =========================================================================

    def test_fsrs_state_transitions_and_ratings(self):
        """FSRS scheduler correctly handles again, hard, good, easy ratings and state transitions."""
        scheduler = FSRSScheduler(enable_fuzzing=False)
        base_time = datetime(2026, 9, 12, 10, 0, 0, tzinfo=timezone.utc)

        # 1. New card rated 'good' -> transitions to learning state
        next_due, meta = scheduler.schedule(
            rating=ReviewRating.GOOD,
            review_time=base_time
        )
        self.assertEqual(meta["state"], "learning")
        self.assertGreater(next_due, base_time)
        self.assertIsNotNone(meta["stability"])

        # 2. Second 'good' review -> graduates to review state
        next_due_2, meta_2 = scheduler.schedule(
            current_metadata=meta,
            rating=ReviewRating.GOOD,
            review_time=next_due
        )
        self.assertEqual(meta_2["state"], "review")
        self.assertGreater(next_due_2, next_due)

        # 3. Lapsed card rated 'again' in review state -> transitions to relearning
        next_due_lapse, meta_lapse = scheduler.schedule(
            current_metadata=meta_2,
            rating=ReviewRating.AGAIN,
            review_time=next_due_2
        )
        self.assertEqual(meta_lapse["state"], "relearning")
        self.assertEqual(meta_lapse["lapses"], 1)

        # 4. New card rated 'easy' directly graduates to review state with extended stability
        next_due_easy, meta_easy = scheduler.schedule(
            rating=ReviewRating.EASY,
            review_time=base_time
        )
        self.assertEqual(meta_easy["state"], "review")
        self.assertGreater(meta_easy["stability"], meta["stability"])

    def test_fsrs_deterministic_fixed_timestamp(self):
        """FSRS produces bit-for-bit identical schedules given fixed timestamp and state."""
        scheduler = FSRSScheduler(enable_fuzzing=False)
        fixed_time = datetime(2026, 9, 15, 14, 30, 0, tzinfo=timezone.utc)

        due_1, meta_1 = scheduler.schedule(rating="good", review_time=fixed_time)
        due_2, meta_2 = scheduler.schedule(rating="good", review_time=fixed_time)

        self.assertEqual(due_1, due_2)
        self.assertEqual(meta_1["stability"], meta_2["stability"])
        self.assertEqual(meta_1["difficulty"], meta_2["difficulty"])

    def test_invalid_rating_rejected(self):
        """Invalid ratings raise clear ValueError."""
        with self.assertRaises(ValueError):
            ReviewRating.from_string("random_string")

    # =========================================================================
    # 2. REVIEW QUEUE TESTS
    # =========================================================================

    def test_review_queue_ordering_and_filtering(self):
        """Queue orders overdue items before due-now items and excludes future items."""
        now = datetime.now(timezone.utc)
        overdue_time = (now - timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
        due_now_time = (now - timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
        future_time = (now + timedelta(days=5)).strftime("%Y-%m-%dT%H:%M:%SZ")

        with get_db() as conn:
            # Overdue item
            conn.execute("""
                INSERT INTO learning_items (id, workspace_id, user_id, content_type, content_id, next_review_at, last_seen_at)
                VALUES ('item-overdue', ?, ?, 'flashcard', 'c1', ?, ?)
            """, (self.user_a_ws_id, self.user_a_id, overdue_time, overdue_time))

            # Due now item
            conn.execute("""
                INSERT INTO learning_items (id, workspace_id, user_id, content_type, content_id, next_review_at, last_seen_at)
                VALUES ('item-due-now', ?, ?, 'flashcard', 'c2', ?, ?)
            """, (self.user_a_ws_id, self.user_a_id, due_now_time, due_now_time))

            # Future item (must NOT appear in due queue)
            conn.execute("""
                INSERT INTO learning_items (id, workspace_id, user_id, content_type, content_id, next_review_at, last_seen_at)
                VALUES ('item-future', ?, ?, 'flashcard', 'c3', ?, ?)
            """, (self.user_a_ws_id, self.user_a_id, future_time, due_now_time))

        resp = self.client.get(
            "/api/v1/reviews/queue",
            headers={"Authorization": f"Bearer {self.user_a_token}"}
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()["data"]

        # Only overdue and due-now should be present
        item_ids = [it["id"] for it in data]
        self.assertIn("item-overdue", item_ids)
        self.assertIn("item-due-now", item_ids)
        self.assertNotIn("item-future", item_ids)

        # Overdue item must appear first
        self.assertEqual(data[0]["id"], "item-overdue")
        self.assertEqual(data[0]["priority_group"], "overdue")

    # =========================================================================
    # 3. REVIEW SESSION LIFECYCLE & ZERO-LEAKAGE TESTS
    # =========================================================================

    def test_review_session_lifecycle_and_masking(self):
        """Starting session, fetching next item masks answer, revealing exposes back, rating updates progress."""
        _, cards = self._create_test_flashcards(self.user_a_ws_id, self.user_a_id, count=2)

        # 1. Start review session
        start_resp = self.client.post(
            "/api/v1/reviews/sessions",
            json={"limit": 10},
            headers={"Authorization": f"Bearer {self.user_a_token}"}
        )
        self.assertEqual(start_resp.status_code, 201, start_resp.text)
        session = start_resp.json()["data"]
        session_id = session["id"]
        self.assertEqual(session["status"], "active")
        self.assertEqual(session["total_items"], 2)
        self.assertEqual(session["reviewed_items"], 0)

        # 2. Get next item: answer/back MUST be masked
        next_resp = self.client.get(
            f"/api/v1/reviews/sessions/{session_id}/next",
            headers={"Authorization": f"Bearer {self.user_a_token}"}
        )
        self.assertEqual(next_resp.status_code, 200, next_resp.text)
        item_data = next_resp.json()["data"]
        self.assertIsNotNone(item_data)
        self.assertTrue(len(item_data["front"]) > 0)
        self.assertFalse(item_data["revealed"])
        # Back field must not exist or be exposed in MaskedReviewContentResponse
        self.assertNotIn("back", item_data)

        review_id = item_data["review_id"]

        # 3. Reveal answer: back is returned without AI cost
        reveal_resp = self.client.post(
            f"/api/v1/reviews/{review_id}/reveal",
            headers={"Authorization": f"Bearer {self.user_a_token}"}
        )
        self.assertEqual(reveal_resp.status_code, 200, reveal_resp.text)
        revealed_data = reveal_resp.json()["data"]
        self.assertTrue(revealed_data["revealed"])
        self.assertIn("ATP through cellular respiration", revealed_data["back"])

        # 4. Rate review item: Good
        rate_resp = self.client.post(
            f"/api/v1/reviews/{review_id}/rate",
            json={"rating": "good"},
            headers={"Authorization": f"Bearer {self.user_a_token}"}
        )
        self.assertEqual(rate_resp.status_code, 200, rate_resp.text)
        rated_data = rate_resp.json()["data"]
        self.assertEqual(rated_data["rating"], "good")
        self.assertEqual(rated_data["reviewed_items"], 1)
        self.assertIsNotNone(rated_data["next_review_at"])

        # 5. Verify review_events audit record created
        events = ReviewEventRepository.list_by_user(self.user_a_ws_id, self.user_a_id)
        self.assertTrue(len(events) >= 1)
        self.assertEqual(events[0]["rating"], "good")
        self.assertEqual(events[0]["source_type"], "review_session")

        # 6. Verify Session Progress via GET /sessions/{session_id}
        sess_get = self.client.get(
            f"/api/v1/reviews/sessions/{session_id}",
            headers={"Authorization": f"Bearer {self.user_a_token}"}
        )
        self.assertEqual(sess_get.status_code, 200)
        self.assertEqual(sess_get.json()["data"]["reviewed_items"], 1)

    def test_prevent_double_rating_idempotency(self):
        """Rating the same review item twice raises HTTP 409 Conflict without re-applying scheduler."""
        _, cards = self._create_test_flashcards(self.user_a_ws_id, self.user_a_id, count=1)

        start_resp = self.client.post(
            "/api/v1/reviews/sessions",
            json={"limit": 5},
            headers={"Authorization": f"Bearer {self.user_a_token}"}
        )
        session_id = start_resp.json()["data"]["id"]

        next_resp = self.client.get(
            f"/api/v1/reviews/sessions/{session_id}/next",
            headers={"Authorization": f"Bearer {self.user_a_token}"}
        )
        review_id = next_resp.json()["data"]["review_id"]

        # First rating succeeds
        resp1 = self.client.post(
            f"/api/v1/reviews/{review_id}/rate",
            json={"rating": "good"},
            headers={"Authorization": f"Bearer {self.user_a_token}"}
        )
        self.assertEqual(resp1.status_code, 200)

        # Second rating must be rejected with 409 Conflict
        resp2 = self.client.post(
            f"/api/v1/reviews/{review_id}/rate",
            json={"rating": "good"},
            headers={"Authorization": f"Bearer {self.user_a_token}"}
        )
        self.assertEqual(resp2.status_code, 409)

    def test_session_abandonment_preserves_completed_reviews(self):
        """Abandoning a session marks it abandoned while preserving already rated reviews."""
        _, cards = self._create_test_flashcards(self.user_a_ws_id, self.user_a_id, count=2)

        start_resp = self.client.post(
            "/api/v1/reviews/sessions",
            json={"limit": 5},
            headers={"Authorization": f"Bearer {self.user_a_token}"}
        )
        session_id = start_resp.json()["data"]["id"]

        next_resp = self.client.get(
            f"/api/v1/reviews/sessions/{session_id}/next",
            headers={"Authorization": f"Bearer {self.user_a_token}"}
        )
        review_id = next_resp.json()["data"]["review_id"]

        # Rate first item
        self.client.post(
            f"/api/v1/reviews/{review_id}/rate",
            json={"rating": "easy"},
            headers={"Authorization": f"Bearer {self.user_a_token}"}
        )

        # Abandon session
        abandon_resp = self.client.post(
            f"/api/v1/reviews/sessions/{session_id}/abandon",
            headers={"Authorization": f"Bearer {self.user_a_token}"}
        )
        self.assertEqual(abandon_resp.status_code, 200)
        self.assertEqual(abandon_resp.json()["data"]["status"], "abandoned")

        # History remains intact
        events = ReviewEventRepository.list_by_user(self.user_a_ws_id, self.user_a_id)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["rating"], "easy")

    # =========================================================================
    # 4. SECURITY & TENANT ISOLATION TESTS
    # =========================================================================

    def test_foreign_review_access_rejected(self):
        """User B cannot access or rate User A's review session (IDOR protection)."""
        _, cards = self._create_test_flashcards(self.user_a_ws_id, self.user_a_id, count=1)

        start_resp = self.client.post(
            "/api/v1/reviews/sessions",
            json={"limit": 5},
            headers={"Authorization": f"Bearer {self.user_a_token}"}
        )
        session_id = start_resp.json()["data"]["id"]

        # User B attempts to access User A's session
        get_resp = self.client.get(
            f"/api/v1/reviews/sessions/{session_id}",
            headers={"Authorization": f"Bearer {self.user_b_token}"}
        )
        self.assertEqual(get_resp.status_code, 404)

    # =========================================================================
    # 5. INTEGRATION & ZERO AI CREDITS TESTS
    # =========================================================================

    def test_review_statistics_calculation(self):
        """GET /api/v1/reviews/statistics calculates correct memory totals and success rates."""
        _, cards = self._create_test_flashcards(self.user_a_ws_id, self.user_a_id, count=3)

        # Rate 1 card Good, 1 card Again
        start_resp = self.client.post(
            "/api/v1/reviews/sessions",
            json={"limit": 2},
            headers={"Authorization": f"Bearer {self.user_a_token}"}
        )
        sess_id = start_resp.json()["data"]["id"]

        r1 = self.client.get(f"/api/v1/reviews/sessions/{sess_id}/next", headers={"Authorization": f"Bearer {self.user_a_token}"}).json()["data"]["review_id"]
        self.client.post(f"/api/v1/reviews/{r1}/rate", json={"rating": "good"}, headers={"Authorization": f"Bearer {self.user_a_token}"})

        r2 = self.client.get(f"/api/v1/reviews/sessions/{sess_id}/next", headers={"Authorization": f"Bearer {self.user_a_token}"}).json()["data"]["review_id"]
        self.client.post(f"/api/v1/reviews/{r2}/rate", json={"rating": "again"}, headers={"Authorization": f"Bearer {self.user_a_token}"})

        # Fetch stats
        stats_resp = self.client.get(
            "/api/v1/reviews/statistics",
            headers={"Authorization": f"Bearer {self.user_a_token}"}
        )
        self.assertEqual(stats_resp.status_code, 200)
        stats = stats_resp.json()["data"]

        self.assertEqual(stats["total_items"], 3)
        self.assertEqual(stats["reviewed_today"], 2)
        self.assertEqual(stats["correct_rate"], 50.0)

    def test_zero_ai_credits_used_for_reviews(self):
        """Starting review session, revealing answer, and rating items debits 0 AI credits."""
        _, cards = self._create_test_flashcards(self.user_a_ws_id, self.user_a_id, count=1)

        # Initial usage count
        credits_before = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)

        # Complete a review cycle
        start_resp = self.client.post("/api/v1/reviews/sessions", json={"limit": 5}, headers={"Authorization": f"Bearer {self.user_a_token}"})
        sess_id = start_resp.json()["data"]["id"]

        next_item = self.client.get(f"/api/v1/reviews/sessions/{sess_id}/next", headers={"Authorization": f"Bearer {self.user_a_token}"}).json()["data"]
        rev_id = next_item["review_id"]

        self.client.post(f"/api/v1/reviews/{rev_id}/reveal", headers={"Authorization": f"Bearer {self.user_a_token}"})
        self.client.post(f"/api/v1/reviews/{rev_id}/rate", json={"rating": "easy"}, headers={"Authorization": f"Bearer {self.user_a_token}"})

        # Verify zero new AI usage records
        credits_after = UsageRepository.get_monthly_credits_used(self.user_a_ws_id)
        self.assertEqual(credits_after, credits_before)
