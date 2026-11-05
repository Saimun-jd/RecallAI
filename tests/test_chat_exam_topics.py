import pytest
from app.schemas import ChatRequest, ExamTopicItem
from app.prompt_manager import get_prompt_template
from app.llm_segment import _build_document_outline
from app.database import init_db, get_connection

@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()

def test_chat_request_schema():
    req = ChatRequest(
        book_id=1,
        question="in this slide pdf, i only have exam in A* Search. Can you make me exam ready?"
    )
    assert req.book_id == 1
    assert req.topic_id is None
    assert req.context_markdown == ""

def test_build_document_outline():
    # Insert mock book and topics
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT OR IGNORE INTO books (id, title, file_path, file_hash, total_pages) VALUES (999, 'Test Slides', 'test.pdf', 'hash999', 50)")
        cursor.execute("""
            INSERT OR IGNORE INTO topics (id, book_id, title, level, start_page, end_page, sort_order, topic_hash, flashcard_count, mastery_status)
            VALUES (9991, 999, 'Admissible Heuristics', 1, 10, 15, 1, 'thash1', 5, 'fragile')
        """)
        cursor.execute("""
            INSERT OR IGNORE INTO topics (id, book_id, title, level, start_page, end_page, sort_order, topic_hash, flashcard_count, mastery_status)
            VALUES (9992, 999, 'A* Search', 1, 16, 25, 2, 'thash2', 10, 'mastered')
        """)

    outline = _build_document_outline(999)
    assert "Admissible Heuristics" in outline
    assert "A* Search" in outline
    assert "Slides: 10-15" in outline
    assert "Flashcards: 5" in outline
    assert "Mastery: fragile" in outline

def test_chat_prompt_format_with_outline():
    outline = "- [ID: 9991] \"Admissible Heuristics\" | Slides: 10-15 | Flashcards: 5 | Mastery: fragile"
    template = get_prompt_template("chat_prompt")
    formatted = template.format(
        context_markdown="Topic Markdown",
        chat_history="No history",
        question="Make me exam ready",
        document_outline=outline
    )
    assert "Admissible Heuristics" in formatted
    assert ":::exam-topics" in formatted
