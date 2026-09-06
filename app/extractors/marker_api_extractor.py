import logging
from pathlib import Path
from .base import BaseExtractor, ExtractionResult
from .registry import register_extractor

logger = logging.getLogger(__name__)

@register_extractor
class MarkerApiExtractor(BaseExtractor):
    name = "marker_api"
    
    @classmethod
    def is_available(cls) -> bool:
        try:
            import requests
            return True
        except ImportError:
            return False
    
    def extract(self, pdf_path: Path, output_dir: Path, yield_progress=None) -> ExtractionResult:
        """
        Uses the Datalab API to extract text from a PDF via synchronous requests.
        (Bypasses datalab_sdk to avoid an aiohttp DNS resolution bug on Windows).
        """
        import requests
        import time
        from app.database import get_setting
        
        api_key = get_setting("datalab_api_key")
        if not api_key:
            raise ValueError("Datalab API Key is missing. Please configure it in Settings.")
            
        logger.info(f"Sending {pdf_path.name} to Datalab API (via requests)...")
        
        headers = {"X-Api-Key": api_key}
        url = "https://www.datalab.to/api/v1/marker"
        
        with open(pdf_path, "rb") as f:
            files = {"file": (pdf_path.name, f, "application/pdf")}
            data = {"paginate": "true"}
            response = requests.post(url, headers=headers, files=files, data=data)
            
        if response.status_code != 200:
            raise RuntimeError(f"Datalab API failed to start job: {response.status_code} {response.text}")
            
        data = response.json()
        check_url = data.get("request_check_url")
        if not check_url:
            raise RuntimeError("Datalab API did not return a request_check_url")
            
        # Poll for completion
        max_retries = 300
        for _ in range(max_retries):
            time.sleep(2)
            res = requests.get(check_url, headers=headers)
            if res.status_code != 200:
                continue
                
            res_data = res.json()
            status = res_data.get("status")
            
            if status == "complete":
                md_text = res_data.get("markdown") or ""
                images_dict = res_data.get("images") or {}
                images_dir = output_dir / "images"
                images_dir.mkdir(parents=True, exist_ok=True)
                
                import base64
                saved_count = 0
                for img_name, img_b64 in images_dict.items():
                    try:
                        clean_name = Path(img_name).name
                        img_bytes = base64.b64decode(img_b64)
                        (images_dir / clean_name).write_bytes(img_bytes)
                        saved_count += 1
                    except Exception as err:
                        logger.error(f"Failed to decode/save image {img_name}: {err}")
                
                logger.info(f"Datalab API extraction complete: saved {saved_count} images to {images_dir}")
                return ExtractionResult(markdown=md_text, images_dir=images_dir)
            elif status == "error":
                error_msg = res_data.get("error", "Unknown API error")
                raise RuntimeError(f"Datalab API extraction failed: {error_msg}")
                
        raise RuntimeError("Datalab API extraction timed out")
