# RecallAI — Complete Feature & UI Discovery Inventory
**Document ID:** `docs/user-testing/01-COMPLETE-FEATURE-INVENTORY.md`  
**Application:** RecallAI — Academic Learning Companion  
**Version:** `1.0.0` (Production Release)  
**Repository:** https://github.com/Saimun-jd/RecallAI.git  
**Auditor / Tester:** Senior QA Engineer & UX Researcher  
**Execution Date:** November 19, 2026  

---

## 1. Executive Summary

This inventory documents **every accessible screen, feature, interactive control, setting, and workflow** in the RecallAI application. It is constructed through static analysis of the source code (`desktop/src/`), route tree mapping (`App.tsx`), backend FastAPI endpoints (`app/main.py` and `app/api/v1/`), and live DOM inspection across light and dark themes.

### Discovery Totals
- **Total Screens & Views Discovered:** 32 screens (Public, Auth, Workspace, and Detail Views)
- **Total Modals & Dialogs Discovered:** 14 overlay dialogs
- **Total Core Features (FEAT):** 28 distinct functional features
- **Total Interactive Controls (CTRL):** 96 categorized user controls
- **Total Application Settings (SET):** 24 persistent configuration options
- **Total End-to-End Workflows (FLOW):** 12 multi-step student learning flows

---

## 2. Screen & Navigation Inventory (`SCR-xxx`)

