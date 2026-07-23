import argparse
import hashlib
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
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn

console = Console()


from app.toc_parser import (
    get_toc_entries,
    build_granular_toc,
    find_subtopics,
    search_toc_by_title,
)

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


def upload_chunk(
    endpoint: str,
    pdf_bytes: bytes,
    filename: str,
    chapter_title: str | None = None,
    start_page: int | None = None,
    provider: str | None = None,
    file_hash: str | None = None,
    book_title: str | None = None,
    total_pages: int | None = None,
    progress=None,
    task_id=None
):
    """Uploads sliced PDF bytes to the backend chunk service."""
    files = {"file": (filename, pdf_bytes, "application/pdf")}
    data = {"pre_sliced": "true", "start_page": str(start_page)}
    if chapter_title:
        data["chapter_title"] = chapter_title
    if provider:
        data["provider"] = provider
    if file_hash:
        data["file_hash"] = file_hash
    if book_title:
        data["book_title"] = book_title
    if total_pages is not None:
        data["total_pages"] = str(total_pages)

    stream_endpoint = endpoint.rstrip("/") + "/stream"
    try:
        start_time = time.time()
        chunks = []
        with httpx.Client(timeout=900.0) as client:
            with client.stream("POST", stream_endpoint, files=files, data=data) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if line.startswith("data: "):
                        event_data = line[6:]
                        try:
                            payload = json.loads(event_data)
                            stage = payload.get("stage", "")
                            sections = payload.get("sections", 0)
                            
                            desc = f"[cyan]{stage}...[/cyan]"
                            if stage == "Waiting on LLM response" and sections > 0:
                                desc = f"[cyan]{stage} ({sections} sections)...[/cyan]"
                                
                            if progress and task_id is not None:
                                progress.update(task_id, description=desc)
                            else:
                                console.print(desc)
                                
                            if stage == "done":
                                chunks = payload.get("chunks", [])
                            elif stage == "error":
                                err = payload.get("error")
                                if progress:
                                    progress.print(f"[red]Backend Error: {err}[/red]")
                                else:
                                    console.print(f"[red]Backend Error: {err}[/red]")
                                return None, 0
                        except json.JSONDecodeError:
                            pass
                            
        duration = time.time() - start_time
        return {"chunks": chunks}, duration
    except httpx.HTTPStatusError as e:
        err_msg = f"[red]HTTP Error: {e.response.status_code} - {e.response.text}[/red]"
        if progress:
            progress.print(err_msg)
        else:
            console.print(err_msg)
        return None, 0
    except httpx.ConnectError:
        err_msg = f"[red]Could not connect to service at {stream_endpoint}. Is the backend server running?[/red]"
        if progress:
            progress.print(err_msg)
        else:
            console.print(err_msg)
        return None, 0
    except Exception as e:
        err_msg = f"[red]Error: {e}[/red]"
        if progress:
            progress.print(err_msg)
        else:
            console.print(err_msg)
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
    parser.add_argument(
        "--provider", choices=["ollama", "openai"], help="Override default LLM provider"
    )

    args = parser.parse_args()

    if not os.path.exists(args.file):
        console.print(f"[red]File not found: {args.file}[/red]")
        sys.exit(1)

    original_size = os.path.getsize(args.file)
    with open(args.file, "rb") as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()
    doc_filename = os.path.basename(args.file)
    
    console.print(
        Panel(
            f"[bold blue]PDF Analyzer & Granular Flashcard Generator[/bold blue]\n"
            f"File: {args.file}\n"
            f"Size: {original_size / 1024:.1f} KB\n"
            f"Hash: {file_hash[:8]}...\n"
            f"Max Pages Per Chunk: {args.max_pages}"
        )
    )

    doc = fitz.open(args.file)
    total_pages = doc.page_count

    # Interactive Provider Selection if not specified
    selected_provider = args.provider
    if not selected_provider:
        console.print("\n[bold cyan]? Select LLM Provider for this session:[/bold cyan]")
        console.print("  [1] openai (Public Cloud/Groq)")
        console.print("  [2] ollama (Local Containerized)")
        
        while True:
            ans = input("Enter 1 or 2 (Default: 1): ").strip()
            if not ans or ans == "1":
                selected_provider = "openai"
                break
            elif ans == "2":
                selected_provider = "ollama"
                break
            else:
                console.print("[red]Invalid choice. Please enter 1 or 2.[/red]")

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

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            console=console
        ) as progress:
            overall_task = progress.add_task("[green]Overall Progress...", total=len(chunk_queue))
            
            for i, chunk_item in enumerate(chunk_queue, 1):
                progress.print(
                    f"\n[bold green]Processing Chunk {i}/{len(chunk_queue)}:[/bold green]"
                    f" {chunk_item['title']} (Pages {chunk_item['start']}-{chunk_item['end']})"
                )

                pdf_bytes = slice_pdf(doc, chunk_item["start"], chunk_item["end"])
                sliced_size = len(pdf_bytes)

                progress.print(f"Sliced PDF Payload: {sliced_size / 1024:.1f} KB")

                chunk_task = progress.add_task(f"[cyan]Initializing...[/cyan]", total=None)

                result, duration = upload_chunk(
                    args.endpoint,
                    pdf_bytes,
                    f"sliced_{doc_filename}",
                    chunk_item["title"],
                    chunk_item["start"],
                    provider=selected_provider,
                    file_hash=file_hash,
                    book_title=doc_filename,
                    total_pages=total_pages,
                    progress=progress,
                    task_id=chunk_task
                )

                progress.remove_task(chunk_task)
                progress.advance(overall_task)

                if result:
                    chunks = result.get("chunks", [])
                    if not chunks:
                        progress.print(f"\n[yellow]No flashcards extracted for '{chunk_item['title']}'.[/yellow]")
                        continue

                    safe_name = re.sub(r'[^\w\s-]', '', chunk_item['title']).strip().replace(' ', '_')[:80]
                    json_path = os.path.join(args.output_dir, f"{safe_name}.json")
                    with open(json_path, "w", encoding="utf-8") as f:
                        json.dump({"title": chunk_item['title'], "chunks": chunks}, f, indent=2, ensure_ascii=False)
                    
                    progress.print(f"[green]Saved -> {json_path}[/green]")
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

                    progress.print(table)
                    progress.print(f"[bold]Processing Time:[/bold] {duration:.2f}s | [bold]Flashcards:[/bold] {len(chunks)}")

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