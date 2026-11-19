# RecaLL final report: plan and gap list

This is the brief for the session that builds the report. The builder writes; another session checks the result.

## 1. What to follow

- **Template:** `CUET_SWE_Final_Report_LaTeX_Template_B22/`. This is the real template, not only the PDF. `sample_output_preview.pdf` is this folder compiled with the placeholder text. Copy the folder and fill in:
  - `config.tex`
  - `chapters/ch01…ch09`
  - `frontmatter/`
  - `appendices/A…F`
  - `references.bib`
- **Example of a finished report:** `Porikroma_Final_Report (4).pdf`. It has 121 pages and the same 9 chapters and Appendices A–F as the template, with nothing added and nothing left out. The only change is that it adds "9.4 Ethical Considerations". It is a good guide to depth: 14 use cases with text tables, 43 API endpoints in tables, pseudocode algorithms, real test results and a latency chart.
- **Our older report:** `../RecaLL_Final_Report/main.tex` follows the older FocusGuard structure (Introduction, Motivation, Methodology, Implementation, Related Work). Reuse its text and its 18 figures, but rearrange them into the new 9 chapters.
- **Style:** black and white, the same as our slides. Porikroma draws its diagrams in TikZ with blue tints. We keep ours black and white.

## 2. Chapter map and sources for each part

| Template section | What it needs | Source in our project |
| --- | --- | --- |
| 1.1–1.5 Introduction | Goals, current situation, comparison with competing products, system overview figure, glossary | Old report sections 1–3 and Related Work (NotebookLM, ChatPDF, Anki, Quizlet, RemNote) |
| 2.1 Organization and contribution | Contribution table | git shortlog (Saimun 31 commits, rubayet2027 14) plus the team roles. **Needs the team's confirmation** |
| 2.2 Process model and rationale | Process model figure and rationale | Git history from 2026-07-22 to 2026-11-05, organised as increments |
| 2.3–2.5 Risk, constraints, tools | Tables | `requirements.txt`, `desktop/package.json` |
| 2.6 Timeline | Gantt chart | `docs/diagrams/14-gantt-team-plan.md`, redrawn in black and white |
| 2.7–2.8 Budget and impact | Budget table and impact text | Write new |
| 3.1–3.5 Requirements | Stakeholders, use case figure, a text table per use case (about 10–14 UCs), activity, class and sequence diagrams | `docs/diagrams/bw/01, 07a-c, 08-11, 12` |
| 3.6 Security | Access, integrity and privacy requirements | JWT, PBKDF2 with 600k rounds, AES-256-GCM for keys, local-first storage |
| 3.7 AI requirements | AI requirements | Providers Gemini, OpenAI, Groq and Ollama, chosen by the user (BYOK) |
| 4.1–4.3 Architecture | Style and rationale, high-level architecture figure, technology table | `04-system-architecture.svg` |
| 4.4 AI-integration architecture | Figure and text | `app/services` (prompt manager, provider layer) |
| 4.5 CI/CD | Pipeline figure plus the workflow listing | **`.github/workflows/ci.yml` and `release.yml` exist**, so this is real, not a plan |
| 4.6 Git | Branching, PRs and commit style | git log; PR #1 from Copilot |
| 5.1 HLD | Component diagram | New |
| 5.2 LLD | Design-pattern UML and pseudocode | Provider strategy, FSRS scheduling, PDF chunking, misconception-to-flashcard flow |
| 5.3 Database | ER diagram and schema tables | `docs/database/saas` and `legacy` (tbls) |
| 5.4 GUI | Wireframe next to the real screen | New wireframe plus `../Recall_Screenshots/dashboard.png` |
| 5.5 API documentation | Endpoint tables | FastAPI routers (`/api/v1/...`). Can be read from `/openapi.json` |
| 5.6 AI model design | Prompts, context, fallbacks | `prompt_manager.py`, Socratic drill, Cornell notes |
| 5.7 Test plan | Strategy and sample cases | `tests/` (25 files), CI |
| 6 Implementation | Environment, modules, AI implementation, code structure | Old report section 7 plus the repository tree |
| 7.1–7.8 Testing | Test results, traceability matrix, unit and integration tests, UAT/PT/VT, VAPT, AI testing, test-suite quality | **Run the real tests** (pytest and coverage), Rony's real user testing, and a local load test. Use only the documents already uploaded (AGENTS.md rule) |
| 8 Deployment | Environment, process, go-live | `run.bat`, Tauri release workflow, Docker files, `DEPLOYMENT.md` |
| 9 Sustainability (+ 9.4 Ethics) | Scalability, customization, maintenance, ethics | New text |
| App. A | Repository link, final commit hash, code snapshots | git |
| App. B | Full test-case tables | From the test run |
| App. C | Screenshots | `../Recall_Screenshots/` (11 images), plus more if needed |
| App. D | Meeting minutes | **The team must supply these** |
| App. E | Extra diagrams | Deployment, state machines, the second ER diagram |
| App. F | AI model card | Models, prompts, limits, no training done |

