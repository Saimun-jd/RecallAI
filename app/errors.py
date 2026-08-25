"""
Structured Error Handling System for Recall Backend.

Provides:
- ErrorCode enum with user-facing messages
- RecallError exception class
- classify_error() to map raw exceptions to RecallError
- error_response() to build debug/production JSON responses
- Persistent error logging to recall_errors.log
- Langfuse error telemetry
"""

import logging
import os
import traceback
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


# ── Error Code Registry ─────────────────────────────────────────────────

class ErrorCode(str, Enum):
    """Every classifiable error gets a stable code and user-facing message."""

    LLM_RATE_LIMITED = "LLM_RATE_LIMITED"
    LLM_TIMEOUT = "LLM_TIMEOUT"
    LLM_CONNECTION_ERROR = "LLM_CONNECTION_ERROR"
    LLM_AUTH_FAILED = "LLM_AUTH_FAILED"
    LLM_INVALID_RESPONSE = "LLM_INVALID_RESPONSE"
    LLM_CONTENT_FILTERED = "LLM_CONTENT_FILTERED"
    LLM_QUOTA_EXCEEDED = "LLM_QUOTA_EXCEEDED"
    API_KEY_MISSING = "API_KEY_MISSING"
    OLLAMA_UNAVAILABLE = "OLLAMA_UNAVAILABLE"
    PDF_CORRUPT = "PDF_CORRUPT"
    PDF_EMPTY = "PDF_EMPTY"
    BOOK_NOT_FOUND = "BOOK_NOT_FOUND"
    TOPIC_NOT_FOUND = "TOPIC_NOT_FOUND"
    FILE_NOT_FOUND = "FILE_NOT_FOUND"
    INTERNAL_ERROR = "INTERNAL_ERROR"


# Maps each error code to:
#   (http_status_code, user_friendly_message)
_ERROR_MESSAGES: dict[ErrorCode, tuple[int, str]] = {
    ErrorCode.LLM_RATE_LIMITED: (
        429,
        "AI provider is rate limited. Please wait a moment and retry.",
    ),
    ErrorCode.LLM_TIMEOUT: (
        504,
        "AI request timed out. Try again or switch to a faster provider.",
    ),
    ErrorCode.LLM_CONNECTION_ERROR: (
        502,
        "Cannot reach the AI provider. Check your internet or provider settings.",
    ),
    ErrorCode.LLM_AUTH_FAILED: (
        401,
        "AI provider rejected your API key. Please check Settings.",
    ),
    ErrorCode.LLM_INVALID_RESPONSE: (
        502,
        "AI returned an unexpected response. Please retry.",
    ),
    ErrorCode.LLM_CONTENT_FILTERED: (
        422,
        "AI provider blocked the response due to content filtering. Try different content.",
    ),
    ErrorCode.LLM_QUOTA_EXCEEDED: (
        402,
        "AI provider quota exceeded. Check your billing or switch providers.",
    ),
    ErrorCode.API_KEY_MISSING: (
        400,
        "No API key configured for this provider. Please add one in Settings.",
    ),
    ErrorCode.OLLAMA_UNAVAILABLE: (
        503,
        "Ollama server is not running. Start it or switch to a cloud provider.",
    ),
    ErrorCode.PDF_CORRUPT: (
        422,
        "The uploaded PDF could not be read. The file may be corrupted.",
    ),
    ErrorCode.PDF_EMPTY: (
        422,
        "This PDF has no extractable text on the selected pages.",
    ),
    ErrorCode.BOOK_NOT_FOUND: (404, "Book not found."),
    ErrorCode.TOPIC_NOT_FOUND: (404, "Topic not found."),
    ErrorCode.FILE_NOT_FOUND: (
        404,
        "The PDF file is missing from disk. Please re-upload the book.",
    ),
    ErrorCode.INTERNAL_ERROR: (500, "Something went wrong. Please try again."),
}


