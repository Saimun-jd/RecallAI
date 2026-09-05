from abc import ABC, abstractmethod
from typing import Any, Dict

class BaseLLMProvider(ABC):
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        json_schema: Dict[str, Any],
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> str:
        """Sends prompt and json schema, returning a raw JSON string response."""
        pass

    @abstractmethod
    async def generate_stream(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 8192,
    ):
        """Yields chunks of string."""
        pass
