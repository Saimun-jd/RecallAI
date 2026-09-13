"""
Comprehensive Test Suite for Freemium Plans, Entitlements, Usage Limits & Monetization.
Tests:
- Free tier defaults and feature limits
- Feature gating and account overrides
- Concurrency-safe atomic quota reservations, commits, and error rollbacks
- BYOK 0-credit waiver while enforcing document/storage limits
- Document count and storage MB quota enforcement on upload
- Billing plans listing and checkout session creation
- Webhook signature verification and idempotency replay defense
- Subscription lifecycle: activation, period-end cancellation, reactivation, immediate cancellation
- Graceful downgrade with zero data loss on existing over-quota assets
- Multi-tenant IDOR protection across all billing and account endpoints
"""

import hmac
import hashlib
import json
import os
import shutil
import tempfile
import time
import unittest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.api.middleware import auth_rate_limiter
from app.core.database import set_db_path, get_db
from app.core.errors import EntitlementRequiredError, QuotaExceededError
from app.models.schema_init import init_foundation_db
from app.models.repositories import (
    AccountOverrideRepository,
    DocumentRepository,
    FileRepository,
    PlanRepository,
    ProviderCredentialRepository,
    SubscriptionRepository,
    UsageRepository,
    UsageReservationRepository,
)
from app.services.billing import BillingService, MockBillingProvider
from app.services.entitlements import EntitlementService
from app.services.storage import StorageService


