"""
Quizzes & Assessment API Router for Recall AI.
Provides AI-powered quiz generation from documents/workspace, quiz management,
and question-level editing with strict workspace tenant boundaries.
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query, Request, status

from app.api.deps import get_current_user, get_current_workspace
from app.api.middleware import InMemoryRateLimiter
from app.core.errors import NotFoundError, RateLimitError
from app.models.repositories import (
    QuizAnswerRepository,
    QuizAttemptRepository,
    QuizQuestionRepository,
    QuizRepository,
)
from app.schemas.attempt import (
    QuizAttemptStartResponse,
    QuizAttemptSummaryResponse,
)
from app.schemas.common import ResponseEnvelope
from app.schemas.quiz import (
    QuizDetailResponse,
    QuizGenerateRequest,
    QuizListResponse,
    QuizQuestionResponse,
    QuizQuestionUpdateRequest,
    QuizResponse,
    QuizUpdateRequest,
)
from app.services.attempts import QuizAttemptService
from app.services.quizzes import QuizGenerationService


router = APIRouter(prefix="/quizzes", tags=["Quizzes & Assessments"])

quiz_rate_limiter = InMemoryRateLimiter(requests_per_minute=30)


@router.post(
    "/generate",
    response_model=ResponseEnvelope[QuizDetailResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Generate an AI-powered quiz from study documents"
)
async def generate_quiz(
    payload: QuizGenerateRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[QuizDetailResponse]:
    """
    Triggers AI-powered quiz generation grounded in the user's selected study documents.
    Enforces tenant boundaries, applies quality guardrails, validates citations,
    and commits the quiz and questions atomically.
    """
    client_key = f"{workspace['id']}_{request.client.host if request.client else 'local'}"
    if not quiz_rate_limiter.is_allowed(client_key):
        raise RateLimitError("Generation rate limit exceeded. Please wait before generating another quiz.")

    result = await QuizGenerationService.generate_quiz(
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        request=payload
    )
    return ResponseEnvelope(data=result)


@router.get(
    "",
    response_model=ResponseEnvelope[QuizListResponse],
    summary="List quizzes in active workspace"
)
def list_quizzes(
    limit: int = Query(default=50, ge=1, le=100, description="Max quizzes to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[QuizListResponse]:
    """
    Lists quizzes in the workspace ordered by recent updates.
    """
    quizzes = QuizRepository.list_by_workspace(
        workspace_id=workspace["id"],
        limit=limit,
        offset=offset
    )
    items = [
        QuizResponse(
            id=q["id"],
            workspace_id=q["workspace_id"],
            user_id=q["user_id"],
            title=q["title"],
            description=q.get("description"),
            source_document_ids=q.get("source_document_ids") or [],
            question_count=q.get("question_count", 0),
            difficulty=q.get("difficulty", "medium"),
            created_at=q["created_at"],
            updated_at=q["updated_at"]
        )
        for q in quizzes
    ]
    return ResponseEnvelope(
        data=QuizListResponse(
            quizzes=items,
            total=len(items)
        )
    )


@router.get(
    "/{quiz_id}",
    response_model=ResponseEnvelope[QuizDetailResponse],
    summary="Get full quiz details and questions"
)
def get_quiz_detail(
    quiz_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[QuizDetailResponse]:
    """
    Retrieves a single quiz along with all its ordered assessment questions.
    """
    quiz = QuizRepository.get_by_id_and_workspace(
        quiz_id=quiz_id,
        workspace_id=workspace["id"]
    )
    if not quiz:
        raise NotFoundError(f"Quiz '{quiz_id}' not found or access denied.")

    questions = QuizQuestionRepository.list_by_quiz(quiz_id=quiz_id)
    question_items = [
        QuizQuestionResponse(
            id=q["id"],
            quiz_id=q["quiz_id"],
            type=q["type"],
            question=q["question"],
            options=q.get("options") or [],
            correct_answer=q["correct_answer"],
            explanation=q["explanation"],
            source_metadata=q.get("source_metadata") or [],
            position=q["position"],
            created_at=q.get("created_at") or "",
            updated_at=q.get("updated_at") or ""
        )
        for q in questions
    ]

    return ResponseEnvelope(
        data=QuizDetailResponse(
            id=quiz["id"],
            workspace_id=quiz["workspace_id"],
            user_id=quiz["user_id"],
            title=quiz["title"],
            description=quiz.get("description"),
            source_document_ids=quiz.get("source_document_ids") or [],
            question_count=quiz.get("question_count", len(question_items)),
            difficulty=quiz.get("difficulty", "medium"),
            created_at=quiz["created_at"],
            updated_at=quiz["updated_at"],
            questions=question_items
        )
    )


@router.patch(
    "/{quiz_id}",
    response_model=ResponseEnvelope[QuizResponse],
    summary="Update quiz metadata"
)
def update_quiz(
    quiz_id: str,
    payload: QuizUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[QuizResponse]:
    """
    Updates the title or description of an owned quiz.
    """
    quiz = QuizRepository.get_by_id_and_workspace(quiz_id=quiz_id, workspace_id=workspace["id"])
    if not quiz:
        raise NotFoundError(f"Quiz '{quiz_id}' not found or access denied.")

    QuizRepository.update_quiz(
        quiz_id=quiz_id,
        workspace_id=workspace["id"],
        title=payload.title,
        description=payload.description
    )

    updated = QuizRepository.get_by_id_and_workspace(quiz_id=quiz_id, workspace_id=workspace["id"])
    return ResponseEnvelope(
        data=QuizResponse(
            id=updated["id"],
            workspace_id=updated["workspace_id"],
            user_id=updated["user_id"],
            title=updated["title"],
            description=updated.get("description"),
            source_document_ids=updated.get("source_document_ids") or [],
            question_count=updated.get("question_count", 0),
            difficulty=updated.get("difficulty", "medium"),
            created_at=updated["created_at"],
            updated_at=updated["updated_at"]
        )
    )


@router.delete(
    "/{quiz_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a quiz"
)
def delete_quiz(
    quiz_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> None:
    """
    Soft-deletes a quiz within the authenticated workspace.
    """
    quiz = QuizRepository.get_by_id_and_workspace(quiz_id=quiz_id, workspace_id=workspace["id"])
    if not quiz:
        raise NotFoundError(f"Quiz '{quiz_id}' not found or access denied.")

    QuizRepository.delete_quiz(quiz_id=quiz_id, workspace_id=workspace["id"])
    return None


@router.patch(
    "/questions/{question_id}",
    response_model=ResponseEnvelope[QuizQuestionResponse],
    summary="Edit an individual quiz question"
)
def update_question(
    question_id: str,
    payload: QuizQuestionUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[QuizQuestionResponse]:
    """
    Updates the prompt, options, correct answer, explanation, or position of an owned question.
    """
    question = QuizQuestionRepository.get_by_id_and_workspace(
        question_id=question_id,
        workspace_id=workspace["id"]
    )
    if not question:
        raise NotFoundError(f"Question '{question_id}' not found or access denied.")

    QuizQuestionRepository.update_question(
        question_id=question_id,
        question=payload.question,
        options=payload.options,
        correct_answer=payload.correct_answer,
        explanation=payload.explanation,
        position=payload.position
    )

    updated = QuizQuestionRepository.get_by_id_and_workspace(
        question_id=question_id,
        workspace_id=workspace["id"]
    )
    return ResponseEnvelope(
        data=QuizQuestionResponse(
            id=updated["id"],
            quiz_id=updated["quiz_id"],
            type=updated["type"],
            question=updated["question"],
            options=updated.get("options") or [],
            correct_answer=updated["correct_answer"],
            explanation=updated["explanation"],
            source_metadata=updated.get("source_metadata") or [],
            position=updated["position"],
            created_at=updated.get("created_at") or "",
            updated_at=updated.get("updated_at") or ""
        )
    )


@router.delete(
    "/questions/{question_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an individual quiz question"
)
def delete_question(
    question_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> None:
    """
    Deletes an individual quiz question and decrements the parent quiz's question_count.
    """
    question = QuizQuestionRepository.get_by_id_and_workspace(
        question_id=question_id,
        workspace_id=workspace["id"]
    )
    if not question:
        raise NotFoundError(f"Question '{question_id}' not found or access denied.")

    QuizQuestionRepository.delete_question(question_id=question_id)
    return None


@router.post(
    "/{quiz_id}/attempts",
    response_model=ResponseEnvelope[QuizAttemptStartResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Start an active quiz attempt with masked questions"
)
def start_quiz_attempt(
    quiz_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[QuizAttemptStartResponse]:
    """
    Initializes a new attempt on an owned quiz.
    Returns masked questions: answers, explanations, and answer-leaking source metadata are omitted.
    """
    attempt = QuizAttemptService.start_attempt(
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        quiz_id=quiz_id
    )
    return ResponseEnvelope(data=attempt)


@router.get(
    "/{quiz_id}/attempts",
    response_model=ResponseEnvelope[list[QuizAttemptSummaryResponse]],
    summary="List past attempts on a quiz"
)
def list_quiz_attempts(
    quiz_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[list[QuizAttemptSummaryResponse]]:
    """
    Lists past attempts for the current user on the specified quiz.
    """
    quiz = QuizRepository.get_by_id_and_workspace(quiz_id=quiz_id, workspace_id=workspace["id"])
    if not quiz:
        raise NotFoundError(f"Quiz '{quiz_id}' not found or access denied.")

    attempts = QuizAttemptRepository.list_by_user_and_quiz(
        quiz_id=quiz_id,
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        limit=limit,
        offset=offset
    )
    items = [
        QuizAttemptSummaryResponse(
            id=a["id"],
            quiz_id=a["quiz_id"],
            status=a["status"],
            started_at=a["started_at"],
            submitted_at=a.get("submitted_at"),
            score=a["score"],
            percentage=a["percentage"],
            total_questions=a["total_questions"],
            correct_answers=a["correct_answers"]
        )
        for a in attempts
    ]
    return ResponseEnvelope(data=items)

