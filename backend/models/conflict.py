import enum
from typing import Optional, List
from pydantic import BaseModel


# ── Enumerations ──────────────────────────────────────────────────────────────

class ConflictStatus(str, enum.Enum):
    OPEN = "open"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class ConflictType(str, enum.Enum):
    CONTRADICTORY_VALUE = "contradictory_value"
    UNCLEAR_REPLACEMENT = "unclear_replacement"
    MULTIPLE_ACTIVE_CANDIDATES = "multiple_active_candidates"
    INSUFFICIENT_AUTHORITY = "insufficient_authority"


class ConflictResolution(str, enum.Enum):
    ACCEPT_CANDIDATE = "accept_candidate"
    KEEP_EXISTING = "keep_existing"
    DISMISS = "dismiss"


# ── Request / Response schemas ────────────────────────────────────────────────

class ConflictResolveRequest(BaseModel):
    resolution: ConflictResolution


class ConflictExistingSide(BaseModel):
    value: str
    decision_id: Optional[str] = None
    source_document: str
    source_document_id: Optional[str] = None
    source_date: Optional[str] = None


class ConflictCandidateSide(BaseModel):
    value: str
    source_document: str
    source_document_id: Optional[str] = None
    source_chunk_id: Optional[str] = None
    reason: Optional[str] = None
    evidence_text: Optional[str] = None
    source_date: Optional[str] = None


class ConflictListItem(BaseModel):
    id: str
    topic: str
    normalized_topic: str
    status: str
    conflict_type: str
    existing_value: str
    candidate_value: str
    created_at: Optional[str] = None


class ConflictListResponse(BaseModel):
    total: int
    conflicts: List[ConflictListItem]


class ConflictDetailResponse(BaseModel):
    id: str
    topic: Optional[str] = None
    normalized_topic: str
    status: str
    conflict_type: str
    existing: ConflictExistingSide
    candidate: ConflictCandidateSide
    resolution: Optional[str] = None
    resolution_note: Optional[str] = None
    resolution_decision_id: Optional[str] = None
    created_at: Optional[str] = None
    resolved_at: Optional[str] = None


class ConflictResolveResponse(BaseModel):
    id: str
    status: str
    resolution: str
    resolution_decision_id: Optional[str] = None
    message: str


class ConflictCountResponse(BaseModel):
    open_conflicts: int
    total_conflicts: int
