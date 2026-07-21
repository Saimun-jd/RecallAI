import argparse
import json
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
# TOC Discovery
# ---------------------------------------------------------------------------

def extract_fallback_toc(doc):
    """Fallback parser: Detects headings using Font Size analysis + Broad Regex patterns.

    This ensures Main Chapters (Level 1), Subchapters (Level 2), and
    Sub-sections (Level 3) are all captured correctly when embedded bookmarks
    are missing.
    """
    synthetic_toc = []

    # Matches:
    # - "Chapter 1 Title", "CHAPTER 2"
    # - Single numbers: "1 Introduction", "2 Building Blocks"
    # - Dotted numbers: "2.1 Vectors", "10.2.1 Preparing the data"
    heading_pattern = re.compile(
        r"^((?:Chapter\s+\d+|[0-9]+(?:\.[0-9]+)*))\s+(.+)", re.IGNORECASE
    )

    # 1. Analyze average body text font size across sample pages to set threshold
    font_sizes = []
    sample_pages = min(15, len(doc))
    for p in range(sample_pages):
        blocks = doc[p].get_text("dict")["blocks"]
        for b in blocks:
            if "lines" in b:
                for line in b["lines"]:
                    for span in line["spans"]:
                        font_sizes.append(span["size"])

    avg_font_size = sum(font_sizes) / len(font_sizes) if font_sizes else 10.0

    # 2. Iterate through pages and identify headings based on font size & structure
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

            # Filter out standard body text (headings will have larger fonts)
            is_large_text = max_span_size > (avg_font_size * 1.15)

            match = heading_pattern.match(block_text)
            if match and is_large_text:
                num_part, title_part = match.groups()

                # Determine level in table of contents hierarchy
                if "chapter" in num_part.lower():
                    level = 1
                elif "." not in num_part:
                    level = 1  # Single section numbers like "1" or "2"
                else:
                    level = min(
                        3, num_part.count(".") + 1
                    )  # "2.1" -> level 2, "2.1.1" -> level 3

                full_title = f"{num_part} {title_part}".strip()

                # Prevent adding duplicates on the same page
                if not any(
                    entry[1] == full_title and entry[2] == page_num + 1
                    for entry in synthetic_toc
                ):
                    synthetic_toc.append([level, full_title, page_num + 1])

    return synthetic_toc


def get_toc_entries(doc):
    """Return table of contents from PDF metadata or fallback heading scan."""
    toc = doc.get_toc()
    if not toc:
        console.print(
            "[yellow]No embedded Table of Contents found. Scanning document text for headings...[/yellow]"
        )
        toc = extract_fallback_toc(doc)
    return toc


# ---------------------------------------------------------------------------
# Subtopic Discovery
# ---------------------------------------------------------------------------

def _find_chapter_boundary(toc, chapter_index, chapter_level, total_pages):
    """Find the last page belonging to a chapter (before the next sibling/parent starts)."""
    for j in range(chapter_index + 1, len(toc)):
        if toc[j][0] <= chapter_level:
            return toc[j][2] - 1
    return total_pages


def find_subtopics(total_pages, toc, chapter_title=None):
    """Find subtopics for a given chapter.

    If chapter_title is None, returns top-level chapters and main sections.

    Args:
        total_pages: Total page count of the document (int, not the doc object).
        toc: List of [level, title, page] entries.
        chapter_title: Optional chapter to drill into.
    """
    if not toc:
        return []

    results = []

    if chapter_title:
        chapter_level = None
        chapter_end_page = total_pages
        in_chapter = False

        for i, entry in enumerate(toc):
            level, title, page = entry

            if not in_chapter:
                if chapter_title.lower() in title.lower():
                    in_chapter = True
                    chapter_level = level
                    # Flaw 2 fix: compute the chapter's own boundary so children
                    # don't default to the last page of the entire document
                    chapter_end_page = _find_chapter_boundary(
                        toc, i, chapter_level, total_pages
                    )

                    has_children = (i + 1 < len(toc)) and (toc[i + 1][0] > level)
                    if not has_children:
                        # No children — offer the whole chapter as one selection
                        return [{
                            "title": title,
                            "start_page": page,
                            "end_page": chapter_end_page,
                            "level": level,
                        }]
                    continue
            else:
                if level <= chapter_level:
                    break

                # Cap end_page at the chapter boundary, not doc end
                end_page = chapter_end_page
                for j in range(i + 1, len(toc)):
                    if toc[j][0] <= level:
                        end_page = toc[j][2] - 1
                        break

                results.append({
                    "title": title,
                    "start_page": page,
                    "end_page": max(page, end_page),
                    "level": level,
                })
    else:
        # Show top level and direct section children when no specific chapter is targeted
        min_level = min(entry[0] for entry in toc) if toc else 1
        for i, entry in enumerate(toc):
            level, title, page = entry
            if level <= min_level + 1:
                end_page = total_pages
                for j in range(i + 1, len(toc)):
                    if toc[j][0] <= level:
                        end_page = toc[j][2] - 1
                        break
                results.append({
                    "title": title,
                    "start_page": page,
                    "end_page": max(page, end_page),
                    "level": level,
                })

    return results


