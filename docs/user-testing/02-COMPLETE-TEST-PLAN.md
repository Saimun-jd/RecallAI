# RecallAI — Comprehensive Test Plan
**Document ID:** `docs/user-testing/02-COMPLETE-TEST-PLAN.md`  
**Application:** RecallAI — Academic Learning Companion  
**Version:** `1.0.0` (Production Release)  
**Repository:** https://github.com/Saimun-jd/RecallAI.git  
**Auditor / Tester:** Senior QA Engineer & Test Architect  
**Execution Date:** November 19, 2026  

---

## 1. Test Strategy & Structure

This test plan maps every feature, control, setting, and workflow discovered in `01-COMPLETE-FEATURE-INVENTORY.md` to rigorous test cases across six testing dimensions:
1. **Normal Operation (NORM):** Standard happy paths, expected user flows, and correct business logic outputs.
2. **Boundary Testing (BND):** Minimum/maximum lengths, empty inputs, large files, extreme values, and format thresholds.
3. **Negative Testing (NEG):** Invalid payloads, malformed keys, missing parameters, offline dependencies, network timeouts, and duplicate actions.
4. **State & Persistence Testing (STAT):** Navigation transitions, reload/restart persistence, modal close/reopen state, and cancellation cleanups.
5. **Interaction & Concurrency Testing (INTR):** Rapid double-clicks, keyboard hotkeys, mobile viewports, long-running streaming aborts, and concurrent requests.
6. **User Experience & Accessibility Testing (UX):** Discoverability, clarity of feedback, contrast ratios, keyboard accessibility, and non-blocking interfaces.

---

## 2. Test Cases Matrix

### Module 1: Authentication & Onboarding (`SCR-001` .. `SCR-006`)

| Test Case ID | Target Inventory ID | Test Category | Test Objective & Execution Procedure | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-AUTH-01** | `SCR-002`, `FEAT-001` | Normal | Log in with valid registered credentials (`scholar@recall.test` / password). | JWT session saved, redirected to `/app`, user profile displayed. |
| **TC-AUTH-02** | `SCR-002`, `CTRL-008` | Negative | Attempt login with invalid password. | Clean inline error banner displayed; no unhandled exception or crash. |
| **TC-AUTH-03** | `SCR-002`, `CTRL-008` | Boundary | Submit empty email and empty password fields. | HTML5 / form validation prevents submission with visible cues. |
| **TC-AUTH-04** | `SCR-003`, `FEAT-001` | Negative | Register with password shorter than 8 characters. | Validation error: "Password must be at least 8 characters long". |
| **TC-AUTH-05** | `SCR-005`, `FEAT-002` | Normal | Select "Academic & Exam Mastery" in Onboarding and click "Next". | Selection highlighted with primary border, advances to step 2. |
| **TC-AUTH-06** | `SCR-005`, `CTRL-008` | State | Click "Skip to Dashboard" during onboarding. | Onboarding dismissed, `recall_onboarding_completed` set in localStorage. |
| **TC-AUTH-07** | `SCR-006`, `FEAT-002` | State | Verify Welcome Modal does not re-appear after clicking "Get Started". | `has-seen-welcome` flag persists across page reloads and restarts. |

---

### Module 2: Dashboard & Document Ingestion (`SCR-007`, `SCR-008`, `FEAT-005`, `FEAT-006`)

| Test Case ID | Target Inventory ID | Test Category | Test Objective & Execution Procedure | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-DOC-01** | `SCR-008`, `FEAT-005` | Normal | Upload authentic 392-page PDF (*Introduction to Machine Learning with Python*). | Progress modal displays: Ingestion -> Hashing -> TOC Extraction -> Ready. |
| **TC-DOC-02** | `SCR-008`, `CTRL-009` | Negative | Attempt to upload non-PDF file (e.g. `.exe` or `.txt`). | Rejected with error toast: "Only valid PDF files are supported". |
| **TC-DOC-03** | `SCR-008`, `CTRL-012` | Normal | Type search term "Machine Learning" in Documents search input. | Document list filters in real-time to matching document titles. |
| **TC-DOC-04** | `SCR-008`, `CTRL-013` | Normal | Filter by status "Ready", "Processing", "Failed". | Document list matches selected filter accurately. |
| **TC-DOC-05** | `SCR-008`, `CTRL-014` | Normal | Sort documents by "Newest", "Oldest", "Alphabetical". | Ordering updates immediately in the UI. |
| **TC-DOC-06** | `SCR-008`, `CTRL-015` | State | Open Delete Document dialog, click "Cancel". | Modal dismisses without deleting document from database or disk. |
| **TC-DOC-07** | `SCR-007`, `CTRL-009` | Interaction | Drag and drop PDF file over Dashboard window. | Drag-and-drop overlay activates with blue border; initiates upload on drop. |

