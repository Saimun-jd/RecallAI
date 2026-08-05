import asyncio
import logging
import os
import tempfile
from contextlib import asynccontextmanager
from fastapi import FastAPI, Form, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import json
import httpx
from pydantic import BaseModel
from typing import Optional
from platformdirs import user_data_dir

DATA_DIR = user_data_dir("Recall", "Recall")
PARSED_DOCS_DIR = os.path.join(DATA_DIR, "parsed_docs")

from app.chunk_builder import build_chunks
from app.database import (
    init_db, save_book, resolve_and_save_topic, save_flashcards,
    get_connection, get_setting, set_setting,
    save_annotation, get_annotations_for_page, get_annotations_for_book,
    update_annotation as db_update_annotation, delete_annotation as db_delete_annotation
)
from app.heading_detect import detect_headings
from app.llm_segment import extract_atomic_concepts, explain_selected_text, generate_flashcards_from_selection
from app.pdf_extract import extract_raw_text
from app.prefilter import is_valid_section
from app.schemas import Chunk
from app.markdown_ast import parse_markdown_assets


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    os.makedirs(PARSED_DOCS_DIR, exist_ok=True)
    yield


app = FastAPI(title="Chunking Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "tauri://localhost", 
        "https://tauri.localhost", 
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=PARSED_DOCS_DIR), name="static")

logger = logging.getLogger(__name__)

# Concurrency limit based on VRAM constraints (e.g. RTX 3050 6GB)
OLLAMA_SEMAPHORE = None

async def process_section(sec: dict, chapter_title: str, skip_chapter_filter: bool, code_blocks: dict, images: dict, provider_override: str = None, book_id: int = None, book_hash: str = None) -> list[Chunk]:
    global OLLAMA_SEMAPHORE
    if OLLAMA_SEMAPHORE is None:
        OLLAMA_SEMAPHORE = asyncio.Semaphore(2)
    """Process a single section through the LLM with concurrency throttling."""
    heading, text, page_num = sec["heading"], sec["text"], sec.get("page_num")

    # Always filter by chapter_title if provided, but use robust matching
    # to avoid Unicode or markdown bolding mismatches.
    if chapter_title and not skip_chapter_filter:
        clean_target = chapter_title.lower().replace('*', '').strip()
        clean_heading = heading.lower().replace('*', '').strip()
        
        # If the target is not a substring of the heading and vice-versa, skip it
        if clean_target not in clean_heading and clean_heading not in clean_target:
            return []

    if not is_valid_section(heading, text):
        return []

    try:
        async with OLLAMA_SEMAPHORE:
            section_extraction = await extract_atomic_concepts(heading, text, code_blocks, images, provider_override)
            
        if book_id:
            breadcrumb = chapter_title or heading
            parent_topic_id = await resolve_and_save_topic(
                book_id=book_id, book_hash=book_hash, breadcrumb=breadcrumb,
                title=heading, level=1, start_page=page_num, end_page=page_num, content_md=text,
                provider_override=provider_override
            )
            
        chunks = build_chunks(section_extraction, chapter_title, page_num, code_blocks, images)
        
        if book_id:
            for chunk in chunks:
                key_terms_json = json.dumps(chunk.key_terms) if chunk.key_terms else None
                chunk_breadcrumb = f"{chapter_title or heading} > {chunk.topic_name}"
                t_id = await resolve_and_save_topic(
                    book_id=book_id,
                    book_hash=book_hash,
                    breadcrumb=chunk_breadcrumb,
                    title=chunk.topic_name,
                    level=2,
                    parent_id=parent_topic_id,
                    start_page=page_num,
                    end_page=page_num,
                    summary=chunk.summary,
                    concept_type=chunk.concept_type,
                    key_terms=key_terms_json,
                    code_snippet=chunk.code_snippet,
                    image_url=chunk.image_url,
                    provider_override=provider_override
                )
                chunk.topic_id = t_id
                # Attach breadcrumb to chunk so API returns it
                chunk.breadcrumb = chunk_breadcrumb
            
        return chunks
    except httpx.HTTPError as e:
        # Bubble up critical provider failures
        raise e
    except Exception as e:
        logger.error(f"Failed to process section '{heading}': {e}")
        return []



