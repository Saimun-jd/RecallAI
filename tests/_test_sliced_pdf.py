import asyncio
import httpx
from app.pdf_extract import extract_raw_text
from app.markdown_ast import parse_markdown_assets
from app.heading_detect import detect_headings

async def main():
    import fitz
    # Slice the PDF like cli.py does
    doc = fitz.open("Hands_On_Machine_Learning_with_Scikit_Learn_Keras_and_Tensorflow.pdf")
    new_doc = fitz.open()
    new_doc.insert_pdf(doc, from_page=112, to_page=114) # 0-indexed for 113-115
    new_doc.save("test_slice.pdf")
    new_doc.close()
    doc.close()
    
    md_text, cache_key, start_page_num = extract_raw_text("test_slice.pdf", start_page=113)
    print(f"Raw markdown length: {len(md_text)}")
    
    modified_md_text, code_blocks, images = parse_markdown_assets(md_text, cache_key)
    print(f"Modified markdown length: {len(modified_md_text)}")
    
    sections = detect_headings(modified_md_text, 113)
    for sec in sections:
        if "mnist" in sec["heading"].lower():
            print(f"Heading: {sec['heading']}")
            print(f"Text length: {len(sec['text'])} chars")
            
            # Print a snippet of the text to see if it contains base64
            if len(sec['text']) > 1000:
                print(sec['text'][:500] + "\n...\n" + sec['text'][-500:])
            break

if __name__ == "__main__":
    asyncio.run(main())
