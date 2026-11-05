import os
import sys
import uuid
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import database
from app.main import app

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    database.init_db()

def test_get_all_notes_and_delete():
    u = uuid.uuid4().hex[:8]
    book_id = database.save_book(f"Notes API Book {u}", f"path_{u}.pdf", f"hash_{u}", 20)
    with database.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO topics (book_id, title, level, sort_order, start_page, end_page, content_md, topic_hash) VALUES (?, ?, 1, 1, 1, 5, 'MD text', ?)",
            (book_id, f"Topic For Notes {u}", f"hash_top_{u}")
        )
        topic_id = cursor.lastrowid

    # Create note
    note_content = f"# Deep Learning Notes {u}\n\n- Key intuition about backpropagation"
    database.save_note_for_topic(topic_id, note_content)

    # 1. Fetch all notes via GET /notes
    res = client.get("/notes")
    assert res.status_code == 200
    notes = res.json()
    assert isinstance(notes, list)
    matching = [n for n in notes if n["topic_id"] == topic_id]
    assert len(matching) == 1
    assert matching[0]["topic_title"] == f"Topic For Notes {u}"
    assert matching[0]["book_title"] == f"Notes API Book {u}"
    assert matching[0]["content"] == note_content

    # 2. Filter by book_id
    res_book = client.get(f"/notes?book_id={book_id}")
    assert res_book.status_code == 200
    book_notes = res_book.json()
    assert len(book_notes) == 1
    assert book_notes[0]["topic_id"] == topic_id

    # 3. Search query
    res_search = client.get(f"/notes?search=backpropagation")
    assert res_search.status_code == 200
    search_notes = res_search.json()
    assert any(n["topic_id"] == topic_id for n in search_notes)

    # 4. Delete note via DELETE /topics/{topic_id}/notes
    res_del = client.delete(f"/topics/{topic_id}/notes")
    assert res_del.status_code == 200
    assert res_del.json()["deleted"] is True

    # 5. Verify note is deleted
    res_after = client.get(f"/topics/{topic_id}/notes")
    assert res_after.status_code == 200
    assert res_after.json()["note"] == ""

def test_get_all_annotations():
    u = uuid.uuid4().hex[:8]
    book_id = database.save_book(f"Annotation Book {u}", f"annot_path_{u}.pdf", f"annot_hash_{u}", 20)
    
    # Save a PDF annotation
    database.save_annotation(
        book_id=book_id,
        page_number=3,
        annotation_type="sidenote",
        selected_text="Important theorem excerpt",
        rect_json='{"x": 10, "y": 20}',
        content=f"Remember this theorem for exam {u}"
    )

    res = client.get(f"/notes/annotations?book_id={book_id}")
    assert res.status_code == 200
    annots = res.json()
    assert len(annots) >= 1
    matching = [a for a in annots if a["book_id"] == book_id]
    assert len(matching) == 1
    assert matching[0]["page_number"] == 3
    assert matching[0]["annotation_type"] == "sidenote"
    assert matching[0]["selected_text"] == "Important theorem excerpt"
    assert f"Remember this theorem for exam {u}" in matching[0]["content"]
