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
4. ASSETS & GROUNDING:
   - You MUST ONLY select `related_code_id` or `related_image_id` from the IDs explicitly listed in the "Available Assets" section.
   - If "Available Assets" is empty, missing, or contains no relevant asset for a given flashcard, you MUST set `related_code_id` and `related_image_id` to `null`.
   - ZERO HALLUCINATION: NEVER invent, fabricate, or guess placeholder strings like "code_1", "code_block_1", or "image_1" unless that exact string is explicitly listed under "Available Assets".
5. STRICT JSON: Respond ONLY with a valid JSON object matching the requested schema. Every flashcard object must explicitly include `related_code_id` and `related_image_id`, defaulting to `null`.

Expected Object Format Default:
{{
  "summary": "...",
  "flashcard_question": "...",
  "flashcard_answer": "...",
  "related_code_id": null,
  "related_image_id": null
}}

Input Context:
Document Section: {heading_title}

Available Assets:
{assets_context}

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


async def extract_atomic_concepts(heading: str, text: str, code_blocks: dict = None, images: dict = None) -> SectionExtraction:
    code_blocks = code_blocks or {}
    images = images or {}
    
    assets_context = ""
    if code_blocks:
        assets_context += "Code Snippets:\n"
        for c_id, c_data in code_blocks.items():
            assets_context += f"- ID: {c_id}, Language: {c_data['language']}\n"
    if images:
        assets_context += "Images/Diagrams:\n"
        for img_id in images:
            assets_context += f"- ID: {img_id}\n"
            
    if not assets_context:
        assets_context = "None available"

    prompt = SEGMENT_PROMPT.format(
        heading_title=heading, 
        cleaned_section_text=text,
        assets_context=assets_context
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
                "options": {"temperature": 0.1, "num_ctx": 4096},
            },
        )
    r.raise_for_status()

    # Retrieve and sanitize raw string response before parsing JSON
    raw = r.json()["response"]
    sanitized_raw = _sanitize_llm_response(raw)

    try:
        parsed = json.loads(sanitized_raw)
        
        # Post-processing validation to remove hallucinated or invalid asset IDs
        if "atomic_topics" in parsed:
            for topic in parsed["atomic_topics"]:
                c_id = topic.get("related_code_id")
                if c_id not in code_blocks or str(c_id).lower() in ("null", "none", ""):
                    topic["related_code_id"] = None
                
                i_id = topic.get("related_image_id")
                if i_id not in images or str(i_id).lower() in ("null", "none", ""):
                    topic["related_image_id"] = None
                    
        return SectionExtraction(**parsed)
    except (json.JSONDecodeError, TypeError, ValueError) as e:
        logger.error(
            "Failed to parse LLM JSON: %s\nRaw output: %s", e, sanitized_raw
        )
        return SectionExtraction(section_title=heading, atomic_topics=[])