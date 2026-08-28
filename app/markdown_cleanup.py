import logging
from copy import copy
from app.config import settings
from app.llm_providers.factory import get_llm_provider
from langfuse import observe

logger = logging.getLogger(__name__)

CLEANUP_PROMPT = """You are an expert markdown editor and technical documentation assistant.

Task:
You will be provided with raw Markdown text extracted from a PDF. Because it was extracted by OCR or PDF parsing tools, it may contain broken formatting, syntax errors, artifacts, random line breaks in the middle of sentences, and incorrectly formed markdown tables.

Your job is to cleanly format, correct, and fix the markdown without changing its meaning, content, or losing any information.

Rules:
1. Fix broken markdown tables into valid markdown syntax.
2. Fix broken lists and bullet points.
3. Remove errant page numbers, headers, and footers if they randomly appear.
4. Join sentences that were improperly split across lines.
5. Fix OCR typos if they are obvious (e.g. "lntelligence" -> "Intelligence").
6. Maintain ALL original image links like `![image](path)`. Do not remove them.
7. Output ONLY the corrected markdown. Do not add any conversational text before or after (like "Here is the fixed markdown").

Markdown to clean:
\"\"\"
{raw_markdown}
\"\"\"
"""

@observe(name="clean_markdown_with_llm")
async def clean_markdown_with_llm(raw_markdown: str) -> str:
    """Passes raw extracted markdown to the LLM to fix syntax and formatting."""
    local_settings = copy(settings)
    provider = get_llm_provider(local_settings)
    
    prompt = CLEANUP_PROMPT.format(raw_markdown=raw_markdown)
    
    logger.info("Sending markdown to LLM for cleanup...")
    try:
        # Ensure the system instruction is included in the prompt, since the base interface doesn't take system_instruction
        full_prompt = f"System: You are a strict markdown processor. Output ONLY the exact fixed markdown.\n\n{prompt}"
        response_text = await provider.generate(
            prompt=full_prompt,
            json_schema=None
        )
        return response_text.strip()
    except Exception as e:
        logger.error(f"Error during markdown cleanup: {e}")
        raise
