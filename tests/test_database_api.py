import os
import sys
import json
import pytest
import tempfile
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Set up temporary database for tests
temp_db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
temp_db_path = temp_db_file.name
temp_db_file.close()

from app import database
from app.main import app

# Patch database.ACTIVE_DB_PATH to temporary test database
database.ACTIVE_DB_PATH = temp_db_path
database.init_db()

client = TestClient(app)

def test_database_crud_and_cascading():
    # 1. Save Book
    book_id = database.save_book(
        title="Deep Learning",
        file_path="C:/dummy/path.pdf",
        file_hash="hash_12345678",
        total_pages=100
    )
    assert book_id > 0
    
    # Save same book again -> returns existing book ID
    book_id_2 = database.save_book(
        title="Deep Learning",
        file_path="C:/dummy/path.pdf",
        file_hash="hash_12345678",
        total_pages=100
    )
    assert book_id == book_id_2

    # 2. Insert TOC bulk
    toc = [
        {"level": 1, "title": "Chapter 1", "start_page": 1, "end_page": 10},
        {"level": 2, "title": "Section 1.1", "start_page": 2, "end_page": 5},
    ]
    inserted = database.insert_topics_bulk(book_id, toc)
    assert inserted == 2

    # Verify parent-child relationship
    topics = database.get_topics(book_id=book_id)
    assert len(topics) == 2
    parent = [t for t in topics if t["level"] == 1][0]
    child = [t for t in topics if t["level"] == 2][0]
    assert child["parent_id"] == parent["id"]

    # 3. Flashcards CRUD & Hash Deduplication
    cards_payload = [
        {
            "question": "What is backprop?",
            "answer": "Gradient calculation algorithm.",
            "topic_name": "Section 1.1",
            "concept_type": "Definition",
            "key_terms": ["backprop", "gradient"]
        },
        # Exact duplicate in same batch
        {
            "question": "What is backprop?",
            "answer": "Gradient calculation algorithm.",
            "topic_name": "Section 1.1",
            "concept_type": "Definition",
            "key_terms": ["backprop", "gradient"]
        },
        # Different card
        {
            "question": "What is SGD?",
            "answer": "Stochastic Gradient Descent optimizer.",
            "topic_name": "Section 1.1",
            "concept_type": "Definition",
            "key_terms": ["SGD"]
        }
    ]
    saved_count = database.save_flashcards(child["id"], cards_payload)
    assert saved_count == 2 # 1 duplicate ignored

    # Check topic flashcard_count updated
    updated_child = database.get_topic_by_id(child["id"])
    assert updated_child["flashcard_count"] == 2

    # 4. Notes CRUD
    database.save_note_for_topic(child["id"], "# My Notes\nKey points.")
    note_content = database.get_note_by_topic(child["id"])
    assert note_content == "# My Notes\nKey points."

    # 5. PDF Annotations CRUD
    ann_id = database.save_annotation(
        book_id=book_id,
        page_number=2,
        annotation_type="sidenote",
        selected_text="backpropagation algorithm",
        rect_json=json.dumps({"x": 10, "y": 20, "width": 100, "height": 15}),
        content="Important algorithm!"
    )
    assert ann_id > 0
    page_anns = database.get_annotations_for_page(book_id, 2)
    assert len(page_anns) == 1
    assert page_anns[0]["id"] == ann_id

    # 6. Delete Book -> CASCADE check
    del_ok = database.delete_book(book_id)
    assert del_ok is True
    # Topics, flashcards, notes, annotations for this book should be gone
    assert database.get_book_by_id(book_id) is None
    assert len(database.get_topics(book_id=book_id)) == 0
    assert database.get_topic_by_id(child["id"]) is None
    assert database.get_note_by_topic(child["id"]) == ""
    assert len(database.get_annotations_for_book(book_id)) == 0

