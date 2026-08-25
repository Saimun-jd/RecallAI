import asyncio
import logging
import os
import tempfile
from contextlib import asynccontextmanager
from fastapi import FastAPI, Form, Request, UploadFile
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
    update_annotation as db_update_annotation, delete_annotation as db_delete_annotation,
    search_all
)
from langfuse import observe
from app.heading_detect import detect_headings
from app.llm_segment import extract_atomic_concepts, explain_selected_text, generate_flashcards_from_selection
from app.pdf_extract import extract_raw_text
from app.prefilter import is_valid_section
from app.schemas import Chunk
from app.markdown_ast import parse_markdown_assets
from app.errors import RecallError, ErrorCode, classify_error, error_response, error_event, get_user_message
from app.config import settings as app_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    os.makedirs(PARSED_DOCS_DIR, exist_ok=True)
    
    sk = get_setting("langfuse_secret_key")
    pk = get_setting("langfuse_public_key")
    host = get_setting("langfuse_host") or "https://cloud.langfuse.com"
    
    if sk and pk:
        os.environ["LANGFUSE_SECRET_KEY"] = sk
        os.environ["LANGFUSE_PUBLIC_KEY"] = pk
        os.environ["LANGFUSE_HOST"] = host
        from langfuse import Langfuse
        try:
            Langfuse(public_key=pk, secret_key=sk, host=host)
        except Exception as e:
            logger.error(f"Failed to initialize Langfuse: {e}")

    yield
    
    try:
        from langfuse import get_client
        get_client().flush()
    except Exception:
        pass


app = FastAPI(title="Chunking Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "tauri://localhost", 
        "https://tauri.localhost", 
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=PARSED_DOCS_DIR), name="static")

from app.config import get_provider_concurrency

logger = logging.getLogger(__name__)

def _is_debug() -> bool:
    """Check if debug mode is enabled (shows full error details in responses)."""
    return app_settings.debug_mode


# ── Global Exception Handlers ────────────────────────────────────────────

@app.exception_handler(RecallError)
async def recall_error_handler(request: Request, exc: RecallError):
    return error_response(exc, include_debug=_is_debug())

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return error_response(exc, include_debug=_is_debug())

async def process_section(
    sec: dict, 
    chapter_title: str, 
    skip_chapter_filter: bool, 
    code_blocks: dict, 
    images: dict, 
    provider_override: str = None, 
    book_id: int = None, 
    book_hash: str = None,
    semaphore: asyncio.Semaphore = None
) -> list[Chunk]:
    """Process a single section through the LLM with dynamic provider concurrency throttling."""
    if semaphore is None:
        concurrency = get_provider_concurrency(provider_override)
        semaphore = asyncio.Semaphore(concurrency)

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
        async with semaphore:
            section_extraction = await extract_atomic_concepts(heading, text, code_blocks, images, provider_override)
            
        chunks = build_chunks(section_extraction, chapter_title, page_num, code_blocks, images)
        
        all_summaries = [c.summary for c in chunks if c.summary]
        all_terms = set()
        for c in chunks:
            if c.key_terms:
                all_terms.update(c.key_terms)
                
        merged_summary = " ".join(all_summaries) if all_summaries else text[:250]
        merged_key_terms = json.dumps(list(all_terms))
        primary_concept_type = chunks[0].concept_type if chunks and chunks[0].concept_type else "Definition"
        primary_code = chunks[0].code_snippet if chunks and chunks[0].code_snippet else None
        primary_image = chunks[0].image_url if chunks and chunks[0].image_url else None
        
        if book_id:
            breadcrumb = chapter_title or heading
            topic_id = await resolve_and_save_topic(
                book_id=book_id,
                book_hash=book_hash,
                breadcrumb=breadcrumb,
                title=heading,
                level=1,
                start_page=page_num,
                end_page=page_num,
                content_md=text,
                summary=merged_summary,
                concept_type=primary_concept_type,
                key_terms=merged_key_terms,
                code_snippet=primary_code,
                image_url=primary_image,
                status="processed",
                provider_override=provider_override
            )
            for chunk in chunks:
                chunk.topic_id = topic_id
                chunk.breadcrumb = breadcrumb
            
        return chunks
    except RecallError:
        raise
    except httpx.HTTPError as e:
        # Bubble up critical provider failures
        raise classify_error(e)
    except Exception as e:
        logger.error(f"Failed to process section '{heading}': {e}")
        return []


