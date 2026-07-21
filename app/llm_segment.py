import httpx
import json
import logging
import unicodedata
from app.config import settings
from app.schemas import SectionExtraction

logger = logging.getLogger(__name__)

SEGMENT_PROMPT = """You are an expert educational content parser and flashcard generator.

Task: Analyze the provided section from an academic paper and extract every distinct, self-contained atomic concept or subtopic suitable for creating flashcards.

Rules:
1. ATOMICITY: Extract distinct ideas separately. Do not combine multiple definitions, formulas, or logical steps into a single topic.
2. SELF-CONTAINED: Write the "summary" and "flashcard_question" so they can be understood without reading the original paper. Spell out acronyms if they appear for the first time.
3. NO META-TEXT: Ignore citations (e.g., [1], [12-15]), page headers, footers, line numbers, and author names.
4. STRICT JSON: Respond ONLY with a valid JSON object matching the provided schema.

Input Context:
Document Section: {heading_title}

Section Text:
<<<
{cleaned_section_text}
>>>
"""


def _sanitize_llm_response(text: str) -> str:
    """Normalize Unicode and replace smart quotes/dashes to prevent encoding artifacts."""
    # Normalize unicode to NFKC
    text = unicodedata.normalize("NFKC", text)

    # Replace smart characters that often break downstream encoding
    replacements = {
        "’": "'",
        "‘": "'",
        "“": '"',
        "”": '"',
        "–": "-",
        "—": "-",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
    }
    for old, new in replacements.items():
        text = text.replace(old, new)

    return text


async def extract_atomic_concepts(heading: str, text: str) -> SectionExtraction:
    prompt = SEGMENT_PROMPT.format(
        heading_title=heading, cleaned_section_text=text
    )
    schema = SectionExtraction.model_json_schema()

    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            f"{settings.ollama_host}/api/generate",
            json={
                "model": settings.ollama_model,
                "prompt": prompt,
                "stream": False,
                "format": schema,
                "options": {"temperature": 0.1, "num_ctx": 8192},
            },
        )
    r.raise_for_status()

    # Retrieve and sanitize raw string response before parsing JSON
    raw = r.json()["response"]
    sanitized_raw = _sanitize_llm_response(raw)

    try:
        parsed = json.loads(sanitized_raw)
        return SectionExtraction(**parsed)
    except (json.JSONDecodeError, TypeError, ValueError) as e:
        logger.error(
            "Failed to parse LLM JSON: %s\nRaw output: %s", e, sanitized_raw
        )
        return SectionExtraction(section_title=heading, atomic_topics=[])