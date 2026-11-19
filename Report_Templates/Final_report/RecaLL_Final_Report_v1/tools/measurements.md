# Measured results (approved by the team on 18 Nov 2026)

## Method

- **Where and when:** measured on 18 Nov 2026 on Md. Rony Hossain's laptop (AMD Ryzen 7, 16 GB RAM, Windows 11).
- **Code and runtime:** commit `60d40f9`, Python 3.13.
- **Data:** a copy of the team's own RecaLL data, using documents already uploaded by the team, with no synthetic documents. The original data folder was verified unchanged afterwards.
- **AI model:** Gemini `gemini-3.6-flash`. The app limits Gemini to 5 requests per minute, so AI timings include queueing at that limit.
- **How it ran:** the backend ran in-process through FastAPI's test client, so no network hop to localhost is included.
- **Raw data:** `measure_results.json` and `measure_kh.json`. The harness is `tools/measure.py`.

## Results

| Measurement | Value |
|---|---|
| Backend memory (RSS) | 119 MB idle after start-up; 381 MB peak during AI processing |
| Backend start-up (import) | 2.5 s |
| Topic processing (text extraction + AI concepts), 3 topics of the CUET AI lecture | 7.3 s, 18.4 s, 50.5 s (median 18.4 s); 3 of 3 completed |
| Cornell note generation, same 3 topics | 26.2 s, 27.9 s, 47.9 s (median 27.9 s); 3 of 3 completed |
| Socratic drill generation, same 3 topics | 42.7 s, 52.9 s, 66.0 s (median 52.9 s); 3 of 3 returned valid output with exactly 2 questions; tiers were causal mechanism plus counterfactual (2) and causal mechanism plus applied scenario (1) |
| Drill grading, strong answers (built from the question's key invariants), 2 answers | Scores 95 and 100, band "mastered", 0 suggested cards; 3.3 s and 35.2 s |
| Drill grading, weak answer "I am not sure. It just works that way.", 2 answers | Scores 0 and 0, band "misconception", 2 suggested flashcards each; 35.8 s and 11.1 s |
| Knowledge Hub (`/api/v1` RAG, streaming), 6 questions on 3 documents | Complete answer in 4.9, 6.2, 6.4, 25.5, 26.6 and 44.8 s (median 15.9 s). The stream delivers the answer at the end, so time to first event is close to the total. |
| Knowledge Hub citations | 5 of 5 answerable questions cited the relevant pages: alpha-beta pruning p. 17/50 of "8.Game Playing"; Max/Min p. 7/12/49; Turing Test p. 25 of the AI lecture; Claude Shannon p. 43; UX design p. 1 of "Ch 12 User Experience Design" |
| Knowledge Hub, out-of-scope question ("quantum error correction" on the UX document) | Correctly stated that the materials do not contain the information; no citation given |
| Volume: largest document (Pressman, *Software Engineering*, 7th ed.) | 930 pages, 20 MB; full text extraction with PyMuPDF in 3.1 s (2.5 million characters); 933 chunks stored; hybrid search scoped to it in 0.72 s |
| Library size | 11 documents, 1,070 chunks; 1,326 topics in the study database; application database 20.8 MB |

## Not measured

Anything not listed above was not measured: concurrent users, time to first token and human-grader agreement. Do not claim these.
