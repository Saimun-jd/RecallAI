"""
Search & Retrieval API Router for Recall AI.
Provides unified endpoints for hybrid, semantic, and keyword search
with strict tenant boundary enforcement and rate limiting.
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query, Request, status

from app.api.deps import get_current_user, get_current_workspace
from app.api.middleware import InMemoryRateLimiter
from app.core.errors import NotFoundError, RateLimitError
from app.models.repositories import DocumentRepository
from app.schemas.common import ResponseEnvelope
from app.schemas.search import SearchResponse
from app.services.retrieval import RetrievalService

router = APIRouter(prefix="/search", tags=["Search & Retrieval"])

search_rate_limiter = InMemoryRateLimiter(requests_per_minute=60)


@router.get(
    "",
    response_model=ResponseEnvelope[SearchResponse],
    summary="Execute hybrid, semantic, or keyword knowledge retrieval"
)
def execute_search(
    request: Request,
    query: str = Query(..., min_length=1, max_length=500, description="Search query string"),
    limit: int = Query(default=10, ge=1, le=50, description="Max results to return (1-50)"),
    document_id: Optional[str] = Query(default=None, description="Optional document filter"),
    mode: str = Query(default="hybrid", pattern="^(hybrid|semantic|keyword)$", description="Search algorithm"),
    similarity_threshold: Optional[float] = Query(default=None, ge=0.0, le=1.0, description="Minimum score cutoff"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[SearchResponse]:
    """
    Retrieves authorized knowledge chunks from the user's workspace documents.
    Supports hybrid (semantic + keyword), semantic-only, and keyword-only search modes.
    """
    # Rate limit check per IP/user
    client_key = f"{workspace['id']}_{request.client.host if request.client else 'local'}"
    if not search_rate_limiter.is_allowed(client_key):
        raise RateLimitError("Search rate limit exceeded. Please wait a moment before searching again.")

    # If document filter is provided, enforce that it belongs to the authenticated workspace
    if document_id:
        doc = DocumentRepository.get_by_id_and_workspace(document_id, workspace["id"])
        if not doc:
            raise NotFoundError("Document not found.")

    response = RetrievalService.search(
        query=query,
        workspace_id=workspace["id"],
        document_id=document_id,
        mode=mode,
        limit=limit,
        similarity_threshold=similarity_threshold
    )

    return ResponseEnvelope(data=response)
