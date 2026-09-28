from sqlalchemy.orm import Session
from fastapi import HTTPException
from backend.services.embedding_service import EmbeddingService
from backend.db.models import Document, DocumentChunk
from backend.models.search import SearchRequest, SearchResponse, SearchResult
from backend.core.config import settings
import logging

logger = logging.getLogger(__name__)

class RetrievalService:
    @staticmethod
    async def search_chunks(db: Session, request: SearchRequest) -> SearchResponse:
        query_text = request.query.strip()
        if not query_text:
            raise HTTPException(status_code=400, detail="Query cannot be empty.")
            
        # Ensure Ollama is running
        if not await EmbeddingService.is_ollama_available():
            raise HTTPException(status_code=503, detail="Local embedding service is unavailable.")
            
        try:
            # 1. Generate query embedding
            query_embedding = await EmbeddingService.embed_text(query_text)
            
            # 2. Check if we have any indexed documents with embeddings
            # We assume indexed documents have chunks with non-null embeddings.
            has_indexed = db.query(Document).filter(Document.status == "indexed").first()
            if not has_indexed:
                return SearchResponse(query=query_text, total_results=0, results=[])

            # 3. Perform pgvector cosine similarity search
            # pgvector's <=> operator computes cosine distance. Similarity is 1 - distance.
            # We filter by Document.status == "indexed" to avoid unindexed or failed docs.
            
            cosine_distance = DocumentChunk.embedding.cosine_distance(query_embedding)
            similarity = (1.0 - cosine_distance).label("similarity")
            
            results = (
                db.query(DocumentChunk, Document, similarity)
                .join(Document, DocumentChunk.document_id == Document.id)
                .filter(Document.status == "indexed")
                .filter(DocumentChunk.embedding.is_not(None))
                .filter(similarity >= settings.SEARCH_MIN_SIMILARITY)
                .order_by(cosine_distance)
                .limit(request.top_k)
                .all()
            )
            
            search_results = []
            for chunk, doc, sim in results:
                search_results.append(SearchResult(
                    chunk_id=chunk.id,
                    document_id=doc.id,
                    document_name=doc.original_name,
                    chunk_index=chunk.chunk_index,
                    text=chunk.text,
                    similarity_score=float(sim)
                ))
                
            return SearchResponse(
                query=query_text,
                total_results=len(search_results),
                results=search_results
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Search failed: {e}")
            raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