def test_semantic_deduplication():
    async def _test():
        book_id = database.save_book("AI Book", "C:/dummy/ai.pdf", "ai_hash_001", 80)
        
        with patch("app.embeddings.get_embedding", new_callable=AsyncMock) as mock_emb:
            # Return identical embeddings for two concepts
            mock_emb.return_value = [0.5, 0.5, 0.5, 0.5]
            
            # Insert concept 1
            top_id_1 = await database.resolve_and_save_topic(
                book_id=book_id,
                book_hash="ai_hash_001",
                breadcrumb="AI > Neural Nets > Perceptron",
                title="Perceptron",
                level=1,
                summary="A linear binary classifier.",
                key_terms=json.dumps(["perceptron", "weights"])
            )
            
            # Insert concept 2 with high similarity (same embedding)
            top_id_2 = await database.resolve_and_save_topic(
                book_id=book_id,
                book_hash="ai_hash_001",
                breadcrumb="AI > Neural Nets > Perceptron Layer",
                title="Perceptron Unit",
                level=1,
                summary="A linear binary classifier with activation.",
                key_terms=json.dumps(["perceptron", "activation", "bias"])
            )
            
            # Should deduplicate and merge into top_id_1
            assert top_id_1 == top_id_2
            
            merged_topic = database.get_topic_by_id(top_id_1)
            merged_terms = json.loads(merged_topic["key_terms"])
            assert "weights" in merged_terms
            assert "activation" in merged_terms
            assert "bias" in merged_terms
            
    asyncio.run(_test())

def test_api_review_and_undo_flow():
    # Setup test book and flashcard
    book_id = database.save_book("Math", "C:/dummy/math.pdf", "math_hash_99", 50)
    
    with database.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO topics (book_id, title, level, start_page, end_page, sort_order, topic_hash)
            VALUES (?, 'Eigenvalues', 1, 1, 5, 0, 'hash_math_top_1')
        """, (book_id,))
        topic_id = cursor.lastrowid
        
    database.save_flashcards(topic_id, [
        {"question": "What is an eigenvalue?", "answer": "Scalar factor of eigenvector."}
    ])
    
    # 1. Fetch due cards
    due_res = client.get("/flashcards/due")
    assert due_res.status_code == 200
    due_cards = due_res.json()
    assert len(due_cards) > 0
    card_id = due_cards[0]["id"]
    
    # 2. Review card
    rev_res = client.post(f"/flashcards/{card_id}/review", json={"rating": 3})
    assert rev_res.status_code == 200
    rev_data = rev_res.json()
    assert rev_data["state"] != 0
    assert rev_data["stability"] > 0
    
    # 3. Undo review
    undo_res = client.post(f"/flashcards/{card_id}/undo-review")
    assert undo_res.status_code == 200
    undo_data = undo_res.json()
    assert undo_data["status"] == "success"
    assert undo_data["restored_state"]["state"] == 0
    
    # Verify card state is restored in DB
    restored_card = database.get_flashcard_by_id(card_id)
    assert restored_card["state"] == 0
    assert restored_card["due"] is None
    
    # 4. Try undoing again -> should fail (single-step undo)
    undo_again = client.post(f"/flashcards/{card_id}/undo-review")
    assert undo_again.status_code == 400

def test_api_endpoints():
    # Health check
    res = client.get("/health")
    assert res.status_code == 200
    res_data = res.json()
    assert res_data.get("status") == "ok" or res_data.get("data", {}).get("status") == "ok"
    
    # Settings CRUD
    res = client.post("/settings/api-keys", json={"openai_api_key": "sk-test12345"})
    assert res.status_code == 200
    
    res = client.get("/settings/api-keys")
    assert res.status_code == 200
    assert res.json()["openai_api_key"] == "sk-test12345"
    
    # Analytics Stats
    res = client.get("/analytics/stats")
    assert res.status_code == 200
    stats = res.json()
    assert "totals" in stats
    assert "queue" in stats
    assert "fsrs_metrics" in stats
    assert "forecast_7d" in stats
