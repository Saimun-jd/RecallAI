import re

def is_heading(text: str) -> bool:
    text = text.strip()
    if len(text) > 150 or not text:
        return False
        
    # 1. Numbered headings (e.g., "1. Introduction", "2.1 Background")
    if re.match(r'^\d+(\.\d+)*\s+[A-Z]', text, re.IGNORECASE):
        return True
        
    # 2. Common academic headers
    common = {"abstract", "introduction", "background", "related work",
              "methodology", "methods", "evaluation", "results", 
              "discussion", "conclusion", "conclusions", "references", 
              "bibliography", "acknowledgements", "acknowledgments"}
    if text.lower() in common:
        return True
        
    # 3. All caps short lines
    if text.isupper() and len(text.split()) < 10:
        return True
        
    return False

def detect_headings(raw_text: str) -> list[dict]:
    # Since pdf_extract preserves \n\n, we split by that
    blocks = raw_text.split('\n\n')
    
    sections = []
    current_heading = "Untitled"
    current_text = []
    
    for block in blocks:
        block = block.strip()
        if not block:
            continue
            
        if is_heading(block):
            if current_text:
                sections.append({"heading": current_heading, "text": "\n\n".join(current_text)})
            current_heading = block
            current_text = []
        else:
            current_text.append(block)
            
    if current_text:
        sections.append({"heading": current_heading, "text": "\n\n".join(current_text)})
        
    return sections