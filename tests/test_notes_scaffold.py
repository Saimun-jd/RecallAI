import json
import os
import sys
import uuid
import tempfile
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import database
from app.main import app

client = TestClient(app)

def parse_sse_events(response_text: str) -> list[dict]:
    events = []
    for block in response_text.strip().split("\n\n"):
        for line in block.split("\n"):
            if line.startswith("data: "):
                try:
                    events.append(json.loads(line[6:]))
                except json.JSONDecodeError:
                    pass
    return events

def test_note_append_and_get():
    # Setup test book and topic with unique hash
    u = uuid.uuid4().hex[:8]
    book_id = database.save_book(f"Notes Test Book {u}", "dummy_path.pdf", f"hash_notes_{u}", 10)
    with database.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO topics (book_id, title, level, sort_order, start_page, end_page, content_md, topic_hash) VALUES (?, ?, 1, 1, ?, ?, ?, ?)",
            (book_id, "1.1 Linear Systems", 1, 5, "# Linear Systems\nIntro text...", f"hash_topic_notes_{u}")
        )
        topic_id = cursor.lastrowid

    # 1. Initially note is empty
    res = client.get(f"/topics/{topic_id}/notes")
    assert res.status_code == 200
    assert res.json()["note"] == ""

    # 2. Append first snippet
    res = client.post(f"/topics/{topic_id}/notes/append", json={
        "content": "> A system of linear equations is consistent if it has at least one solution.",
        "section_title": "Source Quote (p. 2)"
    })
    assert res.status_code == 200
    assert "consistent if it has at least one solution" in res.json()["note"]
    assert "### Source Quote (p. 2)" in res.json()["note"]

    # 3. Append Socratic gap
    res = client.post(f"/topics/{topic_id}/notes/append", json={
        "content": "- Confused pivot column with free variable column.",
        "section_title": "⚠️ Exam Pitfalls & Misconceptions"
    })
    assert res.status_code == 200
    final_note = res.json()["note"]
    assert "### ⚠️ Exam Pitfalls & Misconceptions" in final_note
    assert "- Confused pivot column" in final_note

    # 4. Verify GET returns full accumulated note
    res_get = client.get(f"/topics/{topic_id}/notes")
    assert res_get.status_code == 200
    assert res_get.json()["note"] == final_note

def test_note_scaffold():
    u = uuid.uuid4().hex[:8]
    book_id = database.save_book(f"Scaffold Book {u}", "scaffold_path.pdf", f"hash_scaffold_{u}", 10)
    with database.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO topics (book_id, title, level, sort_order, start_page, end_page, content_md, topic_hash) VALUES (?, ?, 1, 1, ?, ?, ?, ?)",
            (book_id, "1.2 Gaussian Elimination", 1, 5, "Sample Gaussian elimination content...", f"hash_topic_scaffold_{u}")
        )
        topic_id = cursor.lastrowid

    mock_provider = AsyncMock()
    mock_provider.generate.return_value = "# 📝 1.2 Gaussian Elimination\n\n## 🎯 Core Invariants\n- Pivot non-zero"

    with patch("app.llm_providers.factory.get_llm_provider", return_value=mock_provider):
        res = client.post(f"/topics/{topic_id}/notes/scaffold", json={})
        assert res.status_code == 200
        data = res.json()
        assert "scaffold" in data
        assert "note" in data
        assert "Core Invariants" in data["scaffold"]
        assert data["scaffold"] == data["note"]

def test_note_scaffold_stream_single_topic():
    u = uuid.uuid4().hex[:8]
    book_id = database.save_book(f"Stream Book {u}", "stream_path.pdf", f"hash_stream_{u}", 10)
    with database.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO topics (book_id, title, level, sort_order, start_page, end_page, content_md, topic_hash) VALUES (?, ?, 1, 1, ?, ?, ?, ?)",
            (book_id, "1.3 Vector Equations", 1, 5, "Content on vectors and linear combinations...", f"hash_topic_stream_{u}")
        )
        topic_id = cursor.lastrowid

    mock_provider = AsyncMock()
    mock_provider.generate.return_value = "# 📝 1.3 Vector Equations\n\n## 🎯 Core Invariants\n- Span of vectors"

    with patch("app.llm_providers.factory.get_llm_provider", return_value=mock_provider):
        res = client.post(f"/topics/{topic_id}/notes/scaffold-stream", json={})
        assert res.status_code == 200
        assert "text/event-stream" in res.headers["content-type"]
        events = parse_sse_events(res.text)
        assert len(events) >= 2
        stages = [e.get("stage") for e in events]
        assert "generating_note" in stages
        assert "complete" in stages
        
        # Verify saved in SQLite
        saved = database.get_note_by_topic(topic_id)
        assert saved is not None
        assert "Span of vectors" in saved

