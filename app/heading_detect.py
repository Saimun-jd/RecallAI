import re

def detect_headings(md_text: str, start_page_num: int) -> list[dict]:
    sections = []
    current_heading = "Introduction"
    current_text = []
    current_page = start_page_num
    
    # Split the markdown into blocks
    blocks = md_text.split('\n\n')
    
    for block in blocks:
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