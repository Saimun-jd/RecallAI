# Team answers (confirmed by Md. Rony Hossain, 18 Nov 2026)

These are the only facts to use when replacing placeholders. Do not invent anything beyond them.

## Cover and team
- Course code: **CSE-356**. Submission date: **19 November 2026**.
- Course teachers (cover page and acknowledgement):
  - **Mir Md. Saki Kowsar**, Assistant Professor, Department of CSE, CUET
  - **Md. Refaj Hossan**, Lecturer, Department of CSE, CUET

  Sharmistha Chanda Tista must not appear anywhere.
- Members:
  - All four have 101.75 credits passed.
  - E-mails follow the pattern `u<ID>@student.cuet.ac.bd`.
  - Phone numbers use the format +880 1XXX-XXXXXX.

  | Name | Nickname | ID | Phone | CGPA | Photo file |
  |---|---|---|---|---|---|
  | Al Rubayet | Turjo (team lead) | 2204002 | +880 1633-707780 | 3.40 | images/photos/2204002.jpeg |
  | Md. Rony Hossain | Rony | 2204005 | +880 1817-358156 | 3.50 | images/photos/2204005.jpg |
  | Imteajul Islam | Saimun | 2204015 | +880 1749-553050 | 3.52 | images/photos/2204015.png |
  | Tahsin Ahmed Chowdhury | Tahsin | 2204028 | +880 1841-230608 | 3.50 | images/photos/2204028.png |

## Work division (option "role-based plus evidence")
- **Saimun (Imteajul Islam):** project idea, initial plan, backend code. Owns the GitHub account `Saimun-jd`.
- **Turjo (Al Rubayet):** team lead and frontend. The GitHub account `rubayet2027` is Turjo's. Turjo did some backend work, but most commits from `rubayet2027` were made on Saimun's computer while it was logged in to Turjo's account. So **do not list Turjo for backend**, and explain this in one sentence where the git statistics are discussed.
- **Tahsin (Tahsin Ahmed Chowdhury):** database design.
- **Rony (Md. Rony Hossain):** unit and integration testing, real-user testing, and UI work.
- **Everyone:** Saimun drafted the initial plan; then the whole team sat together, finalised the plan and agreed future work.
- **October 2026:** the university was closed, so there was no project work and no commits. State this plainly.
- **Bugs:** many bugs were fixed during development by Turjo and Saimun; they were not tracked individually. Never give a number.

Contribution tick table (columns: Req. spec, Planning, Design, AI integration, UI, Testing, Deployment, Docs):

| Member | Ticks |
|---|---|
| Al Rubayet (Turjo) | Req, Plan, Design, UI, Docs |
| Imteajul Islam (Saimun) | Req, Plan, Design, AI, Deploy, Docs |
| Tahsin Ahmed Chowdhury | Req, Plan, Design, Testing, Docs |
| Md. Rony Hossain | Req, Plan, UI, Testing, Docs |

In the text, add "Database" to Tahsin's description, and backend to Saimun's.

## Organisation and meetings
- **Lead:** Turjo.
- **Meetings:** all members live in the university hall and met every week before the lab session, in person, to plan, work and check each other's work. No minutes were recorded.
- **Appendix D:** turn it into a **progress log reconstructed from the git history**. Use one row per real increment, with the real dates from `git log` and what was delivered. Attendees: "All members (weekly pre-lab meeting)". Add an intro sentence stating that formal minutes were not kept and that the log is reconstructed from the commit history and the team's weekly meetings. Do not invent decisions; describe what the commits delivered. The increments (from the D2 diagram agent) are:
  1. 22–24 Jul: CLI extraction prototype
  2. 5 Aug: desktop app and notes
  3. 19–25 Aug: Socratic drill, new UI, release workflow, v0.1.5 pre-release (24 Aug)
  4. 26 Aug – 9 Sep: cloud login, OCR, AI chat, per-concept drill, long-document processing
  5. 12–21 Sep: `/api/v1` core (ingestion, RAG chat, flashcards, quizzes, attempts, spaced repetition), reconcile merge on 16 Sep, review queue UI, hardening
  6. 25–29 Sep: isolation matrix, containers, `ci.yml` (25 Sep), Knowledge Hub and UI fixes
  7. October: university closed, no work
  8. 5 Nov: review fixes, PR #1 merged

  Check the dates with `git log --date=short` in `D:/Projects/Recall-Ai`.
- **Term dates:** do not invent a semester start date. Say the project ran from 20 July 2026 (the first commit was 22 July) to the submission on 19 November 2026.

## Machines and tools
- **Laptops:** all run Windows with a 512 GB SSD.
  - Saimun: 32 GB RAM, Intel Core i5.
  - Turjo: 16 GB RAM, AMD Ryzen 5.
  - Rony: 16 GB RAM, AMD Ryzen 7.
  - Tahsin: 16 GB RAM, Intel Core i5.
- **Editors:** Antigravity and VS Code. **SQLite viewer:** none, so remove that sentence.
- **AI providers used:** the Gemini API (`gemini-3.6-flash` is the configured model) and local models through Ollama; other providers are available as options in the app.
- **AI coding assistant (Chapter 9.4, Appendix F, Chapter 7.3 test-generation bullet):** "The Antigravity agent generated most of the code from requirements and designs the team had prepared beforehand, and was used to review the application and find bugs; all output was reviewed and tested by the team." Apply the same disclosure to the tests: they were largely written with the agent and reviewed by the team.

## Budget
- **No money was spent;** everything was free. Some optional AI providers in the app need a paid key, but the team didn't use them.
- **Remove the human-effort row.** Total cash cost: BDT 0.

## Security and other items
- **Leaked keys:** the keys removed in commit `9fd02fc` **were revoked**.
- **Release workflow:** `release.yml` has no `tagName`, so tauri-action only builds; it does not publish. The v0.1.5 pre-release with `Recall_0.1.5_x64-setup.exe` was published on GitHub by `Saimun-jd`. **PR #2** is still open (not merged). `main` has **no branch protection**. **Code review:** members checked each other's work at the weekly meetings; there were no formal PR reviews except PR #1.
- **Acknowledgement:** thank the two course teachers, the Department, and the six students who tested the app. No other names.
- **Remove these placeholders entirely:** the contributors-graph screenshot, the CI screenshot, the OWASP ZAP suggestion, and the "re-check vendor pages" note.

## User testing (Chapter 7.5, plus 8.3 pilot and 9.4 consent)
- **Testers:** six students, referred to as **P1–P6**: five from CSE and one from Mechanical Engineering. One of them is a team member (Rony), so write "six students, including one team member". Rony organised the sessions.
- **Areas tested:** authentication, UI/UX feedback, reading PDFs, Socratic grading, and flashcards.
- **Format:** informal sessions. No metrics (time, scores) were recorded. **State this.**
- **Feedback received** (feature requests). Present them in a table with the **status in the current build**; the integrator will verify the status against the code:
  1. Open the PDF view by default when a document is opened.
  2. Let the user choose the number of flashcards instead of a fixed 3 or 5.
  3. Add an OpenRouter provider option.
  4. View and read handwritten PDFs like text PDFs.
  5. Add AI note-creation support.
- **Consent:** write "participants took part voluntarily and used the team's own copy of the app". Do not claim a consent form.
- **Support channel:** in person, at the weekly meetings in the hall.
