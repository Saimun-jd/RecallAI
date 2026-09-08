import re

import uuid

def clean_heading_title(raw_title: str) -> str:
    """Cleans OCR artifacts, arrows, bullet markers, and trailing colons from heading titles."""
    if not raw_title:
        return ""
    # Strip leading markdown hashes if any were passed
    cleaned = re.sub(r'^#{1,6}\s*', '', raw_title).strip()
    # Remove leading decorative symbols commonly produced by OCR on handwritten notes
    cleaned = re.sub(r'^[→★□•\-\*\>\►\s]+', '', cleaned).strip()
    # Remove trailing colons, slashes, punctuation
    cleaned = re.sub(r'[\/:\s]+$', '', cleaned).strip()
    return cleaned or raw_title


def detect_headings(md_text: str, start_page_num: int) -> list[dict]:
    sections = []
    current_heading = "Introduction"
    current_level = 1
    current_page = start_page_num
    heading_page = start_page_num
    current_text = []
    
    # Temporarily replace LaTeX blocks with placeholders to prevent splitting them
    placeholders = {}
    
    def repl_block(match):
        ph = f"__LATEX_BLOCK_{uuid.uuid4().hex}__"
        placeholders[ph] = match.group(0)
        return ph

    # Match $$...$$ blocks
    temp_text = re.sub(r'\$\$.*?\$\$', repl_block, md_text, flags=re.DOTALL)
    # Match \begin{...}...\end{...} environments
    temp_text = re.sub(r'\\begin\{([^}]+)\}.*?\\end\{\1\}', repl_block, temp_text, flags=re.DOTALL)
    
    # Split the markdown into blocks
    blocks = temp_text.split('\n\n')
    
    for block in blocks:
        # Restore placeholders in this block
        for ph, orig in placeholders.items():
            if ph in block:
                block = block.replace(ph, orig)
                
        block = block.strip()
        if not block:
            continue
            
        # Check for Marker page delimiters: {0}------------------------------------------------
        marker_page_m = re.match(r'^\{(\d+)\}-+$', block)
        if marker_page_m:
            page_idx = int(marker_page_m.group(1))
            current_page = start_page_num + page_idx
            continue

        # Also check if block starts with Marker page delimiter followed by content
        if re.match(r'^\{(\d+)\}-+\n', block):
            m_prefix = re.match(r'^\{(\d+)\}-+\n+(.*)', block, flags=re.DOTALL)
            if m_prefix:
                page_idx = int(m_prefix.group(1))
                current_page = start_page_num + page_idx
                block = m_prefix.group(2).strip()
                if not block:
                    continue

        # pymupdf4llm usually separates pages with -----
        if block == '-----':
            current_page += 1
            continue
            
        lines = block.split('\n')
        first_line = lines[0].strip()
        # Check if first line of block is a markdown heading
        m = re.match(r'^(#{1,6})\s+(.*)', first_line)
        if m:
            if current_text:
                sections.append({
                    "heading": current_heading, 
                    "clean_title": clean_heading_title(current_heading),
                    "level": current_level,
                    "text": "\n\n".join(current_text),
                    "page_num": heading_page
                })
            current_level = len(m.group(1))
            current_heading = m.group(2).strip()
            heading_page = current_page
            rest = "\n".join(lines[1:]).strip()
            current_text = [rest] if rest else []
        else:
            current_text.append(block)
                
    if current_text:
        sections.append({
            "heading": current_heading, 
            "clean_title": clean_heading_title(current_heading),
            "level": current_level,
            "text": "\n\n".join(current_text),
            "page_num": heading_page
        })
        
    try:
        from app.toc_parser import is_cover_title, is_noise_heading
        valid_sections = [
            s for s in sections 
            if not is_cover_title(s["clean_title"], page_num=s.get("page_num", 1))
            and not is_noise_heading(s["clean_title"], page_num=s.get("page_num", 1))
        ]
        return valid_sections if valid_sections else sections
    except Exception:
        return sections