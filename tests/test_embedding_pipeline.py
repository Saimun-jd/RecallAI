import pytest
import os
import tempfile
import json
import asyncio
import numpy as np

# --- Fixtures ---

@pytest.fixture(autouse=True)
def setup_test_db(monkeypatch):
    fd, path = tempfile.mkstemp()
    os.close(fd)
    
    import app.database
    monkeypatch.setattr(app.database, "DB_PATH", path)
    
    app.database.init_db()
    
    yield path
    
    os.remove(path)

# --- Vector Mocking ---

def make_normalized_vector(v: list[float]) -> list[float]:
    arr = np.array(v, dtype=float)
    return (arr / np.linalg.norm(arr)).tolist()

# 5D vectors
VEC_A = make_normalized_vector([1.0, 0.0, 0.0, 0.0, 0.0])
VEC_A_SIM = make_normalized_vector([0.96, 0.28, 0.0, 0.0, 0.0]) # cos_sim with A = 0.96
VEC_B = make_normalized_vector([0.0, 1.0, 0.0, 0.0, 0.0]) # cos_sim with A = 0.0
VEC_C = make_normalized_vector([0.80, 0.60, 0.0, 0.0, 0.0]) # cos_sim with A = 0.80

call_counts = {"get_embedding": 0}

async def mock_get_embedding(text: str, provider: str = None) -> list[float]:
    call_counts["get_embedding"] += 1
    text_lower = text.lower()
    
    if "relu activation function" in text_lower:
        return VEC_A
    elif "relu function details" in text_lower:
        return VEC_A_SIM
    elif "overfitting" in text_lower:
        return VEC_A
    elif "underfitting" in text_lower:
        return VEC_B
    elif "target concept" in text_lower:
        return VEC_A
    elif "high similarity concept" in text_lower:
        return VEC_A_SIM
    elif "medium similarity concept" in text_lower:
        return VEC_C
    elif "unrelated concept" in text_lower:
        return VEC_B
        
    return make_normalized_vector([0.5, 0.5, 0.5, 0.5, 0.5])

@pytest.fixture(autouse=True)
def patch_embeddings(monkeypatch):
    call_counts["get_embedding"] = 0
    import app.embeddings
    monkeypatch.setattr(app.embeddings, "get_embedding", mock_get_embedding)

# --- Tests ---

def test_exact_hash_match():
    from app.database import resolve_and_save_topic
    
    book_hash = "book_hash_1"
    breadcrumb = "Page 12 > Ch 1 > Section 1"
    
    async def run_test():
        id1 = await resolve_and_save_topic(
            book_id=1, book_hash=book_hash, breadcrumb=breadcrumb,
            title="Test Topic", level=2, start_page=12, end_page=12,
            summary="A test topic summary."
        )
        
        assert id1 is not None
        assert call_counts["get_embedding"] == 1
        
        # Second invocation with exact same hash
        id2 = await resolve_and_save_topic(
            book_id=1, book_hash=book_hash, breadcrumb=breadcrumb,
            title="Test Topic", level=2, start_page=12, end_page=12,
            summary="A test topic summary."
        )
        
        assert id1 == id2
        # Verify get_embedding was called 0 times on the second invocation!
        assert call_counts["get_embedding"] == 1

    asyncio.run(run_test())

def test_same_page_concept_separation():
    from app.database import resolve_and_save_topic, get_connection
    
    book_hash = "book_hash_2"
    breadcrumb_A = "Page 55 > Chapter 3 > Overfitting"
    breadcrumb_B = "Page 55 > Chapter 3 > Underfitting"
    
    async def run_test():
        id_a = await resolve_and_save_topic(
            book_id=1, book_hash=book_hash, breadcrumb=breadcrumb_A,
            title="Overfitting", level=2, start_page=55, end_page=55,
            summary="Model performs well on training data but poorly on test data."
        )
        
        id_b = await resolve_and_save_topic(
            book_id=1, book_hash=book_hash, breadcrumb=breadcrumb_B,
            title="Underfitting", level=2, start_page=55, end_page=55,
            summary="Model fails to learn underlying pattern of training data."
        )
        
        assert id_a != id_b
        assert id_a is not None
        assert id_b is not None
        
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, title FROM topics ORDER BY id ASC")
            rows = cursor.fetchall()
            assert len(rows) == 2
            titles = [r['title'] for r in rows]
            assert "Overfitting" in titles
            assert "Underfitting" in titles

    asyncio.run(run_test())

def test_semantic_merge_and_identity_protection():
    from app.database import resolve_and_save_topic, get_connection, generate_topic_hash
    import json
    
    book_hash = "book_hash_3"
    breadcrumb_a = "Page 10 > Ch 2 > ReLU"
    expected_hash_a = generate_topic_hash(book_hash, breadcrumb_a)
    
    async def run_test():
        id_a = await resolve_and_save_topic(
            book_id=1, book_hash=book_hash, breadcrumb=breadcrumb_a,
            title="ReLU Activation Function", level=2, start_page=10, end_page=10,
            summary="Rectified Linear Unit sets negative values to zero.",
            key_terms=json.dumps(["relu", "activation"])
        )
        
        # Re-run with Topic B (High Similarity)
        breadcrumb_b = "Page 11 > Ch 2 > ReLU Details"
        
        id_b = await resolve_and_save_topic(
            book_id=1, book_hash=book_hash, breadcrumb=breadcrumb_b,
            title="ReLU Function Details", level=2, start_page=11, end_page=11,
            summary="Rectified Linear Units replace negative inputs with zero to prevent vanishing gradients.",
            key_terms=json.dumps(["vanishing gradient"])
        )
        
        assert id_a == id_b  # They should merge!
        
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT topic_hash, breadcrumb, key_terms, embedding FROM topics WHERE id = ?", (id_a,))
            row = cursor.fetchone()
            
            # Identity Protection
            assert row["topic_hash"] == expected_hash_a
            assert row["breadcrumb"] == breadcrumb_a
            
            # Merged fields
            kt = json.loads(row["key_terms"])
            assert "relu" in kt
            assert "vanishing gradient" in kt

    asyncio.run(run_test())

def test_related_topics_retrieval_logic():
    from app.main import app
    from fastapi.testclient import TestClient
    from app.database import get_connection, init_db
    import json
    
    # We use a direct DB insert since we're testing the retrieval logic directly
    with get_connection() as conn:
        cursor = conn.cursor()
        
        def insert(title, emb, hash_val):
            cursor.execute(
                "INSERT INTO topics (book_id, title, level, start_page, end_page, sort_order, topic_hash, embedding) VALUES (1, ?, 2, 1, 1, 0, ?, ?)",
                (title, hash_val, json.dumps(emb))
            )
            return cursor.lastrowid
            
        id_target = insert("Target Concept", VEC_A, "hash_target")
        id_high = insert("High Similarity Concept", VEC_A_SIM, "hash_high")
        id_med = insert("Medium Similarity Concept", VEC_C, "hash_med")
        id_unrelated = insert("Unrelated Concept", VEC_B, "hash_unrelated")
        
    client = TestClient(app)
    response = client.get(f"/topics/{id_target}/related?limit=3")
    assert response.status_code == 200
    data = response.json()
    
    related = data
    assert len(related) > 0
    
    # Ensure target is excluded
    ids = [r["id"] for r in related]
    assert id_target not in ids
    
    # Ensure sorted order
    titles = [r["title"] for r in related]
    
    assert titles[0] == "High Similarity Concept"
    assert titles[1] == "Medium Similarity Concept"
    assert titles[2] == "Unrelated Concept"
