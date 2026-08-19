"""
Export an annotated copy of a PDF with highlights, sidenotes, and AI explanations embedded.
Uses PyMuPDF (fitz) to add PDF annotations to the original file.
"""
import logging
import os
import tempfile
import json

import fitz  # PyMuPDF

from app.database import get_annotations_for_book, get_connection

logger = logging.getLogger(__name__)


def generate_annotated_pdf(book_id: int) -> str | None:
    """
    Creates an annotated copy of the original PDF with:
    - Sticky notes for sidenotes
    - Sticky notes for AI explanations  
    - Highlight annotations for all annotated regions
    
    Returns the path to the annotated PDF (temporary file), or None on error.
    """
    # Get book info
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT file_path, title FROM books WHERE id = ?", (book_id,))
        row = cursor.fetchone()
        if not row:
            logger.error(f"Book {book_id} not found")
            return None
    
    file_path = row["file_path"]
    book_title = row["title"]
    
    if not os.path.exists(file_path):
        logger.error(f"PDF file not found: {file_path}")
        return None
    
    # Get all annotations for this book
    annotations = get_annotations_for_book(book_id)
    if not annotations:
        logger.info(f"No annotations found for book {book_id}, returning original")
        return file_path
    
    try:
        doc = fitz.open(file_path)
        
        for ann in annotations:
            page_num = ann["page_number"] - 1  # fitz uses 0-indexed pages
            if page_num < 0 or page_num >= len(doc):
                logger.warning(f"Annotation page {ann['page_number']} out of range for PDF with {len(doc)} pages")
                continue
            
            page = doc[page_num]
            
            # Parse the rect
            try:
                rect_data = json.loads(ann["rect_json"])
                # Convert from viewport coordinates to PDF points
                # The stored coordinates are at viewportScale (typically 1.5x)
                viewport_scale = rect_data.get("viewportScale", 1.5)
                
                if "boundingRect" in rect_data:
                    bounds = rect_data["boundingRect"]
                    x = bounds.get("x1", bounds.get("left", 0)) / viewport_scale
                    y = bounds.get("y1", bounds.get("top", 0)) / viewport_scale
                    w = bounds.get("width", 0) / viewport_scale
                    h = bounds.get("height", 0) / viewport_scale
                else:
                    x = rect_data["x"] / viewport_scale
                    y = rect_data["y"] / viewport_scale
                    w = rect_data["width"] / viewport_scale
                    h = rect_data["height"] / viewport_scale
                
                # Create a fitz.Rect for the annotation position
                annot_rect = fitz.Rect(x, y, x + w, y + h)
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"Invalid rect_json for annotation {ann['id']}: {e}")
                # Fall back to a default position
                annot_rect = fitz.Rect(72, 72, 200, 90)
            
            annotation_type = ann["annotation_type"]
            content = ann.get("content") or ""
            selected_text = ann.get("selected_text") or ""
            
            # Add a highlight annotation over the selected region
            try:
                highlight = page.add_highlight_annot(annot_rect)
                if annotation_type == "ai_explanation":
                    highlight.set_colors(stroke=(0.063, 0.725, 0.506))  # emerald
                elif annotation_type == "sidenote":
                    highlight.set_colors(stroke=(0.961, 0.620, 0.043))  # amber
                elif annotation_type == "flashcard_link":
                    highlight.set_colors(stroke=(0.231, 0.510, 0.965))  # blue
                highlight.update()
            except Exception as e:
                logger.warning(f"Failed to add highlight for annotation {ann['id']}: {e}")
            
            # Add a sticky note with the content
            if content:
                try:
                    # Position the note at the top-right of the highlight
                    note_point = fitz.Point(annot_rect.x1 + 5, annot_rect.y0)
                    
                    # Prepare the note text
                    if annotation_type == "ai_explanation":
                        note_title = "AI Explanation"
                        # Strip markdown for PDF sticky note (plain text only)
                        note_text = content
                    elif annotation_type == "sidenote":
                        note_title = "Sidenote"
                        note_text = content
                    elif annotation_type == "flashcard_link":
                        note_title = "Flashcards"
                        # Format flashcards as readable text
                        try:
                            cards = json.loads(content)
                            lines = []
                            for i, card in enumerate(cards, 1):
                                lines.append(f"Q{i}: {card.get('question', '')}")
                                lines.append(f"A{i}: {card.get('answer', '')}")
                                lines.append("")
                            note_text = "\n".join(lines)
                        except json.JSONDecodeError:
                            note_text = content
                    else:
                        note_title = "Note"
                        note_text = content
                    
                    text_annot = page.add_text_annot(note_point, note_text)
                    text_annot.set_info(title=note_title)
                    
                    # Color the icon to match the annotation type
                    if annotation_type == "ai_explanation":
                        text_annot.set_colors(stroke=(0.063, 0.725, 0.506))
                    elif annotation_type == "sidenote":
                        text_annot.set_colors(stroke=(0.961, 0.620, 0.043))
                    elif annotation_type == "flashcard_link":
                        text_annot.set_colors(stroke=(0.231, 0.510, 0.965))
                    
                    text_annot.update()
                except Exception as e:
                    logger.warning(f"Failed to add text annotation for {ann['id']}: {e}")
        
        # Save to a temporary file
        safe_title = "".join(c for c in book_title if c.isalnum() or c in " _-").strip()
        output_path = os.path.join(tempfile.gettempdir(), f"{safe_title}_annotated.pdf")
        doc.save(output_path)
        doc.close()
        
        logger.info(f"Annotated PDF saved to {output_path} with {len(annotations)} annotations")
        return output_path
        
    except Exception as e:
        logger.error(f"Failed to generate annotated PDF: {e}")
        return None
