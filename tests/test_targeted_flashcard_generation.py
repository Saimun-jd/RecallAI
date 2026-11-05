import os
import sys
import json
import pytest
import tempfile
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Create temporary test DB
temp_db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
temp_db_path = temp_db_file.name
temp_db_file.close()

from app import database
from app.main import app
from app.schemas import FlashcardList, FlashcardItem

database.ACTIVE_DB_PATH = temp_db_path
database.init_db()

client = TestClient(app)


@pytest.fixture
def setup_topic_with_atomic_concepts():
    import uuid
    uid = uuid.uuid4().hex[:6]
    book_id = database.save_book(
        title=f"Math Textbook {uid}",
        file_path=f"C:/mock/book_{uid}.pdf",
        file_hash=f"hash_{uid}",
        total_pages=50
    )
    
    atomic_concepts_data = [
        {
            "id": f"concept_inv_{uid}",
            "name": "Matrix Inversion",
            "concept_type": "Process Step",
            "summary": "Step-by-step process of computing the inverse of an invertible square matrix.",
            "key_terms": ["determinant", "adjugate", "invertible matrix"]
        },
        {
            "id": f"concept_eig_{uid}",
            "name": "Eigenvalues",
            "concept_type": "Definition",
            "summary": "Scalars associated with a linear system of equations.",
            "key_terms": ["eigenvector", "characteristic equation"]
        }
    ]

    with database.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO topics (book_id, title, level, start_page, end_page, sort_order, topic_hash, status, breadcrumb, content_md, atomic_concepts)
            VALUES (?, 'Linear Algebra Fundamentals', 1, 10, 25, 1, ?, 'processed', 'Math > Linear Algebra', ?, ?)
        """, (
            book_id, 
            f"topic_hash_{uid}", 
            "# Linear Algebra Fundamentals\nThis is rich markdown text describing matrices, vectors, determinants, and linear transformations in detail.",
            json.dumps(atomic_concepts_data)
        ))
        topic_id = cursor.lastrowid

    return topic_id, atomic_concepts_data


def test_flashcard_generation_whole_document(setup_topic_with_atomic_concepts):
    topic_id, _ = setup_topic_with_atomic_concepts

    mock_cards = FlashcardList(flashcards=[
        FlashcardItem(
            concept_type="Definition",
            question="What is a matrix?",
            answer="A rectangular array of numbers arranged in rows and columns.",
            key_terms=["matrix", "rows", "columns"]
        )
    ])

    with patch("app.llm_segment.generate_flashcards_for_topic", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_cards

        response = client.post(
            f"/topics/{topic_id}/flashcards",
            json={"count": 3}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert len(data["flashcards"]) == 1

        # Check that whole-document topic was used
        call_kwargs = mock_gen.call_args.kwargs
        assert call_kwargs["topic_name"] == "Linear Algebra Fundamentals"
        assert call_kwargs["summary"] == ""
        assert call_kwargs["count"] == 3

        # Check card tagging
        assert data["flashcards"][0]["topic_name"] == "Linear Algebra Fundamentals"

        # Verify cards were saved to DB
        get_res = client.get(f"/flashcards?topic_id={topic_id}")
        assert get_res.status_code == 200
        saved_cards = get_res.json()
        assert len(saved_cards) >= 1
        assert any(c["topic_name"] == "Linear Algebra Fundamentals" for c in saved_cards)


def test_flashcard_generation_targeted_concept(setup_topic_with_atomic_concepts):
    topic_id, atomic_concepts = setup_topic_with_atomic_concepts

    mock_cards = FlashcardList(flashcards=[
        FlashcardItem(
            concept_type="Process Step",
            question="What is the first step in calculating matrix inverse?",
            answer="Check if the determinant is non-zero.",
            key_terms=["determinant", "invertible matrix"]
        )
    ])

    with patch("app.llm_segment.generate_flashcards_for_topic", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_cards

        response = client.post(
            f"/topics/{topic_id}/flashcards",
            json={
                "count": 4,
                "concept_name": "Matrix Inversion",
                "custom_prompt": "Make it rigorous."
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert len(data["flashcards"]) == 1

        # Verify generate_flashcards_for_topic call arguments
        call_kwargs = mock_gen.call_args.kwargs
        assert call_kwargs["topic_name"] == "Linear Algebra Fundamentals → Matrix Inversion"
        # Summary overridden with the concept's summary
        assert call_kwargs["summary"] == atomic_concepts[0]["summary"]
        assert call_kwargs["count"] == 4
        # Custom prompt contains targeted instructions
        assert "Make it rigorous." in call_kwargs["custom_prompt"]
        assert "Focus exclusively on 'Matrix Inversion'" in call_kwargs["custom_prompt"]
        assert "Concept Type: Process Step" in call_kwargs["custom_prompt"]
        assert "determinant, adjugate, invertible matrix" in call_kwargs["custom_prompt"]

        # Verify flashcard topic_name is tagged with the concept name
        card = data["flashcards"][0]
        assert card["topic_name"] == "Matrix Inversion"
        assert card["concept_type"] == "Process Step"

        # Verify DB persisted card has topic_name = Matrix Inversion
        get_res = client.get(f"/flashcards?topic_id={topic_id}")
        assert get_res.status_code == 200
        saved_cards = get_res.json()
        concept_cards = [c for c in saved_cards if c["topic_name"] == "Matrix Inversion"]
        assert len(concept_cards) >= 1


def test_flashcard_generation_adhoc_concept(setup_topic_with_atomic_concepts):
    topic_id, _ = setup_topic_with_atomic_concepts

    mock_cards = FlashcardList(flashcards=[
        FlashcardItem(
            concept_type="Formula",
            question="What is the determinant of a 2x2 matrix [[a, b], [c, d]]?",
            answer="ad - bc",
            key_terms=["determinant", "2x2"]
        )
    ])

    with patch("app.llm_segment.generate_flashcards_for_topic", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_cards

        response = client.post(
            f"/topics/{topic_id}/flashcards",
            json={
                "count": 2,
                "concept_name": "Determinant Formula"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"

        # Check that prompt targeted the ad-hoc concept
        call_kwargs = mock_gen.call_args.kwargs
        assert "Focus exclusively on 'Determinant Formula'" in call_kwargs["custom_prompt"]

        # Tagged with the concept name
        assert data["flashcards"][0]["topic_name"] == "Determinant Formula"

        get_res = client.get(f"/flashcards?topic_id={topic_id}")
        assert any(c["topic_name"] == "Determinant Formula" for c in get_res.json())

