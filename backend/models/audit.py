from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class AuditEventType(str, Enum):
    DOCUMENT_UPLOADED = "document_uploaded"
    DOCUMENT_INDEX_STARTED = "document_index_started"
    DOCUMENT_INDEXED = "document_indexed"
    DOCUMENT_INDEX_FAILED = "document_index_failed"
    DECISION_CREATED = "decision_created"
    DECISION_REPLACED = "decision_replaced"
    DECISION_UNCHANGED = "decision_unchanged"
    CONFLICT_DETECTED = "conflict_detected"
    CONFLICT_RESOLVED = "conflict_resolved"
    CONFLICT_DISMISSED = "conflict_dismissed"
    ACTION_PROPOSED = "action_proposed"
    ACTION_APPROVED = "action_approved"
    ACTION_REJECTED = "action_rejected"
    ACTION_EXECUTION_STARTED = "action_execution_started"
    ACTION_EXECUTED = "action_executed"
    ACTION_FAILED = "action_failed"

class ActorType(str, Enum):
    SYSTEM = "system"
    AI = "ai"
    USER = "user"

class AuditEventResponse(BaseModel):
    id: str
    event_type: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    source_document_id: Optional[str] = None
    source_chunk_id: Optional[str] = None
    decision_id: Optional[str] = None
    conflict_id: Optional[str] = None
    action_id: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    actor_type: str
    actor_id: Optional[str] = None

    class Config:
        from_attributes = True

class AuditEventListResponse(BaseModel):
    total: int
    events: List[AuditEventResponse]
