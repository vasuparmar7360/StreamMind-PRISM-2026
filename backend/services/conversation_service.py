import asyncio
import time
import uuid
import logging
from typing import Dict, Any, List

from backend.services.session_state import session_store, Subquestion, RetrievalEvent, Claim
from backend.services.llm_service import LLMService
from backend.services.retrieval_service import RetrievalService
from backend.models.search import SearchRequest
from backend.db.session import SessionLocal
from backend.core.config import settings

logger = logging.getLogger(__name__)

class ConversationService:
    @staticmethod
    async def process_turn(session_id: str, request_id: str, query: str) -> None:
        """
        Background task to handle a full turn (decomposition, planning, retrieval).
        """
        sess = await session_store.get(session_id)
        if not sess or sess.invalidated or sess.active_request_id != request_id:
            return

        is_followup = bool(sess.original_subquestions)
        new_goal = query
        category = "new_topic"
        classification = {}

        if is_followup:
            sess.log("classification_start", "Classifying follow-up")
            classification = await LLMService.classify_followup(sess.original_goal, sess.original_subquestions, query)
            category = classification.get("category", "new_topic")
            
            lower_q = query.lower()
            if category == "new_topic" and any(k in lower_q for k in ["instead", "keep", "change", "update", "also", "what about"]):
                category = "changed_constraint"
                
            sess.log("classification_done", f"{category} - {classification.get('plan', '')}")

            if category == "ambiguous":
                sess.final_answer = {
                    "question": query,
                    "status": "clarification_needed",
                    "answer": classification.get("clarification_needed", "Could you clarify what you mean?"),
                    "model": settings.CHAT_MODEL,
                    "sources": [],
                    "session_id": session_id,
                }
                return

            if category == "presentation_only":
                return

            if category == "new_topic":
                new_goal = query
            elif category in ("changed_constraint", "removed_info"):
                new_goal = f"{sess.original_goal} (Update: {query})"
            else:
                new_goal = f"{sess.original_goal} (Add: {query})"
        else:
            new_goal = query

        now = time.monotonic()
        
        # Launch early raw search to not be blocked by decomposition
        if not any(e.query_used == query for e in sess.retrieval_events):
            raw_ev = RetrievalEvent(id=uuid.uuid4().hex, triggered_at=now, query_used=query, subquestion_id=None)
            sess.retrieval_events.append(raw_ev)
            sess.log("retrieval_start", "sq=raw")
            raw_task = asyncio.create_task(ConversationService._run_retrieval(session_id, request_id, query, None))
            sess.active_tasks[f"retrieval_raw_{now}"] = raw_task

        # We will decompose the new goal further down based on the classification
        new_subqs = []

        # Wait for raw searches
        for task_id, task in list(sess.active_tasks.items()):
            if "retrieval_raw" in task_id:
                try:
                    await task
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    sess.log("error", f"Raw task failed: {e}")
        
        sess = await session_store.get(session_id)
        if not sess or sess.invalidated or sess.active_request_id != request_id:
            return

        # Use all early results so we can reuse evidence even if it was previously assigned to an old subquestion
        early_raw_results = [r for r in sess.early_results]
        sess.log("debug", f"Found {len(early_raw_results)} early raw results.")
        
        # Plan the updates transactionally based on the original subquestions
        old_texts = {sq.text: sq for sq in sess.original_subquestions.values()}
        
        pending_evals = []
        replacement_subquestions = {}
        
        sess.log("debug_goal", f"Classification category: {category}, affected_ids: {classification.get('affected_subquestion_ids', [])}")
        
        if is_followup:
            t0 = time.monotonic()
            plan_result = await LLMService.build_update_plan(sess.original_goal, sess.original_subquestions, query)
            sess.timings['update_plan_wall_clock'] = time.monotonic() - t0
            
            new_goal = plan_result.get("new_goal", query)
            sess.current_goal = new_goal
            
            print(f"[DEBUG UPDATE PLAN] plan_result={plan_result}")
            
            retained_ids = plan_result.get("retained_ids", [])
            new_subqs = plan_result.get("new_subquestions", [])
            
            for old_id in retained_ids:
                if old_id in sess.original_subquestions:
                    old_sq = sess.original_subquestions[old_id]
                    sess.log("subquestion_reused", f"Retained unchanged subquestion via plan: {old_id} - {old_sq.text}")
                    replacement_subquestions[old_id] = old_sq
            
            for sq_data in new_subqs:
                sq_id = f"sq_{uuid.uuid4().hex[:4]}"
                sq_data["id"] = sq_id
                pending_evals.append(sq_data)
                
            sess.log("debug", f"Update plan: retained={retained_ids}, new={len(new_subqs)}")
        else:
            new_goal = query
            sess.current_goal = new_goal
            
            try:
                t0 = time.monotonic()
                decomp, timings = await LLMService.decompose_query(new_goal)
                sess.timings['decomposition_wall_clock'] = time.monotonic() - t0
                sess.timings['decomposition_llm_eval'] = timings['eval_duration']
                sess.log("llm_timings", f"decomposition: load={timings['load_duration']:.2f}s, eval={timings['eval_duration']:.2f}s")
                new_subqs = decomp.get("subquestions", [])
            except Exception as e:
                sess.log("decomposition_failed", str(e))
                new_subqs = [{"text": new_goal, "entities": []}]
                
            for sq_data in new_subqs:
                sq_id = f"sq_{uuid.uuid4().hex[:4]}"
                sq_data["id"] = sq_id
                pending_evals.append(sq_data)
                
        # 2. Evaluate new subquestions
        async def evaluate_and_process(sq_data):
            text = sq_data["text"]
            sq_id = sq_data["id"]
            entities = sq_data.get("entities", [])
            
            t_val_start = time.monotonic()
            eval_result = await LLMService.evaluate_evidence(text, early_raw_results)
            supported = eval_result["supported"]
            valid_chunk_ids = eval_result["matching_chunk_ids"]
            reuse_reason = eval_result["reason"]
            val_dur = time.monotonic() - t_val_start
            
            reused_chunks = [r for r in early_raw_results if r["chunk_id"] in valid_chunk_ids]
            
            return {
                "id": sq_id,
                "text": text,
                "entities": entities,
                "supported": supported,
                "reused_chunks": reused_chunks,
                "reuse_reason": reuse_reason,
                "val_dur": val_dur
            }

        eval_results = await asyncio.gather(*(evaluate_and_process(sq) for sq in pending_evals))
        
        sess = await session_store.get(session_id)
        if not sess or sess.invalidated or sess.active_request_id != request_id:
            return

        # 3. Apply updates transactionally
        sess.current_goal = new_goal

        if is_followup and category == "new_topic":
            sess.claims.clear()
            # DO NOT clear sess.early_results here, as retained subquestions need their evidence.
            # The loop below safely removes evidence for subquestions that are actually removed.
        
        # Handle removed info
        for old_id, old_sq in sess.original_subquestions.items():
            if old_id not in replacement_subquestions:
                sess.log("subquestion_removed", f"Invalidating {old_id} - {old_sq.text}")
                sess.early_results = [r for r in sess.early_results if r.get("subquestion_id") != old_id]
                for claim in sess.claims:
                    if claim.status == "active":
                        claim.status = "invalidated"
        
        for res in eval_results:
            sq_id = res["id"]
            text = res["text"]
            entities = res["entities"]
            supported = res["supported"]
            reused_chunks = res["reused_chunks"]
            reuse_reason = res["reuse_reason"]
            val_dur = res["val_dur"]
            
            sess.log("llm_timings", f"evaluation for {sq_id}: wall={val_dur:.2f}s")
            
            if supported and reused_chunks:
                replacement_subquestions[sq_id] = Subquestion(
                    id=sq_id, text=text, entities=entities,
                    status="evidence_found",
                    evidence_ids=[{"chunk_id": r["chunk_id"], "retrieval_id": r.get("retrieval_id")} for r in reused_chunks],
                    reuse_reason=reuse_reason
                )
                for r in reused_chunks:
                    new_r = r.copy()
                    new_r["subquestion_id"] = sq_id
                    sess.early_results.append(new_r)
                sess.log("evidence_audit", f"Early evidence reused for {sq_id}: {reuse_reason}")
            else:
                replacement_subquestions[sq_id] = Subquestion(
                    id=sq_id, text=text, entities=entities,
                    reuse_reason=reuse_reason if early_raw_results else "No early raw results available"
                )
                
                # Launch search
                replacement_subquestions[sq_id].status = "searching"
                now = time.monotonic()
                rev_ev = RetrievalEvent(id=uuid.uuid4().hex, triggered_at=now, query_used=text, subquestion_id=sq_id)
                sess.retrieval_events.append(rev_ev)
                sess.log("retrieval_start", f"sq={sq_id}")
                
                task = asyncio.create_task(ConversationService._run_retrieval(session_id, request_id, text, sq_id))
                sess.active_tasks[f"retrieval_{sq_id}_{now}"] = task

        sess.subquestions = replacement_subquestions

    @staticmethod
    async def _run_retrieval(session_id: str, request_id: str, query: str, subq_id: str):
        sess = await session_store.get(session_id)
        if not sess or sess.invalidated or sess.active_request_id != request_id:
            return

        rev_at_start = sess.revision
        t_start = time.monotonic()

        ev = next(
            (e for e in sess.retrieval_events if e.query_used == query and e.subquestion_id == subq_id and e.completed_at is None),
            None
        )
        if ev is None:
            return

        db = SessionLocal()
        try:
            search_req = SearchRequest(query=query, top_k=5)
            result = await RetrievalService.search_chunks(db, search_req)
            t_end = time.monotonic()

            sess = await session_store.get(session_id)
            if not sess or sess.invalidated or sess.active_request_id != request_id or sess.revision != rev_at_start:
                return

            ev.completed_at = t_end
            ev.results = [
                {
                    "chunk_id": r.chunk_id,
                    "document_id": r.document_id,
                    "document_name": r.document_name,
                    "chunk_index": r.chunk_index,
                    "text": r.text,
                    "similarity_score": r.similarity_score,
                    "subquestion_id": subq_id,
                    "retrieval_id": ev.id,
                }
                for r in result.results
            ]
            ev.result_count = len(ev.results)
            
            ev.result_count = len(ev.results)
            
            if subq_id is not None and subq_id in sess.subquestions:
                sq = sess.subquestions[subq_id]
                
                # Evaluate the retrieved results
                eval_result = await LLMService.evaluate_evidence(sq.text, ev.results)
                supported = eval_result["supported"]
                valid_chunk_ids = eval_result["matching_chunk_ids"]
                reason = eval_result["reason"]
                valid_results = [r for r in ev.results if r["chunk_id"] in valid_chunk_ids]
                
                seen = {r["chunk_id"] for r in sess.early_results if r.get("subquestion_id") == subq_id}
                for r in valid_results:
                    if r["chunk_id"] not in seen:
                        sess.early_results.append(r)
                        seen.add(r["chunk_id"])
                
                sq.status = "evidence_found" if supported and len(valid_results) > 0 else "insufficient_evidence"
                sq.evidence_ids.extend({"chunk_id": r["chunk_id"], "retrieval_id": ev.id} for r in valid_results)
                if not supported or not valid_results:
                    sq.reuse_reason = reason
            elif subq_id is None:
                seen = {r["chunk_id"] for r in sess.early_results if r.get("subquestion_id") is None}
                for r in ev.results:
                    if r["chunk_id"] not in seen:
                        sess.early_results.append(r)
                        seen.add(r["chunk_id"])
            else:
                seen = {r["chunk_id"] for r in sess.early_results if r.get("subquestion_id") == subq_id}
                for r in ev.results:
                    if r["chunk_id"] not in seen:
                        sess.early_results.append(r)
                        seen.add(r["chunk_id"])

            sess.log("retrieval_done", f"{ev.result_count} results for {subq_id or 'raw'}")

        except asyncio.CancelledError:
            sess = await session_store.get(session_id)
            if sess:
                sess.log("retrieval_done", f"cancelled for {subq_id}")
            raise
        except Exception as exc:
            sess = await session_store.get(session_id)
            if sess:
                sess.log("retrieval_done", f"error for {subq_id}: {exc}")
                if subq_id in sess.subquestions:
                    sess.subquestions[subq_id].status = "failed"
        finally:
            db.close()

    @staticmethod
    async def generate_final_answer(session_id: str, request_id: str, query: str) -> dict:
        sess = await session_store.get(session_id)
        if not sess or sess.invalidated or sess.active_request_id != request_id:
            raise ValueError("Session invalid")

        if sess.final_answer:
            return sess.final_answer

        stored = sess.early_results
        context_blocks = []
        total_chars = 0
        max_chars = settings.MAX_CONTEXT_CHARACTERS

        fused_results = []
        supported_subqs = []
        unsupported_subqs = []
        for sq in sess.subquestions.values():
            if sq.status == "evidence_found":
                supported_subqs.append(sq.text)
                sq_results = [r for r in stored if r.get("subquestion_id") == sq.id]
                sq_results.sort(key=lambda r: r["similarity_score"], reverse=True)
                fused_results.extend(sq_results[:3])
            else:
                unsupported_subqs.append(sq.text)
            
        raw_results = [r for r in stored if r.get("subquestion_id") is None]
        if raw_results and not any(sq.status == "evidence_found" for sq in sess.subquestions.values()):
            sess.log("evidence_audit", "Raw early evidence bypassed; none satisfied subquestion constraints. Using raw.")
            fused_results.extend(raw_results[:3])
        
        unique_fused = []
        seen_chunks = set()
        for r in sorted(fused_results, key=lambda r: r["similarity_score"], reverse=True):
            if r["chunk_id"] not in seen_chunks:
                unique_fused.append(r)
                seen_chunks.add(r["chunk_id"])

        sources = []
        for i, res in enumerate(unique_fused):
            label = f"S{i + 1}"
            if total_chars + len(res["text"]) > max_chars:
                break
            total_chars += len(res["text"])
            excerpt = res["text"]
            sources.append({
                "label": label,
                "document_id": res["document_id"],
                "document_name": res["document_name"],
                "chunk_id": res["chunk_id"],
                "chunk_index": res["chunk_index"],
                "excerpt": excerpt,
                "similarity_score": res["similarity_score"],
                "retrieval_id": res.get("retrieval_id")
            })
            context_blocks.append(f"EVIDENCE {len(context_blocks) + 1} (Citation label: [{label}], Source: {res['document_name']}):\n{excerpt}")

        context_str = "\n\n".join(context_blocks)
        
        sq_context = ""
        if supported_subqs:
            sq_context += "SUPPORTED SUBQUESTIONS (Evidence provided below):\n" + "\n".join(f"- {text}" for text in supported_subqs) + "\n\n"
        if unsupported_subqs:
            sq_context += "UNSUPPORTED REQUEST (No supporting evidence found):\n" + "\n".join(f"- {text} — no supporting evidence found" for text in unsupported_subqs) + "\n\n"
        
        old_answer_ctx = ""
        if sess.claims:
            import re
            prev_text = re.sub(r'\[[sS]\d+\]', '', sess.claims[-1].text)
            old_answer_ctx = f"PREVIOUS ANSWER CONTEXT (Use for conversational context only, NOT as evidence):\n{prev_text}\n\n"

        system_instruction = (
            "You are StreamMind AI. "
            "You are updating or generating a new answer based on the user's latest follow-up. "
            "The current goal subquestions are:\n"
            f"{sq_context}"
            f"{old_answer_ctx}"
            "Generate ONE coherent answer covering all subquestions. "
            "CRITICAL: Answer ONLY the specific properties requested based on the UNTRUSTED PROJECT EVIDENCE provided below. "
            "NEVER infer that a value from one quarter/year/project/entity also applies to another. "
            "If the requested value is absent from the UNTRUSTED PROJECT EVIDENCE, explicitly state that it is not present in the available evidence. Do NOT use the PREVIOUS ANSWER CONTEXT to fill in missing values. "
            "Do not transform evidence from one period (e.g. Q2) into another (e.g. Q3). Do not fill missing values from related facts.\n"
        )
        
        if sources:
            system_instruction += (
                "\n\n*** CITATION REQUIREMENT (STRICT) ***\n"
                "You MUST add inline citations using the EXACT label provided (e.g. [S1], [S2]) immediately after EVERY fact you state.\n"
                "FAILURE TO INCLUDE CITATIONS WILL RESULT IN SYSTEM ERROR. Every sentence drawn from evidence MUST end with its citation.\n"
                "If a value is not found, state it is missing, without a citation."
            )
        else:
            system_instruction += (
                "\n\nNo evidence is provided for these questions. State clearly that the information is not provided. Do NOT output any citations like [S1]."
            )
        
        user_prompt = (
            f"UNTRUSTED PROJECT EVIDENCE:\n{context_str}\n\n"
            f"GOAL (ANSWER THIS COMPLETELY):\n{sess.current_goal}\n"
        )

        t0 = time.monotonic()
        answer_text, timings = await LLMService.generate_grounded_answer(system_instruction, user_prompt)
        sess.timings['generation_wall_clock'] = time.monotonic() - t0
        sess.timings['generation_llm_eval'] = timings['eval_duration']
        sess.log("llm_timings", f"generation: load={timings['load_duration']:.2f}s, eval={timings['eval_duration']:.2f}s")
        sess.log("raw_answer", answer_text)

        import re
        valid_labels = {s["label"] for s in sources}
        
        def validate_citations_debug(text, phase="INITIAL"):
            citations = list(set(re.findall(r'\[[sS]\d+\]', text)))
            
            print(f"\n[CITATION DEBUG - {phase}]")
            print(f"valid_labels = {valid_labels}")
            
            # Print sources info
            sources_info = []
            for s in sources:
                sources_info.append({
                    "label": s.get("label"),
                    "document_name": s.get("document_name"),
                    "chunk_id": s.get("chunk_id"),
                    "subquestion_id": s.get("subquestion_id")
                })
            print(f"sources = {sources_info}")
            
            print(f"detected_citations = {citations}")
            print(f"raw_answer = {repr(text)}")
            
            normalized = [c.upper()[1:-1] for c in citations]
            print(f"normalized = {normalized}")
            
            if not citations and sources:
                print("validation_result = False")
                print("reason = Missing citations")
                return False, "Missing citations"
            for c, norm in zip(citations, normalized):
                if norm not in valid_labels:
                    print("validation_result = False")
                    print(f"reason = Invalid citation {c} (normalized to {norm})")
                    return False, f"Invalid citation {c}"
                    
            print("validation_result = True")
            print("reason = Valid")
            return True, ""

        is_valid, reason = validate_citations_debug(answer_text, phase="INITIAL")
        if not is_valid:
            repair_prompt = f"The previous answer failed citation validation ({reason}). Rewrite it to only use valid labels {list(valid_labels)} immediately after the facts they support. If there are no valid labels, do not use any citations:\n\n{answer_text}"
            answer_text, _ = await LLMService.generate_grounded_answer(system_instruction, user_prompt + "\n\n" + repair_prompt)
            print(f"\n[CITATION DEBUG - REPAIR ANSWER]")
            print(f"repaired_answer = {repr(answer_text)}")
            is_valid, reason = validate_citations_debug(answer_text, phase="REPAIR")
            if not is_valid:
                sess.log("citation_validation", f"Failed repair: {reason}")
        
        sess = await session_store.get(session_id)
        if not sess or sess.invalidated or sess.active_request_id != request_id:
            raise ValueError("Session invalid after generation")

        status = "answered" if (is_valid or not sources) else "citation_failed"
        if not is_valid and not sources and not set(re.findall(r'\[[A-Z]\d+\]', answer_text)):
            status = "answered"
        elif not is_valid:
            status = "citation_failed"
            answer_text = "Validation Failed: The model generated hallucinated or unsupported source labels."
            
        lower = answer_text.lower()
        if status != "citation_failed" and ("insufficient" in lower or "cannot find" in lower or "no information" in lower):
            status = "insufficient_evidence"

        # Update claims in session
        if status != "citation_failed":
            sess.answer_version += 1
            new_claim = Claim(id=f"c_{sess.answer_version}", text=answer_text, evidence_ids=[s["chunk_id"] for s in sources])
            sess.claims.append(new_claim)
            
        # ALWAYS commit the state so follow-ups work even after a generation failure
        sess.committed_goal = sess.current_goal
        sess.committed_subquestions = {k: v for k, v in sess.subquestions.items()}

        # What changed summary
        what_changed = f"Version {sess.answer_version}: Updated answer based on new request."
        if not sources and len(sess.subquestions) > 0:
            what_changed = "No new evidence required for presentation formatting."
        elif status == "citation_failed":
            what_changed = "Answer generation failed citation validation."

        return {
            "question": query,
            "status": status,
            "answer": answer_text,
            "model": settings.CHAT_MODEL,
            "sources": sources,
            "session_id": session_id,
            "answer_version": sess.answer_version,
            "what_changed": what_changed
        }
