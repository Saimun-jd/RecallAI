# Rebuilding the RecaLL final report

**Status (18 Nov 2026):** the report is complete. It is 159 pages, with no placeholders, no LaTeX errors and no undefined references. The compiled copy is `../RecaLL_Final_Report.pdf`.

## Rebuild after changing a photo or the text

- **Photos.** Replace a photo by keeping the same file name in `images/photos/`:
  - `2204002.jpeg`
  - `2204005.jpg`
  - `2204015.jpeg`
  - `2204028.png`

  To use a different file name or extension, change the last argument of that member's `\member{...}` line in `config.tex`.
- **Overleaf.** Upload the zip `../RecaLL_Final_Report_v1.zip`. Set the compiler to pdfLaTeX and the main document to `main.tex`, then click Recompile.
- **On this PC (TinyTeX).** Run this in PowerShell from this folder:

  ```
  & "D:\Temp\claude\0629ec564fb72c40\1421a69e-721c-4939-879a-0f8930a6497a\scratchpad\tex\TinyTeX\bin\windows\latexmk.exe" -pdf main.tex
  ```

  This creates `main.pdf` here. With any other TeX installation, `latexmk -pdf main.tex` works the same way.

## Where the numbers come from

- Test results: `tools/test_results/junit_app_tests.xml` (run of 16 Nov 2026).
- Measurements: `tools/measurements.md`, plus `tools/test_results/measure_*.json` (run of 18 Nov 2026).
- Team data: `tools/ANSWERS.md`.

`CHANGES.md` describes version 1. Its list of placeholders is now resolved.

## Diagram book

`diagrams.tex` builds a separate PDF with every diagram of the report, one per page, using the same figure numbers and captions. It also includes the two full database schemas (`er_saas.pdf`, `er_legacy.pdf`). The compiled copy is `../RecaLL_Diagrams.pdf` (42 pages).

- On Overleaf, set the main document to `diagrams.tex` and recompile.
- On this PC, run `latexmk -pdf diagrams.tex` (with the TinyTeX path above).

It reads the diagrams from `images/diagrams/`, so a diagram that changes there changes in both PDFs. The Gantt chart and the test chart are copied from chapters 2 and 7 into `diagram_book/`. If you change them in a chapter, change them there too.
