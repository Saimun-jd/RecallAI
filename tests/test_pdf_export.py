import os
import sys
import json
import pytest
import tempfile
import fitz

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import database
from app import pdf_export

def test_pdf_export_annotation_rect():
    # Create a small dummy PDF
    temp_pdf = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_pdf_path = temp_pdf.name
    temp_pdf.close()
    
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((50, 100), "Hello World PDF Content")
    doc.save(temp_pdf_path)
    doc.close()

    # Save to DB
    book_id = database.save_book("Export Test Book", temp_pdf_path, "hash_exp_1", 1)

    # Save annotation with ScaledPosition format produced by react-pdf-highlighter
    scaled_position = {
        "boundingRect": {
            "x1": 50,
            "y1": 90,
            "x2": 200,
            "y2": 110,
            "width": 595,
            "height": 842,
            "pageNumber": 1
        },
        "rects": [
            {
                "x1": 50,
                "y1": 90,
                "x2": 200,
                "y2": 110,
                "width": 595,
                "height": 842,
                "pageNumber": 1
            }
        ],
        "pageNumber": 1
    }

    ann_id = database.save_annotation(
        book_id=book_id,
        page_number=1,
        annotation_type="ai_explanation",
        selected_text="Hello World",
        rect_json=json.dumps(scaled_position),
        content="This is an explanation."
    )

    out_path = pdf_export.generate_annotated_pdf(book_id)
    assert out_path is not None
    assert os.path.exists(out_path)

    # Open annotated PDF and inspect annotations
    annot_doc = fitz.open(out_path)
    annot_page = annot_doc[0]
    annots = list(annot_page.annots())
    
    assert len(annots) >= 1
    highlight_annot = [a for a in annots if a.type[0] == 8][0] # 8 is highlight
    rect = highlight_annot.rect
    print("\nHighlight Rect in exported PDF:", rect)
    
    # If it fell back to (72, 72, 200, 90), then rect.x0 == 72, rect.y0 == 72
    assert not (abs(rect.x0 - 72) < 1 and abs(rect.y0 - 72) < 1), "PDF Export fell back to dummy coordinates (72, 72, 200, 90) because rect_json parsing failed on ScaledPosition format!"
    
    annot_doc.close()
