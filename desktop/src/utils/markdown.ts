/**
 * Shared Markdown preprocessor for LLM-generated content.
 * 
 * Handles three categories of issues:
 * 1. Escaped newlines (\\n → real newlines) from JSON serialization
 * 2. Single-line code blocks from LLMs that don't use newlines in JSON strings
 * 3. Plain-text math expressions → LaTeX delimiters (for legacy data without $ markers)
 */

/**
 * Converts letter+digit exponent patterns to LaTeX superscripts.
 * Only targets letter THEN digit (e.g., x3 → x^{3}), NOT digit THEN letter (e.g., 6x stays 6x).
 * Only superscripts digits >= 2 (x^1 is rarely written; x1 is more often an indexed variable).
 */
function addSuperscripts(expr: string): string {
  return expr.replace(/([a-zA-Z])(\d+)/g, (_match, letter: string, digit: string) => {
    const num = parseInt(digit);
    if (num >= 2) {
      return `${letter}^{${digit}}`;
    }
    return `${letter}${digit}`;
  });
}

/**
 * Detects common plain-text mathematical expressions and wraps them in LaTeX $ delimiters.
 * 
 * Targets patterns like:
 *   "x3 - 6x2 + 11x - 6 = 0"  →  "$x^{3} - 6x^{2} + 11x - 6 = 0$"
 *   "2x + 3 = 0"                →  "$2x + 3 = 0$"
 *   "ax2 + bx + c = 0"          →  "$ax^{2} + bx + c = 0$"
 * 
 * Does NOT touch text that already contains $ (i.e., already has LaTeX).
 */
function convertPlainMathToLatex(text: string): string {
  // Pattern 1: Equations with = sign
  // Matches expressions like: "x3 - 6x2 + 11x - 6 = 0", "2x + 3 = 0"
  // Requires: at least one variable term, one or more +/- operators, and "= <number>"
  text = text.replace(
    /(?<![a-zA-Z])(\d*[a-zA-Z]\d*(?:\s*[-+]\s*\d*[a-zA-Z]?\d*)*\s*=\s*\d+)(?![a-zA-Z])/g,
    (match) => {
      // Only wrap if it looks genuinely mathematical (has a variable followed by operator/equals)
      if (/[a-zA-Z]/.test(match) && /[-+=]/.test(match)) {
        return `$${addSuperscripts(match)}$`;
      }
      return match;
    }
  );

  // Pattern 2: Polynomial expressions WITHOUT = sign but WITH clear exponent patterns
  // Matches: "x3 + 2x2 - x + 1", "x3 - 6x2 + 11x - 6"
  // Requires: at least one letter+digit exponent (>= 2) AND at least 2 terms with operators
  text = text.replace(
    /(?<![a-zA-Z$])(\d*[a-zA-Z]\d{1,2}(?:\s*[-+]\s*\d*[a-zA-Z]?\d*){2,})(?![a-zA-Z$])/g,
    (match) => {
      // Only wrap if it contains a clear exponent pattern (letter followed by digit >= 2)
      if (/[a-zA-Z][2-9]/.test(match)) {
        return `$${addSuperscripts(match)}$`;
      }
      return match;
    }
  );

  // Pattern 3: Standalone simple expressions like "e.g., 2x + 3" that are parenthesized
  // Matches content inside parentheses that looks mathematical
  text = text.replace(
    /\((?:e\.g\.,?\s*)?(\d*[a-zA-Z]\d*(?:\s*[-+]\s*\d*[a-zA-Z]?\d*)+(?:\s*=\s*\d+)?)\)/g,
    (fullMatch, expr) => {
      if (/[a-zA-Z]/.test(expr) && /[-+]/.test(expr)) {
        const prefix = fullMatch.match(/^\((?:e\.g\.,?\s*)?/)?.[0] || '(';
        return `${prefix}$${addSuperscripts(expr)}$)`;
      }
      return fullMatch;
    }
  );

  return text;
}

/**
 * Main preprocessor: cleans up LLM output before passing to ReactMarkdown.
 */
export function preprocessMarkdown(text: string | undefined | null): string {
  if (!text) return '';
  let processed = text;

  // 1. Convert escaped newlines to real newlines (common in JSON-serialized LLM output)
  processed = processed.replace(/\\n/g, '\n');

  // 1.5 Fix LaTeX matrix row separators and multi-line inline math
  // LLMs often output \\ c & d which loses the double backslash during JSON parsing.
  // Convert multi-line inline math $...$ to block math $$...$$ so remark-math can parse it.
  processed = processed.replace(/(?<!\$)\$(?!\$)([\s\S]+?)(?<!\$)\$(?!\$)/g, (match, mathContent) => {
    let fixedMath = mathContent;
    // Fix broken LaTeX newlines (e.g., "\\ c & d" -> "\\\\ c & d")
    fixedMath = fixedMath.replace(/\\\s/g, '\\\\ ');
    
    // If the math contains a newline, it MUST be a block math $$ for remark-math to parse it
    if (fixedMath.includes('\n')) {
      return `$$${fixedMath}$$`;
    }
    return `$${fixedMath}$`;
  });

  // 2. Fix single-line code blocks (LLMs sometimes output ```python import foo bar``` on one line)
  processed = processed.replace(/```(\w+)\s+(?=.)/g, '```$1\n');
  processed = processed.replace(/```(\w+)\n(.*?)```/gs, (match, lang, code) => {
    if (!code.includes('\n')) {
      const formattedCode = code
        .replace(/\s+(import|from|def|class|return|if|elif|else|for|while|with|try|except|finally|print|raise|assert|yield|#|[a-zA-Z_][a-zA-Z0-9_]*\s*=)/g, '\n$1')
        .replace(/^\n/, '');
      return '```' + lang + '\n' + formattedCode + '\n```';
    }
    return match;
  });

  // 3. Convert plain-text math to LaTeX (only if no $ delimiters already exist in the text)
  if (!processed.includes('$')) {
    processed = convertPlainMathToLatex(processed);
  }

  return processed;
}
