import asyncio
import json
import logging
import os
import tempfile
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
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
from app.llm_segment import extract_atomic_concepts, explain_selected_text, generate_flashcards_from_selection, chat_with_topic, chat_with_topic_stream
from app.pdf_extract import extract_raw_text
from app.prefilter import is_valid_section
from app.schemas import Chunk, ChatRequest, ChatMessageDB
from app.markdown_ast import parse_markdown_assets
from app.errors import RecallError, ErrorCode, classify_error, error_response, error_event, get_user_message
from app.config import settings as app_settings

from fastapi.exceptions import RequestValidationError
from app.core.config import settings as core_settings
from app.core.errors import AppException, ErrorCode as CoreErrorCode, format_error_response
from app.api.middleware import SecurityHeadersMiddleware, RequestSizeLimitMiddleware
from app.api.v1.router import api_v1_router
from app.api.v1.health import router as health_router
from app.models.schema_init import init_foundation_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    init_foundation_db()
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


app = FastAPI(title="Recall AI Platform API", lifespan=lifespan)

# Security Middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=core_settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=PARSED_DOCS_DIR), name="static")

# Mount API Routers
app.include_router(api_v1_router)
app.include_router(health_router)

from app.config import get_provider_concurrency

def _is_debug() -> bool:
    """Check if debug mode is enabled (shows full error details in responses)."""
    return app_settings.debug_mode


