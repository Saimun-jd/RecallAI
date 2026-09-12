"""
Base Classes, Data Transfer Objects, and Exceptions for AI Providers in Recall AI.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncGenerator, Dict, List, Optional, Any


@dataclass
class AIMessage:
    role: str  # "system", "user", "assistant"
    content: str

    def to_dict(self) -> Dict[str, str]:
        return {"role": self.role, "content": self.content}


@dataclass
class AIUsageInfo:
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0


@dataclass
class AIResponse:
    content: str
    finish_reason: str = "stop"
    usage: AIUsageInfo = field(default_factory=AIUsageInfo)
    model: str = ""
    provider: str = ""


# ── Normalized Exceptions ─────────────────────────────────────────────

class AIProviderError(Exception):
    """Base exception for all AI provider interactions."""
    def __init__(self, message: str, provider: str = "unknown", status_code: Optional[int] = None):
        super().__init__(f"[{provider.upper()}] {message}")
        self.message = message
        self.provider = provider
        self.status_code = status_code


class ProviderAuthError(AIProviderError):
    """Raised when authentication fails (401/403 or invalid API key)."""
    def __init__(self, message: str = "Invalid API key or authentication rejected", provider: str = "unknown"):
        super().__init__(message, provider=provider, status_code=401)


class ProviderRateLimitError(AIProviderError):
    """Raised when rate limits or quotas are exceeded (429)."""
    def __init__(self, message: str = "Rate limit exceeded or quota exhausted", provider: str = "unknown", retry_after: Optional[int] = None):
        super().__init__(message, provider=provider, status_code=429)
        self.retry_after = retry_after


class ProviderTimeoutError(AIProviderError):
    """Raised when provider request exceeds network or computation deadline."""
    def __init__(self, message: str = "Provider request timed out", provider: str = "unknown"):
        super().__init__(message, provider=provider, status_code=504)


class ProviderUnavailableError(AIProviderError):
    """Raised when provider returns 5xx server errors or connection is refused."""
    def __init__(self, message: str = "Provider service unavailable or unreachable", provider: str = "unknown"):
        super().__init__(message, provider=provider, status_code=503)


class InvalidModelError(AIProviderError):
    """Raised when a requested model does not exist or is deprecated."""
    def __init__(self, message: str = "Requested model is invalid or unavailable", provider: str = "unknown"):
        super().__init__(message, provider=provider, status_code=400)


# ── Base Abstract Adapter ─────────────────────────────────────────────

class BaseAIAdapter(ABC):
    """Abstract interface for all model provider implementations."""

    def __init__(self, model: str, **kwargs: Any):
        self.model = model

    @abstractmethod
    async def generate(
        self,
        messages: List[AIMessage],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs: Any
    ) -> AIResponse:
        """Executes a single conversational completion."""
        pass

    @abstractmethod
    async def generate_stream(
        self,
        messages: List[AIMessage],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        """Streams completion tokens as they are produced."""
        pass
