"""
Health Check & Readiness Probes for Recall AI.
Endpoints:
- GET /health
- GET /health/db
"""

from fastapi import APIRouter, Response, status
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
