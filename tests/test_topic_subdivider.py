import pytest
import fitz
from app.heading_detect import detect_headings, clean_heading_title
from app.topic_subdivider import is_scanned_pdf, subdivide_topic_from_markdown
from app.database import get_connection

def test_clean_heading_title():
    assert clean_heading_title("→ Merits:") == "Merits"
    assert clean_heading_title("★ Define Strong AI and weak AI?") == "Define Strong AI and weak AI?"
    assert clean_heading_title("► Thinking Rationally: Laws of thought:") == "Thinking Rationally: Laws of thought"
    assert clean_heading_title("## Goals of AI/") == "Goals of AI"

def test_detect_headings_with_levels():
    md = """# Chapter 1: Introduction
Text for intro.

## 1.1 Goals
Text for goals.

### 1.1.1 Rational Agent
Text for agent.
"""
    sections = detect_headings(md, 1)
    assert len(sections) == 3
    assert sections[0]["level"] == 1
    assert sections[0]["clean_title"] == "Chapter 1: Introduction"
    assert "Text for intro." in sections[0]["text"]

    assert sections[1]["level"] == 2
    assert sections[1]["clean_title"] == "1.1 Goals"

    assert sections[2]["level"] == 3
    assert sections[2]["clean_title"] == "1.1.1 Rational Agent"

def test_is_scanned_pdf_detection():
    # PDF with only CamScanner watermark
    doc_scanned = fitz.open()
    page1 = doc_scanned.new_page()
    page1.insert_text((50, 50), "CamScanner\n")
    assert is_scanned_pdf(doc_scanned) is True

    # Digital PDF with actual text
    doc_digital = fitz.open()
    page2 = doc_digital.new_page()
    page2.insert_text((50, 50), "This is a digital textbook with hundreds of characters of real content about artificial intelligence.")
    assert is_scanned_pdf(doc_digital) is False

def test_subdivide_topic_hierarchy():
    # Insert a dummy book and placeholder topic
    with get_connection() as conn:
        c = conn.cursor()
        c.execute("INSERT INTO books (title, file_path, file_hash, total_pages) VALUES ('Test Book', 'test.pdf', 'hash123', 5)")
        book_id = c.lastrowid
        c.execute("INSERT INTO topics (book_id, title, level, start_page, end_page, sort_order, topic_hash, status) VALUES (?, 'Full Document', 1, 1, 5, 0, 'h0', 'unprocessed')", (book_id,))
        placeholder_id = c.lastrowid

    sample_md = """# Introduction
Overview of course.

## Section A
Details of section A.

### Topic A1
Subtopic details.
"""
    created = subdivide_topic_from_markdown(book_id, placeholder_id, sample_md, 1, 5)
    assert len(created) == 3

    # Check hierarchy
    intro = created[0]
    sec_a = created[1]
    top_a1 = created[2]

    assert intro["title"] == "Introduction"
    assert intro["level"] == 1
    assert intro["parent_id"] is None

    assert sec_a["title"] == "Section A"
    assert sec_a["level"] == 2
    assert sec_a["parent_id"] == intro["id"]

    assert top_a1["title"] == "Topic A1"
    assert top_a1["level"] == 3
    assert top_a1["parent_id"] == sec_a["id"]

    # Verify placeholder topic was deleted
    with get_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) as count FROM topics WHERE id = ?", (placeholder_id,))
        assert c.fetchone()["count"] == 0

        # Clean up test rows
        c.execute("DELETE FROM topics WHERE book_id = ?", (book_id,))
        c.execute("DELETE FROM books WHERE id = ?", (book_id,))
