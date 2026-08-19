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
<<<
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

2. FORMATTING & MATHEMATICS:
   - ALL text MUST be strictly formatted in Markdown.
   - EVERY SINGLE math variable, equation, or vector MUST be wrapped in LaTeX `$` delimiters. Example: `$u = [u_1, u_2]$`. NEVER write math plain-text like `u = [u1]`.
   - Use `$` for inline math and `$$` for block math.
   - For code blocks, use fenced code blocks (```language). You MUST use proper newlines (`\\n`) within the JSON string. NEVER output a code block on a single line. Example: "```python\\nimport os\\n```".
   - Use bold text for emphasis when appropriate.

3. CUSTOM INSTRUCTIONS:
   {custom_prompt}

4. STRICT JSON: Respond ONLY with a valid JSON object matching the schema below. CRITICAL: You MUST generate EXACTLY {count} flashcards. Do not generate more or less.

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
    """Fix LLM JSON output so that LaTeX backslashes survive json.loads().

    Problem: LLMs write \textbf inside JSON strings.  JSON spec says \t is
    a tab, so json.loads() silently eats the backslash, producing <TAB>extbf.
    Same for \b (backspace), \f (form-feed), \n (newline), \r (CR).

    Solution: Before calling json.loads(), scan the raw JSON string and
    double-escape every backslash that is followed by a letter sequence that
    forms a LaTeX command so json.loads() produces the literal \textbf, etc.
    """
    import re

    # Normalize unicode to NFKC
    text = unicodedata.normalize("NFKC", text)

    # Replace smart quotes/dashes
    smart_chars = {
        "\u2018": "'", "\u2019": "'",
        "\u201c": '"', "\u201d": '"',
        "\u2013": "-", "\u2014": "-",
    }
    for old, new in smart_chars.items():
        text = text.replace(old, new)

    # ── Core fix: re-escape LaTeX backslashes before json.loads() ──
    #
    # Step 1: Protect already-correct double backslashes (\\textbf is fine)
    PLACEHOLDER = "\x00DBLBS\x00"
    text = text.replace("\\\\", PLACEHOLDER)

    # Step 2: Any remaining single backslash followed by 2+ letters is a
    #         LaTeX command the LLM forgot to double-escape.
    #         \t alone (JSON tab) has only 1 char after \, so it won't match.
    #         \textbf has 5 chars after \, so it WILL match → becomes \\textbf.
    text = re.sub(r'\\([a-zA-Z]{2,})', lambda m: "\\\\" + m.group(1), text)

    # Step 3: Restore the protected double backslashes
    text = text.replace(PLACEHOLDER, "\\\\")
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
    provider = get_llm_provider(local_settings, provider_override=provider_override)

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
        llm = get_llm_provider(local_settings, provider_override=provider_override)
        raw_response = await llm.generate(prompt, json_schema=FlashcardList.model_json_schema())
        logger.info(f"Raw flashcard generation response: {raw_response}")
        clean_json_str = _sanitize_llm_response(raw_response)
        
        parsed = json.loads(clean_json_str)
        return FlashcardList.model_validate(parsed)
    except Exception as e:
        logger.error(f"Failed to generate flashcards: {e}")
        return FlashcardList(flashcards=[])

from pydantic import BaseModel
class TopicSummary(BaseModel):
    summary: str

SUMMARY_PROMPT = """
You are an expert tutor. Your task is to generate a detailed, structured Markdown summary of the following text from a textbook topic.
The summary should serve as comprehensive study notes for a student.
Format your notes using Markdown headings, bullet points, and bold text for emphasis.
CRITICAL: If there are mathematical formulas or equations, format them strictly using Markdown LaTeX. Use `$` for inline math (e.g. `$E = mc^2$`) and `$$` for block math.

TOPIC TITLE: {heading_title}
TOPIC CONTENT:
<
{text}
>
"""

async def generate_topic_summary(heading: str, text: str, provider_override: str = None) -> str:
    prompt = SUMMARY_PROMPT.format(heading_title=heading, text=text)
    
    from copy import copy
    local_settings = copy(settings)
    provider = get_llm_provider(local_settings, provider_override=provider_override)
    raw = await provider.generate(
        prompt=prompt,
        json_schema=TopicSummary.model_json_schema(),
        temperature=0.3,
        max_tokens=4000,
    )
    sanitized_raw = _sanitize_llm_response(raw)

    try:
        import json
        parsed = json.loads(sanitized_raw)
        summary = parsed.get("summary", "")
        if isinstance(summary, dict) or isinstance(summary, list):
            summary = json.dumps(summary)
        return str(summary)
    except Exception as e:
        logger.error(f"Failed to process summary with LLM. Error: {e}")
        return ""


# ─── PDF Annotation: AI Explanation ───
EXPLAIN_PROMPT = """You are an expert tutor. A student has highlighted a passage from their textbook.

HIGHLIGHTED TEXT:
<
{selected_text}
>>>

STUDENT'S INSTRUCTION: {custom_prompt}

RULES (in order of priority):
1. The STUDENT'S INSTRUCTION is your primary directive. Follow it exactly — including any
   constraints on length, tone, format, depth, or structure (e.g. "one sentence," "no bullet
   points," "ELI5," "quiz me," "compare to X"). Do not add explanation, framing, or structure
   the student did not ask for.
2. If STUDENT'S INSTRUCTION is empty, missing, or purely generic (e.g. "explain this"),
   default to: a clear, complete explanation of the HIGHLIGHTED TEXT using Markdown headings,
   bullet points, and bold for key terms.
3. Stay grounded in the HIGHLIGHTED TEXT. Do not introduce outside claims or tangents unless
   the student's instruction explicitly asks you to connect it to something else.
4. If the STUDENT'S INSTRUCTION is unrelated to the HIGHLIGHTED TEXT or asks you to do
   something outside tutoring on this passage (e.g. write unrelated content, do their
   homework for them), politely redirect: briefly note the mismatch and offer to explain the
   highlighted passage instead.

FORMATTING (apply only where relevant, and only if not overridden by the student's instruction):
- ALL output MUST be strictly formatted in Markdown.
- Mathematical formulas: LaTeX, `$` inline / `$$` block. Ensure you use standard Markdown math blocks.
- Code: fenced code blocks with language tags (e.g., ```python).
"""

FLASHCARD_FROM_SELECTION_PROMPT = """You are an expert educational content creator. Generate exactly {count} high-quality flashcards from the following highlighted textbook passage.

