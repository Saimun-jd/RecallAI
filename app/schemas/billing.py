"""
Pydantic Schemas for Plans, Subscriptions, Entitlements, and Usage Monetization.
"""

from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class PlanResponse(BaseModel):
    id: str
    name: str
    price_cents: int
    billing_interval: str = "month"
    monthly_credits: int
    max_documents: int
    max_storage_mb: int
    byok_allowed: bool
    features: Dict[str, bool] = Field(default_factory=dict)
    is_active: bool = True


class PlanListResponse(BaseModel):
    plans: List[PlanResponse]
    total: int


class SubscriptionResponse(BaseModel):
    id: str
    workspace_id: str
    plan_id: str
    plan_name: str
    status: str
    provider: str
    current_period_start: str
    current_period_end: str
    cancel_at_period_end: bool = False
    canceled_at: Optional[str] = None


class CheckoutRequest(BaseModel):
    plan_id: str
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


class CancelSubscriptionRequest(BaseModel):
    at_period_end: bool = True
    immediately: Optional[bool] = None

    def should_cancel_immediately(self) -> bool:
        if self.immediately is not None:
            return self.immediately
        return not self.at_period_end


class UsageMetricItem(BaseModel):
    used: Union[int, float]
    limit: Union[int, float]
    remaining: Union[int, float]
    reset_at: Optional[str] = None


class UsageSummaryResponse(BaseModel):
    ai_credits: UsageMetricItem
    documents: UsageMetricItem
    storage_mb: UsageMetricItem


class BYOKStatusResponse(BaseModel):
    enabled: bool
    has_configured_providers: bool
    configured_providers: List[str] = Field(default_factory=list)


class AccountOverviewResponse(BaseModel):
    plan: Dict[str, Any]
    limits: Dict[str, Any]
    subscription: Optional[SubscriptionResponse] = None
    features: Dict[str, bool]
    usage: UsageSummaryResponse
    byok: BYOKStatusResponse


class EntitlementCheckResponse(BaseModel):
    feature: str
    allowed: bool
    limit: Optional[Union[int, float]] = None
    used: Optional[Union[int, float]] = None
    remaining: Optional[Union[int, float]] = None
    reason: Optional[str] = None
