import hashlib
from pathlib import Path
import fitz
import pymupdf4llm

CACHE_DIR = Path("parsed_docs")
CACHE_DIR.mkdir(exist_ok=True)

def extract_raw_text(pdf_bytes: bytes, start_page: int | None = None) -> tuple[str, str, int]:
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
        
        md_file = doc_cache_dir / "temp_slice.md"
        
        if not md_file.exists():
            img_dir = doc_cache_dir / "images"
            img_dir.mkdir(exist_ok=True)
            
            md_text = pymupdf4llm.to_markdown(
                doc=str(pdf_path),
                write_images=True,
                image_path=str(img_dir),
                image_format="png"
            )
            md_file.write_text(md_text, encoding="utf-8")
        else:
            md_text = md_file.read_text(encoding="utf-8")
            
    return md_text, cache_key, start_page_num