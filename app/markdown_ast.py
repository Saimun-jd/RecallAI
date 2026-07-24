from markdown_it import MarkdownIt

def parse_markdown_assets(md_text: str, cache_key: str) -> tuple[str, dict, dict]:
    """
    Parses Markdown AST to extract code blocks and images, and injects inline markers.
    Returns: (modified_md_text, code_blocks_map, images_map)
    """
    md = MarkdownIt()
    tokens = md.parse(md_text)

    code_blocks = {}
    images = {}
    
    code_idx = 1
    img_idx = 1
    
    lines = md_text.splitlines()
    insertions = {} # line_idx -> text to insert BEFORE the line
    
    def walk_tokens(token_list):
        nonlocal img_idx
        for token in token_list:
            if token.type == "image":
                img_url = token.attrGet("src")
                if img_url:
                    img_id = f"img_{img_idx}"
                    # pymupdf4llm writes images to the image_path (e.g. images/...)
                    # We map this to the static HTTP URL
                    filename = img_url.split("/")[-1] if "/" in img_url else img_url
                    filename = filename.split("\\")[-1] if "\\" in filename else filename
                    images[img_id] = f"/static/{cache_key}/images/{filename}"
                    img_idx += 1
            if token.children:
                walk_tokens(token.children)

    for token in tokens:
        if token.type in ("fence", "code_block"):
            code_id = f"code_{code_idx}"
            code_blocks[code_id] = {
                "language": token.info if token.info else "text",
                "code": token.content.strip()
            }
            if token.map:
                start_line = token.map[0]
                insertions[start_line] = f"\n[ASSET: {code_id}]\n"
            code_idx += 1
        elif token.type == "inline":
            walk_tokens([token])
            
    # Apply line insertions from bottom to top to not invalidate indices
    for line_idx in sorted(insertions.keys(), reverse=True):
        lines.insert(line_idx, insertions[line_idx])
        
    modified_md = "\n".join(lines)
    
    # Replace original pymupdf4llm relative image URLs in the markdown text 
    # with the injected marker.
    md_tokens_again = md.parse(md_text)
    def walk_tokens_replace(token_list):
        nonlocal img_idx
        for token in token_list:
            if token.type == "image":
                img_url = token.attrGet("src")
                if img_url:
                    img_id = f"img_{img_idx}"
                    nonlocal modified_md
                    modified_md = modified_md.replace(f"]({img_url})", f"]({img_url})\n\n[ASSET: {img_id}]\n\n", 1)
                    img_idx += 1
            if token.children:
                walk_tokens_replace(token.children)
                
    img_idx = 1
    for token in md_tokens_again:
        if token.type == "inline":
            walk_tokens_replace([token])
            
    return modified_md, code_blocks, images
