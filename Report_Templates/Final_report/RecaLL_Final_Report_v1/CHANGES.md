# RecaLL final report: version 1

This is the first full version of the report, built from the CUET SWE template (`CUET_SWE_Final_Report_LaTeX_Template_B22`).

- **Compiling:** it compiles with pdfLaTeX and BibTeX into 182 pages with no errors, no undefined references and no BibTeX warnings. It was checked locally with TinyTeX 2026.11 using `latexmk -pdf main.tex`. On Overleaf, set the compiler to pdfLaTeX and the main document to `main.tex`.
- **Placeholders:** every missing value prints in red as `[TODO: ...]`, or as `TBD` in the team table. Search the PDF for "TODO" and "TBD" before submitting.

## Structure

- **Front matter:** cover, team table, executive summary, contents, list of figures and list of tables.
- **Chapters 1–9:** the same order and sections as the template, plus 9.4 Ethical Considerations, as in the Porikroma example.
- **Additional subsection:** 4.2 now includes "Data-Flow Diagrams (Levels 0, 1 and 2)", which the teacher asked for.
- **Appendices A–F:**
  - A: repository link, commit and real source listings
  - B: all 328 automated tests and their results, generated from the test run
  - C: screenshots
  - D: meeting log (to be filled in)
  - E: deployment diagram and the full ER schemas
  - F: AI model card and prompt registry

## Diagrams (`images/diagrams/*.pdf`, SVG sources in `tools/svg_src/`)

**New:**
- system_overview
- arch_l0, arch_l1, arch_l2_pipeline, arch_l2_ai (architecture at levels 0, 1 and 2)
- dfd_level2_process_doc, dfd_level2_review, dfd_level2_ask (DFD level 2)
- ai_architecture
- component_diagram
- strategy_pattern
- process_model
- cicd_pipeline
- git_workflow
- gui_wireframe
- activity_import, activity_review, activity_drill
- er_core
- The test chart (Figure 7.1) is drawn directly in LaTeX with pgfplots.

**Reused from `docs/diagrams/bw`, checked against commit 60d40f9 and corrected:**
- usecase: drill and quiz now work; handwritten notes partly work; Groq and OpenRouter added.
- dfd_level0 and dfd_level1: OpenRouter added.
- deployment: unchanged.
- er_saas: unchanged.
- er_legacy: `books.workspace_id` added.
- class_chat_ai, class_documents, class_study_billing: embeddings now read "API or hash".
- seq_upload: the response is 202, and embeddings use the API with a hash fallback.
- seq_chat: history loads the latest messages; citations are checked for overlap.
- seq_drill: the grading prompt is now registered.
- seq_login: the webhook checks an HMAC signature.
- activity_study: the drill grading steps no longer fail.
- state_flashcard, state_job: unchanged.
- state_subscription: redrawn.

`docs/diagrams/` itself was not changed.

## Real data used

- **Backend tests:** run on 16 Nov 2026 at commit 60d40f9, on Windows with Python 3.13 and with no provider keys, so no real AI calls were made.
  - `app/tests`: 223 of 223 passed.
  - `tests/`: 103 passed, 1 failed and 1 skipped. The failure is a test that needs a local Ollama server.
  - Statement coverage is 50.5% of the application code.
  - The raw JUnit files are in `tools/test_results/`.
- **GitHub Actions:** the latest CI run on `main` failed. The backend job had 222 of 223 tests pass (one Linux-only path test failed), and the frontend job stopped on six TypeScript errors, so the Playwright tests did not run. The release run for v0.1.5 also failed. The report states all of this.
- **API tables:** they list every `/api/v1` endpoint (87) and 48 of the 71 study routes, parsed from the code.

## Things the team should know (stated honestly in the report)

1. **Security gaps** (security findings table in Section 7.6; requirements in Section 3.6):
   - `/api/delete-all-data` needs no login and deletes every workspace's documents.
   - Saved BYOK keys are also copied in plain text into the legacy settings table, and `GET /settings/api-keys` returns them without login.
   - 59 of the 71 study routes have no login check.
   - `/api/set-user` switches the active database without a check.
   - The development secrets have fixed default values.
2. **Socratic grading works.** The old "missing prompt" bug is fixed in the code (`prompt_manager.py:554`).
3. **Embeddings** are real when a server key is configured. Otherwise they are hash placeholders, so search is keyword-led.
4. **Drill cards** saved from a Socratic drill go to the legacy flashcards table, so they do not appear on the Review page.
5. **Local tests use real AI keys.** When run on a PC whose `.env` holds real AI keys, some tests call the real AI APIs and use up quota. Run them with the keys blanked, as CI does.

## Placeholders to fill (search the PDF for `TODO` and `TBD`)

- **config.tex:**
  - course code (CSE-356, CSE-434 or CSE-300?)
  - submission date
  - second course teacher
  - phone, credits and CGPA for each member (`\tbd`)
  - confirmation of the e-mail addresses
  - photos in `images/photos/<ID>.jpg`
- **Chapter 1:** target import time, survey (optional), and a check of the competitor feature pages.
- **Chapter 2:**
  - which GitHub account belongs to whom ("Turjo" and "Saimun" nicknames); the contribution table and text
  - meeting frequency
  - October activity
  - term dates
  - laptop specifications and minimum RAM
  - IDEs used
  - budget figures
  - Bangladeshi data-protection law citation
- **Chapter 3:** backup decision, law citation, account deletion, and the measured AI metrics (R-AI-03, 04, 07, 10, 11, 12).
- **Chapter 4:**
  - team hardware
  - release-asset upload method
  - PR #2 outcome
  - branch protection and review practice
  - whether the leaked keys were revoked
  - GitHub identity mapping
  - contributors-graph screenshot
- **Chapter 5:** provider comparison, load-test tool, user-test schedule, test roles, and colour contrast.
- **Chapter 6:** editors, models used per member, the SQLite tool, measured latencies, and the review checklist.
- **Chapter 7:**
  - test-case authors and reviewers
  - manual test results TC-MAN-04, 06 and 07
  - **UAT results (Rony)**
  - performance and volume measurements
  - optional OWASP ZAP scan
  - live AI-quality numbers
  - defects found
- **Chapter 8:** pilot users and dates, support channel, rollback safety, and a CI screenshot.
- **Chapter 9:** consent method for user tests, and confirmation of AI-tool use.
- **Appendices:**
  - A: final commit hash
  - D: the whole meeting log
  - F: models used and measured results
- **Executive summary:** final numbers (UAT).

## Not verified / known limits

- The full ER diagrams (Figures E.2 and E.3) are too dense to read in print. Use the HTML schema docs in `docs/database/` as the readable reference, or print those pages on A3.
- The Mermaid-based class, sequence and activity diagrams have small labels, about 5 pt, on their landscape pages.
- The Playwright end-to-end tests, a load test and an external security scan were not run.
- The contribution split between members is inferred from git and must be confirmed by the team.

## Tools in `tools/`

- `check_tex.py`: static checks
- `loginfo.py`: overfull-box summary from the log
- `gen_appendixB.py`: regenerates Appendix B from JUnit files
- `svg2pdf.py`: converts SVG to PDF with headless Edge; pass an absolute `--out` path
- `BRIEF.md`: the facts sheet used to write the report
