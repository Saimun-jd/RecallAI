import asyncio
from app.pdf_extract import extract_raw_text
from app.markdown_ast import parse_markdown_assets
from app.heading_detect import detect_headings

def main():
    md_text, cache_key, _ = extract_raw_text("Hands_On_Machine_Learning_with_Scikit_Learn_Keras_and_Tensorflow.pdf", start_page=113)
    modified_md_text, code_blocks, images = parse_markdown_assets(md_text, cache_key)
    
    sections = detect_headings(modified_md_text, 113)
    for sec in sections:
        if "mnist" in sec["heading"].lower():
            print(f"Heading: {sec['heading']}")
            print(f"Text length: {len(sec['text'])} chars")
            break

if __name__ == "__main__":
    main()
