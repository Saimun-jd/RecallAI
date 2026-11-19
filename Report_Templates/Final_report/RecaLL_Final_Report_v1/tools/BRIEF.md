> **Note (17 Nov 2026):** this is the original brief used to write version 1. Absolute paths below refer to the original author's PC; read them as relative to the repository root. Several facts were corrected afterwards (embeddings, Socratic grading, route counts, key storage, upload path). Where this file disagrees with ../CHANGES.md, CHANGES.md is correct.

# Shared brief for everyone building RecaLL_Final_Report_v1

The report folder (ROOT) is `D:/Projects/Recall-Ai/Report_Templates/Final_report/RecaLL_Final_Report_v1`. The code lives in the repository `D:/Projects/Recall-Ai`.

Read `../REPORT_PLAN.md` (one level above ROOT) first.

The reference report is `../Porikroma_Final_Report (4).pdf`. Use it as a guide to depth and tone, and read it with pymupdf. Our report should end up at roughly 80–110 pages.

## Facts (checked against the code; re-check anything you rely on)

- **Product.** RecaLL, also called "Recall AI". The Tauri `productName` is "Recall", version 0.1.5.
  - It is a local-first desktop app: a Tauri v2 shell around a React 19 + TypeScript + Vite UI, plus a local FastAPI backend. In the packaged build, the backend is a PyInstaller "sidecar".
  - Development launch: `run.bat` starts uvicorn on 127.0.0.1:8000 and `pnpm dev` on 5173.
- **Versions (installed).**
  - Backend: FastAPI 0.162, uvicorn 0.54, PyMuPDF/pymupdf4llm 2.1, fsrs 6.3.2, pydantic 2.14, httpx 0.28, numpy 2.5, langfuse 5.1, supabase 2.33, json-repair 0.63.3.
  - Frontend: React 19.2, react-router-dom 7, Redux Toolkit 2, Tailwind 4, Vite 8, TypeScript 6, KaTeX 0.18, pdfjs-dist 6, Recharts 3, BlockNote 0.52, Tauri 2.11, oxlint, Playwright.
- **APIs.** There are two route groups:
  - `/api/v1/*` in `app/api/v1/*.py`. It uses JWT bearer auth (`get_current_user`, `get_current_workspace`), and the database is `recall_saas.db`, 29 tables.
  - Older "study" routes in `app/main.py`: books, topics, notes, annotations, drill, settings, prompts and token usage. These use a per-user `user_<id>_recall.db`, and many have no auth check.
  - There are about 95 endpoints in total. The full list with auth flags is in `tools/routes.json`.
- **AI.**
  - `app/llm_providers/` contains `base.py` (BaseLLMProvider), `factory.py`, `gemini.py`, `openai.py`, `groq.py`, `ollama.py`, `rate_limiter.py` and `retry.py`.
  - `app/services/ai/` contains `adapters`, `base` and `service`.
  - Prompts are kept in a registry in `app/prompt_manager.py` (segment, flashcard, summary, explain, selection_flashcard, chat, socratic_question, markdown_cleanup, cornell_scaffold, socratic_evaluation, handwritten_outline_reconcile). Users can override them through `/api/prompts`.
  - Langfuse tracing is optional.
- **Document pipeline** (`app/services/pipeline.py`): validation, extraction (plugin registry in `app/extractors`, PyMuPDF4LLM by default, Marker optional), normalization, chunking (`chunker.py`), embedding and indexing. The embeddings are deterministic sha256-based placeholder vectors (`app/services/embedding.py` / `app/embeddings.py`), so search is mostly keyword-based. Say this honestly.
- **FSRS.** `app/services/scheduler.py` (FSRSScheduler) and `app/fsrs.py` use the `fsrs` library v6.3.2 (FSRS-6): desired retention 0.9, maximum interval 36,500 days, ratings Again/Hard/Good/Easy. The README's mention of "FSRS-4.5" is outdated.
- **Security.** BYOK API keys are encrypted with AES-256-GCM. Passwords use PBKDF2-HMAC-SHA256 with 600,000 iterations. Auth uses JWT. See `app/core/security.py`.
- **Known limitations** (state them honestly):
  - Billing is a mock; the webhook uses a test signature.
  - Supabase cloud sync is optional and unconfigured.
  - Legacy routes lack auth.
  - Scanned PDFs need the optional Marker extractor.
- **Socratic grading.** An earlier review said `socratic_evaluation_prompt` was missing from the registry. It is now present (`app/prompt_manager.py` around line 554; `app/socratic_drill.py` line 538 uses it). Verify this before writing anything about grading.
- **CI/CD.**
  - `.github/workflows/ci.yml` has two jobs:
    - backend: Python 3.12, `pytest app/tests`
    - frontend: pnpm 9 / Node 20, oxlint, `tsc -b && vite build`, Playwright E2E `desktop/tests/e2e/critical_user_journeys.mjs`
  - `.github/workflows/release.yml` runs on a `v*` tag. On windows-latest it builds the PyInstaller sidecar (`scripts/build_sidecar.py`), runs the pnpm build, sets up Rust, and runs tauri-action to publish the GitHub Release.
- **Git.**
  - Repository: https://github.com/Saimun-jd/RecallAI. Branch `main`.
  - HEAD is `60d40f9` (2026-11-05). The first commit is dated 2026-07-22.
  - Commits by author: Saimun-jd 31, rubayet2027 14, copilot-swe-agent 2, "Al Rubayet" 1.
  - PR #1 came from a Copilot branch.
