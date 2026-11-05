import re

import uuid

def clean_heading_title(raw_title: str) -> str:
    """Cleans OCR artifacts, arrows, bullet markers, markdown syntax, and escaped characters from heading titles."""
    if not raw_title:
        return ""
    cleaned = raw_title.strip()

    # Strip leading markdown hashes if any were passed
    cleaned = re.sub(r'^#{1,6}\s*', '', cleaned).strip()

    # Unescape markdown / LaTeX backslashes: \$ -> $, \* -> *, \_ -> _, etc.
    cleaned = re.sub(r'\\([\\`*_{}\[\]()#+\-.!$~<>|])', r'\1', cleaned)

    # Strip markdown bold, italics, code, and strikethrough wrappers
    cleaned = re.sub(r'^\*{1,3}(.*?)\*{1,3}$', r'\1', cleaned).strip()
    cleaned = re.sub(r'^_{1,3}(.*?)_{1,3}$', r'\1', cleaned).strip()
    cleaned = re.sub(r'^`+(.*?)`+$', r'\1', cleaned).strip()
    cleaned = re.sub(r'~~(.*?)~~', r'\1', cleaned).strip()

    # Also strip stray trailing/leading formatting asterisks or underscores (e.g. "CT2 4.1**")
    cleaned = re.sub(r'[\*_`~]+$', '', cleaned).strip()
    cleaned = re.sub(r'^[\*_`~]+', '', cleaned).strip()

    # Remove leading decorative symbols commonly produced by OCR on handwritten notes
    cleaned = re.sub(r'^[→★□•\-\*\>\►\s]+', '', cleaned).strip()

    # Remove trailing arrows (e.g. "double" " " " -> 1...)
    cleaned = re.sub(r'\s*->\s*.*$', '', cleaned).strip()

    # Remove enclosing or stray repeated quotation marks
    cleaned = re.sub(r'["\']\s*["\']+', '', cleaned).strip()
    cleaned = re.sub(r'^["\'\s]+|["\'\s]+$', '', cleaned).strip()

    # Remove trailing colons, slashes, punctuation
    cleaned = re.sub(r'[\/:\s]+$', '', cleaned).strip()

    # Normalize multiple whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned or raw_title


def is_valid_markdown_heading(title: str) -> bool:
    """
    Validates whether a title extracted from Markdown/OCR could legitimately be a heading.
    Rejects equations, isolated code lines, scratch notes, and noise.
    """
    if not title:
        return False
    clean = title.strip()
    if len(clean) < 2 or len(clean) > 95:
        return False

    # Reject if only numbers or pure punctuation
    if clean.isdigit():
        return False
    alpha_chars = sum(c.isalpha() for c in clean)
    if alpha_chars < 2:
        return False

    # Check non-space density: alphanumeric characters should make up at least 50%
    non_space = len(clean.replace(' ', ''))
    alnum_chars = sum(c.isalnum() for c in clean)
    if non_space > 0 and (alnum_chars / non_space) < 0.50:
        return False

    # Reject assignments and equations (e.g. "$t1 = 4 * i", "x = y + 1", "sum = 0")
    # unless it explicitly mentions "Law", "Theorem", "Formula", "Equation", "Rule", "Principle"
    has_law_word = bool(re.search(r'\b(?:Law|Equation|Formula|Theorem|Rule|Principle|Definition)\b', clean, re.I))
    if not has_law_word:
        # Check for assignment or comparison operators
        if re.search(r'(?:=|==|!=|<=|>=|\+=|-=|\*=|/=|:=|->|=>)', clean):
            return False
        # Check for math symbols like integral, summation, square root
        if any(c in clean for c in ('∝', '∫', '∬', '∮', '∑', '√', '±', '×', '÷')):
            return False

    # Reject assembly instruction lines or register assignments (e.g. "$t1", "$s0", "add $t0, $t1, $t2")
    if re.search(r'\$(?:t\d|s\d|v\d|a\d|zero|sp|ra|fp|k\d)\b', clean, re.I):
        return False
    if re.search(r'^(?:add|sub|addi|subi|lw|sw|sll|srl|beq|bne|j|jal|jr)\s+\$', clean, re.I):
        return False

    # Reject lines starting with lowercase continuations unless beginning with digits
    if clean[0].islower() and not clean[0].isdigit():
        return False

    # Reject lines starting with brackets or punctuation
    if clean[0] in '([{"\'-.,;:?~`':
        return False

    # Reject sentences ending in periods, semicolons, or commas (headings do not end in sentence periods)
    if clean.endswith(('.', ',', ';')) and not clean.endswith((' vs.', ' etc.')):
        return False

    # Reject slide meta / outline banners
    if re.match(r'^(?:outline|table of contents|contents|index|agenda|questions?\??|thank you!?)\b', clean, re.I):
        return False

    return True


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
                full_text = "\n\n".join(current_text)
                sections.append({
                    "heading": current_heading, 
                    "clean_title": clean_heading_title(current_heading),
                    "level": current_level,
                    "text": full_text,
                    "snippet": full_text[:400].strip(),
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
        full_text = "\n\n".join(current_text)
        sections.append({
            "heading": current_heading, 
            "clean_title": clean_heading_title(current_heading),
            "level": current_level,
            "text": full_text,
            "snippet": full_text[:400].strip(),
            "page_num": heading_page
        })
        
    try:
        from app.toc_parser import is_cover_title, is_noise_heading
        valid_sections = []
        for s in sections:
            title = s["clean_title"]
            page = s.get("page_num", 1)
            if title == "Introduction" and s.get("text", "").strip():
                valid_sections.append(s)
                continue
            if is_cover_title(title, page_num=page):
                continue
            if is_noise_heading(title, page_num=page):
                continue
            if not is_valid_markdown_heading(title):
                continue
            valid_sections.append(s)

        return valid_sections if len(valid_sections) >= 2 else sections
    except Exception:
        return sections