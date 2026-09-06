import re
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

FRONT_MATTER_NOISE = {
    "manning", "francois chollet", "françois chollet", "second edition",
    "first edition", "third edition", "preface", "acknowledgments",
    "acknowledgements", "dedication", "title page", "copyright",
    "about this book", "about the author"
}

MATH_SYMBOLS = re.compile(r'[=+\-×÷∫∬∮∝∆Δ√∑πθΦφελε]|\\frac|\\vec|d[A-Z]/dt|d\w+/d\w+')
SENTENCE_STARTERS = re.compile(
    r'^(?:where|therefore|let us|in other words|the|this|that|since|now|and|for|which|if|when|with|as|due to|from)\b',
    re.IGNORECASE
)
EXERCISE_NOISE = re.compile(
    r'^(?:CHECKPOINT|PROBLEM|ANSWER|NOTE|SOLUTION|QUESTION|EXERCISE|FIG\.|FIGURE)\b',
    re.IGNORECASE
)


def is_noise_heading(title: str) -> bool:
    clean_title = title.lower().strip()
    clean_no_spaces = clean_title.replace(" ", "")
    
    if clean_no_spaces.isdigit() or len(clean_no_spaces) <= 1:
        return True
        
    for term in FRONT_MATTER_NOISE:
        if term == clean_title or term.replace(" ", "") == clean_no_spaces:
            return True
            
    if EXERCISE_NOISE.match(title):
        return True

    return False


def is_valid_heading_candidate(text: str) -> bool:
    """Validates whether a line of text could legitimately be a heading."""
    clean = text.strip()
    if len(clean) < 3 or len(clean) > 85:
        return False
        
    # Must have at least 3 alphabetic characters (rejects numbers, pure math, isolated symbols)
    alpha_chars = sum(c.isalpha() for c in clean)
    if alpha_chars < 3:
        return False

    # Alphabetic ratio must be substantial (rejects formulas, equations, coordinate fragments)
    non_space_chars = len(clean.replace(' ', ''))
    if non_space_chars > 0 and (alpha_chars / non_space_chars) < 0.60:
        return False

    # Reject outline/TOC banners themselves
    if re.match(r'^(?:OUTLINE|TABLE OF CONTENTS|CONTENTS|INDEX)\b', clean, re.IGNORECASE):
        return False

    # Reject sentence starters or continuations
    if SENTENCE_STARTERS.match(clean):
        return False
        
    # Reject lines starting with lowercase or punctuation
    if clean[0].islower() or clean[0] in '([{"\'-.,;:?':
        return False

    # Reject sentence endings (headings do not end in periods, commas, or semicolons)
    if clean.endswith(('.', ',', ';', "'.", '".', ".'", '."')) and not clean.endswith((' vs.', ' etc.')):
        return False
        
    # Reject raw mathematical equations
    if MATH_SYMBOLS.search(clean) and not re.search(r'\b(?:Law|Equation|Formula|Theorem|Rule|Principle)\b', clean, re.I):
        if any(c in clean for c in ('=', '∝', '∫', '∬', '∮', '∑', '√')):
            return False
            
    # Reject lines with excessive replacement/unprintable question marks
    if clean.count('?') >= 2 or clean.count('\ufffd') >= 1:
        return False
        
    # Reject exercises, problems, checkpoints
    if EXERCISE_NOISE.match(clean):
        return False

    return True


