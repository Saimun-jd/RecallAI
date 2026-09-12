"""
Common Schemas and Standard Response Envelopes for Recall AI.
"""

from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class ResponseEnvelope(BaseModel, Generic[T]):
    """Standard success response wrapper."""
    data: T


class ErrorDetail(BaseModel):
    field: Optional[str] = None
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: Optional[Any] = None


class ErrorEnvelope(BaseModel):
    """Standard error response wrapper."""
    error: ErrorBody


class PaginationParams(BaseModel):
    limit: int = Field(default=20, ge=1, le=100, description="Items to return (1-100)")
    offset: int = Field(default=0, ge=0, description="Offset for pagination")
