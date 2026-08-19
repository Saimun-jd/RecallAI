"""
Socratic Diagnostic Drill — Question Generation & Answer Evaluation

Uses the configured LLM provider to:
1. Generate 2 tiered probing questions from topic content.
2. Evaluate a student's free-form answer against the source material,
   diagnosing strengths, gaps, misconceptions, and suggesting
   0-2 targeted flashcards.
"""

import json
import logging
import unicodedata
from copy import copy
from typing import Optional

from app.config import settings
from app.llm_providers.factory import get_llm_provider
from app.schemas import DiagnosticQuestionSet, DiagnosticEvaluation

logger = logging.getLogger(__name__)

# ─── Prompt: Question Generation ────────────────────────────────────────

QUESTION_GEN_PROMPT = """You are an expert Socratic examiner and educational assessment designer.

Task: Given the following topic from a textbook/technical document, generate EXACTLY 2 probing diagnostic questions that test DEEP causal understanding — not surface-level recall.

Question Tier Definitions:
1. "causal_mechanism" — Tests WHY something works the way it does. The student must explain the internal mechanism, not just state the definition.
   Example verb starters: "Explain why...", "What mechanism ensures...", "How does X achieve Y..."
2. "counterfactual" — Tests understanding of BOUNDARIES and FAILURE MODES. The student must reason about what happens when assumptions break.
   Example verb starters: "What would happen if...", "Why can't we simply...", "Under what conditions does X fail..."
3. "applied_scenario" — Tests ability to TRANSFER knowledge to a new context or compare trade-offs.
   Example verb starters: "Given a system that needs...", "Compare the trade-offs of...", "Debug the following design..."

Rules:
- Generate exactly 2 questions. The first MUST be "causal_mechanism". The second should be either "counterfactual" or "applied_scenario" depending on which is more appropriate for the content.
- Each question must have 2-4 "key_invariants": the core concepts the student MUST demonstrate to earn full marks.
- Each question must have a "socratic_hint": a leading sub-question that nudges the student toward the answer WITHOUT revealing it.
- Questions must be specific to the provided content, not generic.
- Do NOT ask simple definition or recall questions (e.g. "What is X?", "List the steps of Y").
- Set reference_page to the start_page of the topic if available.

STRICT JSON: Respond ONLY with a valid JSON object matching this schema:
{{
  "topic_title": "...",
  "questions": [
    {{
      "id": "q1",
      "tier": "causal_mechanism",
      "question_text": "...",
      "key_invariants": ["invariant1", "invariant2"],
      "socratic_hint": "...",
      "reference_page": null
    }}
  ]
}}

Topic Title: {topic_title}
Topic Breadcrumb: {breadcrumb}
Start Page: {start_page}

Topic Content:
<<<
{topic_content}
>>>
"""

# ─── Prompt: Answer Evaluation ──────────────────────────────────────────

