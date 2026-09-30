import asyncio
import time
import uuid
import json
from dataclasses import dataclass
from backend.db.session import SessionLocal
from backend.services.retrieval_service import RetrievalService
from backend.models.search import SearchRequest
from backend.services.llm_service import LLMService
from backend.services.conversation_service import ConversationService
from backend.services.session_state import session_store
from backend.core.config import settings

@dataclass
class EvalCase:
    name: str
    chunks: list[str]
    final_query: str
    follow_up: str = None

EVAL_CASES = [
    EvalCase(
        name="Early retrieval opportunity",
        chunks=["What is the budget", " for Project Alpha?"],
        final_query="What is the budget for Project Alpha?"
    ),
    EvalCase(
        name="Short/incomplete request",
        chunks=["Who is "],
        final_query="Who is "
    ),
    EvalCase(
        name="Multiple information needs",
        chunks=["Tell me the budget", " and the lead for", " Project Beta."],
        final_query="Tell me the budget and the lead for Project Beta.",
        follow_up="What about Project Alpha?"
    ),
    EvalCase(
        name="Unsupported questions",
        chunks=["What is the secret", " launch code for Omega?"],
        final_query="What is the secret launch code for Omega?"
    ),
    EvalCase(
        name="Presentation-only follow-up",
        chunks=["What is the budget for Alpha?"],
        final_query="What is the budget for Alpha?",
        follow_up="Can you format that as a bulleted list?"
    ),
]

async def run_baseline(case: EvalCase):
    print(f"\n--- Baseline: {case.name} ---")
    start_time = time.monotonic()
    
    db = SessionLocal()
    try:
        search_req = SearchRequest(query=case.final_query, top_k=5)
        retrieval_start = time.monotonic()
        res = await RetrievalService.search_chunks(db, search_req)
        retrieval_end = time.monotonic()
        
        context_blocks = []
        for i, r in enumerate(res.results):
            label = f"S{i+1}"
            context_blocks.append(f"[{label}]\n{r.document_name}\n\n\"{r.text}\"")
            
        context_str = "\n\n---\n\n".join(context_blocks)
        
        system_instruction = (
            "You are a Baseline AI. Answer the question using the context. "
            "Cite using [S1], [S2]. Identify unsupported parts."
        )
        
        user_prompt = f"CONTEXT:\n{context_str}\n\nQUESTION:\n{case.final_query}"
        
        ans = await LLMService.generate_grounded_answer(system_instruction, user_prompt)
        end_time = time.monotonic()
        
        follow_up_ans = None
        follow_up_time = 0
        if case.follow_up:
            fu_start = time.monotonic()
            search_req_fu = SearchRequest(query=f"{case.final_query} {case.follow_up}", top_k=5)
            res_fu = await RetrievalService.search_chunks(db, search_req_fu)
            fu_context = "\n\n---\n\n".join([f"[{i+1}]\n{r.text}" for i,r in enumerate(res_fu.results)])
            fu_prompt = f"PREVIOUS QUESTION: {case.final_query}\nPREVIOUS ANSWER: {ans}\n\nCONTEXT:\n{fu_context}\n\nFOLLOW UP:\n{case.follow_up}"
            follow_up_ans = await LLMService.generate_grounded_answer(system_instruction, fu_prompt)
            fu_end = time.monotonic()
            follow_up_time = fu_end - fu_start
        
        return {
            "total_time": end_time - start_time,
            "retrieval_time": retrieval_end - retrieval_start,
            "answer": ans,
            "follow_up_answer": follow_up_ans,
            "follow_up_time": follow_up_time,
            "retrieved_count": len(res.results)
        }
    finally:
        db.close()

async def run_streammind(case: EvalCase):
    print(f"\n--- StreamMind: {case.name} ---")
    session_id = str(uuid.uuid4())
    request_id = str(uuid.uuid4())
    
    sess = await session_store.get_or_create(session_id, request_id)
    
    start_time = time.monotonic()
    sess.started_at = start_time
    
    acc_text = ""
    for idx, chunk in enumerate(case.chunks):
        if idx == 0:
            sess.first_chunk_at = time.monotonic()
        acc_text += chunk
        # Trigger streaming controller logic theoretically
        # But we do actual process_turn at final
        await asyncio.sleep(0.1) 
        
    sess.final_input_at = time.monotonic()
    
    # Process turn
    await ConversationService.process_turn(session_id, request_id, case.final_query)
    
    if sess.active_tasks:
        try:
            await asyncio.wait_for(asyncio.gather(*sess.active_tasks.values(), return_exceptions=True), timeout=30.0)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            pass
            
    ans_dict = await ConversationService.generate_final_answer(session_id, request_id, case.final_query)
    end_time = time.monotonic()
    
    time_from_final_input = end_time - sess.final_input_at
    early_retrieval_used = sess.early_retrieval_happened_before_final()
    subquestions_count = len(sess.subquestions)
    
    fu_ans = None
    fu_time = 0
    if case.follow_up:
        fu_req_id = str(uuid.uuid4())
        sess = await session_store.get_or_create(session_id, fu_req_id)
        fu_start = time.monotonic()
        await ConversationService.process_turn(session_id, fu_req_id, case.follow_up)
        if sess.active_tasks:
            await asyncio.wait_for(asyncio.gather(*sess.active_tasks.values(), return_exceptions=True), timeout=30.0)
        fu_ans_dict = await ConversationService.generate_final_answer(session_id, fu_req_id, case.follow_up)
        fu_end = time.monotonic()
        fu_ans = fu_ans_dict["answer"]
        fu_time = fu_end - fu_start
        
    return {
        "total_time_from_first_chunk": end_time - start_time,
        "time_from_final_input": time_from_final_input,
        "answer": ans_dict["answer"],
        "follow_up_answer": fu_ans,
        "follow_up_time": fu_time,
        "early_retrieval_used": early_retrieval_used,
        "subquestions_count": subquestions_count
    }

async def run_all():
    results = {}
    for case in EVAL_CASES:
        bl = await run_baseline(case)
        sm = await run_streammind(case)
        results[case.name] = {
            "baseline": bl,
            "streammind": sm
        }
    
    with open("eval_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print("Done. Saved to eval_results.json")

if __name__ == "__main__":
    asyncio.run(run_all())
