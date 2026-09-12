"""
Conversations & Knowledge Hub RAG Chat API Endpoints for Recall AI.
Provides conversation lifecycle management, multi-tenant message isolation,
and non-streaming / streaming grounded RAG completions.
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_user, get_current_workspace
from app.api.middleware import InMemoryRateLimiter
from app.core.errors import NotFoundError, RateLimitError
from app.models.repositories import (
    ConversationRepository,
    DocumentRepository,
    MessageRepository,
)
from app.schemas.chat import (
    ConversationCreateRequest,
    ConversationDetailResponse,
    ConversationListResponse,
    ConversationResponse,
    ConversationUpdateRequest,
    MessageResponse,
    RAGResponse,
    SendMessageRequest,
    SourceCitation,
)
from app.schemas.common import ResponseEnvelope
from app.services.rag import RAGService

router = APIRouter(prefix="/conversations", tags=["Conversations & RAG Chat"])

chat_rate_limiter = InMemoryRateLimiter(requests_per_minute=60)


@router.post(
    "",
    response_model=ResponseEnvelope[ConversationResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new conversation session"
)
def create_conversation(
    payload: ConversationCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[ConversationResponse]:
    """
    Initializes a new scoped conversation session within the active workspace.
    """
    conv = ConversationRepository.create_conversation(
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        title=payload.title or "New Conversation"
    )
    return ResponseEnvelope(
        data=ConversationResponse(
            id=conv["id"],
            workspace_id=conv["workspace_id"],
            user_id=conv["user_id"],
            title=conv["title"],
            created_at=conv["created_at"],
            updated_at=conv["updated_at"]
        )
    )


@router.get(
    "",
    response_model=ResponseEnvelope[ConversationListResponse],
    summary="List conversations for current workspace"
)
def list_conversations(
    limit: int = Query(default=50, ge=1, le=100, description="Number of conversations to return"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[ConversationListResponse]:
    """
    Lists conversations sorted by most recently updated in the active workspace.
    """
    conversations = ConversationRepository.list_by_workspace(
        workspace_id=workspace["id"],
        limit=limit,
        offset=offset
    )
    items = [
        ConversationResponse(
            id=c["id"],
            workspace_id=c["workspace_id"],
            user_id=c["user_id"],
            title=c["title"],
            created_at=c["created_at"],
            updated_at=c["updated_at"]
        )
        for c in conversations
    ]
    return ResponseEnvelope(
        data=ConversationListResponse(
            conversations=items,
            total=len(items)
        )
    )


@router.get(
    "/{conversation_id}",
    response_model=ResponseEnvelope[ConversationDetailResponse],
    summary="Get conversation details and message history"
)
def get_conversation(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[ConversationDetailResponse]:
    """
    Retrieves a conversation and its complete ordered message history.
    """
    conv = ConversationRepository.get_by_id_and_workspace(
        conversation_id=conversation_id,
        workspace_id=workspace["id"]
    )
    if not conv:
        raise NotFoundError("Conversation not found.")

    messages = MessageRepository.list_by_conversation(conversation_id)
    msg_responses: list[MessageResponse] = []
    for m in messages:
        sources_data = m.get("sources", [])
        if isinstance(sources_data, str):
            sources_list = []
        else:
            sources_list = [SourceCitation(**s) for s in sources_data]

        msg_responses.append(
            MessageResponse(
                id=m["id"],
                conversation_id=m["conversation_id"],
                role=m["role"],
                content=m["content"],
                sources=sources_list,
                token_count=m.get("token_count", 0),
                created_at=m["created_at"]
            )
        )

    return ResponseEnvelope(
        data=ConversationDetailResponse(
            id=conv["id"],
            workspace_id=conv["workspace_id"],
            user_id=conv["user_id"],
            title=conv["title"],
            created_at=conv["created_at"],
            updated_at=conv["updated_at"],
            messages=msg_responses
        )
    )


@router.patch(
    "/{conversation_id}",
    response_model=ResponseEnvelope[ConversationResponse],
    summary="Update conversation title"
)
def update_conversation(
    conversation_id: str,
    payload: ConversationUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[ConversationResponse]:
    """
    Updates the title of an existing conversation in the workspace.
    """
    conv = ConversationRepository.get_by_id_and_workspace(
        conversation_id=conversation_id,
        workspace_id=workspace["id"]
    )
    if not conv:
        raise NotFoundError("Conversation not found.")

    ConversationRepository.update_title(
        conversation_id=conversation_id,
        workspace_id=workspace["id"],
        title=payload.title
    )
    updated = ConversationRepository.get_by_id_and_workspace(
        conversation_id=conversation_id,
        workspace_id=workspace["id"]
    )
    return ResponseEnvelope(
        data=ConversationResponse(
            id=updated["id"],  # type: ignore
            workspace_id=updated["workspace_id"],  # type: ignore
            user_id=updated["user_id"],  # type: ignore
            title=updated["title"],  # type: ignore
            created_at=updated["created_at"],  # type: ignore
            updated_at=updated["updated_at"]  # type: ignore
        )
    )


@router.delete(
    "/{conversation_id}",
    response_model=ResponseEnvelope[Dict[str, bool]],
    summary="Soft-delete conversation"
)
def delete_conversation(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[Dict[str, bool]]:
    """
    Soft-deletes a conversation from the active workspace.
    """
    conv = ConversationRepository.get_by_id_and_workspace(
        conversation_id=conversation_id,
        workspace_id=workspace["id"]
    )
    if not conv:
        raise NotFoundError("Conversation not found.")

    ConversationRepository.delete_conversation(
        conversation_id=conversation_id,
        workspace_id=workspace["id"]
    )
    return ResponseEnvelope(data={"success": True})


@router.post(
    "/{conversation_id}/messages",
    response_model=ResponseEnvelope[RAGResponse],
    summary="Send message and generate grounded RAG response (sync or streaming)"
)
async def send_message(
    conversation_id: str,
    payload: SendMessageRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
):
    """
    Sends a query into a conversation and generates an academically grounded response
    using retrieved knowledge from the workspace study documents.
    Supports Server-Sent Events streaming via `stream=true`.
    """
    client_key = f"{workspace['id']}_{request.client.host if request.client else 'local'}"
    if not chat_rate_limiter.is_allowed(client_key):
        raise RateLimitError("Chat rate limit exceeded. Please wait a moment before sending another message.")

    conv = ConversationRepository.get_by_id_and_workspace(
        conversation_id=conversation_id,
        workspace_id=workspace["id"]
    )
    if not conv:
        raise NotFoundError("Conversation not found.")

    if payload.document_id:
        doc = DocumentRepository.get_by_id_and_workspace(
            document_id=payload.document_id,
            workspace_id=workspace["id"]
        )
        if not doc:
            raise NotFoundError("Filtered document not found.")

    if payload.stream:
        return StreamingResponse(
            RAGService.execute_rag_stream(
                workspace_id=workspace["id"],
                user_id=current_user["id"],
                conversation_id=conversation_id,
                query=payload.content,
                document_id=payload.document_id,
                provider_preference=payload.provider
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )

    rag_result = await RAGService.execute_rag(
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        conversation_id=conversation_id,
        query=payload.content,
        document_id=payload.document_id,
        provider_preference=payload.provider
    )
    return ResponseEnvelope(data=rag_result)
