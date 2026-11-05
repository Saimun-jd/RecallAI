"""
Quiz Attempt, Deterministic Scoring, and Assessment Lifecycle Service for Recall AI.
Enforces question masking, server-side answer evaluation, concurrency protection,
atomic submission, and learning progress tracking.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional

from app.core.database import get_db
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.models.repositories import (
    QuizAnswerRepository,
    QuizAttemptRepository,
    QuizQuestionRepository,
    QuizRepository,
)
from app.schemas.attempt import (
    MaskedQuizQuestionResponse,
    QuestionEvaluationResult,
    QuizAttemptResultResponse,
    QuizAttemptStartResponse,
    SubmitAnswerItem,
)
from app.services.learning import LearningProgressService

logger = logging.getLogger(__name__)


class QuizAttemptService:
    """
    Coordinates the lifecycle of a student's attempt at an assessment:
    start -> mask questions -> record answers -> deterministic scoring -> submission -> progress update.
    """

    @classmethod
    def start_attempt(
        cls,
        workspace_id: str,
        user_id: str,
        quiz_id: str
    ) -> QuizAttemptStartResponse:
        """
        Starts a new attempt on an owned quiz.
        Returns the attempt metadata with STRICTLY MASKED questions (zero answer leakage).
        """
        quiz = QuizRepository.get_by_id_and_workspace(quiz_id=quiz_id, workspace_id=workspace_id)
        if not quiz:
            raise NotFoundError(f"Quiz '{quiz_id}' not found or access denied.")

        questions = QuizQuestionRepository.list_by_quiz(quiz_id=quiz_id)
        if not questions:
            raise ValidationError("Cannot start an attempt on a quiz with no questions.")

        attempt = QuizAttemptRepository.create_attempt(
            workspace_id=workspace_id,
            user_id=user_id,
            quiz_id=quiz_id,
            total_questions=len(questions)
        )

        # MASK questions: omit correct_answer, explanation, and source_metadata
        masked_questions = [
            MaskedQuizQuestionResponse(
                id=q["id"],
                type=q["type"],
                question=q["question"],
                options=q.get("options") or [],
                position=q["position"]
            )
            for q in questions
        ]

        return QuizAttemptStartResponse(
            id=attempt["id"],
            quiz_id=attempt["quiz_id"],
            status=attempt["status"],
            started_at=attempt["started_at"],
            total_questions=attempt["total_questions"],
            questions=masked_questions
        )

    @classmethod
    def get_attempt(
        cls,
        workspace_id: str,
        user_id: str,
        attempt_id: str
    ) -> Any:
        """
        Retrieves an attempt.
        If in_progress: returns masked questions.
        If submitted: returns full evaluation and score results.
        """
        attempt = QuizAttemptRepository.get_by_id_and_workspace(attempt_id=attempt_id, workspace_id=workspace_id)
        if not attempt or attempt["user_id"] != user_id:
            raise NotFoundError(f"Quiz attempt '{attempt_id}' not found or access denied.")

        questions = QuizQuestionRepository.list_by_quiz(attempt["quiz_id"])
        saved_answers = QuizAnswerRepository.list_by_attempt(attempt_id=attempt_id)
        answers_map = {a["question_id"]: a for a in saved_answers}

        if attempt["status"] == "in_progress":
            masked_questions = [
                MaskedQuizQuestionResponse(
                    id=q["id"],
                    type=q["type"],
                    question=q["question"],
                    options=q.get("options") or [],
                    position=q["position"]
                )
                for q in questions
            ]
            return QuizAttemptStartResponse(
                id=attempt["id"],
                quiz_id=attempt["quiz_id"],
                status=attempt["status"],
                started_at=attempt["started_at"],
                total_questions=attempt["total_questions"],
                questions=masked_questions
            )

        # Submitted attempt: return full results with explanations and citations
        question_results = []
        for q in questions:
            ans_record = answers_map.get(q["id"])
            selected = ans_record["selected_answer"] if ans_record else ""
            is_correct = bool(ans_record["is_correct"]) if ans_record else False

            question_results.append(
                QuestionEvaluationResult(
                    question_id=q["id"],
                    type=q["type"],
                    question=q["question"],
                    options=q.get("options") or [],
                    selected_answer=selected,
                    correct_answer=q["correct_answer"],
                    is_correct=is_correct,
                    explanation=q["explanation"],
                    source_metadata=q.get("source_metadata") or []
                )
            )

        duration = None
        if attempt.get("submitted_at") and attempt.get("started_at"):
            try:
                start_dt = datetime.fromisoformat(attempt["started_at"].replace("Z", "+00:00"))
                end_dt = datetime.fromisoformat(attempt["submitted_at"].replace("Z", "+00:00"))
                duration = max(0, int((end_dt - start_dt).total_seconds()))
            except Exception:
                pass

        return QuizAttemptResultResponse(
            id=attempt["id"],
            quiz_id=attempt["quiz_id"],
            status=attempt["status"],
            started_at=attempt["started_at"],
            submitted_at=attempt.get("submitted_at"),
            score=attempt["score"],
            percentage=attempt["percentage"],
            total_questions=attempt["total_questions"],
            correct_answers=attempt["correct_answers"],
            incorrect_answers=attempt["total_questions"] - attempt["correct_answers"],
            unanswered=sum(1 for r in question_results if r.selected_answer == ""),
            duration_seconds=duration,
            question_results=question_results
        )

    @classmethod
    def record_answer(
        cls,
        workspace_id: str,
        user_id: str,
        attempt_id: str,
        question_id: str,
        selected_answer: str
    ) -> Dict[str, Any]:
        """
        Saves or updates an interim answer during an active attempt.
        """
        attempt = QuizAttemptRepository.get_by_id_and_workspace(attempt_id=attempt_id, workspace_id=workspace_id)
        if not attempt or attempt["user_id"] != user_id:
            raise NotFoundError(f"Quiz attempt '{attempt_id}' not found or access denied.")

        if attempt["status"] != "in_progress":
            raise ValidationError("Cannot save answers to an attempt that is no longer in progress.")

        # Validate question belongs to this quiz
        q = QuizQuestionRepository.get_by_id_and_workspace(question_id=question_id, workspace_id=workspace_id)
        if not q or q["quiz_id"] != attempt["quiz_id"]:
            raise NotFoundError(f"Question '{question_id}' does not belong to this quiz.")

        QuizAnswerRepository.save_answer(
            attempt_id=attempt_id,
            question_id=question_id,
            selected_answer=selected_answer,
            is_correct=False
        )
        return {"status": "saved", "question_id": question_id}

    @classmethod
    def submit_attempt(
        cls,
        workspace_id: str,
        user_id: str,
        attempt_id: str,
        answers: Optional[List[SubmitAnswerItem]] = None
    ) -> QuizAttemptResultResponse:
        """
        Deterministically evaluates all answers, calculates score and percentage,
        finalizes the attempt in an atomic transaction, updates spaced-repetition progress,
        and reveals full feedback and explanations.
        """
        attempt = QuizAttemptRepository.get_by_id_and_workspace(attempt_id=attempt_id, workspace_id=workspace_id)
        if not attempt or attempt["user_id"] != user_id:
            raise NotFoundError(f"Quiz attempt '{attempt_id}' not found or access denied.")

        if attempt["status"] == "submitted":
            raise ConflictError("This attempt has already been submitted and finalized.")

        if attempt["status"] != "in_progress":
            raise ValidationError(f"Cannot submit attempt in '{attempt['status']}' state.")

        # 1. Fetch all quiz questions
        questions = QuizQuestionRepository.list_by_quiz(quiz_id=attempt["quiz_id"])
        if not questions:
            raise ValidationError("Quiz questions could not be found.")

        # 2. Collect existing saved answers & merge with submission payload
        saved_answers = QuizAnswerRepository.list_by_attempt(attempt_id=attempt_id)
        answers_map: Dict[str, str] = {a["question_id"]: a["selected_answer"] for a in saved_answers}

        if answers:
            for item in answers:
                answers_map[item.question_id] = str(item.selected_answer).strip()

        # 3. Deterministic Evaluation
        evaluated_results: List[Dict[str, Any]] = []
        answers_to_persist: List[Dict[str, Any]] = []

        for q in questions:
            q_id = q["id"]
            q_type = q["type"]
            stored_correct = str(q["correct_answer"]).strip()
            selected = answers_map.get(q_id)

            if selected is None or selected == "":
                # Unanswered: counted as incorrect
                is_correct = False
                selected_str = ""
            else:
                selected_str = str(selected).strip()
                if q_type == "multiple_choice":
                    # Evaluate index equality or text equality
                    if selected_str.isdigit() and stored_correct.isdigit():
                        is_correct = (int(selected_str) == int(stored_correct))
                    else:
                        is_correct = (selected_str.lower() == stored_correct.lower())
                elif q_type == "true_false":
                    sel_bool = selected_str.lower() in ("true", "t", "1", "yes")
                    correct_bool = stored_correct.lower() in ("true", "t", "1", "yes")
                    is_correct = (sel_bool == correct_bool)
                else:
                    is_correct = (selected_str.lower() == stored_correct.lower())

            answers_to_persist.append({
                "question_id": q_id,
                "selected_answer": selected_str,
                "is_correct": is_correct
            })

            evaluated_results.append({
                "question_id": q_id,
                "type": q_type,
                "question": q["question"],
                "options": q.get("options") or [],
                "selected_answer": selected_str,
                "correct_answer": stored_correct,
                "is_correct": is_correct,
                "explanation": q["explanation"],
                "source_metadata": q.get("source_metadata") or []
            })

        # 4. Compute statistics
        total_questions = len(questions)
        correct_count = sum(1 for r in evaluated_results if r["is_correct"])
        incorrect_count = total_questions - correct_count
        unanswered_count = sum(1 for r in evaluated_results if r["selected_answer"] == "")
        score = round(correct_count / total_questions, 4) if total_questions > 0 else 0.0
        percentage = round(score * 100.0, 2)

        # 5. Atomic Transaction: persist answers + finalize attempt + update learning progress
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        with get_db() as conn:
            # 5a. Persist answers
            QuizAnswerRepository.save_answers_batch(attempt_id, answers_to_persist, db_conn=conn)

            # 5b. Finalize attempt record
            QuizAttemptRepository.finalize_attempt(
                attempt_id=attempt_id,
                score=score,
                percentage=percentage,
                correct_answers=correct_count,
                db_conn=conn
            )

            # 5c. Update learning progress for each question
            for r in evaluated_results:
                src_ref = r["source_metadata"][0] if r["source_metadata"] else {}
                LearningProgressService.record_review_result(
                    workspace_id=workspace_id,
                    user_id=user_id,
                    content_type="quiz_question",
                    content_id=r["question_id"],
                    is_correct=r["is_correct"],
                    source_reference=src_ref,
                    source_id=attempt_id,
                    source_type="quiz_attempt",
                    db_conn=conn
                )

        # 6. Calculate duration
        duration = None
        if attempt.get("started_at"):
            try:
                start_dt = datetime.fromisoformat(attempt["started_at"].replace("Z", "+00:00"))
                duration = max(0, int((now_dt - start_dt).total_seconds()))
            except Exception:
                pass

        question_eval_objs = [
            QuestionEvaluationResult(**res) for res in evaluated_results
        ]

        return QuizAttemptResultResponse(
            id=attempt["id"],
            quiz_id=attempt["quiz_id"],
            status="submitted",
            started_at=attempt["started_at"],
            submitted_at=now_iso,
            score=score,
            percentage=percentage,
            total_questions=total_questions,
            correct_answers=correct_count,
            incorrect_answers=incorrect_count,
            unanswered=unanswered_count,
            duration_seconds=duration,
            question_results=question_eval_objs
        )
