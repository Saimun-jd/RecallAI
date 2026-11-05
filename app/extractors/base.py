from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


@dataclass
class ExtractionResult:
    """Standardized output from any extractor plugin."""
    markdown: str
    images_dir: Path | None = None


@dataclass
class TocEntry:
    """A single table-of-contents entry."""
    level: int       # 1 = chapter, 2 = section, 3+ = subsection
    title: str
    page: int        # 1-indexed


class BaseExtractor(ABC):
    """Interface that every extraction plugin must implement."""
    
    name: str  # e.g. "pymupdf4llm", "marker"

    @abstractmethod
    def extract(self, pdf_path: Path, output_dir: Path, yield_progress=None) -> ExtractionResult:
        """Convert a PDF file to markdown + images.
        
        Args:
            pdf_path: Path to the PDF file on disk.
            output_dir: Directory to write images and intermediate files into.
            yield_progress: Optional async generator callback to yield SSE progress events (e.g. for long model downloads).
        """
        ...

    def extract_toc(self, pdf_path: Path, total_pages: int) -> list[TocEntry] | None:
        """Extract a table of contents from the PDF.
        
        Returns a list of TocEntry, or None to fall back to the 
        default fitz-based TOC extraction.
        """
        return None
    
    def extract_page_text(self, pdf_path: Path, page_number: int) -> str | None:
        """Extract plain text from a single page (1-indexed).
        
        Returns the text, or None to fall back to fitz's get_text().
        Used for drill/flashcard context when content_md is empty.
        """
        return None

    @classmethod
    @abstractmethod
    def is_available(cls) -> bool:
        """Return True if this plugin's dependencies are installed."""
        ...
