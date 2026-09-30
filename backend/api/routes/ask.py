import uuid
from fastapi import APIRouter, Depends, status, HTTPException
from backend.models.ask import AskRequest, AskResponse
from backend.services.conversation_service import ConversationService
from backend.services.session_state import session_store
import time

router = APIRouter(prefix="/ask", tags=["ask"])

@router.post("", response_model=AskResponse, status_code=status.HTTP_200_OK, summary="Ask a question about the indexed documents")
async def ask_question(request: AskRequest):
    """
    Generates a natural-language answer from retrieved document evidence using a local model.
    Pass a session_id to bind this question to a conversation session; the ID is echoed back.
    Documents and their indexes are preserved across sessions.
    """
    session_id = request.session_id or str(uuid.uuid4())
    request_id = str(uuid.uuid4())
    
    # Simulate a full turn in the conversation
    sess = await session_store.get_or_create(session_id, request_id)
    
    # Process turn
    await ConversationService.process_turn(session_id, request_id, request.question)
    
    # Wait for tasks to finish
    if sess.active_tasks:
        import asyncio
        try:
            await asyncio.wait_for(asyncio.gather(*sess.active_tasks.values(), return_exceptions=True), timeout=30.0)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            pass

    if sess.invalidated:
        raise HTTPException(status_code=409, detail="Session invalidated")

    # Generate answer
    ans_dict = await ConversationService.generate_final_answer(session_id, request_id, request.question)
    
    # The dictionary returned from generate_final_answer matches the fields in AskResponse mostly, but we need AskSource
    from backend.models.ask import AskSource
    sources = []
    for s in ans_dict.get("sources", []):
        sources.append(AskSource(**s))
        
    return AskResponse(
        question=ans_dict["question"],
        status=ans_dict["status"],
        answer=ans_dict["answer"],
        model=ans_dict["model"],
        sources=sources,
        session_id=session_id,
        answer_version=ans_dict.get("answer_version", 0),
        what_changed=ans_dict.get("what_changed", "")
    )

@router.post("/new-session", status_code=status.HTTP_200_OK, summary="Start a new conversation session")
async def new_session():
    """
    Issues a fresh session ID. Clients should replace their current session_id with the returned
    value. This clears conversational context without deleting the document corpus.
    Document indexes are NOT affected.
    """
    return {"session_id": str(uuid.uuid4()), "status": "new_session_created"}

