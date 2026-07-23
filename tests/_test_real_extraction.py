import asyncio
from app.pdf_extract import extract_raw_text
from app.heading_detect import detect_headings
from app.llm_segment import extract_atomic_concepts
from app.chunk_builder import build_chunks

async def main():
    print("Extracting raw text...")
    md_text, cache_key, _ = extract_raw_text("Hands_On_Machine_Learning_with_Scikit_Learn_Keras_and_Tensorflow.pdf", start_page=113)
    
    print("Detecting headings...")
    sections = detect_headings(md_text, 113)
    
    target_sec = None
    for sec in sections:
        if "mnist" in sec["heading"].lower():
            target_sec = sec
            break
            
    if not target_sec:
        print("Section not found!")
        return
        
    print(f"Processing section: {target_sec['heading']}")
    try:
        extraction = await extract_atomic_concepts(target_sec["heading"], target_sec["text"], {}, {}, "openai")
        print("Extraction success!")
        print(extraction)
    except Exception as e:
        import traceback
        print("Extraction failed!")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
