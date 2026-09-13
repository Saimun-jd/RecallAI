"""
Account & Entitlements API Router.
Provides account overview, active plan details, feature entitlement checks,
and resource usage summaries for the frontend dashboard and settings.
"""

import logging
from typing import Any, Dict
from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_workspace
from app.schemas.billing import (
    AccountOverviewResponse,
    EntitlementCheckResponse,
    PlanResponse,
    UsageSummaryResponse,
)
from app.schemas.common import ResponseEnvelope
from app.services.entitlements import EntitlementService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/account", tags=["Account"])


@router.get("/overview", response_model=ResponseEnvelope[AccountOverviewResponse])
def get_account_overview(
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[AccountOverviewResponse]:
    """
    Returns full account overview: active plan, limits, active subscription,
    feature entitlement flags, resource usage metrics, and BYOK configuration status.
    """
    return ResponseEnvelope(data=EntitlementService.get_account_overview(workspace["id"]))


@router.get("/plan", response_model=ResponseEnvelope[PlanResponse])
def get_current_plan(
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[PlanResponse]:
    """
    Returns the workspace's effective plan (resolving active subscription or default free tier).
    """
    ent = EntitlementService.get_plan_and_entitlements(workspace["id"])
    return ResponseEnvelope(data=PlanResponse.model_validate(ent["plan"]))


@router.get("/entitlements", response_model=ResponseEnvelope[Dict[str, Any]])
def get_all_entitlements(
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[Dict[str, Any]]:
    """
    Returns the map of all feature entitlement flags and resource limits for the workspace.
    """
    ent = EntitlementService.get_plan_and_entitlements(workspace["id"])
    return ResponseEnvelope(data={
        "plan_id": ent["plan"]["id"],
        "plan_name": ent["plan"]["name"],
        "limits": ent["limits"],
        "features": ent["features"],
    })


@router.get("/entitlements/check", response_model=ResponseEnvelope[EntitlementCheckResponse])
def check_feature_entitlement(
    feature: str = Query(..., description="Feature identifier (e.g., flashcards, export, byok)"),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[EntitlementCheckResponse]:
    """
    Checks if the workspace is entitled to use a specific feature.
    """
    allowed, reason = EntitlementService.can_use_feature(workspace["id"], feature)
    ent = EntitlementService.get_plan_and_entitlements(workspace["id"])
    return ResponseEnvelope(data=EntitlementCheckResponse(
        feature=feature,
        allowed=allowed,
        plan_id=ent["plan"]["id"],
        reason=reason,
    ))


@router.get("/usage", response_model=ResponseEnvelope[UsageSummaryResponse])
def get_usage(
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[UsageSummaryResponse]:
    """
    Returns detailed usage breakdown for the current billing cycle:
    AI credits (used, reserved, remaining, reset date), document count, and storage MB.
    """
    return ResponseEnvelope(data=EntitlementService.get_usage_summary(workspace["id"]))
