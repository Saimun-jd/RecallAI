"""
AI Provider Abstraction Layer for Recall AI.
Provides uniform adapter interfaces, normalized error handling,
streaming, BYOK credential decryption, and mock fallbacks.
"""

from app.services.ai.base import (
    AIMessage,
    AIResponse,
    AIUsageInfo,
    AIProviderError,
    ProviderAuthError,
    ProviderRateLimitError,
    ProviderTimeoutError,
    ProviderUnavailableError,
    InvalidModelError,
    BaseAIAdapter,
)
from app.services.ai.adapters import (
    MockAIAdapter,
    OpenAIAdapter,
    GeminiAdapter,
    OllamaAdapter,
)
from app.services.ai.service import AIService, ai_service

__all__ = [
    "AIMessage",
    "AIResponse",
    "AIUsageInfo",
    "AIProviderError",
    "ProviderAuthError",
    "ProviderRateLimitError",
    "ProviderTimeoutError",
    "ProviderUnavailableError",
    "InvalidModelError",
    "BaseAIAdapter",
    "MockAIAdapter",
    "OpenAIAdapter",
    "GeminiAdapter",
    "OllamaAdapter",
    "AIService",
    "ai_service",
]