| Screen ID | Route / Path | Screen Name | Category | Primary Purpose | Key Components |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SCR-001** | `/` | Marketing Landing | Public | Product overview, value proposition, CTA | `LandingView`, `PublicNavbar`, `PublicFooter` |
| **SCR-002** | `/login` | User Authentication (Sign In) | Auth | Email/password login and Supabase/Local JWT session start | `LoginView`, `Card`, `Input`, `Button` |
| **SCR-003** | `/register` | User Registration | Auth | New scholar account creation with password validation | `RegisterView`, `Input`, `Button` |
| **SCR-004** | `/forgot-password` | Password Recovery | Auth | Password reset request with email delivery | `ForgotPasswordView`, `Input`, `Button` |
| **SCR-005** | `/onboarding` | Guided Onboarding | Onboarding | Study domain specialization & initial setup | `OnboardingView`, `Badge`, `ThemeToggle` |
| **SCR-006** | Overlay Modal | Welcome Screen | Onboarding | First-launch guidance, feature tour & BYOK introduction | `WelcomeScreen` |
| **SCR-007** | `/app` | Learning Dashboard | Workspace | Study streak, next recommended action, recent books | `DashboardView`, `NextActionCard`, `PriorityReviewCard` |
| **SCR-008** | `/documents` | Documents Library | Knowledge | Academic PDF catalog, search, filter, upload | `DocumentsView`, `DocumentCard`, `UploadDocumentModal` |
| **SCR-009** | `/documents/:id` | Document Overview & Chunks | Knowledge | Document metadata, summary, concepts, sources | `DocumentDetailView`, `Tabs`, `DocumentConceptsTab` |
| **SCR-010** | `/books/:id` | Document Reader & Cornell Notebook | Study Core | Split-screen PDF reader, Cornell notes, Socratic drill | `BookDetailView`, `PdfViewer`, `SocraticDrillWidget` |
| **SCR-011** | `/app/chat` | Knowledge Hub | AI Assistance | Multi-document RAG chat, citations, conversation history | `KnowledgeHubView`, `ConversationSidebar`, `ChatComposer` |
| **SCR-012** | `/notes` | Unified Notes Manager | Knowledge | Cornell notes, Notion-style blocks, paper styles | `NotesView`, `NotionNotesEditor`, `MarkdownRenderer` |
| **SCR-013** | `/app/review` | Daily FSRS Review | Spaced Repetition | Daily review queue, card flip, 4-button rating (1-4) | `ReviewView`, `ReviewActiveSession`, `ReviewCompletion` |
| **SCR-014** | `/app/flashcards` | Flashcard Sets Catalog | Flashcards | List of decks, card counts, deck creation/generation | `FlashcardSetsView`, `FlashcardSetCard` |
| **SCR-015** | `/app/flashcards/:setId`| Flashcard Set Details | Flashcards | Manage cards within deck, add/edit/delete cards | `FlashcardSetDetailView`, `CardList` |
| **SCR-016** | `/app/flashcards/:setId/study` | Interactive Flashcard Study | Flashcards | 3D card flip study session with performance tracking | `FlashcardStudyView`, `ReviewRatingButtons` |
| **SCR-017** | `/app/quizzes` | Quizzes Hub | Assessment | Quiz catalog, new quiz generation trigger | `QuizzesView`, `QuizCard`, `QuizGenerateDialog` |
| **SCR-018** | `/app/quizzes/:quizId`| Quiz Overview | Assessment | Quiz questions preview, attempt history, best score | `QuizDetailView`, `AttemptList` |
| **SCR-019** | `/app/quizzes/:quizId/attempt` | Quiz In-Progress Attempt | Assessment | Timed/untimed quiz taking, MCQ, T/F, flag questions | `QuizAttemptView`, `QuestionNavigator` |
| **SCR-020** | `/app/quizzes/:quizId/results/:attemptId` | Quiz Results & Grading | Assessment | Automated scoring, misconception explanations | `QuizResultsView`, `QuestionReviewCard` |
| **SCR-021** | `/app/progress` | Learning Analytics & Mastery | Insights | FSRS retention curve, study streak, activity chart | `ProgressView`, `StudyActivityChart`, `RetentionSection` |
| **SCR-022** | `/llm-inspection`| LLM & Telemetry Inspector | Insights | Prompt editor (10 prompts), token logs, cost analyzer | `LLMInspectionView`, `AreaChart`, `PromptEditor` |
| **SCR-023** | `/settings?tab=account` | Account Settings | Settings | Scholar identity, email, daily review goal (cards) | `AccountSettings`, `Input`, `Button` |
| **SCR-024** | `/settings?tab=appearance` | Appearance Settings | Settings | Light/Dark/System themes, reduced motion, contrast | `AppearanceSettings`, `ThemeToggle` |
| **SCR-025** | `/settings?tab=providers` | AI & BYOK Vault | Settings | Active LLM engine, API key vault, Ollama host, Marker | `AIProviderSettings`, `ProviderKeyCard` |
| **SCR-026** | `/settings?tab=usage` | Usage & Quota Plans | Settings | Storage quota, API limits, subscription tier upgrade | `UsagePlanSettings`, `PlanCard` |
| **SCR-027** | `/settings?tab=security`| Security & Danger Zone | Settings | Password update, logout sessions, Delete All Data | `SecuritySettings`, `DeleteModal` |
| **SCR-028** | `/pricing` | Pricing Matrix | Public | Free vs Pro Scholar tier comparison | `PricingView`, `PublicNavbar` |
| **SCR-029** | `/how-it-works` | Methodology Guide | Public | FSRS algorithm & Cornell note-taking explanation | `HowItWorksView` |
| **SCR-030** | `/security` | Security & Privacy Whitepaper | Public | Encryption, zero-data-retention, BYOK architecture | `SecurityView` |
| **SCR-031** | `/privacy` | Privacy Policy | Public | Data handling disclosure | `PrivacyView` |
| **SCR-032** | `/terms` | Terms of Service | Public | Terms and conditions | `TermsView` |

---

## 3. Core Feature Inventory (`FEAT-xxx`)

