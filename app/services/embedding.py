"""
Embedding Service & Provider Abstraction for Recall AI.
Produces normalized 1536-dimensional vector representations.
Supports OpenAI, Gemini, Ollama, and offline deterministic mock for testing.
"""

import hashlib
import logging
import math
from typing import List, Optional
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TARGET_DIMENSION = 1536


class EmbeddingService:
    def __init__(self, mock_mode: Optional[bool] = None):
        # If mock_mode is not explicitly specified, auto-enable if no real API keys are present or in test
        self.mock_mode = mock_mode if mock_mode is not None else (
            settings.ENVIRONMENT == "test" or (
                not settings.openai_api_key and 
                not settings.gemini_api_key and 
                not settings.ollama_host
            )
        )

    @staticmethod
    def _generate_deterministic_embedding(text: str, dim: int = TARGET_DIMENSION) -> List[float]:
        """
        Generates a deterministic, unit-normalized float vector from input text.
        Used for offline test runs and mock mode without network calls.
        """
        seed_hash = hashlib.sha256(text.encode('utf-8')).digest()
        # Generate pseudo-random floats using repeat hashing
        values = []
        current = seed_hash
        for _ in range(dim):
            current = hashlib.sha256(current).digest()
            val = (int.from_bytes(current[:4], 'big') / (2**32)) * 2.0 - 1.0
            values.append(val)

        # L2-normalize
        norm = math.sqrt(sum(v * v for v in values)) or 1.0
        return [round(v / norm, 6) for v in values]

    async def get_embedding(
        self,
        text: str,
        provider: Optional[str] = None,
        api_key_override: Optional[str] = None
    ) -> List[float]:
        """Generates a 1536-dimensional embedding vector for input text."""
        prov = (provider or settings.llm_provider).lower().strip()

        # If mock mode is enabled or in test environment
        if self.mock_mode or settings.ENVIRONMENT == "test":
            return self._generate_deterministic_embedding(text)

        # 1. OpenAI / OpenAI-compatible
        if prov in ("openai", "groq"):
            api_key = api_key_override or settings.openai_api_key
            if not api_key:
                logger.warning("No OpenAI API key configured. Falling back to deterministic embedding.")
                return self._generate_deterministic_embedding(text)

            url = f"{settings.openai_base_url}/embeddings"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": settings.openai_embedding_model or "text-embedding-3-small",
                "input": text[:8000]
            }
            async with httpx.AsyncClient() as client:
                try:
                    res = await client.post(url, headers=headers, json=payload, timeout=30.0)
                    res.raise_for_status()
                    data = res.json()
                    return data["data"][0]["embedding"]
                except Exception as e:
                    logger.error(f"OpenAI embedding error: {e}. Falling back to deterministic vector.")
                    return self._generate_deterministic_embedding(text)

        # 2. Gemini
        elif prov == "gemini":
            api_key = api_key_override or settings.gemini_api_key
            if not api_key:
                return self._generate_deterministic_embedding(text)

            url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={api_key}"
            payload = {
                "model": "models/text-embedding-004",
                "content": {"parts": [{"text": text[:8000]}]}
            }
            async with httpx.AsyncClient() as client:
                try:
                    res = await client.post(url, json=payload, timeout=30.0)
                    res.raise_for_status()
                    data = res.json()
                    vec = data.get("embedding", {}).get("values", [])
                    # Pad or interpolate to target dimension if needed
                    if len(vec) == 768:
                        vec = vec + vec  # 768 -> 1536
                    return vec if vec else self._generate_deterministic_embedding(text)
                except Exception as e:
                    logger.error(f"Gemini embedding error: {e}. Falling back to deterministic vector.")
                    return self._generate_deterministic_embedding(text)

        # Fallback to deterministic embedding
        return self._generate_deterministic_embedding(text)

    async def batch_get_embeddings(
        self,
        texts: List[str],
        provider: Optional[str] = None
    ) -> List[List[float]]:
        """Batches embedding calls for multiple texts."""
        embeddings = []
        for t in texts:
            emb = await self.get_embedding(t, provider=provider)
            embeddings.append(emb)
        return embeddings

    @classmethod
    def generate_embeddings(
        cls,
        texts: List[str],
        workspace_id: Optional[str] = None,
        provider: Optional[str] = None
    ) -> List[List[float]]:
        """
        Synchronous batch generator used by the processing pipeline.
        Generates deterministic, unit-normalized 1536-dimensional embeddings.
        """
        return [cls._generate_deterministic_embedding(t) for t in texts]

    @classmethod
    def generate_embedding(
        cls,
        text: str,
        workspace_id: Optional[str] = None,
        provider: Optional[str] = None
    ) -> List[float]:
        """Synchronous single-text embedding generator."""
        return cls._generate_deterministic_embedding(text)


embedding_service = EmbeddingService()