def get_user_message(code: ErrorCode) -> str:
    """Return the user-friendly message for a given error code."""
    return _ERROR_MESSAGES.get(code, (500, "Something went wrong."))[1]


def get_http_status(code: ErrorCode) -> int:
    """Return the HTTP status code for a given error code."""
    return _ERROR_MESSAGES.get(code, (500, "Something went wrong."))[0]


# ── RecallError Exception ────────────────────────────────────────────────

class RecallError(Exception):
    """Structured application exception carrying an error code and debug detail."""

    def __init__(
        self,
        code: ErrorCode,
        detail: str = "",
        cause: Optional[Exception] = None,
    ):
        self.code = code
        self.detail = detail or get_user_message(code)
        self.cause = cause
        super().__init__(self.detail)


# ── Exception Classifier ─────────────────────────────────────────────────

def classify_error(exc: Exception, provider_hint: str = "") -> RecallError:
    """
    Inspect a raw exception and wrap it into a RecallError with the
    appropriate ErrorCode.

    Parameters
    ----------
    exc : Exception
        The raw exception caught from an LLM provider, PDF library, etc.
    provider_hint : str
        Optional provider name (e.g. "ollama", "gemini") to improve classification.

    Returns
    -------
    RecallError
        A structured error with a code, user message, and debug detail.
    """
    import httpx

    detail = str(exc)

    # ── Already classified ──
    if isinstance(exc, RecallError):
        return exc

    # ── httpx HTTP errors (response received with error status) ──
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        body = ""
        try:
            body = exc.response.text[:2000]
        except Exception:
            pass

        if status == 429:
            return RecallError(ErrorCode.LLM_RATE_LIMITED, f"HTTP 429: {body}", exc)
        if status in (401, 403):
            return RecallError(ErrorCode.LLM_AUTH_FAILED, f"HTTP {status}: {body}", exc)
        if status == 402 or "quota" in body.lower() or "RESOURCE_EXHAUSTED" in body:
            return RecallError(ErrorCode.LLM_QUOTA_EXCEEDED, f"HTTP {status}: {body}", exc)

        return RecallError(
            ErrorCode.LLM_CONNECTION_ERROR,
            f"HTTP {status}: {body}",
            exc,
        )

    # ── httpx timeout ──
    if isinstance(exc, httpx.TimeoutException):
        return RecallError(ErrorCode.LLM_TIMEOUT, detail, exc)

    # ── httpx connection errors ──
    if isinstance(exc, (httpx.ConnectError, httpx.ConnectTimeout)):
        provider_lower = provider_hint.lower() if provider_hint else ""
        if provider_lower == "ollama" or "11434" in detail or "localhost" in detail:
            return RecallError(ErrorCode.OLLAMA_UNAVAILABLE, detail, exc)
        return RecallError(ErrorCode.LLM_CONNECTION_ERROR, detail, exc)

    # ── General httpx request errors ──
    if isinstance(exc, httpx.RequestError):
        return RecallError(ErrorCode.LLM_CONNECTION_ERROR, detail, exc)

    # ── JSON parse failures ──
    if isinstance(exc, (ValueError,)) and "json" in detail.lower():
        return RecallError(ErrorCode.LLM_INVALID_RESPONSE, detail, exc)

    import json
    if isinstance(exc, json.JSONDecodeError):
        return RecallError(ErrorCode.LLM_INVALID_RESPONSE, detail, exc)

    # ── Fallback ──
    return RecallError(ErrorCode.INTERNAL_ERROR, detail, exc)


# ── Response Builder ──────────────────────────────────────────────────────

