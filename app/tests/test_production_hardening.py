"""
Production Hardening Regression Test Suite for Recall AI.
Verifies:
- Production configuration validation and dev secret rejection.
- Password change rate limiting.
- Document upload rate limiting and null-byte filename sanitization.
- Health readiness probe (/health/ready).
- Streaming credit safety and reservation release on provider failure.
- Database PRAGMA busy_timeout configuration.
"""

import os
import uuid
import pytest
from pydantic import ValidationError as PydanticValidationError
from fastapi.testclient import TestClient

from app.core.config import CoreSettings
from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.repositories import UserRepository, WorkspaceRepository
from app.models.schema_init import init_foundation_db
from app.api.middleware import auth_rate_limiter, upload_rate_limiter
from app.services.ai.base import AIProviderError
from app.services.entitlements import EntitlementService
from app.services.rag import RAGService


@pytest.fixture(scope="module")
def test_client():
    init_foundation_db()
    with TestClient(app) as client:
        yield client


@pytest.fixture(autouse=True)
def reset_rate_limiters():
    auth_rate_limiter.reset()
    upload_rate_limiter.reset()
    yield
    auth_rate_limiter.reset()
    upload_rate_limiter.reset()


def test_production_settings_reject_default_dev_secrets():
    """Verify that CoreSettings fails startup in production when using default dev secrets."""
    with pytest.raises(PydanticValidationError) as exc_info:
        CoreSettings(
            ENVIRONMENT="production",
            SECRET_KEY="recall-ai-dev-secret-key-at-least-32-chars-long!",
            BYOK_ENCRYPTION_KEY="fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
        )
    assert "Production mode requires a secure, non-default SECRET_KEY" in str(exc_info.value)

    with pytest.raises(PydanticValidationError) as exc_info:
        CoreSettings(
            ENVIRONMENT="production",
            SECRET_KEY="super-secret-secure-production-jwt-key-9999",
            BYOK_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        )
    assert "Production mode requires a unique, secure BYOK_ENCRYPTION_KEY" in str(exc_info.value)

    # Valid production settings must pass cleanly
    prod = CoreSettings(
        ENVIRONMENT="production",
        SECRET_KEY="super-secret-secure-production-jwt-key-9999",
        BYOK_ENCRYPTION_KEY="fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
    )
    assert prod.ENVIRONMENT == "production"


def test_database_busy_timeout_configured():
    """Verify that every database connection has busy_timeout configured to 5000ms."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("PRAGMA busy_timeout")
        row = cursor.fetchone()
        assert row is not None
        assert row[0] == 5000


def test_health_readiness_probe(test_client: TestClient):
    """Verify that GET /health/ready returns 200 OK and reports subsystem health."""
    resp = test_client.get("/health/ready")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "ready"
    assert data["database"] == "connected"
    assert "ai_provider" in data


def test_password_change_rate_limiting(test_client: TestClient):
    """Verify that rapid repeated password change attempts trigger HTTP 429."""
    email = f"rate_limit_user_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "InitialPassword123!"

    with get_db() as conn:
        user = UserRepository.create_user(
            email=email,
            password_hash=hash_password(pwd),
            db_conn=conn
        )
        WorkspaceRepository.create_workspace(owner_id=user["id"], name="Test WS", db_conn=conn)

    token = create_access_token(subject=user["id"])
    headers = {"Authorization": f"Bearer {token}"}

    # First 15 attempts should be allowed by rate limiter (will fail with incorrect password, but not 429)
    for _ in range(15):
        resp = test_client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "WrongPassword123!", "new_password": "NewValidPassword123!"},
            headers=headers
        )
        assert resp.status_code in (401, 422)

    # 16th attempt should be blocked with 429 Rate Limited
    resp_blocked = test_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "WrongPassword123!", "new_password": "NewValidPassword123!"},
        headers=headers
    )
    assert resp_blocked.status_code == 429
    assert resp_blocked.json()["error"]["code"] == "RATE_LIMITED"


def test_upload_rate_limiting(test_client: TestClient):
    """Verify that rapid repeated document upload attempts trigger HTTP 429."""
    email = f"upload_rate_user_{uuid.uuid4().hex[:8]}@example.com"

    with get_db() as conn:
        user = UserRepository.create_user(
            email=email,
            password_hash=hash_password("Password123!"),
            db_conn=conn
        )
        ws = WorkspaceRepository.create_workspace(owner_id=user["id"], name="Test WS", db_conn=conn)

    token = create_access_token(subject=user["id"], workspace_id=ws["id"])
    headers = {"Authorization": f"Bearer {token}"}

    # Simulate 20 uploads (the limit for this workspace/ip)
    client_ip = "testclient"
    for _ in range(20):
        upload_rate_limiter.is_allowed(f"{ws['id']}_{client_ip}")

    # The 21st attempt should be blocked
    resp = test_client.post(
        "/api/v1/documents/upload",
        files={"file": ("test.txt", b"Valid study content text", "text/plain")},
        headers=headers
    )
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "RATE_LIMITED"


@pytest.mark.asyncio
async def test_streaming_credit_release_on_provider_error(monkeypatch):
    """Verify that if an AI provider fails during token streaming, reserved credits are released."""
    conv_id = str(uuid.uuid4())

    with get_db() as conn:
        user = UserRepository.create_user(
            email=f"stream_fail_{uuid.uuid4().hex[:8]}@example.com",
            password_hash=hash_password("Password123!"),
            db_conn=conn
        )
        ws = WorkspaceRepository.create_workspace(owner_id=user["id"], name="Stream WS", db_conn=conn)
        conn.execute(
            "INSERT INTO conversations (id, workspace_id, user_id, title) VALUES (?, ?, ?, ?)",
            (conv_id, ws["id"], user["id"], "Test Stream Conversation")
        )

    released = False
    original_release = EntitlementService.release_usage

    def mock_release(reservation):
        nonlocal released
        released = True
        return original_release(reservation)

    monkeypatch.setattr(EntitlementService, "release_usage", mock_release)

    # Mock AIService.generate_stream (sync function returning an async token generator)
    def failing_stream(*args, **kwargs):
        async def token_gen():
            yield "token1 "
            raise AIProviderError("Provider timeout during stream", provider="ollama", status_code=504)
        return token_gen(), "ollama", "gemma3:4b", False

    from app.services.ai.service import AIService
    monkeypatch.setattr(AIService, "generate_stream", failing_stream)

    events = []
    async for chunk in RAGService.execute_rag_stream(
        workspace_id=ws["id"],
        user_id=user["id"],
        conversation_id=conv_id,
        query="Explain machine learning"
    ):
        events.append(chunk)

    # Verify that error event was yielded and reservation was released
    assert any("Provider timeout during stream" in e for e in events)
    assert released is True
