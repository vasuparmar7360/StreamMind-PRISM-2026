from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.models.ask import AskRequest, AskResponse
from backend.services.qa_service import QAService

router = APIRouter(prefix="/ask", tags=["ask"])

@router.post("", response_model=AskResponse, status_code=status.HTTP_200_OK, summary="Ask a question about the project evidence")
async def ask_question(request: AskRequest, db: Session = Depends(get_db)):
    """
    Generates a natural-language answer from retrieved project evidence using a local Qwen model.
    """
    return await QAService.ask_question(db, request)