from fastapi import Header, HTTPException

@app.post("/api/sync")
async def sync_data(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    token = authorization.split("Bearer ")[1]
    
    from app.sync_service import sync_with_remote
    try:
        # Run sync in thread pool to avoid blocking the event loop
        result = await asyncio.to_thread(sync_with_remote, token)
        return result
    except Exception as e:
        logger.error(f"Sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class SetUserRequest(BaseModel):
    user_id: str | None = None
    token: str | None = None

@app.post("/api/set-user")
async def set_active_user(req: SetUserRequest):
    from app.database import set_active_db_path, init_db, DATA_DIR
    import os
    
    default_db_path = os.path.join(DATA_DIR, "recall.db")
    
    if req.user_id:
        new_db_path = os.path.join(DATA_DIR, f"user_{req.user_id}_recall.db")
        
        if os.path.exists(default_db_path):
            has_data = False
            import sqlite3
            try:
                conn = sqlite3.connect(default_db_path)
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM books")
                row = cursor.fetchone()
                if row and row[0] > 0:
                    has_data = True
                conn.close()
            except Exception:
                pass
                
            if has_data:
                if not os.path.exists(new_db_path):
                    # First login: rename the offline db to claim it
                    os.rename(default_db_path, new_db_path)
                else:
                    # Merge offline data to cloud via push
                    if req.token:
                        from app.sync_service import push_changes, get_supabase_client
                        try:
                            supabase = get_supabase_client(req.token)
                            set_active_db_path(default_db_path)
                            push_changes(supabase, "1970-01-01 00:00:00")
                            os.remove(default_db_path)
                        except Exception as e:
                            logger.error(f"Failed to push offline data during login: {e}")
                        
        set_active_db_path(new_db_path)
        init_db()
    else:
        set_active_db_path(default_db_path)
        init_db()
        
    return {"status": "ok"}

@app.post("/api/delete-all-data")
async def delete_all_data(authorization: str = Header(None)):
    from app.sync_service import get_supabase_client, SYNC_TABLES, update_last_sync_time
    from app.database import get_connection
    
    # 1. Clear local SQLite database (always do this, regardless of auth)
    try:
        with get_connection() as conn:
            for table in reversed(SYNC_TABLES):
                conn.execute(f"DELETE FROM {table}")
        update_last_sync_time("1970-01-01 00:00:00")
    except Exception as e:
        logger.error(f"Failed to clear local data: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear local data")
        
    # 2. Delete from Supabase (only if authenticated)
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1]
        if token.strip():
            try:
                supabase = get_supabase_client(token)
                user_response = supabase.auth.get_user()
                if user_response and user_response.user:
                    user_id = user_response.user.id
                    for table in reversed(SYNC_TABLES):
                        supabase.table(table).delete().eq("user_id", user_id).execute()
            except Exception as e:
                logger.error(f"Failed to delete cloud data: {e}")
                raise HTTPException(status_code=500, detail="Local data cleared, but failed to clear cloud data")
            
    return {"status": "success"}


@app.post("/books/upload")
async def upload_and_parse_toc(
    file: UploadFile,
    file_hash: str = Form(...),
    book_title: str = Form(...),
    total_pages: int = Form(default=0)
) -> dict:
    try:
        pdf_bytes = await file.read()
        
        # Save file to disk
        file_path = os.path.join(PARSED_DOCS_DIR, f"{file_hash}.pdf")
        with open(file_path, "wb") as f:
            f.write(pdf_bytes)
            
        # Dynamically calculate total_pages if not provided
        if total_pages <= 0:
            import fitz
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            total_pages = doc.page_count
            doc.close()

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
        return error_response(e, include_debug=_is_debug())


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
        all_tasks = []
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
            
            # Step 1: Upfront PDF slicing and text extraction pass
            from fastapi.concurrency import run_in_threadpool
            discovered_sections = []
            
            for i, chunk_item in enumerate(chunk_queue, 1):
                yield f"data: {json.dumps({'status': 'processing', 'chunk': i, 'total_chunks': total_chunks, 'current_topic': chunk_item['title']})}\n\n"
                
                start_idx = max(0, chunk_item['start'] - 1)
                end_idx = min(doc.page_count - 1, chunk_item['end'] - 1)
                new_doc = fitz.open()
                new_doc.insert_pdf(doc, from_page=start_idx, to_page=end_idx)
                pdf_bytes = new_doc.write()
                new_doc.close()
                
                md_text, cache_key, start_page_num = await run_in_threadpool(extract_raw_text, pdf_bytes, chunk_item['start'])
                modified_md_text, code_blocks, images = parse_markdown_assets(md_text, cache_key)
                sections = detect_headings(modified_md_text, start_page_num)
                
                for sec in sections:
                    sec_code_blocks = {k: v for k, v in code_blocks.items() if f"[ASSET: {k}]" in sec["text"]}
                    sec_images = {k: v for k, v in images.items() if f"[ASSET: {k}]" in sec["text"]}
                    discovered_sections.append({
                        "sec": sec,
                        "chapter_title": chunk_item['chapter_title'],
                        "code_blocks": sec_code_blocks,
                        "images": sec_images,
                        "chunk_idx": i,
                        "chunk_title": chunk_item['title']
                    })
                    
            doc.close()
            
            total_sections = len(discovered_sections)
            if total_sections == 0:
                yield f"data: {json.dumps({'status': 'complete', 'book_id': book_id})}\n\n"
                return

            # Step 2: Dynamic provider-aware concurrency execution
            concurrency_limit = get_provider_concurrency(req.provider)
            semaphore = asyncio.Semaphore(concurrency_limit)
            logger.info(f"Starting parallel section processing with provider '{req.provider}' and concurrency={concurrency_limit}")
            
            for item in discovered_sections:
                task = asyncio.create_task(
                    process_section(
                        item["sec"], 
                        item["chapter_title"], 
                        True, 
                        item["code_blocks"], 
                        item["images"], 
                        req.provider, 
                        book_id, 
                        file_hash,
                        semaphore=semaphore
                    )
                )
                all_tasks.append(task)

            completed_sections = 0
            for completed_task in asyncio.as_completed(all_tasks):
                await completed_task
                completed_sections += 1
                yield f"data: {json.dumps({'status': 'processing_sections', 'total_chunks': total_chunks, 'completed_sections': completed_sections, 'total_sections': total_sections})}\n\n"
                
            yield f"data: {json.dumps({'status': 'complete', 'book_id': book_id})}\n\n"
            
        except Exception as e:
            import traceback
            logger.error(f"Internal Server Error in /books/{book_id}/process-stream: {e}\n{traceback.format_exc()}")

            for t in all_tasks:
                if not t.done():
                    t.cancel()

            yield f"data: {json.dumps(error_event(e, include_debug=_is_debug()))}\n\n"

            
    return StreamingResponse(event_generator(), media_type="text/event-stream")


from fastapi.responses import HTMLResponse

@app.get("/auth-success", response_class=HTMLResponse)
def auth_success():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Login Successful</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; text-align: center; padding-top: 100px; color: #fff; background-color: #121212; }
            a.button { display: inline-block; padding: 10px 20px; margin-top: 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; }
            a.button:hover { background-color: #45a049; }
        </style>
    </head>
    <body>
        <h2>Login Successful!</h2>
        <p>You can securely close this tab.</p>
        <a href="#" id="fallback" class="button">Open App</a>
        
        <script>
            // Combine both search (?code=) and hash (#access_token=) in case they change flow types
            var target = "recallai://login-callback" + window.location.search + window.location.hash;
            document.getElementById('fallback').href = target;
            window.location.href = target;
        </script>
    </body>
    </html>
    """

@app.get("/health")
def health():
    return {"status": "ok"}

from pydantic import BaseModel

class APIKeys(BaseModel):
    gemini_api_key: str | None = None
    groq_api_key: str | None = None
    openai_api_key: str | None = None
    langfuse_secret_key: str | None = None
    langfuse_public_key: str | None = None
    langfuse_host: str | None = None
    ollama_host: str | None = None

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
    if keys.langfuse_secret_key is not None:
        set_setting("langfuse_secret_key", keys.langfuse_secret_key)
        os.environ["LANGFUSE_SECRET_KEY"] = keys.langfuse_secret_key
    if keys.langfuse_public_key is not None:
        set_setting("langfuse_public_key", keys.langfuse_public_key)
        os.environ["LANGFUSE_PUBLIC_KEY"] = keys.langfuse_public_key
    if keys.langfuse_host is not None:
        set_setting("langfuse_host", keys.langfuse_host)
        os.environ["LANGFUSE_HOST"] = keys.langfuse_host
    if keys.ollama_host is not None:
        set_setting("ollama_host", keys.ollama_host)
        os.environ["OLLAMA_HOST"] = keys.ollama_host
        
    if keys.langfuse_secret_key is not None or keys.langfuse_public_key is not None:
        pk = keys.langfuse_public_key or os.environ.get("LANGFUSE_PUBLIC_KEY")
        sk = keys.langfuse_secret_key or os.environ.get("LANGFUSE_SECRET_KEY")
        host = keys.langfuse_host or os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com")
        if pk and sk:
            from langfuse import Langfuse
            try:
                Langfuse(public_key=pk, secret_key=sk, host=host)
            except Exception as e:
                logger.error(f"Failed to initialize Langfuse: {e}")
            
    return {"status": "updated"}

@app.get("/settings/api-keys", response_model=APIKeys)
def get_api_keys():
    return {
        "gemini_api_key": get_setting("gemini_api_key") or "",
        "groq_api_key": get_setting("groq_api_key") or "",
        "openai_api_key": get_setting("openai_api_key") or "",
        "langfuse_secret_key": get_setting("langfuse_secret_key") or "",
        "langfuse_public_key": get_setting("langfuse_public_key") or "",
        "langfuse_host": get_setting("langfuse_host") or "https://cloud.langfuse.com",
        "ollama_host": get_setting("ollama_host") or "http://localhost:11434"
    }

@app.get("/settings/verify-ollama")
async def verify_ollama(url: str):
    import httpx
    try:
        if not url.startswith("http"):
            return {"active": False, "error": "Invalid URL"}
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{url.rstrip('/')}/api/tags")
            r.raise_for_status()
            return {"active": True, "error": None}
    except Exception as e:
        return {"active": False, "error": str(e)}


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
    from app.database import get_topic_by_id, update_topic_status, get_book_by_id, update_topic_enrichment, get_connection
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
            
            content_md = topic.get("content_md") or ""
            code_blocks = {}
            images = {}
            
            if content_md and len(content_md.strip()) > 20:
                yield f"data: {json.dumps({'stage': 'reading_pdf'})}\n\n"
                modified_md_text, code_blocks, images = parse_markdown_assets(content_md, topic.get("topic_hash", "cache_key"))
                sections = detect_headings(modified_md_text, topic.get("start_page", 1))
            else:
                yield f"data: {json.dumps({'stage': 'reading_pdf'})}\n\n"
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
                content_md = modified_md_text
            
            yield f"data: {json.dumps({'stage': 'extracting_topics', 'section_count': len(sections)})}\n\n"
            
            # Extract concepts from section text to enrich topic in-place
            heading = topic.get("title") or "Section"
            text_content = content_md or (sections[0]["text"] if sections else "")
            
            yield f"data: {json.dumps({'stage': 'extracting_topics', 'progress': 50})}\n\n"
            
            section_extraction = await extract_atomic_concepts(
                heading, text_content, code_blocks, images, req.provider_override
            )
            
            # Consolidate extracted AI concept data
            all_summaries = []
            all_key_terms = set()
            primary_concept_type = "Definition"
            primary_code_snippet = None
            primary_image_url = None
            
            if hasattr(section_extraction, 'atomic_topics') and section_extraction.atomic_topics:
                for t in section_extraction.atomic_topics:
                    if t.summary:
                        all_summaries.append(t.summary)
                    if t.key_terms:
                        all_key_terms.update(t.key_terms)
                    if t.concept_type and primary_concept_type == "Definition":
                        primary_concept_type = t.concept_type
                    if t.related_code_id and not primary_code_snippet:
                        primary_code_snippet = str(t.related_code_id)
                    if t.related_image_id and not primary_image_url:
                        primary_image_url = str(t.related_image_id)
                        
            merged_summary = " ".join(all_summaries) if all_summaries else (topic.get("summary") or text_content[:200])
            merged_key_terms = json.dumps(list(all_key_terms)) if all_key_terms else (topic.get("key_terms") or "[]")
            
            # Enrich topic in-place without creating new child rows in topics table
            update_topic_enrichment(
                topic_id=topic_id,
                summary=merged_summary,
                concept_type=primary_concept_type,
                key_terms=merged_key_terms,
                code_snippet=primary_code_snippet,
                image_url=primary_image_url,
                content_md=content_md,
                status="processed"
            )
            
            yield f"data: {json.dumps({'stage': 'extracting_topics', 'progress': 100})}\n\n"
            yield f"data: {json.dumps({'status': 'complete', 'topic_id': topic_id})}\n\n"
            
        except Exception as e:
            import traceback
            logger.error(f"Error processing topic {topic_id}: {e}\n{traceback.format_exc()}")
            update_topic_status(topic_id, "unprocessed")
            yield f"data: {json.dumps(error_event(e, include_debug=_is_debug()))}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── Socratic Drill Endpoints ────────────────────────────────────────────

class DrillGenerateRequest(BaseModel):
    provider_override: str | None = None

@app.post("/topics/{topic_id}/drill/generate")
async def drill_generate_questions(topic_id: int, req: DrillGenerateRequest):
    """Generate 2 tiered diagnostic questions for a topic."""
    from app.database import get_topic_by_id, get_book_by_id
    from app.socratic_drill import generate_diagnostic_questions
    import fitz

    topic = get_topic_by_id(topic_id)
    if not topic:
        return JSONResponse(status_code=404, content={"error": "Topic not found"})

    # Resolve topic content: prefer stored content_md, fallback to PDF extraction
    content = topic.get("content_md") or ""
    if not content or len(content.strip()) < 30:
        book = get_book_by_id(topic["book_id"])
        if not book:
            return JSONResponse(status_code=404, content={"error": "Book not found"})
        file_path = book["file_path"]
        if not os.path.exists(file_path):
            return JSONResponse(status_code=404, content={"error": "PDF file not found"})
        doc = fitz.open(file_path)
        start_idx = max(0, topic["start_page"] - 1)
        end_idx = min(doc.page_count - 1, topic["end_page"] - 1)
        pages_text = []
        for i in range(start_idx, end_idx + 1):
            pages_text.append(doc[i].get_text())
        doc.close()
        content = "\n".join(pages_text)

    try:
        result = await generate_diagnostic_questions(
            topic_title=topic["title"],
            breadcrumb=topic.get("breadcrumb") or "",
            start_page=topic["start_page"],
            topic_content=content,
            provider_override=req.provider_override,
        )
        return result.model_dump()
    except RecallError:
        raise
    except Exception as e:
        logger.error(f"Drill question generation failed: {e}")
        return error_response(e, include_debug=_is_debug())


class DrillEvaluateRequest(BaseModel):
    question_id: str
    question_text: str
    key_invariants: list[str]
    student_answer: str
    provider_override: str | None = None

@app.post("/topics/{topic_id}/drill/evaluate")
async def drill_evaluate_answer(topic_id: int, req: DrillEvaluateRequest):
    """Evaluate a student's answer and return diagnostic feedback."""
    from app.database import get_topic_by_id, get_book_by_id, update_topic_mastery
    from app.socratic_drill import evaluate_student_answer
    import fitz

    topic = get_topic_by_id(topic_id)
    if not topic:
        return JSONResponse(status_code=404, content={"error": "Topic not found"})

    content = topic.get("content_md") or ""
    if not content or len(content.strip()) < 30:
        book = get_book_by_id(topic["book_id"])
        if not book:
            return JSONResponse(status_code=404, content={"error": "Book not found"})
        file_path = book["file_path"]
        if not os.path.exists(file_path):
            return JSONResponse(status_code=404, content={"error": "PDF file not found"})
        doc = fitz.open(file_path)
        start_idx = max(0, topic["start_page"] - 1)
        end_idx = min(doc.page_count - 1, topic["end_page"] - 1)
        pages_text = []
        for i in range(start_idx, end_idx + 1):
            pages_text.append(doc[i].get_text())
        doc.close()
        content = "\n".join(pages_text)

    try:
        result = await evaluate_student_answer(
            question_text=req.question_text,
            key_invariants=req.key_invariants,
            topic_content=content,
            student_answer=req.student_answer,
            provider_override=req.provider_override,
        )
        # Persist mastery score
        update_topic_mastery(topic_id, result.mastery_score, result.status)
        return result.model_dump()
    except RecallError:
        raise
    except Exception as e:
        logger.error(f"Drill evaluation failed: {e}")
        return error_response(e, include_debug=_is_debug())


class DrillSaveCardsRequest(BaseModel):
    flashcards: list[dict]

@app.post("/topics/{topic_id}/drill/save-cards")
def drill_save_flashcards(topic_id: int, req: DrillSaveCardsRequest):
    """Save targeted flashcards from a drill evaluation into the FSRS deck."""
    from app.database import get_topic_by_id, get_connection
    import hashlib

    topic = get_topic_by_id(topic_id)
    if not topic:
        return JSONResponse(status_code=404, content={"error": "Topic not found"})

    saved_ids = []
    with get_connection() as conn:
        cursor = conn.cursor()
        for card in req.flashcards:
            q = card.get("question", "")
            a = card.get("answer", "")
            gap = card.get("gap_source", "")
            if not q or not a:
                continue
            content_hash = hashlib.sha256(f"{topic_id}:{q}:{a}".encode()).hexdigest()
            try:
                cursor.execute("""
                    INSERT INTO flashcards (topic_id, topic_name, concept_type, summary, question, answer, key_terms, content_hash, source_page)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    topic_id,
                    topic["title"],
                    "Diagnostic Gap",
                    gap,
                    q,
                    a,
                    "[]",
                    content_hash,
                    topic.get("start_page"),
                ))
                saved_ids.append(cursor.lastrowid)
            except Exception as e:
                logger.warning(f"Skipped duplicate drill flashcard: {e}")

    return {"status": "success", "saved_count": len(saved_ids), "ids": saved_ids}


@app.post("/books/{book_id}/clean-toc")
def clean_book_toc(book_id: int):
    from app.database import prune_artificial_subtopics
    pruned = prune_artificial_subtopics(book_id)
    return {"status": "success", "pruned_subtopics": pruned}



@app.post("/topics/{topic_id}/flashcards")
@observe(name="generate_topic_flashcards", as_type="span")
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

    # Fallback to PDF extraction if content is still empty
    if not topic_text or len(topic_text.strip()) < 30:
        from app.database import get_book_by_id
        import fitz
        book = get_book_by_id(topic["book_id"])
        if book:
            file_path = book["file_path"]
            if os.path.exists(file_path):
                doc = fitz.open(file_path)
                start_idx = max(0, topic.get("start_page", 1) - 1)
                end_idx = min(doc.page_count - 1, topic.get("end_page", doc.page_count) - 1)
                pages_text = []
                for i in range(start_idx, end_idx + 1):
                    pages_text.append(doc[i].get_text())
                doc.close()
                topic_text = "\n".join(pages_text)
            
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

@app.get("/books/{book_id}/cover")
def get_book_cover_api(book_id: int):
    from app.database import get_book_by_id
    from fastapi.responses import FileResponse
    import os
    import fitz
    
    book = get_book_by_id(book_id)
    if not book:
        return JSONResponse(status_code=404, content={"error": "Book not found"})
        
    covers_dir = os.path.join(DATA_DIR, "covers")
    os.makedirs(covers_dir, exist_ok=True)
    
    cover_path = os.path.join(covers_dir, f"{book['file_hash']}.png")
    
    # Generate cover if it doesn't exist
    if not os.path.exists(cover_path):
        try:
            doc = fitz.open(book["file_path"])
            # Fallback to empty if PDF has no pages
            if doc.page_count == 0:
                doc.close()
                return JSONResponse(status_code=404, content={"error": "PDF has no pages"})
                
            page = doc.load_page(0)
            # scale for better quality
            pix = page.get_pixmap(matrix=fitz.Matrix(1, 1)) # standard scale is fine for thumbnails
            pix.save(cover_path)
            doc.close()
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": f"Failed to extract cover: {str(e)}"})
            
    return FileResponse(cover_path, media_type="image/png")

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
    provider_override: Optional[str] = None

class FlashcardSelectionRequest(BaseModel):
    selected_text: str
    custom_prompt: Optional[str] = None
    count: int = 5
    page_number: int
    rect_json: str
    save: bool = True
    provider_override: Optional[str] = None


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
        provider_override = body.provider_override
        if not provider_override:
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
    except RecallError:
        raise
    except Exception as e:
        logger.error(f"AI explanation failed: {e}")
        return error_response(e, include_debug=_is_debug())


@app.post("/books/{book_id}/annotations/generate-flashcards")
async def generate_flashcards_annotation(book_id: int, body: FlashcardSelectionRequest):
    """Generate flashcards from selected text and save as annotation."""
    try:
        # Get provider override from settings
        provider_override = body.provider_override
        if not provider_override:
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
    except RecallError:
        raise
    except Exception as e:
        logger.error(f"Flashcard generation from selection failed: {e}")
        return error_response(e, include_debug=_is_debug())


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

@app.get("/search")
async def search(query: str, limit: int = 20):
    if not query or not query.strip():
        return []
    try:
        results = search_all(query.strip(), limit=limit)
        return results
    except RecallError:
        raise
    except Exception as e:
        logger.error(f"Search failed: {e}")
        return error_response(e, include_debug=_is_debug())

@app.post("/chunk/stream")
async def chunk_stream_endpoint(
    file: UploadFile,
    pre_sliced: str = Form(default="false"),
    start_page: int = Form(default=1),
    chapter_title: str = Form(default=""),
    provider: str | None = Form(default=None),
    file_hash: str | None = Form(default=None),
    book_title: str | None = Form(default=None),
    total_pages: int | None = Form(default=None)
):
    async def event_generator():
        try:
            pdf_bytes = await file.read()
            yield f"data: {json.dumps({'stage': 'Reading PDF'})}\n\n"
            
            from fastapi.concurrency import run_in_threadpool
            md_text, cache_key, start_page_num = await run_in_threadpool(extract_raw_text, pdf_bytes, start_page)
            yield f"data: {json.dumps({'stage': 'Extracting markdown assets'})}\n\n"
            
            modified_md_text, code_blocks, images = parse_markdown_assets(md_text, cache_key)
            sections = detect_headings(modified_md_text, start_page_num)
            
            yield f"data: {json.dumps({'stage': 'Waiting on LLM response', 'sections': len(sections)})}\n\n"
            
            import asyncio
            semaphore = asyncio.Semaphore(get_provider_concurrency(provider))
            
            tasks = [process_section(
                sec["heading"], 
                sec["text"], 
                code_blocks, 
                images, 
                chapter_title or sec["heading"], 
                start_page_num,
                None,
                file_hash,
                provider,
                semaphore
            ) for sec in sections]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            all_chunks = []
            for res in results:
                if isinstance(res, Exception):
                    logger.error(f"Section extraction failed: {res}")
                elif isinstance(res, list):
                    all_chunks.extend(res)
            
            chunks_json = [c.model_dump() for c in all_chunks]
            yield f"data: {json.dumps({'stage': 'done', 'chunks': chunks_json})}\n\n"
        except Exception as e:
            logger.error(f"Chunk stream failed: {e}")
            yield f"data: {json.dumps(error_event(e, include_debug=_is_debug()))}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