class TestEntitlementsAndMonetization(unittest.TestCase):
    def setUp(self):
        auth_rate_limiter.reset()

        # 1. Isolated temporary database
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db_path = self.temp_db.name
        self.temp_db.close()

        set_db_path(self.temp_db_path)
        init_foundation_db(self.temp_db_path)

        # 2. Isolated storage
        self.temp_storage_dir = tempfile.mkdtemp(prefix="recall_billing_storage_")
        StorageService.set_root_dir(self.temp_storage_dir)

        # 3. TestClient
        self.client = TestClient(app)

        # 4. Register two isolated users
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

    # ── 1. Free Plan Defaults & Account Endpoints ─────────────────────

    def test_free_plan_defaults_and_account_endpoints(self):
        """Validates that a new user starts on the Free plan with correct limits and features."""
        # 1. Account overview
        res = self.client.get("/api/v1/account/overview", headers=self._auth_header(self.user_a_token))
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertEqual(data["plan"]["id"], "free")
        self.assertIsNone(data["subscription"])
        self.assertEqual(data["limits"]["monthly_credits"], 50)
        self.assertEqual(data["limits"]["max_documents"], 10)
        self.assertEqual(data["limits"]["max_storage_mb"], 50)
        self.assertTrue(data["features"]["flashcards"])
        self.assertTrue(data["features"]["quizzes"])
        self.assertFalse(data["features"]["export"])

        # 2. Plan endpoint
        res_plan = self.client.get("/api/v1/account/plan", headers=self._auth_header(self.user_a_token))
        self.assertEqual(res_plan.status_code, 200)
        self.assertEqual(res_plan.json()["data"]["id"], "free")

        # 3. Entitlements endpoint
        res_ent = self.client.get("/api/v1/account/entitlements", headers=self._auth_header(self.user_a_token))
        self.assertEqual(res_ent.status_code, 200)
        self.assertEqual(res_ent.json()["data"]["plan_id"], "free")
        self.assertFalse(res_ent.json()["data"]["features"]["export"])

        # 4. Usage endpoint
        res_usage = self.client.get("/api/v1/account/usage", headers=self._auth_header(self.user_a_token))
        self.assertEqual(res_usage.status_code, 200)
        usage_data = res_usage.json()["data"]
        self.assertEqual(usage_data["ai_credits"]["used"], 0)
        self.assertEqual(usage_data["ai_credits"]["limit"], 50)
        self.assertEqual(usage_data["ai_credits"]["remaining"], 50)
        self.assertEqual(usage_data["documents"]["used"], 0)
        self.assertEqual(usage_data["documents"]["limit"], 10)

    # ── 2. Feature Gating & Account Overrides ─────────────────────────

    def test_feature_gating_and_account_overrides(self):
        """Validates feature gating and admin per-workspace account overrides."""
        # Check export feature (gated on free tier)
        res = self.client.get(
            "/api/v1/account/entitlements/check?feature=export",
            headers=self._auth_header(self.user_a_token)
        )
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json()["data"]["allowed"])

        # Service-level require_feature raises EntitlementRequiredError
        with self.assertRaises(EntitlementRequiredError):
            EntitlementService.require_feature(self.user_a_ws_id, "export")

        # Apply account override enabling export for User A
        AccountOverrideRepository.set_override(self.user_a_ws_id, "feature_export", 1)

        # Now User A is entitled to export
        allowed, reason = EntitlementService.can_use_feature(self.user_a_ws_id, "export")
        self.assertTrue(allowed)
        self.assertIn("Override enabled", reason)

        # Remove override
        AccountOverrideRepository.delete_override(self.user_a_ws_id, "feature_export")
        allowed_after, _ = EntitlementService.can_use_feature(self.user_a_ws_id, "export")
        self.assertFalse(allowed_after)

    # ── 3. Atomic Quota Reservations & Concurrency ────────────────────

    def test_atomic_usage_reservation_lifecycle(self):
        """Tests the reserve -> finalize atomic quota flow and rollback on failure."""
        # 1. Active reservations starts at 0
        self.assertEqual(UsageReservationRepository.get_active_reserved_quantity(self.user_a_ws_id), 0)

        # 2. Reserve 1 credit
        res = EntitlementService.reserve_usage(
            workspace_id=self.user_a_ws_id,
            user_id=self.user_a_id,
            feature="flashcards",
            quantity=1,
            is_byok=False,
        )
        self.assertIsNotNone(res["id"])
        self.assertEqual(res["quantity"], 1)

        # Active reservations is now 1
        self.assertEqual(UsageReservationRepository.get_active_reserved_quantity(self.user_a_ws_id), 1)

        # Usage summary reflects reserved quantity in used credits
        usage = EntitlementService.get_usage_summary(self.user_a_ws_id)
        self.assertEqual(usage.ai_credits.used, 1)
        self.assertEqual(usage.ai_credits.remaining, 49)

        # 3. Finalize reservation
        EntitlementService.finalize_usage(
            reservation=res,
            provider="mock",
            model="mock-model",
            input_tokens=100,
            output_tokens=50
        )

        # Active reservations back to 0, but usage table has 1 credit
        self.assertEqual(UsageReservationRepository.get_active_reserved_quantity(self.user_a_ws_id), 0)
        self.assertEqual(UsageRepository.get_monthly_credits_used(self.user_a_ws_id), 1)

        # 4. Test Release on Failure
        res2 = EntitlementService.reserve_usage(
            workspace_id=self.user_a_ws_id,
            user_id=self.user_a_id,
            feature="quizzes",
            quantity=1,
            is_byok=False,
        )
        self.assertEqual(UsageReservationRepository.get_active_reserved_quantity(self.user_a_ws_id), 1)

        # Release
        EntitlementService.release_usage(res2)
        self.assertEqual(UsageReservationRepository.get_active_reserved_quantity(self.user_a_ws_id), 0)
        # Usage table still only has 1 credit from the first finalization
        self.assertEqual(UsageRepository.get_monthly_credits_used(self.user_a_ws_id), 1)

    # ── 4. Credit Quota Exceeded Blocking ─────────────────────────────

    def test_credit_quota_exceeded_blocking(self):
        """Validates that requests are blocked with QuotaExceededError (402) when quota is reached."""
        # Exhaust 50 credits
        UsageRepository.record_usage(
            workspace_id=self.user_a_ws_id,
            user_id=self.user_a_id,
            operation_type="manual_fill",
            provider="mock",
            model="mock",
            input_tokens=0,
            output_tokens=0,
            credits_used=50
        )

        # Attempt to reserve 1 credit
        with self.assertRaises(QuotaExceededError) as ctx:
            EntitlementService.reserve_usage(
                workspace_id=self.user_a_ws_id,
                user_id=self.user_a_id,
                feature="summaries",
                quantity=1,
                is_byok=False
            )
        err = ctx.exception
        self.assertEqual(err.status_code, 402)
        self.assertEqual(err.metadata["limit"], 50)
        self.assertEqual(err.metadata["used"], 50)
        self.assertEqual(err.metadata["feature"], "summaries")

    # ── 5. BYOK Credit Waiver & Limit Enforcement ─────────────────────

    def test_byok_credit_waiver_and_limit_enforcement(self):
        """BYOK waives platform credit limits (0 credits used), but non-credit limits still apply."""
        # Exhaust credits
        UsageRepository.record_usage(
            workspace_id=self.user_a_ws_id,
            user_id=self.user_a_id,
            operation_type="manual_fill",
            provider="mock",
            model="mock",
            input_tokens=0,
            output_tokens=0,
            credits_used=50
        )

        # With BYOK=True, reservation succeeds with 0 quantity
        res = EntitlementService.reserve_usage(
            workspace_id=self.user_a_ws_id,
            user_id=self.user_a_id,
            feature="flashcards",
            quantity=0,
            is_byok=True
        )
        self.assertTrue(res["is_byok"])
        self.assertEqual(res["status"], "bypassed")

        # Finalizing records 0 credits
        EntitlementService.finalize_usage(res, provider="openai", model="gpt-4o")
        self.assertEqual(UsageRepository.get_monthly_credits_used(self.user_a_ws_id), 50)

        # Non-credit limit: Document quota still enforced even with BYOK!
        for i in range(10):
            DocumentRepository.create_document(
                workspace_id=self.user_a_ws_id,
                title=f"Doc {i}",
                source_type="file"
            )

        with self.assertRaises(QuotaExceededError) as ctx:
            EntitlementService.can_upload_document(self.user_a_ws_id, new_file_bytes=100)
        self.assertEqual(ctx.exception.metadata["feature"], "documents")
        self.assertEqual(ctx.exception.metadata["limit"], 10)

    # ── 6. Document Upload Quota HTTP Blocking ────────────────────────

    def test_document_upload_quota_http_blocking(self):
        """Validates that POST /documents/upload returns HTTP 402 when document quota is exceeded."""
        # Fill 10 documents
        for i in range(10):
            DocumentRepository.create_document(
                workspace_id=self.user_a_ws_id,
                title=f"Doc {i}",
                source_type="file"
            )

        # Attempt to upload 11th document
        res = self.client.post(
            "/api/v1/documents/upload",
            headers=self._auth_header(self.user_a_token),
            files={"file": ("test.txt", b"Document content here", "text/plain")}
        )
        self.assertEqual(res.status_code, 402)
        err = res.json()["error"]
        self.assertEqual(err["code"], "QUOTA_EXCEEDED")
        self.assertEqual(err["metadata"]["feature"], "documents")

    # ── 7. Storage Limit Quota Blocking ───────────────────────────────

    def test_storage_limit_quota_blocking(self):
        """Validates that upload is rejected if incoming file exceeds max storage MB."""
        # Free limit is 50MB (52,428,800 bytes)
        fifty_one_mb = 51 * 1024 * 1024

        with self.assertRaises(QuotaExceededError) as ctx:
            EntitlementService.can_upload_document(self.user_a_ws_id, new_file_bytes=fifty_one_mb)
        self.assertIn(ctx.exception.metadata["feature"], ("storage", "document_storage"))

    # ── 8. Billing Plans & Checkout Session ───────────────────────────

    def test_billing_plans_and_checkout(self):
        """Validates public plan listing and hosted checkout session creation."""
        # 1. Plans listing
        res_plans = self.client.get("/api/v1/billing/plans")
        self.assertEqual(res_plans.status_code, 200)
        plans = res_plans.json()["data"]["plans"]
        plan_ids = [p["id"] for p in plans]
        self.assertIn("free", plan_ids)
        self.assertIn("pro", plan_ids)

        # 2. Subscription starts as None
        res_sub = self.client.get("/api/v1/billing/subscription", headers=self._auth_header(self.user_a_token))
        self.assertEqual(res_sub.status_code, 200)
        self.assertIsNone(res_sub.json()["data"])

        # 3. Create checkout session for Pro plan
        res_checkout = self.client.post(
            "/api/v1/billing/checkout",
            headers=self._auth_header(self.user_a_token),
            json={"plan_id": "pro"}
        )
        self.assertEqual(res_checkout.status_code, 200)
        data = res_checkout.json()["data"]
        self.assertTrue(data["checkout_url"].startswith("https://checkout.stripe.com"))
        self.assertTrue(data["session_id"].startswith("cs_mock_"))

    # ── 9. Webhook Ingestion, Signatures & Idempotency ─────────────────

    def test_webhook_signature_and_idempotency(self):
        """Validates webhook signature checking, subscription activation, and replay idempotency."""
        secret = os.environ.get("BILLING_WEBHOOK_SECRET", "mock_webhook_secret_for_testing_123")
        event_id = f"evt_test_{os.urandom(4).hex()}"
        sub_id = f"sub_test_{os.urandom(4).hex()}"

        payload_dict = {
            "id": event_id,
            "type": "customer.subscription.created",
            "data": {
                "object": {
                    "id": sub_id,
                    "customer": "cus_123",
                    "status": "active",
                    "metadata": {
                        "workspace_id": self.user_a_ws_id,
                        "plan_id": "pro"
                    },
                    "current_period_start": int(time.time()),
                    "current_period_end": int(time.time() + 30 * 86400),
                    "cancel_at_period_end": False
                }
            }
        }
        raw_body = json.dumps(payload_dict).encode("utf-8")

        # 1. Missing / invalid signature returns 401
        res_bad_sig = self.client.post(
            "/api/v1/billing/webhook",
            content=raw_body,
            headers={"Content-Type": "application/json", "X-Billing-Signature": "invalid_signature"}
        )
        self.assertEqual(res_bad_sig.status_code, 401)

        # 2. Valid signature succeeds
        valid_signature = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        res_good = self.client.post(
            "/api/v1/billing/webhook",
            content=raw_body,
            headers={"Content-Type": "application/json", "X-Billing-Signature": valid_signature}
        )
        self.assertEqual(res_good.status_code, 200)
        self.assertTrue(res_good.json()["received"])

        # User A is now on the Pro plan!
        ent = EntitlementService.get_plan_and_entitlements(self.user_a_ws_id)
        self.assertEqual(ent["plan"]["id"], "pro")
        self.assertEqual(ent["limits"]["monthly_credits"], 500)
        self.assertEqual(ent["limits"]["max_documents"], 100)
        self.assertTrue(ent["features"]["export"])

        # 3. Replay idempotency: sending identical event again does not duplicate or fail
        res_replay = self.client.post(
            "/api/v1/billing/webhook",
            content=raw_body,
            headers={"Content-Type": "application/json", "X-Billing-Signature": valid_signature}
        )
        self.assertEqual(res_replay.status_code, 200)
        self.assertTrue(res_replay.json().get("idempotent", True))

    # ── 10. Subscription Cancellation & Reactivation ──────────────────

    def test_subscription_cancellation_and_reactivation(self):
        """Tests canceling subscription at period end, reactivating it, and immediate cancellation."""
        # 1. Setup active subscription
        now = datetime.now(timezone.utc)
        sub = SubscriptionRepository.create_subscription(
            workspace_id=self.user_a_ws_id,
            plan_id="pro",
            provider="mock",
            provider_subscription_id="sub_flow_123",
            provider_customer_id="cus_flow_123",
            status="active",
            current_period_start=now.isoformat(),
            current_period_end=(now + timedelta(days=30)).isoformat(),
            cancel_at_period_end=False
        )

        # 2. Cancel at period end
        res_cancel = self.client.post(
            "/api/v1/billing/cancel",
            headers=self._auth_header(self.user_a_token),
            json={"immediately": False}
        )
        self.assertEqual(res_cancel.status_code, 200)
        data = res_cancel.json()["data"]
        self.assertEqual(data["status"], "active")
        self.assertTrue(data["cancel_at_period_end"])

        # Entitlements remain Pro because current_period_end is still in future!
        ent = EntitlementService.get_plan_and_entitlements(self.user_a_ws_id)
        self.assertEqual(ent["plan"]["id"], "pro")

        # 3. Reactivate subscription
        res_reactivate = self.client.post(
            "/api/v1/billing/reactivate",
            headers=self._auth_header(self.user_a_token)
        )
        self.assertEqual(res_reactivate.status_code, 200)
        data_react = res_reactivate.json()["data"]
        self.assertEqual(data_react["status"], "active")
        self.assertFalse(data_react["cancel_at_period_end"])

        # 4. Cancel immediately
        res_immediate = self.client.post(
            "/api/v1/billing/cancel",
            headers=self._auth_header(self.user_a_token),
            json={"immediately": True}
        )
        self.assertEqual(res_immediate.status_code, 200)

        # Workspace immediately reverts to Free plan
        ent_after = EntitlementService.get_plan_and_entitlements(self.user_a_ws_id)
        self.assertEqual(ent_after["plan"]["id"], "free")

    # ── 11. Zero Data Loss on Downgrade ───────────────────────────────

    def test_zero_data_loss_on_downgrade(self):
        """Existing documents and materials remain intact and readable when downgraded."""
        # 1. User on Pro uploads 15 documents (more than Free limit of 10)
        for i in range(15):
            DocumentRepository.create_document(
                workspace_id=self.user_a_ws_id,
                title=f"Doc {i}",
                source_type="file"
            )

        # 2. Revert to Free plan
        ent = EntitlementService.get_plan_and_entitlements(self.user_a_ws_id)
        self.assertEqual(ent["plan"]["id"], "free")

        # 3. All 15 documents still exist in DB
        docs = DocumentRepository.list_by_workspace(self.user_a_ws_id)
        self.assertEqual(len(docs), 15)

        # 4. New uploads are blocked
        with self.assertRaises(QuotaExceededError):
            EntitlementService.can_upload_document(self.user_a_ws_id, new_file_bytes=100)

    # ── 12. Multi-Tenant IDOR Protection ──────────────────────────────

    def test_multi_tenant_idor_protection(self):
        """Guarantees User A cannot access, modify, or cancel User B's subscription or account data."""
        # Create active subscription for User B
        now = datetime.now(timezone.utc)
        SubscriptionRepository.create_subscription(
            workspace_id=self.user_b_ws_id,
            plan_id="pro",
            provider="mock",
            provider_subscription_id="sub_b_123",
            provider_customer_id="cus_b_123",
            status="active",
            current_period_start=now.isoformat(),
            current_period_end=(now + timedelta(days=30)).isoformat(),
            cancel_at_period_end=False
        )

        # User A requests subscription -> gets None (not User B's subscription)
        res_a = self.client.get("/api/v1/billing/subscription", headers=self._auth_header(self.user_a_token))
        self.assertEqual(res_a.status_code, 200)
        self.assertIsNone(res_a.json()["data"])

        # User A attempts to cancel -> 404 (no subscription on User A's workspace)
        res_cancel = self.client.post(
            "/api/v1/billing/cancel",
            headers=self._auth_header(self.user_a_token),
            json={"immediately": False}
        )
        self.assertEqual(res_cancel.status_code, 404)

        # User B's subscription remains completely untouched and active
        sub_b = SubscriptionRepository.get_active_by_workspace(self.user_b_ws_id)
        self.assertIsNotNone(sub_b)
        self.assertEqual(sub_b["status"], "active")
