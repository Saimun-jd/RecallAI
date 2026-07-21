import os
import tempfile
from contextlib import asynccontextmanager
from fastapi import FastAPI, Form, UploadFile
from fastapi.responses import JSONResponse

from app.chunk_builder import build_chunks
from app.database import init_db
from app.heading_detect import detect_headings
from app.llm_segment import extract_atomic_concepts
from app.pdf_extract import extract_raw_text
from app.prefilter import is_valid_section
from app.schemas import Chunk


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Chunking Service", lifespan=lifespan)


@app.post("/chunk")
async def chunk_pdf(
    file: UploadFile, chapter_title: str | None = Form(default=None)
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        raw_text = extract_raw_text(tmp_path)
        sections = detect_headings(raw_text)

        all_chunks: list[Chunk] = []
        for sec in sections:
            heading, text = sec["heading"], sec["text"]

            # Filter by chapter_title if provided
            if chapter_title and chapter_title.lower() not in heading.lower():
                continue

            # Prefilter to remove noise and skip references
            if not is_valid_section(heading, text):
                continue

            # Direct LLM Extraction
            section_extraction = await extract_atomic_concepts(heading, text)

            # Assemble Chunks with breadcrumbs
            chunks = build_chunks(section_extraction, chapter_title)
            all_chunks.extend(chunks)

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