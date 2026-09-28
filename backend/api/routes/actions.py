import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from backend.db.session import get_db
from backend.db.models import ActionProposal, Decision
from backend.models.action import (
    ActionProposalResponse, ActionProposalListResponse, 
    ProposeActionRequest, ActionRejectionRequest,
    ActionStatus, ExecutionStatus, ActionType
)
from backend.services.action_proposal_service import ActionProposalService
from backend.services.local_tool_service import LocalToolService

router = APIRouter(prefix="/actions", tags=["actions"])

@router.post("/propose", response_model=ActionProposalResponse)
async def propose_action(req: ProposeActionRequest, db: Session = Depends(get_db)):
    """Proposes an action based on a decision."""
    proposal = await ActionProposalService.propose_action_from_decision(db, req.decision_id)
    if not proposal:
        raise HTTPException(status_code=400, detail="No action warranted for this decision.")
    return proposal

@router.get("", response_model=ActionProposalListResponse)
def get_actions(status: Optional[str] = None, db: Session = Depends(get_db)):
    """Lists actions, optionally filtering by status."""
    query = db.query(ActionProposal)
    if status:
        query = query.filter(ActionProposal.status == status)
        
    actions = query.order_by(ActionProposal.created_at.desc()).all()
    
    responses = []
    for a in actions:
        responses.append(ActionProposalResponse(
            id=a.id,
            action_type=a.action_type,
            title=a.title,
            description=a.description,
            payload=json.loads(a.payload_json),
            status=a.status,
            risk_level=a.risk_level,
            execution_status=a.execution_status,
            execution_result=json.loads(a.execution_result) if a.execution_result else None,
            source_decision_id=a.source_decision_id,
            source_document_id=a.source_document_id,
            source_chunk_id=a.source_chunk_id,
            created_at=a.created_at,
            approved_at=a.approved_at,
            rejected_at=a.rejected_at,
            executed_at=a.executed_at
        ))
        
    return ActionProposalListResponse(total=len(responses), actions=responses)

