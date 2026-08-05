import httpx
import json
from typing import Any, Dict
from app.llm_providers.base import BaseLLMProvider

class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        self.api_key = api_key

        if not model or ":" in model or "gemini" not in model.lower():
            print(f"[GeminiProvider WARNING] Invalid model '{model}' passed to GeminiProvider. Forcing 'gemini-2.5-flash'.")
            model = "gemini-2.5-flash"

        self.model = model
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    async def generate(
        self,
        prompt: str,
        json_schema: Dict[str, Any],
        temperature: float = 0.1,
        max_tokens: int = 8192,
    ) -> str:
        url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"
        headers = {
            "Content-Type": "application/json"
        }
        
        prompt_with_schema = f"{prompt}\n\nIMPORTANT: You must return a valid JSON object. Your JSON object must strictly adhere to the following JSON schema. Do not return the schema itself, return the data formatted according to the schema:\n{json.dumps(json_schema)}"
        
        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt_with_schema}]
                }
            ],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
                "responseMimeType": "application/json"
            }
        }
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(url, headers=headers, json=payload)
            
        r.raise_for_status()
        
        resp_data = r.json()
        try:
            return resp_data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            raise ValueError(f"Unexpected response format from Gemini: {resp_data}")
        
