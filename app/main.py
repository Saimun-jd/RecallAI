import asyncio
import logging
import os
import tempfile
from contextlib import asynccontextmanager
from fastapi import FastAPI, Form, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import json
import httpx

from app.chunk_builder import build_chunks
from app.database import init_db, save_book, resolve_and_save_topic, save_flashcards, get_connection, get_setting, set_setting
from app.heading_detect import detect_headings
from app.llm_segment import extract_atomic_concepts
from app.pdf_extract import extract_raw_text
from app.prefilter import is_valid_section
from app.schemas import Chunk
from app.markdown_ast import parse_markdown_assets


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    os.makedirs("parsed_docs", exist_ok=True)
    yield


app = FastAPI(title="Chunking Service", lifespan=lifespan)
app.mount("/static", StaticFiles(directory="parsed_docs"), name="static")

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
                title=heading, level=1, start_page=page_num, end_page=page_num, content_md=text
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
                    image_url=chunk.image_url
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



@app.post("/chunk")
async def chunk_pdf(
    file: UploadFile,
    file_hash: str = Form(...),
    book_title: str = Form(...),
    total_pages: int = Form(default=0),
    chapter_title: str | None = Form(default=None),
    pre_sliced: str | None = Form(default=None),
    start_page: int | None = Form(default=None),
    provider: str | None = Form(default=None),
):
    pdf_bytes = await file.read()

    # When the CLI pre-slices the PDF to only the target pages, it sends
    # pre_sliced=true.  In that case we skip the chapter_title heading filter
    # (which is brittle due to Unicode mismatches) and process every section
    # found in the sliced PDF.  chapter_title is still forwarded to
    # build_chunks for breadcrumb labels.
    skip_chapter_filter = pre_sliced and pre_sliced.lower() == "true"
    
    # 1. Save or retrieve parent book
    book_id = save_book(title=book_title, file_path="", file_hash=file_hash, total_pages=total_pages)

    try:
        from fastapi.concurrency import run_in_threadpool
        md_text, cache_key, start_page_num = await run_in_threadpool(extract_raw_text, pdf_bytes, start_page)
        modified_md_text, code_blocks, images = parse_markdown_assets(md_text, cache_key)
        
        sections = detect_headings(modified_md_text, start_page_num)
        
        logger.info(f"DEBUG: Found {len(sections)} sections")
        if sections:
            logger.info(f"DEBUG: First few headings: {[s['heading'] for s in sections[:3]]}")
        
        tasks = []
        for sec in sections:
            # Filter assets to only those present in this section
            sec_code_blocks = {k: v for k, v in code_blocks.items() if f"[ASSET: {k}]" in sec["text"]}
            sec_images = {k: v for k, v in images.items() if f"[ASSET: {k}]" in sec["text"]}
            
            tasks.append(
                process_section(sec, chapter_title, skip_chapter_filter, sec_code_blocks, sec_images, provider, book_id, file_hash)
            )
            
        results = await asyncio.gather(*tasks)

        # Flatten the list of lists
        all_chunks = [chunk for sublist in results for chunk in sublist]

        # Serve response explicitly with UTF-8 character encoding headers
        return JSONResponse(
            content={"chunks": [c.model_dump() for c in all_chunks]},
            media_type="application/json; charset=utf-8",
        )
    except Exception as e:
        import traceback
        logger.error(f"Internal Server Error in /chunk: {e}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "traceback": traceback.format_exc()}
        )


@app.post("/chunk/stream")
async def chunk_pdf_stream(
    file: UploadFile,
    file_hash: str = Form(...),
    book_title: str = Form(...),
    total_pages: int = Form(default=0),
    chapter_title: str | None = Form(default=None),
    pre_sliced: str | None = Form(default=None),
    start_page: int | None = Form(default=None),
    provider: str | None = Form(default=None),
):
    pdf_bytes = await file.read()
    skip_chapter_filter = pre_sliced and pre_sliced.lower() == "true"
    
    async def event_generator():
        try:
            yield f"data: {json.dumps({'stage': 'Reading PDF slice'})}\n\n"
            from fastapi.concurrency import run_in_threadpool
            book_id = await run_in_threadpool(save_book, title=book_title, file_path="", file_hash=file_hash, total_pages=total_pages)
            
            md_text, cache_key, start_page_num = await run_in_threadpool(extract_raw_text, pdf_bytes, start_page)
            modified_md_text, code_blocks, images = parse_markdown_assets(md_text, cache_key)
            sections = detect_headings(modified_md_text, start_page_num)
            
            tasks = []
            for sec in sections:
                sec_code_blocks = {k: v for k, v in code_blocks.items() if f"[ASSET: {k}]" in sec["text"]}
                sec_images = {k: v for k, v in images.items() if f"[ASSET: {k}]" in sec["text"]}
                tasks.append(
                    process_section(sec, chapter_title, skip_chapter_filter, sec_code_blocks, sec_images, provider, book_id, file_hash)
                )
                
            yield f"data: {json.dumps({'stage': 'Waiting on LLM response', 'sections': len(tasks)})}\n\n"
            
            results = await asyncio.gather(*tasks)
            all_chunks = [chunk for sublist in results for chunk in sublist]
            
            yield f"data: {json.dumps({'stage': 'Persisting to SQLite'})}\n\n"
            yield f"data: {json.dumps({'stage': 'done', 'chunks': [c.model_dump() for c in all_chunks]})}\n\n"
        except Exception as e:
            import traceback
            logger.error(f"Internal Server Error in /chunk/stream: {e}\n{traceback.format_exc()}")
            yield f"data: {json.dumps({'stage': 'error', 'error': str(e)})}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/health")
def health():
    return {"status": "ok"}

from pydantic import BaseModel

class FlashcardGenerationRequest(BaseModel):
    count: int = 5
    custom_prompt: str | None = None
    summary_override: str | None = None
    provider_override: str | None = None

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