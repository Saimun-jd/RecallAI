import logging
from copy import copy
from app.config import settings
from app.llm_providers.factory import get_llm_provider
from langfuse import observe

logger = logging.getLogger(__name__)

CLEANUP_PROMPT = r"""You are an expert markdown editor and technical documentation assistant.

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
7. NEVER modify, remove, or merge `$$...$$` block math or `$...$` inline math.
8. Preserve all `\begin{...}` / `\end{...}` pairs exactly as-is.
9. If you see bare LaTeX commands without delimiters, wrap them in `$$`.
10. LaTeX environments (bmatrix, cases, pmatrix, align) must remain on their own lines.
11. Output ONLY the corrected markdown. Do not add any conversational text before or after (like "Here is the fixed markdown").

Markdown to clean:
\"\"\"
{raw_markdown}
\"\"\"
"""

import re
import uuid

def _chunk_markdown(md_text: str, max_chars: int = 12000) -> list[str]:
    """Split markdown into chunks of roughly ~3000 tokens (12000 chars), preserving LaTeX blocks."""
    placeholders = {}
    
    def repl_block(match):
        ph = f"__LATEX_BLOCK_{uuid.uuid4().hex}__"
        placeholders[ph] = match.group(0)
        return ph

    # Match $$...$$ blocks
    temp_text = re.sub(r'\$\$.*?\$\$', repl_block, md_text, flags=re.DOTALL)
    # Match \begin{...}...\end{...} environments
    temp_text = re.sub(r'\\begin\{([^}]+)\}.*?\\end\{\1\}', repl_block, temp_text, flags=re.DOTALL)

    paragraphs = temp_text.split('\n\n')
    
    chunks = []
    current_chunk = []
    current_len = 0
    
    for p in paragraphs:
        # Restore placeholders in this paragraph
        for ph, orig in placeholders.items():
            if ph in p:
                p = p.replace(ph, orig)
                
        p_len = len(p)
        if current_len + p_len > max_chars and current_chunk:
            chunks.append('\n\n'.join(current_chunk))
            current_chunk = [p]
            current_len = p_len
        else:
            current_chunk.append(p)
            current_len += p_len + 2
            
    if current_chunk:
        chunks.append('\n\n'.join(current_chunk))
        
    return chunks

@observe(name="clean_markdown_with_llm")
async def clean_markdown_with_llm(raw_markdown: str) -> str:
    """Passes raw extracted markdown to the LLM to fix syntax and formatting."""
    local_settings = copy(settings)
    provider = get_llm_provider(local_settings)
    
    chunks = _chunk_markdown(raw_markdown)
    cleaned_chunks = []
    
    logger.info(f"Sending markdown to LLM for cleanup in {len(chunks)} chunk(s)...")
    
    for i, chunk in enumerate(chunks):
        prompt = CLEANUP_PROMPT.format(raw_markdown=chunk)
        try:
            full_prompt = f"System: You are a strict markdown processor. Output ONLY the exact fixed markdown.\n\n{prompt}"
            response_text = await provider.generate(
                prompt=full_prompt,
                json_schema=None
            )
            cleaned_chunks.append(response_text.strip())
        except Exception as e:
            logger.error(f"Error during markdown cleanup of chunk {i+1}/{len(chunks)}: {e}")
            # Fallback to the raw chunk if this chunk fails, to avoid losing everything
            cleaned_chunks.append(chunk.strip())
            
    return '\n\n'.join(cleaned_chunks)
