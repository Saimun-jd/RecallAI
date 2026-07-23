import argparse
import json
import math
import os
import re
import sys
import time

import fitz  # PyMuPDF
import httpx
import questionary
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


# ---------------------------------------------------------------------------
# TOC Discovery & Fallback Parser
# ---------------------------------------------------------------------------

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
                
                if not any(entry[1] == full_title and entry[2] == page_num + 1 for entry in synthetic_toc):
                    synthetic_toc.append([level, full_title, page_num + 1])

            elif is_large_text and is_concise:
                # Unnumbered header fallback
                level = 2
                if not any(entry[1] == block_text and entry[2] == page_num + 1 for entry in synthetic_toc):
                    synthetic_toc.append([level, block_text, page_num + 1])

    return synthetic_toc


def get_toc_entries(doc):
    """Returns table of contents from PDF metadata or fallback heading scan."""
    toc = doc.get_toc()
    if not toc:
        console.print(
            "[yellow]No embedded Table of Contents found. Scanning document text for headings...[/yellow]"
        )
        toc = extract_fallback_toc(doc)
    return toc


def build_granular_toc(toc, total_pages):
    """Computes exact end_page boundaries for every entry in the TOC hierarchy."""
    granular_toc = []
    for i, entry in enumerate(toc):
        level, title, start_page = entry
        end_page = total_pages

        # Find the next item with equal or higher structural hierarchy (<= level)
        for j in range(i + 1, len(toc)):
            if toc[j][0] <= level:
                end_page = max(start_page, toc[j][2] - 1)
                break

        granular_toc.append({
            "level": level,
            "title": title,
            "start_page": start_page,
            "end_page": end_page,
        })
    return granular_toc


# ---------------------------------------------------------------------------
# Subtopic Discovery
# ---------------------------------------------------------------------------

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
            if chapter_title.lower() in entry["title"].lower():
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
        if subtopic_title.lower() in entry["title"].lower():
            return entry
    return None


# ---------------------------------------------------------------------------
# PDF Slicing & Auto-Chunking
# ---------------------------------------------------------------------------

def split_page_range(start_page, end_page, max_pages):
    """Splits oversized page ranges into smaller sequential chunks."""
    sub_ranges = []
    curr_start = start_page
    while curr_start <= end_page:
        curr_end = min(curr_start + max_pages - 1, end_page)
        sub_ranges.append((curr_start, curr_end))
        curr_start = curr_end + 1
    return sub_ranges


def slice_pdf(doc, start_page, end_page):
    """Slices PDF from start_page to end_page (1-indexed). Returns bytes."""
    start_idx = max(0, start_page - 1)
    end_idx = min(doc.page_count - 1, end_page - 1)

    new_doc = fitz.open()
    new_doc.insert_pdf(doc, from_page=start_idx, to_page=end_idx)
    pdf_bytes = new_doc.write()
    new_doc.close()
    return pdf_bytes


