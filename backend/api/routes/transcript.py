"""
StreamMind Live Transcript SSE Route
======================================
Transport: Server-Sent Events (SSE) via HTTP POST for chunk input,
           GET /stream/{session_id} for the outbound event channel.
"""

import asyncio
import json
import time
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.services import retrieval_controller as ctrl
from backend.services.session_state import session_store
from backend.services.conversation_service import ConversationService

router = APIRouter(prefix="/transcript", tags=["transcript"])

class ChunkInput(BaseModel):
    session_id: str = Field(..., description="Opaque session identifier")
    request_id: str = Field(..., description="Unique per-question identifier")
    seq: int = Field(..., ge=0, description="Monotonically increasing chunk sequence number")
    text: str = Field(..., description="The NEW text arriving in this chunk (not full transcript)")

class FinalInput(BaseModel):
    session_id: str
    request_id: str

class StopInput(BaseModel):
    session_id: str
    request_id: str


def _sse_event(kind: str, payload: dict) -> str:
    payload["event"] = kind
    return f"data: {json.dumps(payload)}\n\n"


@router.get("/stream/{session_id}", summary="Open SSE event channel for a session")
async def stream_events(session_id: str, request: Request):
    async def event_generator() -> AsyncGenerator[str, None]:
        last_sent = -1
        keepalive_interval = 3.0
        last_keepalive = time.monotonic()

        while True:
            if await request.is_disconnected():
                break

            sess = await session_store.get(session_id)
            if sess:
                events = sess.activity[last_sent + 1:]
                for ev in events:
                    last_sent += 1
                    payload = {"elapsed": round(ev.ts, 3)}

                    if ev.kind == "input":
                        parts = ev.detail.split(",")
                        payload.update({k.strip().split("=")[0]: k.strip().split("=")[1]
                                        for k in parts if "=" in k})
                    elif ev.kind in ("decision", "retrieval_start", "retrieval_done", "decomposition_start", "decomposition_done", "decomposition_failed", "classification_start", "classification_done"):
                        payload["detail"] = ev.detail
                    elif ev.kind in ("final_input", "answer_start", "answer_done", "stopped", "invalidated"):
                        payload["detail"] = ev.detail

                    yield _sse_event(ev.kind, payload)

                sqs = []
                for sq in sess.subquestions.values():
                    sqs.append({
                        "id": sq.id,
                        "text": sq.text,
                        "status": sq.status,
                        "sources": len(sq.evidence_ids)
                    })
                if sqs:
                    yield _sse_event("subquestions", {"subquestions": sqs})

                if sess.final_answer and sess.answer_done_at:
                    if any(e.kind == "answer_done" for e in sess.activity[:last_sent + 1]):
                        break

            if time.monotonic() - last_keepalive > keepalive_interval:
                yield _sse_event("keepalive", {})
                last_keepalive = time.monotonic()

            await asyncio.sleep(0.1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/chunk", summary="Send one transcript chunk to the backend")
async def receive_chunk(body: ChunkInput):
    sess = await session_store.get_or_create(body.session_id, body.request_id)

    if sess.invalidated:
        return {"status": "session_invalidated"}

    if body.seq <= sess.last_seq:
        return {"status": "duplicate_ignored", "seq": body.seq}

    sess.last_seq = body.seq
    sess.chunks_received += 1
    now = time.monotonic()

    if sess.first_chunk_at is None:
        sess.first_chunk_at = now

    if sess.accumulated_text and not sess.accumulated_text.endswith(" "):
        sess.accumulated_text += " "
    sess.accumulated_text += body.text.strip()

    word_count = len(sess.accumulated_text.split())
    sess.log("input", f"seq={body.seq}, words={word_count}, chunks={sess.chunks_received}")

    decision, reason = ctrl.decide(sess.accumulated_text, sess.last_retrieval_query)
    sess.log("decision", f"{decision}: {reason}")

    if decision == "RETRIEVE":
        query = sess.accumulated_text.strip()
        sess.last_retrieval_query = query
        
        for k, v in list(sess.active_tasks.items()):
            if k.startswith("turn_") and not v.done():
                v.cancel()
                sess.active_tasks.pop(k, None)
                
        task = asyncio.create_task(ConversationService.process_turn(body.session_id, body.request_id, query))
        sess.active_tasks[f"turn_{now}"] = task

    return {"status": "ok", "decision": decision, "seq": body.seq}


@router.post("/final", summary="Signal that transcript input is complete; generate answer")
async def final_input(body: FinalInput):
    sess = await session_store.get(body.session_id)
    if not sess or sess.invalidated or sess.active_request_id != body.request_id:
        raise HTTPException(status_code=409, detail="Session not found or invalidated")

    now = time.monotonic()
    sess.final_input_at = now
    word_count = len(sess.accumulated_text.split())
    sess.log("final_input", f"words={word_count}, elapsed={sess.elapsed():.2f}s")

    if sess.active_tasks:
        deadline = time.monotonic() + 45.0
        while sess.active_tasks and time.monotonic() < deadline:
            tasks = list(sess.active_tasks.values())
            try:
                await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=deadline - time.monotonic())
            except (asyncio.TimeoutError, asyncio.CancelledError):
                pass
            
            # Remove completed tasks so we can check if new ones were added
            to_remove = [k for k, v in sess.active_tasks.items() if v.done()]
            for k in to_remove:
                sess.active_tasks.pop(k, None)

    if sess.invalidated:
        raise HTTPException(status_code=409, detail="Session was invalidated during retrieval wait")

    question = sess.accumulated_text.strip()
    last_query = sess.last_retrieval_query
    last_tokens = set(ctrl._content_words(ctrl._tokenize(last_query)))
    final_tokens = set(ctrl._content_words(ctrl._tokenize(question)))
    change = 1.0 - ctrl._jaccard(last_tokens, final_tokens)
    
    if change >= ctrl.JACCARD_CHANGE_THRESHOLD:
        sess.log("decomposition_start", f"Final input requires new search, change={change:.2f}")
        await ConversationService.process_turn(body.session_id, body.request_id, question)
        if sess.active_tasks:
            deadline2 = time.monotonic() + 15.0
            while sess.active_tasks and time.monotonic() < deadline2:
                tasks2 = list(sess.active_tasks.values())
                try:
                    await asyncio.wait_for(asyncio.gather(*tasks2, return_exceptions=True), timeout=deadline2 - time.monotonic())
                except (asyncio.TimeoutError, asyncio.CancelledError):
                    pass
                to_remove = [k for k, v in sess.active_tasks.items() if v.done()]
                for k in to_remove:
                    sess.active_tasks.pop(k, None)

    if sess.invalidated:
        raise HTTPException(status_code=409, detail="Invalidated before answer generation")

    sess.answer_started_at = time.monotonic()
    sess.log("answer_start", f"total_retrieved={len(sess.early_results)}")

    try:
        answer_response = await ConversationService.generate_final_answer(body.session_id, body.request_id, question)
    except Exception as exc:
        sess.log("answer_done", f"error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

    if sess.invalidated:
        raise HTTPException(status_code=409, detail="Invalidated during answer generation")

    sess.answer_done_at = time.monotonic()
    sess.final_answer = answer_response

    metrics = sess.early_retrieval_metrics()
    elapsed_ans = sess.answer_done_at - sess.started_at
    sess.log(
        "answer_done",
        f"elapsed={elapsed_ans:.2f}s, early_started={metrics['started_before_final']}, "
        f"early_completed={metrics['completed_before_final']}, reused={metrics['evidence_reused']}, "
        f"sources={len(answer_response.get('sources', []))}"
    )

    return {
        "status": "done",
        "answer": answer_response,
        "early_retrieval_metrics": metrics,
        "timing": {
            "answer_generation_duration": (
                round(sess.answer_done_at - sess.answer_started_at, 3)
                if sess.answer_done_at and sess.answer_started_at else None
            ),
        },
        "activity": [
            {"ts": round(e.ts, 3), "kind": e.kind, "detail": e.detail}
            for e in sess.activity
        ],
    }


@router.post("/stop", summary="Stop the current transcript request")
async def stop_request(body: StopInput):
    sess = await session_store.get(body.session_id)
    if not sess:
        return {"status": "no_active_session"}

    await session_store.invalidate(body.session_id)
    sess = await session_store.get(body.session_id)
    if sess:
        sess.log("stopped", "stopped by user")

    return {"status": "stopped"}


@router.get("/export/{session_id}", summary="Export session trace")
async def export_session_trace(session_id: str):
    sess = await session_store.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
        
    trace = {
        "session_id": sess.session_id,
        "revision": sess.revision,
        "first_chunk_at": sess.first_chunk_at,
        "final_input_at": sess.final_input_at,
        "started_at": sess.started_at,
        "invalidated": sess.invalidated,
        "answer_version": sess.answer_version,
        "subquestions": [
            {
                "id": sq.id,
                "text": sq.text,
                "status": sq.status,
                "evidence_ids": sq.evidence_ids,
                "reuse_reason": sq.reuse_reason
            } for sq in sess.subquestions.values()
        ],
        "activity": [
            {"ts": e.ts, "kind": e.kind, "detail": e.detail} for e in sess.activity
        ],
        "claims": [
            {"id": c.id, "text": c.text, "status": c.status, "evidence_ids": c.evidence_ids} for c in sess.claims
        ],
        "retrieval_events": [
            {
                "subquestion_id": ev.subquestion_id,
                "retrieval_id": ev.id,
                "query": ev.query_used,
                "triggered_at": ev.triggered_at,
                "completed_at": ev.completed_at,
                "duration": (ev.completed_at - ev.triggered_at) if ev.completed_at else None,
                "result_count": ev.result_count,
                "chunk_ids": [{"chunk_id": r["chunk_id"], "retrieval_id": r.get("retrieval_id", ev.id)} for r in ev.results]
            } for ev in sess.retrieval_events
        ],
        "final_answer": sess.final_answer.get("answer") if sess.final_answer else None,
        "sources": sess.final_answer.get("sources") if sess.final_answer else None,
        "timings": sess.timings
    }
    
    return trace

