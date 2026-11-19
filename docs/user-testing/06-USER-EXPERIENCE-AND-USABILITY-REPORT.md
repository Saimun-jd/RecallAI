# RecallAI — User Experience & Usability Report
**Document ID:** `docs/user-testing/06-USER-EXPERIENCE-AND-USABILITY-REPORT.md`  
**Application:** RecallAI — Academic Learning Companion  
**Version:** `1.0.0` (Production Release)  
**Repository:** https://github.com/Saimun-jd/RecallAI.git  
**Auditor / Tester:** UX Researcher & Accessibility Analyst  
**Execution Date:** November 19, 2026  

---

## 1. Usability Evaluation Framework

The application interface was evaluated across seven core UX dimensions:
1. **Discoverability:** Can a first-time scholar naturally discover features without training?
2. **Clarity & Information Architecture:** Are labels, navigation routes, and menus intuitive?
3. **Feedback & Responsiveness:** Does the app clearly indicate background tasks, saves, and errors?
4. **Error Prevention & Mistake Recovery:** Can users cancel destructive actions and recover cleanly?
5. **Keyboard & Power-User Workflows:** Can high-frequency tasks be completed via keyboard?
6. **Visual Design & Aesthetics:** Does the neo-brutalist student notebook aesthetic aid focus?
7. **Accessibility & Responsiveness:** How does the interface adapt across viewport sizes and contrast needs?

---

## 2. Dimension-by-Dimension Findings

### A. Discoverability & Navigation
- **TopBar Command Palette:** Pressing `Cmd+K` or `Ctrl+K` immediately opens a clean search modal allowing direct jumps to documents, flashcards, notes, or reviews. Discoverability is reinforced by a visible search trigger pill in the top bar.
- **Sidebar Organization:** Divided into four clear semantic sections:
  - *Knowledge:* Dashboard, Documents, Knowledge Hub, Notes
  - *Study & Review:* Review, Flashcards, Quizzes
  - *Insights:* Progress & Analytics
  - *Account:* LLM Inspection, Settings
- **Collapse Toggle:** The sidebar collapses to a 72px icon strip, expanding viewport real estate for split-screen reading while preserving tooltips on hover.

### B. Clarity & Labeling
- **Page Titles & Breadcrumbs:** Every screen displays a context header (e.g. `Dashboard`, `Document Reader`, `Daily Review`, `Quizzes`).
- **Badge Indicators:** Status tags (`Ready`, `Processing`, `Due`, `Mastered`) use standard color semantics (Emerald, Amber, Sky, Rose) combined with clear text labels to avoid color-only dependency.
- **Action Buttons:** Primary actions use high-contrast primary fill with bold text (e.g. `Generate Cornell Notes`, `Start Review`, `Test Connection`). Secondary actions use outlined cards with hover elevation.

### C. Feedback, Loading & Error States
- **Autosave Indication:** In the Cornell notebook and Notes manager, a live status pill indicates `Saving...` during typing and transitions to a checkmark `Saved` 500ms after keystroke idle.
- **Background Task Visibility:** Document extraction progress displays an overlay modal detailing individual stages: Hashing, Text Extraction, Chunking, and Chapter Tree construction.
- **Non-Blocking Toasts:** System alerts (e.g. "Key connection verified", "Flashcard created", "Note copied") appear in the bottom-right corner as non-blocking toasts that auto-dismiss after 4 seconds.

### D. Error Prevention & Recovery
- **Danger Zone Guard:** The "Delete All Data" action requires the student to type the exact word `DELETE` into a confirmation field. The button remains disabled until exact case matching is verified, preventing accidental data loss.
- **Document & Quiz Deletion:** Dedicated confirmation modals require explicit confirmation before records are purged from SQLite and disk storage.
- **Graceful Offline Fallback:** If an external LLM key is absent or offline, the UI alerts the user immediately with actionable instructions to configure a key in Settings rather than freezing or crashing.

### E. Keyboard & Power-User Workflows
- **Spaced Repetition Review:** Entire review sessions can be conducted without touching a mouse:
  - `Spacebar` / `Enter`: Reveal flashcard answer.
  - `1`: Again (Lapse / Relearn)
  - `2`: Hard (Difficult)
  - `3`: Good (Standard recall)
  - `4`: Easy (Immediate mastery)
- **Global Search:** `Cmd+K` / `Ctrl+K` for global navigation; `Esc` to close any modal.
- **PDF Viewer Navigation:** Arrow keys navigate pages; `+` and `-` zoom the canvas.

### F. Visual Aesthetic & Focus
- **Student Notebook Design System:** Warm paper background (`#F4F5F7` in light mode, `#0F172A` in dark mode) paired with distinct borders (`2px solid #CBD5E1`) creates an authentic physical notebook feel that reduces eye strain during long study sessions.
- **Mathematical Typography:** KaTeX renders mathematical equations seamlessly alongside serif body text, ensuring complex formulas in STEM textbooks are legible and publication-grade.

### G. Responsive Mobile Layout (375x667 Viewport)
- **Mobile Viewport Adaptation:** On screens under 768px:
  - Desktop sidebar automatically hides.
  - Persistent bottom navigation bar displays quick icons for Dashboard, Documents, Review, Notes, and Hub.
  - Hamburger menu opens a smooth slide-out drawer containing secondary account links.
- **Evidence:** `27_mobile_viewport.png`, `28_mobile_drawer.png`.

---

## 3. Heuristic Usability Scorecard (Nielsen Norman 10 Heuristics)

| Heuristic | Score (1-10) | Evaluation Notes |
| :--- | :--- | :--- |
| **1. Visibility of System Status** | 10 / 10 | Real-time telemetry heartbeat pill, autosave status, and ingestion progress meters. |
| **2. Match between System & Real World** | 10 / 10 | Authentic Cornell note columns (Cues, Notes, Summary), paper grid styles, and flashcards. |
| **3. User Control & Freedom** | 9 / 10 | Abort button on streaming chat, cancel buttons on all dialogs, undo on reset prompt. |
| **4. Consistency & Standards** | 10 / 10 | Consistent neo-brutalist card styling, uniform button variants, and predictable routes. |
| **5. Error Prevention** | 10 / 10 | Required text confirmation on destructive actions; form validation on passwords and keys. |
| **6. Recognition rather than Recall** | 9 / 10 | Command palette with recent search history; breadcrumbs in deep document hierarchy. |
| **7. Flexibility & Efficiency of Use** | 10 / 10 | Keyboard shortcuts (`Space`, `1`..`4`, `Cmd+K`), split-screen resizing, paper style switcher. |
| **8. Aesthetic & Minimalist Design** | 9 / 10 | Clean layout without distracting clutter; high visual focus on document text and notes. |
| **9. Help Users Recognize Errors** | 9 / 10 | Clear human-friendly error messages with troubleshooting hints; no cryptic tracebacks in UI. |
| **10. Help & Documentation** | 9 / 10 | Built-in Welcome Screen, "How It Works" methodology guide, and inline BYOK guidance links. |

**Overall Usability Rating:** **9.5 / 10 (Exceptional Academic Usability)**