def _search_toc_by_title(toc, subtopic_title, total_pages):
    """Search ALL TOC entries for a subtopic by title substring match.

    Unlike find_subtopics (which filters by level), this searches the entire
    TOC so that deep entries like "2.1.1 Vectors" are always reachable.
    """
    for i, entry in enumerate(toc):
        level, title, page = entry
        if subtopic_title.lower() in title.lower():
            end_page = total_pages
            for j in range(i + 1, len(toc)):
                if toc[j][0] <= level:
                    end_page = toc[j][2] - 1
                    break
            return {
                "title": title,
                "start_page": page,
                "end_page": max(page, end_page),
                "level": level,
            }
    return None


# ---------------------------------------------------------------------------
# PDF Slicing & Upload
# ---------------------------------------------------------------------------

def slice_pdf(doc, start_page, end_page):
    """Slice PDF from start_page to end_page (1-indexed). Returns bytes."""
    start_idx = max(0, start_page - 1)
    end_idx = min(doc.page_count - 1, end_page - 1)

    new_doc = fitz.open()
    new_doc.insert_pdf(doc, from_page=start_idx, to_page=end_idx)
    pdf_bytes = new_doc.write()
    new_doc.close()
    return pdf_bytes


def upload_chunk(pdf_bytes, filename, chapter_title, start_page):
    """Upload sliced PDF bytes to the backend chunk service.

    Sends ``pre_sliced=true`` so the backend skips the chapter_title heading
    filter (since we already sliced the PDF to the exact pages).
    ``chapter_title`` is forwarded only for breadcrumb label construction.
    """
    url = "http://localhost:8000/chunk"

    files = {"file": (filename, pdf_bytes, "application/pdf")}
    data = {"pre_sliced": "true", "start_page": str(start_page)}
    if chapter_title:
        data["chapter_title"] = chapter_title

    try:
        with console.status(
            "[cyan]Uploading & processing with LLM...[/cyan]", spinner="dots"
        ):
            start_time = time.time()
            response = httpx.post(url, files=files, data=data, timeout=900.0)
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
            "[red]Could not connect to chunk service at http://localhost:8000. "
            "Is the server running?[/red]"
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
        description="Interactive CLI for Chunk Service"
    )
    parser.add_argument(
        "-f", "--file", required=True, help="Path to local PDF file"
    )
    parser.add_argument("-c", "--chapter", help="Target main chapter title")
    parser.add_argument(
        "-s",
        "--subtopic",
        help="Skip interactive prompt and use this subtopic directly",
    )
    parser.add_argument(
        "-p", "--pages", help="Manual page range override (e.g., '12-18')"
    )
    parser.add_argument(
        "-o", "--output-dir", default="output",
        help="Directory to save JSON results (default: output/)",
    )

    args = parser.parse_args()

    if not os.path.exists(args.file):
        console.print(f"[red]File not found: {args.file}[/red]")
        sys.exit(1)

    original_size = os.path.getsize(args.file)
    console.print(
        Panel(
            f"[bold blue]PDF Analyzer[/bold blue]\n"
            f"File: {args.file}\n"
            f"Size: {original_size / 1024:.1f} KB"
        )
    )

    doc = fitz.open(args.file)
    total_pages = doc.page_count

    try:
        selected_ranges = []

        # 1. Manual Page Range Override — skip TOC scan entirely (Flaw 7 fix)
        if args.pages:
            try:
                start, end = map(int, args.pages.split("-"))
                if start < 1 or end > total_pages or start > end:
                    console.print(
                        f"[red]Page range {start}-{end} is out of bounds "
                        f"(document has {total_pages} pages).[/red]"
                    )
                    sys.exit(1)
                selected_ranges.append({
                    "title": args.chapter or f"Pages {start}-{end}",
                    "start": start,
                    "end": end,
                })
            except ValueError:
                console.print(
                    "[red]Invalid page format. Use 'start-end' (e.g., 12-18)[/red]"
                )
                sys.exit(1)

        else:
            # TOC scan only happens when we actually need it
            toc = get_toc_entries(doc)

            # 2. Direct Subtopic Override — search ALL TOC entries (Flaw 4 fix)
            if args.subtopic:
                if not toc:
                    console.print(
                        "[red]No headings found in document. Cannot search for subtopic.[/red]"
                    )
                    sys.exit(1)

                found = _search_toc_by_title(toc, args.subtopic, total_pages)
                if found:
                    selected_ranges.append({
                        "title": found["title"],
                        "start": found["start_page"],
                        "end": found["end_page"],
                    })
                else:
                    console.print(
                        f"[red]Subtopic '{args.subtopic}' not found in document.[/red]"
                    )
                    sys.exit(1)

            # 3. Interactive Menu
            else:
                if not toc:
                    console.print(
                        "[yellow]Could not detect any headings in document. You can"
                        " pass manual page range using -p START-END.[/yellow]"
                    )
                    sys.exit(1)

                subtopics = find_subtopics(total_pages, toc, args.chapter)

                if not subtopics:
                    console.print(
                        f"[yellow]No subtopics found for '{args.chapter}'. "
                        f"Try a different chapter name or use -p for manual pages.[/yellow]"
                    )
                    sys.exit(1)

                choices = [
                    questionary.Choice(
                        title=(
                            f"{sub['title']} (Pages"
                            f" {sub['start_page']}-{sub['end_page']})"
                        ),
                        value=sub,
                    )
                    for sub in subtopics
                ]

                selected_subs = questionary.checkbox(
                    "Select topics to process"
                    " (Use <Space> to select, <a> for all, <Enter> to confirm):",
                    choices=choices,
                    validate=lambda ans: (
                        True if len(ans) > 0
                        else "Please select at least one topic using <Space>"
                        " before pressing <Enter>."
                    ),
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
        # Process selections sequentially
        # ------------------------------------------------------------------
        os.makedirs(args.output_dir, exist_ok=True)
        all_results = []
        doc_filename = os.path.basename(args.file)

        for i, selection in enumerate(selected_ranges, 1):
            console.print(
                f"\n[bold green]Processing {i}/{len(selected_ranges)}:[/bold green]"
                f" {selection['title']} (Pages {selection['start']}-{selection['end']})"
            )

            pdf_bytes = slice_pdf(doc, selection["start"], selection["end"])
            sliced_size = len(pdf_bytes)

            console.print(
                f"Sliced PDF: {sliced_size / 1024:.1f} KB"
                f" ({(sliced_size / original_size) * 100:.1f}% of original)"
            )

            result, duration = upload_chunk(
                pdf_bytes, f"sliced_{doc_filename}", selection["title"], selection["start"]
            )

            if result:
                chunks = result.get("chunks", [])

                if not chunks:
                    console.print(
                        f"[yellow]No flashcards extracted for '{selection['title']}'. "
                        f"The section may be too short or contain only non-textual content.[/yellow]"
                    )
                    continue

                # Save individual JSON file
                safe_name = re.sub(r'[^\w\s-]', '', selection['title']).strip().replace(' ', '_')[:80]
                json_path = os.path.join(args.output_dir, f"{safe_name}.json")
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump({"title": selection['title'], "chunks": chunks}, f, indent=2, ensure_ascii=False)
                console.print(f"[green]Saved → {json_path}[/green]")

                all_results.extend(chunks)

                table = Table(
                    title=f"Extracted Flashcards for {selection['title']}"
                )
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
                console.print(
                    f"[bold]Upload & Processing Time:[/bold] {duration:.2f}s"
                )
                console.print(
                    f"[bold]Total Chunks Extracted:[/bold] {len(chunks)}"
                )

        # Save combined results if multiple selections were processed
        if len(selected_ranges) > 1 and all_results:
            combined_path = os.path.join(args.output_dir, "_combined.json")
            with open(combined_path, "w", encoding="utf-8") as f:
                json.dump({"total_chunks": len(all_results), "chunks": all_results}, f, indent=2, ensure_ascii=False)
            console.print(f"\n[bold green]Combined results → {combined_path}[/bold green]")

        if all_results:
            console.print(f"[bold]Grand Total: {len(all_results)} flashcards saved to {args.output_dir}/[/bold]")

    finally:
        doc.close()


if __name__ == "__main__":
    main()