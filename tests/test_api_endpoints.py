import pytest
import os
import tempfile
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_test_db(monkeypatch):
    fd, path = tempfile.mkstemp()
    os.close(fd)
    
    import app.database
    monkeypatch.setattr(app.database, "DB_PATH", path)
    
    app.database.init_db()
    
    yield path
    
    os.remove(path)

def test_crud_endpoints_and_cascade():
    from app.database import get_connection
    
    # 1. Insert a book directly
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO books (title, file_path, file_hash, total_pages) VALUES ('Test Book', 'path', 'hash', 100)")
        book_id = cursor.lastrowid
        
        # Insert a topic
        cursor.execute("INSERT INTO topics (book_id, topic_hash, title, level, start_page, end_page, sort_order) VALUES (?, 'thash', 'Test Topic', 1, 1, 1, 1)", (book_id,))
        topic_id = cursor.lastrowid
        
        # Insert a flashcard
        cursor.execute("INSERT INTO flashcards (topic_id, topic_name, concept_type, summary, question, answer, key_terms, content_hash) VALUES (?, 'Test Topic', 'Concept', 'Sum', 'Q1', 'A1', '[]', 'chash')", (topic_id,))
        card_id = cursor.lastrowid
        
        # Insert a review log
        cursor.execute("INSERT INTO review_log (flashcard_id, stability, difficulty, due_date, reps, lapses, state, rating) VALUES (?, 1.0, 1.0, '2026-01-01', 1, 0, 1, 3)", (card_id,))
    
    # Test GET /books
    res = client.get("/books")
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["id"] == book_id
    
    # Test GET /topics
    res = client.get(f"/topics?book_id={book_id}")
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["id"] == topic_id
    
    # Test GET /flashcards/{id}
    res = client.get(f"/flashcards/{card_id}")
    assert res.status_code == 200
    assert res.json()["question"] == "Q1"
    
    # Test PUT /flashcards/{id}
    res = client.put(f"/flashcards/{card_id}", json={"question": "Q2", "answer": "A2"})
    assert res.status_code == 200
    
    # Verify update
    res = client.get(f"/flashcards/{card_id}")
    assert res.json()["question"] == "Q2"
    assert res.json()["answer"] == "A2"
    
    # Test POST /flashcards/{id}/reset
    res = client.post(f"/flashcards/{card_id}/reset")
    assert res.status_code == 200
    
    res = client.get(f"/flashcards/{card_id}")
    assert res.json()["state"] == 0
    assert res.json()["stability"] == 0.0
    
    # Test CASCADE DELETE book
    res = client.delete(f"/books/{book_id}")
    assert res.status_code == 200
    
    # Verify everything was cascaded
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM books")
        assert cursor.fetchone()[0] == 0
        
        cursor.execute("SELECT COUNT(*) FROM topics")
        assert cursor.fetchone()[0] == 0
        
        cursor.execute("SELECT COUNT(*) FROM flashcards")
        assert cursor.fetchone()[0] == 0
        
        cursor.execute("SELECT COUNT(*) FROM review_log")
        assert cursor.fetchone()[0] == 0