---

### Module 3: Document Reader & Cornell Notebook (`SCR-010`, `FEAT-007` .. `FEAT-015`)

| Test Case ID | Target Inventory ID | Test Category | Test Objective & Execution Procedure | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-READ-01** | `SCR-010`, `FEAT-007` | Normal | Open book; verify split-screen PDF and Cornell notebook layout. | Left pane displays rendered PDF page; right pane displays Cornell editor. |
| **TC-READ-02** | `SCR-010`, `CTRL-020` | Normal | Click TOC chapter "Supervised Learning" (page 26). | PDF viewer smoothly scrolls to page 26; active topic title updates. |
| **TC-READ-03** | `SCR-010`, `CTRL-022` | Interaction | Drag divider handle between PDF and Notes pane. | Pane widths resize fluidly within bounds (240px to 480px) without lag. |
| **TC-READ-04** | `SCR-010`, `FEAT-008` | Normal | Select text passage on PDF canvas; click "Yellow Highlight". | Highlight rendered on PDF page; annotation saved in SQLite database. |
| **TC-READ-05** | `SCR-010`, `FEAT-009` | Normal | Type notes in Cornell Editor (Cues, Main Notes, Summary). | Autosave debounces 500ms; status badge shows "Saved"; persists on reload. |
| **TC-READ-06** | `SCR-010`, `CTRL-024` | State | Switch paper style between "Ruled", "Grid", and "Plain". | Editor background updates instantly; style persists in `localStorage`. |
| **TC-READ-07** | `SCR-010`, `FEAT-015` | Normal | Input LaTeX equation: `$$f(x) = \frac{1}{1 + e^{-z}}$$`. | KaTeX renders mathematical formula cleanly with proper font glyphs. |
| **TC-READ-08** | `SCR-010`, `FEAT-012` | Normal | Click "Generate Cornell Notes" on active chapter slice. | AI extracts cues, structured notes, and summary block via background runner. |
| **TC-READ-09** | `SCR-010`, `FEAT-013` | Normal | Click "Start Socratic Drill"; submit correct conceptual explanation. | AI grades answer with constructive feedback and confirms concept mastery. |
| **TC-READ-10** | `SCR-010`, `FEAT-013` | Negative | Submit empty answer or irrelevant answer in Socratic drill. | Empty answer blocked by button state; irrelevant answer flagged with feedback. |
| **TC-READ-11** | `SCR-010`, `CTRL-030` | Normal | Click "Copy Notes" button. | Complete markdown content copied to system clipboard; toast confirms. |
| **TC-READ-12** | `SCR-010`, `CTRL-031` | Normal | Click "Download Note" button. | Prompts `.md` file download containing topic name and formatted content. |

---

### Module 4: Knowledge Hub RAG Chat (`SCR-011`, `FEAT-016`, `FEAT-017`)

| Test Case ID | Target Inventory ID | Test Category | Test Objective & Execution Procedure | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-CHAT-01** | `SCR-011`, `FEAT-016` | Normal | Submit query: "Explain the difference between supervised and unsupervised learning." | Streaming response arrives via SSE with structured markdown and citations. |
| **TC-CHAT-02** | `SCR-011`, `FEAT-017` | Normal | Click on inline citation `[1]` in assistant message. | `SourcePreviewModal` opens showing document title, page number, and snippet. |
| **TC-CHAT-03** | `SCR-011`, `CTRL-032` | Normal | Change scope selector from "All Documents" to specific textbook. | RAG retrieval restricts context strictly to the selected document. |
| **TC-CHAT-04** | `SCR-011`, `CTRL-036` | Interaction | Click "Stop Generating" mid-stream. | AbortController halts network stream immediately; partial message preserved. |
| **TC-CHAT-05** | `SCR-011`, `CTRL-033` | State | Click "New Chat", submit message, switch conversations in sidebar. | Conversation history persists in SQLite; switching restores exact message list. |

