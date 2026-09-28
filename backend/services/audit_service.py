import uuid
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.db.models import AuditEvent
from backend.models.audit import AuditEventType, ActorType

logger = logging.getLogger(__name__)

class AuditService:
    @staticmethod
    def record_event(
        db: Session,
        event_type: str,
        title: str,
        description: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        source_document_id: Optional[str] = None,
        source_chunk_id: Optional[str] = None,
        decision_id: Optional[str] = None,
        conflict_id: Optional[str] = None,
        action_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        actor_type: str = ActorType.SYSTEM.value,
        actor_id: Optional[str] = None,
    ) -> AuditEvent:
        """
        Creates a single, immutable audit event record in the database.
        """
        # Safe JSON serialization
        metadata_json = None
        if metadata:
            try:
                metadata_json = json.dumps(metadata)
            except Exception as e:
                logger.warning(f"Failed to serialize audit metadata: {e}")
                metadata_json = "{}"
        
        event = AuditEvent(
            id=str(uuid.uuid4()),
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            title=title,
            description=description,
            source_document_id=source_document_id,
            source_chunk_id=source_chunk_id,
            decision_id=decision_id,
            conflict_id=conflict_id,
            action_id=action_id,
            metadata_json=metadata_json,
            actor_type=actor_type,
            actor_id=actor_id,
            created_at=datetime.utcnow()
        )
        
        db.add(event)
        # Flush to ensure it's available in the current transaction, but rely on 
        # the caller to commit their business state at the end.
        db.flush() 
        return event

    @staticmethod
    def list_events(
        db: Session,
        event_type: Optional[str] = None,
        entity_type: Optional[str] = None,
        document_id: Optional[str] = None,
        decision_id: Optional[str] = None,
        conflict_id: Optional[str] = None,
        action_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> tuple[int, list[AuditEvent]]:
        query = db.query(AuditEvent)
        
        if event_type:
            query = query.filter(AuditEvent.event_type == event_type)
        if entity_type:
            query = query.filter(AuditEvent.entity_type == entity_type)
        if document_id:
            query = query.filter(AuditEvent.source_document_id == document_id)
        if decision_id:
            query = query.filter(AuditEvent.decision_id == decision_id)
        if conflict_id:
            query = query.filter(AuditEvent.conflict_id == conflict_id)
        if action_id:
            query = query.filter(AuditEvent.action_id == action_id)
            
        total = query.count()
        events = query.order_by(desc(AuditEvent.created_at)).offset(offset).limit(limit).all()
        
        return total, events

    @staticmethod
    def get_event(db: Session, event_id: str) -> Optional[AuditEvent]:
        return db.query(AuditEvent).filter(AuditEvent.id == event_id).first()
