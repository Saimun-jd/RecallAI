import fitz
import pymupdf4llm
import time

print("Opening PDF...")
doc = fitz.open("Deep Learning with Python 2nd Edition.pdf")
doc.select([21, 22, 23, 24]) # Pages 22 to 25

start = time.time()
print("Extracting Markdown...")
md_text = pymupdf4llm.to_markdown(doc=doc, write_images=False)
end = time.time()

print(f"Extraction took {end - start:.2f} seconds.")
print(md_text[:500])
