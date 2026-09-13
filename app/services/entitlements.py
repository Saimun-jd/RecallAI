"""
Centralized Entitlement & Usage Service for Recall AI.
Provides single source of truth for:
- "What is this workspace allowed to do right now?" (Feature access & limits)
- "How much has been used?" (Quotas, storage, credits)
- Concurrency-safe atomic reservations for AI generation
- BYOK capability resolution (0 credits used, but plan feature/storage limits preserved)
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from enum import Enum
import logging
from typing import Any, Dict, List, Optional, Tuple, Union

from app.core.database import get_db
from app.core.errors import EntitlementRequiredError, QuotaExceededError
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
from app.schemas.billing import (
    AccountOverviewResponse,
    BYOKStatusResponse,
    SubscriptionResponse,
    UsageMetricItem,
    UsageSummaryResponse,
)

logger = logging.getLogger(__name__)


class FeatureEnum(str, Enum):
    DOCUMENTS = "documents"
    DOCUMENT_STORAGE = "document_storage"
    AI_CHAT = "ai_chat"
    SEMANTIC_SEARCH = "semantic_search"
    SUMMARIES = "summaries"
    CONCEPTS = "concepts"
    FLASHCARDS = "flashcards"
    QUIZZES = "quizzes"
    REVIEWS = "reviews"
    ANALYTICS = "analytics"
    BYOK = "byok"
    EXPORTS = "exports"


class EntitlementService:
    """
    Centralized entitlement, limit, and atomic reservation manager.
    """

    @classmethod
    def get_period_bounds(cls, workspace_id: str) -> Tuple[str, str]:
        """
        Returns (start_iso, end_iso) for the current active billing or calendar period.
        """
        sub = SubscriptionRepository.get_active_by_workspace(workspace_id)
        if sub and sub.get("current_period_start") and sub.get("current_period_end"):
            return sub["current_period_start"], sub["current_period_end"]

        # Default calendar month window in UTC
        now = datetime.now(timezone.utc)
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if now.month == 12:
            next_month = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            next_month = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)

        return start.strftime('%Y-%m-%dT%H:%M:%SZ'), next_month.strftime('%Y-%m-%dT%H:%M:%SZ')

    @classmethod
    def get_plan_and_entitlements(cls, workspace_id: str) -> Dict[str, Any]:
        """
        Resolves Workspace -> Subscription -> Plan -> Overrides -> Final Entitlements.
        """
        plan = PlanRepository.get_workspace_plan(workspace_id)
        sub = SubscriptionRepository.get_active_by_workspace(workspace_id)
        overrides = AccountOverrideRepository.get_overrides(workspace_id)

        # 1. Base feature flags
        features: Dict[str, bool] = dict(plan.get("features") or {})

        # Ensure all standard features default to True if not explicitly set
        standard_features = [
            FeatureEnum.DOCUMENTS.value,
            FeatureEnum.DOCUMENT_STORAGE.value,
            FeatureEnum.AI_CHAT.value,
            FeatureEnum.SEMANTIC_SEARCH.value,
            FeatureEnum.SUMMARIES.value,
            FeatureEnum.CONCEPTS.value,
            FeatureEnum.FLASHCARDS.value,
            FeatureEnum.QUIZZES.value,
            FeatureEnum.REVIEWS.value,
            FeatureEnum.ANALYTICS.value,
            FeatureEnum.BYOK.value,
        ]
        for sf in standard_features:
            if sf not in features:
                features[sf] = True

        has_export = bool(features.get("exports") or features.get("export") or (plan.get("id") == "pro"))
        features["export"] = has_export
        features["exports"] = has_export

        # 2. Base limits
        limits: Dict[str, Any] = {
            "monthly_credits": plan.get("monthly_credits", 50),
            "max_documents": plan.get("max_documents", 10),
            "max_storage_mb": plan.get("max_storage_mb", 50),
            "byok_allowed": bool(plan.get("byok_allowed", 1)),
        }

        # 3. Apply account-specific overrides
        for key, val in overrides.items():
            if key in limits:
                limits[key] = val
            else:
                clean_key = key.replace("feature_", "")
                features[clean_key] = bool(val)
                if clean_key in ("export", "exports"):
                    features["export"] = bool(val)
                    features["exports"] = bool(val)

        return {
            "plan": plan,
            "subscription": sub,
            "features": features,
            "limits": limits,
        }

    @classmethod
    def can_use_feature(cls, workspace_id: str, feature: Union[FeatureEnum, str]) -> Tuple[bool, str]:
        feat_name = feature.value if isinstance(feature, FeatureEnum) else feature
        synonym = "exports" if feat_name == "export" else ("export" if feat_name == "exports" else feat_name)
        ent = cls.get_plan_and_entitlements(workspace_id)
        features = ent["features"]

        # Check override first
        overrides = AccountOverrideRepository.get_overrides(workspace_id)
        for k in (feat_name, synonym, f"feature_{feat_name}", f"feature_{synonym}"):
            if k in overrides:
                val = bool(overrides[k])
                return (val, "Override enabled" if val else "Override disabled")

        if features.get(feat_name, False) or features.get(synonym, False):
            return (True, "Included in plan")

        return (False, f"Feature '{feat_name}' requires upgrading your plan.")

    @classmethod
    def require_feature(cls, workspace_id: str, feature: Union[FeatureEnum, str]) -> None:
        feat_name = feature.value if isinstance(feature, FeatureEnum) else feature
        allowed, reason = cls.can_use_feature(workspace_id, feat_name)
        if not allowed:
            raise EntitlementRequiredError(
                reason or f"Feature '{feat_name}' is not enabled on your plan. Please upgrade to access.",
                feature=feat_name
            )

    @classmethod
    def can_upload_document(cls, workspace_id: str, new_file_bytes: int = 0) -> None:
        """
        Validates document count and total storage limits.
        Raises QuotaExceededError if limit is reached.
        """
        cls.require_feature(workspace_id, FeatureEnum.DOCUMENTS)
        ent = cls.get_plan_and_entitlements(workspace_id)
        limits = ent["limits"]

        # Check document count
        current_docs = DocumentRepository.count_by_workspace(workspace_id)
        max_docs = limits["max_documents"]
        if current_docs >= max_docs:
            raise QuotaExceededError(
                f"Document limit reached ({current_docs}/{max_docs}). "
                f"Existing documents remain accessible. Please upgrade your plan to upload more.",
                feature="documents",
                limit=max_docs,
                used=current_docs
            )

        # Check total storage limit
        max_storage_mb = limits["max_storage_mb"]
        current_storage_bytes = FileRepository.get_total_storage_bytes(workspace_id)
        if (current_storage_bytes + new_file_bytes) > (max_storage_mb * 1024 * 1024):
            used_mb = round(current_storage_bytes / (1024 * 1024), 2)
            raise QuotaExceededError(
                f"Storage limit reached ({used_mb}MB / {max_storage_mb}MB). "
                f"Please upgrade your plan to upload additional files.",
                feature="document_storage",
                limit=max_storage_mb,
                used=used_mb
            )

    @classmethod
    def get_usage_summary(cls, workspace_id: str) -> UsageSummaryResponse:
        """
        Computes current usage vs limits across all primary dimensions.
        """
        ent = cls.get_plan_and_entitlements(workspace_id)
        limits = ent["limits"]
        start_date, end_date = cls.get_period_bounds(workspace_id)

        # 1. AI Credits
        credit_limit = limits["monthly_credits"]
        credits_used = UsageRepository.get_monthly_credits_used(
            workspace_id,
            start_date=start_date,
            end_date=end_date
        )
        credits_reserved = UsageReservationRepository.get_active_reserved_quantity(workspace_id)
        total_active_credits = credits_used + credits_reserved
        remaining_credits = max(0, credit_limit - total_active_credits)

        # 2. Documents
        doc_limit = limits["max_documents"]
        docs_used = DocumentRepository.count_by_workspace(workspace_id)
        remaining_docs = max(0, doc_limit - docs_used)

        # 3. Storage
        storage_limit_mb = limits["max_storage_mb"]
        storage_bytes = FileRepository.get_total_storage_bytes(workspace_id)
        storage_mb_used = round(storage_bytes / (1024 * 1024), 2)
        remaining_storage_mb = max(0.0, round(storage_limit_mb - storage_mb_used, 2))

        return UsageSummaryResponse(
            ai_credits=UsageMetricItem(
                used=total_active_credits,
                limit=credit_limit,
                remaining=remaining_credits,
                reset_at=end_date
            ),
            documents=UsageMetricItem(
                used=docs_used,
                limit=doc_limit,
                remaining=remaining_docs,
                reset_at=None
            ),
            storage_mb=UsageMetricItem(
                used=storage_mb_used,
                limit=storage_limit_mb,
                remaining=remaining_storage_mb,
                reset_at=None
            )
        )

    @classmethod
    def get_account_overview(cls, workspace_id: str) -> AccountOverviewResponse:
        """
        Returns full frontend-friendly overview of plan, features, usage, and BYOK status.
        """
        ent = cls.get_plan_and_entitlements(workspace_id)
        plan = ent["plan"]
        sub = ent["subscription"]
        features = ent["features"]
        usage = cls.get_usage_summary(workspace_id)

        # BYOK providers configured
        creds = ProviderCredentialRepository.list_by_workspace(workspace_id)
        configured_providers = [c["provider"] for c in creds if c.get("is_valid", 1)]

        sub_resp = None
        if sub:
            sub_resp = SubscriptionResponse(
                id=sub["id"],
                workspace_id=sub["workspace_id"],
                plan_id=sub["plan_id"],
                plan_name=plan.get("name", "Pro Scholar"),
                status=sub["status"],
                provider=sub.get("provider", "stripe"),
                current_period_start=sub["current_period_start"],
                current_period_end=sub["current_period_end"],
                cancel_at_period_end=bool(sub.get("cancel_at_period_end", 0)),
                canceled_at=sub.get("canceled_at")
            )

        return AccountOverviewResponse(
            plan={
                "id": plan.get("id", "free"),
                "name": plan.get("name", "Starter Free"),
                "price_cents": plan.get("price_cents", 0),
                "billing_interval": plan.get("billing_interval", "month"),
            },
            limits=ent["limits"],
            subscription=sub_resp,
            features=features,
            usage=usage,
            byok=BYOKStatusResponse(
                enabled=bool(features.get("byok", True)),
                has_configured_providers=len(configured_providers) > 0,
                configured_providers=configured_providers
            )
        )

    # ── Concurrency-Safe Reservation Lifecycle ─────────────────────────

    @classmethod
    def reserve_usage(
        cls,
        workspace_id: str,
        user_id: str,
        feature: str,
        quantity: int = 1,
        is_byok: bool = False,
        ttl_seconds: int = 300
    ) -> Dict[str, Any]:
        """
        Atomically checks remaining allowance and creates a reservation.
        Prevents race conditions on concurrent generation requests.
        """
        # BYOK does not consume platform AI credits
        if is_byok:
            cls.require_feature(workspace_id, FeatureEnum.BYOK)
            return {
                "id": None,
                "workspace_id": workspace_id,
                "user_id": user_id,
                "feature": feature,
                "quantity": 0,
                "is_byok": True,
                "status": "bypassed"
            }

        # Check feature access
        cls.require_feature(workspace_id, feature)

        # Atomic transaction: clean expired, count used + pending, verify quota, insert reservation
        with get_db() as conn:
            # Clean expired reservations first
            UsageReservationRepository.cleanup_expired(db_conn=conn)

            start_date, end_date = cls.get_period_bounds(workspace_id)
            ent = cls.get_plan_and_entitlements(workspace_id)
            credit_limit = ent["limits"]["monthly_credits"]

            credits_used = UsageRepository.get_monthly_credits_used(
                workspace_id,
                start_date=start_date,
                end_date=end_date,
                db_conn=conn
            )
            credits_reserved = UsageReservationRepository.get_active_reserved_quantity(
                workspace_id,
                db_conn=conn
            )

            total_active = credits_used + credits_reserved
            if total_active + quantity > credit_limit:
                raise QuotaExceededError(
                    f"Monthly AI credit allowance reached ({total_active}/{credit_limit}). "
                    f"Please upgrade your plan or configure your own API key (BYOK) in settings.",
                    feature=feature,
                    limit=credit_limit,
                    used=total_active,
                    reset_at=end_date
                )

            reservation = UsageReservationRepository.create_reservation(
                workspace_id=workspace_id,
                user_id=user_id,
                feature=feature,
                quantity=quantity,
                ttl_seconds=ttl_seconds,
                db_conn=conn
            )
            reservation["is_byok"] = False
            return reservation

    @classmethod
    def finalize_usage(
        cls,
        reservation: Dict[str, Any],
        provider: str = "mock",
        model: str = "mock-model",
        input_tokens: int = 0,
        output_tokens: int = 0
    ) -> None:
        """
        Marks reservation finalized and commits permanent usage record.
        """
        if not reservation:
            return

        workspace_id = reservation["workspace_id"]
        user_id = reservation.get("user_id", "")
        feature = reservation.get("feature", "ai_operation")

        if reservation.get("is_byok"):
            # Record 0-credit audit entry for observability
            UsageRepository.record_usage(
                workspace_id=workspace_id,
                user_id=user_id,
                operation_type=feature,
                provider=provider,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                credits_used=0
            )
            return

        res_id = reservation.get("id")
        if res_id:
            UsageReservationRepository.finalize_reservation(res_id)

        credits_to_record = reservation.get("quantity", 1)
        UsageRepository.record_usage(
            workspace_id=workspace_id,
            user_id=user_id,
            operation_type=feature,
            provider=provider,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            credits_used=credits_to_record
        )

    @classmethod
    def release_usage(cls, reservation: Optional[Dict[str, Any]]) -> None:
        """
        Releases reserved credits on failure.
        """
        if not reservation or reservation.get("is_byok"):
            return
        res_id = reservation.get("id")
        if res_id:
            UsageReservationRepository.release_reservation(res_id)

    @classmethod
    @asynccontextmanager
    async def reserve_ai_credits(
        cls,
        workspace_id: str,
        user_id: str,
        feature: str,
        quantity: int = 1,
        is_byok: bool = False,
        ttl_seconds: int = 300
    ):
        """
        Async context manager managing complete reservation lifecycle:
        1. Reserves credit atomically.
        2. Yields a finalize callable.
        3. Releases reservation on any unhandled exception.
        """
        reservation = cls.reserve_usage(
            workspace_id=workspace_id,
            user_id=user_id,
            feature=feature,
            quantity=quantity,
            is_byok=is_byok,
            ttl_seconds=ttl_seconds
        )
        finalized = False
        try:
            def finalize_callback(
                provider: str = "mock",
                model: str = "mock-model",
                input_tokens: int = 0,
                output_tokens: int = 0
            ) -> None:
                nonlocal finalized
                cls.finalize_usage(
                    reservation,
                    provider=provider,
                    model=model,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens
                )
                finalized = True

            yield finalize_callback
        finally:
            if not finalized:
                cls.release_usage(reservation)