## 3. Diagrams

### Already made (`docs/diagrams/bw/`)
Use case, context DFD (level 0), DFD level 1, system architecture, deployment, two ER diagrams, three class diagrams, four sequence diagrams, one activity diagram and three state machines.

These were drawn at commit `9d47554`, and HEAD is now `60d40f9`. Re-check each one against the code before reusing it.

### New ones needed (the teacher asked for architecture and leveled views)

| # | Diagram | Where it goes | Level |
| --- | --- | --- | --- |
| N1 | System overview | 1.3 | L0 map |
| N2 | Process model as applied to RecaLL | 2.2 | flow |
| N3 | Gantt chart in black and white | 2.6 | n/a |
| N4 | Architecture, level 0 (whole system, 4–6 boxes) | 4.2 | L0 |
| N5 | Architecture, level 1 (layers and services) | 4.2 | L1 |
| N6 | Architecture, level 2 (document-processing pipeline; the AI provider layer) | 4.2 / 5.1 | L2 |
| N7 | DFD level 2 for the main processes: process document, study and review (FSRS), ask AI | 3 or App. E | L2 |
| N8 | AI-integration architecture | 4.4 | L1 |
| N9 | CI/CD pipeline stages (from `ci.yml` and `release.yml`) | 4.5 | flow |
| N10 | Git workflow (branches and PRs) | 4.6 | flow |
| N11 | Component diagram (HLD) | 5.1 | map |
| N12 | Design-pattern UML (provider strategy) | 5.2 | n/a |
| N13 | GUI wireframe of the dashboard | 5.4 | n/a |
| N14 | Two or three more activity diagrams (import a PDF, review flashcards, Socratic drill) | 3.3 | flow |
| N15 | Test-results chart (latency or coverage, from real runs) | 7.5 | chart |

**How to make them:** use the visual-diagram skill (clean style), export each SVG to PDF, and include it with `\includegraphics`. Overleaf cannot load SVG directly. Keep the text readable at 15 cm width.

## 4. Inputs only the team can give

1. **Course code.** The template and Porikroma say CSE-356, the template README says CSE-434, and our earlier report used CSE-300.
2. **Team member details:** student ID, CUET email, phone, credits passed, CGPA and a photo for each member.
3. **Supervisors:** names and titles.
4. **Individual contributions:** who did what, confirmed by the team.
5. **Meeting minutes and progress logs:** dates and decisions.
6. **Rony's user-testing data:** participants, tasks, results and SUS scores, if collected.
7. **Budget figures.**
8. **The official CUET logo,** unless the one in the template is already the official one.

## 5. Known facts to state honestly

- Socratic grading prompt bug: `socratic_evaluation_prompt` is not registered. Either the team fixes it, or the report calls it a known issue.
- Search embeddings are sha256 placeholder vectors.
- Billing is a mock.
- Supabase sync is not configured.
- FSRS is version 6 (the `fsrs` library 6.3.2). The README says 4.5, which is outdated.

## 6. Verification

There is no LaTeX on this PC. Either:
- install MiKTeX, so `latexmk -pdf main.tex` can run and each page can be rendered and checked; or
- compile on Overleaf and share the PDF for checking.

The checking session will:
- check every claim against the code;
- confirm each figure and table is cited in the text;
- confirm no `[TODO]` is left and the GUIDE boxes are turned off (`\guidesfalse`);
- check every diagram at the size it is printed.
