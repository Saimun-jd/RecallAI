"""
Knowledge Layer API for Recall AI.
Provides endpoints for AI-generated document summaries, concept extraction,
and individual concept retrieval.
"""

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_current_user, get_current_workspace, require_document_owner
from app.core.errors import NotFoundError
from app.models.repositories import ConceptRepository
from app.schemas.common import ResponseEnvelope
from app.schemas.knowledge import (
    ConceptGenerateRequest,
    ConceptItemResponse,
    ConceptListResponse,
    DocumentSummaryResponse,
    SummaryGenerateRequest,
)
from app.services.knowledge import KnowledgeService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["knowledge"])


# ── Summary Endpoints ─────────────────────────────────────────────────

@router.get(
    "/documents/{document_id}/summary",
    response_model=ResponseEnvelope[DocumentSummaryResponse],
    summary="Retrieve cached document summary (read-only, 0 credits)"
)
def get_document_summary(
    document_id: str,
    summary_type: str = Query(default="standard", pattern="^(short|standard|detailed)$"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[DocumentSummaryResponse]:
    """
    Returns a persisted document summary without making AI calls or consuming credits.
    Returns 404 if no summary has been generated yet.
    """
    result = KnowledgeService.get_document_summary(
        document_id=document_id,
        workspace_id=workspace["id"],
        summary_type=summary_type,
    )
    return ResponseEnvelope(
        status="success",
        data=result,
        message="Document summary retrieved successfully.",
    )


@router.post(
    "/documents/{document_id}/summary",
    response_model=ResponseEnvelope[DocumentSummaryResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Generate or regenerate a document summary (costs 1 credit)"
)
async def generate_document_summary(
    document_id: str,
    body: SummaryGenerateRequest = SummaryGenerateRequest(),
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
    document: Dict[str, Any] = Depends(require_document_owner),
) -> ResponseEnvelope[DocumentSummaryResponse]:
    """
    Generates an AI-powered document summary.
    Returns cached summary if valid and force=False.
    """
    result = await KnowledgeService.generate_document_summary(
        document_id=document_id,
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        summary_type=body.summary_type,
        force=body.force,
    )
    return ResponseEnvelope(
        status="success",
        data=result,
        message=f"{body.summary_type.capitalize()} summary generated successfully.",
    )


# ── Concept Endpoints ─────────────────────────────────────────────────

@router.get(
    "/documents/{document_id}/concepts",
    response_model=ResponseEnvelope[ConceptListResponse],
    summary="Retrieve extracted concepts for a document (read-only, 0 credits)"
)
def get_document_concepts(
    document_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[ConceptListResponse]:
    """
    Returns persisted concepts without making AI calls or consuming credits.
    Returns empty list if no concepts have been extracted yet.
    """
    result = KnowledgeService.get_document_concepts(
        document_id=document_id,
        workspace_id=workspace["id"],
    )
    return ResponseEnvelope(
        status="success",
        data=result,
        message="Document concepts retrieved successfully.",
    )


@router.post(
    "/documents/{document_id}/concepts",
    response_model=ResponseEnvelope[ConceptListResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Extract concepts from a document (costs 1 credit)"
)
async def generate_document_concepts(
    document_id: str,
    body: ConceptGenerateRequest = ConceptGenerateRequest(),
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
    document: Dict[str, Any] = Depends(require_document_owner),
) -> ResponseEnvelope[ConceptListResponse]:
    """
    Extracts key concepts from a document using AI.
    Returns cached concepts if valid and force=False.
    """
    result = await KnowledgeService.generate_document_concepts(
        document_id=document_id,
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        max_concepts=body.max_concepts,
        force=body.force,
    )
    return ResponseEnvelope(
        status="success",
        data=result,
        message="Concepts extracted successfully.",
    )


# ── Individual Concept Endpoint ───────────────────────────────────────

@router.get(
    "/concepts/{concept_id}",
    response_model=ResponseEnvelope[ConceptItemResponse],
    summary="Retrieve a single concept by ID"
)
def get_concept(
    concept_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[ConceptItemResponse]:
    """
    Returns a single concept with tenant isolation.
    """
    result = KnowledgeService.get_concept(
        concept_id=concept_id,
        workspace_id=workspace["id"],
    )
    return ResponseEnvelope(
        status="success",
        data=result,
        message="Concept retrieved successfully.",
    )