# ── Global Exception Handlers ────────────────────────────────────────────

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return format_error_response(
        code=exc.code,
        message=exc.message,
        status_code=exc.status_code,
        details=exc.details
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    field_errors = []
    for error in exc.errors():
        loc = " -> ".join(str(l) for l in error.get("loc", []))
        field_errors.append({
            "field": loc,
            "message": error.get("msg", "Invalid value")
        })
    return format_error_response(
        code=CoreErrorCode.VALIDATION_ERROR,
        message="Request validation failed. Please check your inputs.",
        status_code=422,
        details=field_errors
    )

@app.exception_handler(RecallError)
async def recall_error_handler(request: Request, exc: RecallError):
    return error_response(exc, include_debug=_is_debug())

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server exception: {exc}", exc_info=True)
    return format_error_response(
        code=CoreErrorCode.INTERNAL_ERROR,
        message="An unexpected internal error occurred. Please try again later.",
        status_code=500
    )

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

@app.get("/api/topics/{topic_id}/chat", response_model=list[ChatMessageDB])
async def get_topic_chat_history(topic_id: int):
    logger.debug(f"Backend received GET /api/topics/{topic_id}/chat")
    try:
        from app.database import get_connection
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, topic_id, role, content, created_at FROM chat_messages WHERE topic_id = ? ORDER BY id ASC", (topic_id,))
            rows = cursor.fetchall()
            logger.debug(f"Backend returning {len(rows)} messages for topic {topic_id}")
            return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Failed to fetch chat history: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        from app.database import get_connection
        
        # 0. Resolve book_id if topic_id is given
        if not request.book_id and request.topic_id:
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT book_id FROM topics WHERE id = ?", (request.topic_id,))
                row = cursor.fetchone()
                if row:
                    request.book_id = row[0]
                    
        # 1. Save user's question to DB if topic_id exists
        if request.topic_id:
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("INSERT INTO chat_messages (topic_id, role, content) VALUES (?, ?, ?)", 
                               (request.topic_id, "user", request.question))
            request.context_markdown = await ensure_topic_markdown(request.topic_id)
        else:
            request.context_markdown = request.context_markdown or ""
        
        # 2. Get answer from LLM
        answer = await chat_with_topic(request)
        
        # 3. Save AI's answer to DB if topic_id exists
        if request.topic_id:
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("INSERT INTO chat_messages (topic_id, role, content) VALUES (?, ?, ?)", 
                               (request.topic_id, "ai", answer))
                               
        return {"answer": answer}
                            
    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        return error_response(e, include_debug=_is_debug())

@app.post("/chat/stream")
async def chat_endpoint_stream(request: ChatRequest):
    from fastapi.responses import StreamingResponse
    import json
    
    try:
        from app.database import get_connection
        
        # 0. Resolve book_id if topic_id is given
        if not request.book_id and request.topic_id:
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT book_id FROM topics WHERE id = ?", (request.topic_id,))
                row = cursor.fetchone()
                if row:
                    request.book_id = row[0]
                    
        if request.topic_id:
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("INSERT INTO chat_messages (topic_id, role, content) VALUES (?, ?, ?)", 
                               (request.topic_id, "user", request.question))
            request.context_markdown = await ensure_topic_markdown(request.topic_id)
        else:
            request.context_markdown = request.context_markdown or ""
        
        async def event_generator():
            full_answer = ""
            try:
                async for chunk in chat_with_topic_stream(request):
                    full_answer += chunk
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                    
                if request.topic_id:
                    with get_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute("INSERT INTO chat_messages (topic_id, role, content) VALUES (?, ?, ?)", 
                                       (request.topic_id, "ai", full_answer))
            except Exception as e:
                logger.error(f"Chat stream error: {e}")
                err_dict = error_event(e, include_debug=_is_debug())
                err_dict["error"] = err_dict.get("message")
                yield f"data: {json.dumps(err_dict)}\n\n"
                
        return StreamingResponse(event_generator(), media_type="text/event-stream")
    except Exception as e:
        logger.error(f"Chat stream setup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
                    set_active_db_path(new_db_path)
                    try:
                        os.rename(default_db_path, new_db_path)
                    except Exception as ren_err:
                        logger.warning(f"Could not rename default db: {ren_err}")
                else:
                    # Merge offline data to cloud via push
                    if req.token:
                        from app.sync_service import push_changes, get_supabase_client
                        try:
                            supabase = get_supabase_client(req.token)
                            set_active_db_path(default_db_path)
                            push_changes(supabase, "1970-01-01 00:00:00")
                        except Exception as e:
                            logger.error(f"Failed to push offline data during login: {e}")
                        
                        set_active_db_path(new_db_path)
                        if os.path.exists(default_db_path):
                            try:
                                os.remove(default_db_path)
                            except Exception as rem_err:
                                logger.warning(f"Could not remove default db: {rem_err}")
                    else:
                        set_active_db_path(new_db_path)
                        
            else:
                set_active_db_path(new_db_path)
                if os.path.exists(default_db_path):
                    try:
                        os.remove(default_db_path)
                    except Exception as rem_err:
                        logger.warning(f"Could not remove default db: {rem_err}")
                    
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
            for table in ["sync_tombstones", "undo_log", "chat_messages", "settings"]:
                try:
                    conn.execute(f"DELETE FROM {table}")
                except Exception:
                    pass
        update_last_sync_time("1970-01-01 00:00:00")
        
        # Also clear Foundation DB (recall_saas.db) documents if any
        try:
            from app.models.database import get_db
            with get_db() as f_conn:
                f_conn.execute("DELETE FROM document_chunks")
                f_conn.execute("DELETE FROM processing_jobs")
                f_conn.execute("DELETE FROM documents")
        except Exception as e:
            logger.warning(f"Failed to clear Foundation database in delete_all_data: {e}")
            
    except Exception as e:
        logger.error(f"Failed to clear local data: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear local data")
        
    # 2. Delete from Supabase (only if authenticated)
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1]
        if token.strip():
            try:
                supabase = get_supabase_client(token)
                for table in reversed(SYNC_TABLES):
                    # We can't delete without a filter, so we filter by a known condition (all user records)
                    # For RLS, user_id = auth.uid() is implicit. In Supabase, the primary key column is 'uuid'.
                    supabase.table(table).delete().neq("uuid", "00000000-0000-0000-0000-000000000000").execute()
                
                try:
                    supabase.table("sync_tombstones").delete().neq("uuid", "00000000-0000-0000-0000-000000000000").execute()
                except Exception as e:
                    logger.error(f"Failed to delete sync_tombstones on Supabase: {e}")
                    
                update_last_sync_time("1970-01-01 00:00:00")
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
    pdf_bytes = await file.read()
    if len(pdf_bytes) > core_settings.MAX_PDF_BYTES:
        raise AppException(
            code=CoreErrorCode.PAYLOAD_TOO_LARGE,
            message=f"PDF document exceeds maximum allowed size of 50 MB (received {len(pdf_bytes) / (1024 * 1024):.1f} MB).",
            status_code=413,
        )

    try:
        # Save file to disk
        file_path = os.path.join(PARSED_DOCS_DIR, f"{file_hash}.pdf")
        with open(file_path, "wb") as f:
            f.write(pdf_bytes)
            
        # Always determine exact total_pages directly from the PDF file
        import fitz
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc_check:
            actual_total_pages = doc_check.page_count

        # Check if book exists
        from app.database import save_book, get_connection
        book_id = save_book(title=book_title, file_path=file_path, file_hash=file_hash, total_pages=actual_total_pages)
        
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
        from app.topic_subdivider import is_scanned_pdf, subdivide_topic_from_markdown

        # Check if this is a scanned/handwritten document
        doc_check = fitz.open(file_path)
        is_scanned = is_scanned_pdf(doc_check)
        doc_total = doc_check.page_count
        doc_check.close()

        # If scanned and small (<= 25 pages), try Marker extraction right away
        if is_scanned and doc_total <= 25:
            from app.database import get_setting
            has_marker = bool(get_setting("datalab_api_key"))
            if not has_marker:
                from app.extractors import get_extractor
                has_marker = get_extractor().name == "marker"
            
            if has_marker:
                logger.info(f"Scanned/handwritten PDF detected ({doc_total} pages). Running Marker extraction for outline...")
                try:
                    from app.pdf_extract import extract_raw_text
                    md_text, _, _ = await extract_raw_text(pdf_bytes, 1)
                    subdivided = await subdivide_topic_from_markdown(
                        book_id=book_id,
                        placeholder_topic_id=None,
                        md_text=md_text,
                        default_start_page=1,
                        default_end_page=doc_total
                    )
                    if subdivided:
                        return {"book_id": book_id, "status": "scanned_parsed", "topic_count": len(subdivided)}
                except Exception as e:
                    logger.warning(f"Direct Marker upload extraction failed: {e}. Falling back to default TOC.")

        def extract_toc():
            doc = fitz.open(file_path)
            toc = get_toc_entries(doc, pdf_path=file_path)
            total = doc.page_count
            granular_toc = build_granular_toc(toc, total, document_title=book_title)
            doc.close()
            return granular_toc
            
        toc = await run_in_threadpool(extract_toc)
        
        # Bulk insert topics with unprocessed status
        from app.database import insert_topics_bulk
        topic_count = insert_topics_bulk(book_id, toc)

        # Mirror into recall_saas.db so DocumentsView and RAG chat have unified access
        try:
            from app.models.repositories import DocumentRepository
            doc_title = book_title.replace("_", " ").replace("-", " ").strip() or "Untitled Document"
            existing_docs = DocumentRepository.list_by_workspace(workspace_id="default", limit=100)
            already_linked = any(d.get("metadata", {}).get("book_id") == book_id for d in existing_docs)
            if not already_linked:
                import uuid
                DocumentRepository.create_document(
                    workspace_id="default",
                    title=doc_title,
                    source_type="pdf",
                    total_pages=actual_total_pages,
                    status="ready",
                    metadata={"book_id": book_id, "chunk_count": topic_count},
                    doc_id=str(uuid.uuid4())
                )
        except Exception as saas_err:
            logger.debug(f"Could not mirror book into recall_saas.db: {saas_err}")
        
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


@app.get("/images/{image_name:path}")
async def get_extracted_image(image_name: str):
    from pathlib import Path
    clean_subpath = os.path.normpath(image_name).lstrip("/\\")
    target_path = Path(PARSED_DOCS_DIR)
    
    # 1. Direct path check
    direct_file = target_path / clean_subpath
    if direct_file.is_file():
        ext = direct_file.suffix.lower()
        media_type = (
            "image/jpeg" if ext in (".jpg", ".jpeg")
            else "image/png" if ext == ".png"
            else "image/webp" if ext == ".webp"
            else "image/svg+xml" if ext == ".svg"
            else "image/gif" if ext == ".gif"
            else "application/octet-stream"
        )
        return FileResponse(path=str(direct_file), media_type=media_type, filename=direct_file.name)
        
    # 2. Search by basename across extracted cache directories
    file_basename = os.path.basename(clean_subpath)
    if file_basename:
        for p in target_path.rglob(file_basename):
            if p.is_file():
                ext = p.suffix.lower()
                media_type = (
                    "image/jpeg" if ext in (".jpg", ".jpeg")
                    else "image/png" if ext == ".png"
                    else "image/webp" if ext == ".webp"
                    else "image/svg+xml" if ext == ".svg"
                    else "image/gif" if ext == ".gif"
                    else "application/octet-stream"
                )
                return FileResponse(path=str(p), media_type=media_type, filename=file_basename)
                
    return JSONResponse(status_code=404, content={"error": f"Image {image_name} not found"})


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
        doc = None
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
            
            from app.extractors import get_extractor
            is_marker = get_extractor().name == "marker"
            extra_msg = " (Marker may take a few minutes...)" if is_marker else ""
            
            for i, chunk_item in enumerate(chunk_queue, 1):
                yield f"data: {json.dumps({'status': 'processing', 'chunk': i, 'total_chunks': total_chunks, 'current_topic': chunk_item['title'] + extra_msg})}\n\n"
                
                start_idx = max(0, chunk_item['start'] - 1)
                end_idx = min(doc.page_count - 1, chunk_item['end'] - 1)
                with fitz.open() as new_doc:
                    new_doc.insert_pdf(doc, from_page=start_idx, to_page=end_idx)
                    pdf_bytes = new_doc.write()
                
                md_text, cache_key, start_page_num = await extract_raw_text(pdf_bytes, chunk_item['start'])
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
        finally:
            if doc:
                doc.close()

            
    return StreamingResponse(event_generator(), media_type="text/event-stream")


from fastapi.responses import HTMLResponse

_latest_oauth_cache = {"code": None, "timestamp": 0.0}

@app.get("/auth-success", response_class=HTMLResponse)
def auth_success(request: Request):
    global _latest_oauth_cache
    code = request.query_params.get("code")
    if code:
        _latest_oauth_cache = {"code": code, "timestamp": time.time()}
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

@app.get("/api/auth/latest-oauth-code")
def get_latest_oauth_code():
    global _latest_oauth_cache
    now = time.time()
    if _latest_oauth_cache.get("code") and (now - _latest_oauth_cache.get("timestamp", 0.0) < 60.0):
        code = _latest_oauth_cache["code"]
        _latest_oauth_cache["code"] = None
        return {"code": code}
    return {"code": None}

@app.get("/health")
def health():
    return {"status": "ok"}

from pydantic import BaseModel

class APIKeys(BaseModel):
    gemini_api_key: str | None = None
    groq_api_key: str | None = None
    openai_api_key: str | None = None
    datalab_api_key: str | None = None
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
    if keys.datalab_api_key is not None:
        set_setting("datalab_api_key", keys.datalab_api_key)
        os.environ["DATALAB_API_KEY"] = keys.datalab_api_key
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
        "datalab_api_key": get_setting("datalab_api_key") or "",
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

class VerifyKeyRequest(BaseModel):
    provider: str
    api_key: str

@app.post("/settings/verify-key")
async def verify_api_key(req: VerifyKeyRequest):
    import httpx
    provider = req.provider.lower().strip()
    key = req.api_key.strip()
    if not key:
        return {"valid": False, "error": "API key cannot be empty."}

    try:
        if provider == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
            async with httpx.AsyncClient(timeout=6.0) as client:
                r = await client.get(url)
                if r.status_code == 200:
                    return {"valid": True, "error": None}
                return {"valid": False, "error": f"Invalid Gemini key (HTTP {r.status_code})"}

        elif provider == "openai":
            url = "https://api.openai.com/v1/models"
            headers = {"Authorization": f"Bearer {key}"}
            async with httpx.AsyncClient(timeout=6.0) as client:
                r = await client.get(url, headers=headers)
                if r.status_code == 200:
                    return {"valid": True, "error": None}
                return {"valid": False, "error": f"Invalid OpenAI key (HTTP {r.status_code})"}

        elif provider == "groq":
            url = "https://api.groq.com/openai/v1/models"
            headers = {"Authorization": f"Bearer {key}"}
            async with httpx.AsyncClient(timeout=6.0) as client:
                r = await client.get(url, headers=headers)
                if r.status_code == 200:
                    return {"valid": True, "error": None}
                return {"valid": False, "error": f"Invalid Groq key (HTTP {r.status_code})"}

        elif provider in ("datalab_api_key", "marker_api"):
            url = "https://www.datalab.to/api/v1/marker"
            headers = {"X-Api-Key": key}
            async with httpx.AsyncClient(timeout=6.0) as client:
                r = await client.get("https://www.datalab.to/api/v1/models", headers=headers)
                if r.status_code in (200, 404):
                    return {"valid": True, "error": None}
                if r.status_code in (401, 403):
                    return {"valid": False, "error": "Invalid Datalab API key"}
                return {"valid": True, "error": None}

        return {"valid": True, "error": None}
    except Exception as e:
        return {"valid": False, "error": f"Verification failed: {str(e)}"}
async def ensure_topic_markdown(topic_id: int) -> str:
    """Ensures the topic has extracted markdown content. If missing, runs the extraction pipeline and saves it."""
    from app.database import get_topic_by_id, get_book_by_id, update_topic_content_md
    import fitz
    import os
    
    topic = get_topic_by_id(topic_id)
    if not topic:
        return ""
        
    content = topic.get("content_md") or ""
    # We pass the parent's content_md as context if it exists, or the topic's own content_md
    if not content and topic.get("parent_id"):
        parent = get_topic_by_id(topic.get("parent_id"))
        if parent:
            content = parent.get("content_md") or ""
            
    if content and len(content.strip()) >= 30:
        return content
        
    book = get_book_by_id(topic["book_id"])
    if not book:
        return ""
        
    file_path = book["file_path"]
    if not os.path.exists(file_path):
        return ""
        
    with fitz.open(file_path) as doc:
        start_idx = max(0, topic.get("start_page", 1) - 1)
        end_idx = min(doc.page_count - 1, topic.get("end_page", doc.page_count) - 1)
        
        with fitz.open() as new_doc:
            new_doc.insert_pdf(doc, from_page=start_idx, to_page=end_idx)
            pdf_bytes = new_doc.write()
    
    from app.pdf_extract import extract_raw_text
    extracted_text, _, _ = await extract_raw_text(pdf_bytes, topic.get("start_page", 1))
    
    if extracted_text:
        update_topic_content_md(topic_id, extracted_text)
        # If this is a monolithic placeholder topic, subdivide it into real topics
        if topic.get("title") in ("Full Document", "Untitled"):
            from app.topic_subdivider import subdivide_topic_from_markdown
            await subdivide_topic_from_markdown(
                book_id=topic["book_id"],
                placeholder_topic_id=topic_id,
                md_text=extracted_text,
                default_start_page=topic.get("start_page", 1),
                default_end_page=topic.get("end_page", 1)
            )
        
    return extracted_text or ""


from pydantic import BaseModel

class FlashcardGenerationRequest(BaseModel):
    count: int = 5
    custom_prompt: str | None = None
    summary_override: str | None = None
    provider_override: str | None = None
    concept_name: str | None = None

class ProcessTopicRequest(BaseModel):
    provider_override: str | None = None
    force_reprocess: bool = False

@app.post("/topics/{topic_id}/process-stream")
async def process_topic_stream(topic_id: int, req: ProcessTopicRequest):
    from app.database import (
        get_topic_by_id, update_topic_status, get_book_by_id, 
        update_topic_enrichment, update_topic_content_md, get_child_topics, get_connection
    )
    from app.pdf_extract import extract_raw_text, extract_page_range_chunked
    from app.markdown_slicer import match_concept_to_section_heading
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
        children = []
        atomic_concepts = []
        content_md = ""
        try:
            update_topic_status(topic_id, "processing")
            children = get_child_topics(topic_id)
            
            from app.extractors import get_extractor
            is_marker = get_extractor().name == "marker"
            extra_msg = " (Marker may take a few minutes to download models on first run)" if is_marker else ""
            
            # BRANCH 1: Hierarchical Cascade (Parent topic has child subtopics)
            if children:
                leaves = []
                def collect_leaves(curr_id: int):
                    subs = get_child_topics(curr_id)
                    if not subs:
                        top = get_topic_by_id(curr_id)
                        if top:
                            leaves.append(top)
                    else:
                        for s in subs:
                            collect_leaves(s["id"])

                for ch in children:
                    collect_leaves(ch["id"])

                total_leaves = max(1, len(leaves))
                yield f"data: {json.dumps({'stage': 'parent_decomposition', 'child_count': len(children), 'total_leaves': total_leaves, 'message': f'Auto-processing {total_leaves} subtopics across document hierarchy'})}\n\n"

                processed_leaf_count = 0

                async def process_node(curr_node: dict):
                    nonlocal processed_leaf_count
                    curr_id = curr_node["id"]
                    curr_title = curr_node.get("title", "")
                    sub_children = get_child_topics(curr_id)

                    if sub_children:
                        update_topic_status(curr_id, "processing")

                        for sub in sub_children:
                            async for ev in process_node(sub):
                                yield ev

                        child_mds = []
                        child_concepts = []
                        for sub in sub_children:
                            s_curr = get_topic_by_id(sub["id"]) or sub
                            s_md = s_curr.get("content_md") or ""
                            s_raw = s_curr.get("atomic_concepts")
                            child_mds.append(f"## {sub['title']}\n\n{s_md}")
                            if s_raw:
                                try:
                                    child_concepts.extend(json.loads(s_raw) if isinstance(s_raw, str) else s_raw)
                                except Exception:
                                    pass

                        combined_md = "\n\n".join(child_mds)
                        update_topic_enrichment(
                            topic_id=curr_id,
                            atomic_concepts=json.dumps(child_concepts),
                            content_md=combined_md,
                            status="processed"
                        )
                    else:
                        # Leaf node
                        processed_leaf_count += 1
                        pct = int((processed_leaf_count / total_leaves) * 100)

                        c_current = get_topic_by_id(curr_id) or curr_node
                        c_status = c_current.get("status")
                        c_md = c_current.get("content_md") or ""
                        c_concepts_raw = c_current.get("atomic_concepts")

                        if c_status == "processed" and len(c_md.strip()) > 20 and c_concepts_raw:
                            logger.info(f"Subtopic {curr_id} ('{curr_title}') already processed; resuming from checkpoint.")
                            yield f"data: {json.dumps({'stage': 'processing_child', 'child_id': curr_id, 'child_title': curr_title, 'current': processed_leaf_count, 'total': total_leaves, 'progress': pct, 'message': f'Reusing checkpointed subtopic ({processed_leaf_count}/{total_leaves}): {curr_title}'})}\n\n"
                            return

                        update_topic_status(curr_id, "processing")
                        yield f"data: {json.dumps({'stage': 'processing_child', 'child_id': curr_id, 'child_title': curr_title, 'current': processed_leaf_count, 'total': total_leaves, 'progress': pct, 'message': f'Processing ({processed_leaf_count}/{total_leaves}): {curr_title}'})}\n\n"

                        child_md = c_md
                        code_blocks = {}
                        images = {}
                        sections = []

                        if child_md and len(child_md.strip()) > 20:
                            modified_md_text, code_blocks, images = parse_markdown_assets(child_md, c_current.get("topic_hash", "cache_key"))
                            sections = detect_headings(modified_md_text, c_current.get("start_page", 1))
                            child_md = modified_md_text
                        else:
                            c_start = c_current.get("start_page", 1)
                            c_end = c_current.get("end_page", c_start)
                            raw_md, cache_key, start_page_num = await extract_page_range_chunked(
                                file_path, c_start, c_end, max_pages_per_chunk=6
                            )
                            modified_md_text, code_blocks, images = parse_markdown_assets(raw_md, cache_key)
                            sections = detect_headings(modified_md_text, start_page_num)
                            child_md = modified_md_text

                        heading = curr_title or "Section"
                        text_content = child_md or (sections[0]["text"] if sections else "")

                        section_extraction = await extract_atomic_concepts(
                            heading, text_content, code_blocks, images, req.provider_override
                        )

                        leaf_concepts = []
                        if hasattr(section_extraction, 'atomic_topics') and section_extraction.atomic_topics:
                            for c_idx, t in enumerate(section_extraction.atomic_topics):
                                sec_heading = match_concept_to_section_heading(
                                    sections, t.topic_name, t.summary, t.key_terms
                                )
                                leaf_concepts.append({
                                    "id": f"c_{curr_id}_{c_idx + 1}",
                                    "name": t.topic_name,
                                    "concept_type": t.concept_type or "Definition",
                                    "summary": t.summary or "",
                                    "key_terms": t.key_terms or [],
                                    "section_heading": sec_heading,
                                    "related_code_id": t.related_code_id,
                                    "related_image_id": t.related_image_id,
                                    "mastery_score": None,
                                    "mastery_status": "untested",
                                    "last_drilled_at": None,
                                })

                        update_topic_enrichment(
                            topic_id=curr_id,
                            atomic_concepts=json.dumps(leaf_concepts),
                            content_md=child_md,
                            status="processed"
                        )

                # Process all children under topic_id
                for child in children:
                    async for ev in process_node(child):
                        yield ev

                top_mds = []
                top_concepts = []
                for child in children:
                    c_curr = get_topic_by_id(child["id"]) or child
                    c_md = c_curr.get("content_md") or ""
                    c_raw = c_curr.get("atomic_concepts")
                    top_mds.append(f"## {child['title']}\n\n{c_md}")
                    if c_raw:
                        try:
                            top_concepts.extend(json.loads(c_raw) if isinstance(c_raw, str) else c_raw)
                        except Exception:
                            pass

                parent_md = "\n\n".join(top_mds)
                update_topic_enrichment(
                    topic_id=topic_id,
                    atomic_concepts=json.dumps(top_concepts),
                    content_md=parent_md,
                    status="processed"
                )

                yield f"data: {json.dumps({'stage': 'extracting_topics', 'progress': 100})}\n\n"
                yield f"data: {json.dumps({'status': 'complete', 'topic_id': topic_id, 'children_processed': total_leaves})}\n\n"
                return

            # BRANCH 2: Flat Topic (No children in DB)
            content_md = topic.get("content_md") or ""
            code_blocks = {}
            images = {}
            sections = []
            
            if content_md and len(content_md.strip()) > 20:
                yield f"data: {json.dumps({'stage': f'reading_pdf{extra_msg}'})}\n\n"
                modified_md_text, code_blocks, images = parse_markdown_assets(content_md, topic.get("topic_hash", "cache_key"))
                sections = detect_headings(modified_md_text, topic.get("start_page", 1))
                content_md = modified_md_text
            else:
                yield f"data: {json.dumps({'stage': f'reading_pdf{extra_msg}'})}\n\n"
                raw_md, cache_key, start_page_num = await extract_page_range_chunked(
                    file_path, topic.get("start_page", 1), topic.get("end_page", 1), max_pages_per_chunk=6
                )
                modified_md_text, code_blocks, images = parse_markdown_assets(raw_md, cache_key)
                sections = detect_headings(modified_md_text, start_page_num)
                content_md = modified_md_text
                # Immediate markdown checkpointing so PDF reading is never repeated on retry
                update_topic_content_md(topic_id, content_md)
            
            if topic.get("title") in ("Full Document", "Untitled") and len(sections) >= 2:
                from app.topic_subdivider import subdivide_topic_from_markdown
                subdivided = await subdivide_topic_from_markdown(
                    book_id=topic["book_id"],
                    placeholder_topic_id=topic_id,
                    md_text=content_md,
                    default_start_page=topic.get("start_page", 1),
                    default_end_page=topic.get("end_page", 1)
                )
                if subdivided:
                    yield f"data: {json.dumps({'stage': 'subdivided', 'topic_count': len(subdivided), 'message': f'Auto-subdivided into {len(subdivided)} topics'})}\n\n"

            yield f"data: {json.dumps({'stage': 'extracting_topics', 'section_count': len(sections)})}\n\n"
            
            # Extract concepts from section text to enrich topic in-place
            heading = topic.get("title") or "Section"
            
            # If document is very long (> 16,000 characters) and has multiple detected sections,
            # batch sections into ~12,000 character chunks to prevent daily quota exhaustion and optimize speed
            atomic_concepts = []
            if len(content_md) > 16000 and len(sections) >= 2:
                valid_sections = [s for s in sections if s.get("text", "").strip() and len(s["text"].strip()) >= 50]
                batches = []
                current_batch = []
                current_chars = 0

                for sec in valid_sections:
                    sec_len = len(sec["text"])
                    if current_batch and (current_chars + sec_len > 12000):
                        batches.append(current_batch)
                        current_batch = [sec]
                        current_chars = sec_len
                    else:
                        current_batch.append(sec)
                        current_chars += sec_len

                if current_batch:
                    batches.append(current_batch)

                total_batches = max(1, len(batches))
                yield f"data: {json.dumps({'stage': 'extracting_topics', 'progress': 25, 'total_sections': len(valid_sections), 'total_batches': total_batches, 'message': f'Extracting concepts across {len(valid_sections)} sections in {total_batches} batches'})}\n\n"

                # Check for existing checkpointed concepts from a previous partial run
                existing_concepts = []
                if not getattr(req, "force_reprocess", False):
                    existing_raw = topic.get("atomic_concepts")
                    if existing_raw:
                        try:
                            existing_concepts = json.loads(existing_raw) if isinstance(existing_raw, str) else existing_raw
                        except Exception:
                            existing_concepts = []

                for b_idx, batch_secs in enumerate(batches, 1):
                    if len(batch_secs) == 1:
                        batch_heading = batch_secs[0]["heading"]
                        batch_text = batch_secs[0]["text"]
                    else:
                        batch_heading = f"{batch_secs[0]['heading']} to {batch_secs[-1]['heading']}"
                        batch_text = "\n\n".join(f"## {s['heading']}\n{s['text']}" for s in batch_secs)

                    pct = int(25 + 65 * ((b_idx - 1) / total_batches))

                    # Check if this batch was already checkpointed in a prior attempt
                    batch_headings_set = {s["heading"] for s in batch_secs}
                    existing_batch_concepts = [
                        c for c in existing_concepts 
                        if c.get("batch_idx") == b_idx or (c.get("section_heading") and c.get("section_heading") in batch_headings_set)
                    ]

                    if existing_batch_concepts and not getattr(req, "force_reprocess", False):
                        logger.info(f"Reusing checkpointed batch {b_idx}/{total_batches} ('{batch_heading}') with {len(existing_batch_concepts)} concepts.")
                        yield f"data: {json.dumps({'stage': 'extracting_topics', 'progress': pct, 'current_batch': b_idx, 'total_batches': total_batches, 'message': f'Reusing checkpointed batch {b_idx}/{total_batches}: {batch_heading}'})}\n\n"
                        atomic_concepts.extend(existing_batch_concepts)
                        continue

                    yield f"data: {json.dumps({'stage': 'extracting_topics', 'progress': pct, 'current_batch': b_idx, 'total_batches': total_batches, 'message': f'Processing batch {b_idx}/{total_batches}: {batch_heading}'})}\n\n"

                    sec_extraction = await extract_atomic_concepts(
                        batch_heading, batch_text, code_blocks, images, req.provider_override
                    )
                    if hasattr(sec_extraction, 'atomic_topics') and sec_extraction.atomic_topics:
                        for idx, t in enumerate(sec_extraction.atomic_topics):
                            sec_heading = match_concept_to_section_heading(
                                batch_secs, t.topic_name, t.summary, t.key_terms
                            )
                            atomic_concepts.append({
                                "id": f"c_{b_idx}_{idx + 1}",
                                "batch_idx": b_idx,
                                "name": t.topic_name,
                                "concept_type": t.concept_type or "Definition",
                                "summary": t.summary or "",
                                "key_terms": t.key_terms or [],
                                "section_heading": sec_heading,
                                "related_code_id": t.related_code_id,
                                "related_image_id": t.related_image_id,
                                "mastery_score": None,
                                "mastery_status": "untested",
                                "last_drilled_at": None,
                            })

                    # Immediate Checkpoint: Persist to SQLite after every single completed batch!
                    update_topic_enrichment(
                        topic_id=topic_id,
                        atomic_concepts=json.dumps(atomic_concepts),
                        content_md=content_md,
                        status="processing"
                    )

                yield f"data: {json.dumps({'stage': 'extracting_topics', 'progress': 90, 'message': 'Finalizing topic enrichment'})}\n\n"
            else:
                text_content = content_md or (sections[0]["text"] if sections else "")
                yield f"data: {json.dumps({'stage': 'extracting_topics', 'progress': 50})}\n\n"
                section_extraction = await extract_atomic_concepts(
                    heading, text_content, code_blocks, images, req.provider_override
                )
                if hasattr(section_extraction, 'atomic_topics') and section_extraction.atomic_topics:
                    for idx, t in enumerate(section_extraction.atomic_topics):
                        sec_heading = match_concept_to_section_heading(
                            sections, t.topic_name, t.summary, t.key_terms
                        )
                        atomic_concepts.append({
                            "id": f"c_{idx + 1}",
                            "batch_idx": 1,
                            "name": t.topic_name,
                            "concept_type": t.concept_type or "Definition",
                            "summary": t.summary or "",
                            "key_terms": t.key_terms or [],
                            "section_heading": sec_heading,
                            "related_code_id": t.related_code_id,
                            "related_image_id": t.related_image_id,
                            "mastery_score": None,
                            "mastery_status": "untested",
                            "last_drilled_at": None,
                        })

            # Enrich topic with structured atomic concepts
            update_topic_enrichment(
                topic_id=topic_id,
                atomic_concepts=json.dumps(atomic_concepts),
                content_md=content_md,
                status="processed"
            )
            
            yield f"data: {json.dumps({'stage': 'extracting_topics', 'progress': 100})}\n\n"
            yield f"data: {json.dumps({'status': 'complete', 'topic_id': topic_id})}\n\n"
            
        except asyncio.CancelledError:
            logger.warning(f"Client disconnected during topic {topic_id} processing.")
            if not children and (atomic_concepts or content_md):
                update_topic_enrichment(
                    topic_id=topic_id,
                    atomic_concepts=json.dumps(atomic_concepts) if atomic_concepts else None,
                    content_md=content_md or None,
                    status="unprocessed"
                )
            raise
        except Exception as e:
            import traceback
            logger.error(f"Error processing topic {topic_id}: {e}\n{traceback.format_exc()}")
            
            # If batch concepts or content_md were extracted for a flat topic, preserve them in SQLite
            if not children and (atomic_concepts or content_md):
                update_topic_enrichment(
                    topic_id=topic_id,
                    atomic_concepts=json.dumps(atomic_concepts) if atomic_concepts else None,
                    content_md=content_md or None,
                    status="unprocessed"
                )
            else:
                update_topic_status(topic_id, "unprocessed")
            
            saved_count = 0
            if children:
                for c in children:
                    c_curr = get_topic_by_id(c["id"])
                    if c_curr and c_curr.get("status") == "processing":
                        update_topic_status(c["id"], "unprocessed")
                    elif c_curr and c_curr.get("status") == "processed":
                        saved_count += 1

            err_dict = error_event(e, include_debug=_is_debug())
            if children and saved_count > 0:
                base_msg = err_dict.get("message", "")
                err_dict["message"] = f"{base_msg} (Progress checkpointed: {saved_count}/{len(children)} subtopics saved. You can resume safely.)"
                err_dict["checkpointed_count"] = saved_count
                err_dict["total_children"] = len(children)
            elif atomic_concepts and len(atomic_concepts) > 0:
                base_msg = err_dict.get("message", "")
                err_dict["message"] = f"{base_msg} (Progress checkpointed: {len(atomic_concepts)} concepts saved across completed batches. You can resume safely.)"
                err_dict["checkpointed_concepts"] = len(atomic_concepts)

            yield f"data: {json.dumps(err_dict)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")



