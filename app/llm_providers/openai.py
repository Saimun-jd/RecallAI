import copy
import json
from typing import Any, Dict

import httpx
from langfuse import get_client

from app.llm_providers.base import BaseLLMProvider
from app.llm_providers.retry import retry_with_backoff
from app.errors import RecallError, ErrorCode, classify_error


def _make_schema_strict(schema: Any) -> Any:
    """
    Recursively walk a JSON schema and enforce what OpenAI/Groq "strict"
    structured-outputs mode requires:
      1. Every object node gets additionalProperties: false
      2. Every object node's "required" list includes ALL of its properties

    Because this recurses into every dict/list value regardless of key name,
    it naturally covers nested $defs/definitions, properties, items (single
    or tuple form), anyOf/oneOf/allOf/not branches, and patternProperties -
    not just the schema root.

    Mutates and returns `schema`. Pass a deep copy if you don't want the
    caller's original schema object mutated (generate() below does this).
    """
    if isinstance(schema, dict):
        schema_type = schema.get("type")
        is_object = (
            schema_type == "object"
            or (isinstance(schema_type, list) and "object" in schema_type)
            or "properties" in schema
        )

        if is_object:
            # Force this even if additionalProperties was already set to True -
            # strict mode rejects anything other than an explicit False.
            schema["additionalProperties"] = False

            properties = schema.get("properties")
            if isinstance(properties, dict):
                # Strict mode requires every property to be listed as
                # required (this means "always present in the JSON", not
                # "always non-null" - genuinely optional fields should be
                # modeled as nullable, e.g. {"type": ["string", "null"]},
                # rather than left out of `required`).
                schema["required"] = list(properties.keys())

        for value in schema.values():
            _make_schema_strict(value)

    elif isinstance(schema, list):
        for item in schema:
            _make_schema_strict(item)

    return schema


class OpenAIProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str, base_url: str = "https://api.openai.com/v1"):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")

    async def generate(
        self,
        prompt: str,
        json_schema: Dict[str, Any] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> str:
        if not self.api_key or not self.api_key.strip():
            raise RecallError(ErrorCode.API_KEY_MISSING, f"No API key configured for OpenAI-compatible provider ({self.base_url}).")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        if json_schema:
            prompt_with_schema = (
                f"{prompt}\n\nIMPORTANT: You must return a valid JSON object. "
                f"Your JSON object must strictly adhere to the following JSON schema. "
                f"Do not return the schema itself, return the data formatted according "
                f"to the schema:\n{json.dumps(json_schema)}"
            )
        else:
            prompt_with_schema = prompt

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt_with_schema}],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if json_schema:
            # Deep-copy so we never mutate the schema object the caller
            # passed in (it's often a Pydantic model schema reused across
            # multiple generate() calls).
            strict_schema = _make_schema_strict(copy.deepcopy(json_schema))
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": "OutputSchema",
                    "schema": strict_schema,
                    "strict": True,
                },
            }

        print(f"🚀 [OpenAIProvider] Sending request to {self.base_url} using model {self.model}")
        print(f"📦 [OpenAIProvider] Prompt length: {len(prompt_with_schema)} characters")

        langfuse = get_client()
        with langfuse.start_as_current_observation(
            as_type="generation",
            name="openai_generation",
            model=self.model,
            input=prompt_with_schema,
        ) as generation:
            async def _send_request():
                async with httpx.AsyncClient(timeout=120.0) as client:
                    resp = await client.post(
                        f"{self.base_url}/chat/completions",
                        headers=headers,
                        json=payload,
                    )
                    resp.raise_for_status()
                    return resp

            try:
                r = await retry_with_backoff(
                    _send_request,
                    max_retries=3,
                    initial_delay=2.0,
                    backoff_factor=2.0,
                    provider_name=f"OpenAIProvider({self.model})",
                )
            except httpx.HTTPStatusError as e:
                r = e.response
                status_code = r.status_code if r else 500
                text = r.text if r else ""
                print(f"response text: {text}")
                generation.update(level="ERROR", status_message=f"HTTP {status_code}: {text}")
                raise classify_error(e, provider_hint="openai")
            except httpx.TimeoutException as e:
                print(f"⏱️ [OpenAIProvider] Request to {self.base_url} timed out: {e}")
                generation.update(level="ERROR", status_message=str(e))
                raise classify_error(e, provider_hint="openai")
            except httpx.RequestError as e:
                print(f"🔌 [OpenAIProvider] Network error calling {self.base_url}: {e}")
                generation.update(level="ERROR", status_message=str(e))
                raise classify_error(e, provider_hint="openai")

            print(f"📥 [OpenAIProvider] Received response with status code: {r.status_code}")
            generation.update(metadata={"status_code": r.status_code})

            try:
                data = r.json()
            except json.JSONDecodeError as e:
                print(f"❌ [OpenAIProvider] Response was not valid JSON: {r.text[:500]}")
                generation.update(level="ERROR", status_message=str(e))
                raise RecallError(ErrorCode.LLM_INVALID_RESPONSE, f"Non-JSON response from {self.base_url}: {r.text[:500]}", e)

            choices = data.get("choices") or []
            if not choices:
                print(f"❌ [OpenAIProvider] Response had no 'choices': {data}")
                err_msg = f"No choices returned from {self.base_url}: {data}"
                generation.update(level="ERROR", status_message=err_msg)
                raise RecallError(ErrorCode.LLM_INVALID_RESPONSE, err_msg)

            # Detect content filtering
            finish_reason = choices[0].get("finish_reason", "")
            if finish_reason == "content_filter":
                err_msg = f"Content filter triggered by {self.base_url}: {data}"
                generation.update(level="ERROR", status_message=err_msg)
                raise RecallError(ErrorCode.LLM_CONTENT_FILTERED, err_msg)

            message = choices[0].get("message") or {}
            content = message.get("content")
            if content is None:
                print(f"❌ [OpenAIProvider] Response had no message content: {data}")
                err_msg = f"No content in response from {self.base_url}: {data}"
                generation.update(level="ERROR", status_message=err_msg)
                raise RecallError(ErrorCode.LLM_INVALID_RESPONSE, err_msg)

            print(f"✅ [OpenAIProvider] Successfully generated {len(content)} characters of content")
            
            # Extract usage if available
            usage = data.get("usage")
            if usage:
                generation.update(
                    output=content,
                    usage={
                        "input": usage.get("prompt_tokens"),
                        "output": usage.get("completion_tokens"),
                        "total": usage.get("total_tokens")
                    }
                )
            else:
                generation.update(output=content)
                
            return content

    async def generate_stream(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 8192,
    ):
        if not self.api_key or not self.api_key.strip():
            raise RecallError(ErrorCode.API_KEY_MISSING, f"No API key configured for {self.base_url}")

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        
        payload = {
            "model": self.model,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }
        
        langfuse = get_client()
        with langfuse.start_as_current_observation(
            as_type="generation",
            name=f"openai_generation_stream_{self.model}",
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
                                raise classify_error(e, provider_hint="openai")
                                
                        full_content = ""
                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                data_str = line[6:]
                                if data_str == "[DONE]":
                                    break
                                try:
                                    data_json = json.loads(data_str)
                                    choices = data_json.get("choices", [])
                                    if choices:
                                        delta = choices[0].get("delta", {})
                                        content = delta.get("content")
                                        if content:
                                            full_content += content
                                            yield content
                                except (KeyError, IndexError, json.JSONDecodeError):
                                    pass
                        generation.update(output=full_content)
            except Exception as e:
                generation.update(level="ERROR", status_message=str(e))
                raise classify_error(e, provider_hint="openai")