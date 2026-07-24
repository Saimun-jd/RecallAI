import httpx
import math
from typing import List
from app.config import settings
import logging

logger = logging.getLogger(__name__)

async def get_embedding(text: str, provider: str = "openai") -> List[float]:
    """
    Fetches the vector embedding for the given text using the configured provider.
    Returns a list of floats.
    """
    if provider == "openai" and "groq.com" in settings.openai_base_url.lower():
        provider = "ollama"
        logger.info("Groq does not support embeddings. Falling back to Ollama.")
        
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
    
    elif provider == "openai":
        url = f"{settings.openai_base_url}/embeddings"
        headers = {
            "Authorization": f"Bearer {settings.openai_api_key}",
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