---

### Module 5: Flashcards & FSRS Review (`SCR-013` .. `SCR-016`, `FEAT-018` .. `FEAT-021`)

| Test Case ID | Target Inventory ID | Test Category | Test Objective & Execution Procedure | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-CARD-01** | `SCR-014`, `FEAT-018` | Normal | Generate 5 flashcards from Chapter 2 of textbook. | 5 high-yield Q&A cards generated with front and back markdown. |
| **TC-CARD-02** | `SCR-015`, `FEAT-019` | Normal | Add manual card to deck: Front="What is k-NN?", Back="k-Nearest Neighbors". | Card saved to deck; total card count increments by 1. |
| **TC-CARD-03** | `SCR-016`, `FEAT-020` | Interaction | Study deck: press `Spacebar` to reveal answer, press `3` (Good). | Card flips smoothly in 3D; FSRS rates card; next card appears; progress bar updates. |
| **TC-CARD-04** | `SCR-013`, `FEAT-021` | Normal | Open `/app/review` with due cards; complete review session. | Queue counts update (Again, Hard, Good, Easy); completion summary displayed. |
| **TC-CARD-05** | `SCR-013`, `FEAT-021` | State | Restart application after rating cards. | Due dates, stability ($S$), difficulty ($D$), and review logs remain persistent. |
| **TC-CARD-06** | `SCR-013`, `FEAT-021` | Boundary | Complete all due cards so review queue is empty. | `ReviewEmptyState` displayed with congratulatory message and zero due count. |

---

### Module 6: Quizzes & Assessment (`SCR-017` .. `SCR-020`, `FEAT-022` .. `FEAT-024`)

| Test Case ID | Target Inventory ID | Test Category | Test Objective & Execution Procedure | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-QUIZ-01** | `SCR-017`, `FEAT-022` | Normal | Generate 5-question mixed quiz from textbook document. | Quiz created with 5 questions (MCQ + T/F), title, and difficulty tier. |
| **TC-QUIZ-02** | `SCR-019`, `FEAT-023` | Normal | Start attempt: answer questions 1 to 5; flag question 3 for review. | Radio buttons record answers; navigator displays answered/flagged states. |
| **TC-QUIZ-03** | `SCR-019`, `CTRL-053` | Interaction | Click "Submit Quiz" -> Click "Confirm" in SubmitConfirmDialog. | Attempt submitted to backend; navigates immediately to Results view. |
| **TC-QUIZ-04** | `SCR-020`, `FEAT-024` | Normal | Inspect quiz results screen. | Score percentage displayed; question breakdown highlights correct/incorrect answers. |
| **TC-QUIZ-05** | `SCR-018`, `FEAT-023` | State | Retake quiz; submit second attempt. | Attempt history records both attempts with timestamp and score comparison. |

---

### Module 7: Learning Analytics & Progress (`SCR-021`, `FEAT-025`)

| Test Case ID | Target Inventory ID | Test Category | Test Objective & Execution Procedure | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-PROG-01** | `SCR-021`, `FEAT-025` | Normal | Open Progress view; inspect Summary Cards (Streak, Cards, Time, Retention). | Cards display verified metrics derived from user study sessions and FSRS DB. |
| **TC-PROG-02** | `SCR-021`, `CTRL-008` | Interaction | Switch time range filter between `7d`, `30d`, and `90d`. | Recharts activity graph re-renders with corresponding daily breakdown. |
| **TC-PROG-03** | `SCR-021`, `FEAT-025` | Normal | Inspect Retention & FSRS card states section. | Counts of New, Learning, Review, and Relearning cards match SQLite state. |

---

### Module 8: Settings, BYOK Vault & Security (`SCR-023` .. `SCR-027`, `FEAT-026`, `FEAT-027`)

