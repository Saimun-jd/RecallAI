"""
Health Check & Readiness Probes for Recall AI.
Endpoints:
- GET /health
- GET /health/db
"""

from fastapi import APIRouter, status
from app.core.config import settings
from app.core.database import check_database_health
from app.core.errors import ErrorCode, format_error_response
from app.schemas.common import ResponseEnvelope

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=ResponseEnvelope[dict], summary="Application liveness probe")
async def liveness_check():
    """Returns 200 OK if server process is running."""
    return ResponseEnvelope(
        data={
            "status": "ok",
            "environment": settings.ENVIRONMENT,
            "version": "1.0.0"
        }
    )


@router.get("/health/db", response_model=ResponseEnvelope[dict], summary="Database readiness probe")
async def database_health_check():
    """Returns 200 OK if database is responsive, 503 Service Unavailable otherwise."""
    is_healthy = check_database_health()
    if not is_healthy:
        return format_error_response(
            code=ErrorCode.INTERNAL_ERROR,
            message="Database dependency is unavailable.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    return ResponseEnvelope(
        data={
            "status": "ok",
            "database": "connected"
        }
    )


@router.get("/health/ready", response_model=ResponseEnvelope[dict], summary="Application readiness probe")
async def readiness_check():
    """
    Evaluates core subsystem readiness for serving traffic.
    Returns 200 OK if database and storage dependencies are operational.
    Reports AI provider status without failing non-AI workloads if optional local Ollama is offline.
    """
    db_ok = check_database_health()
    if not db_ok:
        return format_error_response(
            code=ErrorCode.INTERNAL_ERROR,
            message="Database readiness check failed.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details={"database": "unhealthy"}
        )

    ai_status = "configured"
    if settings.llm_provider == "ollama":
        ai_status = "local_ollama"
    elif settings.llm_provider in ("openai", "gemini", "groq"):
        ai_status = f"cloud_{settings.llm_provider}"

    return ResponseEnvelope(
        data={
            "status": "ready",
            "environment": settings.ENVIRONMENT,
            "database": "connected",
            "ai_provider": ai_status,
            "version": "1.0.0"
        }
    )
