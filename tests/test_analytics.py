import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_connection, init_db
import datetime

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM flashcards")
        cursor.execute("DELETE FROM topics")
        cursor.execute("DELETE FROM books")
        conn.commit()

def test_analytics_empty_db():
    response = client.get("/analytics/stats")
    assert response.status_code == 200
    data = response.json()
    
    assert data["totals"]["books"] == 0
    assert data["totals"]["topics"] == 0
    assert data["totals"]["flashcards"] == 0
    assert data["totals"]["total_reviews"] == 0
    
    assert data["queue"]["new"] == 0
    assert data["queue"]["learning"] == 0
    assert data["queue"]["review"] == 0
    assert data["queue"]["due_now"] == 0
    
    assert data["fsrs_metrics"]["average_stability_days"] == 0.0
    assert data["fsrs_metrics"]["average_difficulty"] == 0.0
    
    assert len(data["forecast_7d"]) == 7

def test_analytics_with_data():
    with get_connection() as conn:
        cursor = conn.cursor()
        # insert book
        cursor.execute("INSERT INTO books (title, file_hash, file_path, total_pages) VALUES (?, ?, ?, ?)", ("Book 1", "hash1", "path/to/book", 100))
        book_id = cursor.lastrowid
        
        # insert topics
        cursor.execute("INSERT INTO topics (book_id, topic_hash, title, level, start_page, end_page, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)", (book_id, "hashA", "Topic A", 1, 1, 2, 1))
        topic_id = cursor.lastrowid
        cursor.execute("INSERT INTO topics (book_id, topic_hash, title, level, start_page, end_page, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)", (book_id, "hashB", "Topic B", 1, 3, 4, 2))
        
        now = datetime.datetime.now(datetime.timezone.utc)
        
        # Insert new card
        cursor.execute("""
            INSERT INTO flashcards (topic_id, topic_name, concept_type, summary, question, answer, key_terms, content_hash, state, reps, due)
            VALUES (?, 'T', 'C', 'S', ?, ?, 'K', 'H1', 0, 0, NULL)
        """, (topic_id, "Q1", "A1"))
        
        # Insert learning card (due now)
        cursor.execute("""
            INSERT INTO flashcards (topic_id, topic_name, concept_type, summary, question, answer, key_terms, content_hash, state, reps, due, stability, difficulty)
            VALUES (?, 'T', 'C', 'S', ?, ?, 'K', 'H2', 1, 1, ?, 1.5, 5.0)
        """, (topic_id, "Q2", "A2", (now - datetime.timedelta(hours=1)).isoformat()))
        card2_id = cursor.lastrowid
        cursor.execute("INSERT INTO review_log (flashcard_id, stability, difficulty, due_date, reps, lapses, state, rating) VALUES (?, 1.5, 5.0, ?, 1, 0, 1, 3)", (card2_id, now.isoformat()))
        
        # Insert review card (due in 3 days)
        due_3d = (now + datetime.timedelta(days=3)).isoformat()
        cursor.execute("""
            INSERT INTO flashcards (topic_id, topic_name, concept_type, summary, question, answer, key_terms, content_hash, state, reps, due, stability, difficulty)
            VALUES (?, 'T', 'C', 'S', ?, ?, 'K', 'H3', 2, 5, ?, 10.5, 3.5)
        """, (topic_id, "Q3", "A3", due_3d))
        card3_id = cursor.lastrowid
        for i in range(5):
            cursor.execute("INSERT INTO review_log (flashcard_id, stability, difficulty, due_date, reps, lapses, state, rating) VALUES (?, 10.5, 3.5, ?, 5, 0, 2, 3)", (card3_id, due_3d))
            
        # Insert relearning card (due in 5 days)
        due_5d = (now + datetime.timedelta(days=5)).isoformat()
        cursor.execute("""
            INSERT INTO flashcards (topic_id, topic_name, concept_type, summary, question, answer, key_terms, content_hash, state, reps, due, stability, difficulty)
            VALUES (?, 'T', 'C', 'S', ?, ?, 'K', 'H4', 3, 2, ?, 2.0, 7.5)
        """, (topic_id, "Q4", "A4", due_5d))
        card4_id = cursor.lastrowid
        for i in range(2):
            cursor.execute("INSERT INTO review_log (flashcard_id, stability, difficulty, due_date, reps, lapses, state, rating) VALUES (?, 2.0, 7.5, ?, 2, 0, 3, 3)", (card4_id, due_5d))
        
        conn.commit()

    response = client.get("/analytics/stats")
    assert response.status_code == 200
    data = response.json()
    
    assert data["totals"]["books"] == 1
    assert data["totals"]["topics"] == 2
    assert data["totals"]["flashcards"] == 4
    assert data["totals"]["total_reviews"] == 8
    
    assert data["queue"]["new"] == 1
    assert data["queue"]["learning"] == 2
    assert data["queue"]["review"] == 1
    
    # due_now should be 2 (one new with due IS NULL, one learning with due in past)
    assert data["queue"]["due_now"] == 2
    
    # average_stability = (1.5 + 10.5 + 2.0) / 3 = 14.0 / 3 = 4.67
    assert data["fsrs_metrics"]["average_stability_days"] == 4.67
    
    # average_difficulty = (5.0 + 3.5 + 7.5) / 3 = 16.0 / 3 = 5.33
    assert data["fsrs_metrics"]["average_difficulty"] == 5.33
    
    # Check forecast
    forecast = {f["date"]: f["due_count"] for f in data["forecast_7d"]}
    assert forecast[(now + datetime.timedelta(days=3)).strftime("%Y-%m-%d")] == 1
    assert forecast[(now + datetime.timedelta(days=5)).strftime("%Y-%m-%d")] == 1