@app.post("/books/upload")
async def upload_and_parse_toc(
    file: UploadFile,
    file_hash: str = Form(...),
    book_title: str = Form(...),
    total_pages: int = Form(default=0)
):
    try:
        pdf_bytes = await file.read()
        
        # Save file to disk
        file_path = os.path.join(PARSED_DOCS_DIR, f"{file_hash}.pdf")
        with open(file_path, "wb") as f:
            f.write(pdf_bytes)
            
        # Check if book exists
        from app.database import save_book, get_connection
        book_id = save_book(title=book_title, file_path=file_path, file_hash=file_hash, total_pages=total_pages)
        
        # Check if topics are already inserted for this book
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as c FROM topics WHERE book_id = ?", (book_id,))
            existing_topics = cursor.fetchone()["c"]
            
        if existing_topics > 0:
            return {"book_id": book_id, "status": "cached", "topic_count": existing_topics}
        
        from fastapi.concurrency import run_in_threadpool
        import fitz
        from app.toc_parser import get_toc_entries, build_granular_toc
        
        def extract_toc():
            doc = fitz.open(file_path)
            toc = get_toc_entries(doc)
            total = doc.page_count
            granular_toc = build_granular_toc(toc, total)
            doc.close()
            return granular_toc
            
        toc = await run_in_threadpool(extract_toc)
        
        # Bulk insert topics with unprocessed status
        from app.database import insert_topics_bulk
        topic_count = insert_topics_bulk(book_id, toc)
        
        return {"book_id": book_id, "status": "cached", "topic_count": topic_count}
    except Exception as e:
        import traceback
        logger.error(f"Failed to upload or parse PDF: {e}\n{traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"error": str(e)})


from fastapi.responses import FileResponse

@app.get("/books/{book_id}/pdf")
async def get_book_pdf(book_id: int):
    from app.database import get_book_by_id
    book = get_book_by_id(book_id)
    if not book:
        return JSONResponse(status_code=404, content={"error": "Book not found"})
        
    file_path = book["file_path"]
    if not os.path.exists(file_path):
        return JSONResponse(status_code=404, content={"error": "PDF file not found on disk"})
        
    # FileResponse natively supports Range headers if stat_result is obtained (which it does internally)
    return FileResponse(path=file_path, media_type="application/pdf", filename=os.path.basename(file_path))


from pydantic import BaseModel

class SectionSelection(BaseModel):
    title: str
    start_page: int
    end_page: int

class ProcessRequest(BaseModel):
    selected_sections: list[SectionSelection]
    provider: str | None = None

@app.post("/books/{book_id}/process-stream")
async def process_book_stream(book_id: int, req: ProcessRequest):
    from app.database import get_book_by_id
    import fitz
    
    book = get_book_by_id(book_id)
    if not book:
        return JSONResponse(status_code=404, content={"error": "Book not found"})
        
    file_path = book["file_path"]
    file_hash = book["file_hash"]
    
    if not os.path.exists(file_path):
        return JSONResponse(status_code=404, content={"error": "PDF file not found on disk"})
        
    async def event_generator():
        try:
            doc = fitz.open(file_path)
            
            chunk_queue = []
            max_pages = 4
            for section in req.selected_sections:
                sub_ranges = []
                curr_start = section.start_page
                while curr_start <= section.end_page:
                    curr_end = min(curr_start + max_pages - 1, section.end_page)
                    sub_ranges.append((curr_start, curr_end))
                    curr_start = curr_end + 1
                    
                for part_idx, (p_start, p_end) in enumerate(sub_ranges, 1):
                    part_label = f" (Part {part_idx})" if len(sub_ranges) > 1 else ""
                    chunk_queue.append({
                        "title": f"{section.title}{part_label}",
                        "chapter_title": section.title,
                        "start": p_start,
                        "end": p_end,
                    })
                    
            total_chunks = len(chunk_queue)
            
            for i, chunk_item in enumerate(chunk_queue, 1):
                yield f"data: {json.dumps({'status': 'processing', 'chunk': i, 'total_chunks': total_chunks, 'current_topic': chunk_item['title']})}\n\n"
                
                # Slice PDF
                start_idx = max(0, chunk_item['start'] - 1)
                end_idx = min(doc.page_count - 1, chunk_item['end'] - 1)
                new_doc = fitz.open()
                new_doc.insert_pdf(doc, from_page=start_idx, to_page=end_idx)
                pdf_bytes = new_doc.write()
                new_doc.close()
                
                # Process the slice
                from fastapi.concurrency import run_in_threadpool
                md_text, cache_key, start_page_num = await run_in_threadpool(extract_raw_text, pdf_bytes, chunk_item['start'])
                modified_md_text, code_blocks, images = parse_markdown_assets(md_text, cache_key)
                sections = detect_headings(modified_md_text, start_page_num)
                
                tasks = []
                for sec in sections:
                    sec_code_blocks = {k: v for k, v in code_blocks.items() if f"[ASSET: {k}]" in sec["text"]}
                    sec_images = {k: v for k, v in images.items() if f"[ASSET: {k}]" in sec["text"]}
                    tasks.append(
                        asyncio.create_task(process_section(sec, chunk_item['chapter_title'], True, sec_code_blocks, sec_images, req.provider, book_id, file_hash))
                    )
                    
                total_sections = len(tasks)
                completed_sections = 0
                for coro in asyncio.as_completed(tasks):
                    await coro
                    completed_sections += 1
                    yield f"data: {json.dumps({'status': 'processing_sections', 'chunk': i, 'total_chunks': total_chunks, 'current_topic': chunk_item['title'], 'completed_sections': completed_sections, 'total_sections': total_sections})}\n\n"
                
            doc.close()
            yield f"data: {json.dumps({'status': 'complete', 'book_id': book_id})}\n\n"
            
        except Exception as e:
            import traceback
            logger.error(f"Internal Server Error in /books/{book_id}/process-stream: {e}\n{traceback.format_exc()}")

            if 'tasks' in locals():
                for t in tasks:
                    if not t.done():
                        t.cancel()

            yield f"data: {json.dumps({'status': 'error', 'error': str(e)})}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/health")
