import httpx
import json
from typing import Any, Dict
from langfuse import get_client
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
        
        if json_schema is not None:
            prompt_with_schema = f"{prompt}\n\nIMPORTANT: You must return a valid JSON object. Your JSON object must strictly adhere to the following JSON schema. Do not return the schema itself, return the data formatted according to the schema:\n{json.dumps(json_schema)}"
        else:
            prompt_with_schema = prompt
        
        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt_with_schema}]
                }
            ],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens
            }
        }
        
        if json_schema is not None:
            payload["generationConfig"]["responseMimeType"] = "application/json"

        langfuse = get_client()
        with langfuse.start_as_current_observation(
            as_type="generation",
            name="gemini_generation",
            model=self.model,
            input=prompt_with_schema,
        ) as generation:
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    r = await client.post(url, headers=headers, json=payload)
            except Exception as e:
                generation.update(level="ERROR", status_message=str(e))
                raise
                
            generation.update(metadata={"status_code": r.status_code})
            
            try:
                r.raise_for_status()
            except httpx.HTTPStatusError as e:
                generation.update(level="ERROR", status_message=f"HTTP {r.status_code}: {r.text}")
                raise
            
            resp_data = r.json()
            try:
                content = resp_data["candidates"][0]["content"]["parts"][0]["text"]
                
                usage = resp_data.get("usageMetadata")
                if usage:
                    generation.update(
                        output=content,
                        usage={
                            "input": usage.get("promptTokenCount"),
                            "output": usage.get("candidatesTokenCount"),
                            "total": usage.get("totalTokenCount")
                        }
                    )
                else:
                    generation.update(output=content)
                    
                return content
            except (KeyError, IndexError):
                err_msg = f"Unexpected response format from Gemini: {resp_data}"
                generation.update(level="ERROR", status_message=err_msg)
                raise ValueError(err_msg)
