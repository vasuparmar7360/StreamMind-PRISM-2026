from sqlalchemy.orm import Session
from fastapi import HTTPException
from backend.services.text_extraction_service import TextExtractionService
from backend.services.chunking_service import ChunkingService
from backend.services.embedding_service import EmbeddingService
from backend.services.database_service import DatabaseService
import logging
import json

logger = logging.getLogger(__name__)

class IndexingService:
    @staticmethod
    async def index_document(db: Session, document_id: str):
        from backend.services.audit_service import AuditService
        from backend.models.audit import AuditEventType

        # 1. Update status to indexing
        db_doc = DatabaseService.update_document_status(db, document_id, "indexing")
        if not db_doc:
            raise HTTPException(status_code=404, detail="Document not found in database.")
            
        AuditService.record_event(
            db=db,
            event_type=AuditEventType.DOCUMENT_INDEX_STARTED.value,
            title="Document Indexing Started",
            entity_type="document",
            entity_id=document_id,
            source_document_id=document_id
        )
        db.commit()
            
        try:
            # 2. Extract and Chunk Text
            chunking_response = ChunkingService.chunk_document(document_id)
            if not chunking_response.chunks:
                raise ValueError("No chunks generated for this document.")
                
            # 3. Create Embeddings
            if not await EmbeddingService.is_ollama_available():
                raise ConnectionError("Local embedding service is unavailable.")
                
            embedded_chunks = await EmbeddingService.embed_chunks(chunking_response.chunks)
            
            # 4. Prepare data for database
            # We need to combine chunking_response.chunks (which has text, word_count, etc.)
            # with embedded_chunks (which has the vector)
            chunks_to_save = []
            for chunk, embedded in zip(chunking_response.chunks, embedded_chunks):
                chunks_to_save.append({
                    "chunk_id": chunk.chunk_id,
                    "chunk_index": chunk.chunk_index,
                    "text": chunk.text,
                    "word_count": chunk.word_count,
                    "character_count": chunk.character_count,
                    "embedding": embedded["embedding"]
                })
                
            # 5. Save chunks to database transactionally
            DatabaseService.save_chunks(db, document_id, chunks_to_save)
            
            # 6. Update status to indexed
            DatabaseService.update_document_status(db, document_id, "indexed")
            
            AuditService.record_event(
                db=db,
                event_type=AuditEventType.DOCUMENT_INDEXED.value,
                title="Document Indexed Successfully",
                entity_type="document",
                entity_id=document_id,
                source_document_id=document_id,
                metadata={"total_chunks": len(chunks_to_save)}
            )
            db.commit()
            # 7. Extract comprehensive information
            try:
                from backend.services.extraction_service import ExtractionService
                from backend.services.decision_memory_service import DecisionMemoryService
                from backend.db.models import Fact, Entity, ActionProposal
                
                # Clean up old extracted data for this document before re-extracting
                db.query(Entity).filter(Entity.source_document_id == document_id).delete()
                db.query(Fact).filter(Fact.source_document_id == document_id).delete()
                db.query(ActionProposal).filter(
                    ActionProposal.source_document_id == document_id, 
                    ActionProposal.status == "pending"
                ).delete()
                db.commit()

                results = await ExtractionService.extract_all(
                    document_id, chunking_response.original_name, chunking_response.chunks
                )
                
                # Save Decisions — convert dicts to DecisionCandidate objects
                if results["decisions"]:
                    from backend.models.decision import DecisionCandidate
                    decision_candidates = []
                    for d in results["decisions"]:
                        if isinstance(d, dict):
                            try:
                                decision_candidates.append(DecisionCandidate(**d))
                            except Exception as conv_err:
                                logger.warning(f"Skipping invalid decision dict: {conv_err}")
                        else:
                            decision_candidates.append(d)
                    if decision_candidates:
                        DecisionMemoryService.process_decision_candidates(
                            db, document_id, chunking_response.original_name, decision_candidates
                        )
                
                # Save Entities
                for e_data in results["entities"]:
                    e = Entity(
                        id=f"{document_id}-entity-{hash(e_data.get('name', ''))}",
                        name=e_data.get("name", "Unknown"),
                        entity_type=e_data.get("entity_type", "unknown"),
                        description=e_data.get("description", ""),
                        source_document_id=document_id,
                        source_chunk_id=e_data.get("source_chunk_id")
                    )
                    db.add(e)
                    
                # Save Facts
                for f_data in results["facts"]:
                    f = Fact(
                        id=f"{document_id}-fact-{hash(f_data.get('content', ''))}",
                        content=f_data.get("content", ""),
                        source_document_id=document_id,
                        source_chunk_id=f_data.get("source_chunk_id")
                    )
                    db.add(f)
                    
                # Save Action Items
                for a_data in results["action_items"]:
                    a = ActionProposal(
                        id=f"{document_id}-action-{hash(a_data.get('title', ''))}",
                        action_type="extracted_task",
                        title=a_data.get("title", "Task"),
                        description=a_data.get("description", ""),
                        payload_json=json.dumps({"owner": a_data.get("owner"), "deadline": a_data.get("deadline"), "evidence_text": a_data.get("evidence_text")}),
                        status="pending",
                        source_document_id=document_id,
                        source_chunk_id=a_data.get("source_chunk_id")
                    )
                    db.add(a)
                    
                db.commit()
                
            except Exception as ext_err:
                logger.warning(f"Comprehensive extraction failed for {document_id}: {ext_err}")
                
            return {"status": "indexed", "total_chunks": len(chunks_to_save)}
            
        except ConnectionError as e:
            logger.error(f"Embedding connection error: {e}")
            DatabaseService.update_document_status(db, document_id, "failed")
            AuditService.record_event(
                db=db,
                event_type=AuditEventType.DOCUMENT_INDEX_FAILED.value,
                title="Document Indexing Failed",
                entity_type="document",
                entity_id=document_id,
                source_document_id=document_id,
                metadata={"error": str(e)}
            )
            db.commit()
            raise HTTPException(status_code=503, detail=str(e))
        except Exception as e:
            logger.error(f"Indexing failed for {document_id}: {e}")
            DatabaseService.update_document_status(db, document_id, "failed")
            AuditService.record_event(
                db=db,
                event_type=AuditEventType.DOCUMENT_INDEX_FAILED.value,
                title="Document Indexing Failed",
                entity_type="document",
                entity_id=document_id,
                source_document_id=document_id,
                metadata={"error": str(e)}
            )
            db.commit()
            raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")