def health():
    return {"status": "ok"}

from pydantic import BaseModel

class APIKeys(BaseModel):
    gemini_api_key: str | None = None
    groq_api_key: str | None = None
    openai_api_key: str | None = None

@app.post("/settings/api-keys")
def save_api_keys(keys: APIKeys):
    import os
    if keys.gemini_api_key is not None:
        set_setting("gemini_api_key", keys.gemini_api_key)
        os.environ["GEMINI_API_KEY"] = keys.gemini_api_key
    if keys.groq_api_key is not None:
        set_setting("groq_api_key", keys.groq_api_key)
        os.environ["GROQ_API_KEY"] = keys.groq_api_key
    if keys.openai_api_key is not None:
        set_setting("openai_api_key", keys.openai_api_key)
        os.environ["OPENAI_API_KEY"] = keys.openai_api_key
    return {"status": "updated"}

@app.get("/settings/api-keys", response_model=APIKeys)
def get_api_keys():
    return {
        "gemini_api_key": get_setting("gemini_api_key") or "",
        "groq_api_key": get_setting("groq_api_key") or "",
        "openai_api_key": get_setting("openai_api_key") or ""
    }


from pydantic import BaseModel

class FlashcardGenerationRequest(BaseModel):
    count: int = 5
    custom_prompt: str | None = None
    summary_override: str | None = None
    provider_override: str | None = None

class ProcessTopicRequest(BaseModel):
    provider_override: str | None = None

