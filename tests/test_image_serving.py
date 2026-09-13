import os
import sys
from pathlib import Path
import tempfile
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app, PARSED_DOCS_DIR

client = TestClient(app)

def test_image_serving_found_and_not_found():
    # Create a dummy image inside PARSED_DOCS_DIR / "test_cache_slice" / "images"
    test_cache_dir = Path(PARSED_DOCS_DIR) / "test_cache_slice" / "images"
    test_cache_dir.mkdir(parents=True, exist_ok=True)
    
    test_img = test_cache_dir / "alu_diagram_test.png"
    dummy_png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    test_img.write_bytes(dummy_png_bytes)
    
    try:
        # 1. Test finding by flat basename
        res = client.get("/images/alu_diagram_test.png")
        assert res.status_code == 200
        assert res.headers["content-type"] == "image/png"
        assert res.content == dummy_png_bytes

        # 2. Test direct subpath lookup
        res_subpath = client.get("/images/test_cache_slice/images/alu_diagram_test.png")
        assert res_subpath.status_code == 200
        assert res_subpath.headers["content-type"] == "image/png"
        assert res_subpath.content == dummy_png_bytes

        # 3. Test 404 for non-existent image
        res_missing = client.get("/images/definitely_not_existing_diagram_xyz.jpg")
        assert res_missing.status_code == 404
        assert "not found" in res_missing.json().get("error", "").lower()

    finally:
        # Cleanup
        if test_img.exists():
            test_img.unlink()
        if test_cache_dir.exists():
            try:
                test_cache_dir.rmdir()
                test_cache_dir.parent.rmdir()
            except Exception:
                pass
