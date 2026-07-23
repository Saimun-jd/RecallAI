import httpx
import json
import logging
import unicodedata
from app.config import settings
from app.schemas import SectionExtraction, AtomicTopic
from app.llm_providers.factory import get_llm_provider

logger = logging.getLogger(__name__)

SEGMENT_PROMPT = """You are an expert educational content parser, AI tutor, and high-yield flashcard generator.

Task: Analyze the provided section from an academic paper or technical textbook and extract ONLY distinct, high-yield, self-contained atomic concepts suitable for active-recall flashcards.

Rules:

1. UTILITY & HIGH-YIELD ONLY (STRICT FILTERING):
   - ONLY extract non-obvious technical concepts, definitions, formulas, API/code usages, system architectures, or explicit trade-offs/comparisons.
   - DO NOT extract high-level workflow steps, chapter overviews, generic introductions, or meta-process filler.
   - DO NOT extract publisher watermarks, copyright notices, "Early Release" notes, author biographies, or book-specific metadata.
   - REJECT any concept that does not teach a concrete, actionable technical skill, parameter, logic, or formula.

2. ATOMICITY & DEDUPLICATION:
   - Extract distinct technical ideas separately. Do not combine multiple definitions, formulas, or logical steps into a single card.
   - Before finalizing, compare all flashcards generated for this section. If two cards test overlapping information (e.g., one describes a data structure's keys and another describes its shape, but both are really "how MNIST is represented in code"), MERGE them into one card or discard the weaker one.

3. QUESTION-ANSWER QUALITY (CRITICAL):
   - The question must NOT contain the answer or make it guessable by rephrasing. A question that can be answered correctly without knowing the material is invalid.
   - BAD: Q: "How many features does each MNIST image have?" A: "784 features."
     (The question already tells you you're looking for a number of features — no real recall required.)
   - GOOD: Q: "MNIST images are 28x28 pixels. When flattened into a feature vector for Scikit-Learn, how many features does that produce, and what does each feature represent?"
     A: "784 features; each is the grayscale intensity (0-255) of one pixel."
   - BAD: Q: "What is the MNIST dataset primarily known for?" A: "It's a widely-used dataset of 70,000 handwritten digits for ML testing."
     (Too vague — doesn't test a specific retrievable fact.)
   - GOOD: Q: "How many total images does the MNIST dataset contain, and how are they typically split between train/test?"
     A: "70,000 images total; conventionally split into 60,000 train / 10,000 test."
   - Answers must be concise (ideally ≤20 words) and precise — no restating the question, no filler like "it refers to..." or "this is about...".

4. PREFER CLOZE FOR DISCRETE FACTS:
   - If the fact is a number, named parameter, formula, dictionary key, or shape/dimension, use concept_type "Cloze" and write flashcard_question as a cloze-style sentence with the answer blanked out (marked as `[...]`), rather than forcing it into a Q&A pair.
   - Example: flashcard_question: "The Scikit-Learn `fetch_openml` MNIST dict exposes the dataset via three keys: [...], [...], and [...]."
     flashcard_answer: "data, target, DESCR"
   - Use standard Q&A ("Definition", "Formula", "Process Step", "Code Example", "Comparison") for conceptual/explanatory facts that don't reduce to a fill-in-the-blank.

5. SELF-CONTAINED: Write "summary", "flashcard_question", and "flashcard_answer" so they're understandable in isolation. Spell out acronyms on first use.

6. MANDATORY TECHNICAL TERMS: List at least 1-2 specific technical key terms per flashcard. If a concept is too generic to yield specific terms, discard it.

7. NO META-TEXT: Ignore citations, page headers, footers, line numbers, and author names.

8. ASSETS & GROUNDING:
   - Only select `related_code_id` or `related_image_id` from IDs explicitly listed in "Available Assets".
   - If none apply, set both to `null`. NEVER invent placeholder IDs.

9. NO HALLUCINATION:
   - DO NOT copy the MNIST examples provided in Rule 3. They are for illustrative purposes only.
   - If the Section Text contains no extractable, high-yield facts (e.g., it's just raw equations, title pages, or filler), return an EMPTY array for `atomic_topics`. DO NOT invent flashcards.

10. SELF-CHECK BEFORE OUTPUT: For each candidate flashcard, silently verify:
   - Does the question avoid leaking its own answer?
   - Is this fact already covered by another card in this batch?
   - Is the answer free of restated question-text and under ~20 words (unless the concept genuinely requires more)?
   - Would a student who read only the question, without the source text, have to actually recall something rather than infer it from phrasing?
   Discard or rewrite any card that fails these checks. Do not include your reasoning in the output — output only the final valid cards.

11. STRICT JSON: Respond ONLY with a valid JSON object matching the schema below. Every flashcard object must explicitly include all fields, defaulting missing optional values or assets to `null`.

Expected Object Format:
{{
  "section_title": "Section Name",
  "atomic_topics": [
    {{
      "topic_name": "...",
      "concept_type": "Definition | Formula | Process Step | Code Example | Comparison | Cloze",
      "summary": "...",
      "flashcard_question": "...",
      "flashcard_answer": "...",
      "key_terms": ["term1", "term2"],
      "related_code_id": null,
      "related_image_id": null
    }}
  ]
}}

Input Context:
Document Section: {heading_title}

Available Assets:
{assets_context}

Section Text:
<
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


async def extract_atomic_concepts(heading: str, text: str, code_blocks: dict = None, images: dict = None, provider_override: str = None) -> SectionExtraction:
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

    from copy import copy
    local_settings = copy(settings)
    if provider_override:
        local_settings.llm_provider = provider_override

    provider = get_llm_provider(local_settings)
    raw = await provider.generate(
        prompt=prompt,
        json_schema=schema,
        temperature=0.1,
        max_tokens=2048,
    )
    sanitized_raw = _sanitize_llm_response(raw)

    try:
        parsed = json.loads(sanitized_raw)
        
        if isinstance(parsed, list):
            topics = [AtomicTopic(**t) for t in parsed]
            parsed = {"section_title": heading, "atomic_topics": [t.model_dump() for t in topics]}
            
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