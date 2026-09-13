"""
Billing & Monetization API Router.
Handles subscription plans, checkout sessions, subscription management (cancel/reactivate),
and billing webhook ingestion with signature verification and event idempotency.
"""

import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from app.api.deps import get_current_user, get_current_workspace
from app.schemas.billing import (
    CancelSubscriptionRequest,
    CheckoutRequest,
    CheckoutResponse,
    PlanListResponse,
    SubscriptionResponse,
)
from app.schemas.common import ResponseEnvelope
from app.services.billing import BillingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.get("/plans", response_model=ResponseEnvelope[PlanListResponse])
def list_plans() -> ResponseEnvelope[PlanListResponse]:
    """
    Returns the list of available subscription plans with limits and feature flags.
    Publicly accessible to allow plan comparison on pricing pages.
    """
    return ResponseEnvelope(data=BillingService.list_plans())


@router.get("/subscription", response_model=ResponseEnvelope[Optional[SubscriptionResponse]])
def get_subscription(
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[Optional[SubscriptionResponse]]:
    """
    Retrieves the active subscription for the authenticated user's workspace.
    Returns null if workspace is on the default free tier.
    """
    return ResponseEnvelope(data=BillingService.get_subscription(workspace["id"]))


@router.post("/checkout", response_model=ResponseEnvelope[CheckoutResponse])
def create_checkout(
    payload: CheckoutRequest,
    workspace: Dict[str, Any] = Depends(get_current_workspace),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ResponseEnvelope[CheckoutResponse]:
    """
    Creates a hosted checkout session to upgrade or subscribe to a paid plan.
    """
    res = BillingService.create_checkout_session(
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        req=payload,
    )
    return ResponseEnvelope(data=res)


@router.post("/cancel", response_model=ResponseEnvelope[SubscriptionResponse])
def cancel_subscription(
    payload: CancelSubscriptionRequest = CancelSubscriptionRequest(),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[SubscriptionResponse]:
    """
    Cancels the active subscription. By default, access continues until the end of the billing period.
    """
    res = BillingService.cancel_subscription(
        workspace_id=workspace["id"],
        req=payload,
    )
    return ResponseEnvelope(data=res)


@router.post("/reactivate", response_model=ResponseEnvelope[SubscriptionResponse])
def reactivate_subscription(
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[SubscriptionResponse]:
    """
    Reactivates a subscription scheduled for cancellation before its period ends.
    """
    res = BillingService.reactivate_subscription(workspace_id=workspace["id"])
    return ResponseEnvelope(data=res)


@router.post("/webhook")
async def billing_webhook(
    request: Request,
    x_billing_signature: Optional[str] = Header(None, alias="X-Billing-Signature"),
    stripe_signature: Optional[str] = Header(None, alias="Stripe-Signature"),
) -> Dict[str, Any]:
    """
    Ingests asynchronous billing webhook notifications (Stripe / Mock).
    Verifies cryptographic signatures and guarantees idempotent processing.
    """
    signature = x_billing_signature or stripe_signature or ""
    raw_body = await request.body()

    return BillingService.handle_webhook(
        raw_payload=raw_body,
        signature_header=signature,
    )
