import re
import logging

import logging

logger = logging.getLogger(__name__)

FRONT_MATTER_NOISE = {
    "manning", "francois chollet", "françois chollet", "second edition",
    "first edition", "third edition", "brief contents", "contents",
    "preface", "acknowledgments", "acknowledgements", "dedication",
    "title page", "copyright", "about this book", "about the author"
}

def is_noise_heading(title: str) -> bool:
    clean_title = title.lower().strip()
    clean_no_spaces = clean_title.replace(" ", "")
    
    if clean_no_spaces.isdigit() or len(clean_no_spaces) <= 1:
        return True
        
    for term in FRONT_MATTER_NOISE:
        if term == clean_title or term.replace(" ", "") == clean_no_spaces:
            return True
            
    return False

def extract_fallback_toc(doc):
    """Detects headings using Font Size analysis + Broad Regex patterns.

    Captures Main Chapters (Level 1), Subchapters (Level 2), and
    Sub-sections (Level 3+) even when PDF bookmarks are missing or incomplete.
    """
    synthetic_toc = []

    # Regex for numbered patterns: "Chapter 1 Title", "1.1 Introduction", "10.2.1 Data"
    heading_pattern = re.compile(
        r"^((?:Chapter\s+\d+|[0-9]+(?:\.[0-9]+)*))\s+(.+)", re.IGNORECASE
    )

    # 1. Analyze average body text font size across sample pages
    font_sizes = []
    sample_pages = min(15, len(doc))
    for p in range(sample_pages):
        blocks = doc[p].get_text("dict")["blocks"]
        for b in blocks:
            if "lines" in b:
                for line in b["lines"]:
                    for span in line["spans"]:
                        if span["text"].strip():
                            font_sizes.append(span["size"])

    avg_font_size = sum(font_sizes) / len(font_sizes) if font_sizes else 10.0

    # 2. Iterate through pages and identify headings
    for page_num in range(len(doc)):
        blocks = doc[page_num].get_text("dict")["blocks"]

        for block in blocks:
            if "lines" not in block:
                continue

            block_text = ""
            max_span_size = 0

            for line in block["lines"]:
                line_text = "".join(span["text"] for span in line["spans"])
                block_text += line_text + " "
                for span in line["spans"]:
                    if span["size"] > max_span_size:
                        max_span_size = span["size"]

            block_text = block_text.strip()
            if not block_text:
                continue

            # Filtering: Headings are usually larger font and concise (< 12 words)
            is_large_text = max_span_size > (avg_font_size * 1.20)
            is_concise = len(block_text.split()) < 12

            match = heading_pattern.match(block_text)

            if match and is_large_text:
                num_part, title_part = match.groups()

                if "chapter" in num_part.lower():
                    level = 1
                elif "." not in num_part:
                    level = 1
                else:
                    level = min(4, num_part.count(".") + 1)

                full_title = f"{num_part} {title_part}".strip()
                
                if not is_noise_heading(full_title):
                    if not any(entry[1] == full_title and entry[2] == page_num + 1 for entry in synthetic_toc):
                        synthetic_toc.append([level, full_title, page_num + 1])

            elif is_large_text and is_concise:
                # Unnumbered header fallback
                level = 2
                if not is_noise_heading(block_text):
                    if not any(entry[1] == block_text and entry[2] == page_num + 1 for entry in synthetic_toc):
                        synthetic_toc.append([level, block_text, page_num + 1])

    return synthetic_toc


def get_toc_entries(doc):
    """Returns table of contents from PDF metadata or fallback heading scan."""
    toc = doc.get_toc()
    if not toc:
        logger.info("No embedded Table of Contents found. Scanning document text for headings...")
        toc = extract_fallback_toc(doc)
    return toc


def build_granular_toc(toc, total_pages):
    """Computes exact end_page boundaries for every entry in the TOC hierarchy."""
    granular_toc = []
    
    filtered_toc = [entry for entry in toc if not is_noise_heading(entry[1])]
    
    for i, entry in enumerate(filtered_toc):
        level, title, start_page = entry
        end_page = total_pages

        # Find the next item with equal or higher structural hierarchy (<= level)
        for j in range(i + 1, len(filtered_toc)):
            if filtered_toc[j][0] <= level:
                end_page = max(start_page, filtered_toc[j][2] - 1)
                break

        granular_toc.append({
            "level": level,
            "title": title,
            "start_page": start_page,
            "end_page": end_page,
        })
    return granular_toc


def find_subtopics(total_pages, toc, chapter_title=None):
    """Retrieves all subtopics. Allows targeting a specific chapter or showing full depth."""
    if not toc:
        return []

    granular_toc = build_granular_toc(toc, total_pages)

    if not chapter_title:
        return granular_toc

    # Filter entries belonging strictly inside target chapter scope
    filtered = []
    in_chapter = False
    chapter_level = None

    for entry in granular_toc:
        if not in_chapter:
            if chapter_title and chapter_title.lower() in entry["title"].lower():
                in_chapter = True
                chapter_level = entry["level"]
                filtered.append(entry)
        else:
            if entry["level"] <= chapter_level:
                break  # Reached the next chapter
            filtered.append(entry)

    return filtered


def search_toc_by_title(granular_toc, subtopic_title):
    """Searches TOC entries for a subtopic substring match across all levels."""
    for entry in granular_toc:
        if not is_noise_heading(entry["title"]) and subtopic_title.lower() in entry["title"].lower():
            return entry
    return None
