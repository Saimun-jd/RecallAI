"""Generate appendices/appendixB_test_cases.tex from pytest JUnit XML files.

The appendix holds one row per test file (tests, passed, failed, skipped) and, if any test did not
pass, a short second table that lists those tests. The complete per-test list stays in the JUnit
XML files themselves.

Usage (from the report folder):
    python tools/gen_appendixB.py "app/tests=tools/test_results/junit_app_tests.xml" [more "label=path" pairs]
"""
import sys, pathlib, collections, xml.etree.ElementTree as ET

BS = chr(92)


def esc(s):
    return (s.replace(BS, "/").replace("_", BS + "_").replace("&", BS + "&")
             .replace("%", BS + "%").replace("#", BS + "#"))


def status(tc):
    if tc.find("failure") is not None or tc.find("error") is not None:
        return "failed"
    if tc.find("skipped") is not None:
        return "skipped"
    return "passed"


def read_suite(path):
    per_file = collections.OrderedDict()
    not_passed = []
    for tc in ET.parse(path).getroot().iter("testcase"):
        parts = tc.get("classname").split(".")
        fname = [p for p in parts if p.startswith("test_")][0] + ".py"
        st = status(tc)
        c = per_file.setdefault(fname, collections.Counter())
        c["tests"] += 1
        c[st] += 1
        if st != "passed":
            not_passed.append((fname, tc.get("name"), st))
    return per_file, not_passed


suites = []
for arg in sys.argv[1:]:
    label, path = arg.split("=", 1)
    suites.append((label, pathlib.Path(path).name) + read_suite(path))
if not suites:
    sys.exit(__doc__)

total = collections.Counter()
for _, _, per_file, _ in suites:
    for c in per_file.values():
        total.update(c)
all_not_passed = [(label, f, n, st) for label, _, _, np in suites for f, n, st in np]

xml_names = ", ".join(r"\texttt{tools/test\_results/" + esc(x) + "}" for _, x, _, _ in suites)
suite_names = ", ".join(r"\texttt{" + esc(l) + "}" for l, _, _, _ in suites)
lines = [
    r"\chapter{Complete Test Cases (Detailed Tables)}\label{app:tests}",
    "",
    r"This appendix summarises the automated test run of 16 November 2026 at commit \texttt{60d40f9}",
    r"(Windows~11, Python~3.13, no provider keys) for " + suite_names + r". \Cref{tab:fulltc} gives one row per",
    r"test file. The complete list of the individual tests with their results and run times is kept as JUnit XML",
    r"in the report's source folder (" + xml_names + r"). The module-level system test cases with expected and",
    r"actual results are in \Cref{ch:test}.",
    "",
    r"{\small\setstretch{1.1}",
    r"\begin{longtable}{@{}l l r r r r@{}}",
    r"\caption{Automated test results per test file}\label{tab:fulltc}\\",
    r"\toprule",
    r"\textbf{Suite} & \textbf{Test file} & \textbf{Tests} & \textbf{Passed} & \textbf{Failed} & \textbf{Skipped}\\",
    r"\midrule",
    r"\endfirsthead",
    r"\toprule",
    r"\textbf{Suite} & \textbf{Test file} & \textbf{Tests} & \textbf{Passed} & \textbf{Failed} & \textbf{Skipped}\\",
    r"\midrule",
    r"\endhead",
    r"\bottomrule",
    r"\endfoot",
]
for label, _, per_file, _ in suites:
    for fname, c in per_file.items():
        lines.append(f"\\texttt{{{esc(label)}}} & \\texttt{{{esc(fname)}}} & {c['tests']} & {c['passed']} & "
                     f"{c['failed']} & {c['skipped']}" + BS + BS)
lines += [
    r"\midrule",
    f"\\multicolumn{{2}}{{@{{}}l}}{{\\textbf{{Total}}}} & \\textbf{{{total['tests']}}} & \\textbf{{{total['passed']}}} & "
    f"\\textbf{{{total['failed']}}} & \\textbf{{{total['skipped']}}}" + BS + BS,
    r"\end{longtable}}",
    "",
]
if all_not_passed:
    lines += [
        r"\Cref{tab:notpassed} lists the tests that did not pass.",
        "",
        r"\begin{table}[htbp]",
        r"\centering\small",
        r"\caption{Tests that did not pass}\label{tab:notpassed}",
        r"\begin{tabularx}{\textwidth}{@{}l l X l@{}}",
        r"\toprule",
        r"\textbf{Suite} & \textbf{File} & \textbf{Test} & \textbf{Result}\\",
        r"\midrule",
    ]
    for label, f, n, st in all_not_passed:
        lines.append(f"\\texttt{{{esc(label)}}} & \\texttt{{{esc(f)}}} & \\texttt{{{esc(n)}}} & {st.capitalize()}" + BS + BS)
    lines += [r"\bottomrule", r"\end{tabularx}", r"\end{table}", ""]
else:
    lines += [f"All {total['tests']} tests passed; no test failed or was skipped.", ""]

p = pathlib.Path(__file__).resolve().parent.parent / "appendices" / "appendixB_test_cases.tex"
p.write_text("\n".join(lines), encoding="utf8")
print("files", sum(len(s[2]) for s in suites), dict(total))