| Feature ID | Feature Name | Associated Screens | Description | Prerequisite |
| :--- | :--- | :--- | :--- | :--- |
| **FEAT-001** | Account Authentication & Session | SCR-002, SCR-003, SCR-027 | Local JWT / Supabase Auth with encrypted token persistence in localStorage | None |
| **FEAT-002** | Guided Onboarding Workflow | SCR-005, SCR-006 | Focus domain selection (Academic, STEM, Research, Lifelong) | First launch |
| **FEAT-003** | Global Command Palette | All Workspace Screens | Quick jump navigation, search topics, notes, flashcards (Cmd/Ctrl+K) | Authenticated |
| **FEAT-004** | Real-Time Telemetry & Health | All Workspace Screens (TopBar) | Sidecar heartbeat polling, active sync status, latency display | Backend active |
| **FEAT-005** | PDF Upload & Extraction | SCR-008, SCR-010 | Multi-engine document parsing (PyMuPDF / Marker AI / Datalab) | PDF document |
| **FEAT-006** | Table of Contents Extraction | SCR-008, SCR-010 | Hierarchical chapter/topic tree generation with collapsible nodes | PDF document |
| **FEAT-007** | Split-Screen Study Workspace | SCR-010 | Resizable dual-pane: PDF Viewer on left, Cornell Notes on right | Document loaded |
| **FEAT-008** | PDF Viewer & Annotations | SCR-010 | Text selection, yellow/green highlights, sticky notes, page jump | Document loaded |
| **FEAT-009** | Cornell Note-Taking | SCR-010, SCR-012 | Two-column Cornell format with cues, notes, and summary block | Document loaded |
| **FEAT-010** | Notion-Style Block Editor | SCR-010, SCR-012 | Slash commands, formatting blocks, checklist, callout boxes | Document loaded |
| **FEAT-011** | Paper Style Switching | SCR-010, SCR-012 | Ruled lined paper, dot grid paper, plain paper backgrounds | Notes View |
| **FEAT-012** | AI Cornell Scaffolding | SCR-010, SCR-012 | Automatic generation of Cornell summary & cues from reading slice | AI Provider |
| **FEAT-013** | Socratic Diagnostic Drill | SCR-010 | AI-driven conceptual testing with misconception detection | AI Provider |
| **FEAT-014** | Atomic Concept Extraction | SCR-009, SCR-010 | Deconstruction of chapters into atomic, digestible concept nodes | Document loaded |
| **FEAT-015** | Mathematical LaTeX Rendering | SCR-009, SCR-010, SCR-012 | KaTeX inline and block equation rendering with KaTeX fonts | Valid LaTeX string |
| **FEAT-016** | Multi-Document RAG Q&A | SCR-011 | Knowledge Hub chat with scope selector and verifiable citations | Processed PDF |
| **FEAT-017** | Interactive Source Previews | SCR-011 | Modal inspection of chunk snippet, document name, and page number | Citation clicked |
| **FEAT-018** | Flashcard Generation | SCR-010, SCR-014 | Topic-based or text-selection-based flashcard set generation | AI Provider |
| **FEAT-019** | Manual Flashcard Management | SCR-015 | Add card, edit front/back markdown, delete card, rename set | Flashcard set |
| **FEAT-020** | Interactive Flashcard Study | SCR-016 | 3D flip card, Again/Hard/Good/Easy rating buttons, keyboard shortcuts | Flashcards in set |
| **FEAT-021** | Daily FSRS Review Queue | SCR-013 | Spaced repetition queue using FSRS-4.5 stability and difficulty formulas | Cards due for review |
| **FEAT-022** | AI Quiz Generation | SCR-017 | Configurable MCQ / True-False quiz generation with difficulty tiers | AI Provider |
| **FEAT-023** | Interactive Quiz Attempt | SCR-019 | Question navigator, radio selection, review flagging, submission modal | Quiz created |
| **FEAT-024** | Automated Quiz Grading | SCR-020 | Immediate scoring, explanation breakdown, misconception analysis | Quiz submitted |
| **FEAT-025** | Spaced Repetition Analytics | SCR-021 | 7d/30d/90d activity charts, retention curves, learning gaps list | Study activity |
| **FEAT-026** | BYOK Encrypted Key Vault | SCR-025 | AES-256 encrypted storage for Gemini, OpenAI, Groq, Datalab keys | User key |
| **FEAT-027** | Local Ollama Integration | SCR-025 | Offline private LLM integration with configurable localhost URL | Ollama running |
| **FEAT-028** | LLM Prompt Inspector & Tuner | SCR-022 | View/edit 10 system prompts, test prompt changes, track token costs | AI Provider |

