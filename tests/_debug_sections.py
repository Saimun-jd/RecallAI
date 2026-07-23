import fitz, os
from cli import slice_pdf
from app.pdf_extract import extract_raw_text
from app.markdown_ast import parse_markdown_assets
from app.heading_detect import detect_headings

doc = fitz.open('Hands_On_Machine_Learning_with_Scikit_Learn_Keras_and_Tensorflow.pdf')
pdf_bytes = slice_pdf(doc, 113, 115)
doc.close()

with open('_temp_slice.pdf', 'wb') as f:
    f.write(pdf_bytes)

md_text, cache_key, start_page_num = extract_raw_text('_temp_slice.pdf', 113)
modified_md, code_blocks, images = parse_markdown_assets(md_text, cache_key)
sections = detect_headings(modified_md, start_page_num)

with open('_debug_output.txt', 'w', encoding='utf-8') as out:
    out.write('=== Raw Markdown (first 3000 chars) ===\n')
    out.write(modified_md[:3000])
    out.write('\n\n=== Sections found: {} ===\n'.format(len(sections)))
    for i, sec in enumerate(sections):
        out.write('\n--- Section {}: heading="{}" page={} ---\n'.format(i, sec["heading"], sec["page_num"]))
        out.write('Text length: {} chars, {} words\n'.format(len(sec["text"]), len(sec["text"].split())))
        out.write(sec['text'][:1500])
        out.write('\n...\n')

    out.write('\n=== Code blocks: {} ===\n'.format(len(code_blocks)))
    out.write('\n=== Images: {} ===\n'.format(len(images)))

os.remove('_temp_slice.pdf')
print('Debug output written to _debug_output.txt')