def extract_fallback_toc(doc) -> List[List[Any]]:
    """
    Multi-signal fallback TOC detector.
    
    Detects headings using:
    1. Font size relative to document average
    2. Font weight (Bold flags / Bold font families)
    3. Typography case (ALL CAPS standalone sections)
    4. Structural prefixes (Module, Lecture, Chapter, Section, 1.1, etc.)
    5. Recurring header/footer noise suppression
    """
    synthetic_toc = []

    # 1. Gather font statistics and detect running headers/footers
    font_sizes = []
    header_footer_candidates = {}

    sample_pages = min(20, len(doc))
    for p in range(sample_pages):
        blocks = doc[p].get_text("dict")["blocks"]
        for b_idx, b in enumerate(blocks):
            if "lines" in b:
                for line in b["lines"]:
                    for span in line["spans"]:
                        text = span["text"].strip()
                        if text:
                            font_sizes.append(span["size"])

                # Check top or bottom block for running headers/footers
                line_str = "".join(span["text"] for line in b["lines"] for span in line["spans"]).strip()
                if (b_idx == 0 or b_idx == len(blocks) - 1) and len(line_str) < 70:
                    header_footer_candidates[line_str] = header_footer_candidates.get(line_str, 0) + 1

    avg_font_size = sum(font_sizes) / len(font_sizes) if font_sizes else 11.0

    # Recurring headers appear on >= 2 pages in the sample
    running_headers = {text for text, count in header_footer_candidates.items() if count >= 2}

    # Numbered / structured prefix pattern: "Chapter 1", "1.1 Intro", "Module 08", "Lecture 17"
    prefix_pattern = re.compile(
        r'^(?:Module|Lecture|Chapter|Section|Part|Unit|\d+(?:\.\d+)*)\b',
        re.IGNORECASE
    )

    # 2. Iterate through each page
    for page_num in range(len(doc)):
        blocks = doc[page_num].get_text("dict")["blocks"]

        for b in blocks:
            if "lines" not in b:
                continue

            # Extract the first line of the block
            first_line = b["lines"][0]
            first_text = "".join(span["text"] for span in first_line["spans"]).strip()

            if not first_text:
                continue

            # Skip running headers, footers, and page numbers
            if first_text in running_headers or first_text.isdigit():
                continue
            if re.match(r'^(?:PHY-\d+|Page\s+\d+|\d+$)', first_text, re.IGNORECASE):
                continue

            if not is_valid_heading_candidate(first_text):
                continue

            max_span_size = max(span["size"] for span in first_line["spans"]) if first_line["spans"] else 0
            is_bold = any(
                span.get("flags", 0) & 2 != 0 or
                span.get("flags", 0) & 16 != 0 or
                "bold" in span.get("font", "").lower()
                for span in first_line["spans"]
            )

            words = first_text.split()
            word_count = len(words)
            is_all_caps = first_text.isupper() and word_count >= 1

            # Multi-signal qualification:
            c1_large_font = max_span_size >= (avg_font_size * 1.25)
            c2_structural_prefix = bool(prefix_pattern.match(first_text))
            c3_bold_concise = is_bold and (word_count <= 10) and (max_span_size >= avg_font_size * 0.95)
            c4_all_caps = is_all_caps and (word_count <= 8) and (max_span_size >= avg_font_size * 0.95)

            if c1_large_font or c2_structural_prefix or c3_bold_concise or c4_all_caps:
                # Determine hierarchical level
                if max_span_size >= 18.0 or re.match(r'^(?:Module|Part)\b', first_text, re.IGNORECASE):
                    level = 1
                elif max_span_size >= 14.0 or re.match(r'^(?:Lecture|Chapter)\b', first_text, re.IGNORECASE):
                    level = 2
                elif is_all_caps or (c2_structural_prefix and '.' not in first_text):
                    level = 3
                else:
                    level = 4

                clean_title = re.sub(r'\s+', ' ', first_text).strip()
                # Normalize smart quotes and dashes for clean display and encoding safety
                clean_title = (
                    clean_title.replace('\u2018', "'")
                    .replace('\u2019', "'")
                    .replace('\u201c', '"')
                    .replace('\u201d', '"')
                    .replace('\u2013', '-')
                    .replace('\u2014', '-')
                )

                if not is_noise_heading(clean_title):
                    # Prevent duplicate titles on the same page
                    if not any(entry[1] == clean_title and entry[2] == page_num + 1 for entry in synthetic_toc):
                        synthetic_toc.append([level, clean_title, page_num + 1])

    return synthetic_toc


