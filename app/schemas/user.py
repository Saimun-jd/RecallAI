"""
User Profile and Preferences Schemas for Recall AI.
"""

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class UserPreferencesResponse(BaseModel):
    user_id: str
    theme: str
    daily_review_goal: int
    preferred_llm_provider: str
    preferences: Dict[str, Any]
    updated_at: str


class UserPreferencesUpdateRequest(BaseModel):
    theme: Optional[str] = Field(default=None, description="UI theme preset")
    daily_review_goal: Optional[int] = Field(default=None, ge=1, le=500, description="Daily review card target")
    preferred_llm_provider: Optional[str] = Field(default=None, description="Preferred AI provider")
    preferences: Optional[Dict[str, Any]] = Field(default=None, description="Additional custom UI preferences")
