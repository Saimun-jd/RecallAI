"""
Structured Logging for Recall AI with Security Redaction Filter.
Prevents leaking API keys, passwords, bearer tokens, or sensitive payload content.
"""

import logging
import re
from typing import Any

# Sensitive patterns to scrub from log messages
SENSITIVE_PATTERNS = [
    (re.compile(r'(password["\']?\s*[:=]\s*["\'])([^"\']+)(["\'])', re.IGNORECASE), r'\1[REDACTED]\3'),
    (re.compile(r'(api[_-]?key["\']?\s*[:=]\s*["\'])([^"\']+)(["\'])', re.IGNORECASE), r'\1[REDACTED]\3'),
    (re.compile(r'(secret[_-]?key["\']?\s*[:=]\s*["\'])([^"\']+)(["\'])', re.IGNORECASE), r'\1[REDACTED]\3'),
    (re.compile(r'(Bearer\s+)([A-Za-z0-9\-._~+/]+=*)', re.IGNORECASE), r'\1[REDACTED_TOKEN]'),
    (re.compile(r'(sk-[A-Za-z0-9]{20,})', re.IGNORECASE), r'[REDACTED_KEY]'),
    (re.compile(r'(AIzaSy[A-Za-z0-9_\-]{33})', re.IGNORECASE), r'[REDACTED_KEY]'),
]


class RedactingFilter(logging.Filter):
    """Filter that sanitizes sensitive data from log records."""
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = self.redact(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: self.redact(v) if isinstance(v, str) else v for k, v in record.args.items()}
            elif isinstance(record.args, (list, tuple)):
                record.args = tuple(self.redact(arg) if isinstance(arg, str) else arg for arg in record.args)
        return True

    @staticmethod
    def redact(text: str) -> str:
        for pattern, replacement in SENSITIVE_PATTERNS:
            text = pattern.sub(replacement, text)
        return text


def get_logger(name: str) -> logging.Logger:
    """Returns a logger instance with redaction filtering applied."""
    logger = logging.getLogger(name)
    # Avoid adding duplicate filters
    if not any(isinstance(f, RedactingFilter) for f in logger.filters):
        logger.addFilter(RedactingFilter())
    return logger
