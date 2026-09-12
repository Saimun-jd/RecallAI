"""
Concrete AI Adapters for OpenAI, Gemini, Ollama, and Mock AI for Recall AI.
Implements non-streaming and streaming generation with robust error mapping.
"""

import asyncio
import json
import logging
import re
from typing import Any, AsyncGenerator, Dict, List, Optional
import httpx

from app.services.ai.base import (
    AIMessage,
    AIResponse,
    AIUsageInfo,
    BaseAIAdapter,
    InvalidModelError,
    ProviderAuthError,
    ProviderRateLimitError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)

logger = logging.getLogger(__name__)


# ── Mock AI Adapter (Offline & Deterministic Testing) ─────────────────

class MockAIAdapter(BaseAIAdapter):
    """
    Deterministic mock adapter for zero-network testing and offline development.
    Parses context for `<reference_data id="S{i}">` tags and grounds responses
    with proper citations, or provides informative fallback responses.
    """

    def __init__(self, model: str = "mock-model", provider_name: str = "mock", **kwargs: Any):
        super().__init__(model=model, **kwargs)
        self.provider_name = provider_name

    def _synthesize_response(self, messages: List[AIMessage]) -> str:
        # Check all messages for context and query
        full_text = " ".join([m.content for m in messages])
        user_msg = next((m.content for m in reversed(messages) if m.role == "user"), "")
        if "Student Question:" in user_msg:
            extracted_question = user_msg.split("Student Question:", 1)[1].strip()
        else:
            extracted_question = user_msg.strip()
        
        # Check for prompt injection attempts
        lower_user = user_msg.lower()
        if "ignore previous instructions" in lower_user or "system override" in lower_user or "disregard system" in lower_user:
            return "I am unable to follow instructions that attempt to bypass system security guidelines. How can I assist you with your study materials?"

        # Extract available source IDs from reference_data
        source_matches = re.findall(r'<reference_data\s+id=["\']([^"\']+)["\'](?:\s+document=["\']([^"\']*)["\'])?', full_text)

        # Check if this is a flashcard generation request
        if "flashcard" in full_text.lower():
            if not source_matches:
                return json.dumps({"flashcards": []})
            
            generated_cards = []
            for idx, (src_id, doc_title) in enumerate(source_matches[:10], start=1):
                doc_label = doc_title if doc_title else "Study Material"
                generated_cards.append({
                    "front": f"What is a core principle of {doc_label} (Concept {idx})?",
                    "back": f"According to {doc_label}, this fundamental concept governs key operations in the system.",
                    "source_ids": [src_id]
                })
            if len(generated_cards) == 1:
                first_id = source_matches[0][0]
                doc_label = source_matches[0][1] if source_matches[0][1] else "Study Material"
                generated_cards.append({
                    "front": f"How is the mechanism in {doc_label} applied in practice?",
                    "back": f"The mechanism is applied to optimize performance and ensure structural consistency.",
                    "source_ids": [first_id]
                })
            return json.dumps({"flashcards": generated_cards})
        
        # Check if this is a quiz generation request
        if "quiz" in full_text.lower() or "assessment" in full_text.lower():
            if not source_matches:
                return json.dumps({"questions": []})
            
            generated_questions = []
            for idx, (src_id, doc_title) in enumerate(source_matches[:10], start=1):
                doc_label = doc_title if doc_title else "Study Material"
                generated_questions.append({
                    "type": "multiple_choice",
                    "question": f"Which principle in {doc_label} (Concept {idx}) is primarily responsible for system integrity?",
                    "options": [
                        f"The primary validation protocol defined in {doc_label}.",
                        f"An ungrounded external routine with no dependency.",
                        f"An arbitrary legacy buffer without bounds checking.",
                        f"A transient speculative cache with no parity."
                    ],
                    "correct_answer": "0",
                    "explanation": f"According to [{src_id}], the primary validation protocol in {doc_label} establishes foundational integrity.",
                    "source_ids": [src_id]
                })
                generated_questions.append({
                    "type": "true_false",
                    "question": f"In {doc_label} (Concept {idx}), is the foundational architecture designed for verified consistency?",
                    "options": ["True", "False"],
                    "correct_answer": "true",
                    "explanation": f"According to [{src_id}], verified consistency is directly supported by the source material.",
                    "source_ids": [src_id]
                })
            return json.dumps({"questions": generated_questions})

        if source_matches:


            # Build grounded response citing available sources
            first_src_id = source_matches[0][0]
            doc_name = source_matches[0][1] if source_matches[0][1] else "your study material"
            
            citations = " ".join([f"[{s[0]}]" for s in source_matches[:2]])
            return (
                f"Based on {doc_name} {citations}, here is the key information regarding your query: "
                f"The concepts discussed explain fundamental principles that directly address '{extracted_question[:60]}'. "
                f"According to [{first_src_id}], these findings are essential for mastering the topic."
            )
        else:
            return (
                f"I processed your question regarding '{extracted_question[:60]}'. "
                "However, no relevant document sources were found in your knowledge base for this query. "
                "You may want to upload related study materials or refine your search keywords."
            )


    async def generate(
        self,
        messages: List[AIMessage],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs: Any
    ) -> AIResponse:
        content = self._synthesize_response(messages)
        # Approximate token counts
        in_tokens = sum(len(m.content.split()) for m in messages)
        out_tokens = len(content.split())
        return AIResponse(
            content=content,
            finish_reason="stop",
            usage=AIUsageInfo(
                input_tokens=in_tokens,
                output_tokens=out_tokens,
                total_tokens=in_tokens + out_tokens
            ),
            model=self.model,
            provider=self.provider_name
        )

    async def generate_stream(
        self,
        messages: List[AIMessage],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        full_text = self._synthesize_response(messages)
        words = full_text.split(" ")
        for i, word in enumerate(words):
            chunk = word if i == 0 else f" {word}"
            yield chunk
            await asyncio.sleep(0.005)


# ── OpenAI & OpenAI-Compatible Adapter ────────────────────────────────

class OpenAIAdapter(BaseAIAdapter):
    """
    Adapter for OpenAI, Groq, and any OpenAI-compatible completions endpoint.
    """

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o-mini",
        base_url: str = "https://api.openai.com/v1",
        provider_name: str = "openai",
        timeout: float = 60.0,
        **kwargs: Any
    ):
        super().__init__(model=model, **kwargs)
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.provider_name = provider_name
        self.timeout = timeout

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    def _handle_http_error(self, exc: Exception) -> None:
        if isinstance(exc, httpx.TimeoutException):
            raise ProviderTimeoutError("Request to OpenAI timed out", provider=self.provider_name) from exc
        if isinstance(exc, httpx.ConnectError):
            raise ProviderUnavailableError(f"Could not connect to {self.provider_name} API", provider=self.provider_name) from exc
        if isinstance(exc, httpx.HTTPStatusError):
            status = exc.response.status_code
            if status == 401:
                raise ProviderAuthError("Invalid or expired API key", provider=self.provider_name) from exc
            elif status == 429:
                retry_after = exc.response.headers.get("Retry-After")
                retry_secs = int(retry_after) if retry_after and retry_after.isdigit() else None
                raise ProviderRateLimitError("Rate limit exceeded or quota exhausted", provider=self.provider_name, retry_after=retry_secs) from exc
            elif status in (400, 404):
                raise InvalidModelError(f"Model '{self.model}' is invalid or inaccessible", provider=self.provider_name) from exc
            elif status >= 500:
                raise ProviderUnavailableError(f"{self.provider_name.capitalize()} service returned server error ({status})", provider=self.provider_name) from exc
            else:
                raise ProviderUnavailableError(f"HTTP error {status} from {self.provider_name}", provider=self.provider_name) from exc

    async def generate(
        self,
        messages: List[AIMessage],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs: Any
    ) -> AIResponse:
        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": self.model,
            "messages": [m.to_dict() for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(url, json=payload, headers=self._headers())
                response.raise_for_status()
                data = response.json()
            except Exception as e:
                self._handle_http_error(e)
                raise

        choices = data.get("choices", [])
        if not choices:
            raise ProviderUnavailableError("No response choices returned by provider", provider=self.provider_name)

        content = choices[0].get("message", {}).get("content", "")
        finish_reason = choices[0].get("finish_reason", "stop")
        usage_data = data.get("usage", {})

        return AIResponse(
            content=content,
            finish_reason=finish_reason,
            usage=AIUsageInfo(
                input_tokens=usage_data.get("prompt_tokens", 0),
                output_tokens=usage_data.get("completion_tokens", 0),
                total_tokens=usage_data.get("total_tokens", 0)
            ),
            model=data.get("model", self.model),
            provider=self.provider_name
        )

    async def generate_stream(
        self,
        messages: List[AIMessage],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": self.model,
            "messages": [m.to_dict() for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                async with client.stream("POST", url, json=payload, headers=self._headers()) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk_json = json.loads(data_str)
                            delta = chunk_json.get("choices", [{}])[0].get("delta", {})
                            text_chunk = delta.get("content")
                            if text_chunk:
                                yield text_chunk
                        except json.JSONDecodeError:
                            continue
            except Exception as e:
                self._handle_http_error(e)
                raise


# ── Google Gemini Adapter ─────────────────────────────────────────────

class GeminiAdapter(BaseAIAdapter):
    """
    Adapter for Google Gemini generateContent and streamGenerateContent API.
    """

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-1.5-flash",
        timeout: float = 60.0,
        **kwargs: Any
    ):
        super().__init__(model=model, **kwargs)
        self.api_key = api_key
        self.timeout = timeout
        self.provider_name = "gemini"

    def _build_payload(self, messages: List[AIMessage], temperature: float, max_tokens: int) -> Dict[str, Any]:
        contents: List[Dict[str, Any]] = []
        system_instruction: Optional[Dict[str, Any]] = None

        for m in messages:
            if m.role == "system":
                system_instruction = {"parts": [{"text": m.content}]}
            else:
                role = "user" if m.role == "user" else "model"
                contents.append({
                    "role": role,
                    "parts": [{"text": m.content}]
                })

        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            }
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction
        return payload

    def _handle_http_error(self, exc: Exception) -> None:
        if isinstance(exc, httpx.TimeoutException):
            raise ProviderTimeoutError("Request to Gemini timed out", provider="gemini") from exc
        if isinstance(exc, httpx.ConnectError):
            raise ProviderUnavailableError("Could not connect to Gemini API", provider="gemini") from exc
        if isinstance(exc, httpx.HTTPStatusError):
            status = exc.response.status_code
            if status in (400, 403):
                raise ProviderAuthError("Gemini API key is invalid or unauthorized", provider="gemini") from exc
            elif status == 429:
                raise ProviderRateLimitError("Gemini quota or rate limit exceeded", provider="gemini") from exc
            elif status == 404:
                raise InvalidModelError(f"Gemini model '{self.model}' not found", provider="gemini") from exc
            elif status >= 500:
                raise ProviderUnavailableError(f"Gemini server error ({status})", provider="gemini") from exc
            else:
                raise ProviderUnavailableError(f"HTTP {status} from Gemini", provider="gemini") from exc

    async def generate(
        self,
        messages: List[AIMessage],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs: Any
    ) -> AIResponse:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        payload = self._build_payload(messages, temperature, max_tokens)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
            except Exception as e:
                self._handle_http_error(e)
                raise

        candidates = data.get("candidates", [])
        if not candidates:
            raise ProviderUnavailableError("No candidates returned from Gemini", provider="gemini")

        parts = candidates[0].get("content", {}).get("parts", [])
        content = "".join(p.get("text", "") for p in parts)
        finish_reason = candidates[0].get("finishReason", "stop").lower()

        usage_meta = data.get("usageMetadata", {})
        return AIResponse(
            content=content,
            finish_reason=finish_reason,
            usage=AIUsageInfo(
                input_tokens=usage_meta.get("promptTokenCount", 0),
                output_tokens=usage_meta.get("candidatesTokenCount", 0),
                total_tokens=usage_meta.get("totalTokenCount", 0)
            ),
            model=self.model,
            provider="gemini"
        )

    async def generate_stream(
        self,
        messages: List[AIMessage],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:streamGenerateContent?alt=sse&key={self.api_key}"
        payload = self._build_payload(messages, temperature, max_tokens)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                async with client.stream("POST", url, json=payload) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        try:
                            chunk_json = json.loads(data_str)
                            candidates = chunk_json.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                for p in parts:
                                    text = p.get("text")
                                    if text:
                                        yield text
                        except json.JSONDecodeError:
                            continue
            except Exception as e:
                self._handle_http_error(e)
                raise


# ── Local Ollama Adapter ──────────────────────────────────────────────

class OllamaAdapter(BaseAIAdapter):
    """
    Adapter for local Ollama instances via /api/chat.
    """

    def __init__(
        self,
        host: str = "http://localhost:11434",
        model: str = "gemma2:2b",
        timeout: float = 120.0,
        **kwargs: Any
    ):
        super().__init__(model=model, **kwargs)
        self.host = host.rstrip("/")
        self.timeout = timeout
        self.provider_name = "ollama"

    def _handle_http_error(self, exc: Exception) -> None:
        if isinstance(exc, httpx.TimeoutException):
            raise ProviderTimeoutError(f"Ollama request timed out after {self.timeout}s", provider="ollama") from exc
        if isinstance(exc, httpx.ConnectError):
            raise ProviderUnavailableError(f"Cannot connect to Ollama at {self.host}. Ensure the Ollama daemon is running.", provider="ollama") from exc
        if isinstance(exc, httpx.HTTPStatusError):
            status = exc.response.status_code
            if status == 404:
                raise InvalidModelError(f"Ollama model '{self.model}' is not pulled. Run 'ollama pull {self.model}'", provider="ollama") from exc
            elif status >= 500:
                raise ProviderUnavailableError(f"Ollama server error ({status})", provider="ollama") from exc
            else:
                raise ProviderUnavailableError(f"HTTP {status} from Ollama", provider="ollama") from exc

    async def generate(
        self,
        messages: List[AIMessage],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs: Any
    ) -> AIResponse:
        url = f"{self.host}/api/chat"
        payload = {
            "model": self.model,
            "messages": [m.to_dict() for m in messages],
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            }
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
            except Exception as e:
                self._handle_http_error(e)
                raise

        content = data.get("message", {}).get("content", "")
        prompt_eval_count = data.get("prompt_eval_count", 0)
        eval_count = data.get("eval_count", 0)

        return AIResponse(
            content=content,
            finish_reason="stop",
            usage=AIUsageInfo(
                input_tokens=prompt_eval_count,
                output_tokens=eval_count,
                total_tokens=prompt_eval_count + eval_count
            ),
            model=self.model,
            provider="ollama"
        )

    async def generate_stream(
        self,
        messages: List[AIMessage],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        url = f"{self.host}/api/chat"
        payload = {
            "model": self.model,
            "messages": [m.to_dict() for m in messages],
            "stream": True,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            }
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                async with client.stream("POST", url, json=payload) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            chunk_json = json.loads(line)
                            content = chunk_json.get("message", {}).get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue
            except Exception as e:
                self._handle_http_error(e)
                raise
