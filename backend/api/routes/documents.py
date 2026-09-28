from fastapi import APIRouter, UploadFile, File, status, Path as FastAPIPath, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.models.document import DocumentResponse
from backend.models.text_extraction import DocumentTextResponse
from backend.models.chunk import ChunkingResponse
from backend.models.embedding import DocumentEmbeddingResponse, EmbeddedChunk
from backend.services.document_service import DocumentService
from backend.services.text_extraction_service import TextExtractionService
from backend.services.chunking_service import ChunkingService
from backend.services.embedding_service import EmbeddingService
from backend.services.database_service import DatabaseService
from backend.services.indexing_service import IndexingService

router = APIRouter(prefix="/documents", tags=["documents"])

@router.get("", summary="Get all indexed documents")
async def get_all_documents(db: Session = Depends(get_db)):
    """
    Returns a list of all documents with their metadata.
    """
    docs = DatabaseService.get_all_documents(db)
    # The prompt expects {"documents": [...]} response
    return {"documents": [
        {
            "id": d.id,
            "original_name": d.original_name,
            "extension": d.extension,
            "status": d.status,
            "size_bytes": d.size_bytes,
            "chunk_count": len(d.chunks),
            "created_at": d.created_at.isoformat()
        } for d in docs
    ]}

@router.get("/{document_id}", summary="Get document details")
async def get_document_details(document_id: str = FastAPIPath(...), db: Session = Depends(get_db)):
    """
    Returns specific document metadata and chunk count.
    """
    details = DatabaseService.get_document_with_chunk_count(db, document_id)
    if not details:
        raise HTTPException(status_code=404, detail="Document not found")
    return details

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED, summary="Upload a project document")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    """
    Uploads a project document to the local sovereign storage.
    
    Validates file type (PDF, DOCX, TXT, MD) and size before storing safely.
    Automatically triggers the indexing pipeline in the background.
    """
    doc_response = await DocumentService.upload_document(file, db)
    
    async def bg_index(doc_id: str):
        from backend.db.session import SessionLocal
        db_bg = SessionLocal()
        try:
            await IndexingService.index_document(db_bg, doc_id)
        except Exception:
            pass # IndexingService already handles status=failed and logging
        finally:
            db_bg.close()
            
    background_tasks.add_task(bg_index, doc_response.id)
    return doc_response

@router.post("/{document_id}/index", summary="Index document locally")
async def index_document(document_id: str = FastAPIPath(...), db: Session = Depends(get_db)):
    """
    Extracts text, chunks, embeds, and saves safely to Postgres.
    """
    return await IndexingService.index_document(db, document_id)

@router.get("/{document_id}/text", response_model=DocumentTextResponse, summary="Extract text from a document")
async def extract_document_text(document_id: str = FastAPIPath(..., description="The unique ID of the uploaded document")):
    """
    Extracts raw text from an uploaded document (.txt, .md, .pdf, .docx).
    """
    return TextExtractionService.extract_text(document_id)

@router.get("/{document_id}/chunks", response_model=ChunkingResponse, summary="Get chunks from an uploaded document")
async def get_document_chunks(document_id: str = FastAPIPath(..., description="The unique ID of the uploaded document")):
    """
    Extracts text from an uploaded document and splits it into logical chunks.
    """
    return ChunkingService.chunk_document(document_id)

@router.post("/{document_id}/embeddings", response_model=DocumentEmbeddingResponse, summary="Generate local embeddings for document chunks")
async def generate_document_embeddings(document_id: str = FastAPIPath(..., description="The unique ID of the uploaded document")):
    """
    Generates semantic numerical vectors (embeddings) for all chunks in the document.
    Must have Ollama running locally.
    """
    if not await EmbeddingService.is_ollama_available():
        raise HTTPException(status_code=503, detail="Local embedding service is unavailable.")
        
    chunking_response = ChunkingService.chunk_document(document_id)
    
    if not chunking_response.chunks:
        raise HTTPException(status_code=400, detail="No chunks available to embed.")
        
    results = await EmbeddingService.embed_chunks(chunking_response.chunks)
    
    if not results:
        raise HTTPException(status_code=500, detail="Embedding process yielded no results.")
        
    dimension = results[0]["embedding_dimension"]
    model_name = results[0]["model"]
    
    embedded_chunks = []
    for res in results:
        embedded_chunks.append(EmbeddedChunk(
            chunk_id=res["chunk_id"],
            chunk_index=res["chunk_index"],
            status="embedded"
        ))
        
    return DocumentEmbeddingResponse(
        document_id=document_id,
        original_name=chunking_response.original_name,
        status="embedded",
        model=model_name,
        total_chunks=len(embedded_chunks),
        embedding_dimension=dimension,
        embedded_chunks=embedded_chunks
    )

