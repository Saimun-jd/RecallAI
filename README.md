# Recall: AI-powered PDF Study Assistant

Recall is an intelligent desktop application designed for leveraging the power of ai for active recall, and rigorous academic assessment. It transforms static PDF documents into an interactive learning pipeline, combining a modern PDF viewer with AI-driven extraction of structured concepts, flashcards, and Socratic diagnostic drills.
![Recall Logo](./desktop/app-icon.png)

## The Perspective

Recall is built on the philosophy that **true mastery requires causal understanding, not just surface-level memorization.** 

Unlike traditional spaced-repetition tools (like Anki) that expect you to manually write flashcards, Recall uses a local-first AI engine to process your textbooks and automatically generates Q&A flashcards designed to test mechanisms, counterfactuals, and applied scenarios. 

If you want to test your deep understanding, Recall's **Socratic Diagnostic Drill** will actively examine you, grade your free-form answers, diagnose misconceptions, and dynamically generate remedial flashcards to fill your knowledge gaps.

## Core Features

- **FSRS Algorithm:** Employs the Free Spaced Repetition Scheduler for highly optimized review intervals, drastically reducing review burden compared to legacy algorithms.
- **Socratic Diagnostic Drills:** Evaluates your free-form answers against ground truth using Automated Short Answer Grading (ASAG), providing hints and "Socratic Nudges" for edge cases.
- **Local-First & Privacy Centric:** Built to run on local LLMs (like Ollama) to ensure your proprietary PDFs and notes never leave your machine unless you explicitly opt-in to cloud providers.
- **Premium Academic Aesthetics:** A distraction-free UI utilizing sophisticated serif typography, soft diffusion drop-shadows, and elegant data visualization.
- **Markdown-Native:** All topics, notes, and flashcards are managed in rich Markdown, fully supporting math equations and syntax-highlighted code snippets.

---

## Architecture Overview

Recall uses a modern **Monorepo / Sidecar** architecture:

- **Frontend (Tauri + React + Vite):** A blazing-fast, cross-platform desktop UI built with TailwindCSS and Redux Toolkit.
- **Backend (Python + FastAPI):** Runs seamlessly as a bundled Tauri sidecar. It handles all PDF parsing, SQLite database operations, and LLM communication.
- **Database (SQLite WAL):** A fully local database stored in your system's user data directory, with Write-Ahead Logging for high concurrency.

---

## Configuration & LLM Setup

Recall supports a flexible Factory Pattern for LLM providers. You can configure your provider within the app's **Settings** menu.

1. **Local LLMs (Recommended for Privacy):**
   - Install [Ollama](https://ollama.ai/) on your machine.
   - Pull a capable model (e.g., `ollama run gemma3:4b` or `llama3.1`).
   - In Recall's settings, select **Ollama** as your active provider.
2. **Cloud LLMs (For Speed/Quality):**
   - In Recall's settings, you can securely enter API keys for **OpenAI**, **Gemini**, or **Groq**.
   - These keys are stored safely in your operating system's native keychain, not in plaintext.
3. **Analyze the AI output by tracing it using langfuse**
   - In Recall's settings, you can securely enter your Langfuse keys.
   - These keys are stored safely in your operating system's native keychain, not in plaintext.

---

## Development Setup

To run Recall locally for development, you will need the Rust toolchain (for Tauri), Node.js / pnpm, and Python 3.10+.

### 1. Install Backend Dependencies
Before running the app, ensure the Python backend dependencies are installed.
```bash
# From the root directory
python -m venv .venv
source .venv/bin/activate  # Or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### 2. Run the Backend & Frontend Separately (Recommended for Dev)
Because Tauri bundles the backend as a "sidecar" on port `8000`, running both manually during development prevents port conflicts and provides better backend logs.

**Terminal 1 (Backend):**
```bash
# From the root directory
uvicorn app.main:app --port 8000 --reload
```

**Terminal 2 (Frontend):**
```bash
cd desktop
pnpm install
pnpm tauri dev
```

> **Note on Port Conflicts:** If the frontend crashes or fails to boot, ensure there are no orphaned Python processes holding port `8000` open (`WinError 10013`). You can kill the process manually if needed.

### 3. Build the Backend Sidecar for Production
If you make changes to the Python backend and want to compile a production Tauri build, you must rebuild the sidecar binary using PyInstaller:

```bash
# From the /app directory
pyinstaller --onefile --clean --name recall-backend --collect-all pymupdf --collect-all pymupdf4llm --collect-all markdown_it --hidden-import python_multipart --hidden-import multipart __main__.py
```
After building the sidecar, you can build the Tauri app normally via `pnpm tauri build` by navigating to `/desktop` directory.
