from sqlalchemy.orm import Session
from backend.db.models import Document, DocumentChunk
from typing import List, Dict, Any, Optional

class DatabaseService:
    @staticmethod
    def get_document(db: Session, document_id: str) -> Optional[Document]:
        return db.query(Document).filter(Document.id == document_id).first()

    @staticmethod
    def save_document(db: Session, doc_data: Dict[str, Any]) -> Document:
        db_doc = DatabaseService.get_document(db, doc_data["id"])
        if db_doc:
            for key, value in doc_data.items():
                setattr(db_doc, key, value)
        else:
            db_doc = Document(**doc_data)
            db.add(db_doc)
        db.commit()
        db.refresh(db_doc)
        return db_doc
        
    @staticmethod
    def update_document_status(db: Session, document_id: str, status: str):
        db_doc = DatabaseService.get_document(db, document_id)
        if db_doc:
            db_doc.status = status
            db.commit()
            db.refresh(db_doc)
        return db_doc

    @staticmethod
    def save_chunks(db: Session, document_id: str, chunks_data: List[Dict[str, Any]]):
        # Delete existing chunks for idempotency
        db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()
        
        db_chunks = []
        for c in chunks_data:
            db_chunk = DocumentChunk(
                id=c["chunk_id"],
                document_id=document_id,
                chunk_index=c["chunk_index"],
                text=c.get("text", ""),
                word_count=c.get("word_count", 0),
                character_count=c.get("character_count", 0),
                embedding=c.get("embedding")
            )
            db_chunks.append(db_chunk)
            
        db.add_all(db_chunks)
        db.commit()
        
    @staticmethod
    def get_all_documents(db: Session) -> List[Document]:
        return db.query(Document).order_by(Document.created_at.desc()).all()
        
    @staticmethod
    def get_document_with_chunk_count(db: Session, document_id: str) -> Optional[Dict[str, Any]]:
        db_doc = DatabaseService.get_document(db, document_id)
        if not db_doc:
            return None
            
        chunk_count = db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).count()
        
        # Get preview text from first chunk
        preview_text = None
        if chunk_count > 0:
            first_chunk = db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).order_by(DocumentChunk.chunk_index).first()
            if first_chunk:
                preview_text = first_chunk.text[:500] + ("..." if len(first_chunk.text) > 500 else "")
                
        # Get active decisions
        from backend.db.models import Decision, Fact, Entity, ActionProposal
        decisions = db.query(Decision).filter(Decision.source_document_id == document_id).all()
        decisions_data = [{
            "topic": d.topic,
            "value": d.value,
            "status": d.status
        } for d in decisions]
        
        facts = db.query(Fact).filter(Fact.source_document_id == document_id).all()
        facts_data = [{
            "content": f.content
        } for f in facts]
        
        entities = db.query(Entity).filter(Entity.source_document_id == document_id).all()
        entities_data = [{
            "name": e.name,
            "entity_type": e.entity_type,
            "description": e.description
        } for e in entities]

        actions = db.query(ActionProposal).filter(ActionProposal.source_document_id == document_id).all()
        actions_data = [{
            "action_type": a.action_type,
            "title": a.title,
            "description": a.description,
            "status": a.status,
            "risk_level": a.risk_level
        } for a in actions]
        
        return {
            "id": db_doc.id,
            "original_name": db_doc.original_name,
            "extension": db_doc.extension,
            "status": db_doc.status,
            "size_bytes": db_doc.size_bytes,
            "chunk_count": chunk_count,
            "preview_text": preview_text,
            "decisions": decisions_data,
            "facts": facts_data,
            "entities": entities_data,
            "actions": actions_data,
            "created_at": db_doc.created_at.isoformat(),
            "updated_at": db_doc.updated_at.isoformat()
        }
