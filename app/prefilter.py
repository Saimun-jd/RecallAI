def is_valid_section(heading: str, text: str) -> bool:
    # 1. Skip if text is too short (likely a caption, footer, or isolated noise)
    # BUT preserve math-heavy chunks
    word_count = len(text.split())
    
    math_markers = ["$$", "\\begin", "\\end", "\\det", "\\int", "\\sum", "\\frac", "\\alpha", "\\beta", "\\matrix"]
    has_latex = any(marker in text for marker in math_markers)
    has_inline_math = text.count("$") >= 2
    
    math_symbols = ["=", "+", "-", "^", "_", "\\"]
    symbol_count = sum(text.count(sym) for sym in math_symbols)
    
    is_math_heavy = has_latex or has_inline_math or (symbol_count > 15 and len(text) > 50)
    
    if word_count < 30 and not is_math_heavy:
        return False
        
    # 2. Skip bibliography, references, and table of contents
    skip_headers = {"references", "bibliography", "acknowledgements", "acknowledgments", "table of contents", "index"}
    if heading.lower().strip() in skip_headers:
        return False
        
    # 3. Skip sections that are purely publisher boilerplate
    lower_text = text.lower()
    if "early release ebooks" in lower_text and word_count < 100:
        # If it's a short section just containing the early release watermark
        return False
        
    return True