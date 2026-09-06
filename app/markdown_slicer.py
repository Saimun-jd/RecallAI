"""
Markdown Slicer — Extract targeted ground-truth slices for atomic concepts.

Solves token waste and front-truncation defects by isolating only the relevant
sections, equations, and local context needed for a specific atomic concept
instead of passing 10k-20k tokens of full lecture/chapter markdown.
"""

import logging
import re
from typing import Optional, List, Dict, Any

from app.heading_detect import detect_headings

logger = logging.getLogger(__name__)


def extract_concept_ground_truth(
    full_markdown: str,
    concept_name: Optional[str] = None,
    concept_summary: Optional[str] = "",
    key_terms: Optional[List[str]] = None,
    section_heading: Optional[str] = None,
    max_chars: int = 7000,
) -> str:
    """
    Extracts only the relevant portion of markdown for a targeted atomic concept.
    
    Returns:
        A concise, highly relevant markdown snippet containing the concept's
        equations, mechanism, and surrounding context, bounded by max_chars.
    """
    if not full_markdown or not full_markdown.strip():
        return ""

    # 1. Short document pass-through: if document is already tiny or no concept specified
    clean_md = full_markdown.strip()
    if not concept_name or len(clean_md) <= 600:
        return clean_md[:max_chars]

    key_terms = [t.strip() for t in (key_terms or []) if t and t.strip()]
    concept_name_clean = concept_name.strip()

    # 2. Decompose into sections via heading detection
    sections = detect_headings(clean_md, 1)
    if not sections or len(sections) <= 1:
        # Fallback for documents with no markdown headings: paragraph-level search
        return _extract_from_paragraphs(clean_md, concept_name_clean, concept_summary, key_terms, max_chars)

    # 3. If explicit section_heading is provided and matches, locate it
    direct_match_idx = None
    if section_heading:
        sh_clean = section_heading.lower().strip()
        for idx, sec in enumerate(sections):
            if sec["heading"].lower().strip() == sh_clean:
                direct_match_idx = idx
                break

    # 4. Multi-signal scoring across all sections
    concept_words = [w.lower() for w in re.findall(r'[a-zA-Z0-9]+', concept_name_clean) if len(w) > 3]
    term_words = [t.lower() for t in key_terms]

    scored_sections = []
    for idx, sec in enumerate(sections):
        score = 0.0
        h_lower = sec["heading"].lower()
        t_lower = sec["text"].lower()

        # If this was the explicitly recorded section heading
        if direct_match_idx is not None and idx == direct_match_idx:
            score += 100.0

        # Exact phrase in heading
        if concept_name_clean.lower() in h_lower:
            score += 40.0
        elif concept_name_clean.lower() in t_lower:
            score += 15.0

        # Concept token matches in heading (high signal)
        for w in concept_words:
            if w in h_lower:
                score += 15.0
            elif w in t_lower:
                score += 2.0

        # Key terms matches
        for term in term_words:
            if term in h_lower:
                score += 25.0
            elif term in t_lower:
                score += 6.0

        # Summary overlap
        if concept_summary:
            summary_words = [w.lower() for w in re.findall(r'[a-zA-Z0-9]+', concept_summary) if len(w) > 4]
            for sw in summary_words:
                if sw in t_lower:
                    score += 0.5

        scored_sections.append((idx, score, sec))

    scored_sections.sort(key=lambda x: x[1], reverse=True)

    # If no section has any positive score, fall back to leading content up to budget
    if not scored_sections or scored_sections[0][1] <= 0:
        logger.debug("No sections scored positively for concept '%s'; returning leading text", concept_name)
        return clean_md[:max_chars]

    # 5. Assemble context window centered on top matching sections
    best_idx = scored_sections[0][0]
    selected_indices = {best_idx}
    current_len = len(sections[best_idx]["text"]) + len(sections[best_idx]["heading"]) + 20

    # Include immediately adjacent sections if they have relevant context or shared hierarchy
    for adj_idx in (best_idx - 1, best_idx + 1):
        if 0 <= adj_idx < len(sections):
            adj_score = next((sc for idx, sc, _ in scored_sections if idx == adj_idx), 0)
            adj_len = len(sections[adj_idx]["text"]) + len(sections[adj_idx]["heading"]) + 20
            if adj_score >= 4.0 and (current_len + adj_len <= max_chars):
                selected_indices.add(adj_idx)
                current_len += adj_len

    # Add other top-scoring sections if budget permits
    for idx, sc, sec in scored_sections[1:]:
        if sc >= 15.0 and idx not in selected_indices:
            sec_len = len(sec["text"]) + len(sec["heading"]) + 20
            if current_len + sec_len <= max_chars:
                selected_indices.add(idx)
                current_len += sec_len

    # 6. Format assembled sections in document order
    ordered_indices = sorted(list(selected_indices))
    assembled_parts = []
    for idx in ordered_indices:
        sec = sections[idx]
        heading_title = sec["heading"].strip()
        body = sec["text"].strip()
        assembled_parts.append(f"### {heading_title}\n\n{body}")

    assembled_md = "\n\n---\n\n".join(assembled_parts)
    return assembled_md[:max_chars]


def _extract_from_paragraphs(
    text: str,
    concept_name: str,
    summary: str,
    key_terms: List[str],
    max_chars: int
) -> str:
    """Fallback paragraph-level search for documents without markdown headings."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        return text[:max_chars]

    concept_words = [w.lower() for w in re.findall(r'[a-zA-Z0-9]+', concept_name) if len(w) > 3]
    term_words = [t.lower() for t in key_terms]

    scored = []
    for idx, p in enumerate(paragraphs):
        score = 0.0
        p_lower = p.lower()
        for w in concept_words:
            if w in p_lower:
                score += 3.0
        for t in term_words:
            if t in p_lower:
                score += 5.0
        scored.append((idx, score, p))

    scored.sort(key=lambda x: x[1], reverse=True)
    if not scored or scored[0][1] <= 0:
        return text[:max_chars]

    best_idx = scored[0][0]
    start = max(0, best_idx - 2)
    end = min(len(paragraphs), best_idx + 3)
    slice_paras = paragraphs[start:end]
    return "\n\n".join(slice_paras)[:max_chars]


def match_concept_to_section_heading(
    sections: List[Dict[str, Any]],
    concept_name: str,
    summary: str = "",
    key_terms: List[str] = None
) -> Optional[str]:
    """
    Finds the most relevant section heading for an atomic concept.
    Used during extraction in process_topic_stream to store section_heading.
    """
    if not sections or not concept_name:
        return None

    key_terms = key_terms or []
    concept_words = [w.lower() for w in re.findall(r'[a-zA-Z0-9]+', concept_name) if len(w) > 3]
    term_words = [t.lower() for t in key_terms]

    best_heading = None
    best_score = -1.0

    for sec in sections:
        score = 0.0
        h_lower = sec["heading"].lower()
        t_lower = sec["text"].lower()

        if concept_name.lower() in h_lower:
            score += 40.0
        elif concept_name.lower() in t_lower:
            score += 15.0

        for w in concept_words:
            if w in h_lower:
                score += 15.0
            elif w in t_lower:
                score += 2.0

        for t in term_words:
            if t in h_lower:
                score += 20.0
            elif t in t_lower:
                score += 5.0

        if score > best_score:
            best_score = score
            best_heading = sec["heading"]

    return best_heading if best_score > 0 else None
