from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class ActionType(str, Enum):
    CREATE_TASK = "create_task"
    SAVE_BRIEF = "save_brief"
    EXTRACTED_TASK = "extracted_task"

class ActionStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTED = "executed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class ExecutionStatus(str, Enum):
    NOT_STARTED = "not_started"
    SUCCESS = "success"
    FAILED = "failed"

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class ActionProposalBase(BaseModel):
    action_type: ActionType
    title: str
    description: str
    payload: Dict[str, Any]
    risk_level: RiskLevel

class ActionProposalCreate(ActionProposalBase):
    source_decision_id: Optional[str] = None
    source_document_id: Optional[str] = None
    source_chunk_id: Optional[str] = None

class ActionProposalResponse(ActionProposalBase):
    id: str
    status: ActionStatus
    execution_status: ExecutionStatus
    execution_result: Optional[Dict[str, Any]] = None
    
    source_decision_id: Optional[str]
    source_document_id: Optional[str]
    source_chunk_id: Optional[str]

    created_at: datetime
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ActionProposalListResponse(BaseModel):
    total: int
    actions: List[ActionProposalResponse]

class ProposeActionRequest(BaseModel):
    decision_id: str

class QwenActionProposal(BaseModel):
    should_propose_action: bool
    action_type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    risk_level: Optional[str] = None

class ActionRejectionRequest(BaseModel):
    reason: Optional[str] = None