@app.post("/topics/{topic_id}/process-stream")
async def process_topic_stream(topic_id: int, req: ProcessTopicRequest):
    from app.database import get_topic_by_id, update_topic_status, get_book_by_id
    from app.pdf_extract import extract_raw_text
    import fitz
    
    topic = get_topic_by_id(topic_id)
    if not topic:
        return JSONResponse(status_code=404, content={"error": "Topic not found"})
        
    book = get_book_by_id(topic["book_id"])
    if not book:
        return JSONResponse(status_code=404, content={"error": "Book not found"})
        
    file_path = book["file_path"]
    if not os.path.exists(file_path):
        return JSONResponse(status_code=404, content={"error": "PDF file not found on disk"})
        
    async def event_generator():
        try:
            update_topic_status(topic_id, "processing")
            
            yield f"data: {json.dumps({'stage': 'reading_pdf'})}\n\n"
            
            # Slice PDF to the topic's page range
            doc = fitz.open(file_path)
            start_idx = max(0, topic['start_page'] - 1)
            end_idx = min(doc.page_count - 1, topic['end_page'] - 1)
            new_doc = fitz.open()
            new_doc.insert_pdf(doc, from_page=start_idx, to_page=end_idx)
            pdf_bytes = new_doc.write()
            new_doc.close()
            doc.close()
            
            from fastapi.concurrency import run_in_threadpool
            md_text, cache_key, start_page_num = await run_in_threadpool(extract_raw_text, pdf_bytes, topic['start_page'])
            modified_md_text, code_blocks, images = parse_markdown_assets(md_text, cache_key)
            sections = detect_headings(modified_md_text, start_page_num)
            
            yield f"data: {json.dumps({'stage': 'extracting_topics', 'section_count': len(sections)})}\n\n"
            
            # Process each detected section through LLM to extract atomic concepts (child topics)
            book_id = topic["book_id"]
            file_hash = book["file_hash"]
            chapter_title = topic["title"]
            child_count = 0
            
            tasks = []
            for sec in sections:
                sec_code_blocks = {k: v for k, v in code_blocks.items() if f"[ASSET: {k}]" in sec["text"]}
                sec_images = {k: v for k, v in images.items() if f"[ASSET: {k}]" in sec["text"]}
                tasks.append(
                    asyncio.create_task(process_section(sec, chapter_title, True, sec_code_blocks, sec_images, req.provider_override, book_id, file_hash))
                )
            
            total_tasks = len(tasks)
            completed_tasks = 0
            
            # Now associate each generated chunk/topic as a child of topic_id
            for future in asyncio.as_completed(tasks):
                chunk_list = await future
                completed_tasks += 1
                yield f"data: {json.dumps({'stage': 'extracting_topics', 'progress': int((completed_tasks / max(total_tasks, 1)) * 100)})}\n\n"
                for chunk in chunk_list:
                    if hasattr(chunk, 'topic_id') and chunk.topic_id:
                        # Update the generated topic's parent_id to point to the clicked topic
                        with get_connection() as conn:
                            cursor = conn.cursor()
                            cursor.execute(
                                "UPDATE topics SET parent_id = ?, status = 'processed' WHERE id = ?",
                                (topic_id, chunk.topic_id)
                            )
                        child_count += 1
            
            # Mark the parent topic as processed
            update_topic_status(topic_id, "processed")
            
            yield f"data: {json.dumps({'status': 'complete', 'child_count': child_count})}\n\n"
            
        except Exception as e:
            import traceback
            logger.error(f"Error processing topic {topic_id}: {e}\n{traceback.format_exc()}")
            update_topic_status(topic_id, "unprocessed")

            if 'tasks' in locals():
                for t in tasks:
                    if not t.done():
                        t.cancel()

            yield f"data: {json.dumps({'status': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/topics/{topic_id}/flashcards")
async def generate_topic_flashcards(topic_id: int, req: FlashcardGenerationRequest):
    from app.database import get_topic_by_id
    from app.llm_segment import generate_flashcards_for_topic
    
    topic = get_topic_by_id(topic_id)
    if not topic:
        return JSONResponse(status_code=404, content={"error": "Topic not found"})
        
    summary = req.summary_override or topic.get("summary") or ""
    # We pass the parent's content_md as context if it exists, or the topic's own content_md
    topic_text = topic.get("content_md") or ""
    
    if not topic_text and topic.get("parent_id"):
        parent = get_topic_by_id(topic.get("parent_id"))
        if parent:
            topic_text = parent.get("content_md") or ""
            
    flashcard_list = await generate_flashcards_for_topic(
        topic_name=topic.get("title", ""),
        breadcrumb=topic.get("breadcrumb", ""),
        topic_text=topic_text,
        summary=summary,
        count=req.count,
        custom_prompt=req.custom_prompt,
        provider_override=req.provider_override
    )
    
    # Save the generated flashcards
    # Flashcard schema needs topic_name, concept_type, etc., which are on the topic
    cards_to_save = []
    for fc in flashcard_list.flashcards:
        card_dict = fc.model_dump()
        card_dict["topic_name"] = topic.get("title", "")
        card_dict["breadcrumb"] = topic.get("breadcrumb", "")
        card_dict["source_page"] = topic.get("start_page")
        cards_to_save.append(card_dict)
        
    inserted = save_flashcards(topic_id, cards_to_save)
    
    return {
        "status": "success",
        "topic_id": topic_id,
        "flashcards_generated": inserted,
        "flashcards": cards_to_save
    }


