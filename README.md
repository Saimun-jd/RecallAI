# Recall Desktop

Recall is an intelligent desktop application that helps you extract, manage, and study knowledge from PDF documents. It acts as an interactive learning pipeline, combining a modern PDF viewer with AI-driven extraction of structured concepts, flashcards, and notes.

## Architecture

Recall is built using a modern desktop stack with an embedded AI backend:

*   **Frontend (Tauri + React + Vite):** A cross-platform desktop UI providing a fast, interactive PDF viewer, command palette, Notion-style markdown note editor, and study/flashcard interface.
*   **Backend (Python + FastAPI):** Runs seamlessly as a bundled Tauri sidecar binary to handle file processing, database operations, and LLM communication.
*   **Database (SQLite):** A fully local SQLite database stored in your system's user data directory (no PostgreSQL or Docker required). 
*   **AI Providers:** Flexible LLM integration supporting cloud providers (OpenAI, Groq, Gemini) and local models (Ollama) to perform intelligent text segmentation and flashcard generation.

## Features

*   **Interactive PDF Annotation:** Highlight and annotate directly on PDFs with an integrated reader.
*   **AI Knowledge Extraction:** Automatically generate atomic topics, summaries, and flashcards from document sections.
*   **Multi-LLM Support:** Choose your preferred AI backend (Groq, OpenAI, Gemini, or local Ollama).
*   **Notion-style Notes:** Edit extracted knowledge and write your own notes using a rich markdown editor.
*   **Spaced Repetition Review:** Study generated flashcards directly within the app.

## Development Setup

To run Recall locally for development, you will need the Rust toolchain (for Tauri), Node.js / pnpm, and Python 3.10+.

### 1. Start the Desktop App

The frontend is located in the `desktop/` directory.

```bash
cd desktop
pnpm install
pnpm tauri dev
```

### 2. (Optional) Run the Backend Independently

During `tauri dev`, Tauri will automatically attempt to run the bundled Python sidecar. If you want to run the FastAPI backend independently for API testing or CLI usage:

```bash
# From the root directory
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### 3. Build the Backend Sidecar

If you make changes to the Python backend, you must rebuild the sidecar binary so Tauri can bundle it:

```bash
# This uses PyInstaller to compile the backend into a standalone executable
python scripts/build_sidecar.py
```

## CLI Usage (Legacy/Debug)

The repository still contains the original CLI utility (`cli.py`) which can be used to interactively process documents against a running backend instance.

```bash
python cli.py -f "path/to/document.pdf"
```

## Branch Notice

*Note: Integration with the `MinerU` parsing pipeline is maintained separately on the `dev_saimun` branch.*