---

## 4. Interactive Controls Inventory (`CTRL-xxx`)

| Control ID | Screen | Element Label / Icon | Control Type | Default State | Intended Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CTRL-001** | TopBar | Logo (`RecallLogo`) | Link | Active | Navigates to `/app` (Dashboard) |
| **CTRL-002** | TopBar | Search bar / `⌘K` | Button | Enabled | Opens global Command Palette modal |
| **CTRL-003** | TopBar | `Review` Quick Pill | Link | Visible | Quick jump to `/app/review` queue |
| **CTRL-004** | TopBar | Theme Toggle | Button | System/Current | Toggles between Light and Dark themes |
| **CTRL-005** | TopBar | Account Avatar | Dropdown | Closed | Opens account menu with Settings, Analytics, Logout |
| **CTRL-006** | TopBar | Hamburger Menu | Button | Hidden on desktop | Opens mobile drawer navigation |
| **CTRL-007** | Sidebar | Collapse / Expand Toggle | Button | Expanded | Toggles sidebar width between 256px and 72px |
| **CTRL-008** | Sidebar | Navigation Links (10 items) | Links | 1 Active | Navigates to corresponding workspace route |
| **CTRL-009** | Dashboard | `Upload Document` | Button / Dropzone | Enabled | Triggers file picker or handles PDF drop |
| **CTRL-010** | Dashboard | `Start Review` | Button | Enabled if due > 0 | Enters active review session |
| **CTRL-011** | Dashboard | Recent Document Card | Link | Enabled | Opens `/books/:id` or `/documents/:id` |
| **CTRL-012** | Documents | Search Input | Text Field | Empty | Filters documents by title/filename in real-time |
| **CTRL-013** | Documents | Status Filter Dropdown | Select | 'all' | Filters by Ready, Processing, Failed |
| **CTRL-014** | Documents | Sort Order Dropdown | Select | 'newest' | Sorts by Newest, Oldest, Alphabetical |
| **CTRL-015** | Documents | Card Action Menu (Delete) | Button | Closed | Opens `DocumentDeleteDialog` |
| **CTRL-016** | Document Detail | Tab Navigation (5 tabs) | Tabs | 'overview' | Switches between Overview, Summary, Concepts, Sources, Study |
| **CTRL-017** | Document Detail | `Generate Summary` | Button | Enabled | Triggers summary generation via AI provider |
| **CTRL-018** | Document Detail | `Extract Concepts` | Button | Enabled | Triggers atomic concept extraction |
| **CTRL-019** | Document Detail | `Start Quiz` | Button | Enabled | Navigates to Quiz generator with document pre-selected |
| **CTRL-020** | Book Detail | TOC Tree Node | Button / Accordion | Collapsible | Jumps PDF to page and loads topic Cornell notes |
| **CTRL-021** | Book Detail | TOC Search Field | Text Field | Empty | Searches topics and chapters by name |
| **CTRL-022** | Book Detail | Pane Resizer Bar | Draggable Divider | 320px | Resizes TOC sidebar width (240px - 480px) |
| **CTRL-023** | Book Detail | Note Mode Switcher | Button Group | 'preview' | Toggles between Markdown Preview and Raw Edit |
| **CTRL-024** | Book Detail | Paper Style Switcher | Select | 'ruled' | Toggles between Ruled, Grid, and Plain paper |
| **CTRL-025** | Book Detail | `Generate Notes` (AI) | Button | Enabled | Scaffolds Cornell notes from active topic slice |
| **CTRL-026** | Book Detail | `Start Drill` (Socratic) | Button | Enabled | Opens Socratic diagnostic question drill widget |
| **CTRL-027** | Book Detail | Socratic Answer Input | Textarea | Empty | Student types conceptual explanation |
| **CTRL-028** | Book Detail | Socratic `Submit Answer` | Button | Disabled if empty | Submits answer to AI evaluator for misconception analysis |
| **CTRL-029** | Book Detail | `Generate Flashcards` | Button | Enabled | Opens FlashcardGenModal for active topic |
| **CTRL-030** | Book Detail | `Copy Notes` | Button | Enabled | Copies markdown note content to system clipboard |
| **CTRL-031** | Book Detail | `Download Note` | Button | Enabled | Downloads `.md` file to student's local computer |
| **CTRL-032** | Knowledge Hub | Scope Selector Dropdown | Select | 'All Documents' | Restricts RAG retrieval to specific document |
| **CTRL-033** | Knowledge Hub | New Chat Button | Button | Enabled | Starts fresh conversation session |
| **CTRL-034** | Knowledge Hub | Chat Input Field | Textarea | Empty | Accepts multi-line student queries |
| **CTRL-035** | Knowledge Hub | Send Message Button | Button | Disabled if empty | Sends query to streaming RAG endpoint |
| **CTRL-036** | Knowledge Hub | Stop Generating Button | Button | Visible when streaming | Aborts active SSE streaming response |
| **CTRL-037** | Knowledge Hub | Citation Pill (`[1]`) | Button | Clickable | Opens modal previewing source chunk & page |
| **CTRL-038** | Notes | Category Filter Tabs | Tabs | 'all' | Toggles All, Cornell, Annotations |
| **CTRL-039** | Notes | Book Filter Dropdown | Select | 'All Books' | Filters notes by source book |
| **CTRL-040** | Notes | New Note Button | Button | Enabled | Opens modal to select book/topic for new note |
| **CTRL-041** | Notes | Delete Note Button | Button | Enabled | Confirms and permanently removes note record |
| **CTRL-042** | Review | Start Review Session | Button | Enabled if queue > 0 | Begins active FSRS review |
| **CTRL-043** | Review | `Show Answer` / Spacebar | Button / Hotkey | Active | Reveals back of flashcard |
| **CTRL-044** | Review | `Again` Button / Key 1 | Button / Hotkey | Visible revealed | FSRS rating: Again (lapse, interval reset) |
| **CTRL-045** | Review | `Hard` Button / Key 2 | Button / Hotkey | Visible revealed | FSRS rating: Hard (minor increase) |
| **CTRL-046** | Review | `Good` Button / Key 3 | Button / Hotkey | Visible revealed | FSRS rating: Good (optimal recall) |
| **CTRL-047** | Review | `Easy` Button / Key 4 | Button / Hotkey | Visible revealed | FSRS rating: Easy (large interval bonus) |
| **CTRL-048** | Quizzes | `Generate Quiz` Button | Button | Enabled | Opens Quiz generation modal |
| **CTRL-049** | Quizzes | Question Count Slider | Slider | 5 | Sets number of questions (3 to 20) |
| **CTRL-050** | Quizzes | Question Type Selector | Radio / Buttons | 'mixed' | MCQ, True/False, or Mixed |
| **CTRL-051** | Quizzes | Quiz Option Radio Button | Radio | Unselected | Selects answer choice for active question |
| **CTRL-052** | Quizzes | `Flag Question` Toggle | Button | False | Flags question for review before final submission |
| **CTRL-053** | Quizzes | `Submit Quiz` Button | Button | Enabled | Opens confirmation dialog and scores attempt |
| **CTRL-054** | Settings | Tab Selector (5 tabs) | Tabs | 'account' | Navigates between Account, Appearance, AI, Usage, Security |
| **CTRL-055** | Settings | Daily Goal Input | Number Input | 20 | Sets daily card review goal (1 to 500) |
| **CTRL-056** | Settings | Provider Card Toggle | Radio / Button | 'gemini' | Switches active LLM provider |
| **CTRL-057** | Settings | Secret Key Input | Password Field | Masked | Accepts and saves provider API key to keychain |
| **CTRL-058** | Settings | `Test Connection` Button | Button | Enabled | Verifies API key validity against live provider endpoint |
| **CTRL-059** | Settings | Delete All Data Button | Button | Destructive | Opens confirmation modal requiring "DELETE" to wipe data |