def test_note_scaffold_stream_parent_with_children_and_smart_resume():
    u = uuid.uuid4().hex[:8]
    book_id = database.save_book(f"Parent Book {u}", "parent_path.pdf", f"hash_parent_{u}", 20)
    with database.get_connection() as conn:
        cursor = conn.cursor()
        # Parent Chapter 2
        cursor.execute(
            "INSERT INTO topics (book_id, title, level, sort_order, start_page, end_page, content_md, topic_hash) VALUES (?, ?, 1, 1, ?, ?, ?, ?)",
            (book_id, "Chapter 2: Matrix Algebra", 1, 10, "Chapter overview...", f"hash_parent_{u}")
        )
        parent_id = cursor.lastrowid
        # Child 2.1
        cursor.execute(
            "INSERT INTO topics (book_id, parent_id, title, level, sort_order, start_page, end_page, content_md, topic_hash) VALUES (?, ?, ?, 2, 2, ?, ?, ?, ?)",
            (book_id, parent_id, "2.1 Matrix Operations", 1, 5, "Matrix addition and multiplication...", f"hash_child1_{u}")
        )
        child1_id = cursor.lastrowid
        # Child 2.2
        cursor.execute(
            "INSERT INTO topics (book_id, parent_id, title, level, sort_order, start_page, end_page, content_md, topic_hash) VALUES (?, ?, ?, 2, 3, ?, ?, ?, ?)",
            (book_id, parent_id, "2.2 The Inverse of a Matrix", 6, 10, "Determinants and invertibility...", f"hash_child2_{u}")
        )
        child2_id = cursor.lastrowid

    # 1. First run: generate for both children
    mock_provider = AsyncMock()
    mock_provider.generate.side_effect = [
        "# 📝 2.1 Matrix Operations\n\n## 🎯 Core Invariants\n- $AB \\neq BA$ in general",
        "# 📝 2.2 The Inverse of a Matrix\n\n## 🎯 Core Invariants\n- $\\det(A) \\neq 0$"
    ]

    with patch("app.llm_providers.factory.get_llm_provider", return_value=mock_provider):
        res = client.post(f"/topics/{parent_id}/notes/scaffold-stream", json={})
        assert res.status_code == 200
        events = parse_sse_events(res.text)
        stages = [e.get("stage") for e in events]
        assert "starting" in stages
        assert "generating_child" in stages
        assert "complete" in stages

        # Check each child has its note saved independently in SQLite
        note1 = database.get_note_by_topic(child1_id)
        note2 = database.get_note_by_topic(child2_id)
        assert note1 is not None and "$AB \\neq BA$" in note1
        assert note2 is not None and "\\det(A)" in note2

        # Check parent assembled master guide
        parent_note = database.get_note_by_topic(parent_id)
        assert parent_note is not None
        assert "Chapter 2: Matrix Algebra" in parent_note
        assert "2.1 Matrix Operations" in parent_note
        assert "2.2 The Inverse of a Matrix" in parent_note

    # 2. Second run: Child 1 and Child 2 already have saved notes -> Smart Resume (0 LLM calls needed!)
    mock_provider_empty = AsyncMock()
    with patch("app.llm_providers.factory.get_llm_provider", return_value=mock_provider_empty):
        res_cached = client.post(f"/topics/{parent_id}/notes/scaffold-stream", json={})
        assert res_cached.status_code == 200
        cached_events = parse_sse_events(res_cached.text)
        cached_stages = [e.get("stage") for e in cached_events]
        assert "reusing_child" in cached_stages
        assert "complete" in cached_stages
        # Verify LLM was NOT invoked because both children were already cached
        mock_provider_empty.generate.assert_not_called()

