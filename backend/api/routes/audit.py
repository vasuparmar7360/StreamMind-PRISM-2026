from fastapi import APIRouter, Depends, Query, HTTPException, Path as FastAPIPath
from sqlalchemy.orm import Session
from typing import Optional

from backend.db.session import get_db
from backend.services.audit_service import AuditService
from backend.models.audit import AuditEventResponse, AuditEventListResponse
import json

router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("", response_model=AuditEventListResponse)
def get_audit_events(
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    document_id: Optional[str] = Query(None, description="Filter by document id"),
    decision_id: Optional[str] = Query(None, description="Filter by decision id"),
    conflict_id: Optional[str] = Query(None, description="Filter by conflict id"),
    action_id: Optional[str] = Query(None, description="Filter by action id"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Get paginated and filtered audit events.
    """
    total, events = AuditService.list_events(
        db=db,
        event_type=event_type,
        entity_type=entity_type,
        document_id=document_id,
        decision_id=decision_id,
        conflict_id=conflict_id,
        action_id=action_id,
        limit=limit,
        offset=offset
    )
    
    response_events = []
    for e in events:
        response_events.append(
            AuditEventResponse(
                id=e.id,
                event_type=e.event_type,
                entity_type=e.entity_type,
                entity_id=e.entity_id,
                title=e.title,
                description=e.description,
                source_document_id=e.source_document_id,
                source_chunk_id=e.source_chunk_id,
                decision_id=e.decision_id,
                conflict_id=e.conflict_id,
                action_id=e.action_id,
                metadata_json=json.loads(e.metadata_json) if e.metadata_json else None,
                created_at=e.created_at,
                actor_type=e.actor_type,
                actor_id=e.actor_id
            )
        )
        
    return AuditEventListResponse(total=total, events=response_events)

@router.get("/{event_id}", response_model=AuditEventResponse)
def get_audit_event(
    event_id: str = FastAPIPath(...),
    db: Session = Depends(get_db)
):
    """
    Get details of a single audit event.
    """
    e = AuditService.get_event(db, event_id)
    if not e:
        raise HTTPException(status_code=404, detail="Audit event not found")
        
    return AuditEventResponse(
        id=e.id,
        event_type=e.event_type,
        entity_type=e.entity_type,
        entity_id=e.entity_id,
        title=e.title,
        description=e.description,
        source_document_id=e.source_document_id,
        source_chunk_id=e.source_chunk_id,
        decision_id=e.decision_id,
        conflict_id=e.conflict_id,
        action_id=e.action_id,
        metadata_json=json.loads(e.metadata_json) if e.metadata_json else None,
        created_at=e.created_at,
        actor_type=e.actor_type,
        actor_id=e.actor_id
    )