# ── Socratic Drill Endpoints ────────────────────────────────────────────

class DrillGenerateRequest(BaseModel):
    provider_override: str | None = None
    concept_name: str | None = None
    concept_type: str | None = None
    concept_summary: str | None = None
    key_terms: list[str] | None = None

@app.post("/topics/{topic_id}/drill/generate")
async def drill_generate_questions(topic_id: int, req: DrillGenerateRequest):
    """Generate 2 tiered diagnostic questions for a topic or targeted atomic concept."""
    from app.database import get_topic_by_id
    from app.socratic_drill import generate_diagnostic_questions

    topic = get_topic_by_id(topic_id)
    if not topic:
        return JSONResponse(status_code=404, content={"error": "Topic not found"})

    # Resolve topic content: prefer stored content_md, fallback to PDF extraction
    content = await ensure_topic_markdown(topic_id)

    concept_summary = req.concept_summary
    key_terms = req.key_terms
    concept_type = req.concept_type
    if req.concept_name:
        try:
            stored_concepts = json.loads(topic.get("atomic_concepts") or "[]")
            for c in stored_concepts:
                c_name = c.get("name") or c.get("topic_name")
                if c_name and c_name.strip().lower() == req.concept_name.strip().lower():
                    concept_summary = concept_summary or c.get("summary")
                    key_terms = key_terms or c.get("key_terms")
                    concept_type = concept_type or c.get("concept_type")
                    break
        except Exception:
            pass

    try:
        result = await generate_diagnostic_questions(
            topic_title=topic["title"],
            breadcrumb=topic.get("breadcrumb") or "",
            start_page=topic["start_page"],
            topic_content=content,
            concept_name=req.concept_name,
            concept_type=concept_type,
            concept_summary=concept_summary,
            key_terms=key_terms,
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
    tier: str | None = "causal_mechanism"
    socratic_hint: str | None = None
    concept_name: str | None = None
    provider_override: str | None = None

@app.post("/topics/{topic_id}/drill/evaluate")
async def drill_evaluate_answer(topic_id: int, req: DrillEvaluateRequest):
    """Evaluate a student's answer and return diagnostic feedback."""
    from app.database import get_topic_by_id, update_topic_mastery, update_concept_mastery, record_drill_attempt
    from app.socratic_drill import evaluate_student_answer

    topic = get_topic_by_id(topic_id)
    if not topic:
        return JSONResponse(status_code=404, content={"error": "Topic not found"})

    content = await ensure_topic_markdown(topic_id)

    concept_summary = None
    key_terms = None
    if req.concept_name:
        try:
            stored_concepts = json.loads(topic.get("atomic_concepts") or "[]")
            for c in stored_concepts:
                c_name = c.get("name") or c.get("topic_name")
                if c_name and c_name.strip().lower() == req.concept_name.strip().lower():
                    concept_summary = c.get("summary")
                    key_terms = c.get("key_terms")
                    break
        except Exception:
            pass

    try:
        result = await evaluate_student_answer(
            question_text=req.question_text,
            key_invariants=req.key_invariants,
            topic_content=content,
            student_answer=req.student_answer,
            concept_name=req.concept_name,
            provider_override=req.provider_override,
        )

        # Record attempt in drill_attempts
        try:
            dumped_result = result.model_dump()
            record_drill_attempt(
                topic_id=topic_id,
                question_id=req.question_id,
                question_text=req.question_text,
                tier=req.tier or "causal_mechanism",
                socratic_hint=req.socratic_hint,
                student_answer=req.student_answer,
                mastery_score=result.mastery_score,
                status=result.status,
                strengths=dumped_result.get("strengths", []),
                diagnosed_gaps=dumped_result.get("diagnosed_gaps", []),
                misconceptions=dumped_result.get("misconceptions", []),
                socratic_nudge=result.socratic_nudge,
                concept_name=req.concept_name,
            )
        except Exception as e:
            logger.warning(f"Failed to record drill attempt: {e}")

        # Persist mastery score: concept-scoped or whole-topic
        if req.concept_name:
            update_concept_mastery(topic_id, req.concept_name, result.mastery_score, result.status)
        else:
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
    from app.database import get_topic_by_id, save_flashcards
    from app.llm_segment import generate_flashcards_for_topic
    
    topic = get_topic_by_id(topic_id)
    if not topic:
        return JSONResponse(status_code=404, content={"error": "Topic not found"})
        
    summary = req.summary_override or topic.get("summary") or ""
    topic_text = await ensure_topic_markdown(topic_id)
            
    target_topic_name = topic.get("title", "")
    target_concept_type = None
    target_key_terms = []
    custom_prompt = req.custom_prompt or ""

    if req.concept_name:
        try:
            stored_concepts = json.loads(topic.get("atomic_concepts") or "[]")
            for c in stored_concepts:
                c_name = c.get("name") or c.get("topic_name")
                if c_name and c_name.strip().lower() == req.concept_name.strip().lower():
                    target_topic_name = f"{topic.get('title', '')} → {c_name}"
                    target_concept_type = c.get("concept_type")
                    target_key_terms = c.get("key_terms") or []
                    if c.get("summary"):
                        summary = c.get("summary")
                    break
        except Exception as e:
            logger.warning(f"Error parsing atomic concepts for topic {topic_id}: {e}")

        # Direct prompt specifically to the target concept
        concept_instruction = f"- Targeted Atomic Topic: Focus exclusively on '{req.concept_name}'."
        if target_concept_type:
            concept_instruction += f" Concept Type: {target_concept_type}."
        if target_key_terms:
            concept_instruction += f" Key terms to test: {', '.join(target_key_terms)}."
        custom_prompt = f"{custom_prompt}\n{concept_instruction}".strip()

    flashcard_list = await generate_flashcards_for_topic(
        topic_name=target_topic_name,
        breadcrumb=topic.get("breadcrumb", ""),
        topic_text=topic_text,
        summary=summary,
        count=req.count,
        custom_prompt=custom_prompt,
        provider_override=req.provider_override
    )
    
    # Save the generated flashcards
    # Flashcard schema needs topic_name, concept_type, etc., which are on the topic
    cards_to_save = []
    for fc in flashcard_list.flashcards:
        card_dict = fc.model_dump()
        card_dict["topic_name"] = req.concept_name if req.concept_name else topic.get("title", "")
        card_dict["breadcrumb"] = topic.get("breadcrumb", "")
        card_dict["source_page"] = topic.get("start_page")
        if target_concept_type and not card_dict.get("concept_type"):
            card_dict["concept_type"] = target_concept_type
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
    from app.database import get_descendant_topics
    with get_connection() as conn:
        cursor = conn.cursor()
        query = "SELECT f.* FROM flashcards f"
        params = []
        if book_id is not None:
            query += " JOIN topics t ON f.topic_id = t.id WHERE t.book_id = ?"
            params.append(book_id)
            if topic_id is not None:
                descendants = get_descendant_topics(topic_id)
                target_ids = [topic_id] + [d["id"] for d in descendants]
                placeholders = ",".join("?" for _ in target_ids)
                query += f" AND f.topic_id IN ({placeholders})"
                params.extend(target_ids)
        elif topic_id is not None:
            descendants = get_descendant_topics(topic_id)
            target_ids = [topic_id] + [d["id"] for d in descendants]
            placeholders = ",".join("?" for _ in target_ids)
            query += f" WHERE f.topic_id IN ({placeholders})"
            params.extend(target_ids)
            
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

class ReadingStateRequest(BaseModel):
    page_number: int | None = None
    topic_id: int | None = None

@app.get("/books/{book_id}")
def get_book_by_id_api(book_id: int):
    from app.database import get_book_by_id, update_book_reading_state
    book = get_book_by_id(book_id)
    if not book:
        return JSONResponse(status_code=404, content={"error": "Book not found"})
    update_book_reading_state(book_id)
    return get_book_by_id(book_id)

@app.patch("/books/{book_id}/reading-state")
def update_reading_state_api(book_id: int, req: ReadingStateRequest):
    from app.database import get_book_by_id, update_book_reading_state
    book = get_book_by_id(book_id)
    if not book:
        return JSONResponse(status_code=404, content={"error": "Book not found"})
    update_book_reading_state(book_id, req.page_number, req.topic_id)
    return {"status": "ok", "book_id": book_id, "last_read_page": req.page_number, "last_topic_id": req.topic_id}

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
def delete_book_api(book_id: int, authorization: Optional[str] = Header(None)):
    from app.database import delete_book, get_connection
    
    # 1. Fetch book metadata (uuid, file_hash) before deletion
    book_uuid = None
    file_hash = None
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT uuid, file_hash FROM books WHERE id = ?", (book_id,))
            row = cursor.fetchone()
            if row:
                book_uuid = row["uuid"]
                file_hash = row["file_hash"]
    except Exception as e:
        logger.warning(f"Failed to fetch book uuid/file_hash before delete: {e}")

    # 2. Local SQLite deletion and trigger-based local tombstone
    success = delete_book(book_id)
    if not success:
        return JSONResponse(status_code=404, content={"error": "Book not found"})
        
    # 3. Synchronous Supabase cleanup if authenticated
    if isinstance(authorization, str) and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()
        try:
            from datetime import datetime, timezone
            from app.sync_service import get_supabase_client, extract_user_id_from_token
            supabase = get_supabase_client(token)
            user_id = extract_user_id_from_token(token)
            if not user_id:
                try:
                    user_response = supabase.auth.get_user()
                    user_id = user_response.user.id if user_response and user_response.user else None
                except Exception:
                    pass

            if book_uuid:
                try:
                    supabase.table("pdf_annotations").delete().eq("book_id", book_uuid).execute()
                except Exception:
                    pass
                try:
                    supabase.table("books").delete().eq("uuid", book_uuid).execute()
                except Exception as del_err:
                    logger.warning(f"Failed to delete book {book_uuid} from Supabase: {del_err}")

                if user_id:
                    now_ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                    try:
                        supabase.table("sync_tombstones").upsert([{
                            "uuid": book_uuid,
                            "table_name": "books",
                            "deleted_at": now_ts,
                            "user_id": user_id
                        }], on_conflict="uuid").execute()
                    except Exception as tomb_err:
                        logger.warning(f"Failed to upsert tombstone on Supabase: {tomb_err}")

            if file_hash and user_id:
                try:
                    supabase.storage.from_("user_pdfs").remove([f"{user_id}/{file_hash}.pdf"])
                except Exception as storage_err:
                    logger.warning(f"Failed to delete pdf from Supabase storage: {storage_err}")
        except Exception as e:
            logger.warning(f"Failed to perform remote Supabase deletion during delete_book: {e}")

    # 4. Cascade to DocumentRepository
    try:
        from app.models.repositories import DocumentRepository
        docs = DocumentRepository.list_by_workspace(workspace_id="default", limit=500)
        for doc in docs:
            meta = doc.get("metadata") or {}
            if meta.get("book_id") == book_id or str(meta.get("book_id")) == str(book_id) or doc.get("id") == str(book_id):
                DocumentRepository.delete_document_cascade(doc["id"], "default")
    except Exception as e:
        logger.warning(f"Failed to cascade delete to DocumentRepository: {e}")

    return {"status": "success"}

@app.get("/topics")
def get_topics_api(book_id: int | None = None, skip: int = 0, limit: int = 10000):
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

@app.delete("/topics/{topic_id}/notes")
def delete_topic_notes_api(topic_id: int):
    from app.database import delete_note_by_topic
    deleted = delete_note_by_topic(topic_id)
    return {"status": "success", "deleted": deleted}

@app.get("/notes")
def get_all_notes_api(book_id: int | None = None, search: str | None = None):
    from app.database import get_all_notes
    return get_all_notes(book_id=book_id, search=search)

@app.get("/notes/annotations")
def get_all_annotations_api(book_id: int | None = None):
    from app.database import get_all_annotations
    return get_all_annotations(book_id=book_id)


async def generate_single_cornell_note(topic: dict, provider_override: str | None = None) -> str:
    """Generates a structured, LaTeX-enabled Cornell Study Guide for an individual topic."""
    from app.llm_providers.factory import get_llm_provider
    from app.config import settings
    from copy import copy
    import json
    
    topic_id = topic.get("id")
    content = topic.get("content_md") or ""
    if not content or len(content.strip()) < 30:
        if topic_id:
            try:
                content = await ensure_topic_markdown(topic_id)
            except Exception as e:
                logger.warning(f"Could not extract markdown for topic {topic_id}: {e}")
                content = topic.get("summary") or ""
        else:
            content = topic.get("summary") or ""
            
    concepts_summary = ""
    if topic.get("atomic_concepts"):
        try:
            concepts = json.loads(topic["atomic_concepts"])
            if concepts:
                concepts_summary = "Key Atomic Concepts:\n" + "\n".join(
                    f"- {c.get('name')} ({c.get('concept_type', 'Concept')}): {c.get('summary', '')}"
                    for c in concepts[:12]
                )
        except Exception:
            pass

    import re
    diagram_matches = re.findall(r'(!\[.*?\]\(.*?\))', content)
    diagrams_reference = ""
    if diagram_matches:
        diagrams_reference = "Available Diagrams & Figures from Source Document (PRESERVE & EMBED IN NOTES):\n" + "\n".join(
            f"- {match}" for match in diagram_matches
        )

    from app.prompt_manager import get_prompt_template
    scaffold_prompt = get_prompt_template("cornell_scaffold_prompt").format(
        topic_title=topic.get('title', 'Study Topic'),
        breadcrumb=topic.get('breadcrumb', ''),
        concepts_summary=concepts_summary,
        content_reference=content[:8000],
        diagrams_reference=diagrams_reference,
    )

    local_settings = copy(settings)
    provider = get_llm_provider(local_settings, provider_override=provider_override)
    scaffold_markdown = await provider.generate(scaffold_prompt, json_schema=None, temperature=0.2, max_tokens=4096, feature="cornell_notes")
    if not scaffold_markdown or not scaffold_markdown.strip():
        raise RuntimeError(f"LLM provider returned empty response for study notes of '{topic.get('title')}'.")
    return scaffold_markdown.strip()


def extract_cue_questions(note_text: str) -> str:
    """Extracts the self-testing cue questions section from a Cornell note."""
    import re
    match = re.search(r'##\s*📌?\s*Self-Testing Cue Questions.*?\n(.*)', note_text, re.DOTALL | re.IGNORECASE)
    if match:
        cues_text = match.group(1).strip()
        next_heading = re.search(r'\n##\s+', cues_text)
        if next_heading:
            cues_text = cues_text[:next_heading.start()].strip()
        return cues_text
    return ""


def assemble_master_chapter_guide(parent_topic: dict, child_results: list[tuple[dict, str]]) -> str:
    """Assembles individual subtopic Cornell notes into an authoritative Master Chapter Study Guide."""
    parent_title = parent_topic.get("title", "Chapter Study Guide")
    subtopic_titles = [c.get("title", f"Part {i}") for i, (c, _) in enumerate(child_results, 1)]
    subtopics_summary = ", ".join(f"*{t}*" for t in subtopic_titles)
    
    lines = [
        f"# 📚 {parent_title} — Master Study Guide\n",
        f"> **Chapter Overview**: Synthesized master notes covering {len(child_results)} subtopics: {subtopics_summary}.\n",
        "## 📑 Subtopics Navigation\n"
    ]
    
    for idx, (c, _) in enumerate(child_results, 1):
        c_title = c.get("title", f"Part {idx}")
        start_p = c.get('start_page', '?')
        end_p = c.get('end_page', '?')
        lines.append(f"{idx}. **{c_title}** (p. {start_p}–{end_p})")
    
    lines.append("\n---\n")
    
    cue_sections = []
    for idx, (c, note_text) in enumerate(child_results, 1):
        c_title = c.get("title", f"Part {idx}")
        lines.append(f"## 📑 Part {idx}: {c_title}\n")
        lines.append(note_text.strip())
        lines.append("\n\n---\n")
        
        cues = extract_cue_questions(note_text)
        if cues:
            cue_sections.append(f"### 📌 From {c_title}:\n{cues}")
            
    if cue_sections:
        lines.append("# 🎯 Chapter Master Active Recall Deck\n")
        lines.append("*Consolidated cue questions from all subtopics for self-testing before exams:*\n\n")
        lines.append("\n\n".join(cue_sections))
        
    return "\n".join(lines)


class NoteScaffoldRequest(BaseModel):
    provider_override: str | None = None

@app.post("/topics/{topic_id}/notes/scaffold-stream")
async def generate_note_scaffold_stream_api(topic_id: int, req: NoteScaffoldRequest):
    """
    Streaming SSE endpoint for Cornell Study Guide generation.
    Emits real-time progress events per subtopic, checkpoints each subtopic to SQLite immediately,
    and supports instant resumption upon retry.
    """
    from app.database import get_topic_by_id, get_child_topics, get_descendant_topics, get_note_by_topic, save_note_for_topic
    from app.config import get_provider_concurrency
    
    topic = get_topic_by_id(topic_id)
    if not topic:
        return JSONResponse(status_code=404, content={"error": "Topic not found"})
        
    children = get_child_topics(topic_id)
    if children and any(get_child_topics(c["id"]) for c in children):
        all_descendants = get_descendant_topics(topic_id)
        parent_ids = {d["parent_id"] for d in all_descendants if d.get("parent_id")}
        leaf_children = [d for d in all_descendants if d["id"] not in parent_ids]
        if leaf_children:
            children = leaf_children
    
    async def event_generator():
        try:
            if children:
                total_children = len(children)
                start_payload = {
                    "stage": "starting",
                    "status": "generating",
                    "total": total_children,
                    "current": 0,
                    "progress": 0,
                    "message": f"Synthesizing Master Guide across {total_children} subtopics...",
                }
                yield f"data: {json.dumps(start_payload)}\n\n"
                
                concurrency = get_provider_concurrency(req.provider_override)
                sem = asyncio.Semaphore(concurrency)
                
                completed_map: dict[int, tuple[dict, str]] = {}
                pending_children = []
                
                # Check for cached notes first
                for idx, child in enumerate(children, 1):
                    c_id = child["id"]
                    existing_note = get_note_by_topic(c_id)
                    child_title = child.get("title") or f"Subtopic {idx}"
                    if existing_note and len(existing_note.strip()) > 60:
                        logger.info(f"Reusing existing note for child topic {c_id} ('{child_title}')")
                        completed_map[c_id] = (child, existing_note)
                        pct = int((len(completed_map) / total_children) * 100)
                        reuse_payload = {
                            "stage": "reusing_child",
                            "status": "generating",
                            "child_id": c_id,
                            "child_title": child_title,
                            "current": len(completed_map),
                            "total": total_children,
                            "progress": pct,
                            "message": f"Reusing saved note for {child_title}",
                        }
                        yield f"data: {json.dumps(reuse_payload)}\n\n"
                    else:
                        pending_children.append((idx, child))
                
                # If all children are already cached, assemble and complete!
                if len(completed_map) == total_children:
                    ordered_results = [completed_map[c["id"]] for c in children]
                    master_guide = assemble_master_chapter_guide(topic, ordered_results)
                    save_note_for_topic(topic_id, master_guide)
                    complete_payload = {
                        "status": "complete",
                        "stage": "complete",
                        "topic_id": topic_id,
                        "scaffold": master_guide,
                        "note": master_guide,
                        "progress": 100,
                        "message": "Master Guide ready!",
                    }
                    yield f"data: {json.dumps(complete_payload)}\n\n"
                    return

                progress_queue = asyncio.Queue()

                async def process_child(idx: int, child: dict):
                    c_id = child["id"]
                    child_title = child.get("title") or f"Subtopic {idx}"
                    async with sem:
                        if concurrency <= 2:
                            await asyncio.sleep(0.5)
                        current_pct = int((len(completed_map) / total_children) * 100)
                        await progress_queue.put({
                            "stage": "generating_child",
                            "status": "generating",
                            "child_id": c_id,
                            "child_title": child_title,
                            "current": len(completed_map),
                            "total": total_children,
                            "progress": max(5, current_pct),
                            "message": f"Teaching subtopic {idx} of {total_children}: {child_title}...",
                        })
                        c_note = await generate_single_cornell_note(child, req.provider_override)
                        save_note_for_topic(c_id, c_note)
                        return c_id, child, c_note

                async def run_child_tasks():
                    tasks = [asyncio.create_task(process_child(idx, c)) for idx, c in pending_children]
                    try:
                        for future in asyncio.as_completed(tasks):
                            c_id, child, c_note = await future
                            completed_map[c_id] = (child, c_note)
                            child_title = child.get("title") or "Subtopic"
                            
                            # Incrementally update parent master guide so far
                            current_ordered = [completed_map[c["id"]] for c in children if c["id"] in completed_map]
                            if current_ordered:
                                partial_master = assemble_master_chapter_guide(topic, current_ordered)
                                save_note_for_topic(topic_id, partial_master)
                                
                            pct = int((len(completed_map) / total_children) * 100)
                            prog_payload = {
                                "stage": "generating_child",
                                "status": "generating",
                                "child_id": c_id,
                                "child_title": child_title,
                                "current": len(completed_map),
                                "total": total_children,
                                "progress": pct,
                                "message": f"Completed subtopic {len(completed_map)} of {total_children}: {child_title}",
                            }
                            await progress_queue.put(prog_payload)
                        await progress_queue.put(None)
                    except Exception as sub_err:
                        for t in tasks:
                            if not t.done():
                                t.cancel()
                        saved_count = len(completed_map)
                        logger.warning(f"Error during Cornell generation: {sub_err}. Checkpointed {saved_count}/{total_children} subtopics.")
                        await progress_queue.put({
                            "status": "error",
                            "message": f"{str(sub_err)} (Checkpointed {saved_count} of {total_children} subtopics. Click Cornell to resume)",
                            "checkpointed": saved_count,
                        })

                child_runner_task = asyncio.create_task(run_child_tasks())
                while True:
                    event = await progress_queue.get()
                    if event is None:
                        break
                    yield f"data: {json.dumps(event)}\n\n"
                    if event.get("status") == "error":
                        return

                await child_runner_task
                ordered_results = [completed_map[c["id"]] for c in children]
                master_guide = assemble_master_chapter_guide(topic, ordered_results)
                save_note_for_topic(topic_id, master_guide)
                
                final_payload = {
                    "status": "complete",
                    "stage": "complete",
                    "topic_id": topic_id,
                    "scaffold": master_guide,
                    "note": master_guide,
                    "progress": 100,
                    "children_count": total_children,
                    "message": "Master Guide ready!",
                }
                yield f"data: {json.dumps(final_payload)}\n\n"
            else:
                t_title = topic.get("title", "Topic")
                progress_queue = asyncio.Queue()

                async def progress_ticker():
                    ticker_stages = [
                        (20, f"Reading source context & key concepts for {t_title}..."),
                        (40, f"Formulating first-principles motivation & intuitive analogies..."),
                        (60, f"Breaking down equation anatomy & step-by-step mechanisms..."),
                        (80, f"Synthesizing concrete worked example & calculations..."),
                        (95, f"Assembling visual schematics, exam pitfalls & active recall cues..."),
                    ]
                    for pct, msg in ticker_stages:
                        await asyncio.sleep(2.5)
                        await progress_queue.put({
                            "stage": "generating_note",
                            "status": "generating",
                            "current": 1,
                            "total": 1,
                            "progress": pct,
                            "message": msg,
                        })

                # Initial event (stage="generating_note") for immediate UI feedback
                single_start = {
                    "stage": "generating_note",
                    "status": "generating",
                    "current": 1,
                    "total": 1,
                    "progress": 10,
                    "message": f"Synthesizing Explanatory Study Guide for {t_title}...",
                }
                yield f"data: {json.dumps(single_start)}\n\n"

                ticker_task = asyncio.create_task(progress_ticker())
                note_task = asyncio.create_task(generate_single_cornell_note(topic, req.provider_override))

                while not note_task.done():
                    try:
                        event = await asyncio.wait_for(progress_queue.get(), timeout=0.5)
                        yield f"data: {json.dumps(event)}\n\n"
                    except asyncio.TimeoutError:
                        pass

                ticker_task.cancel()
                note = await note_task
                save_note_for_topic(topic_id, note)
                
                single_done = {
                    "status": "complete",
                    "stage": "complete",
                    "topic_id": topic_id,
                    "scaffold": note,
                    "note": note,
                    "progress": 100,
                    "message": f"Study Guide for {t_title} ready!",
                }
                yield f"data: {json.dumps(single_done)}\n\n"

        except Exception as e:
            logger.error(f"Failed to generate note scaffold stream: {e}")
            yield f"data: {json.dumps(error_event(e, include_debug=_is_debug()))}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/topics/{topic_id}/notes/scaffold")