EVALUATION_PROMPT = """You are an expert educational diagnostic evaluator performing Automated Short Answer Grading (ASAG).

Task: Evaluate the student's answer to a probing question about a textbook topic. Compare their response against the source material (ground truth) and produce a structured diagnostic evaluation.

Evaluation Dimensions:
1. CORE INVARIANTS COVERAGE: Did the student identify the 2-4 non-negotiable principles?
2. CAUSAL VALIDITY: Is their chain of reasoning logically sound, or based on surface correlation?
3. MISCONCEPTION DETECTION: Identify any actively incorrect beliefs. Distinguish between:
   - "Omission" (they didn't mention it) → goes into diagnosed_gaps
   - "Active error" (they stated something factually wrong) → goes into misconceptions

Scoring Guide:
- 85-100 (mastered): Correctly identifies all key invariants with sound causal reasoning. Minor omissions only.
- 60-84 (developing): Gets the core idea right but misses important nuances or secondary mechanisms.
- 35-59 (fragile): Partially correct but has significant gaps or shallow understanding.
- 0-34 (misconception): Contains one or more fundamental conceptual errors.

Flashcard Generation Rules:
- Generate 0 flashcards if mastery_score >= 85 (the student already knows this).
- Generate 1 flashcard if mastery_score is 60-84, targeting the most important gap.
- Generate 1-2 flashcards if mastery_score < 60, targeting the diagnosed misconceptions.
- Each flashcard question should be specific and test the exact gap identified.
- Flashcard answers must be concise (under 30 words).

Socratic Nudge Rules:
- If mastery_score >= 60, provide a follow-up thinking prompt that pushes the student to consider an edge case or deeper implication they missed.
- If mastery_score < 60, set socratic_nudge to null (they need to re-study first).

STRICT JSON: Respond ONLY with a valid JSON object matching this schema:
{{
  "mastery_score": 75,
  "status": "developing",
  "strengths": ["Correctly identified X", "Good explanation of Y"],
  "diagnosed_gaps": ["Did not mention Z", "Missed the role of W"],
  "misconceptions": ["Incorrectly stated that A causes B"],
  "socratic_nudge": "You explained the basic case well, but what happens when...",
  "suggested_flashcards": [
    {{
      "question": "...",
      "answer": "...",
      "gap_source": "Student omitted the role of X in Y"
    }}
  ]
}}

--- CONTEXT ---

Question Asked:
{question_text}

Key Invariants the student should have addressed:
{key_invariants}

Source Material (Ground Truth):
<<<
{topic_content}
>>>

--- STUDENT'S ANSWER ---
<<<
{student_answer}
>>>
"""


def _sanitize_llm_response(text: str) -> str:
    """Normalize Unicode and replace smart quotes/dashes."""
    text = unicodedata.normalize("NFKC", text)
    replacements = {
        "\u2018": "'", "\u2019": "'",
        "\u201c": '"', "\u201d": '"',
        "\u2013": "-", "\u2014": "-",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


async def generate_diagnostic_questions(
    topic_title: str,
    breadcrumb: str,
    start_page: int,
    topic_content: str,
    provider_override: Optional[str] = None,
) -> DiagnosticQuestionSet:
    """Generate 2 tiered probing questions for a topic."""
    prompt = QUESTION_GEN_PROMPT.format(
        topic_title=topic_title,
        breadcrumb=breadcrumb or "N/A",
        start_page=start_page,
        topic_content=topic_content[:8000],  # cap to avoid token limits
    )

    schema = DiagnosticQuestionSet.model_json_schema()
    local_settings = copy(settings)
    provider = get_llm_provider(local_settings, provider_override=provider_override)

    raw = await provider.generate(
        prompt=prompt,
        json_schema=schema,
        temperature=0.3,
        max_tokens=2048,
    )
    sanitized = _sanitize_llm_response(raw)

    try:
        parsed = json.loads(sanitized)
        return DiagnosticQuestionSet(**parsed)
    except Exception as e:
        logger.error(f"Failed to parse drill questions: {e}")
        logger.error(f"Raw response: {sanitized[:500]}")
        raise ValueError(f"LLM returned invalid question format: {e}")


async def evaluate_student_answer(
    question_text: str,
    key_invariants: list[str],
    topic_content: str,
    student_answer: str,
    provider_override: Optional[str] = None,
) -> DiagnosticEvaluation:
    """Evaluate a student's free-form answer using ASAG."""
    prompt = EVALUATION_PROMPT.format(
        question_text=question_text,
        key_invariants=json.dumps(key_invariants),
        topic_content=topic_content[:8000],
        student_answer=student_answer,
    )

    schema = DiagnosticEvaluation.model_json_schema()
    local_settings = copy(settings)
    provider = get_llm_provider(local_settings, provider_override=provider_override)

    raw = await provider.generate(
        prompt=prompt,
        json_schema=schema,
        temperature=0.1,
        max_tokens=2048,
    )
    sanitized = _sanitize_llm_response(raw)

    try:
        parsed = json.loads(sanitized)
        return DiagnosticEvaluation(**parsed)
    except Exception as e:
        logger.error(f"Failed to parse drill evaluation: {e}")
        logger.error(f"Raw response: {sanitized[:500]}")
        raise ValueError(f"LLM returned invalid evaluation format: {e}")
