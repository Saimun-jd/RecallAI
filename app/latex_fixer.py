"""
latex_fixer.py

Deterministic pre-LLM pass to fix bare LaTeX commands that Marker failed to
wrap in $ / $$ delimiters.  Runs BEFORE the LLM cleanup so the LLM receives
well-formed math and doesn't mangle it further.

Two classes of problem are addressed:

1. BLOCK equations — a whole paragraph that IS a LaTeX environment but has no
   surrounding $$…$$.  Example (Marker fast-mode output):
       A = \\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix} \\rightarrow B \\tag{12}

2. INLINE equations — a sentence fragment that contains LaTeX notation without
   any $ wrapping.  Example:
       (A^T)_{ij} = (A)_{ji} \\tag{11}
"""

import re
import logging

logger = logging.getLogger(__name__)

# ── Signatures that indicate bare LaTeX ───────────────────────────────────────

# LaTeX environments that almost always mean block math
BLOCK_ENV_PATTERN = re.compile(
    r'\\begin\{'
    r'(bmatrix|pmatrix|vmatrix|Bmatrix|matrix|cases|align\*?|gather\*?|equation\*?|array|split)'
    r'\}',
    re.IGNORECASE,
)

# Commands that almost always appear inside math
MATH_COMMAND_RE = re.compile(
    r'\\(?:'
    r'frac|sqrt|sum|int|prod|lim|max|min|sup|inf|det|'
    r'alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|'
    r'lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|'
    r'Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|'
    r'Lambda|Mu|Nu|Xi|Pi|Rho|Sigma|Tau|Upsilon|Phi|Chi|Psi|Omega|'
    r'mathbf|mathit|mathrm|mathbb|mathcal|mathsf|mathtt|'
    r'text|operatorname|'
    r'left|right|'
    r'cdot|cdots|ldots|vdots|ddots|'
    r'times|div|pm|mp|oplus|otimes|'
    r'leq|geq|neq|approx|equiv|sim|cong|'
    r'rightarrow|leftarrow|Rightarrow|Leftarrow|leftrightarrow|Leftrightarrow|'
    r'to|in|notin|subset|supset|subseteq|supseteq|'
    r'forall|exists|nabla|partial|infty|'
    r'tag|label|nonumber|'
    r'overline|underline|hat|bar|vec|tilde|dot|ddot'
    r')\b'
)

# Subscript/superscript patterns that almost certainly are math
# e.g. a_{ij}, x^{2}, A^T
SUBSCRIPT_SUPERSCRIPT_RE = re.compile(r'[A-Za-z0-9]\s*[_^]\s*\{[^}]+\}')

# Tag patterns: \tag{11}, \tag*{...}
TAG_RE = re.compile(r'\\tag\*?\{')


def _has_math_content(text: str) -> bool:
    """Return True if text looks like it contains bare LaTeX math."""
    if BLOCK_ENV_PATTERN.search(text):
        return True
    if TAG_RE.search(text):
        return True
    if SUBSCRIPT_SUPERSCRIPT_RE.search(text):
        return True
    if len(MATH_COMMAND_RE.findall(text)) >= 2:
        return True
    return False


def _already_delimited(text: str) -> bool:
    """Return True if the paragraph already has $ or $$ delimiters."""
    return '$' in text


def _count_bare_begin(text: str) -> int:
    """Count \\begin{...} occurrences that are NOT inside $...$."""
    # Strip already-delimited math first
    stripped = re.sub(r'\$\$.*?\$\$', '', text, flags=re.DOTALL)
    stripped = re.sub(r'\$[^$\n]+?\$', '', stripped)
    return len(BLOCK_ENV_PATTERN.findall(stripped))


def _is_block_math_paragraph(para: str) -> bool:
    """
    Return True if the entire paragraph should be wrapped as a block equation.
    Criteria: contains a block environment, OR is a short line (≤120 chars)
    that is clearly dominated by math commands with no significant prose.
    """
    stripped = para.strip()

    # Definitely a block environment
    if BLOCK_ENV_PATTERN.search(stripped):
        return True

    # Short, math-dominated line (e.g. "(A^T)_{ij} = (A)_{ji} \\tag{11}")
    words = re.sub(MATH_COMMAND_RE, '', stripped)
    words = re.sub(r'[=+\-*/\\^_{}()\[\]|,. \t\d]', '', words)
    # If very little "word" content remains → math-dominated
    if len(stripped) < 200 and len(words) < 15 and _has_math_content(stripped):
        return True

    return False


def fix_latex_delimiters(md_text: str) -> str:
    """
    Main entry point.  Scans the markdown paragraph-by-paragraph and wraps
    bare LaTeX into $$ ... $$ blocks, without touching paragraphs that are
    already correctly delimited.

    Returns the fixed markdown string.
    """
    paragraphs = md_text.split('\n\n')
    fixed = []
    changes = 0

    for para in paragraphs:
        stripped = para.strip()

        # Skip empty, headings, fenced code, image links, horizontal rules
        if (
            not stripped
            or stripped.startswith('#')
            or stripped.startswith('```')
            or stripped.startswith('    ')  # indented code
            or stripped.startswith('---')
            or stripped.startswith('___')
            or re.match(r'^!\[.*?\]\(.*?\)$', stripped)  # image only
        ):
            fixed.append(para)
            continue

        # If already delimited, leave alone
        if _already_delimited(stripped):
            fixed.append(para)
            continue

        # If this paragraph looks like bare LaTeX, wrap it
        if _is_block_math_paragraph(stripped):
            logger.debug(f"[latex_fixer] Wrapping bare LaTeX paragraph: {stripped[:60]}...")
            fixed.append(f"\n$$\n{stripped}\n$$\n")
            changes += 1
        else:
            fixed.append(para)

    if changes:
        logger.info(f"[latex_fixer] Fixed {changes} bare-LaTeX paragraph(s)")

    return '\n\n'.join(fixed)
