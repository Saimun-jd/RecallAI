"""Convert SVG files to tightly-cropped vector PDFs with headless Edge.
Usage: python svg2pdf.py in.svg [in2.svg ...] --out DIR
"""
import sys, re, subprocess, tempfile, pathlib
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
args = sys.argv[1:]; out = pathlib.Path(args[args.index("--out")+1]); files = [a for a in args if a.endswith(".svg")]
out.mkdir(parents=True, exist_ok=True)
for f in files:
    p = pathlib.Path(f).resolve(); s = p.read_text(encoding="utf8")
    m = re.search(r'viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)', s)
    if m: w, h = float(m.group(1)), float(m.group(2))
    else:
        w = float(re.search(r'width="([\d.]+)', s).group(1)); h = float(re.search(r'height="([\d.]+)', s).group(1))
    html = f"""<!doctype html><html><head><style>@page{{size:{w}px {h}px;margin:0}}html,body{{margin:0;padding:0}}img{{display:block;width:{w}px;height:{h}px}}</style></head><body><img src="{p.as_uri()}"></body></html>"""
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf8") as t: t.write(html); tp = t.name
    dst = out / (p.stem + ".pdf")
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={dst}", pathlib.Path(tp).as_uri()], check=True, capture_output=True, timeout=120)
    print(dst, dst.stat().st_size)
