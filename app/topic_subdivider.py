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


from pydantic import BaseModel, Field

class ReconciledSubtopic(BaseModel):
    title: str = Field(description="Synthesized formal title of the subtopic")
    start_page: int = Field(description="Starting page number (1-based)")
    end_page: int = Field(description="Ending page number (1-based)")

class ReconciledChapter(BaseModel):
    title: str = Field(description="Synthesized formal title of the chapter/module")
    start_page: int = Field(description="Starting page number (1-based)")
    end_page: int = Field(description="Ending page number (1-based)")
    subtopics: List[ReconciledSubtopic] = Field(default_factory=list, description="Subtopics/sections within this chapter")

class ReconciledOutline(BaseModel):
    chapters: List[ReconciledChapter] = Field(description="List of academic chapters/modules in order")


async def reconcile_handwritten_outline_with_llm(
    sections: List[Dict[str, Any]],
    book_title: str,
    total_pages: int
) -> Optional[List[Dict[str, Any]]]:
    """
    Calls configured LLM provider to synthesize formal academic Chapter (level 1)
    and Subtopic (level 2) structure from raw candidate headings and page snippets.
    Returns list of normalized chapter dicts or None on failure/unavailability.
    """
    import json
    from app.config import settings
    from app.llm_providers.factory import get_llm_provider
    from app.prompt_manager import get_prompt_template

    try:
        provider = get_llm_provider(settings)
    except Exception as e:
        logger.warning("Could not load LLM provider for outline reconciliation: %s", e)
        return None

    # Prepare compact candidate summaries
    candidates = []
    for i, s in enumerate(sections):
        candidates.append({
            "candidate_id": i + 1,
            "page": s.get("page_num", 1),
            "raw_heading": s.get("clean_title") or s.get("heading", ""),
            "page_excerpt": s.get("snippet", "")[:350]
        })

    prompt_template = get_prompt_template("handwritten_outline_reconcile_prompt")
    prompt = prompt_template.format(
        book_title=book_title or "Course Lecture Notes",
        total_pages=total_pages,
        candidates_json=json.dumps(candidates, indent=2)
    )

    try:
        raw_res = await provider.generate(
            prompt=prompt,
            json_schema=ReconciledOutline.model_json_schema(),
            temperature=0.1,
            max_tokens=4096,
            feature="outline_reconcile"
        )
        res_text = raw_res.strip()
        if "```json" in res_text:
            res_text = res_text.split("```json")[1].split("```")[0].strip()
        elif "```" in res_text:
            res_text = res_text.split("```")[1].split("```")[0].strip()

        data = json.loads(res_text)
        chapters = data.get("chapters", [])
        if not chapters or not isinstance(chapters, list):
            return None

        # Validate and sanitize page bounds
        validated_chapters = []
        for ch in chapters:
            ch_title = str(ch.get("title", "")).strip()
            if not ch_title:
                continue
            start_p = max(1, min(total_pages, int(ch.get("start_page", 1))))
            end_p = max(start_p, min(total_pages, int(ch.get("end_page", total_pages))))

            subtopics = []
            for sub in ch.get("subtopics", []):
                sub_title = str(sub.get("title", "")).strip()
                if not sub_title:
                    continue
                sub_start = max(start_p, min(end_p, int(sub.get("start_page", start_p))))
                sub_end = max(sub_start, min(end_p, int(sub.get("end_page", end_p))))
                subtopics.append({
                    "title": sub_title,
                    "level": 2,
                    "start_page": sub_start,
                    "end_page": sub_end
                })

            # Ensure subtopics have non-overlapping, ascending end_pages
            for s_idx in range(len(subtopics)):
                if s_idx < len(subtopics) - 1:
                    next_s_start = subtopics[s_idx + 1]["start_page"]
                    if next_s_start > subtopics[s_idx]["start_page"]:
                        subtopics[s_idx]["end_page"] = min(subtopics[s_idx]["end_page"], next_s_start - 1)
                else:
                    subtopics[s_idx]["end_page"] = end_p

            validated_chapters.append({
                "title": ch_title,
                "level": 1,
                "start_page": start_p,
                "end_page": end_p,
                "subtopics": subtopics
            })

        return validated_chapters if validated_chapters else None
    except Exception as e:
        logger.warning("LLM outline reconciliation failed: %s. Falling back to deterministic clustering.", e)
        return None


