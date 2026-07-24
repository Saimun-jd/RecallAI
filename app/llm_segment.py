import httpx
import json
import logging
import unicodedata
from app.config import settings
from app.schemas import SectionExtraction, AtomicTopic
from app.llm_providers.factory import get_llm_provider

logger = logging.getLogger(__name__)

SEGMENT_PROMPT = """You are an expert educational content parser and AI tutor.

Task: Analyze the provided section from an academic paper or technical textbook and extract ONLY distinct, high-yield, self-contained atomic concepts.

Rules:

1. UTILITY & HIGH-YIELD ONLY (STRICT FILTERING):
   - ONLY extract non-obvious technical concepts, definitions, formulas, API/code usages, system architectures, or explicit trade-offs/comparisons.
   - DO NOT extract high-level workflow steps, chapter overviews, generic introductions, or meta-process filler.
   - REJECT any concept that does not teach a concrete, actionable technical skill, parameter, logic, or formula.

2. ATOMICITY & DEDUPLICATION:
   - Extract distinct technical ideas separately.
   - Before finalizing, compare all extracted concepts for this section. If two concepts are highly overlapping, MERGE them or discard the weaker one.

3. SUMMARY & KEY TERMS:
   - Write a self-contained 1-3 sentence summary for each concept. Spell out acronyms on first use.
   - List at least 1-2 specific technical key terms per concept.

4. ASSETS & GROUNDING:
   - Only select `related_code_id` or `related_image_id` from IDs explicitly listed in "Available Assets".
   - If none apply, set both to `null`. NEVER invent placeholder IDs.

5. STRICT JSON: Respond ONLY with a valid JSON object matching the schema below. Every object must explicitly include all fields.

Expected Object Format:
{{
  "section_title": "Section Name",
  "atomic_topics": [
    {{
      "topic_name": "...",
      "concept_type": "Definition | Formula | Process Step | Code Example | Comparison",
      "summary": "...",
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

FLASHCARD_PROMPT = """You are an expert AI tutor and high-yield flashcard generator.

Task: Analyze the provided topic text and summary, and generate high-yield, active-recall flashcards.

CRITICAL RULE: Generate flashcards ONLY for the concepts explicitly contained within "{topic_name}". Do NOT reference external topics or general concepts unless directly present in the target content above.

Rules:

1. QUESTION-ANSWER QUALITY (CRITICAL):
   - The question must NOT contain the answer or make it guessable by rephrasing.
   - BAD: Q: "How many features does each MNIST image have?" A: "784 features."
   - GOOD: Q: "MNIST images are 28x28 pixels. When flattened into a feature vector for Scikit-Learn, how many features does that produce?" A: "784 features"
   - Answers must be concise (ideally ≤20 words) and precise.
   - Write full, natural questions in the `question` field and concise responses in the `answer` field.

2. CUSTOM INSTRUCTIONS:
   {custom_prompt}

3. STRICT JSON: Respond ONLY with a valid JSON object matching the schema below. CRITICAL: You MUST generate EXACTLY {count} flashcards. Do not generate more or less.

Expected Object Format:
{{
  "flashcards": [
    {{
      "concept_type": "Definition | Formula | Process Step | Code Example | Comparison",
      "question": "...",
      "answer": "...",
      "key_terms": ["term1", "term2"],
      "related_code_id": null,
      "related_image_id": null
    }}
  ]
}}

Input Context:
SECTION HIERARCHY: {breadcrumb}
TARGET TOPIC TITLE: {topic_name}
TARGET TOPIC SUMMARY: {summary}

TARGET TOPIC CONTENT:
<
{topic_text}
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
    except httpx.HTTPError as e:
        # DO NOT SWALLOW connection/LLM provider errors
        raise e
    except Exception as e:
        logger.error(f"Failed to process with LLM. Error: {e}")
        try:
            logger.error(f"Raw response: {sanitized_raw}")
        except:
            pass
        return SectionExtraction(section_title=heading, atomic_topics=[])


async def generate_flashcards_for_topic(
    topic_name: str,
    breadcrumb: str,
    topic_text: str,
    summary: str,
    count: int = 5,
    custom_prompt: str | None = None,
    provider_override: str | None = None
):
    """Generates on-demand flashcards for a specific topic."""
    from app.schemas import FlashcardList
    
    formatted_custom = f"- User Instructions: {custom_prompt}" if custom_prompt else ""
    prompt = FLASHCARD_PROMPT.format(
        breadcrumb=breadcrumb,
        topic_name=topic_name,
        summary=summary,
        topic_text=topic_text,
        count=count,
        custom_prompt=formatted_custom
    )

    try:
        from copy import copy
        local_settings = copy(settings)
        if provider_override:
            local_settings.llm_provider = provider_override
            
        llm = get_llm_provider(local_settings)
        raw_response = await llm.generate(prompt, json_schema=FlashcardList.model_json_schema())
        logger.info(f"Raw flashcard generation response: {raw_response}")
        clean_json_str = _sanitize_llm_response(raw_response)
        
        parsed = json.loads(clean_json_str)
        return FlashcardList.model_validate(parsed)
    except Exception as e:
        logger.error(f"Failed to generate flashcards: {e}")
        return FlashcardList(flashcards=[])