"""
AI Service Orchestrator for Recall AI.
Resolves provider credentials (BYOK vault first, server settings fallback, mock mode),
initializes the appropriate adapter, and executes generation or streaming.
Guarantees that raw keys are never logged or leaked.
"""

import logging
from typing import Any, AsyncGenerator, Optional, Tuple

from app.core.config import settings
from app.core.security import decrypt_secret
from app.models.repositories import ProviderCredentialRepository
from app.services.ai.adapters import (
    GeminiAdapter,
    MockAIAdapter,
    OllamaAdapter,
    OpenAIAdapter,
)
from app.services.ai.base import (
    AIMessage,
    AIResponse,
    BaseAIAdapter,
)

logger = logging.getLogger(__name__)


class AIService:
    """
    Central AI provider resolver and orchestration service.
    """

    @classmethod
    def resolve_adapter(
        cls,
        workspace_id: str,
        provider_preference: Optional[str] = None
    ) -> Tuple[BaseAIAdapter, str, str, bool]:
        """
        Resolves the appropriate AI adapter for a workspace.
        Returns:
            (adapter, provider_name, model_name, is_byok)
        """
        # 1. Deterministic Mock Mode for automated tests or explicit mock
        if settings.ENVIRONMENT == "test" or provider_preference == "mock":
            return MockAIAdapter(model="mock-test-model", provider_name="mock"), "mock", "mock-test-model", False

        target_provider = (provider_preference or settings.llm_provider or "openai").lower().strip()

        # 2. BYOK Vault Lookup (AES-256-GCM Decryption)
        cred = ProviderCredentialRepository.get_by_workspace_and_provider(
            workspace_id=workspace_id,
            provider=target_provider
        )
        if cred and cred.get("is_valid") and cred.get("encrypted_key"):
            try:
                decrypted_key = decrypt_secret(
                    ciphertext_hex=cred["encrypted_key"],
                    nonce_hex=cred["key_nonce"],
                    tag_hex=cred["key_tag"]
                )
                if target_provider == "openai":
                    adapter = OpenAIAdapter(
                        api_key=decrypted_key,
                        model=settings.openai_model,
                        base_url=settings.openai_base_url,
                        provider_name="openai"
                    )
                    return adapter, "openai", settings.openai_model, True

                elif target_provider == "gemini":
                    adapter = GeminiAdapter(
                        api_key=decrypted_key,
                        model=settings.gemini_model
                    )
                    return adapter, "gemini", settings.gemini_model, True

                elif target_provider == "groq":
                    adapter = OpenAIAdapter(
                        api_key=decrypted_key,
                        model=settings.groq_model,
                        base_url="https://api.groq.com/openai/v1",
                        provider_name="groq"
                    )
                    return adapter, "groq", settings.groq_model, True

            except Exception as e:
                logger.warning(
                    "Failed to decrypt BYOK credential for workspace=%s provider=%s: %s",
                    workspace_id, target_provider, type(e).__name__
                )

        # 3. Server-side Platform Settings Fallback
        if target_provider == "openai" and settings.openai_api_key:
            return (
                OpenAIAdapter(
                    api_key=settings.openai_api_key,
                    model=settings.openai_model,
                    base_url=settings.openai_base_url,
                    provider_name="openai"
                ),
                "openai",
                settings.openai_model,
                False
            )

        if target_provider == "gemini" and settings.gemini_api_key:
            return (
                GeminiAdapter(
                    api_key=settings.gemini_api_key,
                    model=settings.gemini_model
                ),
                "gemini",
                settings.gemini_model,
                False
            )

        if target_provider == "groq" and settings.groq_api_key:
            return (
                OpenAIAdapter(
                    api_key=settings.groq_api_key,
                    model=settings.groq_model,
                    base_url="https://api.groq.com/openai/v1",
                    provider_name="groq"
                ),
                "groq",
                settings.groq_model,
                False
            )

        if target_provider == "ollama":
            return (
                OllamaAdapter(
                    host=settings.ollama_host,
                    model=settings.ollama_model
                ),
                "ollama",
                settings.ollama_model,
                False
            )

        # Check alternative available server keys before falling to mock
        if settings.gemini_api_key:
            return (
                GeminiAdapter(
                    api_key=settings.gemini_api_key,
                    model=settings.gemini_model
                ),
                "gemini",
                settings.gemini_model,
                False
            )

        if settings.openai_api_key:
            return (
                OpenAIAdapter(
                    api_key=settings.openai_api_key,
                    model=settings.openai_model,
                    base_url=settings.openai_base_url,
                    provider_name="openai"
                ),
                "openai",
                settings.openai_model,
                False
            )

        # 4. Safe Mock Fallback (Guarantees local testing works without configured external keys)
        logger.info(
            "No active API keys found for provider=%s in workspace=%s; using mock adapter",
            target_provider, workspace_id
        )
        return MockAIAdapter(model="mock-fallback", provider_name=target_provider), target_provider, "mock-fallback", False

    @classmethod
    async def generate(
        cls,
        workspace_id: str,
        messages: list[AIMessage],
        provider_preference: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs: Any
    ) -> Tuple[AIResponse, str, str, bool]:
        """
        Resolves adapter and executes completion.
        Returns:
            (response, provider_name, model_name, is_byok)
        """
        adapter, provider_name, model_name, is_byok = cls.resolve_adapter(
            workspace_id=workspace_id,
            provider_preference=provider_preference
        )
        resp = await adapter.generate(messages, temperature=temperature, max_tokens=max_tokens, **kwargs)
        return resp, provider_name, model_name, is_byok

    @classmethod
    def generate_stream(
        cls,
        workspace_id: str,
        messages: list[AIMessage],
        provider_preference: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs: Any
    ) -> Tuple[AsyncGenerator[str, None], str, str, bool]:
        """
        Resolves adapter and returns streaming token generator.
        Returns:
            (token_stream, provider_name, model_name, is_byok)
        """
        adapter, provider_name, model_name, is_byok = cls.resolve_adapter(
            workspace_id=workspace_id,
            provider_preference=provider_preference
        )
        stream = adapter.generate_stream(messages, temperature=temperature, max_tokens=max_tokens, **kwargs)
        return stream, provider_name, model_name, is_byok


ai_service = AIService()
