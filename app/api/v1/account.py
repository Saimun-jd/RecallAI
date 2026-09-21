"""
Account & Entitlements API Router.
Provides account overview, active plan details, feature entitlement checks,
and resource usage summaries for the frontend dashboard and settings.
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
import httpx

from app.api.deps import get_current_workspace
from app.core.errors import EntitlementRequiredError, NotFoundError, ValidationError
from app.core.security import encrypt_secret, decrypt_secret, mask_key
from app.database import set_setting
from app.models.repositories import ProviderCredentialRepository
from app.schemas.billing import (
    AccountOverviewResponse,
    EntitlementCheckResponse,
    PlanResponse,
    ProviderCredentialResponse,
    SaveCredentialRequest,
    TestProviderRequest,
    TestProviderResponse,
    UsageSummaryResponse,
)
from app.schemas.common import ResponseEnvelope
from app.services.entitlements import EntitlementService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/account", tags=["Account"])


async def _test_provider_key(provider: str, key: str) -> tuple[bool, Optional[str]]:
    provider = provider.lower().strip()
    key = key.strip()
    if not key:
        return False, "API key or host URL cannot be empty."

    try:
        if provider == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
            async with httpx.AsyncClient(timeout=6.0) as client:
                r = await client.get(url)
                if r.status_code == 200:
                    return True, None
                return False, f"Invalid Gemini key (HTTP {r.status_code})"

        elif provider == "openai":
            url = "https://api.openai.com/v1/models"
            headers = {"Authorization": f"Bearer {key}"}
            async with httpx.AsyncClient(timeout=6.0) as client:
                r = await client.get(url, headers=headers)
                if r.status_code == 200:
                    return True, None
                return False, f"Invalid OpenAI key (HTTP {r.status_code})"

        elif provider == "groq":
            url = "https://api.groq.com/openai/v1/models"
            headers = {"Authorization": f"Bearer {key}"}
            async with httpx.AsyncClient(timeout=6.0) as client:
                r = await client.get(url, headers=headers)
                if r.status_code == 200:
                    return True, None
                return False, f"Invalid Groq key (HTTP {r.status_code})"

        elif provider == "ollama":
            url = key.rstrip("/")
            if not url.startswith("http"):
                url = f"http://{url}"
            async with httpx.AsyncClient(timeout=4.0) as client:
                r = await client.get(f"{url}/api/tags")
                if r.status_code == 200:
                    return True, None
                return False, f"Ollama connection failed (HTTP {r.status_code})"

        return True, None
    except Exception as e:
        return False, f"Connection failed: {str(e)}"


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


@router.get("/byok/credentials", response_model=ResponseEnvelope[List[ProviderCredentialResponse]])
def list_byok_credentials(
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[List[ProviderCredentialResponse]]:
    """
    Returns list of configured BYOK credentials for the workspace.
    Plaintext secrets are never returned.
    """
    creds = ProviderCredentialRepository.list_by_workspace(workspace["id"])
    res = [
        ProviderCredentialResponse(
            id=c["id"],
            workspace_id=c["workspace_id"],
            provider=c["provider"],
            key_hint=c["key_hint"],
            is_valid=bool(c.get("is_valid", 1)),
            last_tested_at=c.get("last_tested_at"),
            created_at=c.get("created_at", ""),
        )
        for c in creds
    ]
    return ResponseEnvelope(data=res)


@router.post("/byok/credentials", response_model=ResponseEnvelope[ProviderCredentialResponse])
async def save_byok_credential(
    payload: SaveCredentialRequest,
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[ProviderCredentialResponse]:
    """
    Saves and encrypts a provider API key into the workspace's secure BYOK vault.
    Validates plan entitlement before saving.
    """
    allowed, reason = EntitlementService.can_use_feature(workspace["id"], "byok")
    if not allowed:
        raise EntitlementRequiredError(
            message=reason or "Your current plan does not permit configuring Bring Your Own Key (BYOK) credentials.",
            feature="byok",
        )

    provider = payload.provider.lower().strip()
    if provider not in ("gemini", "openai", "groq", "ollama"):
        raise ValidationError(f"Provider '{provider}' is not supported. Choose gemini, openai, groq, or ollama.")

    cipher_hex, nonce_hex, tag_hex = encrypt_secret(payload.api_key)
    hint = mask_key(payload.api_key) if provider != "ollama" else payload.api_key[:30]

    # Test connection
    is_valid, _ = await _test_provider_key(provider, payload.api_key)

    saved = ProviderCredentialRepository.save_credential(
        workspace_id=workspace["id"],
        user_id=workspace["owner_id"],
        provider=provider,
        encrypted_key=cipher_hex,
        key_nonce=nonce_hex,
        key_tag=tag_hex,
        key_hint=hint,
    )
    if is_valid:
        ProviderCredentialRepository.update_tested_status(workspace["id"], provider, True)

    # Sync to sidecar setting for local operations
    try:
        if provider == "ollama":
            set_setting("ollama_host", payload.api_key)
        else:
            set_setting(f"{provider}_api_key", payload.api_key)
    except Exception:
        pass

    return ResponseEnvelope(
        data=ProviderCredentialResponse(
            id=saved["id"],
            workspace_id=saved["workspace_id"],
            provider=saved["provider"],
            key_hint=saved["key_hint"],
            is_valid=bool(saved.get("is_valid", 1)),
            last_tested_at=saved.get("last_tested_at"),
            created_at=saved.get("created_at", ""),
        )
    )


@router.delete("/byok/credentials/{provider}", response_model=ResponseEnvelope[Dict[str, Any]])
def delete_byok_credential(
    provider: str,
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[Dict[str, Any]]:
    """
    Deletes a BYOK credential from the workspace vault.
    """
    provider = provider.lower().strip()
    deleted = ProviderCredentialRepository.delete_credential(workspace["id"], provider)
    try:
        if provider == "ollama":
            set_setting("ollama_host", "http://localhost:11434")
        else:
            set_setting(f"{provider}_api_key", "")
    except Exception:
        pass

    return ResponseEnvelope(data={"success": True, "provider": provider, "deleted": deleted})


@router.post("/byok/test", response_model=ResponseEnvelope[TestProviderResponse])
async def test_byok_provider(
    payload: TestProviderRequest,
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[TestProviderResponse]:
    """
    Tests connection with an AI provider using either the provided key or the saved workspace credential.
    """
    provider = payload.provider.lower().strip()
    key = payload.api_key

    # If no key provided, look up saved credential in vault
    if not key:
        cred = ProviderCredentialRepository.get_by_workspace_and_provider(workspace["id"], provider)
        if not cred:
            raise NotFoundError(f"No saved credential found for provider '{provider}'. Please enter a key to test.")
        try:
            key = decrypt_secret(
                ciphertext_hex=cred["encrypted_key"],
                nonce_hex=cred["key_nonce"],
                tag_hex=cred["key_tag"],
            )
        except Exception:
            return ResponseEnvelope(data=TestProviderResponse(valid=False, provider=provider, error="Failed to decrypt stored credential."))

    valid, error = await _test_provider_key(provider, key)

    # If testing saved credential, update its status
    if not payload.api_key:
        ProviderCredentialRepository.update_tested_status(workspace["id"], provider, valid)

    return ResponseEnvelope(data=TestProviderResponse(valid=valid, provider=provider, error=error))
