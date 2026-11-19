# CSE-434 Software Engineering (Sessional) – Final Report LaTeX Template
Department of CSE, CUET  ·  Follows *S/W Engineering Final Lab Report Guidelines v1.0*

The cover page, team-member page, colours and table styles follow the CUET sample report
(`Final_Report.pdf`); the chapter structure follows the new guideline (9 chapters, AI-integration
sections, CI/CD, Git, VAPT, Appendices A–F).  `sample_output_preview.pdf` shows the compiled template.

---------------------------------------------------------------------
## 1. Quick start on Overleaf (recommended)
1. Go to <https://www.overleaf.com> → **New Project → Upload Project** → choose this ZIP.
2. Menu (top-left) → **Main document = `main.tex`**, **Compiler = pdfLaTeX**, TeX Live = latest.
3. Click **Recompile**. You should see a cover page, team page, contents and all chapters.
4. Share the project with your teammates (**Share → Add collaborator**) and edit together.
   Optional: *Menu → GitHub sync* to keep the report next to your source code.

## 2. Compile locally
Install TeX Live / MiKTeX (full), then in this folder:

    latexmk -pdf main.tex        # builds main.pdf (runs BibTeX automatically)
    latexmk -c                   # clean temporary files

## 3. What to edit (in this order)
| Step | File | What to do |
|------|------|-----------|
| 1 | `config.tex` | Project title, supervisors, team members (`\member{...}`), guide boxes on/off |
| 2 | `images/cuet_logo.png` | **Replace the placeholder with the official CUET logo** (same file name) |
| 3 | `images/photos/<ID>.jpg` | Member photos (shown on team page) |
| 4 | `chapters/ch01…ch09*.tex` | Write each chapter; follow the blue **GUIDE** box in each section |
| 5 | `references.bib` | Add references; cite with `\cite{key}` |
| 6 | `appendices/*.tex` | Appendices A–F |
| 7 | `frontmatter/executive_summary.tex`, `acknowledgement.tex` | Write last |
| 8 | `config.tex` | Set `\guidesfalse` to remove all GUIDE boxes; search the PDF for red **[TODO …]** |

## 4. File structure
    main.tex                 master file (order of chapters)
    preamble.tex             packages, colours, helper macros (normally do not edit)
    config.tex               ONLY file needed for cover/team info
    frontmatter/             cover, team table, executive summary, acknowledgement
    chapters/                ch01_introduction … ch09_sustainability
    appendices/              appendixA … appendixF
    images/diagrams/         your UML/ER/architecture figures (see README.txt there)
    images/photos/           team photos
    references.bib           bibliography (IEEE numeric style)

Chapter ↔ guideline mapping: Ch1 Introduction · Ch2 Project Management · Ch3 Requirements ·
Ch4 Architecture · Ch5 Design (incl. API, AI model, Test Plan) · Ch6 Implementation ·
Ch7 Testing & QA · Ch8 Deployment · Ch9 Sustainability.
*Note:* the guideline lists section "4.4" twice and mixes the order of some items; the template
numbers them consistently: 4.4 AI-integration Architecture, 4.5 CI/CD, 4.6 Git.

## 5. Useful commands (all examples are already inside the chapter files)
* **Figure** (shows a red placeholder until the file exists):
  `\figplaceholder{usecase_diagram.png}{Use case diagram}{fig:usecase}` → refer with `\Cref{fig:usecase}`
  For your own width/options: `\includegraphics[width=\textwidth]{...}` inside a `figure` environment.
* **Table**: copy any `table` + `tabularx` block (uses `booktabs`: `\toprule \midrule \bottomrule`).
* **Code**: `\begin{lstlisting}[language=Python,caption={...},label={lst:x}] … \end{lstlisting}`
  or `\lstinputlisting[language=Python]{code/file.py}`.
* **Pseudocode**: `algorithm` + `algpseudocode` (see Section 5.2).
* **Gantt chart**: `pgfgantt` example in Section 2.6.
* **Tick mark**: `\cmark` (contribution / traceability tables).
* **Citation**: `\cite{pressman2019}`; **cross-ref**: `\Cref{tab:risk}`, `\Cref{fig:arch}`.
* **Reminder**: `\todo{text}` prints a red TODO (search for them before submitting).
* **Wide table/diagram**: wrap in `\begin{landscape} … \end{landscape}`.

## 6. Drawing the diagrams (export as PNG or PDF, ≥ 300 dpi)
| Diagram | Free tools |
|---------|-----------|
| Use case, activity, class, sequence, component, deployment | draw.io (diagrams.net), StarUML, PlantUML (<https://plantuml.com>), Mermaid |
| ER diagram | draw.io, dbdiagram.io, MySQL Workbench, pgModeler |
| Gantt | already in LaTeX (`pgfgantt`) or Excel/Notion screenshot |
| Wireframes / GUI | Figma, Balsamiq, draw.io |
| API docs | Swagger/OpenAPI, Postman (export tables/screenshots) |
Keep text in diagrams readable when the figure is 15 cm wide.

## 7. Using IEEE / ACL style instead
The report is a *long project report*, so it uses the `report` class. References are IEEE-numeric
(`\bibliographystyle{ieeetr}`); on Overleaf you can switch to the exact IEEE style by replacing it
with `\bibliographystyle{IEEEtran}` in `main.tex` (line is already there, commented).
If your teacher asks for a **short paper** version (e.g. a conference-style summary of the project),
use an official template and copy your Abstract/Introduction/Results into it:
* IEEE conference: Overleaf → *Templates* → search "IEEE Conference Template" (`IEEEtran`)
* ACL: <https://github.com/acl-org/acl-style-files> (also in Overleaf's template gallery)
Do **not** change the main report's layout unless instructed.

## 8. Formatting rules / checklist before submission
- [ ] `config.tex`: correct title, names, IDs, e-mails, CGPA, supervisor, date
- [ ] Official CUET logo and member photos added
- [ ] `\guidesfalse` set; no red **[TODO]** left in the PDF
- [ ] Every figure/table has a caption **and** is referenced in the text
- [ ] Every requirement is covered in the traceability matrix (Section 7.2)
- [ ] All AI sections completed (3.7, 4.4, 5.6, 6.3, 7.7, App. F) – or explicitly justified as N/A
- [ ] All references cited; no plagiarism – paraphrase and cite AI-generated/assisted text where required
- [ ] Executive summary ≤ 1 page, written last
- [ ] Repository link + final commit hash in Appendix A
- [ ] Final PDF checked page-by-page (no overfull tables, no blank pages)

## 9. Troubleshooting
| Problem | Fix |
|---------|-----|
| Bibliography empty / `?` citations | Recompile 2–3 times (Overleaf does this automatically), check `references.bib` keys |
| `File … not found` for an image | Check spelling & case of file name (Linux is case-sensitive) |
| `Missing $ inserted` | An underscore `_` or `%`, `&`, `#` in normal text: write `\_`, `\%`, `\&`, `\#` |
| Table sticks out of the page | Use `tabularx` with `X` columns, `\small`, or `landscape` |
| Gantt too wide | Change `x unit` or number of weeks in Section 2.6 |
| Compile stops with an error | Overleaf → *Logs and output files* → fix the first red error |
