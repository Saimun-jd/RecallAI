import pytest
import os
import tempfile
from datetime import datetime, timezone, timedelta

@pytest.fixture(autouse=True)
def setup_test_db(monkeypatch):
    fd, path = tempfile.mkstemp()
    os.close(fd)
    
    import app.database
    monkeypatch.setattr(app.database, "DB_PATH", path)
    
    app.database.init_db()
    
    yield path
    
    os.remove(path)

def test_new_card_transitions():
    from app.fsrs import review_card
    
    # New card (state = 0)
    card_data = {"state": 0}
    
    # Rating 3 (Good)
    result = review_card(card_data, 3)
    
    # State should transition from New (0) to Learning (1) or Review (2) 
    assert result["state"] in [1, 2]
    
    # Rating 1 (Again) on New card
    result_again = review_card(card_data, 1)
    assert result_again["state"] in [1, 3] # Learning or Relearning

def test_due_date_future_scheduling():
    from app.fsrs import review_card
    
    card_data = {"state": 0}
    
    result = review_card(card_data, 3) # Good
    
    due_str = result["due"]
    assert due_str is not None
    
    due_dt = datetime.fromisoformat(due_str)
    now = datetime.now(timezone.utc)
    
    # Should be scheduled in the future (at least by a few minutes, usually 10 mins for learning step)
    assert due_dt > now

def test_get_due_flashcards_logic():
    from app.database import get_connection
    from app.main import app
    from fastapi.testclient import TestClient
    
    client = TestClient(app)
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Setup dummy books and topics to satisfy foreign keys
        cursor.execute("INSERT INTO books (title, file_path, file_hash, total_pages) VALUES ('Test', 'test', 'hash', 1)")
        cursor.execute("INSERT INTO topics (book_id, title, level, start_page, end_page, sort_order, topic_hash) VALUES (1, 'Test', 1, 1, 1, 0, 'mock_hash')")
        
        def insert_card(hash_id, due_date_str):
            cursor.execute("""
                INSERT INTO flashcards (
                    topic_id, topic_name, concept_type, summary, 
                    question, answer, key_terms, content_hash, due
                ) VALUES (1, 'Test', 'Concept', 'Sum', 'Q', 'A', '[]', ?, ?)
            """, (hash_id, due_date_str))
            
        now = datetime.now(timezone.utc)
        past = (now - timedelta(days=1)).isoformat()
        future = (now + timedelta(days=1)).isoformat()
        
        insert_card("hash1", None) # NULL due date (New card)
        insert_card("hash2", past) # Past due date
        insert_card("hash3", future) # Future due date
        
    response = client.get("/flashcards/due")
    assert response.status_code == 200
    due_cards = response.json()
    
    # Should return NULL and past, but NOT future
    assert len(due_cards) == 2
    
    due_strs = [c["due"] for c in due_cards]
    assert future not in due_strs
