import os
import sys
import pytest
import time
from fastapi.testclient import TestClient
from app import database
from app.main import app

@pytest.fixture(autouse=True)
def setup_test_db():
    database.init_db()

def test_reading_state_persistence_and_ordering():
    client = TestClient(app)
    
    # 1. Create two books
    book1_id = database.save_book(
        title="Book One: Algorithms",
        file_path="C:/dummy/b1.pdf",
        file_hash="hash_b1_test",
        total_pages=200
    )
    time.sleep(0.05)
    book2_id = database.save_book(
        title="Book Two: Systems",
        file_path="C:/dummy/b2.pdf",
        file_hash="hash_b2_test",
        total_pages=150
    )
    
    # Initially, Book 2 was created after Book 1, so Book 2 is first in get_books
    books = database.get_books()
    assert books[0]["id"] == book2_id
    
    # 2. Update reading state for Book 1 (user read page 45)
    database.update_book_reading_state(book1_id, page_number=45, topic_id=None)
    
    # Now Book 1 has a newer last_read_at, so Book 1 MUST be first in get_books!
    books_after = database.get_books()
    assert books_after[0]["id"] == book1_id
    assert books_after[0]["last_read_page"] == 45
    assert books_after[0]["last_read_at"] is not None

    # 3. Test PATCH /books/{book_id}/reading-state endpoint
    patch_res = client.patch(f"/books/{book2_id}/reading-state", json={
        "page_number": 88,
        "topic_id": 999
    })
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["last_read_page"] == 88
    assert data["last_topic_id"] == 999

    # Now Book 2 was read most recently, so Book 2 MUST be first!
    books_after_patch = database.get_books()
    assert books_after_patch[0]["id"] == book2_id
    assert books_after_patch[0]["last_read_page"] == 88
    assert books_after_patch[0]["last_topic_id"] == 999

    # 4. Test GET /books/{book_id} touches last_read_at
    time.sleep(0.05)
    get_res = client.get(f"/books/{book1_id}")
    assert get_res.status_code == 200
    
    # Now Book 1 is first again because opening it updated last_read_at
    books_final = database.get_books()
    assert books_final[0]["id"] == book1_id
