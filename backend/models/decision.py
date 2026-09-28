import enum
from typing import Optional, List
from pydantic import BaseModel, Field


class DecisionStatus(str, enum.Enum):
    ACTIVE = "active"
    REPLACED = "replaced"
    AMBIGUOUS = "ambiguous"


class DecisionCandidate(BaseModel):
    is_decision: bool = True
    topic: str
    normalized_topic: Optional[str] = None
    value: str
    reason: Optional[str] = None
    replaces_previous: bool = False
    previous_value: Optional[str] = None
    effective_date: Optional[str] = None
    evidence_text: str
    source_chunk_id: Optional[str] = None


class DecisionResponse(BaseModel):
    id: str
    topic: str
    normalized_topic: str
    value: str
    status: str
    reason: Optional[str] = None
    source_document: Optional[str] = None
    source_document_id: str
    source_chunk_id: Optional[str] = None
    source_date: Optional[str] = None
    supersedes_decision_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class DecisionListItem(BaseModel):
    id: str
    topic: str
    value: str
    status: str
    reason: Optional[str] = None
    source_document: str


class DecisionListResponse(BaseModel):
    total: int
    decisions: List[DecisionListItem]


class DecisionLineageCurrent(BaseModel):
    value: str
    status: str
    reason: Optional[str] = None


class DecisionLineageItem(BaseModel):
    value: str
    status: str
    reason: Optional[str] = None
    source: Optional[str] = None
    source_date: Optional[str] = None


class DecisionLineageResponse(BaseModel):
    topic: str
    current: DecisionLineageCurrent
    lineage: List[DecisionLineageItem]


class DocumentDecisionsResponse(BaseModel):
    document_id: str
    status: str
    decisions_detected: int
    new_decisions: int
    updated_decisions: int
    unchanged_decisions: int
    conflicts_created: int = 0
    decisions: List[DecisionResponse]
