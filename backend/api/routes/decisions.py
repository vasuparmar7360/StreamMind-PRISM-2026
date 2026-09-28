from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Path as FastAPIPath
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.db.models import DocumentChunk
from backend.services.database_service import DatabaseService
from backend.services.chunking_service import ChunkingService
from backend.services.decision_extraction_service import DecisionExtractionService
from backend.services.decision_memory_service import DecisionMemoryService
from backend.models.decision import (
    DocumentDecisionsResponse,
    DecisionListResponse,
    DecisionLineageResponse
)

router = APIRouter(tags=["decisions"])


@router.post(
    "/documents/{document_id}/decisions",
    response_model=DocumentDecisionsResponse,
    summary="Process and persist decisions from an uploaded or indexed document"
)
async def process_document_decisions(
    document_id: str = FastAPIPath(..., description="The unique ID of the document"),
    db: Session = Depends(get_db)
):
    """
    Extracts structured decisions from the document's stored chunks, compares them with
    existing decision memory, updates lineage, and persists decisions.
    
    Reuses existing stored database chunks without re-extracting if they already exist.
    """
    # 1. Verify document exists
    db_doc = DatabaseService.get_document(db, document_id)
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # 2. Step 15: Load stored chunks from database; do NOT re-extract if stored chunks already exist
    db_chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).order_by(DocumentChunk.chunk_index).all()

    # If chunks are not yet saved to the database, chunk and save them now
    if not db_chunks:
        try:
            chunking_res = ChunkingService.chunk_document(document_id)
            chunks_to_save = [
                {
                    "chunk_id": c.chunk_id,
                    "chunk_index": c.chunk_index,
                    "text": c.text,
                    "word_count": c.word_count,
                    "character_count": c.character_count,
                    "embedding": None
                }
                for c in chunking_res.chunks
            ]
            DatabaseService.save_chunks(db, document_id, chunks_to_save)
            db_chunks = db.query(DocumentChunk).filter(
                DocumentChunk.document_id == document_id
            ).order_by(DocumentChunk.chunk_index).all()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to load or chunk document: {str(e)}")

    if not db_chunks:
        raise HTTPException(status_code=400, detail="No chunks found for document.")

    # 3. Extract candidate decisions (using LLM or rule-based fallback)
    candidates = await DecisionExtractionService.extract_decisions(
        document_id=document_id,
        doc_name=db_doc.original_name,
        chunks=db_chunks
    )

    # 4. Process candidates against persistent decision memory
    result = DecisionMemoryService.process_decision_candidates(
        db=db,
        document_id=document_id,
        doc_original_name=db_doc.original_name,
        candidates=candidates
    )

    return result


@router.get(
    "/decisions",
    response_model=DecisionListResponse,
    summary="Get all project decisions"
)
async def get_decisions(
    status: Optional[str] = Query(None, description="Optional filter by status: active, replaced, ambiguous"),
    db: Session = Depends(get_db)
):
    """
    Retrieves all persistent decisions, optionally filtered by status.
    """
    decisions = DecisionMemoryService.get_decisions(db, status=status)
    return {
        "total": len(decisions),
        "decisions": decisions
    }


@router.get(
    "/decisions/{decision_id}",
    summary="Get decision details and complete lineage chain"
)
async def get_decision_lineage(
    decision_id: str = FastAPIPath(..., description="Unique decision ID"),
    db: Session = Depends(get_db)
):
    """
    Retrieves a decision with its current state and chronological lineage history.
    """
    lineage_data = DecisionMemoryService.get_decision_lineage(db, decision_id)
    if not lineage_data:
        raise HTTPException(status_code=404, detail="Decision not found.")
    return lineage_data

@router.post(
    "/decisions/{decision_id}/archive",
    summary="Safely archives an active decision so it no longer drives actions"
)
def archive_decision(
    decision_id: str = FastAPIPath(...),
    db: Session = Depends(get_db)
):
    from backend.db.models import Decision
    from backend.models.decision import DecisionStatus
    from backend.services.audit_service import AuditService
    
    dec = db.query(Decision).filter(Decision.id == decision_id).first()
    if not dec:
        raise HTTPException(status_code=404, detail="Decision not found")
        
    if dec.status != DecisionStatus.ACTIVE.value:
        raise HTTPException(status_code=400, detail="Only active decisions can be archived")
        
    dec.status = "archived"
    
    AuditService.record_event(
        db=db,
        event_type="decision_archived",
        title=f"Decision Archived: {dec.topic}",
        entity_type="decision",
        entity_id=decision_id,
        decision_id=decision_id,
        metadata={"value": dec.value}
    )
    
    db.commit()
    return {"status": "archived", "decision_id": decision_id}
