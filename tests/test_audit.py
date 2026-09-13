import os
import sys
import json
import pytest
import sqlite3
import tempfile
from unittest.mock import patch, MagicMock, AsyncMock

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import database
from app import fsrs
from app import embeddings
from app import toc_parser
from app import heading_detect
from app import prefilter
from app import markdown_ast
from app import chunk_builder
from app import config
from app.llm_providers.factory import get_llm_provider
from app.llm_providers.gemini import GeminiProvider
from app.llm_providers.openai import OpenAIProvider
from app.llm_providers.ollama import OllamaProvider
from app.llm_providers.groq import GroqProvider
from app.llm_segment import _sanitize_llm_response

def test_fsrs_review_card():
    card_data = {
        "state": 0,
        "stability": 0.0,
        "difficulty": 0.0,
        "elapsed_days": 0,
        "scheduled_days": 0,
        "reps": 0,
        "lapses": 0,
        "last_review": None,
        "due": None
    }
    
    # Rating 3 (Good)
    res_good = fsrs.review_card(card_data, 3)
    assert res_good["state"] != 0
    assert res_good["stability"] > 0
    assert res_good["reps"] == 1
    assert res_good["lapses"] == 0
    assert res_good["due"] is not None
    assert res_good["last_review"] is not None

    # Rating 1 (Again) increases lapses
    res_again = fsrs.review_card(card_data, 1)
    assert res_again["reps"] == 1
    assert res_again["lapses"] == 1

    # Invalid rating
    with pytest.raises(ValueError):
        fsrs.review_card(card_data, 5)
    with pytest.raises(ValueError):
        fsrs.review_card(card_data, 0)

def test_cosine_similarity():
    vec1 = [1.0, 0.0, 0.0]
    vec2 = [1.0, 0.0, 0.0]
    assert abs(embeddings.cosine_similarity(vec1, vec2) - 1.0) < 1e-5

    vec_ortho = [0.0, 1.0, 0.0]
    assert abs(embeddings.cosine_similarity(vec1, vec_ortho)) < 1e-5

    # Edge cases
    assert embeddings.cosine_similarity([], []) == 0.0
    assert embeddings.cosine_similarity([1.0, 2.0], [1.0]) == 0.0
    assert embeddings.cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0

def test_toc_parser_granular():
    # Test 3-element entries
    toc_3 = [
        [1, "Chapter 1: Intro", 1],
        [2, "Section 1.1: Basics", 3],
        [2, "Section 1.2: Advanced", 7],
        [1, "Chapter 2: Methods", 12],
    ]
    granular = toc_parser.build_granular_toc(toc_3, 20)
    assert len(granular) == 4
    assert granular[0]["start_page"] == 1
    assert granular[0]["end_page"] == 11
    assert granular[1]["start_page"] == 3
    assert granular[1]["end_page"] == 6
    assert granular[2]["start_page"] == 7
    assert granular[2]["end_page"] == 11
    assert granular[3]["start_page"] == 12
    assert granular[3]["end_page"] == 20

    # Test 4-element entries (PyMuPDF with destination or extra metadata)
    toc_4 = [
        [1, "Chapter 1", 1, {"dest": "xyz"}],
        [2, "Section 1.1", 5, {"dest": "abc"}],
    ]
    try:
        granular_4 = toc_parser.build_granular_toc(toc_4, 10)
        assert len(granular_4) == 2
    except ValueError as e:
        pytest.fail(f"build_granular_toc failed on 4-element entries: {e}")

def test_sanitize_llm_response():
    raw = 'This is “smart text” with ’quotes’ and — dashes.'
    sanitized = _sanitize_llm_response(raw)
    assert '"' in sanitized
    assert "'" in sanitized
    assert "-" in sanitized
    assert "“" not in sanitized
    assert "’" not in sanitized

def test_prefilter():
    assert prefilter.is_valid_section("Index", "some words") is False
    assert prefilter.is_valid_section("References", "author et al 2020") is False
    assert prefilter.is_valid_section("Introduction", "Too short") is False
    # Math heavy should pass even if short
    assert prefilter.is_valid_section("Formula", "Here $$x^2 + y^2 = z^2$$ is an equation.") is True

def test_heading_detect():
    md = "# Heading 1\n\nSome paragraph text here.\n\n## Subheading 1.1\n\nMore details."
    sections = heading_detect.detect_headings(md, 1)
    assert len(sections) == 2
    assert sections[0]["heading"] == "Heading 1"
    assert "paragraph text" in sections[0]["text"]
    assert sections[1]["heading"] == "Subheading 1.1"

def test_markdown_ast_assets():
    md = "# Code Test\n\n```python\nprint('hello')\n```\n\n![diagram](images/diag.png)\n"
    modified_md, code_blocks, images = markdown_ast.parse_markdown_assets(md, "cache123")
    assert len(code_blocks) == 1
    assert len(images) == 1
    assert "[ASSET: code_1]" in modified_md
    assert "[ASSET: img_1]" in modified_md

@pytest.mark.skip(reason="ocr_snip_endpoint was refactored")
def test_ocr_snip_endpoint_fast_fallback():
    import asyncio
    from app.main import ocr_snip_endpoint, OcrSnipRequest
    req = OcrSnipRequest(
        page_number=1,
        rect={"x1": 10, "y1": 10, "x2": 100, "y2": 50, "width": 200, "height": 300},
        image=None
    )
    # Test with non-existent book - should never hang or throw, but return structured response
    res = asyncio.run(ocr_snip_endpoint(999999, req))
    assert isinstance(res, dict)
    assert "text" in res
    assert "markdown" in res
    assert "latex" in res
    assert "is_math" in res

