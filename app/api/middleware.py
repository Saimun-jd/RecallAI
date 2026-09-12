"""
Security Middleware for Recall AI.
Includes:
- SecurityHeadersMiddleware (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- RequestSizeLimitMiddleware (Payload size enforcement)
- InMemoryRateLimiter (Brute-force and credential stuffing mitigation)
"""

import time
from collections import defaultdict
from typing import Callable, Dict, List
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.config import settings
from app.core.errors import ErrorCode, format_error_response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injects essential security headers into every outgoing response."""
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Enforces request payload size limits to guard against memory exhaustion attacks."""
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                length = int(content_length)
                if length > settings.MAX_REQUEST_BODY_BYTES:
                    return format_error_response(
                        code=ErrorCode.PAYLOAD_TOO_LARGE,
                        message=f"Payload size ({length} bytes) exceeds maximum permitted limit ({settings.MAX_REQUEST_BODY_BYTES} bytes).",
                        status_code=413
                    )
            except ValueError:
                pass

        return await call_next(request)


class InMemoryRateLimiter:
    """
    Sliding window rate limiter for protecting sensitive routes (e.g., auth).
    """
    def __init__(self, requests_per_minute: int = 15):
        self.requests_per_minute = requests_per_minute
        self._history: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, client_ip: str) -> bool:
        now = time.time()
        window_start = now - 60.0

        # Filter out timestamps older than 60 seconds
        timestamps = [t for t in self._history[client_ip] if t > window_start]
        self._history[client_ip] = timestamps

        if len(timestamps) >= self.requests_per_minute:
            return False

        self._history[client_ip].append(now)
        return True

    def reset(self) -> None:
        """Clear all rate limit histories (used in tests)."""
        self._history.clear()

    def cleanup(self) -> None:
        """Purge stale IPs with empty history."""
        now = time.time()
        window_start = now - 60.0
        stale_keys = [ip for ip, times in self._history.items() if not times or times[-1] <= window_start]
        for ip in stale_keys:
            del self._history[ip]


auth_rate_limiter = InMemoryRateLimiter(requests_per_minute=15)
