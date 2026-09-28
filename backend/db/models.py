import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.db.base import Base
from pgvector.sqlalchemy import Vector

class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, index=True)
    original_name = Column(String, nullable=False)
    stored_name = Column(String, nullable=False)
    extension = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    status = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    decisions = relationship("Decision", back_populates="source_document", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String, primary_key=True, index=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False, index=True)
    text = Column(Text, nullable=False)
    word_count = Column(Integer, nullable=False)
    character_count = Column(Integer, nullable=False)
    embedding = Column(Vector, nullable=True) # Unconstrained dimension
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    document = relationship("Document", back_populates="chunks")
    decisions = relationship("Decision", back_populates="source_chunk")

class Decision(Base):
    __tablename__ = "decisions"

    id = Column(String, primary_key=True, index=True)
    topic = Column(String, nullable=False)
    normalized_topic = Column(String, nullable=False, index=True)
    value = Column(String, nullable=False)
    status = Column(String, nullable=False, default="active", index=True)
    reason = Column(Text, nullable=True)
    source_document_id = Column(String, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    source_chunk_id = Column(String, ForeignKey("document_chunks.id", ondelete="SET NULL"), nullable=True)
    source_date = Column(String, nullable=True)
    supersedes_decision_id = Column(String, ForeignKey("decisions.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    source_document = relationship("Document", back_populates="decisions")
    source_chunk = relationship("DocumentChunk", back_populates="decisions")
    superseded_decision = relationship(
        "Decision",
        remote_side=[id],
        foreign_keys=[supersedes_decision_id],
        backref="superseding_decisions",
    )
    # Conflicts where this decision is the existing (authoritative) side
    conflicts_as_existing = relationship(
        "Conflict",
        back_populates="existing_decision",
        foreign_keys="[Conflict.existing_decision_id]",
        cascade="all, delete-orphan",
    )
    # If this decision was created to resolve a conflict (accept_candidate path)
    conflicts_resolved_by = relationship(
        "Conflict",
        back_populates="resolution_decision",
        foreign_keys="[Conflict.resolution_decision_id]",
    )
    # Action proposals generated from this decision
    action_proposals = relationship(
        "ActionProposal",
        back_populates="source_decision",
        cascade="all, delete-orphan",
    )

class Conflict(Base):
    __tablename__ = "conflicts"

    id = Column(String, primary_key=True, index=True)
    normalized_topic = Column(String, nullable=False, index=True)

    # Status: open | resolved | dismissed
    status = Column(String, nullable=False, default="open", index=True)

    # Conflict type: contradictory_value | unclear_replacement | multiple_active_candidates | insufficient_authority
    conflict_type = Column(String, nullable=False)

    # The authoritative decision that was already active
    existing_decision_id = Column(
        String, ForeignKey("decisions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    existing_value = Column(String, nullable=False)       # Snapshot value in case decision is later replaced
    existing_source_document_id = Column(String, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)

    # The candidate that conflicts
    candidate_value = Column(String, nullable=False)
    candidate_source_document_id = Column(
        String, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    candidate_source_chunk_id = Column(
        String, ForeignKey("document_chunks.id", ondelete="SET NULL"), nullable=True
    )
    candidate_reason = Column(Text, nullable=True)
    candidate_evidence_text = Column(Text, nullable=True)
    candidate_source_date = Column(String, nullable=True)

    # Resolution
    resolution = Column(String, nullable=True)           # accept_candidate | keep_existing | dismiss
    resolution_note = Column(Text, nullable=True)
    resolution_decision_id = Column(
        String, ForeignKey("decisions.id", ondelete="SET NULL"), nullable=True
    )
    resolved_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    existing_decision = relationship(
        "Decision",
        back_populates="conflicts_as_existing",
        foreign_keys=[existing_decision_id],
    )
    resolution_decision = relationship(
        "Decision",
        back_populates="conflicts_resolved_by",
        foreign_keys=[resolution_decision_id],
    )
    existing_source_document = relationship(
        "Document",
        foreign_keys=[existing_source_document_id],
    )
    candidate_source_document = relationship(
        "Document",
        foreign_keys=[candidate_source_document_id],
    )

class ActionProposal(Base):
    __tablename__ = "action_proposals"

    id = Column(String, primary_key=True, index=True)
    action_type = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    payload_json = Column(Text, nullable=False)  # Store JSON representation of the payload

    status = Column(String, nullable=False, default="pending", index=True)
    risk_level = Column(String, nullable=False, default="low", index=True)

    source_decision_id = Column(
        String, ForeignKey("decisions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source_document_id = Column(
        String, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source_chunk_id = Column(
        String, ForeignKey("document_chunks.id", ondelete="SET NULL"), nullable=True
    )

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    executed_at = Column(DateTime, nullable=True)

    execution_status = Column(String, nullable=False, default="not_started", index=True)
    execution_result = Column(Text, nullable=True)

    source_decision = relationship(
        "Decision",
        back_populates="action_proposals",
    )
    source_document = relationship(
        "Document",
        foreign_keys=[source_document_id],
    )
    source_chunk = relationship(
        "DocumentChunk",
        foreign_keys=[source_chunk_id],
    )

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    entity_type = Column(String, nullable=True, index=True)
    entity_id = Column(String, nullable=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    
    source_document_id = Column(String, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    source_chunk_id = Column(String, ForeignKey("document_chunks.id", ondelete="SET NULL"), nullable=True)
    decision_id = Column(String, ForeignKey("decisions.id", ondelete="SET NULL"), nullable=True, index=True)
    conflict_id = Column(String, ForeignKey("conflicts.id", ondelete="SET NULL"), nullable=True, index=True)
    action_id = Column(String, ForeignKey("action_proposals.id", ondelete="SET NULL"), nullable=True, index=True)
    
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    
    actor_type = Column(String, nullable=False) # system, ai, user
    actor_id = Column(String, nullable=True)

    source_document = relationship("Document", foreign_keys=[source_document_id])
    source_chunk = relationship("DocumentChunk", foreign_keys=[source_chunk_id])
    decision = relationship("Decision", foreign_keys=[decision_id])
    conflict = relationship("Conflict", foreign_keys=[conflict_id])
    action = relationship("ActionProposal", foreign_keys=[action_id])

class Fact(Base):
    __tablename__ = "facts"

    id = Column(String, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    source_document_id = Column(String, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    source_chunk_id = Column(String, ForeignKey("document_chunks.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    source_document = relationship("Document", foreign_keys=[source_document_id])
    source_chunk = relationship("DocumentChunk", foreign_keys=[source_chunk_id])

class Entity(Base):
    __tablename__ = "entities"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    entity_type = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    source_document_id = Column(String, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    source_chunk_id = Column(String, ForeignKey("document_chunks.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    source_document = relationship("Document", foreign_keys=[source_document_id])
    source_chunk = relationship("DocumentChunk", foreign_keys=[source_chunk_id])
