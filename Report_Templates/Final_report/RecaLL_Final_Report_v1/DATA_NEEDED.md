# Data needed to finish the RecaLL report

Write your answers after each `→`. If you don't know something, write **"don't know"**. I will then rewrite that part so it is true without the number. I won't guess, and I won't leave a placeholder.

---

## A. Cover and team page (required)

1. **Course code.** The template says CSE-356, its README says CSE-434, and our old report used CSE-300.
   → 
2. **Submission date** (as printed on the cover).
   → 
3. **Course teacher(s), with designations.** The report currently says "Sharmistha Chanda Tista, Assistant Professor, Dept. of CSE, CUET". Is that correct? Is there a second teacher?
   → 
4. **Team members.** For each member, give: student ID (please confirm), CUET e-mail, phone, total credits passed, and CGPA.

   | Member | ID | E-mail | Phone | Credits passed | CGPA |
   |---|---|---|---|---|---|
   | Al Rubayet | 2204002? | | | | |
   | Md. Rony Hossain | 2204005 | | | | |
   | Imteajul Islam | 2204015? | | | | |
   | Tahsin Ahmed Chowdhury | 2204028? | | | | |

5. **Photos.** Put one passport-style photo per member in `images/photos/`, named by ID: `2204002.jpg`, `2204005.jpg`, `2204015.jpg` and `2204028.jpg`.

## B. Who did what (Chapter 2.1)

6. **Nicknames.** Who is "Turjo", and who is "Saimun"? Who owns the GitHub account `Saimun-jd`? (The `rubayet2027` account is Al Rubayet.)
   → 
7. **Roles.** For each member, tick what they did:

   | Member | Req. spec | Planning | Design | AI integration | UI | Testing | Deployment | Docs |
   |---|---|---|---|---|---|---|---|---|
   | Al Rubayet | | | | | | | | |
   | Md. Rony Hossain | | | | | | | | |
   | Imteajul Islam | | | | | | | | |
   | Tahsin Ahmed Chowdhury | | | | | | | | |

8. **Descriptions.** Give 2–3 sentences per member on their actual work, especially Tahsin and Rony, who have no commits.
   → 
9. **October.** There are no commits in October 2026. What did the team do that month (for example exams, design work or testing)?
   → 

## C. Team organisation and meetings (Chapter 2.1 and Appendix D)

10. **Meetings.** How often did the team meet, and where (in person, Messenger, Discord, Google Meet)? Who was the team lead?
    → 
11. **Meeting log.** The template expects about one entry per week. For each meeting, give: date, who attended, what was decided, and the action items. Rough notes are fine; I'll format them. If you have no records, tell me, and I'll replace the table with a progress log built only from the git history and say so in the text.
    → 
12. **Term dates.** When did the semester start, and when is the final submission deadline?
    → 

## D. Machines and tools (Chapters 2.5, 4.3 and 6.1)

13. **Laptops.** Each member's laptop: CPU, RAM, OS. (I can read mine; are you Rony on this PC?)
    → 
14. **Editors.** Which editors or IDEs did each member use (VS Code, Cursor, PyCharm and so on)?
    → 
15. **AI providers.** Which AI providers and models did each member use while testing RecaLL (for example Gemini 2.5 Flash, Ollama gemma3)?
    → 
16. **SQLite tool.** Did anyone use a tool to inspect the SQLite databases (for example DB Browser for SQLite)? If not, write "none".
    → 
17. **AI coding assistants.** Which ones did the team use (Copilot, Claude, ChatGPT and so on), and for what (code, tests, docs)? This goes into Chapter 9.4 and Appendix F.
    → 

## E. Budget (Chapter 2.7)

18. **Money spent.** Was any real money spent (API credits, a domain, hosting, internet packs)? If everything was free, write "all free".
    → 
19. **Effort row.** Should the budget show a notional cost of human effort? If yes, give the average hours per week per member. If no, I'll remove that row.
    → 

## F. Your user testing (Chapter 7.5, 8.3 and 9.4). Most important.

20. **Participants.** How many students took part? Which department and level were they? When were the sessions?
    → 
21. **Consent.** How did you get their consent (verbal, a form)?
    → 
22. **Tasks.** What tasks did you give them (for example import a PDF, make a Cornell note, take a drill, review cards, ask the Knowledge Hub)?
    → 
23. **Results per task.** For each task: did they succeed, roughly how long did it take, and what problems did they hit?
    → 
24. **Ratings and feedback.** Any rating or score (for example "4/5", or a SUS questionnaire), plus 3–5 short pieces of feedback in their own words.
    → 
25. **Changes made.** Did the team change anything because of the feedback?
    → 
26. **Support channel.** How did users report problems to you (Messenger group, GitHub issues, in person)?
    → 

## G. Things you just need to answer yes or no

27. **Leaked API keys.** Commit `9fd02fc` removed hard-coded API keys from the code. Were those keys revoked or deleted in the provider console afterwards?
    → 
28. **Bug count.** Do you know roughly how many bugs were found and fixed during the project? If not tracked, write "not tracked" and I'll leave the number out.
    → 
29. **Acknowledgement.** Anyone else to thank (a lab, seniors, friends who tested)?
    → 

## H. Measurements: choose one option

The report currently has empty slots for: PDF import time, time to first chat token, Cornell-note generation time, RAM use, a large-PDF (volume) test, and AI quality (share of valid JSON replies, citation accuracy, and drill grading agreement with a human).

- **Option 1:** I measure them on this PC by running RecaLL with documents you have already uploaded and your own AI key. This uses some of your API quota, roughly 20–40 AI requests. Tell me which provider and model to use.
- **Option 2:** I don't measure. The requirements tables keep the targets but say "not measured in this version", stated plainly.

→ Option 1 or Option 2? If Option 1: which provider and model?

The same choice applies to the three unrun manual tests, TC-MAN-04, 06 and 07 (drill grading, prompt edit and reset, explain a selection). With Option 1, I run them in the app.

## I. Page count (target 150–160; it is 182 now). Approve the cuts.

| # | Cut | Saves |
|---|---|---|
| 1 | Appendix A: keep the repository table and 2 short listings. Chapter 6 already shows the key code. | ~5 pages |
| 2 | Appendix B: replace the 328-row test list with a per-file results table plus the failures. The full list stays in the repository as XML. | ~5 pages |
| 3 | Appendix E: drop the two full ER diagrams, which are unreadable in print. The core ER diagram stays in Chapter 5. | ~2 pages |
| 4 | Chapter 5.5: list all 87 `/api/v1` endpoints, but shorten the 48 legacy routes to one summary table by group. | ~3 pages |
| 5 | Tighten floats and spacing (fewer half-empty pages). | ~4–6 pages |

→ Approve all? Or name the cuts you don't want.

---

### Things I will do myself (no input needed)

- **Release workflow.** It builds the installer but doesn't publish it (`release.yml` has no `tagName`). The v0.1.5 release and its `Recall_0.1.5_x64-setup.exe` were published by `Saimun-jd`.
- **PR #2 and branch protection.** PR #2 is still open, and `main` has no branch protection.
- **Final figures.** The final commit hash, test pass counts and coverage in Chapter 1 and the executive summary.
- **References.** The Bangladeshi data-protection law citation, and a re-check of the competitor product pages.
- **Colour contrast.** Measured from the app's colour tokens.
- **Migration downgrade safety.** Checked in the code.
- **Removed items.** The "contributors graph screenshot" and "CI screenshot" requests. The tables already give that information.