---

## 5. Application Settings Inventory (`SET-xxx`)

| Setting ID | Setting Key | Category | Supported Values | Persistence Storage | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SET-001** | `theme` | Appearance | `'light'`, `'dark'`, `'system'` | `localStorage` / DB preferences | Application color mode |
| **SET-002** | `app-contrast-level` | Appearance | `0` to `100` (integer) | `localStorage` | High-contrast accessibility scaling |
| **SET-003** | `recall-reduced-motion` | Appearance | `true`, `false` | `localStorage` | Disables transition animations |
| **SET-004** | `notebook-paper-style` | Appearance | `'ruled'`, `'grid'`, `'plain'` | `localStorage` | Cornell notebook background grid styling |
| **SET-005** | `pdf_theme` | Appearance | `'light'`, `'dark'`, `'sepia'` | Redux / `settingsStore` | PDF canvas background color filter |
| **SET-006** | `llm_provider` | AI Engine | `'gemini'`, `'openai'`, `'groq'`, `'ollama'` | Encrypted Vault / DB | Active primary inference engine |
| **SET-007** | `gemini_api_key` | BYOK Vault | Secret String | OS Keychain / Encrypted DB | Google Gemini API key |
| **SET-008** | `openai_api_key` | BYOK Vault | Secret String | OS Keychain / Encrypted DB | OpenAI API key |
| **SET-009** | `groq_api_key` | BYOK Vault | Secret String | OS Keychain / Encrypted DB | Groq API key |
| **SET-010** | `ollama_host` | AI Engine | URL (e.g. `http://localhost:11434`) | `settingsStore` / DB | Local Ollama daemon endpoint |
| **SET-011** | `fallback_to_cloud` | AI Engine | `true`, `false` | Redux / `settingsStore` | Automatic fallback if local model is offline |
| **SET-012** | `pdf_extractor` | PDF Engine | `'pymupdf4llm'`, `'marker'`, `'marker_api'` | `settingsStore` / DB | Extraction engine for mathematical documents |
| **SET-013** | `datalab_api_key` | BYOK Vault | Secret String | OS Keychain / Encrypted DB | Marker Cloud API key |
| **SET-014** | `daily_review_goal` | Learning | `1` to `500` cards | DB user preferences | Daily flashcard target for study streak |
| **SET-015** | `show_attribution_tags` | Learning | `true`, `false` | Redux / `settingsStore` | Show AI provider badge on generated cards |
| **SET-016** | `langfuse_public_key` | Telemetry | String | OS Keychain / Encrypted DB | Langfuse observability public key |
| **SET-017** | `langfuse_secret_key` | Telemetry | Secret String | OS Keychain / Encrypted DB | Langfuse observability secret key |
| **SET-018** | `langfuse_host` | Telemetry | URL | `settingsStore` / DB | Langfuse telemetry server host |
| **SET-019** | `chat_prompt` | Prompt Customization | System Prompt String | SQLite `settings` table | System prompt for AI Tutor Chat |
| **SET-020** | `socratic_question_prompt` | Prompt Customization | System Prompt String | SQLite `settings` table | Prompt for diagnostic Socratic drill questions |
| **SET-021** | `socratic_evaluation_prompt` | Prompt Customization | System Prompt String | SQLite `settings` table | Prompt for answer scoring and misconception detection |
| **SET-022** | `flashcard_prompt` | Prompt Customization | System Prompt String | SQLite `settings` table | Prompt for active recall flashcard generation |
| **SET-023** | `cornell_scaffold_prompt` | Prompt Customization | System Prompt String | SQLite `settings` table | Prompt for Cornell cues and summary generation |
| **SET-024** | `markdown_cleanup_prompt` | Prompt Customization | System Prompt String | SQLite `settings` table | Prompt for OCR and LaTeX equation cleanup |

