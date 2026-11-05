import os
import sys
import json
import asyncio
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.llm_providers.gemini import GeminiProvider
from app.llm_providers.openai import OpenAIProvider
from app.llm_providers.groq import GroqProvider
from app.llm_providers.ollama import OllamaProvider
from app.llm_segment import explain_selected_text

def test_gemini_provider_none_schema():
    async def _test():
        provider = GeminiProvider(api_key="test_key")
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_response = MagicMock()
            mock_response.json.return_value = {
                "candidates": [{"content": {"parts": [{"text": "Explained text."}]}}]
            }
            mock_response.status_code = 200
            mock_response.raise_for_status = MagicMock()
            mock_post.return_value = mock_response

            res = await provider.generate(prompt="Explain this passage", json_schema=None)
            assert res == "Explained text."
            
            call_args = mock_post.call_args
            payload = call_args.kwargs["json"]
            
            sent_prompt = payload["contents"][0]["parts"][0]["text"]
            mime_type = payload["generationConfig"].get("responseMimeType")
            print("\nGemini prompt sent:\n", sent_prompt)
            print("Gemini responseMimeType:", mime_type)
            
            assert mime_type != "application/json", "Gemini forced application/json even when json_schema=None"
            assert "IMPORTANT: You must return a valid JSON object" not in sent_prompt, "Gemini appended JSON schema instructions when json_schema=None"
    asyncio.run(_test())

def test_openai_provider_none_schema():
    async def _test():
        provider = OpenAIProvider(api_key="test_key", model="gpt-4o-mini")
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_response = MagicMock()
            mock_response.json.return_value = {
                "choices": [{"message": {"content": "Explained text."}}]
            }
            mock_response.status_code = 200
            mock_response.raise_for_status = MagicMock()
            mock_post.return_value = mock_response

            res = await provider.generate(prompt="Explain this passage", json_schema=None)
            assert res == "Explained text."

            call_args = mock_post.call_args
            payload = call_args.kwargs["json"]
            
            messages = payload["messages"]
            sent_content = messages[0]["content"]
            response_format = payload.get("response_format")
            print("\nOpenAI prompt sent:\n", sent_content)
            print("OpenAI response_format:", response_format)

            assert response_format != {"type": "json_object"}, "OpenAI forced json_object format when json_schema=None"
            assert "IMPORTANT: You must return a valid JSON object" not in sent_content, "OpenAI appended JSON schema instructions when json_schema=None"
    asyncio.run(_test())


def test_missing_api_key_errors():
    from app.errors import RecallError, ErrorCode

    async def _test():
        # Gemini
        gemini = GeminiProvider(api_key="")
        with pytest.raises(RecallError) as exc_info:
            await gemini.generate("hello", json_schema=None)
        assert exc_info.value.code == ErrorCode.API_KEY_MISSING
        assert "Gemini" in exc_info.value.detail
        assert "Settings" in exc_info.value.detail

        # OpenAI
        openai = OpenAIProvider(api_key="", model="gpt-4o-mini")
        with pytest.raises(RecallError) as exc_info:
            await openai.generate("hello", json_schema=None)
        assert exc_info.value.code == ErrorCode.API_KEY_MISSING
        assert "OpenAI" in exc_info.value.detail
        assert "Settings" in exc_info.value.detail

        # Groq
        groq = GroqProvider(api_key="", model="openai/gpt-oss-20b")
        with pytest.raises(RecallError) as exc_info:
            await groq.generate("hello", json_schema=None)
        assert exc_info.value.code == ErrorCode.API_KEY_MISSING
        assert "Groq" in exc_info.value.detail
        assert "Settings" in exc_info.value.detail

    asyncio.run(_test())


def test_classify_and_response_preserves_api_key_message():
    from app.errors import classify_error, error_response, ErrorCode, RecallError
    import json

    # 1. Direct message with "api key"
    raw_err = ValueError("Datalab API Key is missing for Marker PDF extractor. Please configure it in Settings → API Keys.")
    classified = classify_error(raw_err)
    assert classified.code == ErrorCode.API_KEY_MISSING

    res = error_response(raw_err, include_debug=False)
    body = json.loads(res.body)
    assert body["error_code"] == "API_KEY_MISSING"
    assert "Datalab API Key is missing" in body["message"]
    assert "Settings" in body["message"]

    # 2. RecallError with specific detail
    recall_err = RecallError(ErrorCode.API_KEY_MISSING, "No API key configured for Google Gemini. Please add your Gemini API key in Settings → API Keys.")
    res2 = error_response(recall_err, include_debug=False)
    body2 = json.loads(res2.body)
    assert body2["error_code"] == "API_KEY_MISSING"
    assert "Google Gemini" in body2["message"]