def deterministic_fallback_reconcile(
    sections: List[Dict[str, Any]],
    total_pages: int,
    default_start_page: int = 1,
    default_end_page: int = 1
) -> List[Dict[str, Any]]:
    """
    Deterministic rule-based hierarchy builder when LLM is unavailable:
    1. Detects chapter keywords (Chapter, Ch, Chap, Module, Lecture, Unit, Part) or decimal numbers (e.g. 4.1, 4.4).
    2. Groups subsequent sections under active chapters so no chapter is left empty.
    3. Normalizes levels to Chapter (Level 1 within fallback) and Subtopics (Level 2).
    """
    import re

    CHAP_REGEX = re.compile(r'\b(?:Chapter|Ch|Chap|Module|Lecture|Unit|Part)\s*[-.:#]?\s*(\d+)', re.I)
    DEC_REGEX = re.compile(r'\b(\d+)\.(\d+)\b')

    has_decimals = any(DEC_REGEX.search(s.get("clean_title", "")) for s in sections)
    has_chapters = any(CHAP_REGEX.search(s.get("clean_title", "")) for s in sections)

    if has_decimals or has_chapters:
        chapters = []
        current_chapter = None

        for sec in sections:
            title = sec.get("clean_title") or sec.get("heading", "")
            start_p = sec.get("page_num", default_start_page)
            chap_match = CHAP_REGEX.search(title)
            dec_match = DEC_REGEX.search(title)

            if chap_match:
                major_num = int(chap_match.group(1))
                if current_chapter:
                    chapters.append(current_chapter)
                current_chapter = {
                    "title": title,
                    "level": 1,
                    "start_page": start_p,
                    "end_page": total_pages,
                    "major": major_num,
                    "subtopics": []
                }
            elif dec_match:
                major_num = int(dec_match.group(1))
                if not current_chapter or current_chapter.get("major") != major_num:
                    if current_chapter:
                        chapters.append(current_chapter)
                    current_chapter = {
                        "title": f"Chapter {major_num}",
                        "level": 1,
                        "start_page": start_p,
                        "end_page": total_pages,
                        "major": major_num,
                        "subtopics": []
                    }
                current_chapter["subtopics"].append({
                    "title": title,
                    "level": 2,
                    "start_page": start_p,
                    "end_page": total_pages
                })
            else:
                # Ordinary non-chapter, non-decimal heading
                if current_chapter:
                    # Adopt as subtopic of current chapter!
                    current_chapter["subtopics"].append({
                        "title": title,
                        "level": 2,
                        "start_page": start_p,
                        "end_page": total_pages
                    })
                else:
                    # Pre-chapter intro topic: start an introductory chapter
                    current_chapter = {
                        "title": "Introduction & Fundamentals",
                        "level": 1,
                        "start_page": start_p,
                        "end_page": total_pages,
                        "major": None,
                        "subtopics": [{
                            "title": title,
                            "level": 2,
                            "start_page": start_p,
                            "end_page": total_pages
                        }]
                    }

        if current_chapter:
            chapters.append(current_chapter)

        # Fix end_pages
        for c_idx, ch in enumerate(chapters):
            if c_idx < len(chapters) - 1:
                next_start = chapters[c_idx + 1]["start_page"]
                ch["end_page"] = max(ch["start_page"], next_start - 1)
            else:
                ch["end_page"] = total_pages

            subs = ch.get("subtopics", [])
            for s_idx, sub in enumerate(subs):
                if s_idx < len(subs) - 1:
                    next_sub_start = subs[s_idx + 1]["start_page"]
                    sub["end_page"] = max(sub["start_page"], next_sub_start - 1)
                else:
                    sub["end_page"] = ch["end_page"]

        return chapters

    # Standard level-based tree
    # Group into level 1 chapters and nested subtopics
    min_level = min(s.get("level", 1) for s in sections)
    chapters = []
    current_chapter = None

    for sec in sections:
        title = sec.get("clean_title") or sec.get("heading", "")
        lvl = sec.get("level", 1)
        start_p = sec.get("page_num", default_start_page)

        if lvl == min_level or current_chapter is None:
            if current_chapter:
                chapters.append(current_chapter)
            current_chapter = {
                "title": title,
                "level": 1,
                "start_page": start_p,
                "end_page": total_pages,
                "subtopics": []
            }
        else:
            current_chapter["subtopics"].append({
                "title": title,
                "level": lvl - min_level + 1,
                "start_page": start_p,
                "end_page": total_pages
            })

    if current_chapter:
        chapters.append(current_chapter)

    # Fix end_pages
    for c_idx, ch in enumerate(chapters):
        if c_idx < len(chapters) - 1:
            next_start = chapters[c_idx + 1]["start_page"]
            ch["end_page"] = max(ch["start_page"], next_start - 1)
        else:
            ch["end_page"] = total_pages

        subs = ch.get("subtopics", [])
        for s_idx, sub in enumerate(subs):
            if s_idx < len(subs) - 1:
                next_sub_start = subs[s_idx + 1]["start_page"]
                sub["end_page"] = max(sub["start_page"], next_sub_start - 1)
            else:
                sub["end_page"] = ch["end_page"]

    return chapters


