import hashlib
from pathlib import Path
import fitz
from app.extractors import get_extractor
from platformdirs import user_data_dir
import os

DATA_DIR = user_data_dir("Recall", "Recall")
CACHE_DIR = Path(os.path.join(DATA_DIR, "parsed_docs"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)

async def extract_raw_text(pdf_bytes: bytes, start_page: int | None = None) -> tuple[str, str, int]:
    from fastapi.concurrency import run_in_threadpool
    
    def _do_fitz_and_extract():
        pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()[:8]
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            num_pages = len(doc)
            start_page_num = start_page if start_page is not None else 1
            end_page = start_page_num + num_pages - 1
            
            cache_key = f"{pdf_hash}_p{start_page_num}-{end_page}"
            doc_cache_dir = CACHE_DIR / cache_key
            doc_cache_dir.mkdir(parents=True, exist_ok=True)
            
            # Save the bytes to a deterministic file name
            pdf_path = doc_cache_dir / "slice.pdf"
            pdf_path.write_bytes(pdf_bytes)
            
            extractor = get_extractor()
            md_file = doc_cache_dir / f"temp_slice_{extractor.name}.md"
            
            if md_file.exists():
                return md_file.read_text(encoding="utf-8"), cache_key, start_page_num, False, md_file
                
            # The extractor handles creating image directories internally if needed
            result = extractor.extract(pdf_path, doc_cache_dir)
            md_text = result.markdown
            
            # Sophisticated fallback: If the extracted text has very few actual alphanumeric characters, it's likely an image-based PDF.
            import re
            clean_text = re.sub(r'!\[.*?\]\(.*?\)', '', md_text)
            clean_text = re.sub(r'<[^>]*>', '', clean_text)
            alnum_count = sum(c.isalnum() for c in clean_text)
            
            if alnum_count < 500 and extractor.__class__.__name__ not in ("MarkerExtractor", "MarkerApiExtractor"):
                import logging
                logger = logging.getLogger(__name__)
                logger.info("Extracted text is suspiciously short (< 50 chars). Likely an image-based PDF.")
                
                from app.database import get_setting
                fallback_target = "marker_api" if get_setting("datalab_api_key") else "marker"
                
                marker_extractor = get_extractor(fallback_target)
                if marker_extractor and marker_extractor.is_available():
                    logger.info(f"Switching to {fallback_target} dynamically for OCR extraction...")
                    try:
                        result = marker_extractor.extract(pdf_path, doc_cache_dir)
                        md_text = result.markdown
                        
                        # Fix cache filename for fallback
                        md_file = doc_cache_dir / f"temp_slice_{marker_extractor.name}.md"
                        
                        # Move extracted images to the correct images/ directory expected by markdown_ast.py
                        import shutil
                        images_dir = doc_cache_dir / "images"
                        images_dir.mkdir(parents=True, exist_ok=True)
                        if getattr(result, "images_dir", None) and result.images_dir.exists():
                            for img_file in result.images_dir.iterdir():
                                if img_file.is_file():
                                    shutil.move(str(img_file), str(images_dir / img_file.name))
                                    
                    except Exception as e:
                        logger.error(f"Marker fallback extraction failed: {e}")

            return md_text, cache_key, start_page_num, True, md_file

    md_text, cache_key, start_page_num, is_new, md_file = await run_in_threadpool(_do_fitz_and_extract)
    
    if is_new:
        from app.markdown_cleanup import clean_markdown_with_llm
        import logging
        import asyncio
        try:
            # Added a 60-second timeout so it doesn't hang forever if offline and unable to reach Gemini/OpenAI
            md_text = await asyncio.wait_for(clean_markdown_with_llm(md_text), timeout=60.0)
        except asyncio.TimeoutError:
            logging.getLogger(__name__).warning("LLM cleanup timed out after 15 seconds. Proceeding with raw markdown (offline mode?)")
        except Exception as e:
            logging.getLogger(__name__).error(f"Failed to clean markdown with LLM: {e}")
            
        # Save after cleaning
        await run_in_threadpool(lambda: md_file.write_text(md_text, encoding="utf-8"))
        
    return md_text, cache_key, start_page_num