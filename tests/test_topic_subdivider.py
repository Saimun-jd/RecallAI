import pytest
import fitz
from app.heading_detect import detect_headings, clean_heading_title, is_valid_markdown_heading
from app.topic_subdivider import is_scanned_pdf, subdivide_topic_from_markdown
from app.database import get_connection

def test_clean_heading_title():
    assert clean_heading_title("→ Merits:") == "Merits"
    assert clean_heading_title("★ Define Strong AI and weak AI?") == "Define Strong AI and weak AI?"
    assert clean_heading_title("► Thinking Rationally: Laws of thought:") == "Thinking Rationally: Laws of thought"
    assert clean_heading_title("## Goals of AI/") == "Goals of AI"
    # Unescaping and markdown stripping
    assert clean_heading_title(r"\$t1 = 4 \* i") == "$t1 = 4 * i"
    assert clean_heading_title("CT2 4.1**") == "CT2 4.1"
    assert clean_heading_title("**Bold Title**") == "Bold Title"
    assert clean_heading_title('" double " " " -> 1...') == "double"

def test_is_valid_markdown_heading():
    # Code and equation rejection
    assert is_valid_markdown_heading("$t1 = 4 * i") is False
    assert is_valid_markdown_heading("add $t0, $t1, $t2") is False
    assert is_valid_markdown_heading("x = y + z") is False
    
    # Legitimate heading acceptance
    assert is_valid_markdown_heading("CT2 4.1") is True
    assert is_valid_markdown_heading("4.4 : Division") is True
    assert is_valid_markdown_heading("Floating Point Arithmetic") is True
    assert is_valid_markdown_heading("Design Principles") is True
    assert is_valid_markdown_heading("Memory Organization") is True

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
    import asyncio
    import uuid
    uid = uuid.uuid4().hex[:8]
    # Insert a dummy book and placeholder topic
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(f"DELETE FROM books WHERE file_hash LIKE 'test_hash%'")
        c.execute("INSERT INTO books (title, file_path, file_hash, total_pages) VALUES ('Test Book', 'test.pdf', ?, 5)", (f"test_hash_{uid}",))
        book_id = c.lastrowid
        c.execute("INSERT INTO topics (book_id, title, level, start_page, end_page, sort_order, topic_hash, status) VALUES (?, 'Full Document', 1, 1, 5, 0, 'h0', 'unprocessed')", (book_id,))
        placeholder_id = c.lastrowid

    try:
        sample_md = """# Introduction
Overview of course.

## Section A
Details of section A.

### Topic A1
Subtopic details.
"""
        created = asyncio.run(subdivide_topic_from_markdown(book_id, placeholder_id, sample_md, 1, 5))
        # 4 topics: Root Document + Introduction chapter + Section A + Topic A1
        assert len(created) >= 3

        # Check hierarchy
        root = created[0]
        intro = created[1]
        sec_a = created[2]

        # Root Level 1 topic
        assert root["title"] == "Test Book"
        assert root["level"] == 1
        assert root["parent_id"] is None
        assert root["id"] == placeholder_id  # Reused placeholder!

        # Chapter Level 2
        assert "introduction" in intro["title"].lower()
        assert intro["level"] == 2
        assert intro["parent_id"] == root["id"]

        # Subtopic Level 3
        assert sec_a["level"] == 3
        assert sec_a["parent_id"] == intro["id"]

        # Verify placeholder topic was reused and updated
        with get_connection() as conn:
            c = conn.cursor()
            c.execute("SELECT COUNT(*) as count FROM topics WHERE id = ?", (placeholder_id,))
            assert c.fetchone()["count"] == 1
    finally:
        with get_connection() as conn:
            c = conn.cursor()
            c.execute("DELETE FROM topics WHERE book_id = ?", (book_id,))
            c.execute("DELETE FROM books WHERE id = ?", (book_id,))


