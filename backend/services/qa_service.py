from sqlalchemy.orm import Session
from fastapi import HTTPException
from backend.models.ask import AskRequest, AskResponse, AskSource
from backend.models.search import SearchRequest
from backend.services.retrieval_service import RetrievalService
from backend.services.llm_service import LLMService
from backend.core.config import settings
import logging
import re

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = """You are StreamMind AI, a knowledge assistant that answers strictly from the supplied document evidence.

Answer only from the supplied project evidence.
Do not use outside knowledge to invent facts.
If the evidence is insufficient, explicitly say that the available evidence is insufficient to answer this question.
If multiple sources disagree and the system has not yet established which one is authoritative, state that the evidence conflicts.
Cite factual statements using the provided source labels such as [S1] or [S2].
Do not invent citations.
Do not claim that an action was completed unless the evidence explicitly shows that it was completed.
"""

# Topic keywords used to detect whether a question is about a conflicted topic.
# Kept deliberately broad — false positives just add a precautionary note.
TOPIC_KEYWORDS: dict[str, list[str]] = {
    "database":          ["database", "db", "postgresql", "mongodb", "mysql", "sqlite"],
    "backend_framework": ["backend", "framework", "flask", "fastapi", "django", "express"],
    "demo_date":         ["demo", "presentation", "showcase", "demo date"],
    "presentation_owner":["presenter", "presentation owner", "demo lead"],
}


def _detect_topics_in_question(question: str) -> list[str]:
    """Returns normalized topic keys that appear to be referenced in the question."""
    q = question.lower()
    found = []
    for topic_key, keywords in TOPIC_KEYWORDS.items():
        if any(kw in q for kw in keywords):
            found.append(topic_key)
    return found


class QAService:
    @staticmethod
    async def ask_question(db: Session, request: AskRequest) -> AskResponse:
        # Import here to avoid circular import at module load time
        from backend.services.conflict_detection_service import ConflictDetectionService

        try:
            # ── Step 18: Check for open conflicts relevant to this question ──
            detected_topics = _detect_topics_in_question(request.question)
            open_conflicts = []
            for topic_key in detected_topics:
                topic_conflicts = ConflictDetectionService.get_open_conflicts_for_topic(
                    db, topic_key
                )
                open_conflicts.extend(topic_conflicts)

            # Build conflict warning block if any open conflicts found
            conflict_warning = ""
            if open_conflicts:
                conflict_warning = ConflictDetectionService.build_conflict_warning(open_conflicts)

            # ── 1. Retrieve semantic evidence ────────────────────────────────
            search_req = SearchRequest(query=request.question, top_k=request.top_k)
            search_response = await RetrievalService.search_chunks(db, search_req)

            # ── 2. If no evidence AND open conflicts, return conflict notice ──
            if search_response.total_results == 0:
                if conflict_warning:
                    return AskResponse(
                        question=request.question,
                        status="conflicting_evidence",
                        answer=(
                            conflict_warning
                            + "\nI could not find additional indexed evidence to answer "
                            "this question. Please resolve the conflict above."
                        ),
                        model=settings.CHAT_MODEL,
                        sources=[],
                    )
                return AskResponse(
                    question=request.question,
                    status="insufficient_evidence",
                    answer="I could not find enough evidence in the indexed project documents to answer this question.",
                    model=settings.CHAT_MODEL,
                    sources=[],
                )

            # ── 3. Build sources & context ───────────────────────────────────
            sources = []
            context_blocks = []
            total_chars = 0

            for i, res in enumerate(search_response.results):
                label = f"S{i+1}"
                if total_chars + len(res.text) > settings.MAX_CONTEXT_CHARACTERS:
                    break
                total_chars += len(res.text)

                sources.append(AskSource(
                    label=label,
                    document_id=res.document_id,
                    document_name=res.document_name,
                    chunk_id=res.chunk_id,
                    chunk_index=res.chunk_index,
                    excerpt=res.text,
                    similarity_score=res.similarity_score,
                ))
                context_blocks.append(
                    f"[{label}]\n{res.document_name}\nChunk {res.chunk_index}\n\n\"{res.text}\""
                )

            context_str = "\n\n---\n\n".join(context_blocks)

            # ── 4. Inject conflict preamble into the user prompt ─────────────
            conflict_preamble = ""
            if conflict_warning:
                conflict_preamble = (
                    "IMPORTANT: The project knowledge base contains an open, "
                    "unresolved conflict on this topic. Do NOT present one answer "
                    "as definitively correct. Report both values and cite their sources. "
                    "State explicitly that this conflict has not been resolved.\n\n"
                    + conflict_warning
                    + "\n\n"
                )

            user_prompt = (
                f"{conflict_preamble}"
                f"UNTRUSTED PROJECT EVIDENCE:\n{context_str}\n\n"
                f"USER QUESTION:\n{request.question}\n"
            )

            # ── 5. Generate answer ────────────────────────────────────────────
            answer, _ = await LLMService.generate_grounded_answer(SYSTEM_INSTRUCTION, user_prompt)

            # ── 6. Determine response status ─────────────────────────────────
            if open_conflicts:
                # Always mark as conflicting when open conflicts exist for this topic,
                # regardless of what the LLM says
                status = "conflicting_evidence"
                # Prepend the conflict notice to the answer surface
                answer = conflict_warning + "\n" + answer
            else:
                status = "answered"
                lower_ans = answer.lower()
                if "evidence conflicts" in lower_ans or "conflicting information" in lower_ans:
                    status = "conflicting_evidence"
                elif "insufficient" in lower_ans or "could not find enough evidence" in lower_ans:
                    status = "insufficient_evidence"

            return AskResponse(
                question=request.question,
                status=status,
                answer=answer,
                model=settings.CHAT_MODEL,
                sources=sources,
                session_id=request.session_id,
            )

        except HTTPException as e:
            if e.status_code == 503:
                # Ollama unavailable — but still surface conflict warning if relevant
                from backend.services.conflict_detection_service import ConflictDetectionService
                detected_topics = _detect_topics_in_question(request.question)
                open_conflicts = []
                for topic_key in detected_topics:
                    open_conflicts.extend(
                        ConflictDetectionService.get_open_conflicts_for_topic(db, topic_key)
                    )
                if open_conflicts:
                    conflict_warning = ConflictDetectionService.build_conflict_warning(open_conflicts)
                    return AskResponse(
                        question=request.question,
                        status="conflicting_evidence",
                        answer=(
                            conflict_warning
                            + "\n(The local language model is currently unavailable; "
                            "conflict information shown above from the knowledge base.)"
                        ),
                        sources=[],
                        session_id=request.session_id,
                    )
                return AskResponse(
                    question=request.question,
                    status="model_unavailable",
                    answer="The local language or embedding model is currently unavailable. Ensure Ollama is running and qwen2.5:3b is pulled.",
                    sources=[],
                    session_id=request.session_id,
                )
            raise e
        except Exception as e:
            logger.error(f"Error in QAService: {e}")
            raise HTTPException(status_code=500, detail="An error occurred while generating the answer.")
