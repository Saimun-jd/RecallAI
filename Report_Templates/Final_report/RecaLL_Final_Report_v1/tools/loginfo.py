"""Summarise overfull boxes and float warnings per source file from a LaTeX log.
Usage: python tools/loginfo.py path/to/main.log [min_pt]
"""
import re, sys, collections
log = open(sys.argv[1], encoding="latin-1").read()
minpt = float(sys.argv[2]) if len(sys.argv) > 2 else 10
cur = "?"
out = collections.defaultdict(list)
for line in log.split("\n"):
    for m in re.finditer(r"\(\./((?:chapters|appendices|frontmatter)/[\w.]+\.tex)", line):
        cur = m.group(1)
    m = re.match(r"Overfull .hbox \(([0-9.]+)pt too wide\) .*?lines? ([0-9-]+)", line)
    if m and float(m.group(1)) >= minpt:
        out[cur].append(f"{float(m.group(1)):.0f}pt@{m.group(2)}")
    m = re.match(r"LaTeX Warning: Float too large for page by ([0-9.]+)pt on input line (\d+)", line)
    if m:
        out[cur].append(f"FLOAT-TOO-LARGE {float(m.group(1)):.0f}pt@{m.group(2)}")
for f, items in out.items():
    print(f, len(items), " ".join(items[:25]))