def upload_chunk(endpoint, pdf_bytes, filename, chapter_title, start_page):
    """Uploads sliced PDF bytes to the backend chunk service."""
    files = {"file": (filename, pdf_bytes, "application/pdf")}
    data = {"pre_sliced": "true", "start_page": str(start_page)}
    if chapter_title:
        data["chapter_title"] = chapter_title

    try:
        with console.status(
            "[cyan]Uploading & processing with LLM...[/cyan]", spinner="dots"
        ):
            start_time = time.time()
            response = httpx.post(endpoint, files=files, data=data, timeout=900.0)
            response.raise_for_status()
            duration = time.time() - start_time
        return response.json(), duration
    except httpx.HTTPStatusError as e:
        console.print(
            f"[red]HTTP Error: {e.response.status_code} - {e.response.text}[/red]"
        )
        return None, 0
    except httpx.ConnectError:
        console.print(
            f"[red]Could not connect to service at {endpoint}. "
            "Is the backend server running?[/red]"
        )
        return None, 0
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        return None, 0


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Interactive CLI for Parsing PDFs & Granular Flashcard Generation"
    )
    parser.add_argument("-f", "--file", required=True, help="Path to local PDF file")
    parser.add_argument("-c", "--chapter", help="Target main chapter title")
    parser.add_argument(
        "-s", "--subtopic", help="Skip interactive prompt and use this subtopic title"
    )
    parser.add_argument(
        "-p", "--pages", help="Manual page range override (e.g., '12-18')"
    )
    parser.add_argument(
        "-o", "--output-dir", default="output", help="Output directory (default: output/)"
    )
    parser.add_argument(
        "-m", "--max-pages", type=int, default=4, help="Max pages per LLM chunk (default: 4)"
    )
    parser.add_argument(
        "-e", "--endpoint", default="http://127.0.0.1:8000/chunk", help="Backend API endpoint"
    )

    args = parser.parse_args()

    if not os.path.exists(args.file):
        console.print(f"[red]File not found: {args.file}[/red]")
        sys.exit(1)

    original_size = os.path.getsize(args.file)
    console.print(
        Panel(
            f"[bold blue]PDF Analyzer & Granular Flashcard Generator[/bold blue]\n"
            f"File: {args.file}\n"
            f"Size: {original_size / 1024:.1f} KB\n"
            f"Max Pages Per Chunk: {args.max_pages}"
        )
    )

    doc = fitz.open(args.file)
    total_pages = doc.page_count

    try:
        selected_ranges = []

        # 1. Manual Page Range Override
        if args.pages:
            try:
                start, end = map(int, args.pages.split("-"))
                if start < 1 or end > total_pages or start > end:
                    console.print(
                        f"[red]Page range {start}-{end} out of bounds (1-{total_pages}).[/red]"
                    )
                    sys.exit(1)
                selected_ranges.append({
                    "title": args.chapter or f"Pages {start}-{end}",
                    "start": start,
                    "end": end,
                })
            except ValueError:
                console.print("[red]Invalid page format. Use 'start-end' (e.g., 12-18)[/red]")
                sys.exit(1)

        else:
            toc = get_toc_entries(doc)
            granular_toc = build_granular_toc(toc, total_pages)

            # 2. Subtopic Command Line Override
            if args.subtopic:
                found = search_toc_by_title(granular_toc, args.subtopic)
                if found:
                    selected_ranges.append({
                        "title": found["title"],
                        "start": found["start_page"],
                        "end": found["end_page"],
                    })
                else:
                    console.print(f"[red]Subtopic '{args.subtopic}' not found in TOC.[/red]")
                    sys.exit(1)

            # 3. Interactive Menu
            else:
                subtopics = find_subtopics(total_pages, toc, args.chapter)
                if not subtopics:
                    console.print("[yellow]No subtopics found for selection.[/yellow]")
                    sys.exit(1)

                choices = [
                    questionary.Choice(
                        title=f"{'  ' * (sub['level'] - 1)}• {sub['title']} (Pages {sub['start_page']}-{sub['end_page']})",
                        value=sub,
                    )
                    for sub in subtopics
                ]

                selected_subs = questionary.checkbox(
                    "Select subtopics to process (<Space> select, <a> all, <Enter> confirm):",
                    choices=choices,
                    validate=lambda ans: True if len(ans) > 0 else "Select at least one topic.",
                ).ask()

                if not selected_subs:
                    console.print("[yellow]No sections selected. Exiting.[/yellow]")
                    sys.exit(0)

                for sub in selected_subs:
                    selected_ranges.append({
                        "title": sub["title"],
                        "start": sub["start_page"],
                        "end": sub["end_page"],
                    })

        # ------------------------------------------------------------------
        # Auto-Chunking & Upload Pipeline
        # ------------------------------------------------------------------
        os.makedirs(args.output_dir, exist_ok=True)
        all_results = []
        doc_filename = os.path.basename(args.file)

        # Flatten giant topics into bite-sized page windows
        chunk_queue = []
        for selection in selected_ranges:
            sub_ranges = split_page_range(selection["start"], selection["end"], args.max_pages)
            for part_idx, (p_start, p_end) in enumerate(sub_ranges, 1):
                part_label = f" (Part {part_idx})" if len(sub_ranges) > 1 else ""
                chunk_queue.append({
                    "title": f"{selection['title']}{part_label}",
                    "start": p_start,
                    "end": p_end,
                })

        console.print(f"\n[bold cyan]Total LLM Payload Chunks to Process: {len(chunk_queue)}[/bold cyan]")

        for i, chunk_item in enumerate(chunk_queue, 1):
            console.print(
                f"\n[bold green]Processing Chunk {i}/{len(chunk_queue)}:[/bold green]"
                f" {chunk_item['title']} (Pages {chunk_item['start']}-{chunk_item['end']})"
            )

            pdf_bytes = slice_pdf(doc, chunk_item["start"], chunk_item["end"])
            sliced_size = len(pdf_bytes)

            console.print(f"Sliced PDF Payload: {sliced_size / 1024:.1f} KB")

            result, duration = upload_chunk(
                args.endpoint,
                pdf_bytes,
                f"sliced_{doc_filename}",
                chunk_item["title"],
                chunk_item["start"]
            )

            if result:
                chunks = result.get("chunks", [])
                if not chunks:
                    console.print(f"[yellow]No flashcards extracted for '{chunk_item['title']}'.[/yellow]")
                    continue

                safe_name = re.sub(r'[^\w\s-]', '', chunk_item['title']).strip().replace(' ', '_')[:80]
                json_path = os.path.join(args.output_dir, f"{safe_name}.json")
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump({"title": chunk_item['title'], "chunks": chunks}, f, indent=2, ensure_ascii=False)
                
                console.print(f"[green]Saved -> {json_path}[/green]")
                all_results.extend(chunks)

                table = Table(title=f"Results: {chunk_item['title']}")
                table.add_column("Topic Name", style="cyan")
                table.add_column("Type", style="magenta")
                table.add_column("Summary", style="green")

                for chunk in chunks:
                    table.add_row(
                        chunk.get("topic_name", "N/A"),
                        chunk.get("concept_type", "N/A"),
                        chunk.get("summary", "N/A"),
                    )

                console.print(table)
                console.print(f"[bold]Processing Time:[/bold] {duration:.2f}s | [bold]Flashcards:[/bold] {len(chunks)}")

        if all_results:
            combined_path = os.path.join(args.output_dir, "_combined.json")
            with open(combined_path, "w", encoding="utf-8") as f:
                json.dump({"total_chunks": len(all_results), "chunks": all_results}, f, indent=2, ensure_ascii=False)
            console.print(f"\n[bold green]Combined results -> {combined_path}[/bold green]")
            console.print(f"[bold]Grand Total Flashcards Generated: {len(all_results)}[/bold]")

    finally:
        doc.close()


if __name__ == "__main__":
    main()