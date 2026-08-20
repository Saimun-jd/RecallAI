import httpx
from typing import Any, Dict
from langfuse import get_client
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
