# CLI Instructions for Recall Ingestion Tool (`cli.py`)

The `cli.py` script is a powerful tool to ingest PDFs, extract semantic topics, and generate on-demand active recall flashcards. It is designed to be interactive, but also supports full automation via command-line flags.

## Basic Usage

The only required argument is the path to your PDF file (`-f`).

```bash
python cli.py -f "path/to/your/book.pdf"
```
*If you run this, the CLI will interactively ask you to select an LLM provider and then parse the Table of Contents so you can select which subtopics to ingest.*

## Command-Line Arguments

Here is the complete list of available flags you can pass to `cli.py`:

| Short | Long Flag       | Description |
|-------|-----------------|-------------|
| `-f`  | `--file`        | **(Required)** Path to the local PDF file you want to process. |
| `-p`  | `--pages`       | Manual page range override (e.g., `'12-18'`). Skips the TOC extraction and forces the parser to only read the specified pages. |
| `-c`  | `--chapter`     | Target a main chapter title by name. |
| `-s`  | `--subtopic`    | Skip the interactive checkbox prompt and automatically process the specific subtopic title provided. |
| `--provider` |            | Override the interactive LLM provider selection. Valid options are `openai` or `ollama`. |
| `-m`  | `--max-pages`   | Maximum number of pages to process per LLM chunk payload. Default is `4`. |
| `-e`  | `--endpoint`    | URL to the backend API endpoint. Default is `http://127.0.0.1:8000/chunk`. |
| `-o`  | `--output-dir`  | Directory where JSON results will be saved locally. Default is `output/`. |

---

## Usage Examples

### 1. Fully Automated Page Range Extraction
To skip all interactive prompts and strictly process pages 55 to 60 using the OpenAI provider:
```bash
python cli.py -f "Deep Learning with Python.pdf" -p 55-60 --provider openai
```

### 2. Process a Specific Subtopic by Name
If you know the exact name of a subtopic from the PDF's Table of Contents:
```bash
python cli.py -f "Biology_101.pdf" -s "Cellular Respiration" --provider ollama
```

### 3. Change Backend Port or Endpoint
If your FastAPI server is running on a different port (e.g., 8002) or on a remote server:
```bash
python cli.py -f "Math_Textbook.pdf" -e "http://127.0.0.1:8002/chunk"
```

### 4. Adjust Chunking Size for API Limits
If you are running into token limits, you can reduce the maximum number of pages sent to the LLM per API call:
```bash
python cli.py -f "History_Book.pdf" -p 10-20 -m 2
```
*This will break pages 10-20 into 5 separate chunks (2 pages each) and stream them sequentially.*

---

## On-Demand Flashcard Generation

Once the initial ingestion finishes, the CLI enters an **interactive loop** allowing you to generate flashcards for any extracted topic:

```text
? Generate Flashcards for a topic? (Enter Topic ID or 'q' to quit)
> 42
  How many flashcards? (Default: 5): 3
  Custom Instructions (Optional): focus on python syntax
```

- **Topic ID**: Must match an `ID` from the table printed right before the prompt.
- **How many**: The exact number of flashcards the LLM should generate.
- **Custom Instructions**: Optional context or instructions to steer the LLM (e.g., "Make it a cloze deletion", "Focus only on formulas", "Make the questions very difficult").