- **Team.** Al Rubayet (2204002), Md. Rony Hossain (2204005), Imteajul Islam (2204015), Tahsin Ahmed Chowdhury (2204028). Supervisor: Sharmistha Chanda Tista.
  - Nicknames used in team docs: Turjo (lead, frontend), Saimun (idea, backend), Tahsin (database, testing, docs), Rony (frontend support, testing, real-user testing, docs). The mapping of nicknames to names is unconfirmed, so use `\todo{}` wherever it matters.
- **Testing rule (AGENTS.md).** Never test with synthetic documents. Use only documents the user has already uploaded.

## Figure manifest (single source of truth for file names)

All diagram PDFs go in `ROOT/images/diagrams/`. SVG sources go in `ROOT/tools/svg_src/`. Convert with:

```
python ROOT/tools/svg2pdf.py file.svg --out ROOT/images/diagrams
```

Chapter writers include figures with `\figplaceholder[<width>]{<name>.pdf}{<caption>}{fig:<label>}`. That macro prints a red box if the file is missing, so writers do not need to wait for the diagram makers.

| File | Content | Made by |
| --- | --- | --- |
| system_overview.pdf | L0 map: student, desktop app, backend, AI providers, local storage | D1 |
| arch_l0.pdf | Architecture level 0 (4–6 boxes) | D1 |
| arch_l1.pdf | Architecture level 1: UI layer, API layer (v1 + study routes), services, providers, storage | D1 |
| arch_l2_pipeline.pdf | Level 2: document processing pipeline stages | D1 |
| arch_l2_ai.pdf | Level 2: AI provider layer (factory, providers, rate limiter, retry, prompt registry, BYOK) | D1 |
| ai_architecture.pdf | AI-integration architecture (prompt + context + provider + validation/repair + fallback) | D1 |
| component_diagram.pdf | UML-style component diagram (HLD) | D1 |
| strategy_pattern.pdf | Small UML: BaseLLMProvider strategy + factory; extractor registry | D1 |
| dfd_level2_process_doc.pdf | DFD level 2 of "Process document" | D1 |
| dfd_level2_review.pdf | DFD level 2 of "Study and review (FSRS)" | D1 |
| dfd_level2_ask.pdf | DFD level 2 of "Ask the Knowledge Hub" | D1 |
| process_model.pdf | Incremental/iterative process model as applied to RecaLL | D2 |
| cicd_pipeline.pdf | CI and release pipeline stages | D2 |
| git_workflow.pdf | Git workflow: main, feature/PR branches, tags → release | D2 |
| gui_wireframe.pdf | Wireframe of the dashboard (pairs with images/screenshots/dashboard.png) | D2 |
| activity_import.pdf | Activity: import and process a PDF | D2 |
| activity_review.pdf | Activity: review due flashcards (FSRS) | D2 |
| activity_drill.pdf | Activity: Socratic drill → misconception → flashcards | D2 |
| usecase.pdf, dfd_level0.pdf, dfd_level1.pdf, deployment.pdf, er_saas.pdf, er_legacy.pdf, class_chat_ai.pdf, class_documents.pdf, class_study_billing.pdf, seq_upload.pdf, seq_chat.pdf, seq_drill.pdf, seq_login.pdf, activity_study.pdf, state_flashcard.pdf, state_job.pdf, state_subscription.pdf | Reused from `docs/diagrams/bw` and `docs/database/*/schema.svg`, re-checked against current code, redrawn or fixed where needed | D2 |

Other images:
- `images/screenshots/*.png`: cornell, cornell_analogy, dashboard, documents, flashcard, knowledge_hub, progress, providers, quiz, reader_pdf, socratic_drill. Include these with `\includegraphics` inside a `figure` environment, or with `\figplaceholder` using the path `screenshots/<name>.png`.
- `images/figures/*.png`: older report flow figures (pipeline_flow, drill_flow, misconception, fsrs_cycle, rag_flow, workflow). These are optional to reuse.

## Diagram rules (D1, D2)

- Follow `C:/Users/Asus/.gemini/config/skills/visual-diagram/SKILL.md`, clean style:
  - black and white only
  - 900–1000 px wide
  - text at least 18 px
  - 1–6 word labels
  - exactly one black emphasis box
  - dashed lines for optional or external parts
- UML diagrams (class, sequence, use case) may use standard UML notation, still black and white.
- **Do not put a title or subtitle on the canvas.** The LaTeX caption replaces it. Start the shapes near the top.
- Draw only what exists in the code.
- Check every diagram visually as the skill describes: render at 700 px, look at it, and fix it before converting.

## LaTeX rules (all writers)

- Edit only your own files.
- Keep every template section heading and order; Porikroma adds 9.4.
- Put new BibTeX entries in `ROOT/tools/refs_<you>.bib`. The integrator merges them into `references.bib`. Existing keys: pressman2019, sommerville2016, owasp2021.
- Every figure and table needs a caption, a `\label`, and a `\Cref` reference in the text.
- Wrap every placeholder in `\todo{...}`. Never invent results, meeting dates, scores or user feedback.
- Escape `_ % & # $` in text. Use `\texttt{}` for code names, with escaped underscores.
- Use `tabularx`/`longtable` with `\small` so nothing runs off the page.
- pdfLaTeX only: avoid Unicode symbols such as →, ≥ and emoji. Use `$\rightarrow$` or `$\geq$` instead.
- Write in plain, clear academic English. Avoid filler.
