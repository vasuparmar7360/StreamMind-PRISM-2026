"""
conflict_detection_service.py
──────────────────────────────
Responsible for:
 1. Classifying a decision candidate against the current active decision.
 2. Creating, retrieving, and resolving persistent Conflict records.
 3. Supporting Ask OwnMind with open-conflict context.

Classification ladder (evaluated in order):
  ① same_value          → no action needed
  ② non_decision        → caller already filtered these out
  ③ explicit_replacement → delegate to DecisionMemoryService (normal lineage)
  ④ ambiguous_contradiction → CREATE CONFLICT (do NOT auto-resolve)
"""

import uuid
import datetime
import logging
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session

from backend.db.models import Conflict, Decision, Document
from backend.models.conflict import ConflictType, ConflictStatus, ConflictResolution
from backend.models.decision import DecisionStatus

logger = logging.getLogger(__name__)

# Keywords that indicate an explicit, authoritative replacement
EXPLICIT_REPLACEMENT_KEYWORDS = [
    "moved from", "replaced", "replace", "has been moved", "has been changed",
    "changed from", "switched from", "instead of", "rescheduled from",
    "postponed from", "superseded", "no longer", "deprecated",
]

# Keywords indicating suggestion / exploration — NOT a conflict
NON_DECISION_INDICATORS = [
    "being considered", "is considering", "are considering",
    "we are considering", "under consideration", "under discussion",
    "could possibly", "might possibly", "may possibly", "perhaps",
    "potential option", "exploring", "just an idea",
    "is popular", "is a database", "is a framework",
    "for example", "such as", "e.g.",
]