@app.get("/topics/{topic_id}/related")
def get_related_topics(topic_id: int, limit: int = 5):
    from app.database import get_topic_by_id, get_connection
    from app.embeddings import cosine_similarity
    
    topic = get_topic_by_id(topic_id)
    if not topic or not topic.get("embedding"):
        return JSONResponse(status_code=404, content={"error": "Topic or embedding not found"})
        
    try:
        target_emb = json.loads(topic["embedding"])
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Invalid embedding format"})
        
    related = []
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, breadcrumb, summary, embedding FROM topics WHERE id != ? AND embedding IS NOT NULL", (topic_id,))
        rows = cursor.fetchall()
        
        for r in rows:
            try:
                emb = json.loads(r["embedding"])
                sim = cosine_similarity(target_emb, emb)
                related.append({
                    "id": r["id"],
                    "title": r["title"],
                    "breadcrumb": r["breadcrumb"],
                    "summary": r["summary"],
                    "similarity": sim
                })
            except Exception:
                continue
                
    # Sort descending by similarity
    related.sort(key=lambda x: x["similarity"], reverse=True)
    return related[:limit]


@app.get("/flashcards")
def get_flashcards(topic_id: int | None = None, book_id: int | None = None):
    with get_connection() as conn:
        cursor = conn.cursor()
        query = "SELECT f.* FROM flashcards f"
        params = []
        if book_id is not None:
            query += " JOIN topics t ON f.topic_id = t.id WHERE t.book_id = ?"
            params.append(book_id)
            if topic_id is not None:
                query += " AND f.topic_id = ?"
                params.append(topic_id)
        elif topic_id is not None:
            query += " WHERE f.topic_id = ?"
            params.append(topic_id)
            
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

@app.get("/settings")
def get_all_settings():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM settings")
        rows = cursor.fetchall()
        return {row["key"]: row["value"] for row in rows}

from pydantic import BaseModel
class SettingUpdate(BaseModel):
    value: str

@app.put("/settings/{key}")
def update_setting(key: str, data: SettingUpdate):
    set_setting(key, data.value)
    return {"status": "success", "key": key, "value": data.value}

class ReviewRequest(BaseModel):
    rating: int

@app.get("/flashcards/due")
def get_due_flashcards_api(limit: int = 20):
    from app.database import get_due_flashcards
    return get_due_flashcards(limit=limit)

@app.post("/flashcards/{card_id}/review")
def review_flashcard_api(card_id: int, req: ReviewRequest):
    from app.database import get_connection, update_flashcard_fsrs_state, save_undo_state
    from app.fsrs import review_card
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM flashcards WHERE id = ?", (card_id,))
        row = cursor.fetchone()
        
    if not row:
        return JSONResponse(status_code=404, content={"error": "Card not found"})
        
    card_data = dict(row)
    
    # Save current state for undo
    save_undo_state(card_id, card_data)
    
    try:
        updated_fsrs_data = review_card(card_data, req.rating)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
        
    update_flashcard_fsrs_state(card_id, updated_fsrs_data, req.rating)
    
    # Merge updated context for returning
    card_data.update(updated_fsrs_data)
    return card_data

@app.post("/flashcards/{card_id}/undo-review")
def undo_review_api(card_id: int):
    from app.database import undo_review
    
    previous_state = undo_review(card_id)
    if not previous_state:
        return JSONResponse(status_code=400, content={"error": "Nothing to undo for this card or undo has expired."})
        
    return {"status": "success", "restored_state": previous_state}

@app.get("/analytics/stats")
def get_analytics_stats_api():
    from app.database import get_analytics_stats
    return get_analytics_stats()

@app.get("/books")
def get_books_api(skip: int = 0, limit: int = 100):
    from app.database import get_books
    return get_books(skip, limit)

@app.get("/books/{book_id}")
def get_book_by_id_api(book_id: int):
    from app.database import get_book_by_id
    book = get_book_by_id(book_id)
    if not book:
        return JSONResponse(status_code=404, content={"error": "Book not found"})
    return book

@app.delete("/books/{book_id}")
def delete_book_api(book_id: int):
    from app.database import delete_book
    success = delete_book(book_id)
    if not success:
        return JSONResponse(status_code=404, content={"error": "Book not found"})
    return {"status": "success"}

