import logging
import re
import hashlib
from typing import List, Dict, Any, Optional
import fitz
from app.database import get_connection, get_topic_by_id, get_book_by_id
from app.heading_detect import detect_headings

logger = logging.getLogger(__name__)

def is_scanned_pdf(doc: fitz.Document) -> bool:
    """
    Returns True if the document has virtually zero digital text, indicating
    it is a scanned or photographed document (e.g. CamScanner notes).
    """
    if doc.page_count == 0:
        return True

    # Sample up to first 5 pages
    sample_text = ""
    for p in range(min(5, doc.page_count)):
        sample_text += doc[p].get_text() + " "

    # Strip scanner watermarks like 'CamScanner', 'Scanned with', etc.
    cleaned_sample = re.sub(r'(?i)camscanner|scanned with|cam scanner|scanner', '', sample_text).strip()
    alnum_count = sum(c.isalnum() for c in cleaned_sample)
    
    return alnum_count < 50


def subdivide_topic_from_markdown(
    book_id: int,
    placeholder_topic_id: Optional[int],
    md_text: str,
    default_start_page: int = 1,
    default_end_page: int = 1
) -> List[Dict[str, Any]]:
    """
    Parses Markdown headings (produced by Marker) and subdivides a monolithic or
    placeholder topic into individual structured topics in the database.
    """
    if not md_text or not md_text.strip():
        return []

    sections = detect_headings(md_text, default_start_page)
    if len(sections) < 2:
        logger.info("Not enough headings found in markdown (%d) to subdivide.", len(sections))
        return []

    logger.info("Subdividing book %d into %d topics from Marker markdown...", book_id, len(sections))

    with get_connection() as conn:
        cursor = conn.cursor()

        # Check if we should delete the placeholder topic
        if placeholder_topic_id:
            placeholder = get_topic_by_id(placeholder_topic_id)
            if placeholder and placeholder.get("title") in ("Full Document", "Untitled", "Introduction"):
                logger.info("Removing placeholder topic %d ('%s') before inserting subdivided topics.",
                            placeholder_topic_id, placeholder.get("title"))
                cursor.execute("DELETE FROM topics WHERE id = ?", (placeholder_topic_id,))

        created_topics = []
        parent_stack = []  # list of (level, topic_id, title)

        for index, sec in enumerate(sections):
            raw_heading = sec["heading"]
            title = sec.get("clean_title") or raw_heading
            level = sec.get("level", 1)
            content_md = sec.get("text", "").strip()
            start_page = sec.get("page_num", default_start_page)
            
            # Compute end_page based on the start of the next topic with equal or higher structural hierarchy (<= level)
            end_page = default_end_page
            for j in range(index + 1, len(sections)):
                next_sec = sections[j]
                next_level = next_sec.get("level", 1)
                next_start = next_sec.get("page_num", start_page)
                if next_level <= level:
                    if next_start > start_page:
                        end_page = next_start - 1
                    else:
                        end_page = start_page
                    break
            end_page = max(start_page, end_page)

            # Maintain parent hierarchy
            while parent_stack and parent_stack[-1][0] >= level:
                parent_stack.pop()

            parent_id = parent_stack[-1][1] if parent_stack else None
            breadcrumb_parts = [p[2] for p in parent_stack] + [title]
            breadcrumb = " > ".join(breadcrumb_parts)
            topic_hash = hashlib.sha256(f"{book_id}_{title}_{start_page}_{index}".encode()).hexdigest()

            cursor.execute("""
                INSERT INTO topics (
                    book_id, parent_id, title, level, start_page, end_page,
                    sort_order, topic_hash, status, breadcrumb, content_md
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unprocessed', ?, ?)
            """, (
                book_id, parent_id, title, level, start_page, end_page,
                index, topic_hash, breadcrumb, content_md
            ))

            new_id = cursor.lastrowid
            parent_stack.append((level, new_id, title))

            created_topics.append({
                "id": new_id,
                "book_id": book_id,
                "parent_id": parent_id,
                "title": title,
                "level": level,
                "start_page": start_page,
                "end_page": end_page,
                "sort_order": index,
                "breadcrumb": breadcrumb,
                "status": "unprocessed"
            })

    logger.info("Successfully created %d subdivided topics for book %d.", len(created_topics), book_id)
    return created_topics


async def reparse_book_with_marker(book_id: int) -> dict:
    """
    Runs Marker extraction across a book's PDF and generates hierarchical topics from the resulting markdown.
    """
    from app.database import get_book_by_id, get_connection
    from app.pdf_extract import extract_raw_text
    import os

    book = get_book_by_id(book_id)
    if not book:
        raise ValueError(f"Book {book_id} not found")

    file_path = book["file_path"]
    if not os.path.exists(file_path):
        raise ValueError(f"PDF file {file_path} not found on disk")

    with open(file_path, "rb") as f:
        pdf_bytes = f.read()

    # Extract markdown with Marker (force fresh paginated extraction)
    md_text, _, _ = await extract_raw_text(pdf_bytes, 1, force_refresh=True)

    # Check for placeholder topics
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, title FROM topics WHERE book_id = ?", (book_id,))
        existing_topics = cursor.fetchall()

    placeholder_id = None
    if len(existing_topics) == 1 and existing_topics[0]["title"] in ("Full Document", "Untitled"):
        placeholder_id = existing_topics[0]["id"]
    elif len(existing_topics) > 1:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM topics WHERE book_id = ?", (book_id,))

    created = subdivide_topic_from_markdown(
        book_id=book_id,
        placeholder_topic_id=placeholder_id,
        md_text=md_text,
        default_start_page=1,
        default_end_page=book.get("total_pages", 1)
    )

    return {
        "book_id": book_id,
        "topic_count": len(created),
        "topics": created
    }

