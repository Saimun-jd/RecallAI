import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from app.database import (
    init_db, save_book, get_child_topics, get_topic_by_id, 
    update_topic_enrichment, get_connection
)
from app.pdf_extract import extract_page_range_chunked
from app.schemas import SectionExtraction, AtomicTopic


@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()


@pytest.fixture
def anyio_backend():
    return 'asyncio'


def test_get_child_topics_ordering():
    import uuid
    uid = uuid.uuid4().hex[:8]
    book_id = save_book("Test ML Book", f"test_mock_{uid}.pdf", f"mock_hash_{uid}", 250)
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Insert parent
        cursor.execute("""
            INSERT INTO topics (book_id, title, level, start_page, end_page, sort_order, topic_hash, status)
            VALUES (?, 'Chapter 4: Deep Learning for Computer Vision', 1, 138, 193, 4, ?, 'unprocessed')
        """, (book_id, f"hash_chap4_{uid}"))
        parent_id = cursor.lastrowid
        
        # Insert children with parent_id
        cursor.execute("""
            INSERT INTO topics (book_id, parent_id, title, level, start_page, end_page, sort_order, topic_hash, status)
            VALUES (?, ?, '4.2 Training from scratch', 2, 147, 165, 2, ?, 'unprocessed')
        """, (book_id, parent_id, f"hash_4_2_{uid}"))
        
        cursor.execute("""
            INSERT INTO topics (book_id, parent_id, title, level, start_page, end_page, sort_order, topic_hash, status)
            VALUES (?, ?, '4.1 Introduction to convnets', 2, 138, 146, 1, ?, 'unprocessed')
        """, (book_id, parent_id, f"hash_4_1_{uid}"))
        
        cursor.execute("""
            INSERT INTO topics (book_id, parent_id, title, level, start_page, end_page, sort_order, topic_hash, status)
            VALUES (?, ?, '4.3 Using pretrained convnets', 2, 166, 180, 3, ?, 'unprocessed')
        """, (book_id, parent_id, f"hash_4_3_{uid}"))

    children = get_child_topics(parent_id)
    assert len(children) == 3
    # Check ordering: sort_order 1, 2, 3
    assert children[0]["title"] == "4.1 Introduction to convnets"
    assert children[1]["title"] == "4.2 Training from scratch"
    assert children[2]["title"] == "4.3 Using pretrained convnets"


@pytest.mark.anyio
async def test_extract_page_range_chunked_splitting():
    """Test that a 15-page range with max_pages_per_chunk=5 splits into 3 calls."""
    mock_calls = []

    async def fake_extract_raw_text(pdf_bytes, start_page):
        mock_calls.append(start_page)
        return f"# Markdown for page {start_page}", f"cache_p{start_page}", start_page

    with patch("fitz.open") as mock_fitz, \
         patch("app.pdf_extract.extract_raw_text", side_effect=fake_extract_raw_text):
        
        mock_doc = MagicMock()
        mock_doc.page_count = 200
        mock_doc.__enter__.return_value = mock_doc
        
        mock_new_doc = MagicMock()
        mock_new_doc.write.return_value = b"%PDF-1.4 mock bytes"
        mock_new_doc.__enter__.return_value = mock_new_doc
        
        def fitz_open_side_effect(path_or_bytes=None, **kwargs):
            if path_or_bytes is None:
                return mock_new_doc
            return mock_doc

        mock_fitz.side_effect = fitz_open_side_effect

        progress_calls = []
        async def on_progress(chunk_idx, total_chunks, p_start, p_end):
            progress_calls.append((chunk_idx, total_chunks, p_start, p_end))

        combined_md, cache_key, start_page = await extract_page_range_chunked(
            file_path="dummy.pdf",
            start_page=138,
            end_page=152,  # 15 pages: 138-142 (5), 143-147 (5), 148-152 (5)
            max_pages_per_chunk=5,
            on_chunk_progress=on_progress
        )

        assert len(mock_calls) == 3
        assert mock_calls == [138, 143, 148]
        assert len(progress_calls) == 3
        assert progress_calls[0] == (1, 3, 138, 142)
        assert progress_calls[1] == (2, 3, 143, 147)
        assert progress_calls[2] == (3, 3, 148, 152)
        assert "# Markdown for page 138" in combined_md
        assert "# Markdown for page 148" in combined_md