@app.get("/topics")
def get_topics_api(book_id: int | None = None, skip: int = 0, limit: int = 100):
    from app.database import get_topics
    return get_topics(book_id, skip, limit)

@app.get("/topics/{topic_id}")
def get_topic_by_id_api(topic_id: int):
    from app.database import get_topic_by_id
    topic = get_topic_by_id(topic_id)
    if not topic:
        return JSONResponse(status_code=404, content={"error": "Topic not found"})
    return topic

class NoteUpdate(BaseModel):
    note: str

@app.get("/topics/{topic_id}/notes")
def get_topic_notes_api(topic_id: int):
    from app.database import get_note_by_topic
    note = get_note_by_topic(topic_id)
    return {"topic_id": topic_id, "note": note}

@app.put("/topics/{topic_id}/notes")
def update_topic_notes_api(topic_id: int, req: NoteUpdate):
    from app.database import save_note_for_topic
    save_note_for_topic(topic_id, req.note)
    return {"status": "success"}

@app.get("/flashcards/{card_id}")
def get_flashcard_by_id_api(card_id: int):
    from app.database import get_flashcard_by_id
    card = get_flashcard_by_id(card_id)
    if not card:
        return JSONResponse(status_code=404, content={"error": "Flashcard not found"})
    return card

class FlashcardUpdate(BaseModel):
    question: str
    answer: str

@app.put("/flashcards/{card_id}")
def update_flashcard_api(card_id: int, req: FlashcardUpdate):
    from app.database import update_flashcard
    success = update_flashcard(card_id, req.question, req.answer)
    if not success:
        return JSONResponse(status_code=404, content={"error": "Flashcard not found"})
    return {"status": "success"}

@app.delete("/flashcards/{card_id}")
def delete_flashcard_api(card_id: int):
    from app.database import delete_flashcard
    success = delete_flashcard(card_id)
    if not success:
        return JSONResponse(status_code=404, content={"error": "Flashcard not found"})
    return {"status": "success"}

@app.post("/flashcards/{card_id}/reset")
def reset_flashcard_api(card_id: int):
    from app.database import reset_flashcard_fsrs_state
    success = reset_flashcard_fsrs_state(card_id)
    if not success:
        return JSONResponse(status_code=404, content={"error": "Flashcard not found"})
    return {"status": "success"}

@app.get("/flashcards/export")
def export_flashcards_api():
    from app.database import get_connection
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT f.id, f.question, f.answer, t.title as topic_title, b.title as book_title
            FROM flashcards f
            LEFT JOIN topics t ON f.topic_id = t.id
            LEFT JOIN books b ON t.book_id = b.id
        """)
        return [dict(row) for row in cursor.fetchall()]

@app.get("/search")
def search_api(query: str):
    from app.database import get_connection
    if not query:
        return []
        
    with get_connection() as conn:
        cursor = conn.cursor()
        q = f"%{query}%"
        
        cursor.execute("SELECT id, title as text, 'topic' as type FROM topics WHERE title LIKE ? LIMIT 10", (q,))
        topics = [dict(row) for row in cursor.fetchall()]
        
        cursor.execute("SELECT id, question as text, 'flashcard' as type FROM flashcards WHERE question LIKE ? LIMIT 10", (q,))
        cards = [dict(row) for row in cursor.fetchall()]
        
        return topics + cards


# ─── PDF Annotation Endpoints ───

class AnnotationCreate(BaseModel):
    page_number: int
    annotation_type: str  # 'ai_explanation' | 'sidenote' | 'flashcard_link'
    selected_text: str
    rect_json: str
    content: Optional[str] = None
    custom_prompt: Optional[str] = None

class AnnotationUpdate(BaseModel):
    content: str

class ExplainRequest(BaseModel):
    selected_text: str
    custom_prompt: Optional[str] = None
    page_number: int
    rect_json: str
    save: bool = True

class FlashcardSelectionRequest(BaseModel):
    selected_text: str
    custom_prompt: Optional[str] = None
    count: int = 5
    page_number: int
    rect_json: str
    save: bool = True


@app.post("/books/{book_id}/annotations")
def create_annotation(book_id: int, body: AnnotationCreate):
    """Create a new annotation (sidenote, etc.)."""
    ann_id = save_annotation(
        book_id=book_id,
        page_number=body.page_number,
        annotation_type=body.annotation_type,
        selected_text=body.selected_text,
        rect_json=body.rect_json,
        content=body.content,
        custom_prompt=body.custom_prompt,
    )
    return {"id": ann_id, "status": "created"}


@app.get("/books/{book_id}/annotations")
def get_annotations(book_id: int, page: int = None):
    """Get annotations for a book, optionally filtered by page number."""
    if page is not None:
        return get_annotations_for_page(book_id, page)
    return get_annotations_for_book(book_id)


@app.put("/annotations/{annotation_id}")
def update_annotation_endpoint(annotation_id: int, body: AnnotationUpdate):
    """Update an annotation's content."""
    success = db_update_annotation(annotation_id, body.content)
    if not success:
        return JSONResponse(status_code=404, content={"error": "Annotation not found"})
    return {"status": "updated"}


