"""
Content Extraction & Text Normalization Service for Recall AI.
Supports PDF (via PyMuPDF/fitz with magic-byte validation), Plain Text, and Markdown.
Produces normalized, structured textual content with page boundaries.
"""

import io
import re
from typing import List, Optional, Tuple, Union
from pydantic import BaseModel
import fitz  # PyMuPDF


class ExtractionError(Exception):
    """Raised when document extraction or validation fails."""
    pass


class PageExtraction(BaseModel):
    page_number: int
    text: str


class ExtractedDocument(BaseModel):
    title: str
    total_pages: int
    pages: List[PageExtraction]
    full_text: str


class ExtractionService:
    MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024       # 50 MB
    MAX_TEXT_SIZE_BYTES = 10 * 1024 * 1024      # 10 MB

    @classmethod
    def validate_file(
        cls,
        first_arg: Optional[Union[str, bytes]] = None,
        second_arg: Optional[Union[str, bytes]] = None,
        filename: Optional[str] = None,
        content: Optional[bytes] = None,
        mime_type: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Validates the uploaded file by size, extension, and magic bytes.
        Flexible signature accepting both:
          validate_file(filename, content, mime_type=None)
          validate_file(content=content, filename=filename, mime_type=mime_type)
        Returns: (normalized_format, detected_mime_type)
        Raises ExtractionError if invalid or unsupported.
        """
        # Resolve positional vs keyword arguments
        actual_content: Optional[bytes] = content
        actual_filename: Optional[str] = filename

        if isinstance(first_arg, bytes):
            actual_content = first_arg
        elif isinstance(first_arg, str):
            actual_filename = first_arg

        if isinstance(second_arg, bytes):
            actual_content = second_arg
        elif isinstance(second_arg, str):
            actual_filename = second_arg

        if actual_content is None or len(actual_content) == 0:
            raise ExtractionError("Uploaded file is empty (0 bytes).")

        if not actual_filename:
            actual_filename = "unnamed_document"

        # Strip path traversal and extract extension
        safe_name = actual_filename.split("/")[-1].split("\\")[-1]
        ext = safe_name.split(".")[-1].lower() if "." in safe_name else ""

        # 1. PDF Validation
        if ext == "pdf" or (mime_type and mime_type == "application/pdf"):
            if len(actual_content) > cls.MAX_PDF_SIZE_BYTES:
                raise ExtractionError(
                    f"PDF exceeds maximum permitted size of {cls.MAX_PDF_SIZE_BYTES // (1024 * 1024)}MB."
                )
            # Magic bytes check
            if not actual_content.startswith(b"%PDF"):
                raise ExtractionError("Invalid PDF file: Missing %PDF file signature.")
            return "pdf", "application/pdf"

        # 2. Markdown Validation
        elif ext in ("md", "markdown") or (mime_type and mime_type in ("text/markdown", "text/x-markdown")):
            if len(actual_content) > cls.MAX_TEXT_SIZE_BYTES:
                raise ExtractionError(
                    f"Markdown file exceeds maximum permitted size of {cls.MAX_TEXT_SIZE_BYTES // (1024 * 1024)}MB."
                )
            try:
                actual_content.decode("utf-8")
            except UnicodeDecodeError:
                raise ExtractionError("Markdown file must be valid UTF-8 text.")
            return "markdown", "text/markdown"

        # 3. Plain Text Validation
        elif ext in ("txt", "text") or (mime_type and mime_type.startswith("text/plain")):
            if len(actual_content) > cls.MAX_TEXT_SIZE_BYTES:
                raise ExtractionError(
                    f"Text file exceeds maximum permitted size of {cls.MAX_TEXT_SIZE_BYTES // (1024 * 1024)}MB."
                )
            try:
                actual_content.decode("utf-8")
            except UnicodeDecodeError:
                raise ExtractionError("Text file must be valid UTF-8 text.")
            return "text", "text/plain"

        else:
            raise ExtractionError(
                f"Unsupported file format '.{ext}'. Recall AI currently supports PDF (.pdf), Markdown (.md), and Plain Text (.txt)."
            )

    @staticmethod
    def normalize_text(text: str) -> str:
        """
        Normalizes extracted text:
        - Replaces null bytes
        - Standardizes line endings to \n
        - Strips trailing whitespaces per line
        - Collapses 3+ consecutive newlines to 2
        """
        if not text:
            return ""

        # Remove null bytes
        clean = text.replace("\x00", "")

        # Standardize CRLF to LF
        clean = clean.replace("\r\n", "\n").replace("\r", "\n")

        # Strip control characters (except newline \n and tab \t)
        clean = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', clean)

        # Strip trailing whitespace on each line
        lines = [line.rstrip() for line in clean.split("\n")]
        clean = "\n".join(lines)

        # Collapse 3+ consecutive newlines into 2
        clean = re.sub(r'\n{3,}', '\n\n', clean)

        return clean.strip()

    @classmethod
    def extract(
        cls,
        content: bytes,
        file_format_or_name: Optional[str] = None,
        filename: Optional[str] = None,
        mime_type: Optional[str] = None,
        default_title: str = "Untitled Document"
    ) -> ExtractedDocument:
        """
        Extracts structured text and page boundaries based on file format.
        Accepts:
          extract(content, file_format, default_title="...")
          extract(content=content, filename=filename, mime_type=mime_type)
        """
        target_format = file_format_or_name or filename or ""
        lower = target_format.lower()

        if lower.endswith(".pdf") or lower == "pdf" or (mime_type and "pdf" in mime_type):
            return cls._extract_pdf(content, default_title)
        elif lower.endswith(".md") or lower.endswith(".markdown") or lower == "markdown" or (mime_type and "markdown" in mime_type):
            return cls._extract_text(content, default_title)
        elif lower.endswith(".txt") or lower == "text" or (mime_type and "plain" in mime_type):
            return cls._extract_text(content, default_title)
        else:
            # Attempt autodetection via validate_file
            fmt, _ = cls.validate_file(content=content, filename=filename or file_format_or_name, mime_type=mime_type)
            if fmt == "pdf":
                return cls._extract_pdf(content, default_title)
            return cls._extract_text(content, default_title)

    @classmethod
    def _extract_pdf(cls, content: bytes, default_title: str) -> ExtractedDocument:
        try:
            doc = fitz.open(stream=content, filetype="pdf")
        except Exception as e:
            raise ExtractionError(f"Corrupted or unreadable PDF document: {e}")

        pages: List[PageExtraction] = []
        full_text_parts: List[str] = []
        meta_title = doc.metadata.get("title") if doc.metadata else None
        title = meta_title.strip() if meta_title and meta_title.strip() else default_title

        for page_idx in range(len(doc)):
            page_num = page_idx + 1
            page = doc[page_idx]
            raw_page_text = page.get_text("text") or ""
            norm_page_text = cls.normalize_text(raw_page_text)
            
            pages.append(PageExtraction(page_number=page_num, text=norm_page_text))
            if norm_page_text:
                full_text_parts.append(norm_page_text)

        doc.close()

        total_pages = len(pages)
        full_text = "\n\n".join(full_text_parts)

        if not full_text.strip():
            # Document has pages but no extractable text (e.g. scanned image PDF without OCR)
            full_text = "[No extractable text found in document pages. Document may be an image-only scan.]"

        return ExtractedDocument(
            title=title,
            total_pages=total_pages,
            pages=pages,
            full_text=full_text
        )

    @classmethod
    def _extract_text(cls, content: bytes, default_title: str) -> ExtractedDocument:
        try:
            raw_text = content.decode("utf-8")
        except UnicodeDecodeError as e:
            raise ExtractionError(f"Invalid UTF-8 text: {e}")

        normalized = cls.normalize_text(raw_text)
        pages = [PageExtraction(page_number=1, text=normalized)]
        return ExtractedDocument(
            title=default_title,
            total_pages=1,
            pages=pages,
            full_text=normalized
        )


extraction_service = ExtractionService()
