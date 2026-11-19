"""Measure RecaLL performance and AI behaviour on a COPY of the user's data.
All app data paths are forced to MDATA before the app is imported.
Run from the repo root with the project venv: python measure.py
"""
import os, sys, json, time, threading, sqlite3, statistics, glob, pathlib

SCR = pathlib.Path(r"D:/Temp/claude/0629ec564fb72c40/1421a69e-721c-4939-879a-0f8930a6497a/scratchpad")
MDATA = str(SCR / "mdata")
REAL = r"C:/Users/Asus/AppData/Local/Recall/Recall"
OUT = SCR / ("measure_kh.json" if os.environ.get("ONLY_KH") else "measure_results.json")
USER_ID = "b3f01f61-f242-46a3-8e5d-09ce541c25e2"
USER_DB = os.path.join(MDATA, f"user_{USER_ID}_recall.db")

def snapshot(d):
    return {p: os.path.getmtime(p) for p in glob.glob(d + "/**/*", recursive=True)}
real_before = snapshot(REAL)

# 1. redirect every data path to the copy
import platformdirs
platformdirs.user_data_dir = lambda *a, **k: MDATA
os.environ["DATA_DIR"] = MDATA
os.environ["UPLOAD_DIR"] = os.path.join(MDATA, "storage")
os.environ["ENVIRONMENT"] = "development"
os.environ["OLLAMA_HOST"] = "http://127.0.0.1:11434"

# point book files at the copy
c = sqlite3.connect(USER_DB)
for bid, fp in c.execute("select id, file_path from books").fetchall():
    if fp and "Recall\\Recall" in fp:
        c.execute("update books set file_path=? where id=?", (os.path.join(MDATA, "parsed_docs", os.path.basename(fp)), bid))
c.commit(); c.close()
json.dump({"path": USER_DB}, open(os.path.join(MDATA, "active_db.json"), "w"))

import psutil
proc = psutil.Process()
peak = {"rss": 0}
stop = False
def sampler():
    while not stop:
        peak["rss"] = max(peak["rss"], proc.memory_info().rss); time.sleep(0.2)

R = {"notes": [], "env": {"python": sys.version.split()[0]}}
t0 = time.perf_counter()
from fastapi.testclient import TestClient
import app.database as legacy_db
legacy_db.set_active_db_path(USER_DB)
from app.main import app
R["import_seconds"] = round(time.perf_counter() - t0, 2)
threading.Thread(target=sampler, daemon=True).start()

def sse_timed(client, url, body, headers=None):
    start = time.perf_counter(); first = None; events = []; err = None
    with client.stream("POST", url, json=body, headers=headers or {}) as r:
        status = r.status_code
        for line in r.iter_lines():
            if not line: continue
            if first is None: first = time.perf_counter() - start
            if line.startswith("data:"):
                events.append(line[5:].strip()[:300])
    return {"status": status, "first_event_s": round(first, 2) if first else None,
            "total_s": round(time.perf_counter() - start, 2), "events": len(events), "last": events[-1] if events else None}