HIGHLIGHTED TEXT:
<<<
{selected_text}
>>>

ADDITIONAL INSTRUCTION: {custom_prompt}

Rules:
1. Each flashcard should test a single, distinct concept from the passage.
2. Questions should be specific and unambiguous.
3. Answers should be concise but complete.
4. ALL text MUST be strictly formatted in Markdown.
5. EVERY SINGLE math variable, equation, or vector MUST be wrapped in LaTeX `$` delimiters. Example: `$u = [u_1, u_2]$`. NEVER write math plain-text.
6. Because you are outputting JSON, you MUST double-escape all LaTeX backslashes! (e.g., `\\alpha` instead of `\alpha`, `\\mathbf` instead of `\mathbf`).
7. Use fenced code blocks with language tags for code (e.g., ```python\ncode\n```). Use proper newlines (`\n`) within the JSON string.

Respond ONLY with a valid JSON object matching this schema:
{{
  "flashcards": [
    {{
      "question": "...",
      "answer": "..."
    }}
  ]
}}
"""

async def explain_selected_text(selected_text: str, custom_prompt: str = None, provider_override: str = None) -> str:
    """Call the LLM with the EXPLAIN_PROMPT and return the raw Markdown response."""
    prompt = EXPLAIN_PROMPT.format(
        selected_text=selected_text,
        custom_prompt=custom_prompt or "Explain this clearly and in detail."
    )
    
    from copy import copy
    local_settings = copy(settings)
    provider = get_llm_provider(local_settings, provider_override=provider_override)
    
    # Free-form text generation — no JSON schema
    raw = await provider.generate(
        prompt=prompt,
        json_schema=None,
        temperature=0.4,
        max_tokens=4000,
    )
    return raw.strip()


async def generate_flashcards_from_selection(selected_text: str, count: int = 5, custom_prompt: str = None, provider_override: str = None) -> list:
    """Generate flashcards from a highlighted PDF text selection."""
    prompt = FLASHCARD_FROM_SELECTION_PROMPT.format(
        selected_text=selected_text,
        count=count,
        custom_prompt=custom_prompt or "Focus on the key concepts."
    )
    
    from copy import copy
    local_settings = copy(settings)
    provider = get_llm_provider(local_settings, provider_override=provider_override)
    
    from app.schemas import SimpleFlashcardList
    raw = await provider.generate(
        prompt=prompt,
        json_schema=SimpleFlashcardList.model_json_schema(),
        temperature=0.3,
        max_tokens=4000,
    )
    sanitized = _sanitize_llm_response(raw)
    
    try:
        import json
        parsed = json.loads(sanitized)
        return parsed.get("flashcards", [])
    except Exception as e:
        logger.error(f"Failed to parse flashcards from selection. Error: {e}")
        return []
