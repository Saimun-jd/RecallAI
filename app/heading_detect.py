import re

import uuid

def detect_headings(md_text: str, start_page_num: int) -> list[dict]:
    sections = []
    current_heading = "Introduction"
    current_text = []
    current_page = start_page_num
    
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
            
        # pymupdf4llm usually separates pages with -----
        if block == '-----':
            current_page += 1
            continue
            
        # Check if block is a markdown heading
        if re.match(r'^#{1,6}\s+', block):
            if current_text:
                sections.append({
                    "heading": current_heading, 
                    "text": "\n\n".join(current_text),
                    "page_num": current_page
                })
            # Remove the '#'s for the title
            current_heading = re.sub(r'^#{1,6}\s+', '', block)
            current_text = []
        else:
            current_text.append(block)
                
    if current_text:
        sections.append({
            "heading": current_heading, 
            "text": "\n\n".join(current_text),
            "page_num": current_page
        })
        
    return sections