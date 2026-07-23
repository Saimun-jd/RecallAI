import asyncio
import logging
import os
import tempfile
from contextlib import asynccontextmanager
from fastapi import FastAPI, Form, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.chunk_builder import build_chunks
from app.database import init_db
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

async def process_section(sec: dict, chapter_title: str, skip_chapter_filter: bool, code_blocks: dict, images: dict) -> list[Chunk]:
    global OLLAMA_SEMAPHORE
    if OLLAMA_SEMAPHORE is None:
        OLLAMA_SEMAPHORE = asyncio.Semaphore(2)
    """Process a single section through the LLM with concurrency throttling."""
    heading, text, page_num = sec["heading"], sec["text"], sec.get("page_num")

    if not skip_chapter_filter:
        if chapter_title and chapter_title.lower() not in heading.lower():
            return []

    if not is_valid_section(heading, text):
        return []

    try:
        async with OLLAMA_SEMAPHORE:
            section_extraction = await extract_atomic_concepts(heading, text, code_blocks, images)
        return build_chunks(section_extraction, chapter_title, page_num, code_blocks, images)
    except Exception as e:
        logger.error(f"Failed to process section '{heading}': {e}")
        return []



@app.post("/chunk")
async def chunk_pdf(
    file: UploadFile,
    chapter_title: str | None = Form(default=None),
    pre_sliced: str | None = Form(default=None),
    start_page: int | None = Form(default=None),
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    # When the CLI pre-slices the PDF to only the target pages, it sends
    # pre_sliced=true.  In that case we skip the chapter_title heading filter
    # (which is brittle due to Unicode mismatches) and process every section
    # found in the sliced PDF.  chapter_title is still forwarded to
    # build_chunks for breadcrumb labels.
    skip_chapter_filter = pre_sliced and pre_sliced.lower() == "true"

    try:
        from fastapi.concurrency import run_in_threadpool
        md_text, cache_key, start_page_num = await run_in_threadpool(extract_raw_text, tmp_path, start_page)
        modified_md_text, code_blocks, images = parse_markdown_assets(md_text, cache_key)
        
        sections = detect_headings(modified_md_text, start_page_num)

        # Process all sections concurrently
        tasks = []
        for sec in sections:
            # Filter assets to only those present in this section
            sec_code_blocks = {k: v for k, v in code_blocks.items() if f"[ASSET: {k}]" in sec["text"]}
            sec_images = {k: v for k, v in images.items() if f"[ASSET: {k}]" in sec["text"]}
            
            tasks.append(
                process_section(sec, chapter_title, skip_chapter_filter, sec_code_blocks, sec_images)
            )
            
        results = await asyncio.gather(*tasks)

        # Flatten the list of lists
        all_chunks = [chunk for sublist in results for chunk in sublist]

        # Serve response explicitly with UTF-8 character encoding headers
        return JSONResponse(
            content={"chunks": [c.model_dump() for c in all_chunks]},
            media_type="application/json; charset=utf-8",
        )
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.get("/health")
def health():
    return {"status": "ok"}