def error_response(
    exc: Exception,
    include_debug: bool = True,
) -> JSONResponse:
    """
    Build a JSONResponse from an exception.

    In debug mode, includes full traceback and detail.
    In production mode, only includes the error code and user-friendly message.
    """
    if isinstance(exc, RecallError):
        recall_err = exc
    else:
        recall_err = classify_error(exc)

    status_code = get_http_status(recall_err.code)
    user_message = get_user_message(recall_err.code)

    body: dict = {
        "error_code": recall_err.code.value,
        "message": user_message,
    }

    if include_debug:
        tb = ""
        try:
            tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
            tb = "".join(tb)
        except Exception:
            tb = traceback.format_exc()

        body["debug"] = {
            "detail": recall_err.detail,
            "exception_type": type(exc).__qualname__,
            "traceback": tb,
        }

    # Always log the error server-side
    logger.error(
        f"[{recall_err.code.value}] {recall_err.detail}",
        exc_info=exc,
    )

    # Persistent log + Langfuse telemetry
    _log_to_file(recall_err)
    _log_to_langfuse(recall_err)

    return JSONResponse(status_code=status_code, content=body)


def error_event(
    exc: Exception,
    include_debug: bool = True,
) -> dict:
    """
    Build an SSE error event dict for streaming endpoints.

    Returns a dict suitable for json.dumps() inside an SSE data frame.
    """
    if isinstance(exc, RecallError):
        recall_err = exc
    else:
        recall_err = classify_error(exc)

    user_message = get_user_message(recall_err.code)

    event: dict = {
        "status": "error",
        "error_code": recall_err.code.value,
        "message": user_message,
    }

    if include_debug:
        tb = ""
        try:
            tb_lines = traceback.format_exception(type(exc), exc, exc.__traceback__)
            tb = "".join(tb_lines)
        except Exception:
            tb = traceback.format_exc()

        event["debug"] = {
            "detail": recall_err.detail,
            "exception_type": type(exc).__qualname__,
            "traceback": tb,
        }

    # Always log
    logger.error(
        f"[{recall_err.code.value}] {recall_err.detail}",
        exc_info=exc,
    )

    _log_to_file(recall_err)
    _log_to_langfuse(recall_err)

    return event


# ── Persistent File Logging ──────────────────────────────────────────────

_error_log_path: Optional[str] = None


def _get_error_log_path() -> str:
    """Return the path to the persistent error log file."""
    global _error_log_path
    if _error_log_path is None:
        from platformdirs import user_data_dir
        data_dir = user_data_dir("Recall", "Recall")
        os.makedirs(data_dir, exist_ok=True)
        _error_log_path = os.path.join(data_dir, "recall_errors.log")
    return _error_log_path


def _log_to_file(err: RecallError) -> None:
    """Append a structured error entry to the persistent log file."""
    try:
        path = _get_error_log_path()
        timestamp = datetime.now(timezone.utc).isoformat()
        tb = ""
        if err.cause:
            try:
                tb_lines = traceback.format_exception(
                    type(err.cause), err.cause, err.cause.__traceback__
                )
                tb = "".join(tb_lines)
            except Exception:
                tb = str(err.cause)

        entry = (
            f"[{timestamp}] [{err.code.value}] {err.detail}\n"
            f"{tb}\n"
            f"{'─' * 80}\n"
        )

        with open(path, "a", encoding="utf-8") as f:
            f.write(entry)
    except Exception:
        # Never let logging itself crash the app
        pass


# ── Langfuse Error Telemetry ─────────────────────────────────────────────

def _log_to_langfuse(err: RecallError) -> None:
    """Report the error as a Langfuse trace/event for observability."""
    try:
        from langfuse import get_client
        langfuse = get_client()

        trace = langfuse.trace(
            name=f"error:{err.code.value}",
            metadata={
                "error_code": err.code.value,
                "detail": err.detail[:1000],
                "user_message": get_user_message(err.code),
            },
            level="ERROR",
        )
        trace.event(
            name="error_detail",
            metadata={
                "exception_type": type(err.cause).__qualname__ if err.cause else "RecallError",
                "detail": err.detail[:2000],
            },
            level="ERROR",
        )
    except Exception:
        # Langfuse may not be configured; never crash on telemetry failures
        pass
