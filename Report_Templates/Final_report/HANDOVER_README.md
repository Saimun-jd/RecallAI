# RecaLL final report: handover

From Md. Rony Hossain (2204005), 17 Nov 2026.

## What's in this folder

| Item | What it is |
| --- | --- |
| `RecaLL_Final_Report_v1.pdf` | The current report (version 1, about 182 pages). Read this first. |
| `RecaLL_Final_Report_v1/` | **The editable LaTeX source.** All changes go here. |
| `RecaLL_Final_Report_v1/CHANGES.md` | What's done and **the list of everything still missing**. |
| `RecaLL_Final_Report_v1/AGENTS.md` | Instructions for an AI agent (Claude Code, Codex, Cursor and so on). `CLAUDE.md` points to it. |
| `REPORT_PLAN.md` | Map of each template section to where its content comes from in the project. |
| `CUET_SWE_Final_Report_LaTeX_Template_B22/` | The teacher's template. Its README has the submission checklist. |
| `Porikroma_Final_Report (4).pdf` | Another group's finished report, as an example of the expected depth. |

## What you need to do

1. **Get the project code.** Clone https://github.com/Saimun-jd/RecallAI, or pull it if you already have it. The report was checked against commit `60d40f9`.
2. **Put this folder inside the repository** at `Report_Templates/Final_report/`, so the agent can check the report against the code.
3. **Collect the missing data** (the full list is in `CHANGES.md`):
   - course code (CSE-356, CSE-434 or CSE-300?), submission date, and the second course teacher
   - each member's phone, credits passed, CGPA and a photo (`images/photos/<ID>.jpg`)
   - who did what: the contribution table in Chapter 2, and which GitHub account belongs to whom (Turjo or Saimun?)
   - Rony's user-testing results (Chapter 7.5)
   - meeting minutes (Appendix D) and budget figures (Chapter 2.7)
4. **Open your AI agent in `RecaLL_Final_Report_v1/`** and tell it something like:
   > Read AGENTS.md and CHANGES.md. I'll give you the missing data; fill the placeholders, keep everything else as it is, then compile and check.
5. **Compile.**
   - On Overleaf: New Project, then Upload Project, then a zip of `RecaLL_Final_Report_v1/`. Set the compiler to pdfLaTeX and the main document to `main.tex`.
   - Or locally: `latexmk -pdf main.tex`.
6. **Before you submit,** search the PDF for **TODO** and **TBD**. Every red marker must be gone.

## Important notes

- **Don't invent numbers.** Leave a red TODO in place rather than guess.
- **The report is honest about problems.** It says that CI is failing and lists several security gaps (Section 7.6). Keep that. If someone fixes the code, update the text.
- **Running the backend tests on your PC uses real AI keys.** If your `.env` has real keys, the tests call the AI APIs and use your quota. Blank the keys first; the command is in `AGENTS.md`.
