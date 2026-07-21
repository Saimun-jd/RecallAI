import unicodedata
import fitz
import re


def clean_text(text: str) -> str:
    # 0. Normalize Unicode characters (Fixes encoding glitches like 'ΓÇÖ' -> "'")
    text = unicodedata.normalize("NFKC", text)

    # Replace specific smart quotes and special hyphens if any remain
    text = (
        text.replace("’", "'")
        .replace("“", '"')
        .replace("”", '"')
        .replace("–", "-")
    )

    # 1. Strip URLs, DOIs, ISBNs
    text = re.sub(
        r"https?://\S+|www\.\S+|doi\.org/\S+", "", text, flags=re.IGNORECASE
    )
    text = re.sub(r"ISBN\s*[\d\-]+", "", text, flags=re.IGNORECASE)

    # 2. Strip inline numeric citations like [1], [1, 2], [12-15]
    text = re.sub(r"\[\s*\d+\s*(?:[,|\-]\s*\d+\s*)*\]", "", text)

    # 3. Strip licensing blocks and typical copyright footers
    text = re.sub(r"(?i)This work is licensed under.*?\.", "", text)
    text = re.sub(r"(?i)Copyright held by.*?\.", "", text)

    # 4. Rejoin hyphenated words split across lines
    text = re.sub(r"-\s*\n\s*", "", text)

    # 5. Normalize whitespace while retaining \n\n
    text = text.replace("\r\n", "\n")
    text = re.sub(r"[ \t]+", " ", text)

    # Replace single newlines with a space
    text = re.sub(r"(?<!\n)\n(?!\n)", " ", text)

    # Compress 3+ newlines to 2
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def extract_raw_text(pdf_path: str, start_page: int | None = None) -> list[dict]:
    doc = fitz.open(pdf_path)
    pages = []

    for page in doc:
        blocks = page.get_text("blocks")
        text_blocks = []
        
        # Calculate actual original page number if start_page is known
        current_page = (start_page + page.number) if start_page is not None else (page.number + 1)

        for b in blocks:
            # block_type 0 is text
            if b[6] == 0:
                raw_block_text = b[4].strip()
                # Ensure string is cleanly UTF-8 decoded
                raw_block_text = (
                    raw_block_text.encode("utf-8", errors="ignore").decode(
                        "utf-8"
                    )
                )
                if raw_block_text:
                    text_blocks.append(raw_block_text)

        if text_blocks:
            raw_text = "\n\n".join(text_blocks)
            cleaned = clean_text(raw_text)
            if cleaned:
                pages.append({"page_num": current_page, "text": cleaned})

    return pages