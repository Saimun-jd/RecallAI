import httpx
import json
from typing import Any, Dict
from app.llm_providers.base import BaseLLMProvider

class OpenAIProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str, base_url: str = "https://api.openai.com/v1"):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")

    async def generate(
        self,
        prompt: str,
        json_schema: Dict[str, Any],
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        prompt_with_schema = f"{prompt}\n\nIMPORTANT: You must return a valid JSON object. Your JSON object must strictly adhere to the following JSON schema. Do not return the schema itself, return the data formatted according to the schema:\n{json.dumps(json_schema)}"
        
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt_with_schema}],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": {
                "type": "json_object"
            }
        }
        
        # DEBUG: Save payload to file
        import json as json_mod
        with open("_debug_groq_payload.json", "w", encoding="utf-8") as f:
            f.write(json_mod.dumps(payload, indent=2))
        print(f"DEBUG: Saved payload to _debug_groq_payload.json, size: {len(json_mod.dumps(payload))} bytes")
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload
            )
        r.raise_for_status()
        
        return r.json()["choices"][0]["message"]["content"]