@app.delete("/annotations/{annotation_id}")
def delete_annotation_endpoint(annotation_id: int):
    """Delete an annotation."""
    success = db_delete_annotation(annotation_id)
    if not success:
        return JSONResponse(status_code=404, content={"error": "Annotation not found"})
    return {"status": "deleted"}


@app.post("/books/{book_id}/annotations/explain")
async def explain_annotation(book_id: int, body: ExplainRequest):
    """AI-explain selected text and save as annotation."""
    try:
        # Get provider override from settings
        provider_override = None
        try:
            provider_json = get_setting("llm_provider")
            if provider_json:
                provider_data = json.loads(provider_json)
                provider_override = provider_data.get("type")
        except Exception:
            pass

        explanation = await explain_selected_text(
            selected_text=body.selected_text,
            custom_prompt=body.custom_prompt,
            provider_override=provider_override,
        )

        ann_id = -1
        if body.save:
            ann_id = save_annotation(
                book_id=book_id,
                page_number=body.page_number,
                annotation_type="ai_explanation",
                selected_text=body.selected_text,
                rect_json=body.rect_json,
                content=explanation,
                custom_prompt=body.custom_prompt,
            )

        return {
            "id": ann_id,
            "annotation_type": "ai_explanation",
            "content": explanation,
            "selected_text": body.selected_text,
            "page_number": body.page_number,
            "rect_json": body.rect_json,
        }
    except Exception as e:
        logger.error(f"AI explanation failed: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/books/{book_id}/annotations/generate-flashcards")
async def generate_flashcards_annotation(book_id: int, body: FlashcardSelectionRequest):
    """Generate flashcards from selected text and save as annotation."""
    try:
        # Get provider override from settings
        provider_override = None
        try:
            provider_json = get_setting("llm_provider")
            if provider_json:
                provider_data = json.loads(provider_json)
                provider_override = provider_data.get("type")
        except Exception:
            pass

        flashcards = await generate_flashcards_from_selection(
            selected_text=body.selected_text,
            count=body.count,
            custom_prompt=body.custom_prompt,
            provider_override=provider_override,
        )

        ann_id = -1
        if body.save:
            # Save a flashcard_link annotation
            ann_id = save_annotation(
                book_id=book_id,
                page_number=body.page_number,
                annotation_type="flashcard_link",
                selected_text=body.selected_text,
                rect_json=body.rect_json,
                content=json.dumps(flashcards),
                custom_prompt=body.custom_prompt,
            )

        return {
            "id": ann_id,
            "annotation_type": "flashcard_link",
            "flashcards": flashcards,
            "selected_text": body.selected_text,
            "page_number": body.page_number,
            "rect_json": body.rect_json,
        }
    except Exception as e:
        logger.error(f"Flashcard generation from selection failed: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/books/{book_id}/export-annotated")
def export_annotated_pdf(book_id: int):
    """Export the PDF with all annotations embedded as sticky notes and highlights."""
    from app.pdf_export import generate_annotated_pdf
    from fastapi.responses import FileResponse
    
    output_path = generate_annotated_pdf(book_id)
    if not output_path:
        return JSONResponse(status_code=404, content={"error": "Could not generate annotated PDF"})
    
    # Get the book title for the filename
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT title FROM books WHERE id = ?", (book_id,))
        row = cursor.fetchone()
        title = row["title"] if row else "export"
    
    safe_title = "".join(c for c in title if c.isalnum() or c in " _-").strip()
    
    return FileResponse(
        path=output_path,
        media_type="application/pdf",
        filename=f"{safe_title}_annotated.pdf",
    )

