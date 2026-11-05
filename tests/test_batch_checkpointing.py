import pytest
import json
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from app.database import (
    init_db, save_book, get_topic_by_id, 
    update_topic_enrichment, get_connection
)
from app.main import process_topic_stream, ProcessTopicRequest
from app.schemas import SectionExtraction, AtomicTopic


@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()


@pytest.fixture
def anyio_backend():
    return 'asyncio'


@pytest.mark.anyio
async def test_long_chapter_batch_checkpointing_and_resume():
    """
    Test that a long chapter (>16,000 chars) that fails midway through batches:
    1. Checkpoints completed batch concepts to SQLite before failing.
    2. Reports checkpointed count in the error SSE event.
    3. On resume/retry, reuses completed batch concepts and only calls the LLM for remaining batches.
    """
    import uuid
    uid = uuid.uuid4().hex[:8]
    book_id = save_book("Test ML Textbook", f"test_textbook_{uid}.pdf", f"mock_hash_{uid}", 300)

    # Construct content > 16,000 characters with 3 clear sections
    sec1_text = "Section 1 content discussing foundational mathematics. " * 150  # ~8,400 chars
    sec2_text = "Section 2 content covering backpropagation calculus. " * 150     # ~8,000 chars
    sec3_text = "Section 3 content on optimization algorithms (SGD, Adam). " * 150 # ~8,500 chars
    long_md = f"# Section 1: Foundations\n\n{sec1_text}\n\n# Section 2: Backpropagation\n\n{sec2_text}\n\n# Section 3: Optimizers\n\n{sec3_text}"

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO topics (book_id, title, level, start_page, end_page, sort_order, topic_hash, status, content_md)
            VALUES (?, 'Chapter 2: Neural Network Fundamentals', 1, 30, 60, 2, ?, 'unprocessed', ?)
        """, (book_id, f"hash_chap2_{uid}", long_md))
        topic_id = cursor.lastrowid

    # Simulated LLM extraction calls
    call_headings = []

    def mock_extract_atomic_concepts(heading, text, code_blocks=None, images=None, provider_override=None):
        call_headings.append(heading)
        if "Section 2" in heading:
            # Simulate a 429 rate limit or network failure on Batch 2!
            raise RuntimeError("429 RESOURCE_EXHAUSTED: Rate limit exceeded")
        
        return SectionExtraction(
            section_title=heading,
            atomic_topics=[
                AtomicTopic(
                    topic_name=f"Concept for {heading}",
                    concept_type="Definition",
                    summary=f"Summary of {heading}",
                    key_terms=["ml", "math"]
                )
            ]
        )

    # ── FIRST RUN: Fails at Batch 2 ──────────────────────────────────────────
    with patch("os.path.exists", return_value=True), \
         patch("app.main.extract_atomic_concepts", side_effect=mock_extract_atomic_concepts):
        
        req = ProcessTopicRequest(provider_override="test_mock")
        response = await process_topic_stream(topic_id, req)

        events_run1 = []
        async for chunk in response.body_iterator:
            for line in chunk.split("\n\n"):
                if line.startswith("data: "):
                    events_run1.append(json.loads(line[6:]))

        # Check that error event was emitted with checkpoint information
        error_events = [e for e in events_run1 if e.get("status") == "error"]
        assert len(error_events) == 1
        assert "Progress checkpointed" in error_events[0]["message"]
        assert error_events[0].get("checkpointed_concepts", 0) > 0

        # Check that topic status is 'unprocessed' (ready for user to retry)
        topic_after_fail = get_topic_by_id(topic_id)
        assert topic_after_fail["status"] == "unprocessed"
        
        # CRITICAL ASSERTION: Batch 1 concepts MUST NOT be lost from SQLite!
        saved_concepts_raw = topic_after_fail["atomic_concepts"]
        assert saved_concepts_raw is not None
        saved_concepts = json.loads(saved_concepts_raw)
        assert len(saved_concepts) >= 1
        assert any("Section 1" in c["name"] for c in saved_concepts)

    # ── SECOND RUN: Resuming from Checkpoint ──────────────────────────────────
    call_headings.clear()

    def mock_extract_atomic_concepts_success(heading, text, code_blocks=None, images=None, provider_override=None):
        call_headings.append(heading)
        return SectionExtraction(
            section_title=heading,
            atomic_topics=[
                AtomicTopic(
                    topic_name=f"Concept for {heading}",
                    concept_type="Formula",
                    summary=f"Summary of {heading}",
                    key_terms=["backprop", "gradient"]
                )
            ]
        )

    with patch("os.path.exists", return_value=True), \
         patch("app.main.extract_atomic_concepts", side_effect=mock_extract_atomic_concepts_success):
        
        req = ProcessTopicRequest(provider_override="test_mock")
        response = await process_topic_stream(topic_id, req)

        events_run2 = []
        async for chunk in response.body_iterator:
            for line in chunk.split("\n\n"):
                if line.startswith("data: "):
                    events_run2.append(json.loads(line[6:]))

        # Check that Batch 1 was recognized and reused from checkpoint
        messages = [e.get("message", "") for e in events_run2 if "message" in e]
        assert any("Reusing checkpointed batch 1" in m for m in messages)

        # Batch 1 was reused, so LLM extract_atomic_concepts MUST NOT have been called for Section 1!
        assert not any("Section 1" in h for h in call_headings)
        # LLM MUST have been called for Section 2 and Section 3
        assert any("Section 2" in h for h in call_headings)

        # Final topic in SQLite should now be fully processed with all concepts intact
        final_topic = get_topic_by_id(topic_id)
        assert final_topic["status"] == "processed"
        all_concepts = json.loads(final_topic["atomic_concepts"])
        assert len(all_concepts) >= 3
        assert any("Section 1" in c["name"] for c in all_concepts)
        assert any("Section 2" in c["name"] for c in all_concepts)


@pytest.mark.anyio
async def test_client_cancellation_preserves_concepts():
    """Test that if client disconnects (asyncio.CancelledError), partial progress is saved."""
    import uuid
    uid = uuid.uuid4().hex[:8]
    book_id = save_book("Test Cancel Book", f"test_cancel_{uid}.pdf", f"mock_hash_{uid}", 100)

    sec1_text = "Section A content. " * 500  # ~9,500 chars
    sec2_text = "Section B content. " * 500  # ~9,500 chars
    long_md = f"# Section A\n\n{sec1_text}\n\n# Section B\n\n{sec2_text}"

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO topics (book_id, title, level, start_page, end_page, sort_order, topic_hash, status, content_md)
            VALUES (?, 'Chapter 1: Intro', 1, 1, 20, 1, ?, 'unprocessed', ?)
        """, (book_id, f"hash_cancel_{uid}", long_md))
        topic_id = cursor.lastrowid

    batch_count = 0
    def mock_extract(heading, text, *args, **kwargs):
        nonlocal batch_count
        batch_count += 1
        if batch_count == 2:
            raise asyncio.CancelledError()
        return SectionExtraction(
            section_title=heading,
            atomic_topics=[
                AtomicTopic(topic_name=f"Concept {heading}", concept_type="Definition", summary="s", key_terms=[])
            ]
        )

    with patch("os.path.exists", return_value=True), \
         patch("app.main.extract_atomic_concepts", side_effect=mock_extract):
        
        req = ProcessTopicRequest(provider_override="test_mock")
        with pytest.raises(asyncio.CancelledError):
            response = await process_topic_stream(topic_id, req)
            async for chunk in response.body_iterator:
                pass

        # Check that concepts from Batch 1 were preserved in DB even though cancelled
        t = get_topic_by_id(topic_id)
        assert t["status"] == "unprocessed"
        assert t["atomic_concepts"] is not None
        concepts = json.loads(t["atomic_concepts"])
        assert len(concepts) >= 1