from typing import Union
from fastapi import Query
from backend.models.memory import DependencyCheckResponse

@router.delete("/{document_id}", response_model=Union[DependencyCheckResponse, dict])
def delete_document(
    document_id: str,
    confirm: bool = Query(False, description="Confirm destructive removal"),
    db: Session = Depends(get_db)
):
    """
    Safely removes a document and its chunks/embeddings.
    If it has dependencies (decisions, conflicts, actions), blocks deletion unless confirm=true.
    """
    db_doc = DatabaseService.get_document(db, document_id)
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    from backend.services.memory_service import MemoryService
    from backend.services.audit_service import AuditService
    from backend.models.audit import AuditEventType, ActorType
    
    deps = MemoryService.check_dependencies(db, document_id)
    
    if deps["status"] == "requires_confirmation" and not confirm:
        AuditService.record_event(
            db=db,
            event_type="memory_dependency_detected",
            title=f"Removal Blocked: Document {db_doc.original_name}",
            entity_type="document",
            entity_id=document_id,
            source_document_id=document_id,
            metadata={"dependencies": deps["dependencies"]}
        )
        db.commit()
        return DependencyCheckResponse(**deps)
        
    # Proceed with deletion
    try:
        import os
        from backend.services.document_service import UPLOAD_DIR
        # Delete file from disk
        file_path = UPLOAD_DIR / db_doc.stored_name
        if file_path.exists():
            os.remove(file_path)
            
        # The cascade deletion on SQLAlchemy might not handle archiving active decisions properly.
        # We need to manually archive active decisions before deleting to prevent FK errors or silent drops if we chose SET NULL.
        # Oh, in our models: source_document_id on Decision has ondelete="CASCADE" which means decisions would be deleted!
        # The prompt says: "But do NOT silently corrupt decisions, actions or audit references. If removing the only source of an active decision: do NOT leave that decision presented as fully evidenced. Use a safe state such as: unsupported or archived."
        
        # Archiving decisions
        from backend.db.models import Decision, Conflict, ActionProposal
        from backend.models.decision import DecisionStatus
        
        decisions = db.query(Decision).filter(Decision.source_document_id == document_id).all()
        for dec in decisions:
            if dec.status == DecisionStatus.ACTIVE.value:
                dec.status = "archived"
                dec.reason = (dec.reason or "") + " [Source Document Removed]"
                
            # Disconnect the foreign key to avoid CASCADE deletion!
            dec.source_document_id = None
            
        # Disconnect from conflicts
        conflicts_existing = db.query(Conflict).filter(Conflict.existing_source_document_id == document_id).all()
        for c in conflicts_existing:
            c.existing_source_document_id = None
            
        conflicts_candidate = db.query(Conflict).filter(Conflict.candidate_source_document_id == document_id).all()
        for c in conflicts_candidate:
            c.candidate_source_document_id = None
            
        # Disconnect from actions
        actions = db.query(ActionProposal).filter(ActionProposal.source_document_id == document_id).all()
        for a in actions:
            a.source_document_id = None
            
        # Delete document (this will cascade delete DocumentChunk due to back_populates cascade="all, delete-orphan")
        db.delete(db_doc)
        
        AuditService.record_event(
            db=db,
            event_type="document_removed",
            title=f"Document Removed: {db_doc.original_name}",
            entity_type="document",
            entity_id=document_id,
            metadata={"forced": confirm, "archived_decisions": len(decisions)}
        )
        db.commit()
        
        return {"status": "removed", "document_id": document_id}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

