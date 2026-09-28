import uuid
import json
import logging
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from backend.db.models import Decision, ActionProposal
from backend.models.action import ActionProposalResponse, ActionStatus, QwenActionProposal
from backend.services.llm_service import LLMService
from backend.services.action_policy_service import ActionPolicyService

logger = logging.getLogger(__name__)

class ActionProposalService:
    @staticmethod
    async def propose_action_from_decision(db: Session, decision_id: str) -> Optional[ActionProposalResponse]:
        """
        Generates an action proposal from a decision using the local LLM,
        validates it against policy, and persists it as pending.
        """
        decision = db.query(Decision).filter(Decision.id == decision_id).first()
        if not decision:
            raise HTTPException(status_code=404, detail="Decision not found.")
            
        try:
            ActionPolicyService.check_preconditions(db, decision)
        except ValueError as e:
            logger.warning(f"Precondition failed for action proposal: {e}")
            raise HTTPException(status_code=400, detail=str(e))
            
        decision_text = f"{decision.topic} = {decision.value}"
        
        # Ask LLM
        json_resp = await LLMService.generate_structured_action(decision_text, decision.reason)
        
        try:
            qwen_data = json.loads(json_resp)
            proposal = QwenActionProposal(**qwen_data)
        except Exception as e:
            logger.error(f"Failed to parse or validate LLM JSON: {e}")
            raise HTTPException(status_code=500, detail="LLM returned invalid action structure.")
            
        if not proposal.should_propose_action:
            return None
            
        # Validate through policy
        try:
            ActionPolicyService.validate_proposal(
                db=db,
                action_type=proposal.action_type,
                payload=proposal.payload,
                risk_level=proposal.risk_level,
                decision=decision
            )
        except ValueError as e:
            logger.warning(f"Policy validation failed for action proposal: {e}")
            raise HTTPException(status_code=400, detail=str(e))
            
        # Persist action
        action_id = str(uuid.uuid4())
        action_record = ActionProposal(
            id=action_id,
            action_type=proposal.action_type,
            title=proposal.title,
            description=proposal.description,
            payload_json=json.dumps(proposal.payload),
            risk_level=proposal.risk_level,
            status=ActionStatus.PENDING.value,
            source_decision_id=decision.id,
            source_document_id=decision.source_document_id,
            source_chunk_id=decision.source_chunk_id
        )
        
        db.add(action_record)
        db.commit()
        db.refresh(action_record)
        
        from backend.services.audit_service import AuditService
        from backend.models.audit import AuditEventType
        AuditService.record_event(
            db=db,
            event_type=AuditEventType.ACTION_PROPOSED.value,
            title=f"Action Proposed: {proposal.title}",
            entity_type="action",
            entity_id=action_id,
            action_id=action_id,
            decision_id=decision.id,
            source_document_id=decision.source_document_id,
            metadata={
                "action_type": proposal.action_type,
                "risk_level": proposal.risk_level
            }
        )
        db.commit()
        
        # Transform for response
        return ActionProposalResponse(
            id=action_record.id,
            action_type=action_record.action_type,
            title=action_record.title,
            description=action_record.description,
            payload=json.loads(action_record.payload_json),
            status=action_record.status,
            risk_level=action_record.risk_level,
            execution_status=action_record.execution_status,
            execution_result=json.loads(action_record.execution_result) if action_record.execution_result else None,
            source_decision_id=action_record.source_decision_id,
            source_document_id=action_record.source_document_id,
            source_chunk_id=action_record.source_chunk_id,
            created_at=action_record.created_at,
            approved_at=action_record.approved_at,
            rejected_at=action_record.rejected_at,
            executed_at=action_record.executed_at
        )