| Test Case ID | Target Inventory ID | Test Category | Test Objective & Execution Procedure | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-SET-01** | `SCR-023`, `SET-014` | Normal | Update daily review goal to 35 cards and click "Save". | Daily goal saved to backend DB; toast confirms "Daily review goal saved". |
| **TC-SET-02** | `SCR-023`, `SET-014` | Boundary | Enter daily review goal of 0 or 600 cards. | Validation triggers error toast: "Daily review goal must be between 1 and 500 cards". |
| **TC-SET-03** | `SCR-024`, `SET-001` | Normal | Switch theme from "System" to "Dark" and then "Light". | DOM `classList` updates with zero flicker; colors transition immediately. |
| **TC-SET-04** | `SCR-024`, `SET-003` | State | Toggle "Reduced Motion" switch to enabled. | `reduce-motion` class applied to root document; persists in `localStorage`. |
| **TC-SET-05** | `SCR-025`, `FEAT-026` | Normal | Enter valid API key for active provider; click "Test Connection". | Green badge displays: "Connection verified and operational". |
| **TC-SET-06** | `SCR-025`, `FEAT-026` | Negative | Enter malformed / fake API key; click "Test Connection". | Red banner displays specific error: invalid credentials or connection failed. |
| **TC-SET-07** | `SCR-025`, `FEAT-026` | Security | Inspect UI and console logs for entered API keys. | Keys are masked (`••••••••` / `key_hint`); plaintext is never printed in logs. |
| **TC-SET-08** | `SCR-025`, `SET-010` | Normal | Test local Ollama endpoint (`http://localhost:11434`). | Health check returns active/inactive status without unhandled timeout. |
| **TC-SET-09** | `SCR-027`, `FEAT-001` | Normal | Submit password change form with valid current and new passwords. | Password updated successfully; toast confirmation displayed. |
| **TC-SET-10** | `SCR-027`, `CTRL-059` | State | Open "Delete All Data" modal; type "CANCEL" instead of "DELETE". | Deletion blocked; requires exact "DELETE" input to proceed. |

---

### Module 9: LLM Prompt & Telemetry Inspector (`SCR-022`, `FEAT-028`)

| Test Case ID | Target Inventory ID | Test Category | Test Objective & Execution Procedure | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-INSP-01** | `SCR-022`, `FEAT-028` | Normal | Open LLM Inspection view; select `chat_prompt` from prompt list. | System prompt text and metadata loaded into editor textarea. |
| **TC-INSP-02** | `SCR-022`, `FEAT-028` | State | Modify prompt text, click "Save Prompt", reload page. | Modified prompt persists in SQLite settings table and reloads accurately. |
| **TC-INSP-03** | `SCR-022`, `FEAT-028` | State | Click "Reset to Default" on modified prompt. | Default factory prompt restored and saved back to SQLite. |
| **TC-INSP-04** | `SCR-022`, `FEAT-028` | Normal | Inspect Token Usage & Cost charts. | Recharts graph renders input/output tokens and cost breakdown by feature. |
| **TC-INSP-05** | `SCR-022`, `CTRL-008` | Normal | Click "Clear Token Logs" button. | Token history logs cleared; usage graph resets cleanly. |

---

### Module 10: Desktop App Integration & Keyboard Accessibility (`FEAT-003`, `FEAT-004`)

| Test Case ID | Target Inventory ID | Test Category | Test Objective & Execution Procedure | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-DESK-01** | TopBar, `FEAT-003` | Interaction | Press `Cmd+K` or `Ctrl+K` on any screen. | Global Command Palette modal opens immediately; focus trapped in input. |
| **TC-DESK-02** | TopBar, `FEAT-003` | Interaction | Type "Quantum" in Command Palette, press `Enter`. | Jumps directly to matching document or note. |
| **TC-DESK-03** | TopBar, `FEAT-004` | Normal | Inspect TopBar StatusBar pill during active backend operation. | Heartbeat green icon indicates "Connected"; shows response latency in ms. |
| **TC-DESK-04** | All Screens | UX / Mobile | Resize viewport to 375x667 (mobile portrait). | Desktop sidebar collapses; mobile bottom navigation bar and drawer activate. |
| **TC-DESK-05** | Desktop Window | State | Close window while note autosave is in flight. | Tauri `onCloseRequested` hook intercepts, flushes save, then closes safely. |
