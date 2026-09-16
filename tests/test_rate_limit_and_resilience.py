import pytest
import json
import httpx
from unittest.mock import AsyncMock, patch, MagicMock
from app.llm_providers.retry import retry_with_backoff
from app.errors import classify_error, ErrorCode, RecallError
from app.database import (
    init_db, save_book, get_child_topics, get_topic_by_id, 
    update_topic_enrichment, get_connection
)
from app.schemas import SectionExtraction, AtomicTopic


@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()


@pytest.fixture
def anyio_backend():
    return 'asyncio'


@pytest.mark.anyio
async def test_retry_with_backoff_recovers_on_503():
    """Test that retry_with_backoff automatically retries on HTTP 503 and returns success."""
    attempts = 0

    async def mock_call():
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            req = httpx.Request("POST", "https://api.example.com/generate")
            resp = httpx.Response(
                503,
                request=req,
                json={"error": {"code": 503, "message": "This model is currently experiencing high demand."}}
            )
            raise httpx.HTTPStatusError("503 Service Unavailable", request=req, response=resp)
        return "successful_generation_content"

    result = await retry_with_backoff(
        mock_call,
        max_retries=3,
        initial_delay=0.01,  # fast delay for testing
        backoff_factor=1.5,
        jitter=0.0,
        provider_name="TestGemini"
    )

    assert result == "successful_generation_content"
    assert attempts == 3


@pytest.mark.anyio
async def test_retry_with_backoff_respects_retry_after_header():
    """Test that retry_with_backoff reads Retry-After header on 429."""
    attempts = 0

    async def mock_call():
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            req = httpx.Request("POST", "https://api.example.com/generate")
            resp = httpx.Response(
                429,
                request=req,
                headers={"retry-after": "0.02"},
                text="Rate limited"
            )
            raise httpx.HTTPStatusError("429 Too Many Requests", request=req, response=resp)
        return "success_after_429"

    result = await retry_with_backoff(
        mock_call,
        max_retries=2,
        initial_delay=0.01,
        jitter=0.0,
        provider_name="TestProvider"
    )

    assert result == "success_after_429"
    assert attempts == 2


@pytest.mark.anyio
async def test_retry_with_backoff_fails_fast_on_401():
    """Test that non-retriable client errors (like 401 Unauthorized) fail fast without retrying."""
    attempts = 0

    async def mock_call():
        nonlocal attempts
        attempts += 1
        req = httpx.Request("POST", "https://api.example.com/generate")
        resp = httpx.Response(401, request=req, text="Unauthorized: Invalid API key")
        raise httpx.HTTPStatusError("401 Unauthorized", request=req, response=resp)

    with pytest.raises(httpx.HTTPStatusError):
        await retry_with_backoff(
            mock_call,
            max_retries=3,
            initial_delay=0.01,
            provider_name="TestProvider"
        )

    # Must have failed on the very first attempt without wasting time retrying
    assert attempts == 1


def test_classify_error_gemini_503_high_demand():
    """Verify HTTP 503 with 'high demand' is classified as ErrorCode.LLM_UNAVAILABLE."""
    req = httpx.Request("POST", "https://generativelanguage.googleapis.com")
    resp = httpx.Response(
        503,
        request=req,
        text='{"error": {"code": 503, "message": "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.", "status": "UNAVAILABLE"}}'
    )
    exc = httpx.HTTPStatusError("503 Service Unavailable", request=req, response=resp)

    classified = classify_error(exc, provider_hint="gemini")
    assert isinstance(classified, RecallError)
    assert classified.code == ErrorCode.LLM_UNAVAILABLE
    assert "high demand" in classified.detail.lower()


