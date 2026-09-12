"""
Centralized Error Architecture for Recall AI.
Provides stable ErrorCode definitions, custom exception hierarchy,
and standard error response builders.
"""

from enum import Enum
from typing import Any, Optional, Dict
from fastapi import Request
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)


class ErrorCode(str, Enum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHENTICATED = "UNAUTHENTICATED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    RATE_LIMITED = "RATE_LIMITED"
    ENTITLEMENT_REQUIRED = "ENTITLEMENT_REQUIRED"
    USAGE_EXCEEDED = "USAGE_EXCEEDED"
    PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE"
    INTERNAL_ERROR = "INTERNAL_ERROR"


# Default HTTP status code and message mapping
ERROR_DEFAULTS: Dict[ErrorCode, tuple[int, str]] = {
    ErrorCode.VALIDATION_ERROR: (422, "Input validation failed."),
    ErrorCode.UNAUTHENTICATED: (401, "Authentication required. Please log in."),
    ErrorCode.FORBIDDEN: (403, "You do not have permission to access this resource."),
    ErrorCode.NOT_FOUND: (404, "Requested resource not found."),
    ErrorCode.CONFLICT: (409, "A resource with this identifier already exists."),
    ErrorCode.RATE_LIMITED: (429, "Too many requests. Please slow down."),
    ErrorCode.ENTITLEMENT_REQUIRED: (403, "Feature not permitted by your plan. Upgrade required."),
    ErrorCode.USAGE_EXCEEDED: (402, "Credit allowance exceeded. Please upgrade or add credits."),
    ErrorCode.PAYLOAD_TOO_LARGE: (413, "Request payload exceeds maximum allowed size."),
    ErrorCode.INTERNAL_ERROR: (500, "An internal server error occurred. Please try again later."),
}


class AppException(Exception):
    """Base exception for all domain and API errors."""
    def __init__(
        self,
        code: ErrorCode,
        message: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[Any] = None
    ):
        default_status, default_msg = ERROR_DEFAULTS.get(code, (500, "An error occurred."))
        self.code = code
        self.message = message or default_msg
        self.status_code = status_code or default_status
        self.details = details
        super().__init__(self.message)


class AuthenticationError(AppException):
    def __init__(self, message: str = "Invalid email or password", details: Optional[Any] = None):
        super().__init__(ErrorCode.UNAUTHENTICATED, message=message, status_code=401, details=details)


class AuthorizationError(AppException):
    def __init__(self, message: str = "Access denied", details: Optional[Any] = None):
        super().__init__(ErrorCode.FORBIDDEN, message=message, status_code=403, details=details)


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found", details: Optional[Any] = None):
        super().__init__(ErrorCode.NOT_FOUND, message=message, status_code=404, details=details)


class ConflictError(AppException):
    def __init__(self, message: str = "Resource conflict", details: Optional[Any] = None):
        super().__init__(ErrorCode.CONFLICT, message=message, status_code=409, details=details)


class ValidationError(AppException):
    def __init__(self, message: str = "Invalid input", details: Optional[Any] = None):
        super().__init__(ErrorCode.VALIDATION_ERROR, message=message, status_code=422, details=details)


class RateLimitError(AppException):
    def __init__(self, message: str = "Too many requests", details: Optional[Any] = None):
        super().__init__(ErrorCode.RATE_LIMITED, message=message, status_code=429, details=details)


class PayloadTooLargeError(AppException):
    def __init__(self, message: str = "Payload exceeds maximum allowed size", details: Optional[Any] = None):
        super().__init__(ErrorCode.PAYLOAD_TOO_LARGE, message=message, status_code=413, details=details)


class UsageExceededError(AppException):
    def __init__(self, message: str = "Monthly credit allowance exceeded", details: Optional[Any] = None):
        super().__init__(ErrorCode.USAGE_EXCEEDED, message=message, status_code=402, details=details)



def format_error_response(
    code: ErrorCode,
    message: str,
    status_code: int,
    details: Optional[Any] = None
) -> JSONResponse:
    """Returns standard error envelope without leaking internal details."""
    payload = {
        "error": {
            "code": code.value if isinstance(code, ErrorCode) else str(code),
            "message": message,
            "details": details
        }
    }
    return JSONResponse(status_code=status_code, content=payload)