with TestClient(app) as client:
    R["rss_idle_mb"] = round(proc.memory_info().rss / 2**20, 1)

    # topics of the CUET AI lecture (book 2), level-2 topics with content pages
    c = sqlite3.connect(USER_DB)
    topics = c.execute("select id, title, start_page from topics where book_id=2 and level=2 and start_page in (5,11,19,25,37) group by start_page order by start_page").fetchall()
    c.close()
    R["topics_used"] = topics

    if os.environ.get("ONLY_KH"): topics = []
    # A. topic processing (extract text + AI concept extraction)
    R["process"] = []
    for tid, title, pg in topics:
        r = sse_timed(client, f"/topics/{tid}/process-stream", {"provider_override": "gemini", "force_reprocess": True})
        r.update(topic=title); R["process"].append(r); print("process", title, r["total_s"], r["status"], flush=True)

    # B. Cornell notes on 3 topics
    R["cornell"] = []
    for tid, title, pg in topics[:3]:
        r = sse_timed(client, f"/topics/{tid}/notes/scaffold-stream", {"provider_override": "gemini"})
        r.update(topic=title); R["cornell"].append(r); print("cornell", title, r["total_s"], flush=True)

    # C. Socratic drill generate on 5 topics, evaluate 2 answers on 2 of them
    R["drill_generate"] = []; R["drill_evaluate"] = []
    for i, (tid, title, pg) in enumerate(topics):
        s = time.perf_counter(); resp = client.post(f"/topics/{tid}/drill/generate", json={"provider_override": "gemini"})
        el = round(time.perf_counter() - s, 2); body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
        qs = body.get("questions") or []
        R["drill_generate"].append({"topic": title, "status": resp.status_code, "seconds": el, "n_questions": len(qs),
                                    "tiers": [q.get("tier") for q in qs]})
        print("drill gen", title, resp.status_code, el, len(qs), flush=True)
        if i < 2 and qs:
            q = qs[0]
            inv = q.get("key_invariants") or []
            answers = {"strong": "; ".join(inv) if inv else "",
                       "weak": "I am not sure. It just works that way."}
            for kind, ans in answers.items():
                if not ans: continue
                s = time.perf_counter()
                ev = client.post(f"/topics/{tid}/drill/evaluate", json={
                    "question_id": q.get("id", "q1"), "question_text": q.get("question", q.get("question_text", "")),
                    "key_invariants": inv, "student_answer": ans, "tier": q.get("tier", "causal_mechanism"),
                    "socratic_hint": q.get("socratic_hint"), "provider_override": "gemini"})
                e = ev.json() if ev.status_code == 200 else {}
                R["drill_evaluate"].append({"topic": title, "answer": kind, "status": ev.status_code,
                    "seconds": round(time.perf_counter() - s, 2), "score": e.get("mastery_score", e.get("score")),
                    "band": e.get("status", e.get("mastery_status")),
                    "n_cards": len(e.get("suggested_flashcards") or e.get("flashcards") or [])})
                print("drill eval", kind, ev.status_code, R["drill_evaluate"][-1]["score"], flush=True)

    # D. Knowledge Hub (v1 RAG) with a locally minted token for the copy's user
    from app.core.security import create_access_token
    ws = sqlite3.connect(os.path.join(MDATA, "recall_saas.db")).execute(
        "select id from workspaces where owner_id=?", (USER_ID,)).fetchone()[0]
    H = {"Authorization": "Bearer " + create_access_token(USER_ID, workspace_id=ws)}
    conv = client.post("/api/v1/conversations", json={"title": "measurement"}, headers=H)
    R["kh_conv_status"] = conv.status_code
    cid = (conv.json().get("data") or conv.json()).get("id") if conv.status_code in (200, 201) else None
    Q = [("7", "What does alpha-beta pruning do, and does it change the result of minimax?"),
         ("7", "In a two-player game tree, what do Max and Min represent?"),
         ("2", "What is the Turing Test and who proposed it?"),
         ("6", "What is user experience design?"),
         ("2", "Who was Claude Shannon according to the lecture?"),
         ("6", "What does the document say about quantum error correction?")]
    R["kh"] = []
    if cid:
        for doc, q in Q:
            r = sse_timed(client, f"/api/v1/conversations/{cid}/messages",
                          {"content": q, "document_id": doc, "provider": "gemini", "stream": True}, H)
            r.update(question=q, document_id=doc); R["kh"].append(r); print("kh", r["first_event_s"], r["total_s"], flush=True)
        full = client.get(f"/api/v1/conversations/{cid}", headers=H).json(); full = full.get("data") or full
        msgs = [m for m in full.get("messages", []) if m.get("role") == "assistant"]
        R["kh_answers"] = [{"answer": (m.get("content") or "")[:600], "citations": m.get("citations") or m.get("sources")} for m in msgs]

    # E. volume: largest uploaded PDF, full text extraction with PyMuPDF
    import fitz
    pdfs = sorted(glob.glob(os.path.join(MDATA, "parsed_docs", "*.pdf")), key=os.path.getsize)
    big = os.path.join(MDATA, "parsed_docs", "58e50547d0070be436b4fd57a8c3831c9764d775bdb594056ef483b80f0771d5.pdf"); s = time.perf_counter(); d = fitz.open(big); chars = sum(len(p.get_text()) for p in d)
    R["volume"] = {"file_mb": round(os.path.getsize(big) / 2**20, 1), "pages": d.page_count, "chars": chars,
                   "extract_seconds": round(time.perf_counter() - s, 2)}
    sc = sqlite3.connect(os.path.join(MDATA, "recall_saas.db"))
    R["volume"]["saas_db_mb"] = round(os.path.getsize(os.path.join(MDATA, "recall_saas.db")) / 2**20, 1)
    R["volume"]["chunks_total"] = sc.execute("select count(*) from document_chunks").fetchone()[0]
    R["volume"]["largest_doc_chunks"] = sc.execute("select max(n) from (select count(*) n from document_chunks group by document_id)").fetchone()[0]
    lc = sqlite3.connect(USER_DB)
    R["volume"]["topics_total"] = lc.execute("select count(*) from topics").fetchone()[0]
    s = time.perf_counter(); qr = client.get("/api/v1/search", params={"query": "requirements engineering", "document_id": "4"}, headers=H)
    R["volume"]["search_seconds_largest_doc"] = round(time.perf_counter() - s, 2); R["volume"]["search_status"] = qr.status_code

stop = True
R["rss_peak_mb"] = round(peak["rss"] / 2**20, 1)
real_after = snapshot(REAL)
R["real_folder_changed"] = [p for p in set(real_before) | set(real_after) if real_before.get(p) != real_after.get(p)]
json.dump(R, open(OUT, "w"), indent=1, default=str)
print("DONE; real folder changed:", R["real_folder_changed"])
