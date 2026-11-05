"""
Knowledge Layer Schemas for Recall AI.
Defines request/response models for document summaries, concept extraction,
and source references.
"""

import json
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


# ── Source Reference ──────────────────────────────────────────────────

class SourceReference(BaseModel):
    """A validated reference to a document chunk used as source evidence."""
    source_index: int
    chunk_id: Optional[str] = None
    document_id: Optional[str] = None
    document_title: Optional[str] = None
    page_number: Optional[int] = None
    snippet: Optional[str] = None


# ── Summary Schemas ───────────────────────────────────────────────────

class SummaryGenerateRequest(BaseModel):
    """Request to generate or regenerate a document summary."""
    summary_type: Literal["short", "standard", "detailed"] = "standard"
    force: bool = Field(default=False, description="Force regeneration even if cached summary exists")


class DocumentSummaryResponse(BaseModel):
    """Response containing a cached or newly generated document summary."""
    id: str
    document_id: str
    summary_type: str
    summary: str
    key_points: List[str] = []
    source_references: List[SourceReference] = []
    content_version: str
    is_stale: bool = False
    model_metadata: Dict[str, Any] = {}
    created_at: str
    updated_at: str

    @classmethod
    def from_db_row(cls, row: Dict[str, Any], current_version: Optional[str] = None) -> "DocumentSummaryResponse":
        """Constructs response from database row with staleness check."""
        kp_raw = row.get("key_points", "[]")
        key_points = json.loads(kp_raw) if isinstance(kp_raw, str) else kp_raw

        sr_raw = row.get("source_references", "[]")
        source_refs_data = json.loads(sr_raw) if isinstance(sr_raw, str) else sr_raw
        source_refs = [
            SourceReference(**sr) if isinstance(sr, dict) else sr
            for sr in source_refs_data
        ]

        mm_raw = row.get("model_metadata", "{}")
        model_meta = json.loads(mm_raw) if isinstance(mm_raw, str) else mm_raw

        is_stale = False
        if current_version and row.get("content_version"):
            is_stale = row["content_version"] != current_version

        return cls(
            id=row["id"],
            document_id=row["document_id"],
            summary_type=row["summary_type"],
            summary=row["summary"],
            key_points=key_points,
            source_references=source_refs,
            content_version=row["content_version"],
            is_stale=is_stale,
            model_metadata=model_meta,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


# ── Concept Schemas ───────────────────────────────────────────────────

class ConceptItemResponse(BaseModel):
    """Response for a single extracted concept."""
    id: str
    document_id: str
    name: str
    normalized_name: str
    description: str
    importance: Literal["high", "medium", "low"]
    source_references: List[SourceReference] = []
    content_version: str
    created_at: str

    @classmethod
    def from_db_row(cls, row: Dict[str, Any]) -> "ConceptItemResponse":
        sr_raw = row.get("source_references", "[]")
        source_refs_data = json.loads(sr_raw) if isinstance(sr_raw, str) else sr_raw
        source_refs = [
            SourceReference(**sr) if isinstance(sr, dict) else sr
            for sr in source_refs_data
        ]
        return cls(
            id=row["id"],
            document_id=row["document_id"],
            name=row["name"],
            normalized_name=row["normalized_name"],
            description=row["description"],
            importance=row["importance"],
            source_references=source_refs,
            content_version=row["content_version"],
            created_at=row["created_at"],
        )


class ConceptListResponse(BaseModel):
    """Response containing all concepts extracted from a document."""
    document_id: str
    total: int
    concepts: List[ConceptItemResponse] = []


class ConceptGenerateRequest(BaseModel):
    """Request to extract or regenerate concepts from a document."""
    max_concepts: int = Field(default=10, ge=1, le=30)
    force: bool = Field(default=False, description="Force regeneration even if cached concepts exist")
