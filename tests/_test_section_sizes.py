import asyncio
from app.pdf_extract import extract_raw_text
from app.heading_detect import detect_headings

def main():
    print("Extracting raw text...")
    md_text, _, _ = extract_raw_text("Hands_On_Machine_Learning_with_Scikit_Learn_Keras_and_Tensorflow.pdf", start_page=113)
    
    print("Detecting headings...")
    sections = detect_headings(md_text, 113)
    
    print(f"Total sections: {len(sections)}")
    for sec in sections:
        if "mnist" in sec["heading"].lower():
            print(f"Heading: {sec['heading']}")
            print(f"Text length: {len(sec['text'])} chars")
            print("---")

if __name__ == "__main__":
    main()
