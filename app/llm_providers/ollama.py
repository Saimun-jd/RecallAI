import httpx
from typing import Any, Dict
from app.llm_providers.base import BaseLLMProvider

class OllamaProvider(BaseLLMProvider):
    def __init__(self, host: str, model: str):
        self.host = host
        self.model = model

    async def generate(
        self,
        prompt: str,
        json_schema: Dict[str, Any],
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                f"{self.host}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "format": json_schema,
                    "options": {"temperature": temperature, "num_predict": max_tokens, "num_ctx": 8192},
                },
            )
        r.raise_for_status()
        return r.json()["response"]
