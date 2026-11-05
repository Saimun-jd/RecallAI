"""
Quiz Attempts & Assessment Submission API Router for Recall AI.
Provides active attempt retrieval, interim answer recording, and deterministic submission.
"""

from typing import Any, Dict
from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user, get_current_workspace
from app.schemas.attempt import (
    QuizAttemptResultResponse,
    SubmitAnswerItem,
    SubmitAnswersRequest,
)
from app.schemas.common import ResponseEnvelope
from app.services.attempts import QuizAttemptService

router = APIRouter(prefix="/quiz-attempts", tags=["Quiz Attempts & Assessment"])


@router.get(
    "/{attempt_id}",
    response_model=ResponseEnvelope[Any],
    summary="Get quiz attempt state (questions are masked if active, evaluated if submitted)"
)
def get_attempt(
    attempt_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[Any]:
    """
    Retrieves the status of an attempt.
    If in_progress: questions are masked with correct answers omitted.
    If submitted: returns complete scoring, answer comparisons, and explanations.
    """
    result = QuizAttemptService.get_attempt(
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        attempt_id=attempt_id
    )
    return ResponseEnvelope(data=result)


@router.post(
    "/{attempt_id}/answers",
    response_model=ResponseEnvelope[Dict[str, Any]],
    summary="Record an interim answer for a question during an active attempt"
)
def record_answer(
    attempt_id: str,
    payload: SubmitAnswerItem,
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[Dict[str, Any]]:
    """
    Saves an interim answer while the attempt is in progress.
    """
    res = QuizAttemptService.record_answer(
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        attempt_id=attempt_id,
        question_id=payload.question_id,
        selected_answer=payload.selected_answer
    )
    return ResponseEnvelope(data=res)


@router.post(
    "/{attempt_id}/submit",
    response_model=ResponseEnvelope[QuizAttemptResultResponse],
    status_code=status.HTTP_200_OK,
    summary="Submit and deterministically evaluate a quiz attempt"
)
def submit_attempt(
    attempt_id: str,
    payload: SubmitAnswersRequest = SubmitAnswersRequest(),
    current_user: Dict[str, Any] = Depends(get_current_user),
    workspace: Dict[str, Any] = Depends(get_current_workspace),
) -> ResponseEnvelope[QuizAttemptResultResponse]:
    """
    Deterministically evaluates all answers server-side, calculates the score and percentage,
    atomically finalizes the attempt, updates spaced repetition progress,
    and returns full evaluation results with educational explanations.
    """
    result = QuizAttemptService.submit_attempt(
        workspace_id=workspace["id"],
        user_id=current_user["id"],
        attempt_id=attempt_id,
        answers=payload.answers
    )
    return ResponseEnvelope(data=result)
