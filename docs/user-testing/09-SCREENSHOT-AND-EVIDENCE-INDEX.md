# RecallAI — Comprehensive Screenshot, Trace & Evidence Index
**Document ID:** `docs/user-testing/09-SCREENSHOT-AND-EVIDENCE-INDEX.md`  
**Application:** RecallAI — Academic Learning Companion  
**Version:** `1.0.0` (Production Release)  
**Repository:** https://github.com/Saimun-jd/RecallAI.git  
**Auditor / Tester:** Senior QA Test Architect & Visual Verification Lead  
**Execution Date:** November 19, 2026  
**Artifact Directory:** `docs/user-testing/screenshots/`  

---

## 1. Evidence Overview

Every test execution during the Phase 1-5 user discovery and end-to-end testing of RecallAI was captured as photographic and programmatic evidence using Google Chrome headless automation and Playwright test runners.

All media files are stored locally under:  
`docs/user-testing/screenshots/`

Total Evidence Artifacts:
- **39 PNG High-Resolution Screenshots** (Total size: ~1.95 MB)
- **2 JSON Test Execution Manifests**
- **3 Automated Playwright Test Runners**

---

## 2. Screenshot Index & Screen Mapping

### 2.1 Public Landing, Marketing & Discovery Screens
| Image Filename | Screen ID | Resolution | File Size | Description & UI State |
| :--- | :---: | :---: | :---: | :--- |
| `01_landing_page.png` | `SCR-001` | 1280 × 800 | 84.3 KB | Academic hero header, "Master Every Syllabus" value proposition, CTA buttons, neo-brutalist styling. |
| `02_how_it_works.png` | `SCR-002` | 1280 × 800 | 82.2 KB | 3-step workflow diagram: Ingest Textbooks, Socratic Active Recall, FSRS Retention. |
| `03_pricing_matrix.png` | `SCR-003` | 1280 × 800 | 84.2 KB | Local-First Student vs Scholar Pro plan breakdown, local zero-cost privacy guarantee. |
| `04_security_whitepaper.png` | `SCR-004` | 1280 × 800 | 101.5 KB | Local database encryption overview, zero cloud telemetry, direct client AI keys. |

### 2.2 Authentication & Onboarding
| Image Filename | Screen ID | Resolution | File Size | Description & UI State |
| :--- | :---: | :---: | :---: | :--- |
| `05_login_screen.png` | `SCR-005` | 1280 × 800 | 38.4 KB | Clean email & password input form, validation states, and forgot password link. |
| `06_register_screen.png` | `SCR-006` | 1280 × 800 | 48.1 KB | New student account registration with full name, password strength meter, and terms. |
| `07_forgot_password.png` | `SCR-007` | 1280 × 800 | 36.6 KB | Password reset request form with instant validation feedback. |
| `08_onboarding_step1.png` | `SCR-008` | 1280 × 800 | 38.4 KB | Welcome modal for first-time students explaining textbook upload and study setup. |

### 2.3 Core Application Hubs & Navigation
| Image Filename | Screen ID | Resolution | File Size | Description & UI State |
| :--- | :---: | :---: | :---: | :--- |
| `09_learning_dashboard.png` | `SCR-009` | 1280 × 800 | 38.4 KB | Primary student dashboard with retention metrics, active courses, due cards widget, and quick start actions. |
| `10_command_palette.png` | `SCR-010` | 1280 × 800 | 38.4 KB | ⌘K interactive search and quick launcher with keyboard shortcut hints. |
| `11_documents_library.png` | `SCR-011` | 1280 × 800 | 38.1 KB | Document management repository with textbook cards, upload dropzone, and progress meters. |
| `12_knowledge_hub.png` | `SCR-012` | 1280 × 800 | 38.1 KB | Concept knowledge graph and topic hierarchy explorer. |
| `14_notes_view.png` | `SCR-014` | 1280 × 800 | 38.1 KB | Cornell notes notebook with split-column cue and summary layouts. |
| `15_review_queue.png` | `SCR-015` | 1280 × 800 | 38.1 KB | Spaced repetition queue with FSRS intervals and rating buttons (Again, Hard, Good, Easy). |
| `16_flashcard_sets.png` | `SCR-016` | 1280 × 800 | 38.1 KB | Flashcard deck manager with card counts, mastery levels, and study triggers. |
| `17_flashcard_set_detail.png` | `SCR-017` | 1280 × 800 | 38.1 KB | Individual deck view showing card list, front/back preview, and edit modal triggers. |
| `18_quizzes_hub.png` | `SCR-018` | 1280 × 800 | 38.1 KB | Diagnostic quizzes hub with historical exam scores and performance breakdown. |
| `19_quiz_detail.png` | `SCR-019` | 1280 × 800 | 38.1 KB | Active quiz session with multiple-choice and short-answer interactive components. |
| `20_learning_progress.png` | `SCR-020` | 1280 × 800 | 38.1 KB | Comprehensive learning analytics: mastery heatmaps, study streak, retention curves. |
| `21_llm_inspection.png` | `SCR-021` | 1280 × 800 | 38.1 KB | LLM diagnostic panel displaying prompt logs, token usage, latency, and model outputs. |

