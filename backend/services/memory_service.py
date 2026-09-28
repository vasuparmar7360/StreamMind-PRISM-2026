from sqlalchemy.orm import Session
from sqlalchemy import func
import json
from typing import Dict, Any, List
from datetime import datetime

from backend.db.models import (
    Document, DocumentChunk, Decision, Conflict, ActionProposal, AuditEvent
)
from backend.models.memory import (
    MemorySummaryResponse, MemoryInventoryResponse, TraceableDecision, ProjectMemoryExportResponse
)
from backend.models.conflict import ConflictStatus
from backend.models.decision import DecisionStatus

class MemoryService:
    @staticmethod
    def get_summary(db: Session) -> MemorySummaryResponse:
        docs_uploaded = db.query(func.count(Document.id)).scalar() or 0
        docs_indexed = db.query(func.count(Document.id)).filter(Document.status == "indexed").scalar() or 0
        total_chunks = db.query(func.count(DocumentChunk.id)).scalar() or 0
        
        active_decisions = db.query(func.count(Decision.id)).filter(Decision.status == DecisionStatus.ACTIVE.value).scalar() or 0
        replaced_decisions = db.query(func.count(Decision.id)).filter(Decision.status == DecisionStatus.REPLACED.value).scalar() or 0
        # Ambiguous could be ambiguous conflicts or decisions. Let's count unresolvable or specific decisions if any, 
        # or maybe we just count open conflicts with "ambiguous_contradiction" or decisions in "archived" status. 
        # We'll just count Decisions where status is 'archived' for ambiguous, or conflicts with type ambiguous_contradiction.
        # Actually, ambiguous_decisions might refer to something else. We'll set it to 0 for now as it wasn't strictly defined, or we can use open conflicts.
        ambiguous_decisions = 0
        
        open_conflicts = db.query(func.count(Conflict.id)).filter(Conflict.status == ConflictStatus.OPEN.value).scalar() or 0
        
        pending_actions = db.query(func.count(ActionProposal.id)).filter(ActionProposal.status == "pending").scalar() or 0
        executed_actions = db.query(func.count(ActionProposal.id)).filter(ActionProposal.status == "executed").scalar() or 0
        
        audit_events = db.query(func.count(AuditEvent.id)).scalar() or 0

        return MemorySummaryResponse(
            documents_uploaded=docs_uploaded,
            documents_indexed=docs_indexed,
            total_chunks=total_chunks,
            active_decisions=active_decisions,
            replaced_decisions=replaced_decisions,
            ambiguous_decisions=ambiguous_decisions,
            open_conflicts=open_conflicts,
            pending_actions=pending_actions,
            executed_actions=executed_actions,
            audit_events=audit_events
        )

    @staticmethod
    def get_inventory(db: Session, limit: int = 50, offset: int = 0) -> MemoryInventoryResponse:
        documents = []
        docs = db.query(Document).order_by(Document.created_at.desc()).limit(limit).offset(offset).all()
        for d in docs:
            documents.append({
                "id": d.id,
                "original_name": d.original_name,
                "status": d.status,
                "created_at": d.created_at.isoformat()
            })
            
        def _to_traceable(decision: Decision) -> TraceableDecision:
            return TraceableDecision(
                id=decision.id,
                topic=decision.topic,
                value=decision.value,
                status=decision.status,
                reason=decision.reason,
                source_document=decision.source_document.original_name if decision.source_document else None,
                source_document_id=decision.source_document_id,
                source_chunk_id=decision.source_chunk_id,
                source_date=decision.source_date
            )

        active_decisions = [_to_traceable(d) for d in db.query(Decision).filter(Decision.status == DecisionStatus.ACTIVE.value).order_by(Decision.created_at.desc()).limit(limit).offset(offset).all()]
        historical_decisions = [_to_traceable(d) for d in db.query(Decision).filter(Decision.status != DecisionStatus.ACTIVE.value).order_by(Decision.created_at.desc()).limit(limit).offset(offset).all()]
        
        open_conflicts = []
        conflicts = db.query(Conflict).filter(Conflict.status == ConflictStatus.OPEN.value).order_by(Conflict.created_at.desc()).limit(limit).offset(offset).all()
        for c in conflicts:
            open_conflicts.append({
                "id": c.id,
                "topic": c.normalized_topic,
                "existing_value": c.existing_value,
                "candidate_value": c.candidate_value,
                "created_at": c.created_at.isoformat()
            })
            
        pending_actions = []
        actions = db.query(ActionProposal).filter(ActionProposal.status == "pending").order_by(ActionProposal.created_at.desc()).limit(limit).offset(offset).all()
        for a in actions:
            pending_actions.append({
                "id": a.id,
                "title": a.title,
                "action_type": a.action_type,
                "risk_level": a.risk_level,
                "created_at": a.created_at.isoformat()
            })
            
        return MemoryInventoryResponse(
            documents=documents,
            active_decisions=active_decisions,
            historical_decisions=historical_decisions,
            open_conflicts=open_conflicts,
            pending_actions=pending_actions
        )

    @staticmethod
    def export_memory(db: Session, settings_data: Dict[str, Any]) -> ProjectMemoryExportResponse:
        memory = {
            "documents": [],
            "decisions": [],
            "conflicts": [],
            "actions": [],
            "audit_events": []
        }
        
        for d in db.query(Document).all():
            memory["documents"].append({
                "id": d.id,
                "original_name": d.original_name,
                "extension": d.extension,
                "status": d.status,
                "size_bytes": d.size_bytes,
                "created_at": d.created_at.isoformat()
            })
            
        for d in db.query(Decision).all():
            memory["decisions"].append({
                "id": d.id,
                "topic": d.topic,
                "value": d.value,
                "status": d.status,
                "reason": d.reason,
                "source_document_id": d.source_document_id,
                "source_chunk_id": d.source_chunk_id,
                "supersedes_decision_id": d.supersedes_decision_id,
                "created_at": d.created_at.isoformat()
            })
            
        for c in db.query(Conflict).all():
            memory["conflicts"].append({
                "id": c.id,
                "topic": c.normalized_topic,
                "status": c.status,
                "conflict_type": c.conflict_type,
                "existing_value": c.existing_value,
                "candidate_value": c.candidate_value,
                "resolution": c.resolution,
                "created_at": c.created_at.isoformat()
            })
            
        for a in db.query(ActionProposal).all():
            memory["actions"].append({
                "id": a.id,
                "action_type": a.action_type,
                "title": a.title,
                "status": a.status,
                "execution_status": a.execution_status,
                "risk_level": a.risk_level,
                "created_at": a.created_at.isoformat()
            })
            
        for e in db.query(AuditEvent).all():
            memory["audit_events"].append({
                "id": e.id,
                "event_type": e.event_type,
                "entity_type": e.entity_type,
                "entity_id": e.entity_id,
                "title": e.title,
                "created_at": e.created_at.isoformat(),
                "actor_type": e.actor_type
            })

        return ProjectMemoryExportResponse(
            product="OwnMind AI",
            export_version="1.0",
            created_at=datetime.utcnow().isoformat(),
            memory=memory,
            settings=settings_data
        )

    @staticmethod
    def check_dependencies(db: Session, document_id: str) -> Dict[str, Any]:
        active_decisions = db.query(Decision).filter(
            Decision.source_document_id == document_id,
            Decision.status == DecisionStatus.ACTIVE.value
        ).all()
        
        conflicts = db.query(Conflict).filter(
            (Conflict.existing_source_document_id == document_id) |
            (Conflict.candidate_source_document_id == document_id)
        ).all()
        
        actions = db.query(ActionProposal).filter(
            ActionProposal.source_document_id == document_id
        ).all()
        
        deps = {
            "active_decisions": [{"id": d.id, "topic": d.topic} for d in active_decisions],
            "conflicts": [{"id": c.id, "topic": c.normalized_topic} for c in conflicts],
            "actions": [{"id": a.id, "title": a.title} for a in actions]
        }
        
        total_deps = len(deps["active_decisions"]) + len(deps["conflicts"]) + len(deps["actions"])
        return {
            "status": "requires_confirmation" if total_deps > 0 else "clear",
            "dependencies": deps
        }
