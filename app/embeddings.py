import httpx
import math
from typing import List
from app.config import settings
import logging

logger = logging.getLogger(__name__)

async def get_embedding(text: str, provider: str = "ollama") -> List[float]:
    from app.database import get_setting
    
    if provider == "groq" or (provider == "openai" and "groq.com" in settings.openai_base_url.lower()):
        openai_key = get_setting("openai_api_key") or settings.openai_api_key
        if openai_key:
            provider = "openai"
            logger.info(f"{provider} does not support embeddings. Falling back to OpenAI.")
        else:
            provider = "ollama"
            logger.info(f"{provider} does not support embeddings. Falling back to Ollama.")
        
    if provider == "ollama":
        url = f"{settings.ollama_host}/api/embeddings"
        payload = {
            "model": settings.ollama_embedding_model,
            "prompt": text
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=120.0)
            response.raise_for_status()
            data = response.json()
            return data.get("embedding", [])
    elif provider == "gemini":
        api_key = get_setting("gemini_api_key") or settings.gemini_api_key
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key={api_key}"
        payload = {
            "model": "models/gemini-embedding-2",
            "content": {
                "parts": [{"text": text}]
            }
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=30.0)
            response.raise_for_status()
            data = response.json()
            if "embedding" in data and "values" in data["embedding"]:
                return data["embedding"]["values"]
            return []
            
    elif provider == "openai":
        url = f"{settings.openai_base_url}/embeddings"
        api_key = get_setting("openai_api_key") or settings.openai_api_key
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": settings.openai_embedding_model,
            "input": text
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=30.0)
            response.raise_for_status()
            data = response.json()
            if "data" in data and len(data["data"]) > 0:
                return data["data"][0].get("embedding", [])
            return []
            
    raise ValueError(f"Unknown embedding provider: {provider}")


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Computes the cosine similarity between two vectors."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
        
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm_a = math.sqrt(sum(a * a for a in vec1))
    norm_b = math.sqrt(sum(b * b for b in vec2))
    
    if norm_a == 0 or norm_b == 0:
        return 0.0
        
    return dot_product / (norm_a * norm_b)