def test_subdivide_discards_formulas_and_groups_decimal_chapters():
    import asyncio
    import uuid
    uid = uuid.uuid4().hex[:8]
    with get_connection() as conn:
        c = conn.cursor()
        c.execute(f"DELETE FROM books WHERE file_hash LIKE 'arch_hash%'")
        c.execute("INSERT INTO books (title, file_path, file_hash, total_pages) VALUES ('Computer Architecture', 'arch.pdf', ?, 110)", (f"arch_hash_{uid}",))
        book_id = c.lastrowid
        c.execute("INSERT INTO topics (book_id, title, level, start_page, end_page, sort_order, topic_hash, status) VALUES (?, 'Full Document', 1, 1, 110, 0, 'h0', 'unprocessed')", (book_id,))
        placeholder_id = c.lastrowid

    try:
        sample_md = """{61}------------------------------------------------
# \\$t1 = 4 \\* i
Array indexing formula in assembly.

{62}------------------------------------------------
## CT2 4.1**
Introduction to computer arithmetic operations.

{90}------------------------------------------------
## 4.4 : Division
Division hardware and shifting registers.

{97}------------------------------------------------
## 4.6 Floating point
Floating point arithmetic standard IEEE 754.
"""
        created = asyncio.run(subdivide_topic_from_markdown(book_id, placeholder_id, sample_md, 1, 110))
        
        # Formula "$t1 = 4 * i" MUST be filtered out!
        titles = [t["title"] for t in created]
        assert not any("$t1" in t for t in titles)

        # Root Level 1 topic exists
        root = created[0]
        assert root["level"] == 1
        assert root["title"] == "Computer Architecture"

        # Chapter 4 is Level 2 under root
        chapter4 = next((t for t in created if "Chapter 4" in t["title"] and t["level"] == 2), None)
        assert chapter4 is not None
        assert chapter4["parent_id"] == root["id"]

        subtopics = [t for t in created if t["parent_id"] == chapter4["id"]]
        assert len(subtopics) >= 2
        subtopic_titles = [s["title"].lower() for s in subtopics]
        assert any("division" in s for s in subtopic_titles)
        assert any("floating" in s for s in subtopic_titles)
        assert all(s["level"] == 3 for s in subtopics)
    finally:
        with get_connection() as conn:
            c = conn.cursor()
            c.execute("DELETE FROM topics WHERE book_id = ?", (book_id,))
            c.execute("DELETE FROM books WHERE id = ?", (book_id,))


def test_deterministic_fallback_adopts_following_sections_under_ch3():
    from app.topic_subdivider import deterministic_fallback_reconcile

    # Simulate raw OCR sections matching user's exact issue
    sections = [
        {"clean_title": "Measuring Performance", "page_num": 1, "level": 1, "text": "CPU performance"},
        {"clean_title": "Unix command time", "page_num": 1, "level": 2, "text": "time command output"},
        {"clean_title": "Defining performance", "page_num": 37, "level": 2, "text": "Response time vs throughput"},
        {"clean_title": "Ch 3", "page_num": 39, "level": 1, "text": "Chapter 3: Arithmetic for Computers"},
        {"clean_title": "Principle 2: Smaller is faster", "page_num": 40, "level": 2, "text": "Hardware design principles"},
        {"clean_title": "Design Principle 3", "page_num": 41, "level": 2, "text": "Good design demands good compromises"},
        {"clean_title": "Memory operands", "page_num": 43, "level": 2, "text": "Load word and store word"},
        {"clean_title": "Chapter 4", "page_num": 63, "level": 1, "text": "Chapter 4: The Processor"},
        {"clean_title": "CT2 4.1", "page_num": 63, "level": 2, "text": "Logic design and datapath"},
        {"clean_title": "Incorporating R-type", "page_num": 68, "level": 2, "text": "ALU control signals"},
    ]

    chapters = deterministic_fallback_reconcile(sections, total_pages=110)

    # Must have 3 chapters: Intro chapter, Ch 3, Chapter 4
    ch_titles = [c["title"] for c in chapters]
    assert any("Ch 3" in t for t in ch_titles)
    assert any("Chapter 4" in t for t in ch_titles)

    ch3 = next(c for c in chapters if "Ch 3" in c["title"])
    # Ch 3 MUST have children! It must NOT be empty!
    assert len(ch3["subtopics"]) >= 3
    ch3_sub_titles = [s["title"] for s in ch3["subtopics"]]
    assert any("Principle 2" in t for t in ch3_sub_titles)
    assert any("Memory operands" in t for t in ch3_sub_titles)

    ch4 = next(c for c in chapters if "Chapter 4" in c["title"])
    assert len(ch4["subtopics"]) >= 2
    ch4_sub_titles = [s["title"] for s in ch4["subtopics"]]
    assert any("4.1" in t for t in ch4_sub_titles)
    assert any("Incorporating" in t for t in ch4_sub_titles)