async def generate_note_scaffold_api(topic_id: int, req: NoteScaffoldRequest):
    """
    Generate a structured Cornell Study Guide.
    If the topic has child subtopics (e.g. Chapter with 4.1, 4.2), it generates Cornell notes
    for each child concurrently (reusing any existing child notes) and compiles an authoritative
    Master Chapter Guide with subtopic navigation and a consolidated Master Active Recall Deck.
    """
    from app.database import get_topic_by_id, get_child_topics, get_descendant_topics, get_note_by_topic, save_note_for_topic
    from app.config import get_provider_concurrency
    
    topic = get_topic_by_id(topic_id)
    if not topic:
        return JSONResponse(status_code=404, content={"error": "Topic not found"})
        
    children = get_child_topics(topic_id)
    if children and any(get_child_topics(c["id"]) for c in children):
        all_descendants = get_descendant_topics(topic_id)
        parent_ids = {d["parent_id"] for d in all_descendants if d.get("parent_id")}
        leaf_children = [d for d in all_descendants if d["id"] not in parent_ids]
        if leaf_children:
            children = leaf_children
    
    try:
        if children:
            logger.info(f"Generating hierarchical Cornell notes for parent topic {topic_id} ({len(children)} children)...")
            
            concurrency = get_provider_concurrency(req.provider_override)
            sem = asyncio.Semaphore(concurrency)
            
            async def process_child(child):
                c_id = child["id"]
                existing_note = get_note_by_topic(c_id)
                if existing_note and len(existing_note.strip()) > 60:
                    logger.info(f"Reusing existing note for child topic {c_id} ('{child.get('title')}')")
                    return child, existing_note
                    
                async with sem:
                    if concurrency <= 2:
                        await asyncio.sleep(0.5)
                    c_note = await generate_single_cornell_note(child, req.provider_override)
                    save_note_for_topic(c_id, c_note)
                    return child, c_note
                    
            child_results = await asyncio.gather(*(process_child(c) for c in children))
            
            master_guide = assemble_master_chapter_guide(topic, child_results)
            save_note_for_topic(topic_id, master_guide)
            
            return {
                "topic_id": topic_id,
                "scaffold": master_guide,
                "note": master_guide,
                "children_count": len(children)
            }
        else:
            note = await generate_single_cornell_note(topic, req.provider_override)
            save_note_for_topic(topic_id, note)
            return {"topic_id": topic_id, "scaffold": note, "note": note}
            
    except Exception as e:
        logger.error(f"Failed to generate note scaffold: {e}")
        return error_response(e, include_debug=_is_debug())


