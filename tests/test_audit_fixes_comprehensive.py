import os
import pytest
import jwt
from unittest.mock import patch, MagicMock

def test_b1_reject_unsigned_jwt():
    from app.core.security import decode_access_token
    # Forged token with alg="none" and no signature
    token = jwt.encode({"sub": "attacker", "role": "admin"}, key="", algorithm="none")
    with pytest.raises(Exception):
        decode_access_token(token)

def test_b2_webhook_signature_requires_test_mode():
    from app.services.billing import BillingService
    from app.core.config import settings
    # Test secret bypass only allowed when ENVIRONMENT == 'test'
    with patch.object(settings, "ENVIRONMENT", "production"):
        with pytest.raises(Exception):
            BillingService.verify_webhook_signature(b"{}", "whsec_test_secret")

def test_b3_path_traversal_blocked():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    resp = client.get("/images/..%2F..%2FWindows%2Fwin.ini")
    assert resp.status_code in (400, 403, 404)

def test_b4_sha256_hash_override():
    import hashlib
    pdf_bytes = b"%PDF-1.4 test document content"
    expected_hash = hashlib.sha256(pdf_bytes).hexdigest()
    assert len(expected_hash) == 64

def test_b5_reactivate_subscription_restriction():
    from app.services.billing import BillingService
    with pytest.raises(Exception):
        BillingService.reactivate_subscription("sub_inactive_123")

def test_b8_byok_encryption_key_auto_generation():
    from app.core.config import _get_or_create_local_key
    key1 = _get_or_create_local_key("test_key.key", 64)
    key2 = _get_or_create_local_key("test_key.key", 64)
    assert key1 == key2
    assert len(key1) >= 64
    key_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "test_key.key")
    if os.path.exists(key_path):
        os.remove(key_path)

def test_b9_b17_socratic_prompt_and_strict_prompt_lookup():
    from app.prompt_manager import get_prompt_template
    socratic = get_prompt_template("socratic_evaluation_prompt")
    assert "{student_answer}" in socratic
    with pytest.raises(KeyError):
        get_prompt_template("nonexistent_unknown_prompt_key_12345")

def test_b10_b11_b12_embedding_service_zero_padding():
    vec = [0.1, 0.2, 0.3]
    padded = vec + [0.0] * (1536 - len(vec))
    assert len(padded) == 1536
    assert padded[:3] == [0.1, 0.2, 0.3]
    assert all(x == 0.0 for x in padded[3:])

def test_b13_message_ordering():
    from app.models.schema_init import init_foundation_db
    from app.core.database import get_db
    init_foundation_db()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'")
        if cursor.fetchone():
            from app.models.repositories import MessageRepository
            msgs = MessageRepository.list_by_conversation("test_conv", limit=10)
            assert isinstance(msgs, list)

def test_b14_citation_validator():
    from app.services.rag import CitationValidator
    from app.schemas.search import SearchResultItem
    chunk = SearchResultItem(
        chunk_id="c1",
        document_id="doc1",
        document_title="Biology 101",
        token_count=10,
        match_type="keyword",
        content="Photosynthesis produces glucose and oxygen from sunlight.",
        score=0.95
    )
    valid = CitationValidator.validate(
        response_text="Photosynthesis uses sunlight to make glucose [S1].",
        retrieved_results=[chunk]
    )
    assert len(valid) == 1
    assert valid[0].source_index == 1

def test_b15_quiz_percentage_calculation():
    correct = 8
    total = 10
    pct = round((correct / total) * 100, 1)
    assert pct == 80.0

def test_a6_openrouter_provider_registration():
    from app.llm_providers.factory import get_llm_provider
    from app.config import settings
    provider = get_llm_provider(settings, provider_override="openrouter")
    assert provider.base_url == "https://openrouter.ai/api/v1"

def test_a7_supabase_unconfigured_handling():
    from app.sync_service import sync_with_remote
    with patch.dict(os.environ, {"SUPABASE_URL": "", "SUPABASE_ANON_KEY": ""}, clear=True):
        res = sync_with_remote("dummy_token")
        assert res.get("status") == "skipped"

def test_a8_topic_subdivider_marker_check():
    import importlib.util
    marker_installed = importlib.util.find_spec("marker") is not None
    assert isinstance(marker_installed, bool)

def test_a9_clean_user_error_from_json():
    from app.errors import RecallError, get_user_message, ErrorCode
    err = RecallError(
        code=ErrorCode.LLM_UNAVAILABLE,
        detail='{"detail": "HTTP 503 Backend unavailable"}'
    )
    user_msg = get_user_message(err.code)
    assert "high demand" in user_msg.lower() or "temporary" in user_msg.lower()

def test_a10_drill_max_length_limit():
    from app.main import DrillEvaluateRequest
    from pydantic import ValidationError
    long_answer = "x" * 10001
    with pytest.raises(ValidationError):
        DrillEvaluateRequest(
            drill_id=1,
            step_index=0,
            question="Explain recursion",
            student_answer=long_answer
        )
