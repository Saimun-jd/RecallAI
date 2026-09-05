import httpx
import json
from typing import Any, Dict
from langfuse import get_client
from app.llm_providers.base import BaseLLMProvider
from app.errors import RecallError, ErrorCode, classify_error

class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str = "gemini-3.6-flash"):
        self.api_key = api_key

        if not model or ":" in model or "gemini" not in model.lower():
            print(f"[GeminiProvider WARNING] Invalid model '{model}' passed to GeminiProvider. Forcing 'gemini-3.6-flash'.")
            model = "gemini-3.6-flash"

        self.model = model
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    async def generate(
        self,
        prompt: str,
        json_schema: Dict[str, Any],
        temperature: float = 0.1,
        max_tokens: int = 8192,
    ) -> str:
        if not self.api_key or not self.api_key.strip():
            raise RecallError(ErrorCode.API_KEY_MISSING, "No API key configured for Gemini.")

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
                "maxOutputTokens": max_tokens,
                "thinkingConfig": {
                    "thinkingLevel": "low"
                }
            },
            "safetySettings": [
                {
                    "category": "HARM_CATEGORY_HARASSMENT",
                    "threshold": "BLOCK_NONE"
                },
                {
                    "category": "HARM_CATEGORY_HATE_SPEECH",
                    "threshold": "BLOCK_NONE"
                },
                {
                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "threshold": "BLOCK_NONE"
                },
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_NONE"
                }
            ]
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
                raise classify_error(e, provider_hint="gemini")
                
            generation.update(metadata={"status_code": r.status_code})
            
            try:
                r.raise_for_status()
            except httpx.HTTPStatusError as e:
                body = r.text[:2000] if r.text else ""
                # Gemini-specific: detect RESOURCE_EXHAUSTED quota errors
                if "RESOURCE_EXHAUSTED" in body or r.status_code == 429:
                    generation.update(level="ERROR", status_message=f"Quota exceeded: {body}")
                    raise RecallError(ErrorCode.LLM_QUOTA_EXCEEDED, f"Gemini quota exceeded: {body}", e)
                generation.update(level="ERROR", status_message=f"HTTP {r.status_code}: {body}")
                raise classify_error(e, provider_hint="gemini")
            
            resp_data = r.json()
            try:
                parts = resp_data["candidates"][0]["content"]["parts"]
                content = "".join(p["text"] for p in parts if "text" in p)
                
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
                raise RecallError(ErrorCode.LLM_INVALID_RESPONSE, err_msg)

    async def generate_stream(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 8192,
    ):
        if not self.api_key or not self.api_key.strip():
            raise RecallError(ErrorCode.API_KEY_MISSING, "No API key configured for Gemini.")

        url = f"{self.base_url}/models/{self.model}:streamGenerateContent?alt=sse&key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
            ]
        }
        
        langfuse = get_client()
        with langfuse.start_as_current_observation(
            as_type="generation",
            name="gemini_generation_stream",
            model=self.model,
            input=prompt,
        ) as generation:
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    async with client.stream("POST", url, headers=headers, json=payload) as response:
                        if response.status_code >= 400:
                            await response.aread()
                            generation.update(level="ERROR", status_message=f"HTTP {response.status_code}: {response.text}")
                            try:
                                response.raise_for_status()
                            except httpx.HTTPStatusError as e:
                                raise classify_error(e, provider_hint="gemini")
                                
                        full_content = ""
                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                data_str = line[6:]
                                if data_str == "[DONE]":
                                    break
                                try:
                                    data_json = json.loads(data_str)
                                    parts = data_json["candidates"][0]["content"]["parts"]
                                    content = "".join(p["text"] for p in parts if "text" in p)
                                    if content:
                                        full_content += content
                                        yield content
                                except (KeyError, IndexError, json.JSONDecodeError):
                                    pass
                        generation.update(output=full_content)
            except Exception as e:
                generation.update(level="ERROR", status_message=str(e))
                raise classify_error(e, provider_hint="gemini")
