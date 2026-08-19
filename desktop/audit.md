Comprehensive Codebase Audit Report
An in-depth technical audit and automated test verification of the Recall desktop & chunk-service repository (c:\Users\user\Documents\srs-project\chunk-service) has been completed.

Below is the detailed breakdown of identified bugs, partial implementations, false implementations, test results, and recommended fixes.

1. Serious Bugs (Unfixed / Critical)
🔴 Bug 1: LLM Providers Crash / Reject Plain-Text Prompts When json_schema=None
Affected Files:


app/llm_providers/gemini.py:20-43


app/llm_providers/openai.py:15-35


app/llm_providers/groq.py:1-6


app/llm_segment.py:340-359
Root Cause: When explain_selected_text() calls provider.generate(prompt, json_schema=None) for free-form Markdown text:
GeminiProvider appends "...schema:\nnull" and sets "responseMimeType": "application/json".
OpenAIProvider / GroqProvider appends "...schema:\nnull" and sets "response_format": {"type": "json_object"}.
Impact: OpenAI / Groq APIs immediately return HTTP 400 Bad Request because plain Markdown text cannot satisfy JSON object mode. Gemini attempts to coerce free-form tutoring text into JSON or fails.
Fix: Only append JSON instructions and configure JSON response formats when json_schema is not None.
🔴 Bug 2: PyMuPDF 4-Element TOC Bookmark Crash
Affected File: 

app/toc_parser.py:125
Root Cause: build_granular_toc() does:
python
level, title, start_page = entry
PyMuPDF's doc.get_toc() returns 4 items ([lvl, title, page, dest]) whenever bookmarks contain destinations or named actions.
Impact: Unpacking raises ValueError: too many values to unpack (expected 3), crashing the entire PDF upload and TOC extraction pipeline on real-world textbook PDFs with link destinations.
Fix: Safely index or slice the tuple/list:
python
level, title, start_page = entry[0], entry[1], max(1, int(entry[2]))
🔴 Bug 3: PDF Export Coordinate Parser Throws KeyError: 'x' on All Desktop Annotations
Affected File: 

app/pdf_export.py:59-76
Root Cause: generate_annotated_pdf() expects rect_json to contain { "x", "y", "width", "height" }:
python
x = rect_data["x"] / viewport_scale
However, the desktop frontend (desktop/src/views/BookDetailView.tsx:544) stores react-pdf-highlighter's ScaledPosition format:
json
{ "boundingRect": { "x1": 50, "y1": 90, "x2": 200, "y2": 110, "width": 595, "height": 842 }, "rects": [...] }
Impact: Every single export throws a KeyError: 'x' and falls back to a hardcoded fitz.Rect(72, 72, 200, 90) box at the top left of the first page. Exported highlights never match where the user highlighted.
Fix: Support both ScaledPosition (boundingRect.x1, boundingRect.y1) and legacy { x, y, width, height }.
🔴 Bug 4: Invalid Gemini Embedding Model Name Causing HTTP 404
Affected File: 

app/embeddings.py:34-36
Root Cause: The URL is hardcoded as:
python
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key={api_key}"
gemini-embedding-2 is an invalid/non-existent model name in the Google AI Gemini API. The official embedding model is text-embedding-004.
Impact: Calling get_embedding(..., provider="gemini") fails with HTTP 404 Not Found, breaking semantic deduplication and related topics search for Gemini users.
Fix: Change model to text-embedding-004 (or models/text-embedding-004).
🔴 Bug 5: Semantic Deduplication COALESCE Inversion
Affected File: 

app/database.py:374-386
Root Cause: When a topic matches semantically (cosine similarity $\ge 0.94$), the SQL update executes:
sql
UPDATE topics SET 
    summary = COALESCE(summary, ?),
    concept_type = COALESCE(concept_type, ?),
    ...
WHERE id = ?
In SQL, COALESCE(summary, ?) returns summary if summary is already non-null, completely ignoring the new AI-generated ? argument.
Impact: Semantic deduplication preserves outdated placeholder summaries rather than updating them with the enriched concept summary.
Fix: Invert to COALESCE(?, summary) and COALESCE(?, concept_type).
🟡 Bug 6: Frontend Highlight Positioning Rendering Failure (PdfAnnotationLayer)
Affected File: 