def get_toc_entries(doc, pdf_path: str | None = None) -> List[List[Any]]:
    """Returns table of contents from PDF metadata or fallback heading scan."""
    from app.extractors import get_extractor
    extractor = get_extractor()

    # Let the plugin try first (e.g. Marker with its layout model)
    if pdf_path:
        plugin_toc = extractor.extract_toc(Path(pdf_path), doc.page_count)
        if plugin_toc:
            return [[e.level, e.title, e.page] for e in plugin_toc]

    native_toc = doc.get_toc()

    logger.info("Scanning document text for fallback headings to supplement embedded TOC...")
    fallback_toc = extract_fallback_toc(doc)

    # If native TOC is empty or has only 1-2 entries while fallback found a rich outline,
    # prefer the rich fallback TOC!
    if not native_toc:
        return fallback_toc

    if len(native_toc) <= 2 and len(fallback_toc) >= 3:
        logger.info("Native TOC is sparse (%d items); using rich fallback TOC (%d items)...",
                    len(native_toc), len(fallback_toc))
        return fallback_toc

    # Hybrid merge strategy: supplement native TOC with missing deep headings
    max_native_level = max([entry[0] for entry in native_toc]) if native_toc else 0
    native_pages = set([entry[2] for entry in native_toc])
    native_titles = set([re.sub(r'[^a-zA-Z0-9]', '', entry[1].lower()) for entry in native_toc])

    hybrid_toc = list(native_toc)

    for fb_entry in fallback_toc:
        level, title, page = fb_entry
        clean_title = re.sub(r'[^a-zA-Z0-9]', '', title.lower())

        if clean_title in native_titles:
            continue

        # Add if deeper than native max level, or if it appears on a page completely missing from native TOC
        if level > max_native_level or page not in native_pages:
            hybrid_toc.append(fb_entry)
            native_titles.add(clean_title)

    # Sort by page number, then by level
    hybrid_toc.sort(key=lambda x: (x[2], x[0]))

    return hybrid_toc


def build_granular_toc(toc: List[List[Any]], total_pages: int) -> List[Dict[str, Any]]:
    """Computes exact start_page and end_page boundaries for every entry in the TOC hierarchy."""
    granular_toc = []

    filtered_toc = [entry for entry in toc if not is_noise_heading(entry[1])]

    if not filtered_toc:
        return [{
            "level": 1,
            "title": "Full Document",
            "start_page": 1,
            "end_page": total_pages,
        }]

    for i, entry in enumerate(filtered_toc):
        level = int(entry[0])
        title = entry[1]
        start_page = max(1, int(entry[2]))
        end_page = total_pages

        # Find the next item with equal or higher structural hierarchy (<= level)
        for j in range(i + 1, len(filtered_toc)):
            next_level = int(filtered_toc[j][0])
            next_start = max(1, int(filtered_toc[j][2]))

            if next_level <= level:
                if next_start > start_page:
                    end_page = next_start - 1
                    break
                elif next_level < level:
                    # A higher-level parent starts on the same page
                    end_page = start_page
                    break

        granular_toc.append({
            "level": level,
            "title": title,
            "start_page": start_page,
            "end_page": max(start_page, end_page),
        })

    return granular_toc


def find_subtopics(total_pages: int, toc: List[List[Any]], chapter_title: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves all subtopics. Allows targeting a specific chapter or showing full depth."""
    if not toc:
        return []

    granular_toc = build_granular_toc(toc, total_pages)

    if not chapter_title:
        return granular_toc

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


def search_toc_by_title(granular_toc: List[Dict[str, Any]], subtopic_title: str) -> Optional[Dict[str, Any]]:
    """Searches TOC entries for a subtopic substring match across all levels."""
    for entry in granular_toc:
        if not is_noise_heading(entry["title"]) and subtopic_title.lower() in entry["title"].lower():
            return entry
    return None