class ConflictDetectionService:
    # ── Classification ─────────────────────────────────────────────────────

    @staticmethod
    def is_suggestion(evidence_text: str) -> bool:
        """True when the text describes exploration/suggestion rather than a confirmed decision."""
        lowered = (evidence_text or "").lower()
        return any(kw in lowered for kw in NON_DECISION_INDICATORS)

    @staticmethod
    def is_explicit_replacement(
        evidence_text: str,
        replaces_previous: bool,
        previous_value: Optional[str],
        active_value: str,
    ) -> bool:
        """
        True when the candidate clearly declares it replaces an earlier decision.
        We require at least ONE of:
          • The extraction layer set replaces_previous=True
          • The previous_value matches the active decision value
          • Explicit replacement language appears in the evidence text
        """
        lowered = (evidence_text or "").lower()
        keyword_hit = any(kw in lowered for kw in EXPLICIT_REPLACEMENT_KEYWORDS)

        prev_match = (
            previous_value is not None
            and previous_value.strip().lower() in active_value.strip().lower()
        )

        return replaces_previous or prev_match or keyword_hit

    @staticmethod
    def classify(
        candidate_value: str,
        evidence_text: str,
        replaces_previous: bool,
        previous_value: Optional[str],
        active_decision: Optional[Decision],
    ) -> str:
        """
        Returns one of:
          same_value | suggestion | explicit_replacement | conflict
        """
        if not active_decision:
            return "new"   # No existing decision — simply create one

        active_val = active_decision.value.strip().lower()
        cand_val = candidate_value.strip().lower()

        if active_val == cand_val:
            return "same_value"

        if ConflictDetectionService.is_suggestion(evidence_text):
            return "suggestion"

        if ConflictDetectionService.is_explicit_replacement(
            evidence_text, replaces_previous, previous_value, active_decision.value
        ):
            return "explicit_replacement"

        return "conflict"

    # ── Conflict persistence ────────────────────────────────────────────────

    @staticmethod
    def open_conflict_exists(
        db: Session,
        normalized_topic: str,
        existing_decision_id: str,
        candidate_value: str,
        candidate_source_document_id: str,
    ) -> bool:
        """
        Idempotency guard: returns True when an identical open conflict already exists.
        Identity = same topic + same existing decision + same candidate value + same candidate doc.
        """
        existing = (
            db.query(Conflict)
            .filter(
                Conflict.normalized_topic == normalized_topic,
                Conflict.status == ConflictStatus.OPEN.value,
                Conflict.existing_decision_id == existing_decision_id,
                Conflict.candidate_value.ilike(candidate_value),
                Conflict.candidate_source_document_id == candidate_source_document_id,
            )
            .first()
        )
        return existing is not None

    @staticmethod
    def create_conflict(
        db: Session,
        normalized_topic: str,
        conflict_type: str,
        existing_decision: Decision,
        candidate_value: str,
        candidate_source_document_id: str,
        candidate_source_chunk_id: Optional[str],
        candidate_reason: Optional[str],
        candidate_evidence_text: Optional[str],
        candidate_source_date: Optional[str],
    ) -> Conflict:
        """
        Persists a new open Conflict.
        Caller must commit() after this call.
        """
        # Idempotency: skip if an identical open conflict already exists
        if ConflictDetectionService.open_conflict_exists(
            db,
            normalized_topic=normalized_topic,
            existing_decision_id=existing_decision.id,
            candidate_value=candidate_value,
            candidate_source_document_id=candidate_source_document_id,
        ):
            # Return the existing conflict
            existing = (
                db.query(Conflict)
                .filter(
                    Conflict.normalized_topic == normalized_topic,
                    Conflict.status == ConflictStatus.OPEN.value,
                    Conflict.existing_decision_id == existing_decision.id,
                    Conflict.candidate_value.ilike(candidate_value),
                    Conflict.candidate_source_document_id == candidate_source_document_id,
                )
                .first()
            )
            logger.info(
                f"Idempotent conflict: open conflict for '{normalized_topic}' "
                f"(existing={existing_decision.value!r}, candidate={candidate_value!r}) already exists."
            )
            return existing

        conflict = Conflict(
            id=str(uuid.uuid4()),
            normalized_topic=normalized_topic,
            status=ConflictStatus.OPEN.value,
            conflict_type=conflict_type,
            existing_decision_id=existing_decision.id,
            existing_value=existing_decision.value,
            existing_source_document_id=existing_decision.source_document_id,
            candidate_value=candidate_value,
            candidate_source_document_id=candidate_source_document_id,
            candidate_source_chunk_id=candidate_source_chunk_id,
            candidate_reason=candidate_reason,
            candidate_evidence_text=candidate_evidence_text,
            candidate_source_date=candidate_source_date,
            created_at=datetime.datetime.utcnow(),
        )
        db.add(conflict)
        db.flush()
        
        from backend.services.audit_service import AuditService
        from backend.models.audit import AuditEventType
        AuditService.record_event(
            db=db,
            event_type=AuditEventType.CONFLICT_DETECTED.value,
            title=f"Conflict Detected: {existing_decision.topic}",
            entity_type="conflict",
            entity_id=conflict.id,
            source_document_id=candidate_source_document_id,
            decision_id=existing_decision.id,
            conflict_id=conflict.id,
            metadata={
                "topic": existing_decision.topic,
                "existing_value": existing_decision.value,
                "candidate_value": candidate_value
            }
        )
        
        logger.info(
            f"Created open conflict for '{normalized_topic}': "
            f"existing={existing_decision.value!r} vs candidate={candidate_value!r}"
        )
        return conflict

    # ── Retrieval ───────────────────────────────────────────────────────────

    @staticmethod
    def get_conflicts(
        db: Session,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        query = db.query(Conflict)
        if status:
            query = query.filter(Conflict.status == status)
        conflicts = query.order_by(Conflict.created_at.desc()).all()
        return [ConflictDetectionService._format_list_item(c) for c in conflicts]

    @staticmethod
    def get_conflict_detail(db: Session, conflict_id: str) -> Optional[Dict[str, Any]]:
        conflict = db.query(Conflict).filter(Conflict.id == conflict_id).first()
        if not conflict:
            return None
        return ConflictDetectionService._format_detail(conflict)

    @staticmethod
    def count_open_conflicts(db: Session) -> int:
        return db.query(Conflict).filter(Conflict.status == ConflictStatus.OPEN.value).count()

    @staticmethod
    def get_open_conflicts_for_topic(
        db: Session, normalized_topic: str
    ) -> List[Conflict]:
        return (
            db.query(Conflict)
            .filter(
                Conflict.normalized_topic == normalized_topic,
                Conflict.status == ConflictStatus.OPEN.value,
            )
            .all()
        )

    # ── Resolution ──────────────────────────────────────────────────────────

    @staticmethod
    def resolve_conflict(
        db: Session,
        conflict_id: str,
        resolution: str,
        resolution_note: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Atomically resolves a conflict.

        accept_candidate:
          - existing_decision  → status = REPLACED
          - new Decision created as ACTIVE (supersedes existing)
          - conflict.resolution_decision_id = new Decision id
          - conflict.status = resolved

        keep_existing:
          - No decision changes
          - conflict.status = resolved

        dismiss:
          - No decision changes
          - conflict.status = dismissed
        """
        conflict = db.query(Conflict).filter(Conflict.id == conflict_id).first()
        if not conflict:
            return {"error": "not_found"}
        if conflict.status != ConflictStatus.OPEN.value:
            return {"error": "already_resolved", "status": conflict.status}

        resolution_decision_id = None

        try:
            if resolution == ConflictResolution.ACCEPT_CANDIDATE.value:
                # Fetch the existing (active) decision
                existing_dec = (
                    db.query(Decision)
                    .filter(Decision.id == conflict.existing_decision_id)
                    .first()
                ) if conflict.existing_decision_id else None

                # Mark existing as REPLACED
                if existing_dec and existing_dec.status == DecisionStatus.ACTIVE.value:
                    existing_dec.status = DecisionStatus.REPLACED.value
                    existing_dec.updated_at = datetime.datetime.utcnow()

                # Create new active decision for the candidate
                new_dec = Decision(
                    id=str(uuid.uuid4()),
                    topic=existing_dec.topic if existing_dec else conflict.normalized_topic,
                    normalized_topic=conflict.normalized_topic,
                    value=conflict.candidate_value,
                    status=DecisionStatus.ACTIVE.value,
                    reason=(
                        conflict.candidate_reason
                        or f"Resolved conflict: accepted '{conflict.candidate_value}' "
                           f"over '{conflict.existing_value}'"
                    ),
                    source_document_id=conflict.candidate_source_document_id,
                    source_chunk_id=conflict.candidate_source_chunk_id,
                    source_date=conflict.candidate_source_date,
                    supersedes_decision_id=existing_dec.id if existing_dec else None,
                    created_at=datetime.datetime.utcnow(),
                    updated_at=datetime.datetime.utcnow(),
                )
                db.add(new_dec)
                db.flush()
                resolution_decision_id = new_dec.id

                conflict.status = ConflictStatus.RESOLVED.value
                conflict.resolution = ConflictResolution.ACCEPT_CANDIDATE.value
                conflict.resolution_note = resolution_note or f"Candidate '{conflict.candidate_value}' accepted by user."
                conflict.resolution_decision_id = new_dec.id
                conflict.resolved_at = datetime.datetime.utcnow()

            elif resolution == ConflictResolution.KEEP_EXISTING.value:
                conflict.status = ConflictStatus.RESOLVED.value
                conflict.resolution = ConflictResolution.KEEP_EXISTING.value
                conflict.resolution_note = resolution_note or f"Existing decision '{conflict.existing_value}' kept by user."
                conflict.resolved_at = datetime.datetime.utcnow()

            elif resolution == ConflictResolution.DISMISS.value:
                conflict.status = ConflictStatus.DISMISSED.value
                conflict.resolution = ConflictResolution.DISMISS.value
                conflict.resolution_note = resolution_note or "Conflict dismissed by user."
                conflict.resolved_at = datetime.datetime.utcnow()

            else:
                return {"error": "invalid_resolution"}

            db.commit()
            
            from backend.services.audit_service import AuditService
            from backend.models.audit import AuditEventType
            
            event_type = AuditEventType.CONFLICT_RESOLVED.value if conflict.status == ConflictStatus.RESOLVED.value else AuditEventType.CONFLICT_DISMISSED.value
            
            AuditService.record_event(
                db=db,
                event_type=event_type,
                title=f"Conflict {conflict.status.capitalize()}: {conflict.normalized_topic}",
                entity_type="conflict",
                entity_id=conflict.id,
                conflict_id=conflict.id,
                decision_id=conflict.resolution_decision_id or conflict.existing_decision_id,
                metadata={
                    "resolution": resolution,
                    "resolution_note": conflict.resolution_note
                }
            )
            db.commit()

        except Exception as e:
            db.rollback()
            logger.error(f"Failed to resolve conflict {conflict_id}: {e}")
            raise e

        return {
            "id": conflict.id,
            "status": conflict.status,
            "resolution": conflict.resolution,
            "resolution_decision_id": resolution_decision_id,
            "message": conflict.resolution_note,
        }

    # ── Ask OwnMind conflict context ────────────────────────────────────────

    @staticmethod
    def build_conflict_warning(conflicts: List[Conflict]) -> str:
        """
        Builds a human-readable conflict notice to prepend to Ask OwnMind answers.
        Called when at least one open conflict is relevant to the question topic.
        """
        if not conflicts:
            return ""
        lines = [
            "⚠️  OPEN CONFLICT — human review required before accepting any single answer.\n"
        ]
        for c in conflicts:
            existing_doc = (
                c.existing_source_document.original_name
                if c.existing_source_document
                else "unknown source"
            )
            cand_doc = (
                c.candidate_source_document.original_name
                if c.candidate_source_document
                else "unknown source"
            )
            lines.append(
                f"  • One source ({existing_doc}) records: \"{c.existing_value}\"\n"
                f"  • Another source ({cand_doc}) records: \"{c.candidate_value}\"\n"
                f"    Conflict type: {c.conflict_type.replace('_', ' ')}\n"
            )
        return "\n".join(lines)

    # ── Formatters ──────────────────────────────────────────────────────────

    @staticmethod
    def _format_list_item(c: Conflict) -> Dict[str, Any]:
        existing_dec = c.existing_decision
        topic = existing_dec.topic if existing_dec else c.normalized_topic
        return {
            "id": c.id,
            "topic": topic,
            "normalized_topic": c.normalized_topic,
            "status": c.status,
            "conflict_type": c.conflict_type,
            "existing_value": c.existing_value,
            "candidate_value": c.candidate_value,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }

    @staticmethod
    def _format_detail(c: Conflict) -> Dict[str, Any]:
        existing_dec = c.existing_decision
        topic = existing_dec.topic if existing_dec else c.normalized_topic

        existing_doc_name = (
            c.existing_source_document.original_name
            if c.existing_source_document
            else "Unknown"
        )
        cand_doc_name = (
            c.candidate_source_document.original_name
            if c.candidate_source_document
            else "Unknown"
        )

        return {
            "id": c.id,
            "topic": topic,
            "normalized_topic": c.normalized_topic,
            "status": c.status,
            "conflict_type": c.conflict_type,
            "existing": {
                "value": c.existing_value,
                "decision_id": c.existing_decision_id,
                "source_document": existing_doc_name,
                "source_document_id": c.existing_source_document_id,
                "source_date": existing_dec.source_date if existing_dec else None,
            },
            "candidate": {
                "value": c.candidate_value,
                "source_document": cand_doc_name,
                "source_document_id": c.candidate_source_document_id,
                "source_chunk_id": c.candidate_source_chunk_id,
                "reason": c.candidate_reason,
                "evidence_text": c.candidate_evidence_text,
                "source_date": c.candidate_source_date,
            },
            "resolution": c.resolution,
            "resolution_note": c.resolution_note,
            "resolution_decision_id": c.resolution_decision_id,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
        }
