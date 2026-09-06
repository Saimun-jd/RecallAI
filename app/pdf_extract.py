import hashlib
from pathlib import Path
import fitz
from app.extractors import get_extractor
from platformdirs import user_data_dir
import os

DATA_DIR = user_data_dir("Recall", "Recall")
CACHE_DIR = Path(os.path.join(DATA_DIR, "parsed_docs"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)

async def extract_raw_text(pdf_bytes: bytes, start_page: int | None = None, force_refresh: bool = False) -> tuple[str, str, int]:
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
            
            if md_file.exists() and not force_refresh:
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
        from app.latex_fixer import fix_latex_delimiters
        import logging
        import asyncio
        import re
        
        logger = logging.getLogger(__name__)
        
        # 1. Deterministic LaTeX fix
        try:
            md_text = fix_latex_delimiters(md_text)
        except Exception as e:
            logger.error(f"Error during latex_fixer: {e}")
            
        # 2. LLM Cleanup
        try:
            # Added a 120-second timeout (increased for chunking) so it doesn't hang forever
            cleaned_text = await asyncio.wait_for(clean_markdown_with_llm(md_text), timeout=120.0)
            
            # 3. Output Validation
            is_valid = True
            
            # Length check
            if len(cleaned_text) < 0.4 * len(md_text):
                logger.warning("LLM cleanup validation failed: Output is < 40% of input length (truncation).")
                is_valid = False
                
            # Delimiter balance
            if is_valid:
                dollar_count = cleaned_text.count('$')
                if dollar_count % 2 != 0:
                    logger.warning("LLM cleanup validation failed: Odd number of $ delimiters.")
                    is_valid = False
                    
            if is_valid:
                begin_count = cleaned_text.count('\\begin{')
                end_count = cleaned_text.count('\\end{')
                if begin_count != end_count:
                    logger.warning("LLM cleanup validation failed: \\begin and \\end count mismatch.")
                    is_valid = False
                    
            # LaTeX plaintext detection
            if is_valid:
                stripped = re.sub(r'\$\$.*?\$\$', '', cleaned_text, flags=re.DOTALL)
                stripped = re.sub(r'\$[^$\n]+?\$', '', stripped)
                bare_begin = stripped.count('\\begin{')
                if bare_begin > 3:
                    logger.warning(f"LLM cleanup validation failed: Found {bare_begin} bare \\begin{{...}} (LaTeX plaintext).")
                    is_valid = False
                    
            if is_valid:
                md_text = cleaned_text
            else:
                logger.warning("Falling back to pre-LLM markdown due to validation failure.")
                
        except asyncio.TimeoutError:
            logger.warning("LLM cleanup timed out. Proceeding with raw markdown (offline mode?)")
        except Exception as e:
            logger.error(f"Failed to clean markdown with LLM: {e}")
            
        # Save after cleaning
        await run_in_threadpool(lambda: md_file.write_text(md_text, encoding="utf-8"))
        
    return md_text, cache_key, start_page_num