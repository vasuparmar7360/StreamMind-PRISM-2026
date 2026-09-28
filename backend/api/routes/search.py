from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.models.search import SearchRequest, SearchResponse
from backend.services.retrieval_service import RetrievalService

router = APIRouter(prefix="/search", tags=["search"])

@router.post("", response_model=SearchResponse, status_code=status.HTTP_200_OK, summary="Semantic search across indexed document chunks")
async def search_documents(request: SearchRequest, db: Session = Depends(get_db)):
    """
    Retrieves the most relevant stored document chunks for a natural-language query.
    Generates a local embedding for the query and searches pgvector.
    """
    return await RetrievalService.search_chunks(db, request)