desktop/src/components/PdfAnnotationLayer.tsx:77, 90
Root Cause: PdfAnnotationLayer expects r.left and boundingRect.left, but react-pdf-highlighter natively yields x1 and y1.
Impact: Injected inline styles evaluate to style={{ left: "undefinedpx", top: "undefinedpx" }}, causing highlights and bookmark icons to render at (0, 0) or collapse.
Fix: Normalize coordinates: const left = r.left ?? r.x1 ?? 0; const top = r.top ?? r.y1 ?? 0;.
2. Lackings & Partial Implementations
#	Component	Issue Description
1	Global Command Palette Search (

CommandPalette.tsx:62
)	Search index logic is commented out. Typing queries in Cmd+K does not query /search?query=... or display matching topics/flashcards.
2	CLI Ingestion Broken / Missing /chunk Endpoint (

cli.py:124
)	cli.py sends chunk streams to http://127.0.0.1:8000/chunk/stream, but app/main.py only implements /books/upload and /books/{id}/process-stream. Running python cli.py parse returns 404.
3	Hardcoded total_pages = 100 on PDF Upload (

LibraryView.tsx:39
)	uploadPdfAndGetToc(file, title, 100) hardcodes 100 pages. The backend writes this client value to books.total_pages instead of using doc.page_count.
4	Provider Override Ignored in Flashcard Modal (

FlashcardGenModal.tsx:29
)	client.generateFlashcards() does not pass provider_override: activeProvider, causing flashcard generation from the modal to ignore the active provider selected in UI settings.
5	SQLite Connection Lock Under Concurrency (

app/database.py:19-21
)	get_connection() lacks PRAGMA journal_mode = WAL and PRAGMA busy_timeout = 5000. Concurrency throttling allows up to 15 workers, causing sqlite3.OperationalError: database is locked.
6	Sidecar Binary Hidden Imports (

scripts/build_sidecar.py:40-68
)	markdown_it, numpy, and dotenv are not explicitly listed in PyInstaller hidden imports, risking runtime module not found crashes in standalone desktop releases.
7	Topic flashcard_count Stale After Subtopic Pruning (

app/database.py:523
)	prune_artificial_subtopics() re-links flashcards to parent topics but does not recalculate the parent's flashcard_count.
3. Falsely Implemented / Misleading Features
Hardcoded FSRS Review Intervals in UI (

ReviewView.tsx:198-213
 & 

TopicPracticeModal.tsx:180-195
):
Reality: The buttons display static labels < 1m, ~ 5m, ~ 10m, ~ 4d.
Problem: FSRS calculates actual dynamic scheduled intervals based on card stability (e.g. a mature card with 60d stability might have intervals of 1d, 45d, 65d, 120d). The static labels mislead users into thinking FSRS is not working.
Hardcoded ☁️ Cloud Badge on All Flashcards (

ReviewView.tsx:158-160
):
Every flashcard shows ☁️ Cloud even when generated locally using Ollama.
API Client Return Type Mismatch (

desktop/src/api/client.ts:214
):
client.submitReview declares return type Promise<{ message: string; next_due: string }>, but the backend /flashcards/{id}/review endpoint returns the full updated Flashcard model.
4. Test Suite Execution & Validation
Automated unit & integration tests were created to validate functionality:

bash
pytest tests/test_audit.py tests/test_database_api.py tests/test_llm_providers.py
Test Results Summary
============================== FAILURES ===============================
FAILED tests/test_audit.py::test_toc_parser_granular
  -> ValueError: too many values to unpack (expected 3) on PyMuPDF 4-item bookmarks
FAILED tests/test_llm_providers.py::test_gemini_provider_none_schema
  -> AssertionError: Gemini forced application/json and injected null schema on explain text
FAILED tests/test_llm_providers.py::test_openai_provider_none_schema
  -> AssertionError: OpenAI forced {"type": "json_object"} on explain text
======================== PASSED TESTS =========================
PASSED tests/test_audit.py::test_fsrs_review_card
PASSED tests/test_audit.py::test_cosine_similarity
PASSED tests/test_audit.py::test_sanitize_llm_response
PASSED tests/test_audit.py::test_prefilter
PASSED tests/test_audit.py::test_heading_detect
PASSED tests/test_audit.py::test_markdown_ast_assets
PASSED tests/test_database_api.py::test_database_crud_and_cascading
PASSED tests/test_database_api.py::test_semantic_deduplication
PASSED tests/test_database_api.py::test_api_review_and_undo_flow
PASSED tests/test_database_api.py::test_api_endpoints
5. Concrete Action Plan & Recommended Fixes
Step 1: Fix LLM Providers (app/llm_providers/)
In GeminiProvider, OpenAIProvider, and GroqProvider: check if json_schema is not None before appending schema instructions and setting JSON response types.
Step 2: Fix TOC Parser & Model Endpoints
Update build_granular_toc() in app/toc_parser.py to slice entry[:3].
In app/embeddings.py, update the Gemini embedding model URL to text-embedding-004.
Step 3: Fix SQLite Concurrency & Database Operations
In app/database.py:get_connection(), add:
python
conn.execute("PRAGMA journal_mode = WAL")
conn.execute("PRAGMA busy_timeout = 5000")
In resolve_and_save_topic(), change COALESCE(summary, ?) to COALESCE(?, summary).
In app/main.py:upload_and_parse_toc(), update books.total_pages with doc.page_count.
Step 4: Fix PDF Export & Annotation Layer
In app/pdf_export.py, parse coordinates supporting boundingRect.x1 / y1 and legacy x / y.
In desktop/src/components/PdfAnnotationLayer.tsx, fallback to r.x1 ?? r.left and boundingRect.x1 ?? boundingRect.left.
Step 5: Connect Command Palette & Align CLI
Wire desktop/src/components/CommandPalette.tsx to search /search?query=... with debounced queries.
Either update cli.py to use /books/upload + /books/{id}/process-stream, or expose a unified /chunk/stream route in app/main.py.