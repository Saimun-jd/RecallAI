import asyncio
from app.pdf_extract import extract_raw_text
from app.heading_detect import detect_headings
from app.llm_segment import extract_atomic_concepts
from app.schemas import SectionExtraction

async def main():
    md_text, _, _ = extract_raw_text("Hands_On_Machine_Learning_with_Scikit_Learn_Keras_and_Tensorflow.pdf", start_page=113)
    sections = detect_headings(md_text, 113)
    
    target_sec = None
    for sec in sections:
        if "mnist" in sec["heading"].lower():
            target_sec = sec
            break
            
    print(f"Target section heading: {target_sec['heading']}")
    print(f"Text length: {len(target_sec['text'])}")
    
    try:
        # Actually use openai provider
        res = await extract_atomic_concepts(target_sec["heading"], target_sec["text"], {}, {}, "openai")
        print("Success:", res)
    except Exception as e:
        print("Error:", type(e), str(e))

if __name__ == "__main__":
    asyncio.run(main())