class NoteAppendRequest(BaseModel):
    content: str
    section_title: str | None = None

@app.post("/topics/{topic_id}/notes/append")
def append_topic_notes_api(topic_id: int, req: NoteAppendRequest):
    """Appends Markdown content to a topic's study notes."""
    from app.database import get_note_by_topic, save_note_for_topic
    existing = get_note_by_topic(topic_id) or ""
    
    append_block = req.content.strip()
    if req.section_title:
        append_block = f"\n\n### {req.section_title}\n{append_block}"
    else:
        append_block = f"\n\n{append_block}"
        
    updated = (existing.rstrip() + append_block).strip()
    save_note_for_topic(topic_id, updated)
    return {"status": "success", "note": updated}


@app.post("/notes/upload-image")
async def upload_note_image_api(file: UploadFile = File(...)):
    """Uploads an image or diagram to attach to study notes."""
    import uuid
    import shutil
    
    notes_img_dir = os.path.join(PARSED_DOCS_DIR, "note_images")
    os.makedirs(notes_img_dir, exist_ok=True)
    
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"):
        ext = ".png"
    
    unique_filename = f"note_diagram_{uuid.uuid4().hex[:12]}{ext}"
    dest_path = os.path.join(notes_img_dir, unique_filename)
    
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {
        "status": "success",
        "filename": unique_filename,
        "url": f"images/{unique_filename}"
    }


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
            md_text, cache_key, start_page_num = await extract_raw_text(pdf_bytes, start_page)
            yield f"data: {json.dumps({'stage': 'Extracting markdown assets'})}\n\n"
            
            modified_md_text, code_blocks, images = parse_markdown_assets(md_text, cache_key)
            sections = detect_headings(modified_md_text, start_page_num)
            
            yield f"data: {json.dumps({'stage': 'Waiting on LLM response', 'sections': len(sections)})}\n\n"
            
            import asyncio
            semaphore = asyncio.Semaphore(get_provider_concurrency(provider))
            
            tasks = [
                asyncio.create_task(process_section(
                    sec=sec,
                    chapter_title=chapter_title or sec["heading"],
                    skip_chapter_filter=False,
                    code_blocks=code_blocks,
                    images=images,
                    provider_override=provider,
                    book_id=None,
                    book_hash=file_hash,
                    semaphore=semaphore,
                ))
                for sec in sections
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            all_chunks = []
            first_recall_err = None
            for res in results:
                if isinstance(res, RecallError):
                    logger.error(f"Section extraction failed with RecallError: {res}")
                    if not first_recall_err:
                        first_recall_err = res
                elif isinstance(res, Exception):
                    logger.error(f"Section extraction failed: {res}")
                elif isinstance(res, list):
                    all_chunks.extend(res)
            
            if not all_chunks and first_recall_err:
                raise first_recall_err
            
            chunks_json = [c.model_dump() for c in all_chunks]
            yield f"data: {json.dumps({'stage': 'done', 'chunks': chunks_json})}\n\n"
        except Exception as e:
            logger.error(f"Chunk stream failed: {e}")
            yield f"data: {json.dumps(error_event(e, include_debug=_is_debug()))}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
@app.get("/api/sync/pdfs")
async def sync_pdfs_endpoint(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split("Bearer ")[1]
    
    from app.sync_service import download_missing_pdfs_stream
    return StreamingResponse(download_missing_pdfs_stream(token), media_type="text/event-stream")


@app.post("/books/{book_id}/reparse-handwriting")
async def reparse_handwriting_endpoint(book_id: int):
    """Extracts handwritten notes with Marker and updates the topic hierarchy."""
    from app.topic_subdivider import reparse_book_with_marker
    try:
        result = await reparse_book_with_marker(book_id)
        return result
    except Exception as e:
        logger.error(f"Error reparsing book {book_id} with marker: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/books/{book_id}/reparse-handwriting-stream")
async def reparse_handwriting_stream_endpoint(book_id: int):
    """Streams SSE progress events while extracting handwritten notes with Marker."""
    from app.topic_subdivider import reparse_book_with_marker_stream
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        reparse_book_with_marker_stream(book_id),
        media_type="text/event-stream"
    )


# -----------------------------------------------------------------------------
# LLM Inspection: System Prompts & Token Usage Endpoints
# -----------------------------------------------------------------------------

class UpdatePromptRequest(BaseModel):
    custom_prompt: str


@app.get("/api/prompts")
async def get_all_system_prompts():
    """Returns all system prompts, their categories, variables, and current custom values."""
    from app.prompt_manager import get_all_prompts
    try:
        return {"prompts": get_all_prompts()}
    except Exception as e:
        logger.error(f"Failed to fetch system prompts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/prompts/{key}")
async def update_system_prompt_endpoint(key: str, req: UpdatePromptRequest):
    """Updates a system prompt override after validating placeholder syntax."""
    from app.prompt_manager import update_prompt
    try:
        updated = update_prompt(key, req.custom_prompt)
        return {"prompt": updated}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to update prompt '{key}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/prompts/{key}/reset")
async def reset_system_prompt_endpoint(key: str):
    """Reverts a system prompt to its factory default."""
    from app.prompt_manager import reset_prompt
    try:
        reset_res = reset_prompt(key)
        return {"prompt": reset_res}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to reset prompt '{key}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/prompts/reset-all")
async def reset_all_prompts_endpoint():
    """Reverts all system prompts to their factory defaults."""
    from app.prompt_manager import reset_all_prompts, get_all_prompts
    try:
        reset_all_prompts()
        return {"status": "ok", "prompts": get_all_prompts()}
    except Exception as e:
        logger.error(f"Failed to reset all prompts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/token-usage/summary")
async def get_token_usage_summary_endpoint(days: Optional[int] = None):
    """Returns aggregated token usage statistics, breakdowns, and timeline."""
    from app.database import get_token_usage_summary
    try:
        return get_token_usage_summary(days=days)
    except Exception as e:
        logger.error(f"Failed to fetch token usage summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/token-usage/history")
async def get_token_usage_history_endpoint(limit: int = 100, offset: int = 0):
    """Returns paginated individual token usage request logs."""
    from app.database import get_token_usage_logs
    try:
        return {"logs": get_token_usage_logs(limit=limit, offset=offset)}
    except Exception as e:
        logger.error(f"Failed to fetch token usage logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/token-usage")
async def clear_token_usage_endpoint():
    """Clears all token usage history."""
    from app.database import clear_token_usage_logs
    try:
        clear_token_usage_logs()
        return {"status": "ok", "message": "Token usage history cleared"}
    except Exception as e:
        logger.error(f"Failed to clear token usage: {e}")
        raise HTTPException(status_code=500, detail=str(e))

