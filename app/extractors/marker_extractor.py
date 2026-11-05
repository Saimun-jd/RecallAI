import logging
from pathlib import Path
from .base import BaseExtractor, ExtractionResult, TocEntry
from .registry import register_extractor
import os

logger = logging.getLogger(__name__)

# Global cache for the marker model dictionary to prevent 60-second reloads on every extraction
_marker_model_dict = None

@register_extractor
class MarkerExtractor(BaseExtractor):
    name = "marker"
    
    def _init_models(self):
        global _marker_model_dict
        if _marker_model_dict is None:
            logger.info("Initializing Marker models (this may take 1-2 minutes on first run)...")
            
            # Configure environment for local Windows execution
            os.environ["HF_HUB_OFFLINE"] = "1"
            os.environ["SURYA_INFERENCE_BACKEND"] = "llamacpp"
            os.environ["SURYA_INFERENCE_KEEP_ALIVE"] = "1"
            os.environ["SURYA_INFERENCE_PARALLEL"] = "2"   # or even "1" for a single-request local pipeline
            
            try:
                import torch
                if torch.cuda.is_available():
                    logger.info(f"[GPU DETECT] CUDA available. Device: {torch.cuda.get_device_name(0)}")
                    os.environ["TORCH_DEVICE"] = "cuda"
                    os.environ["TORCH_DEVICE_MODEL"] = "cuda"
                    # NOTE: this only affects surya's native-torch models (detection/layout).
                    # OCR/recognition still goes through the llama.cpp server below, whose
                    # binary is already a CUDA build, so GPU use isn't lost by staying on
                    # the llamacpp backend.
                else:
                    logger.warning("[GPU DETECT] No CUDA detected. Falling back to CPU for torch models.")
                    os.environ["TORCH_DEVICE"] = "cpu"
                    os.environ["TORCH_DEVICE_MODEL"] = "cpu"
            except ImportError:
                os.environ["TORCH_DEVICE"] = "cuda"
                os.environ["TORCH_DEVICE_MODEL"] = "cuda"
            
            
            # Ensure our local llamacpp server is on PATH
            custom_llama_dir = r"C:\llama-b10643-bin-win-cuda-12.4-x64"
            if custom_llama_dir not in os.environ.get("PATH", ""):
                os.environ["PATH"] = custom_llama_dir + os.pathsep + os.environ.get("PATH", "")

            import shutil
            logger.info(f"[DEBUG] llama-server resolved to: {shutil.which('llama-server')}")
            
            from marker.models import create_model_dict
            _marker_model_dict = create_model_dict()
            logger.info("Marker models successfully loaded into VRAM.")
        return _marker_model_dict
    
    def extract(self, pdf_path: Path, output_dir: Path, yield_progress=None) -> ExtractionResult:
        """
        Extracts PDF to markdown using the marker Python API.
        This avoids multiprocessing deadlocks and bypasses the expensive model loading time 
        on every single request by caching the models globally in the FastAPI worker.
        """
        try:
            # Load models into VRAM (only blocks on the very first extraction)
            model_dict = self._init_models()
            
            from marker.converters.pdf import PdfConverter
            from marker.output import text_from_rendered
            
            logger.info(f"Extracting {pdf_path} with Marker in 'fast' mode...")
            
            # Initialize converter in fast mode (skips heavy VLM layout detection)
            converter = PdfConverter(
                artifact_dict=model_dict,
                config={"mode": "fast"}
            )
            
            # Render the PDF
            rendered = converter(str(pdf_path))
            
            # Extract text and images
            text, _, images = text_from_rendered(rendered)
            
            # Save output files to standard structure
            pdf_stem = pdf_path.stem
            result_dir = output_dir / "marker_out" / pdf_stem
            result_dir.mkdir(parents=True, exist_ok=True)
            
            md_file = result_dir / f"{pdf_stem}.md"
            md_file.write_text(text, encoding="utf-8")
            
            # Save any images extracted
            if images:
                for img_name, img_data in images.items():
                    img_path = result_dir / img_name
                    img_data.save(img_path)
            
            logger.info(f"Marker extraction complete: {md_file}")
            
            return ExtractionResult(markdown=text, images_dir=result_dir)
            
        except Exception as e:
            logger.error(f"Marker extraction error: {e}")
            raise
    
    def extract_toc(self, pdf_path: Path, total_pages: int) -> list[TocEntry] | None:
        """
        Marker produces markdown with headers (`#`, `##`, etc.).
        We could parse the output markdown to build a TOC, but since Marker's CLI 
        doesn't natively output a structured JSON TOC mapping to original PDF pages easily,
        we might still rely on fitz for TOC, OR we parse the markdown.
        """
        return None
    
    def extract_page_text(self, pdf_path: Path, page_number: int) -> str | None:
        """
        Marker extracts the whole document. Extracting a single page on-demand is slow.
        Returning None falls back to fitz.
        """
        return None

    @classmethod
    def is_available(cls) -> bool:
        try:
            import marker
            return True
        except ImportError:
            return False