@pytest.mark.anyio
async def test_hierarchical_cascade_checkpointing_and_smart_resume():
    """
    Test that if child 2 fails in a 2-child chapter:
    1. Child 1 stays 'processed' (checkpointed).
    2. Child 2 resets to 'unprocessed'.
    3. The SSE error event reports progress checkpointed: 1/2 subtopics saved.
    4. On retry, Child 1 is reused from cache (no extra LLM calls) and Child 2 completes.
    """
    import uuid
    from app.main import process_topic_stream, ProcessTopicRequest

    uid = uuid.uuid4().hex[:8]
    book_id = save_book("Resilience Book", f"test_resilience_{uid}.pdf", f"mock_hash_{uid}", 100)

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO topics (book_id, title, level, start_page, end_page, sort_order, topic_hash, status)
            VALUES (?, 'Chapter 1: Foundations', 1, 1, 20, 1, ?, 'unprocessed')
        """, (book_id, f"hash_parent_{uid}"))
        parent_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO topics (book_id, parent_id, title, level, start_page, end_page, sort_order, topic_hash, status)
            VALUES (?, ?, '1.1 Linear Algebra', 2, 1, 10, 1, ?, 'unprocessed')
        """, (book_id, parent_id, f"hash_c1_{uid}"))
        c1_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO topics (book_id, parent_id, title, level, start_page, end_page, sort_order, topic_hash, status)
            VALUES (?, ?, '1.2 Probability Theory', 2, 11, 20, 2, ?, 'unprocessed')
        """, (book_id, parent_id, f"hash_c2_{uid}"))
        c2_id = cursor.lastrowid

    # Simulated chunked extraction
    async def mock_extract_chunked(file_path, start_page, end_page, **kwargs):
        return f"# Heading for p{start_page}-{end_page}\n\nContent for section.", f"cache_{start_page}", start_page

    call_count = 0

    def mock_extract_concepts(heading, text, code_blocks=None, images=None, provider_override=None):
        nonlocal call_count
        call_count += 1
        if "Probability Theory" in heading and call_count == 2:
            # Simulate 503 high demand failure on child 2 during first run
            req = httpx.Request("POST", "https://generativelanguage.googleapis.com")
            resp = httpx.Response(503, request=req, text='{"error": {"message": "This model is currently experiencing high demand."}}')
            raise httpx.HTTPStatusError("503 Service Unavailable", request=req, response=resp)

        return SectionExtraction(
            section_title=heading,
            atomic_topics=[
                AtomicTopic(
                    topic_name=f"Concept for {heading}",
                    concept_type="Definition",
                    summary="Test summary",
                    key_terms=["term1"]
                )
            ]
        )

    # ── RUN 1: Child 1 succeeds, Child 2 fails with 503 ─────────────────────
    with patch("os.path.exists", return_value=True), \
         patch("app.pdf_extract.extract_page_range_chunked", side_effect=mock_extract_chunked), \
         patch("app.main.extract_atomic_concepts", side_effect=mock_extract_concepts):

        req = ProcessTopicRequest(provider_override="test_mock")
        response1 = await process_topic_stream(parent_id, req)

        events1 = []
        async for chunk in response1.body_iterator:
            for line in chunk.split("\n\n"):
                if line.startswith("data: "):
                    events1.append(json.loads(line[6:]))

        # Check that error event was emitted with checkpoint notice
        err_event = next(e for e in events1 if e.get("status") == "error")
        assert "Progress checkpointed: 1/2 subtopics saved" in err_event["message"]
        assert err_event["checkpointed_count"] == 1
        assert err_event["total_children"] == 2

        # Verify DB states after failure:
        # Child 1 MUST still be processed (checkpointed!)
        c1 = get_topic_by_id(c1_id)
        assert c1["status"] == "processed"
        assert c1["content_md"] is not None

        # Child 2 must be reset to unprocessed
        c2 = get_topic_by_id(c2_id)
        assert c2["status"] == "unprocessed"

        # Parent remains unprocessed
        parent = get_topic_by_id(parent_id)
        assert parent["status"] == "unprocessed"

    # ── RUN 2: Re-run process_topic_stream (Smart Resume) ───────────────────
    # In run 2, Child 1 should be skipped from checkpoint, and Child 2 should succeed!
    with patch("os.path.exists", return_value=True), \
         patch("app.pdf_extract.extract_page_range_chunked", side_effect=mock_extract_chunked), \
         patch("app.main.extract_atomic_concepts", side_effect=mock_extract_concepts):

        response2 = await process_topic_stream(parent_id, req)

        events2 = []
        async for chunk in response2.body_iterator:
            for line in chunk.split("\n\n"):
                if line.startswith("data: "):
                    events2.append(json.loads(line[6:]))

        # Verify smart resume message in SSE stream
        reuse_event = next((e for e in events2 if "Reusing checkpointed subtopic" in e.get("message", "")), None)
        assert reuse_event is not None
        assert reuse_event["child_id"] == c1_id

        # Completion event emitted
        complete_event = next(e for e in events2 if e.get("status") == "complete")
        assert complete_event["topic_id"] == parent_id
        assert complete_event["children_processed"] == 2

        # Both children and parent are now processed!
        assert get_topic_by_id(c1_id)["status"] == "processed"
        assert get_topic_by_id(c2_id)["status"] == "processed"
        assert get_topic_by_id(parent_id)["status"] == "processed"
