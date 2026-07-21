def is_valid_section(heading: str, text: str) -> bool:
    # 1. Skip if text is too short (likely a caption, footer, or isolated noise)
    if len(text.split()) < 30:
        return False
        
    # 2. Skip bibliography and reference sections
    skip_headers = {"references", "bibliography", "acknowledgements", "acknowledgments"}
    if heading.lower().strip() in skip_headers:
        return False
        
    return True