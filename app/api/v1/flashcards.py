"""
Flashcards & Study Material API Router for Recall AI.
Provides flashcard set generation from documents/workspace, set management,
and card-level editing with strict workspace tenant boundaries.
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query, Request, status

from app.api.deps import get_current_user, get_current_workspace
from app.api.middleware import InMemoryRateLimiter
from app.core.errors import NotFoundError, RateLimitError
from app.models.repositories import (
    FlashcardRepository,
    FlashcardSetRepository,
)
from app.schemas.common import ResponseEnvelope
from app.schemas.flashcard import (
    FlashcardGenerateRequest,
    FlashcardResponse,
    FlashcardSetDetailResponse,
    FlashcardSetListResponse,
    FlashcardSetResponse,
    FlashcardSetUpdateRequest,
    FlashcardUpdateRequest,
)
from app.services.flashcards import FlashcardGenerationService

router = APIRouter(prefix="/flashcards", tags=["Flashcards & Study Materials"])

flashcard_rate_limiter = InMemoryRateLimiter(requests_per_minute=30)


@router.post(
    "/generate",
    response_model=ResponseEnvelope[FlashcardSetDetailResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Generate a high-yield flashcard set from study documents"
)
async def generate_flashcards(
    payload: FlashcardGenerateRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[FlashcardSetDetailResponse]:
    """
    Triggers AI-powered flashcard generation grounded in the user's selected study documents.
    Enforces tenant boundaries, applies quality guardrails, validates citations,
    and commits the set and cards atomically.
    """
    client_key = f"{workspace['id']}_{request.client.host if request.client else 'local'}"
    if not flashcard_rate_limiter.is_allowed(client_key):
        raise RateLimitError("Generation rate limit exceeded. Please wait before generating another set.")

    result = await FlashcardGenerationService.generate_flashcards(
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        request=payload
    )
    return ResponseEnvelope(data=result)


@router.get(
    "/sets",
    response_model=ResponseEnvelope[FlashcardSetListResponse],
    summary="List flashcard sets in active workspace"
)
def list_flashcard_sets(
    limit: int = Query(default=50, ge=1, le=100, description="Max sets to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[FlashcardSetListResponse]:
    """
    Lists flashcard sets in the workspace ordered by recent updates.
    """
    sets = FlashcardSetRepository.list_by_workspace(
        workspace_id=workspace["id"],
        limit=limit,
        offset=offset
    )
    items = [
        FlashcardSetResponse(
            id=s["id"],
            workspace_id=s["workspace_id"],
            user_id=s["user_id"],
            title=s["title"],
            description=s.get("description"),
            source_document_ids=s.get("source_document_ids", []),
            card_count=s.get("card_count", 0),
            created_at=s["created_at"],
            updated_at=s["updated_at"]
        )
        for s in sets
    ]
    return ResponseEnvelope(
        data=FlashcardSetListResponse(
            sets=items,
            total=len(items)
        )
    )


@router.get(
    "/sets/{set_id}",
    response_model=ResponseEnvelope[FlashcardSetDetailResponse],
    summary="Get flashcard set details with all cards"
)
def get_flashcard_set(
    set_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[FlashcardSetDetailResponse]:
    """
    Retrieves a flashcard set and its complete ordered collection of cards.
    """
    s = FlashcardSetRepository.get_by_id_and_workspace(
        set_id=set_id,
        workspace_id=workspace["id"]
    )
    if not s:
        raise NotFoundError("Flashcard set not found.")

    raw_cards = FlashcardRepository.list_by_set(set_id)
    cards = [
        FlashcardResponse(
            id=c["id"],
            flashcard_set_id=c["flashcard_set_id"],
            front=c["front"],
            back=c["back"],
            source_metadata=c.get("source_metadata", []),
            position=c.get("position", 0),
            created_at=c["created_at"],
            updated_at=c["updated_at"]
        )
        for c in raw_cards
    ]

    return ResponseEnvelope(
        data=FlashcardSetDetailResponse(
            id=s["id"],
            workspace_id=s["workspace_id"],
            user_id=s["user_id"],
            title=s["title"],
            description=s.get("description"),
            source_document_ids=s.get("source_document_ids", []),
            card_count=len(cards),
            created_at=s["created_at"],
            updated_at=s["updated_at"],
            cards=cards
        )
    )


@router.patch(
    "/sets/{set_id}",
    response_model=ResponseEnvelope[FlashcardSetResponse],
    summary="Update flashcard set title or description"
)
def update_flashcard_set(
    set_id: str,
    payload: FlashcardSetUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[FlashcardSetResponse]:
    """
    Updates the metadata of an existing flashcard set.
    """
    s = FlashcardSetRepository.get_by_id_and_workspace(
        set_id=set_id,
        workspace_id=workspace["id"]
    )
    if not s:
        raise NotFoundError("Flashcard set not found.")

    FlashcardSetRepository.update_set(
        set_id=set_id,
        workspace_id=workspace["id"],
        title=payload.title,
        description=payload.description
    )
    updated = FlashcardSetRepository.get_by_id_and_workspace(set_id, workspace["id"])
    return ResponseEnvelope(
        data=FlashcardSetResponse(
            id=updated["id"],  # type: ignore
            workspace_id=updated["workspace_id"],  # type: ignore
            user_id=updated["user_id"],  # type: ignore
            title=updated["title"],  # type: ignore
            description=updated.get("description"),  # type: ignore
            source_document_ids=updated.get("source_document_ids", []),  # type: ignore
            card_count=updated.get("card_count", 0),  # type: ignore
            created_at=updated["created_at"],  # type: ignore
            updated_at=updated["updated_at"]  # type: ignore
        )
    )


@router.delete(
    "/sets/{set_id}",
    response_model=ResponseEnvelope[Dict[str, bool]],
    summary="Soft delete a flashcard set"
)
def delete_flashcard_set(
    set_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[Dict[str, bool]]:
    """
    Soft-deletes a flashcard set from the workspace.
    """
    s = FlashcardSetRepository.get_by_id_and_workspace(
        set_id=set_id,
        workspace_id=workspace["id"]
    )
    if not s:
        raise NotFoundError("Flashcard set not found.")

    FlashcardSetRepository.delete_set(set_id, workspace["id"])
    return ResponseEnvelope(data={"success": True})


@router.patch(
    "/cards/{card_id}",
    response_model=ResponseEnvelope[FlashcardResponse],
    summary="Update front, back, or position of an individual flashcard"
)
def update_flashcard(
    card_id: str,
    payload: FlashcardUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[FlashcardResponse]:
    """
    Updates the content or position of a single flashcard belonging to the active workspace.
    """
    card = FlashcardRepository.get_by_id_and_workspace(
        card_id=card_id,
        workspace_id=workspace["id"]
    )
    if not card:
        raise NotFoundError("Flashcard not found.")

    FlashcardRepository.update_card(
        card_id=card_id,
        front=payload.front,
        back=payload.back,
        position=payload.position
    )
    updated = FlashcardRepository.get_by_id_and_workspace(card_id, workspace["id"])
    return ResponseEnvelope(
        data=FlashcardResponse(
            id=updated["id"],  # type: ignore
            flashcard_set_id=updated["flashcard_set_id"],  # type: ignore
            front=updated["front"],  # type: ignore
            back=updated["back"],  # type: ignore
            source_metadata=updated.get("source_metadata", []),  # type: ignore
            position=updated.get("position", 0),  # type: ignore
            created_at=updated["created_at"],  # type: ignore
            updated_at=updated["updated_at"]  # type: ignore
        )
    )


@router.delete(
    "/cards/{card_id}",
    response_model=ResponseEnvelope[Dict[str, bool]],
    summary="Delete an individual flashcard"
)
def delete_flashcard(
    card_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[Dict[str, bool]]:
    """
    Deletes an individual flashcard and decrements the set's card count.
    """
    card = FlashcardRepository.get_by_id_and_workspace(
        card_id=card_id,
        workspace_id=workspace["id"]
    )
    if not card:
        raise NotFoundError("Flashcard not found.")

    set_id = card["flashcard_set_id"]
    FlashcardRepository.delete_card(card_id)

    # Decrement set card count
    current_set = FlashcardSetRepository.get_by_id_and_workspace(set_id, workspace["id"])
    if current_set:
        new_count = max(0, current_set.get("card_count", 1) - 1)
        FlashcardSetRepository.update_set(set_id, workspace["id"], card_count=new_count)

    return ResponseEnvelope(data={"success": True})


# ── Direct /flashcard-sets route aliases ───────────────────────────────

sets_alias_router = APIRouter(prefix="/flashcard-sets", tags=["Flashcards & Study Materials"])


@sets_alias_router.get("", response_model=ResponseEnvelope[FlashcardSetListResponse], summary="List flashcard sets (alias)")
def list_flashcard_sets_alias(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
):
    return list_flashcard_sets(limit=limit, offset=offset, current_user=current_user, workspace=workspace)


@sets_alias_router.get("/{set_id}", response_model=ResponseEnvelope[FlashcardSetDetailResponse], summary="Get flashcard set (alias)")
def get_flashcard_set_alias(
    set_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
):
    return get_flashcard_set(set_id=set_id, current_user=current_user, workspace=workspace)


@sets_alias_router.patch("/{set_id}", response_model=ResponseEnvelope[FlashcardSetResponse], summary="Update flashcard set (alias)")
def update_flashcard_set_alias(
    set_id: str,
    payload: FlashcardSetUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
):
    return update_flashcard_set(set_id=set_id, payload=payload, current_user=current_user, workspace=workspace)


@sets_alias_router.delete("/{set_id}", response_model=ResponseEnvelope[Dict[str, bool]], summary="Delete flashcard set (alias)")
def delete_flashcard_set_alias(
    set_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
):
    return delete_flashcard_set(set_id=set_id, current_user=current_user, workspace=workspace)

