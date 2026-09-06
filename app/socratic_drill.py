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
import re
import unicodedata
from copy import copy
from typing import Optional

from app.config import settings
from app.llm_providers.factory import get_llm_provider
from app.schemas import DiagnosticQuestionSet, DiagnosticEvaluation
from langfuse import observe

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
- Escape any newlines inside your JSON strings as \\n. Do NOT use literal newlines inside strings.

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
{concept_focus_block}
Topic Content:
<
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

{concept_focus_block}
--- CONTEXT ---

Question Asked:
{question_text}

Key Invariants the student should have addressed:
{key_invariants}

Source Material (Ground Truth):
<
{topic_content}
>>>

--- STUDENT'S ANSWER ---
<
{student_answer}
>>>
"""

# ─── JSON Repair Pipeline ────────────────────────────────────────────────
#
# LLM providers are asked for "STRICT JSON" but nothing actually guarantees
# it. The failure modes we defend against here:
#   1. Response wrapped in a ```json ... ``` markdown fence.
#   2. Leading/trailing commentary around the JSON object.
#   3. Smart quotes / unicode punctuation instead of ASCII.
#   4. Invalid backslash escapes — most commonly raw LaTeX in math content
#      (\ne, \frac{}{}, \begin{cases}, etc.) that isn't a legal JSON escape.
#   5. Literal (unescaped) newlines/tabs inside a string value.
#   6. Trailing commas before a closing } or ].
#   7. Truncated JSON from hitting max_tokens mid-generation.
#
# All string-aware repairs track quote/escape state themselves rather than
# using naive regexes, so they don't corrupt legitimate content.

_VALID_JSON_ESCAPES = set('"\\/bfnrtu')

_SMART_QUOTE_MAP = {
    "\u2018": "'", "\u2019": "'",
    "\u201c": '"', "\u201d": '"',
    "\u2013": "-", "\u2014": "-",
}


def _sanitize_llm_response(text: str) -> str:
    """Normalize Unicode and replace smart quotes/dashes."""
    text = unicodedata.normalize("NFKC", text)
    for old, new in _SMART_QUOTE_MAP.items():
        text = text.replace(old, new)
    return text


def _extract_json_block(text: str) -> str:
    """
    Pull the JSON object out of a response that may be wrapped in a
    markdown code fence and/or have leading/trailing commentary.

    Strips a ```json ... ``` fence if present, then finds the first '{'
    and walks forward tracking string state and brace depth (so braces
    inside string values don't throw off the count) to locate the
    matching closing '}'.
    """
    text = text.strip()

    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()

    start = text.find("{")
    if start == -1:
        return text  # nothing that looks like JSON — let json.loads raise a clear error

    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]

    # Unbalanced (likely truncated) — return what we have and let the
    # truncation-repair pass in _parse_llm_json attempt to close it.
    return text[start:]


def _repair_json_escapes(text: str) -> str:
    """
    Walk the text and, only inside string literals:
      - escape any backslash that isn't starting a legal JSON escape
        sequence (fixes raw LaTeX like \\ne, \\frac, \\begin{cases})
      - escape any raw control character (newline/tab/CR) the LLM
        emitted literally instead of as \\n / \\t / \\r

    Everything outside string literals (structural braces, commas, etc.)
    is left untouched.
    """
    out = []
    in_string = False
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]

        if not in_string:
            out.append(ch)
            if ch == '"':
                in_string = True
            i += 1
            continue

        if ch == '"':
            out.append(ch)
            in_string = False
            i += 1
        elif ch == "\\":
            nxt = text[i + 1] if i + 1 < n else ""
            if nxt in _VALID_JSON_ESCAPES:
                out.append(ch)
                out.append(nxt)
                i += 2
            else:
                # Not a legal JSON escape — treat the backslash as literal.
                out.append("\\\\")
                i += 1
        elif ch == "\n":
            out.append("\\n")
            i += 1
        elif ch == "\t":
            out.append("\\t")
            i += 1
        elif ch == "\r":
            out.append("\\r")
            i += 1
        else:
            out.append(ch)
            i += 1

    return "".join(out)


def _remove_trailing_commas(text: str) -> str:
    return re.sub(r",(\s*[}\]])", r"\1", text)


def _attempt_close_truncated_json(text: str) -> str:
    """
    Best-effort recovery for JSON truncated mid-generation (e.g. the
    response hit max_tokens). Closes any unterminated string, then
    appends closing brackets to match whatever { / [ were left open, in
    reverse order. Not guaranteed to yield complete or fully correct
    data — just gives json.loads a chance to return something parseable
    instead of failing outright.
    """
    in_string = False
    escape = False
    stack = []
    for ch in text:
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch in "{[":
            stack.append(ch)
        elif ch in "}]":
            if stack:
                stack.pop()

    repaired = text
    if in_string:
        repaired += '"'
    for opener in reversed(stack):
        repaired += "}" if opener == "{" else "]"
    return repaired


def _parse_llm_json(raw: str, context: str) -> dict:
    """
    Best-effort robust parse of an LLM's JSON response. Applies the
    repair pipeline, tries a straight parse, and if that fails, tries
    once more after attempting to close truncated brackets. Raises
    ValueError with the original raw text logged if everything fails.
    """
    text = _sanitize_llm_response(raw)
    text = _extract_json_block(text)
    text = _repair_json_escapes(text)
    text = _remove_trailing_commas(text)

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning(f"{context}: JSON parse failed ({e}); attempting truncation repair")
        try:
            closed = _attempt_close_truncated_json(text)
            closed = _remove_trailing_commas(closed)
            return json.loads(closed)
        except json.JSONDecodeError as e2:
            logger.error(f"{context}: failed to parse LLM JSON after repairs: {e2}")
            logger.error(f"Raw response (first 1000 chars): {raw[:1000]}")
            raise ValueError(f"LLM returned invalid JSON: {e2}") from e2


async def _generate_and_parse(
    provider,
    prompt: str,
    schema: dict,
    temperature: float,
    max_tokens: int,
    context: str,
    max_attempts: int = 2,
) -> dict:
    """
    Calls the LLM provider and parses its response as JSON. Retries once
    (by default) with a stricter follow-up prompt if a response comes
    back unparseable, and separately handles the provider call itself
    failing (network/timeout/API error). Raises ValueError with a clear,
    logged message if every attempt is exhausted.
    """
    last_error: Optional[Exception] = None
    current_prompt = prompt

    for attempt in range(1, max_attempts + 1):
        try:
            raw = await provider.generate(
                prompt=current_prompt,
                json_schema=schema,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except Exception as e:
            logger.error(f"{context}: LLM provider call failed on attempt {attempt}/{max_attempts}: {e}")
            last_error = e
            continue

        try:
            return _parse_llm_json(raw, context=context)
        except ValueError as e:
            logger.warning(f"{context}: attempt {attempt}/{max_attempts} produced unparseable JSON: {e}")
            last_error = e
            current_prompt = (
                prompt
                + "\n\nIMPORTANT: Your previous response was not valid JSON "
                  f"({e}). Respond ONLY with a single valid JSON object — "
                  "no markdown fences, no commentary. Escape every backslash "
                  "(including in LaTeX/math notation) and every newline "
                  "inside string values."
            )
            continue

    raise ValueError(
        f"{context}: LLM did not return valid JSON after {max_attempts} attempt(s): {last_error}"
    )


@observe(name="generate_diagnostic_questions", as_type="span")
async def generate_diagnostic_questions(
    topic_title: str,
    breadcrumb: str,
    start_page: int,
    topic_content: str,
    concept_name: Optional[str] = None,
    concept_type: Optional[str] = None,
    concept_summary: Optional[str] = None,
    key_terms: Optional[list[str]] = None,
    provider_override: Optional[str] = None,
) -> DiagnosticQuestionSet:
    """Generate 2 tiered probing questions for a topic or a specific atomic concept."""
    import re
    # Strip image URLs and tags from topic content so we don't spam the LLM
    clean_topic_content = re.sub(r'!\[.*?\]\(.*?\)', '', topic_content)
    clean_topic_content = re.sub(r'<img.*?>', '', clean_topic_content)
    
    from app.markdown_slicer import extract_concept_ground_truth
    
    if concept_name:
        terms_str = ", ".join(key_terms) if key_terms else concept_name
        concept_focus_block = f"""
--- TARGET ATOMIC CONCEPT (MANDATORY DRILL FOCUS) ---
Target Concept Name: {concept_name}
Target Concept Type: {concept_type or 'General Concept'}
Concept Summary: {concept_summary or 'N/A'}
Key Terms: {terms_str}

CRITICAL CONCEPT FOCUS RULES:
1. Both generated questions MUST focus specifically on testing the student's mastery of "{concept_name}".
2. Question 1 ("causal_mechanism") MUST test WHY and HOW the mechanism of "{concept_name}" functions.
3. Question 2 ("counterfactual" or "applied_scenario") MUST test edge cases, broken assumptions, or applied trade-offs of "{concept_name}".
4. Do NOT ask general questions about unrelated parts of the chapter. Use the broader Topic Content below only as reference context.
"""
        ground_truth_content = extract_concept_ground_truth(
            clean_topic_content,
            concept_name=concept_name,
            concept_summary=concept_summary,
            key_terms=key_terms,
            max_chars=7000,
        )
    else:
        concept_focus_block = ""
        ground_truth_content = clean_topic_content[:8000]

    prompt = QUESTION_GEN_PROMPT.format(
        topic_title=topic_title,
        breadcrumb=breadcrumb or "N/A",
        start_page=start_page,
        concept_focus_block=concept_focus_block,
        topic_content=ground_truth_content,
    )

    schema = DiagnosticQuestionSet.model_json_schema()
    local_settings = copy(settings)
    provider = get_llm_provider(local_settings, provider_override=provider_override)

    try:
        parsed = await _generate_and_parse(
            provider, prompt, schema,
            temperature=0.3, max_tokens=2048,
            context="generate_diagnostic_questions",
        )
    except ValueError as e:
        logger.error(f"Failed to parse drill questions: {e}")
        raise ValueError(f"LLM returned invalid question format: {e}")

    try:
        if concept_name and "concept_name" not in parsed:
            parsed["concept_name"] = concept_name
        return DiagnosticQuestionSet(**parsed)
    except Exception as e:
        logger.error(f"generate_diagnostic_questions: JSON parsed but failed schema validation: {e}")
        logger.error(f"Parsed JSON (first 1000 chars): {json.dumps(parsed)[:1000]}")
        raise ValueError(f"LLM returned invalid question format: {e}")


@observe(name="evaluate_student_answer", as_type="span")
async def evaluate_student_answer(
    question_text: str,
    key_invariants: list[str],
    topic_content: str,
    student_answer: str,
    concept_name: Optional[str] = None,
    concept_summary: Optional[str] = None,
    key_terms: Optional[list[str]] = None,
    provider_override: Optional[str] = None,
) -> DiagnosticEvaluation:
    """Evaluate a student's free-form answer using ASAG."""
    import re
    from app.markdown_slicer import extract_concept_ground_truth

    clean_topic_content = re.sub(r'!\[.*?\]\(.*?\)', '', topic_content)
    clean_topic_content = re.sub(r'<img.*?>', '', clean_topic_content)

    if concept_name:
        concept_focus_block = f"""
--- TARGET ATOMIC CONCEPT ---
Target Concept Evaluated: {concept_name}
Grade the student's explanation against this specific concept's core principles and invariants.
"""
        ground_truth_content = extract_concept_ground_truth(
            clean_topic_content,
            concept_name=concept_name,
            concept_summary=concept_summary,
            key_terms=key_terms,
            max_chars=7000,
        )
    else:
        concept_focus_block = ""
        ground_truth_content = clean_topic_content[:8000]

    prompt = EVALUATION_PROMPT.format(
        question_text=question_text,
        key_invariants=json.dumps(key_invariants),
        concept_focus_block=concept_focus_block,
        topic_content=ground_truth_content,
        student_answer=student_answer,
    )

    schema = DiagnosticEvaluation.model_json_schema()
    local_settings = copy(settings)
    provider = get_llm_provider(local_settings, provider_override=provider_override)

    try:
        parsed = await _generate_and_parse(
            provider, prompt, schema,
            temperature=0.1, max_tokens=2048,
            context="evaluate_student_answer",
        )
    except ValueError as e:
        logger.error(f"Failed to parse drill evaluation: {e}")
        raise ValueError(f"LLM returned invalid evaluation format: {e}")

    try:
        if concept_name and "concept_name" not in parsed:
            parsed["concept_name"] = concept_name
        return DiagnosticEvaluation(**parsed)
    except Exception as e:
        logger.error(f"evaluate_student_answer: JSON parsed but failed schema validation: {e}")
        logger.error(f"Parsed JSON (first 1000 chars): {json.dumps(parsed)[:1000]}")
        raise ValueError(f"LLM returned invalid evaluation format: {e}")