@router.get("/{action_id}", response_model=ActionProposalResponse)
def get_action(action_id: str, db: Session = Depends(get_db)):
    """Get detail of a specific action proposal."""
    a = db.query(ActionProposal).filter(ActionProposal.id == action_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Action not found.")
        
    return ActionProposalResponse(
        id=a.id,
        action_type=a.action_type,
        title=a.title,
        description=a.description,
        payload=json.loads(a.payload_json),
        status=a.status,
        risk_level=a.risk_level,
        execution_status=a.execution_status,
        execution_result=json.loads(a.execution_result) if a.execution_result else None,
        source_decision_id=a.source_decision_id,
        source_document_id=a.source_document_id,
        source_chunk_id=a.source_chunk_id,
        created_at=a.created_at,
        approved_at=a.approved_at,
        rejected_at=a.rejected_at,
        executed_at=a.executed_at
    )

@router.post("/{action_id}/approve", response_model=ActionProposalResponse)
def approve_action(action_id: str, db: Session = Depends(get_db)):
    """Explicitly approve an action proposal."""
    a = db.query(ActionProposal).filter(ActionProposal.id == action_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Action not found.")
        
    if a.status != ActionStatus.PENDING.value:
        raise HTTPException(status_code=400, detail=f"Cannot approve action in status '{a.status}'")
        
    a.status = ActionStatus.APPROVED.value
    a.approved_at = datetime.utcnow()
    
    from backend.services.audit_service import AuditService
    from backend.models.audit import AuditEventType, ActorType
    
    AuditService.record_event(
        db=db,
        event_type=AuditEventType.ACTION_APPROVED.value,
        title=f"Action Approved: {a.title}",
        entity_type="action",
        entity_id=a.id,
        action_id=a.id,
        decision_id=a.source_decision_id,
        source_document_id=a.source_document_id,
        actor_type=ActorType.USER.value,
        actor_id="local_user",
        metadata={
            "action_type": a.action_type,
            "approved_payload": json.loads(a.payload_json)
        }
    )
    
    db.commit()
    return get_action(action_id, db)

@router.post("/{action_id}/reject", response_model=ActionProposalResponse)
def reject_action(action_id: str, req: ActionRejectionRequest, db: Session = Depends(get_db)):
    """Explicitly reject an action proposal."""
    a = db.query(ActionProposal).filter(ActionProposal.id == action_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Action not found.")
        
    if a.status != ActionStatus.PENDING.value:
        raise HTTPException(status_code=400, detail=f"Cannot reject action in status '{a.status}'")
        
    a.status = ActionStatus.REJECTED.value
    a.rejected_at = datetime.utcnow()
    
    from backend.services.audit_service import AuditService
    from backend.models.audit import AuditEventType, ActorType
    
    AuditService.record_event(
        db=db,
        event_type=AuditEventType.ACTION_REJECTED.value,
        title=f"Action Rejected: {a.title}",
        entity_type="action",
        entity_id=a.id,
        action_id=a.id,
        decision_id=a.source_decision_id,
        source_document_id=a.source_document_id,
        actor_type=ActorType.USER.value,
        actor_id="local_user",
        metadata={
            "reason": req.reason
        }
    )
    
    db.commit()
    return get_action(action_id, db)

@router.post("/{action_id}/execute", response_model=ActionProposalResponse)
def execute_action(action_id: str, db: Session = Depends(get_db)):
    """Execute an approved action safely locally."""
    a = db.query(ActionProposal).filter(ActionProposal.id == action_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Action not found.")
        
    if a.status == ActionStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Action requires user approval before execution.")
        
    if a.status == ActionStatus.REJECTED.value:
        raise HTTPException(status_code=400, detail="Rejected actions cannot be executed.")
        
    if a.status == ActionStatus.EXECUTED.value:
        raise HTTPException(status_code=400, detail="Action already executed.")
        
    if a.status != ActionStatus.APPROVED.value:
        raise HTTPException(status_code=400, detail=f"Action must be approved. Current status: {a.status}")

    # Safety: re-validate with policy (conflict safety)
    if a.action_type != ActionType.EXTRACTED_TASK.value:
        decision = db.query(Decision).filter(Decision.id == a.source_decision_id).first()
        if not decision:
            raise HTTPException(status_code=400, detail="Source decision missing.")
            
        from backend.services.action_policy_service import ActionPolicyService
        try:
            ActionPolicyService.validate_proposal(
                db=db,
                action_type=a.action_type,
                payload=json.loads(a.payload_json),
                risk_level=a.risk_level,
                decision=decision
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Policy violation: {e}")

    from backend.services.audit_service import AuditService
    from backend.models.audit import AuditEventType
    
    AuditService.record_event(
        db=db,
        event_type=AuditEventType.ACTION_EXECUTION_STARTED.value,
        title=f"Action Execution Started: {a.title}",
        entity_type="action",
        entity_id=a.id,
        action_id=a.id,
        decision_id=a.source_decision_id,
        source_document_id=a.source_document_id
    )
    db.commit()

    # Execute locally
    payload = json.loads(a.payload_json)
    try:
        if a.action_type == ActionType.CREATE_TASK.value:
            res = LocalToolService.execute_create_task(a.id, payload)
        elif a.action_type == ActionType.SAVE_BRIEF.value:
            res = LocalToolService.execute_save_brief(a.id, payload)
        elif a.action_type == ActionType.EXTRACTED_TASK.value:
            res = {"status": "success", "message": f"Task '{a.title}' marked as executed."}
        else:
            raise ValueError(f"Unknown action type '{a.action_type}'")
            
        a.status = ActionStatus.EXECUTED.value
        a.executed_at = datetime.utcnow()
        a.execution_status = ExecutionStatus.SUCCESS.value
        a.execution_result = json.dumps({"status": "executed", "execution_status": "success", "result": res})
        
        AuditService.record_event(
            db=db,
            event_type=AuditEventType.ACTION_EXECUTED.value,
            title=f"Action Executed Successfully: {a.title}",
            entity_type="action",
            entity_id=a.id,
            action_id=a.id,
            decision_id=a.source_decision_id,
            source_document_id=a.source_document_id,
            metadata={"result": res}
        )
        
    except FileExistsError as e:
        raise HTTPException(status_code=400, detail="Action already executed.")
    except Exception as e:
        a.execution_status = ExecutionStatus.FAILED.value
        a.execution_result = json.dumps({"status": "failed", "execution_status": "failed", "error": str(e)})
        
        AuditService.record_event(
            db=db,
            event_type=AuditEventType.ACTION_FAILED.value,
            title=f"Action Execution Failed: {a.title}",
            entity_type="action",
            entity_id=a.id,
            action_id=a.id,
            decision_id=a.source_decision_id,
            source_document_id=a.source_document_id,
            metadata={"error": str(e)}
        )
        db.commit()
        raise HTTPException(status_code=500, detail=f"Tool execution failed: {e}")
        
    db.commit()
    return get_action(action_id, db)