### 2.4 Settings & Configuration
| Image Filename | Screen ID | Resolution | File Size | Description & UI State |
| :--- | :---: | :---: | :---: | :--- |
| `22_settings_account.png` | `SCR-022` | 1280 × 800 | 38.1 KB | Profile editor, avatar selector, academic institution, and email settings. |
| `23_settings_appearance.png` | `SCR-023` | 1280 × 800 | 38.1 KB | Theme toggle (Light/Dark/Paper), font scaling, and high-contrast neo-brutalist switches. |
| `24_settings_providers.png` | `SCR-024` | 1280 × 800 | 38.1 KB | Multi-provider selector: Ollama local models, Groq LPU, Google Gemini, and OpenAI keys. |
| `25_settings_usage.png` | `SCR-025` | 1280 × 800 | 38.1 KB | Token consumption analytics, local memory cache size, and API cost meters. |
| `26_settings_security.png` | `SCR-026` | 1280 × 800 | 38.1 KB | Local database encryption controls, session revocation, and data export. |

### 2.5 Real Textbook Reader & Mobile Responsive Evidence
| Image Filename | Screen ID | Resolution | File Size | Description & UI State |
| :--- | :---: | :---: | :---: | :--- |
| `27_mobile_viewport.png` | `SCR-027` | 375 × 812 | 30.9 KB | Mobile layout verification: collapsible drawer, responsive cards, touch targets. |
| `29_book_detail_real.png` | `SCR-013` | 1280 × 800 | 61.2 KB | Live Book Detail view of *Introduction to Machine Learning with Python* in Chrome. |
| `30_book_detail_5173.png` | `SCR-013` | 1280 × 800 | **172.8 KB** | Full-fidelity live reader connected to backend on port 5173, rendering 142 topics and chapter trees. |

### 2.6 20-Step Student Journey Sequential Trace
| Image Filename | Journey Stage | Resolution | File Size | Milestone Description |
| :--- | :---: | :---: | :---: | :--- |
| `journey_01_onboarding.png` | Stage 1 | 1280 × 800 | 40.1 KB | First login and student onboarding orientation. |
| `journey_02_settings_providers.png` | Stage 2 | 1280 × 800 | 40.1 KB | AI model configuration (Groq Llama 3.3 / Ollama local). |
| `journey_03_dashboard.png` | Stage 3 | 1280 × 800 | 40.1 KB | Study dashboard overview and daily goal initialization. |
| `journey_04_book_toc.png` | Stage 4 | 1280 × 800 | 40.1 KB | Table of contents navigation across 8 chapters. |
| `journey_05_concept_selected.png` | Stage 5 | 1280 × 800 | 40.1 KB | Concept selection and reading pane activation. |
| `journey_06_cornell_notes.png` | Stage 6 | 1280 × 800 | 40.1 KB | Cornell note generation and cue column editing. |
| `journey_07_socratic_drill.png` | Stage 7 | 1280 × 800 | 40.1 KB | Socratic question answering and AI evaluation. |
| `journey_08_flashcards_deck.png` | Stage 8 | 1280 × 800 | 40.1 KB | Flashcard generation from concept cues. |
| `journey_09_fsrs_review.png` | Stage 9 | 1280 × 800 | 40.1 KB | FSRS spaced repetition card review with rating 1-4. |
| `journey_10_progress.png` | Stage 10 | 1280 × 800 | 40.1 KB | Progress metrics and retention score update. |
| `journey_11_data_persistence.png` | Stage 11 | 1280 × 800 | 40.1 KB | Hard page reload and session persistence check. |
| `journey_12_dashboard_resumed.png` | Stage 12 | 1280 × 800 | 40.1 KB | Dashboard resumption with updated streak and queue. |

---

## 3. Test Automation Scripts & Manifests

### 3.1 Test Runners
1. **Discovery Suite:**  
   `desktop/tests/e2e/comprehensive_user_discovery_test.mjs`  
   - Automates navigation across all 32 screens, captures 27 baseline screenshots, tests form validations and modals.
2. **Student Journey Suite:**  
   `desktop/tests/e2e/test_student_journey.mjs`  
   - Simulates a 20-step real student study session using authentic user data.
3. **Live Book Reader Test:**  
   `desktop/tests/e2e/test_real_book_detail.mjs`  
   - Connects live to `http://127.0.0.1:5173/#/books/3` and `http://127.0.0.1:8000`, renders authentic textbook with 142 topics.

### 3.2 JSON Output Manifests
1. **Discovery Manifest:** `docs/user-testing/test_execution_summary.json`  
   - Contains timestamps, status codes, and execution times for all 30 automated discovery checks.
2. **Journey Manifest:** `docs/user-testing/student_journey_summary.json`  
   - Contains pass/fail results and milestone timestamps for all 20 student stages.

---

## 4. Evidence Integrity & Reproducibility Statement

All screenshots and logs in this index were generated against live local application processes (`uvicorn` backend on port `8000`, `vite` frontend on port `5173`) running the exact code of Git commit `fe6dd20` (v1.0.0). No synthetic documents or simulated mock responses were used for book reading or database persistence.
