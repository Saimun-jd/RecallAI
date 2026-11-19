"""Static checks for the report (no LaTeX needed). Run from the report root:
    python tools/check_tex.py
"""
import re, sys, pathlib, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
problems, warns = [], []

def read(p):
    return (ROOT / p).read_text(encoding="utf8")

def strip_comments(s):
    return re.sub(r"(?<!\\)%.*", "", s)

# 1. collect files via \input
order, seen = [], set()
def walk(rel):
    rel = rel if rel.endswith(".tex") else rel + ".tex"
    if rel in seen: return
    seen.add(rel)
    if not (ROOT / rel).exists():
        problems.append(f"missing \\input file {rel}"); return
    order.append(rel)
    for m in re.finditer(r"\\input\{([^}]+)\}", strip_comments(read(rel))):
        walk(m.group(1))
walk("main.tex")

labels, refs, cites, todos = collections.Counter(), [], [], 0
VERB_ENVS = ("lstlisting", "verbatim")
for rel in order:
    raw = read(rel); s = strip_comments(raw)
    # remove verbatim-like environments for text checks
    body = re.sub(r"\\begin\{(lstlisting|verbatim)\}.*?\\end\{\1\}", "", s, flags=re.S)
    # braces
    b = re.sub(r"\\[{}]", "", body)
    if b.count("{") != b.count("}"):
        problems.append(f"{rel}: unbalanced braces ({b.count('{')} vs {b.count('}')})")
    # environments
    stack = []
    for m in re.finditer(r"\\(begin|end)\{([^}]+)\}", s):
        kind, env = m.groups()
        if kind == "begin": stack.append(env)
        else:
            if not stack or stack[-1] != env:
                problems.append(f"{rel}: \\end{{{env}}} does not match {stack[-1] if stack else 'nothing'} (line {s[:m.start()].count(chr(10))+1})")
                if env in stack: stack.remove(env)
            else: stack.pop()
    if stack: problems.append(f"{rel}: unclosed environments {stack}")
    # files
    for m in re.finditer(r"\\figplaceholder(?:\[[^\]]*\])?\{([^}]+)\}", body):
        f = m.group(1)
        if not ((ROOT/"images/diagrams"/f).exists() or (ROOT/"images"/f).exists()):
            problems.append(f"{rel}: figure file not found: {f}")
    for m in re.finditer(r"\\includegraphics(?:\[[^\]]*\])?\{([^}#]+)\}", body):
        f = m.group(1)
        cands = [ROOT/f] + [ROOT/d/f for d in ("images", "images/diagrams", "images/photos")]
        if not any(c.exists() or c.with_suffix(".png").exists() or c.with_suffix(".pdf").exists() for c in cands):
            problems.append(f"{rel}: image not found: {f}")
    for m in re.finditer(r"\\lstinputlisting(?:\[[^\]]*\])?\{([^}]+)\}", s):
        if not (ROOT / m.group(1)).exists(): problems.append(f"{rel}: listing file not found {m.group(1)}")
    # labels / refs / cites
    for m in re.finditer(r"\\label\{([^}]+)\}", s): labels[m.group(1)] += 1
    for m in re.finditer(r"\\(?:[cC]ref|ref|autoref|pageref)\{([^}]+)\}", s):
        refs += [(rel, r.strip()) for r in m.group(1).split(",")]
    for m in re.finditer(r"\\cite\{([^}]+)\}", s):
        cites += [(rel, c.strip()) for c in m.group(1).split(",")]
    todos += len(re.findall(r"\\todo\{", s))
    # unescaped specials in text (rough): _ outside math, texttt, url, label, ref, input, includegraphics
    t = re.sub(r"\$[^$]*\$", "", body)
    t = re.sub(r"\\(texttt|url|label|[cC]ref|ref|input|includegraphics|lstinputlisting|figplaceholder|cite|href|detokenize|screen|path)(\[[^\]]*\])?\{[^{}]*\}", "", t)
    t = re.sub(r"\\begin\{(longtable|tabularx|tabular)\}\{[^\n]*", "", t)
    for i, line in enumerate(t.split("\n"), 1):
        if re.search(r"(?<!\\)_", line): warns.append(f"{rel}: possible unescaped _ : {line.strip()[:90]}")
        if re.search(r"(?<!\\)#(?!\d)", line) and "\\newcommand" not in line and "\\def" not in line: warns.append(f"{rel}: possible unescaped # : {line.strip()[:90]}")
    for i, line in enumerate(raw.split("\n"), 1):
        bad = [c for c in line if ord(c) > 127]
        if bad: problems.append(f"{rel}:{i}: non-ASCII {''.join(sorted(set(bad)))!r}: {line.strip()[:70]}")

bib = read("references.bib")
keys = set(re.findall(r"@\w+\{([^,]+),", bib))
for rel, c in cites:
    if c not in keys: problems.append(f"{rel}: \\cite key not in references.bib: {c}")
for l, n in labels.items():
    if n > 1: problems.append(f"duplicate label {l} ({n}x)")
for rel, r in refs:
    if r not in labels: problems.append(f"{rel}: reference to undefined label {r}")
# float environments without caption/label
for rel in order:
    s = strip_comments(read(rel))
    for m in re.finditer(r"\\begin\{(figure|table)\}(.*?)\\end\{\1\}", s, flags=re.S):
        if "\\caption" not in m.group(2): problems.append(f"{rel}: {m.group(1)} without caption")
unref = [l for l in labels if l.startswith(("fig:", "tab:")) and l not in {r for _, r in refs}]

print(f"files: {len(order)}  labels: {len(labels)}  refs: {len(refs)}  cites: {len(cites)}  todos: {todos}")
print(f"PROBLEMS ({len(problems)}):"); [print("  ", p) for p in problems]
print(f"WARNINGS ({len(warns)}):"); [print("  ", w) for w in warns[:60]]
print(f"figures/tables never referenced ({len(unref)}):", " ".join(sorted(unref)))
sys.exit(1 if problems else 0)