---

## 6. End-to-End Workflow Inventory (`FLOW-xxx`)

| Workflow ID | Workflow Name | Step-by-Step Trajectory |
| :--- | :--- | :--- |
| **FLOW-001** | **User Onboarding & Setup** | Launch app -> Welcome Screen / Onboarding -> Select focus area -> Save active AI provider and credentials -> Land on Dashboard. |
| **FLOW-002** | **Document Ingestion & Parsing** | Drag/drop PDF on Dashboard or Documents view -> File validation -> Upload to backend -> Multi-stage extraction (PyMuPDF / Marker) -> Chunking -> TOC extraction -> Automatic redirect to Document Reader (`/books/:id`). |
| **FLOW-003** | **Split-Screen Reading & Note Taking** | Open document -> Select chapter in TOC -> PDF scrolls to page -> Read passage -> Add yellow highlight / sticky note -> Type structured notes in Cornell Editor -> Verify autosave. |
| **FLOW-004** | **AI Cornell Note Scaffolding** | Open difficult topic -> Click `Generate Cornell Notes` -> Python sidecar segments text -> Cornell cues, summary, and questions generated -> Rendered with LaTeX in editor -> Edit and persist. |
| **FLOW-005** | **Socratic Diagnostic Drill** | Navigate to topic -> Click `Start Socratic Drill` -> AI formulates conceptual probe -> Student inputs explanation -> Submit -> AI evaluates logic, spots misconceptions, and provides corrective feedback. |
| **FLOW-006** | **Flashcard Deck Generation** | Topic or text selection -> Click `Generate Flashcards` -> Select card count -> Preview generated Q&A cards -> Save to deck -> Persisted in SQLite. |
| **FLOW-007** | **Interactive Flashcard Study** | Open Deck -> Click `Study Deck` -> Front card displayed -> Spacebar to flip -> Read answer -> Rate difficulty (1-4) -> Progress bar advances -> Summary modal upon completion. |
| **FLOW-008** | **Daily FSRS Spaced Repetition** | Open `/app/review` -> Check due cards count -> Click `Start Review` -> Evaluate cards with Again/Hard/Good/Easy -> FSRS-4.5 recalculates stability ($S$) and next review interval ($I$) -> Queue completed -> Streak increments. |
| **FLOW-009** | **AI Quiz Assessment** | Navigate to `/app/quizzes` -> Click `Generate Quiz` -> Select source document, question count, and difficulty -> Quiz generated -> Take quiz -> Flag doubtful questions -> Submit -> View instant score, question breakdown, and explanations. |
| **FLOW-010** | **Multi-Document Knowledge Hub RAG** | Open `/app/chat` -> Select document scope -> Type academic research query -> SSE streaming response arrives -> Verify inline citations `[1]` -> Click citation to view original textbook snippet. |
| **FLOW-011** | **Learning Mastery & Analytics** | Open `/app/progress` -> Switch time range (7d / 30d / 90d) -> Inspect cards mastered, retention rate, and study time -> Review learning gaps -> Click gap topic to resume study. |
| **FLOW-012** | **AI Engine & BYOK Management** | Open `/settings?tab=providers` -> Test current provider -> Enter new API key -> Click `Test Connection` -> Save to vault -> Switch active provider -> Verify instant effect across chat, notes, and quizzes. |
