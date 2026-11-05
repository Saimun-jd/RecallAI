import httpx
import json
from typing import Any, Dict
from langfuse import get_client
from app.llm_providers.base import BaseLLMProvider
from app.llm_providers.retry import retry_with_backoff
from app.llm_providers.rate_limiter import rate_limiter, PRIORITY_INTERACTIVE, PRIORITY_BATCH
from app.errors import RecallError, ErrorCode, classify_error

class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str = "gemini-flash-latest"):
        self.api_key = api_key

        if not model or ":" in model or "gemini" not in model.lower():
            print(f"[GeminiProvider WARNING] Invalid model '{model}' passed to GeminiProvider. Forcing 'gemini-flash-latest'.")
            model = "gemini-flash-latest"

        self.model = model
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    async def generate(
        self,
        prompt: str,
        json_schema: Dict[str, Any],
        temperature: float = 0.1,
        max_tokens: int = 8192,
        feature: str = "general",
    ) -> str:
        if not self.api_key or not self.api_key.strip():
            raise RecallError(
                ErrorCode.API_KEY_MISSING,
                "No API key configured for Google Gemini. Please add your Gemini API key in Settings → API Keys."
            )

        # Rate limiter: prioritize interactive user operations over batch ingestion
        priority = PRIORITY_INTERACTIVE if feature in ("chat", "socratic_drill", "flashcards") else PRIORITY_BATCH
        await rate_limiter.acquire("gemini", priority=priority)

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
            async def _send_request():
                async with httpx.AsyncClient(timeout=120.0) as client:
                    resp = await client.post(url, headers=headers, json=payload)
                    resp.raise_for_status()
                    return resp

            try:
                r = await retry_with_backoff(
                    _send_request,
                    max_retries=3,
                    initial_delay=2.0,
                    backoff_factor=2.0,
                    provider_name="Gemini",
                )
            except httpx.HTTPStatusError as e:
                r = e.response
                generation.update(metadata={"status_code": r.status_code if r else 500})
                body = r.text[:2000] if (r and r.text) else ""
                # Gemini-specific: detect RESOURCE_EXHAUSTED quota errors
                if "RESOURCE_EXHAUSTED" in body or (r and r.status_code == 429):
                    # If this is gemini-3.6-flash and it hit quota exhaustion (e.g. 20 RPD daily limit),
                    # attempt auto-fallback to gemini-flash-latest which has 1,500 RPD
                    if self.model != "gemini-flash-latest":
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.warning(
                            f"[GeminiProvider] Quota exceeded for {self.model}. Auto-fallback to gemini-flash-latest."
                        )
                        self.model = "gemini-flash-latest"
                        fallback_url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"
                        try:
                            async with httpx.AsyncClient(timeout=120.0) as client:
                                r = await client.post(fallback_url, headers=headers, json=payload)
                                r.raise_for_status()
                                generation.update(metadata={"status_code": r.status_code, "fallback_model": self.model})
                                e = None
                        except Exception as fb_err:
                            logger.error(f"[GeminiProvider] Fallback to gemini-flash-latest failed: {fb_err}")

                    if e is not None:
                        generation.update(level="ERROR", status_message=f"Rate limit / Quota exceeded: {body}")
                        # Extract server retryDelay if provided (e.g. '55s')
                        try:
                            resp_json = r.json()
                            details = resp_json.get("error", {}).get("details", [])
                            for d in details:
                                if d.get("@type", "").endswith("RetryInfo"):
                                    retry_delay_str = d.get("retryDelay", "")
                                    if retry_delay_str.endswith("s"):
                                        rate_limiter.set_cooldown("gemini", float(retry_delay_str[:-1]))
                                        break
                        except Exception:
                            rate_limiter.set_cooldown("gemini", 60.0)
                        raise RecallError(ErrorCode.LLM_RATE_LIMITED, f"Gemini rate limit / quota exceeded: {body}", e)
                else:
                    generation.update(level="ERROR", status_message=f"HTTP {r.status_code if r else 'unknown'}: {body}")
                    raise classify_error(e, provider_hint="gemini")
            except Exception as e:
                generation.update(level="ERROR", status_message=str(e))
                raise classify_error(e, provider_hint="gemini")
                
            generation.update(metadata={"status_code": r.status_code})
            
            resp_data = r.json()
            try:
                parts = resp_data["candidates"][0]["content"]["parts"]
                content = "".join(p["text"] for p in parts if "text" in p)
                
                usage = resp_data.get("usageMetadata")
                if usage:
                    p_tok = usage.get("promptTokenCount", 0)
                    c_tok = usage.get("candidatesTokenCount", 0)
                    t_tok = usage.get("totalTokenCount", 0)
                    generation.update(
                        output=content,
                        usage={
                            "input": p_tok,
                            "output": c_tok,
                            "total": t_tok
                        }
                    )
                    from app.database import log_token_usage
                    log_token_usage("gemini", self.model, feature, p_tok, c_tok, t_tok)
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
        feature: str = "general",
    ):
        if not self.api_key or not self.api_key.strip():
            raise RecallError(
                ErrorCode.API_KEY_MISSING,
                "No API key configured for Google Gemini. Please add your Gemini API key in Settings → API Keys."
            )

        # Rate limiter: prioritize interactive streaming (e.g. chat) over batch
        priority = PRIORITY_INTERACTIVE if feature in ("chat", "socratic_drill", "flashcards") else PRIORITY_BATCH
        await rate_limiter.acquire("gemini", priority=priority)

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
                            if (response.status_code == 429 or "RESOURCE_EXHAUSTED" in response.text) and self.model != "gemini-flash-latest":
                                import logging
                                logger = logging.getLogger(__name__)
                                logger.warning(f"[GeminiProvider] Quota exceeded for {self.model} in stream. Auto-fallback to gemini-flash-latest.")
                                self.model = "gemini-flash-latest"
                                fallback_url = f"{self.base_url}/models/{self.model}:streamGenerateContent?alt=sse&key={self.api_key}"
                                async with client.stream("POST", fallback_url, headers=headers, json=payload) as fb_resp:
                                    if fb_resp.status_code < 400:
                                        full_content = ""
                                        async for line in fb_resp.aiter_lines():
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
                                                except Exception:
                                                    pass
                                        generation.update(output=full_content)
                                        return
                                    else:
                                        await fb_resp.aread()
                                        rate_limiter.set_cooldown("gemini", 60.0)
                                        fb_resp.raise_for_status()
                            else:
                                if response.status_code == 429 or "RESOURCE_EXHAUSTED" in response.text:
                                    rate_limiter.set_cooldown("gemini", 60.0)
                                try:
                                    response.raise_for_status()
                                except httpx.HTTPStatusError as e:
                                    raise classify_error(e, provider_hint="gemini")
                                
                        full_content = ""
                        stream_usage = None
                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                data_str = line[6:]
                                if data_str == "[DONE]":
                                    break
                                try:
                                    data_json = json.loads(data_str)
                                    if "usageMetadata" in data_json:
                                        stream_usage = data_json["usageMetadata"]
                                    parts = data_json["candidates"][0]["content"]["parts"]
                                    content = "".join(p["text"] for p in parts if "text" in p)
                                    if content:
                                        full_content += content
                                        yield content
                                except (KeyError, IndexError, json.JSONDecodeError):
                                    pass
                        if stream_usage:
                            p_tok = stream_usage.get("promptTokenCount", 0)
                            c_tok = stream_usage.get("candidatesTokenCount", 0)
                            t_tok = stream_usage.get("totalTokenCount", 0)
                            generation.update(
                                output=full_content,
                                usage={"input": p_tok, "output": c_tok, "total": t_tok}
                            )
                            from app.database import log_token_usage
                            log_token_usage("gemini", self.model, feature, p_tok, c_tok, t_tok)
                        else:
                            generation.update(output=full_content)
            except Exception as e:
                generation.update(level="ERROR", status_message=str(e))
                raise classify_error(e, provider_hint="gemini")

