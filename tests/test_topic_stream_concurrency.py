import pytest
import json
import asyncio
import uuid
from unittest.mock import patch, MagicMock
from app.database import init_db, save_book, get_connection, get_topic_by_id
from app.main import (
    process_topic_stream, ProcessTopicRequest, 
    _active_topic_extractions, get_topic_processing_semaphore
)
from app.schemas import SectionExtraction, AtomicTopic

@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()
    _active_topic_extractions.clear()
    import app.main
    app.main._topic_semaphore = asyncio.Semaphore(2)

@pytest.fixture
def anyio_backend():
    return 'asyncio'

def create_mock_topic(book_id: int, title: str) -> int:
    uid = uuid.uuid4().hex[:8]
    md = f"# {title}\n\nContent for {title}."
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO topics (book_id, title, level, start_page, end_page, sort_order, topic_hash, status, content_md)
            VALUES (?, ?, 1, 1, 5, 1, ?, 'unprocessed', ?)
        """, (book_id, title, f"hash_{uid}", md))
        return cursor.lastrowid

@pytest.mark.anyio
async def test_duplicate_topic_extraction_is_rejected():
    """
    Test that calling process_topic_stream on the exact same topic while
    it is already running returns an SSE event with 'already_processing'.
    """
    book_id = save_book("Test Book", "test_path.pdf", "hash_abc", 100)
    topic_id = create_mock_topic(book_id, "Topic 1")

    # Flag/event to hold execution of run 1
    started_event = asyncio.Event()
    release_event = asyncio.Event()

    def mock_extract(heading, text, code_blocks=None, images=None, provider_override=None):
        return SectionExtraction(
            section_title=heading,
            atomic_topics=[AtomicTopic(topic_name="Concept 1", concept_type="Definition", summary="Sum", key_terms=[])]
        )

    async def run_first():
        with patch("os.path.exists", return_value=True), \
             patch("app.main.extract_atomic_concepts", side_effect=mock_extract):
            req = ProcessTopicRequest()
            res = await process_topic_stream(topic_id, req)
            events = []
            async for chunk in res.body_iterator:
                for line in chunk.split("\n\n"):
                    if line.startswith("data: "):
                        ev = json.loads(line[6:])
                        events.append(ev)
                        if ev.get("stage") == "extracting_topics" and not started_event.is_set():
                            started_event.set()
                            # Wait until test signals release
                            await release_event.wait()
            return events

    task1 = asyncio.create_task(run_first())
    await started_event.wait()

    # While run 1 is active, attempt run 2 for the same topic
    with patch("os.path.exists", return_value=True):
        req2 = ProcessTopicRequest()
        res2 = await process_topic_stream(topic_id, req2)
        events2 = []
        async for chunk in res2.body_iterator:
            for line in chunk.split("\n\n"):
                if line.startswith("data: "):
                    events2.append(json.loads(line[6:]))

    # Release run 1 to finish
    release_event.set()
    events1 = await task1

    # Verify run 2 received 'already_processing'
    assert any(e.get("status") == "already_processing" for e in events2)
    assert topic_id not in _active_topic_extractions

@pytest.mark.anyio
async def test_concurrency_queue_semaphore_limits_parallel_execution():
    """
    Test that when more than 2 topics are processed concurrently, the 3rd topic
    is queued with stage: 'queued' until one of the active slots is freed.
    """
    book_id = save_book("Queue Test Book", "test_queue.pdf", "hash_q", 100)
    topic1 = create_mock_topic(book_id, "Topic 1")
    topic2 = create_mock_topic(book_id, "Topic 2")
    topic3 = create_mock_topic(book_id, "Topic 3")

    gate = asyncio.Event()

    def mock_extract(heading, text, code_blocks=None, images=None, provider_override=None):
        return SectionExtraction(
            section_title=heading,
            atomic_topics=[AtomicTopic(topic_name=f"Concept for {heading}", concept_type="Definition", summary="Sum", key_terms=[])]
        )

    t1_started = asyncio.Event()
    t2_started = asyncio.Event()

    async def run_topic(t_id, signal_started=None, wait_for_gate=False):
        with patch("os.path.exists", return_value=True), \
             patch("app.main.extract_atomic_concepts", side_effect=mock_extract):
            req = ProcessTopicRequest()
            res = await process_topic_stream(t_id, req)
            events = []
            async for chunk in res.body_iterator:
                for line in chunk.split("\n\n"):
                    if line.startswith("data: "):
                        ev = json.loads(line[6:])
                        events.append(ev)
                        if ev.get("stage") == "extracting_topics" and signal_started and not signal_started.is_set():
                            signal_started.set()
                            if wait_for_gate:
                                await gate.wait()
            return events

    # Launch Topic 1 and Topic 2 which will fill the semaphore (capacity=2)
    task1 = asyncio.create_task(run_topic(topic1, signal_started=t1_started, wait_for_gate=True))
    task2 = asyncio.create_task(run_topic(topic2, signal_started=t2_started, wait_for_gate=True))

    await t1_started.wait()
    await t2_started.wait()

    # Semaphore should now be locked
    sem = get_topic_processing_semaphore()
    assert sem.locked()

    # Now launch Topic 3: it should receive a queued event
    task3 = asyncio.create_task(run_topic(topic3))

    # Give task3 time to enter the stream and hit the queue check
    await asyncio.sleep(0.05)

    # Now open gate so topic 1 and topic 2 finish, letting topic 3 proceed
    gate.set()

    events1 = await task1
    events2 = await task2
    events3 = await task3

    assert any(e.get("stage") == "queued" for e in events3)
    assert any(e.get("status") == "complete" for e in events3)
    assert len(_active_topic_extractions) == 0

@pytest.mark.anyio
async def test_cancelled_extraction_cleans_up_active_set_and_semaphore():
    """
    Test that if an async stream is cancelled before completion,
    _active_topic_extractions and the semaphore are properly released.
    """
    book_id = save_book("Cancel Test Book", "test_cancel.pdf", "hash_c", 100)
    topic_id = create_mock_topic(book_id, "Cancel Topic")

    hold_forever = asyncio.Event()

    def mock_extract(heading, text, code_blocks=None, images=None, provider_override=None):
        return SectionExtraction(
            section_title=heading,
            atomic_topics=[]
        )

    started = asyncio.Event()
    res = None

    async def run_cancelled():
        nonlocal res
        with patch("os.path.exists", return_value=True), \
             patch("app.main.extract_atomic_concepts", side_effect=mock_extract):
            req = ProcessTopicRequest()
            res = await process_topic_stream(topic_id, req)
            try:
                async for chunk in res.body_iterator:
                    started.set()
                    await hold_forever.wait()
            finally:
                if res and hasattr(res.body_iterator, "aclose"):
                    await res.body_iterator.aclose()

    task = asyncio.create_task(run_cancelled())
    await started.wait()

    assert topic_id in _active_topic_extractions
    # Cancel the task
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    # Verify topic is removed from active set
    assert topic_id not in _active_topic_extractions
    sem = get_topic_processing_semaphore()
    assert not sem.locked()
