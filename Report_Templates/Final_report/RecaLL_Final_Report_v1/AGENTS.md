# Instructions for AI agents working on this report

This folder is the LaTeX source of the **RecaLL final report** for the CUET Software Engineering (Sessional) course. RecaLL is a team project, a local-first desktop study app. Version 1 is complete and compiles to about 182 pages.

The current job is to **fill in the missing team data and polish the report. It is not a rewrite.**

## Read these first

1. `CHANGES.md` lists every placeholder still to fill, the known limits, and the facts verified against the code. Treat its "Things the team should know" section as the authoritative facts.
2. `tools/BRIEF.md` is the facts sheet used to write version 1. Some of it was **corrected later**: where it disagrees with `CHANGES.md`, `CHANGES.md` wins. In particular:
   - embeddings are real when a server key is set, and placeholders otherwise;
   - Socratic grading works;
   - there are 158 routes (87 under `/api/v1`, 71 legacy);
   - AES-GCM protects only the v1 BYOK vault.
3. `../REPORT_PLAN.md` maps each template section to its source in the project.
4. References:
   - `../CUET_SWE_Final_Report_LaTeX_Template_B22/` is the teacher's template; its `README.md` has the submission checklist.
   - `../Porikroma_Final_Report (4).pdf` is another group's finished report. It shows the expected depth.

## Where things are

- `main.tex` sets the chapter order. Do not reorder.
- `config.tex` holds the cover and team data: course code, date, supervisors, and the members' phone, credits and CGPA (shown as `\tbd`).
- `chapters/ch01…ch09*.tex` and `appendices/appendixA…F*.tex` hold the content.
- `frontmatter/` holds the cover, team table, executive summary and acknowledgement.
- `images/diagrams/*.pdf` are the diagrams; their SVG sources are in `tools/svg_src/`. `images/screenshots/` holds UI screenshots, and `images/photos/<studentID>.jpg` holds member photos (not added yet).
- `references.bib` uses the IEEE numeric style. Cite with `\cite{key}`.
- Tools:
  - `tools/check_tex.py`: static checks. It falsely reports "undefined label" for labels set inside `\figplaceholder` and `\widefig`; the LaTeX log is the real check.
  - `tools/loginfo.py`: summarises overfull boxes from the log.
  - `tools/gen_appendixB.py`: rebuilds Appendix B from pytest JUnit XML.
  - `tools/svg2pdf.py`: SVG to PDF with headless Edge on Windows. Pass an absolute `--out` path.
  - `tools/test_results/`: the JUnit files behind Chapter 7 and Appendix B.

The project source code is the RecaLL git repository: https://github.com/Saimun-jd/RecallAI. The report was checked against commit `60d40f9`. Paths such as `app/services/rag.py` in the report are relative to the repository root. To verify facts, the repository must be on this machine. Ideally put this folder at `<repo>/Report_Templates/Final_report/RecaLL_Final_Report_v1/`.

## Rules

1. **Never invent data.**
   - Fill a `\todo{...}` or `\tbd` only with information the human gives you, or that you verify in the code or git history.
   - If something is still unknown, leave the marker in place.
   - Never make up test results, user-test numbers, survey scores, meeting dates or budget figures.
2. **Keep the template structure.** Keep every chapter, section and subsection heading in order. Section 9.4 (Ethics) and the DFD subsection in 4.2 are intentional additions.
3. **Black and white only:** diagrams, tables, charts and code listings. Colour screenshots are fine.
4. **Figures:**
   - Use `\figplaceholder[width]{file}{caption}{label}` for normal figures; it prints a red box if the file is missing.
   - Use `\widefig{file}{caption}{label}` for very wide diagrams; it creates a rotated float page.
   - Every figure and table needs a caption, a label and a `\Cref{}` in the text.
5. **pdfLaTeX-safe text:**
   - No Unicode symbols such as →, ≥ or smart quotes. Use `$\rightarrow$`, `$\geq$` and `` ` ``/`'`.
   - Escape `_ % & # $` in normal text.
   - Code listings must be ASCII.
6. **Be honest.** The report openly states that CI is failing and lists the security gaps (Section 7.6, Table "Security findings"). Do not delete these. If the team fixes something in the code, update the text to match **and** cite the new commit.
7. **Testing rule from the project (`AGENTS.md` at the repo root):** never test the app with synthetic documents. Use only documents the user has already uploaded.
8. **If you re-run the backend tests**, blank the AI keys first. Otherwise the tests read the real keys in `.env` and make paid API calls. In bash, from the repo root:

   ```
   TESTING=true ENVIRONMENT=development OPENAI_API_KEY= GEMINI_API_KEY= GROQ_API_KEY= \
   python -m pytest app/tests --junitxml=junit_app.xml
   ```

   Then regenerate Appendix B:

   ```
   python tools/gen_appendixB.py junit_app.xml junit_tests.xml
   ```

   Also update the numbers in Chapter 7 and the executive summary.
9. **Commit nothing and push nothing** unless the human asks.

## Typical task: filling the placeholders

1. Ask the human for the data in the `CHANGES.md` list, roughly in this order:
   - course code, submission date and supervisors
   - team details and photos
   - who did what (the Chapter 2 contribution table and the GitHub-identity mapping)
   - user-testing (UAT) results for Chapter 7.5
   - meeting minutes for Appendix D
   - budget for Chapter 2.7
   - any measured performance numbers
2. Edit the matching `.tex` files and remove each `\todo`/`\tbd` you fill.
3. Update the executive summary last, using the final numbers.
4. Compile and check.

## Compiling and checking

- **Overleaf (the team's main route):** upload a zip of this folder with `main.tex` at the zip root. Set the compiler to pdfLaTeX and the main document to `main.tex`.
- **Locally:** run `latexmk -pdf main.tex` with TeX Live, MiKTeX or TinyTeX. The packages needed are listed in `preamble.tex`.
- **Before handing back:**
  - there are no LaTeX errors;
  - the log has no "undefined reference" or "undefined citation" warnings;
  - search the PDF for `TODO` and `TBD`, and either fill each one or list it for the human;
  - spot-check the pages you changed as images: nothing runs past the margins, and there are no near-empty pages.