async def subdivide_topic_from_markdown(
    book_id: int,
    placeholder_topic_id: Optional[int],
    md_text: str,
    default_start_page: int = 1,
    default_end_page: int = 1
) -> List[Dict[str, Any]]:
    """
    Parses Markdown headings, runs context-aware chapter reconciliation (LLM with deterministic fallback),
    and subdivides topics under a single top-level parent topic (e.g. 'Full Document' / Book Title)
    with chapters at Level 2 and sections/subtopics at Level 3.
    """
    if not md_text or not md_text.strip():
        return []

    sections = detect_headings(md_text, default_start_page)
    if len(sections) < 2:
        logger.info("Not enough headings found in markdown (%d) to subdivide.", len(sections))
        return []

    book = get_book_by_id(book_id)
    book_title = book.get("title", "") if book else ""
    total_pages = max(default_end_page, book.get("total_pages", default_end_page) if book else default_end_page)

    logger.info("Reconciling outline for book %d ('%s') across %d candidate sections...",
                book_id, book_title, len(sections))

    # Try LLM context-aware reconciliation first
    chapters = await reconcile_handwritten_outline_with_llm(sections, book_title, total_pages)
    if not chapters:
        chapters = deterministic_fallback_reconcile(sections, total_pages, default_start_page, default_end_page)

    # Helper to gather markdown text for a page range
    def get_content_for_range(start_p: int, end_p: int) -> str:
        texts = [s.get("text", "").strip() for s in sections if start_p <= s.get("page_num", 1) <= end_p]
        return "\n\n".join(t for t in texts if t)

    with get_connection() as conn:
        cursor = conn.cursor()

        # Determine clean root document title
        root_title = "Full Document"
        if book_title:
            clean = re.sub(r'\.pdf$', '', book_title, flags=re.IGNORECASE)
            clean = re.sub(r'[_\-]+', ' ', clean).strip()
            clean = re.sub(r'\s+', ' ', clean)
            if clean and clean.lower() not in {"untitled", "document", "pdf"}:
                root_title = clean

        root_hash = hashlib.sha256(f"{book_id}_root_1_{total_pages}".encode()).hexdigest()
        root_content = get_content_for_range(1, total_pages)

        # If placeholder_topic_id exists, reuse it as the root topic
        root_topic_id = None
        if placeholder_topic_id:
            placeholder = get_topic_by_id(placeholder_topic_id)
            if placeholder:
                cursor.execute("""
                    UPDATE topics SET
                        title = ?,
                        level = 1,
                        start_page = 1,
                        end_page = ?,
                        sort_order = 0,
                        topic_hash = ?,
                        status = 'unprocessed',
                        breadcrumb = ?,
                        content_md = ?,
                        parent_id = NULL
                    WHERE id = ?
                """, (root_title, total_pages, root_hash, root_title, root_content, placeholder_topic_id))
                root_topic_id = placeholder_topic_id

        if not root_topic_id:
            cursor.execute("""
                INSERT INTO topics (
                    book_id, parent_id, title, level, start_page, end_page,
                    sort_order, topic_hash, status, breadcrumb, content_md
                ) VALUES (?, NULL, ?, 1, 1, ?, 0, ?, 'unprocessed', ?, ?)
            """, (book_id, root_title, total_pages, root_hash, root_title, root_content))
            root_topic_id = cursor.lastrowid

        created_topics = [{
            "id": root_topic_id,
            "book_id": book_id,
            "parent_id": None,
            "title": root_title,
            "level": 1,
            "start_page": 1,
            "end_page": total_pages,
            "sort_order": 0,
            "breadcrumb": root_title,
            "status": "unprocessed"
        }]

        sort_order = 1

        for ch in chapters:
            ch_title = ch["title"]
            ch_start = ch["start_page"]
            ch_end = ch["end_page"]
            ch_content = get_content_for_range(ch_start, ch_end)
            ch_hash = hashlib.sha256(f"{book_id}_{ch_title}_{ch_start}_{sort_order}".encode()).hexdigest()
            ch_breadcrumb = f"{root_title} > {ch_title}"

            cursor.execute("""
                INSERT INTO topics (
                    book_id, parent_id, title, level, start_page, end_page,
                    sort_order, topic_hash, status, breadcrumb, content_md
                ) VALUES (?, ?, ?, 2, ?, ?, ?, ?, 'unprocessed', ?, ?)
            """, (
                book_id, root_topic_id, ch_title, ch_start, ch_end,
                sort_order, ch_hash, ch_breadcrumb, ch_content
            ))
            chapter_parent_id = cursor.lastrowid
            created_topics.append({
                "id": chapter_parent_id,
                "book_id": book_id,
                "parent_id": root_topic_id,
                "title": ch_title,
                "level": 2,
                "start_page": ch_start,
                "end_page": ch_end,
                "sort_order": sort_order,
                "breadcrumb": ch_breadcrumb,
                "status": "unprocessed"
            })
            sort_order += 1

            sub_stack = [(2, chapter_parent_id, ch_breadcrumb)]

            for sub in ch.get("subtopics", []):
                sub_title = sub["title"]
                raw_lvl = sub.get("level", 2)
                sub_lvl = max(3, raw_lvl if raw_lvl >= 3 else raw_lvl + 1)
                sub_start = sub["start_page"]
                sub_end = sub["end_page"]

                while len(sub_stack) > 1 and sub_stack[-1][0] >= sub_lvl:
                    sub_stack.pop()

                sub_parent_id = sub_stack[-1][1]
                sub_breadcrumb = f"{sub_stack[-1][2]} > {sub_title}"
                sub_content = get_content_for_range(sub_start, sub_end)
                sub_hash = hashlib.sha256(f"{book_id}_{sub_title}_{sub_start}_{sort_order}".encode()).hexdigest()

                cursor.execute("""
                    INSERT INTO topics (
                        book_id, parent_id, title, level, start_page, end_page,
                        sort_order, topic_hash, status, breadcrumb, content_md
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unprocessed', ?, ?)
                """, (
                    book_id, sub_parent_id, sub_title, sub_lvl, sub_start, sub_end,
                    sort_order, sub_hash, sub_breadcrumb, sub_content
                ))
                new_sub_id = cursor.lastrowid
                sub_stack.append((sub_lvl, new_sub_id, sub_breadcrumb))

                created_topics.append({
                    "id": new_sub_id,
                    "book_id": book_id,
                    "parent_id": sub_parent_id,
                    "title": sub_title,
                    "level": sub_lvl,
                    "start_page": sub_start,
                    "end_page": sub_end,
                    "sort_order": sort_order,
                    "breadcrumb": sub_breadcrumb,
                    "status": "unprocessed"
                })
                sort_order += 1

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

    created = await subdivide_topic_from_markdown(
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


async def reparse_book_with_marker_stream(book_id: int):
    """
    Streams SSE progress events while running Marker extraction, context-aware chapter
    synthesis, and updating topics.
    """
    import json
    import asyncio
    from app.database import get_book_by_id, get_connection
    from app.pdf_extract import extract_raw_text
    import os

    try:
        yield f"data: {json.dumps({'stage': 'analyzing_handwriting', 'status': 'processing', 'message': 'Loading document pages and checking file integrity...', 'progress': 10})}\n\n"
        await asyncio.sleep(0.1)

        book = get_book_by_id(book_id)
        if not book:
            yield f"data: {json.dumps({'status': 'error', 'message': f'Book {book_id} not found'})}\n\n"
            return

        file_path = book["file_path"]
        if not os.path.exists(file_path):
            yield f"data: {json.dumps({'status': 'error', 'message': f'PDF file {file_path} not found on disk'})}\n\n"
            return

        with open(file_path, "rb") as f:
            pdf_bytes = f.read()

        yield f"data: {json.dumps({'stage': 'analyzing_handwriting', 'status': 'processing', 'message': 'Running Marker AI to extract handwriting, headings, and formulas...', 'progress': 30})}\n\n"
        await asyncio.sleep(0.1)

        # Extract markdown with Marker (force fresh paginated extraction)
        md_text, _, _ = await extract_raw_text(pdf_bytes, 1, force_refresh=True)

        yield f"data: {json.dumps({'stage': 'analyzing_handwriting', 'status': 'processing', 'message': 'Filtering noise & synthesizing academic chapter outline from context...', 'progress': 75})}\n\n"
        await asyncio.sleep(0.1)

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

        yield f"data: {json.dumps({'stage': 'analyzing_handwriting', 'status': 'processing', 'message': 'Structuring hierarchical chapters and subtopics...', 'progress': 90})}\n\n"
        await asyncio.sleep(0.1)

        created = await subdivide_topic_from_markdown(
            book_id=book_id,
            placeholder_topic_id=placeholder_id,
            md_text=md_text,
            default_start_page=1,
            default_end_page=book.get("total_pages", 1)
        )

        yield f"data: {json.dumps({'status': 'complete', 'stage': 'complete', 'message': f'Successfully generated {len(created)} structured topics!', 'progress': 100, 'topic_count': len(created), 'topics': created})}\n\n"

    except Exception as e:
        logger.error("Error in reparse_book_with_marker_stream for book %d: %s", book_id, e)
        yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"



