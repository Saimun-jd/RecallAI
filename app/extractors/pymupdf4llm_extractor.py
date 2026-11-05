from pathlib import Path
from .base import BaseExtractor, ExtractionResult
from .registry import register_extractor


@register_extractor
class PyMuPDF4LLMExtractor(BaseExtractor):
    name = "pymupdf4llm"
    
    def extract(self, pdf_path: Path, output_dir: Path, yield_progress=None) -> ExtractionResult:
        import pymupdf4llm
        img_dir = output_dir / "images"
        img_dir.mkdir(exist_ok=True)
        md = pymupdf4llm.to_markdown(
            doc=str(pdf_path),
            write_images=True,
            image_path=str(img_dir),
            image_format="png"
        )
        return ExtractionResult(markdown=md, images_dir=img_dir)
    
    @classmethod
    def is_available(cls) -> bool:
        try:
            import pymupdf4llm
            return True
        except ImportError:
            return False