@pytest.mark.anyio
async def test_parent_topic_stream_hierarchical_cascade():
    """Test that processing a parent topic with children auto-populates all children and aggregates to parent."""
    import uuid
    from app.main import process_topic_stream, ProcessTopicRequest
    from app.schemas import SectionExtraction, AtomicTopic
    
    uid = uuid.uuid4().hex[:8]
    book_id = save_book("Test CV Book", f"test_cv_{uid}.pdf", f"mock_hash_cv_{uid}", 200)
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO topics (book_id, title, level, start_page, end_page, sort_order, topic_hash, status)
            VALUES (?, 'Chapter 4: Convnets', 1, 138, 193, 1, ?, 'unprocessed')
        """, (book_id, f"hash_cv_parent_{uid}"))
        parent_id = cursor.lastrowid
        
        cursor.execute("""
            INSERT INTO topics (book_id, parent_id, title, level, start_page, end_page, sort_order, topic_hash, status)
            VALUES (?, ?, '4.1 Intro to Convnets', 2, 138, 146, 1, ?, 'unprocessed')
        """, (book_id, parent_id, f"hash_cv_4_1_{uid}"))
        c1_id = cursor.lastrowid
        
        cursor.execute("""
            INSERT INTO topics (book_id, parent_id, title, level, start_page, end_page, sort_order, topic_hash, status)
            VALUES (?, ?, '4.2 Convnet Architectures', 2, 147, 165, 2, ?, 'unprocessed')
        """, (book_id, parent_id, f"hash_cv_4_2_{uid}"))
        c2_id = cursor.lastrowid

    # Mock extract_page_range_chunked and extract_atomic_concepts
    async def mock_extract_chunked(file_path, start_page, end_page, **kwargs):
        return f"# Heading for p{start_page}-{end_page}\n\nContent for section.", f"cache_{start_page}", start_page

    def mock_extract_concepts(heading, text, code_blocks=None, images=None, provider_override=None):
        topic_name = f"Concept for {heading}"
        return SectionExtraction(
            section_title=heading,
            atomic_topics=[
                AtomicTopic(
                    topic_name=topic_name,
                    concept_type="Definition",
                    summary=f"Summary of {topic_name}",
                    key_terms=["conv", "pooling"]
                )
            ]
        )

    with patch("os.path.exists", return_value=True), \
         patch("app.pdf_extract.extract_page_range_chunked", side_effect=mock_extract_chunked), \
         patch("app.main.extract_atomic_concepts", side_effect=mock_extract_concepts):
        
        req = ProcessTopicRequest(provider_override="test_mock")
        response = await process_topic_stream(parent_id, req)
        
        events = []
        async for chunk in response.body_iterator:
            for line in chunk.split("\n\n"):
                if line.startswith("data: "):
                    events.append(json.loads(line[6:]))
        
        # Verify SSE event sequence
        stages = [e.get("stage") or e.get("status") for e in events]
        assert "parent_decomposition" in stages
        assert "processing_child" in stages
        assert "complete" in stages
        
        # Verify Child 1 is auto-populated and processed
        c1 = get_topic_by_id(c1_id)
        assert c1["status"] == "processed"
        assert c1["content_md"] is not None
        assert "4.1 Intro to Convnets" in c1["atomic_concepts"]
        
        # Verify Child 2 is auto-populated and processed
        c2 = get_topic_by_id(c2_id)
        assert c2["status"] == "processed"
        assert c2["content_md"] is not None
        assert "4.2 Convnet Architectures" in c2["atomic_concepts"]
        
        # Verify Parent has aggregated concepts and content
        parent = get_topic_by_id(parent_id)
        assert parent["status"] == "processed"
        parent_concepts = json.loads(parent["atomic_concepts"])
        assert len(parent_concepts) == 2
        assert any("4.1 Intro" in c["name"] for c in parent_concepts)
        assert any("4.2 Convnet" in c["name"] for c in parent_concepts)


@pytest.mark.anyio
async def test_hierarchical_cornell_notes_scaffold():
    """Test that generating Cornell notes on a parent chapter generates notes for children and compiles a master guide."""
    import uuid
    from app.main import generate_note_scaffold_api, NoteScaffoldRequest
    from app.database import get_note_by_topic, save_note_for_topic
    
    uid = uuid.uuid4().hex[:8]
    book_id = save_book("Cornell ML Book", f"test_cornell_{uid}.pdf", f"mock_hash_cornell_{uid}", 200)
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO topics (book_id, title, level, start_page, end_page, sort_order, topic_hash, status, content_md)
            VALUES (?, 'Chapter 5: Recurrent Neural Networks', 1, 200, 250, 1, ?, 'processed', 'Full Chapter MD')
        """, (book_id, f"hash_rnn_parent_{uid}"))
        parent_id = cursor.lastrowid
        
        cursor.execute("""
            INSERT INTO topics (book_id, parent_id, title, level, start_page, end_page, sort_order, topic_hash, status, content_md)
            VALUES (?, ?, '5.1 Understanding RNNs', 2, 200, 220, 1, ?, 'processed', 'Content 5.1')
        """, (book_id, parent_id, f"hash_rnn_5_1_{uid}"))
        c1_id = cursor.lastrowid
        
        cursor.execute("""
            INSERT INTO topics (book_id, parent_id, title, level, start_page, end_page, sort_order, topic_hash, status, content_md)
            VALUES (?, ?, '5.2 LSTM and GRU Architectures', 2, 221, 250, 2, ?, 'processed', 'Content 5.2')
        """, (book_id, parent_id, f"hash_rnn_5_2_{uid}"))
        c2_id = cursor.lastrowid

    # Pre-populate child 1's note to test smart reuse
    pre_existing_note = "# 📝 5.1 Understanding RNNs\n\n## 🎯 Core Invariants & Definitions\n- Hidden state recurrence.\n\n## 📌 Self-Testing Cue Questions (Active Recall)\n- What is the hidden state vector?"
    save_note_for_topic(c1_id, pre_existing_note)

    generated_for = []

    async def mock_generate_note(topic, provider_override=None):
        t_title = topic.get("title", "")
        generated_for.append(t_title)
        return (
            f"# 📝 {t_title}\n\n"
            "## 🎯 Core Invariants & Definitions\n"
            "- Gating mechanisms $f_t = \\sigma(W_f x_t + U_f h_{t-1})$.\n\n"
            "## 📌 Self-Testing Cue Questions (Active Recall)\n"
            f"- How does the forget gate in {t_title} prevent vanishing gradients?"
        )

    with patch("app.main.generate_single_cornell_note", side_effect=mock_generate_note):
        req = NoteScaffoldRequest(provider_override="test_mock")
        res = await generate_note_scaffold_api(parent_id, req)

        # Child 1 was already present, so it should NOT have been re-generated (smart reuse)
        assert "5.1 Understanding RNNs" not in generated_for
        # Child 2 was missing, so it SHOULD have been generated
        assert "5.2 LSTM and GRU Architectures" in generated_for

        # Check that Child 2 note was saved to SQLite
        c2_note = get_note_by_topic(c2_id)
        assert c2_note and "Gating mechanisms" in c2_note

        # Check that Parent Master Guide contains:
        # 1. Navigation outline
        # 2. Both subtopic sections
        # 3. Consolidated Chapter Master Active Recall Deck
        master_guide = res["scaffold"]
        assert "Chapter 5: Recurrent Neural Networks — Master Study Guide" in master_guide
        assert "## 📑 Subtopics Navigation" in master_guide
        assert "5.1 Understanding RNNs" in master_guide
        assert "5.2 LSTM and GRU Architectures" in master_guide
        assert "# 🎯 Chapter Master Active Recall Deck" in master_guide
        assert "What is the hidden state vector?" in master_guide
        assert "vanishing gradients" in master_guide

        # Verify parent note saved in SQLite
        saved_parent_note = get_note_by_topic(parent_id)
        assert saved_parent_note == master_guide


