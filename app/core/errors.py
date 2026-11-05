"""
Centralized Error Architecture for Recall AI.
Provides stable ErrorCode definitions, custom exception hierarchy,
and standard error response builders.
"""

from enum import Enum
from typing import Any, Optional, Dict
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
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
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
    ErrorCode.QUOTA_EXCEEDED: (402, "Quota allowance exceeded. Please upgrade your plan."),
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


class EntitlementRequiredError(AppException):
    def __init__(
        self,
        message: str = "Feature not permitted by your plan. Upgrade required.",
        feature: Optional[str] = None,
        details: Optional[Any] = None
    ):
        det = details if isinstance(details, dict) else {}
        if feature is not None:
            det["feature"] = feature
        super().__init__(
            ErrorCode.ENTITLEMENT_REQUIRED,
            message=message,
            status_code=403,
            details=det if det else details
        )

    @property
    def metadata(self) -> Dict[str, Any]:
        return self.details if isinstance(self.details, dict) else {}


class QuotaExceededError(AppException):
    def __init__(
        self,
        message: str = "Credit or quota allowance exceeded. Please upgrade or add credits.",
        feature: Optional[str] = None,
        limit: Optional[int] = None,
        used: Optional[int] = None,
        reset_at: Optional[str] = None,
        details: Optional[Any] = None
    ):
        det = details if isinstance(details, dict) else {}
        if feature is not None:
            det["feature"] = feature
        if limit is not None:
            det["limit"] = limit
        if used is not None:
            det["used"] = used
        if reset_at is not None:
            det["reset_at"] = reset_at
        super().__init__(
            ErrorCode.QUOTA_EXCEEDED,
            message=message,
            status_code=402,
            details=det if det else details
        )

    @property
    def metadata(self) -> Dict[str, Any]:
        return self.details if isinstance(self.details, dict) else {}


class UsageExceededError(QuotaExceededError):
    def __init__(
        self,
        message: str = "Monthly credit allowance exceeded",
        details: Optional[Any] = None,
        feature: Optional[str] = None,
        limit: Optional[int] = None,
        used: Optional[int] = None,
        reset_at: Optional[str] = None
    ):
        super().__init__(
            message=message,
            feature=feature,
            limit=limit,
            used=used,
            reset_at=reset_at,
            details=details
        )



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
            "details": details,
            "metadata": details if isinstance(details, dict) else {}
        }
    }
    return JSONResponse(status_code=status_code, content=payload)
