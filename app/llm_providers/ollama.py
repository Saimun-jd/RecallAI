import httpx
from typing import Any, Dict
from langfuse import get_client
from app.llm_providers.base import BaseLLMProvider
from app.errors import RecallError, ErrorCode, classify_error

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
        langfuse = get_client()
        with langfuse.start_as_current_observation(
            as_type="generation",
            name="ollama_generation",
            model=self.model,
            input=prompt,
        ) as generation:
            try:
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
            except httpx.ConnectError as e:
                generation.update(level="ERROR", status_message=str(e))
                raise RecallError(ErrorCode.OLLAMA_UNAVAILABLE, f"Cannot connect to Ollama at {self.host}. Is it running?", e)
            except Exception as e:
                generation.update(level="ERROR", status_message=str(e))
                raise classify_error(e, provider_hint="ollama")
                
            generation.update(metadata={"status_code": r.status_code})
            
            try:
                r.raise_for_status()
            except httpx.HTTPStatusError as e:
                body = r.text[:1000] if r.text else ""
                # Detect model-not-found errors from Ollama
                if "not found" in body.lower() or r.status_code == 404:
                    generation.update(level="ERROR", status_message=f"Model '{self.model}' not found in Ollama")
                    raise RecallError(ErrorCode.LLM_INVALID_RESPONSE, f"Model '{self.model}' not found in Ollama. Pull it first with: ollama pull {self.model}", e)
                generation.update(level="ERROR", status_message=f"HTTP {r.status_code}: {body}")
                raise classify_error(e, provider_hint="ollama")
                
            resp_data = r.json()
            content = resp_data.get("response", "")
            
            # Ollama includes eval_count and prompt_eval_count
            usage = {
                "input": resp_data.get("prompt_eval_count"),
                "output": resp_data.get("eval_count"),
            }
            if usage["input"] is not None and usage["output"] is not None:
                usage["total"] = usage["input"] + usage["output"]
                generation.update(output=content, usage=usage)
            else:
                generation.update(output=content)
                
            return content

    async def generate_stream(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 8192,
    ):
        langfuse = get_client()
        with langfuse.start_as_current_observation(
            as_type="generation",
            name="ollama_generation_stream",
            model=self.model,
            input=prompt,
        ) as generation:
            try:
                import json
                async with httpx.AsyncClient(timeout=120.0) as client:
                    async with client.stream(
                        "POST",
                        f"{self.host}/api/generate",
                        json={
                            "model": self.model,
                            "prompt": prompt,
                            "stream": True,
                            "options": {"temperature": temperature, "num_predict": max_tokens, "num_ctx": 8192},
                        }
                    ) as response:
                        if response.status_code >= 400:
                            await response.aread()
                            generation.update(level="ERROR", status_message=f"HTTP {response.status_code}: {response.text}")
                            try:
                                response.raise_for_status()
                            except httpx.HTTPStatusError as e:
                                raise classify_error(e, provider_hint="ollama")
                                
                        full_content = ""
                        async for line in response.aiter_lines():
                            if line:
                                try:
                                    data = json.loads(line)
                                    chunk = data.get("response")
                                    if chunk:
                                        full_content += chunk
                                        yield chunk
                                except json.JSONDecodeError:
                                    pass
                        generation.update(output=full_content)
            except httpx.ConnectError as e:
                generation.update(level="ERROR", status_message=str(e))
                raise RecallError(ErrorCode.OLLAMA_UNAVAILABLE, f"Cannot connect to Ollama at {self.host}. Is it running?", e)
            except Exception as e:
                generation.update(level="ERROR", status_message=str(e))
                raise classify_error(e, provider_hint="ollama")
