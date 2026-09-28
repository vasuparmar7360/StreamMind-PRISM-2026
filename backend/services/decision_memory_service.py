import re
import uuid
import datetime
import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from backend.db.models import Decision, Document, DocumentChunk
from backend.models.decision import DecisionCandidate, DecisionStatus
from backend.models.conflict import ConflictType

logger = logging.getLogger(__name__)

EXPLICIT_REPLACEMENT_KEYWORDS = [
    "moved from", "replaced", "replace", "has been moved", "has been changed",
    "changed from", "switched from", "instead of", "rescheduled from",
    "postponed from", "superseded", "no longer", "deprecated",
]


class DecisionMemoryService:
    @staticmethod
    def normalize_topic(topic: str) -> str:
        """
        Conservatively normalizes decision topics to identify shared project decisions.
        Prefers false separation over false merging.
        """
        cleaned = topic.strip().lower()
        cleaned = re.sub(r"[:\-_\s]+", " ", cleaned).strip()

        if any(term in cleaned for term in ["demo date", "final demo schedule", "presentation date", "demo schedule"]):
            return "demo_date"
        if any(term in cleaned for term in ["backend framework", "backend stack", "backend technology", "backend tech"]):
            return "backend_framework"
        if cleaned in ["backend", "backend choice"]:
            return "backend_framework"
        if any(term in cleaned for term in ["database", "project database", "db engine", "db"]):
            return "database"
        if any(term in cleaned for term in ["presentation owner", "demo presenter", "presentation lead"]):
            return "presentation_owner"

        slug = re.sub(r"[^a-z0-9]+", "_", cleaned).strip("_")
        return slug or "general_decision"

    @staticmethod
    def process_decision_candidates(
        db: Session,
        document_id: str,
        doc_original_name: str,
        candidates: List[DecisionCandidate],
    ) -> Dict[str, Any]:
        """
        Processes validated candidates against persistent decision memory.

        Classification per candidate (in order):
          1. No evidence text            → skip
          2. Exact same value            → unchanged
          3. Idempotency hit (already from this doc) → unchanged
          4. No existing active decision → new active decision
          5. Suggestion / non-decision   → skip (already filtered by extraction, but double-checked)
          6. Explicit replacement        → lineage transition
          7. Ambiguous contradiction     → conflict (NOT ambiguous decision row)
        """
        # Import here to avoid circular imports
        from backend.services.conflict_detection_service import ConflictDetectionService

        decisions_detected = len(candidates)
        new_decisions = 0
        updated_decisions = 0
        unchanged_decisions = 0
        conflicts_created = 0
        persisted_decisions: List[Decision] = []

        try:
            for cand in candidates:
                # ── Guard: must have evidence ─────────────────────────────
                if not cand.evidence_text or not cand.evidence_text.strip():
                    logger.warning("Skipping candidate without evidence text.")
                    continue

                # ── Guard: resolve chunk linkage ──────────────────────────
                if not cand.source_chunk_id:
                    chunk = db.query(DocumentChunk).filter(
                        DocumentChunk.document_id == document_id
                    ).first()
                    if chunk:
                        cand.source_chunk_id = chunk.chunk_id
                    else:
                        logger.warning("Skipping candidate: unable to trace source chunk.")
                        continue

                norm_topic = DecisionMemoryService.normalize_topic(cand.topic)
                cand_val = cand.value.strip()

                # ── Idempotency: already stored from this exact document ──
                existing_doc_decision = db.query(Decision).filter(
                    Decision.source_document_id == document_id,
                    Decision.normalized_topic == norm_topic,
                    Decision.value.ilike(cand_val),
                ).first()

                if existing_doc_decision:
                    logger.info(
                        f"Idempotent hit: decision '{norm_topic}'='{cand_val}' "
                        f"already processed from doc {document_id}"
                    )
                    unchanged_decisions += 1
                    persisted_decisions.append(existing_doc_decision)
                    continue

                # ── Idempotency: existing open conflict from this doc ─────
                #   (covered inside ConflictDetectionService.create_conflict)

                # ── Fetch current active decision for this topic ──────────
                active_decision = db.query(Decision).filter(
                    Decision.normalized_topic == norm_topic,
                    Decision.status == DecisionStatus.ACTIVE.value,
                ).first()

                # ── Classify ──────────────────────────────────────────────
                classification = ConflictDetectionService.classify(
                    candidate_value=cand_val,
                    evidence_text=cand.evidence_text,
                    replaces_previous=cand.replaces_previous,
                    previous_value=cand.previous_value,
                    active_decision=active_decision,
                )

                # ── Handle classification ─────────────────────────────────

                from backend.services.audit_service import AuditService
                from backend.models.audit import AuditEventType

                if classification == "new":
                    new_dec = Decision(
                        id=str(uuid.uuid4()),
                        topic=cand.topic,
                        normalized_topic=norm_topic,
                        value=cand_val,
                        status=DecisionStatus.ACTIVE.value,
                        reason=cand.reason,
                        source_document_id=document_id,
                        source_chunk_id=cand.source_chunk_id,
                        source_date=cand.effective_date,
                        supersedes_decision_id=None,
                        created_at=datetime.datetime.utcnow(),
                        updated_at=datetime.datetime.utcnow(),
                    )
                    db.add(new_dec)
                    db.flush()
                    new_decisions += 1
                    persisted_decisions.append(new_dec)
                    
                    AuditService.record_event(
                        db=db,
                        event_type=AuditEventType.DECISION_CREATED.value,
                        title=f"Decision Created: {cand.topic}",
                        entity_type="decision",
                        entity_id=new_dec.id,
                        source_document_id=document_id,
                        decision_id=new_dec.id,
                        metadata={
                            "topic": cand.topic,
                            "new_value": cand_val,
                            "reason": cand.reason
                        }
                    )
                    logger.info(f"Created new active decision: '{norm_topic}' = '{cand_val}'")

                elif classification == "same_value":
                    logger.info(
                        f"Decision '{norm_topic}' = '{cand_val}' unchanged. "
                        "No fake replacement created."
                    )
                    unchanged_decisions += 1
                    persisted_decisions.append(active_decision)
                    
                    AuditService.record_event(
                        db=db,
                        event_type=AuditEventType.DECISION_UNCHANGED.value,
                        title=f"Decision Unchanged: {cand.topic}",
                        entity_type="decision",
                        entity_id=active_decision.id,
                        source_document_id=document_id,
                        decision_id=active_decision.id,
                        metadata={
                            "topic": cand.topic,
                            "value": cand_val
                        }
                    )

                elif classification == "suggestion":
                    # Suggestions confirmed not to be decisions – skip silently
                    logger.info(
                        f"Candidate '{norm_topic}'='{cand_val}' is a suggestion. Skipping."
                    )

                elif classification == "explicit_replacement":
                    # Old decision → REPLACED
                    old_value = active_decision.value
                    active_decision.status = DecisionStatus.REPLACED.value
                    active_decision.updated_at = datetime.datetime.utcnow()

                    new_dec = Decision(
                        id=str(uuid.uuid4()),
                        topic=cand.topic,
                        normalized_topic=norm_topic,
                        value=cand_val,
                        status=DecisionStatus.ACTIVE.value,
                        reason=cand.reason,
                        source_document_id=document_id,
                        source_chunk_id=cand.source_chunk_id,
                        source_date=cand.effective_date,
                        supersedes_decision_id=active_decision.id,
                        created_at=datetime.datetime.utcnow(),
                        updated_at=datetime.datetime.utcnow(),
                    )
                    db.add(new_dec)
                    db.flush()
                    updated_decisions += 1
                    persisted_decisions.append(new_dec)
                    
                    AuditService.record_event(
                        db=db,
                        event_type=AuditEventType.DECISION_REPLACED.value,
                        title=f"Decision Replaced: {cand.topic}",
                        entity_type="decision",
                        entity_id=new_dec.id,
                        source_document_id=document_id,
                        decision_id=new_dec.id,
                        metadata={
                            "topic": cand.topic,
                            "previous_value": old_value,
                            "new_value": cand_val,
                            "reason": cand.reason
                        }
                    )
                    logger.info(
                        f"Explicit replacement: '{norm_topic}' "
                        f"{active_decision.value!r} → {cand_val!r}"
                    )

                elif classification == "conflict":
                    # Create a persistent open conflict
                    # Do NOT create an ambiguous Decision row
                    ConflictDetectionService.create_conflict(
                        db=db,
                        normalized_topic=norm_topic,
                        conflict_type=ConflictType.CONTRADICTORY_VALUE.value,
                        existing_decision=active_decision,
                        candidate_value=cand_val,
                        candidate_source_document_id=document_id,
                        candidate_source_chunk_id=cand.source_chunk_id,
                        candidate_reason=cand.reason,
                        candidate_evidence_text=cand.evidence_text,
                        candidate_source_date=cand.effective_date,
                    )
                    conflicts_created += 1
                    # Keep the existing active decision in the output list so
                    # callers can see what is still active
                    persisted_decisions.append(active_decision)
                    logger.info(
                        f"Conflict created for '{norm_topic}': "
                        f"existing={active_decision.value!r} vs candidate={cand_val!r}"
                    )

            db.commit()

        except Exception as e:
            db.rollback()
            logger.error(f"Error persisting decisions in database: {e}")
            raise e

        # ── Format output ──────────────────────────────────────────────────
        decisions_output = []
        for dec in persisted_decisions:
            doc_name = doc_original_name
            try:
                if dec.source_document_id != document_id and dec.source_document:
                    doc_name = dec.source_document.original_name
            except Exception:
                pass

            decisions_output.append({
                "id": dec.id,
                "topic": dec.topic,
                "normalized_topic": dec.normalized_topic,
                "value": dec.value,
                "status": dec.status,
                "reason": dec.reason,
                "source_document": doc_name,
                "source_document_id": dec.source_document_id,
                "source_chunk_id": dec.source_chunk_id,
                "source_date": dec.source_date,
                "supersedes_decision_id": dec.supersedes_decision_id,
                "created_at": dec.created_at.isoformat() if dec.created_at else None,
                "updated_at": dec.updated_at.isoformat() if dec.updated_at else None,
            })

        return {
            "document_id": document_id,
            "status": "processed",
            "decisions_detected": decisions_detected,
            "new_decisions": new_decisions,
            "updated_decisions": updated_decisions,
            "unchanged_decisions": unchanged_decisions,
            "conflicts_created": conflicts_created,
            "decisions": decisions_output,
        }

    @staticmethod
    def get_decisions(db: Session, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieves stored decisions, optionally filtered by status."""
        query = db.query(Decision)
        if status:
            query = query.filter(Decision.status == status)

        decisions = query.order_by(Decision.created_at.desc()).all()
        results = []
        for d in decisions:
            doc_name = d.source_document.original_name if d.source_document else "Unknown"
            results.append({
                "id": d.id,
                "topic": d.topic,
                "value": d.value,
                "status": d.status,
                "reason": d.reason,
                "source_document": doc_name,
            })
        return results

    @staticmethod
    def get_decision_lineage(db: Session, decision_id: str) -> Optional[Dict[str, Any]]:
        """Builds the chronological decision lineage chain for a given decision ID."""
        target = db.query(Decision).filter(Decision.id == decision_id).first()
        if not target:
            return None

        # Trace backwards to the root ancestor
        curr = target
        chain_backward = [curr]
        visited = {curr.id}

        while curr.supersedes_decision_id:
            parent = db.query(Decision).filter(Decision.id == curr.supersedes_decision_id).first()
            if not parent or parent.id in visited:
                break
            visited.add(parent.id)
            chain_backward.append(parent)
            curr = parent

        root = chain_backward[-1]

        # Trace forward from root
        ordered_chain: List[Decision] = []
        curr = root
        visited_fwd = set()

        while curr and curr.id not in visited_fwd:
            visited_fwd.add(curr.id)
            ordered_chain.append(curr)
            child = db.query(Decision).filter(Decision.supersedes_decision_id == curr.id).first()
            curr = child

        active_in_chain = next(
            (d for d in ordered_chain if d.status == DecisionStatus.ACTIVE.value), None
        )
        current_focus = active_in_chain if active_in_chain else target

        lineage_items = []
        for d in ordered_chain:
            doc_name = d.source_document.original_name if d.source_document else "Unknown"
            item: Dict[str, Any] = {
                "value": d.value,
                "status": d.status,
                "source": doc_name,
            }
            if d.reason:
                item["reason"] = d.reason
            if d.source_date:
                item["source_date"] = d.source_date
            lineage_items.append(item)

        return {
            "id": target.id,
            "topic": target.topic,
            "current": {
                "value": current_focus.value,
                "status": current_focus.status,
                "reason": current_focus.reason,
            },
            "lineage": lineage_items,
        }
