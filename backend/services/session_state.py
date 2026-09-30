"""
StreamMind Session State
========================
Ephemeral in-memory store for active transcript streaming sessions.
"""

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

# Configurable TTL: sessions inactive for this many seconds are cleaned up
SESSION_TTL_SECONDS = 600


@dataclass
class Subquestion:
    """A structured representation of an information need."""
    id: str                       # e.g., "sq1"
    text: str
    entities: List[str]
    status: str = "pending"       # pending, searching, evidence_found, insufficient_evidence, failed
    evidence_ids: List[Any] = field(default_factory=list) # chunk_ids or dicts with provenance
    reuse_reason: Optional[str] = None


@dataclass
class RetrievalEvent:
    """A single retrieval attempt record."""
    id: str                       # unique identifier for this retrieval event
    triggered_at: float           # monotonic time when search was launched
    query_used: str
    subquestion_id: Optional[str] = None # None means full-query search
    completed_at: Optional[float] = None
    results: List[Dict[str, Any]] = field(default_factory=list)
    result_count: int = 0


@dataclass
class ActivityEvent:
    """A displayable event for the frontend activity panel."""
    ts: float                     # monotonic seconds since session start
    kind: str                     # "input" | "decision" | "retrieval_start" | "retrieval_done" ...
    detail: str


@dataclass
class Claim:
    """A factual claim in an answer and its supporting evidence."""
    id: str
    text: str
    evidence_ids: List[str]
    status: str = "active"        # active, invalidated, removed


@dataclass
class ConversationSession:
    """All mutable state for one conversation session across multiple requests."""
    session_id: str
    revision: int = 0             # incremented on new request or invalidation

    # Phase 5: Persistent conversation state
    committed_goal: str = ""
    committed_subquestions: Dict[str, Subquestion] = field(default_factory=dict)
    
    current_goal: str = ""
    original_goal: str = ""  # goal at the start of the current request
    original_subquestions: Dict[str, Subquestion] = field(default_factory=dict)
    subquestions: Dict[str, Subquestion] = field(default_factory=dict)
    claims: List[Claim] = field(default_factory=list)
    answer_version: int = 0
    classified_request_id: Optional[str] = None

    # Transcript state for the CURRENT request
    active_request_id: Optional[str] = None
    accumulated_text: str = ""
    chunks_received: int = 0
    last_seq: int = -1
    first_chunk_at: Optional[float] = None
    final_input_at: Optional[float] = None
    answer_started_at: Optional[float] = None
    answer_done_at: Optional[float] = None

    last_retrieval_query: str = ""
    retrieval_events: List[RetrievalEvent] = field(default_factory=list)
    early_results: List[Dict[str, Any]] = field(default_factory=list)
    active_tasks: Dict[str, asyncio.Task] = field(default_factory=dict)
    final_answer: Optional[Dict[str, Any]] = None
    timings: Dict[str, float] = field(default_factory=dict)
    activity: List[ActivityEvent] = field(default_factory=list)

    started_at: float = field(default_factory=time.monotonic)
    last_activity_at: float = field(default_factory=time.monotonic)
    invalidated: bool = False

    def elapsed(self) -> float:
        return time.monotonic() - self.started_at

    def log(self, kind: str, detail: str):
        self.activity.append(ActivityEvent(ts=self.elapsed(), kind=kind, detail=detail))
        self.last_activity_at = time.monotonic()

    def early_retrieval_metrics(self) -> dict:
        """Return metrics about early retrieval effectiveness."""
        started = False
        completed = False
        reused = False
        
        final_time = self.final_input_at or float('inf')
        
        for ev in self.retrieval_events:
            if ev.triggered_at < final_time:
                started = True
            if ev.completed_at is not None and ev.completed_at < final_time:
                completed = True
                
        # Check if reused based on actual provenance (retrieval_id)
        if self.final_answer and "sources" in self.final_answer:
            used_evidence = {(s["chunk_id"], s.get("retrieval_id")) for s in self.final_answer["sources"]}
            for ev in self.retrieval_events:
                if ev.triggered_at < final_time:
                    for r in ev.results:
                        if (r["chunk_id"], ev.id) in used_evidence:
                            reused = True
                            break
                            
        return {
            "started_before_final": started,
            "completed_before_final": completed,
            "evidence_reused": reused
        }

    def prepare_for_new_request(self, request_id: str, is_new_topic: bool = False):
        if self.active_request_id != request_id:
            self.active_request_id = request_id
            self.revision += 1
            # Restore state to the last COMMITTED state
            self.current_goal = self.committed_goal
            self.subquestions = {k: v for k, v in self.committed_subquestions.items()}
            self.original_goal = self.committed_goal
            self.original_subquestions = {k: v for k, v in self.committed_subquestions.items()}
            self.accumulated_text = ""
            self.chunks_received = 0
            self.last_seq = -1
            self.first_chunk_at = None
            self.final_input_at = None
            self.answer_started_at = None
            self.answer_done_at = None
            self.last_retrieval_query = ""
            self.retrieval_events = []
            self.timings = {}
            self.activity = []
            self.invalidated = False
            self.final_answer = None
            
            # Cancel old tasks
            for task in self.active_tasks.values():
                if not task.done():
                    task.cancel()
            self.active_tasks.clear()
            
            if is_new_topic:
                self.subquestions.clear()
                self.claims.clear()
                self.early_results.clear()
                self.current_goal = ""


class SessionStore:
    """Thread-safe (asyncio) store for ConversationSession objects."""

    def __init__(self):
        self._sessions: Dict[str, ConversationSession] = {}
        self._lock = asyncio.Lock()

    async def get_or_create(self, session_id: str, request_id: str) -> ConversationSession:
        async with self._lock:
            if session_id not in self._sessions:
                self._sessions[session_id] = ConversationSession(session_id=session_id)
            sess = self._sessions[session_id]
            sess.prepare_for_new_request(request_id)
            return sess

    async def get(self, session_id: str) -> Optional[ConversationSession]:
        async with self._lock:
            return self._sessions.get(session_id)

    async def invalidate(self, session_id: str):
        """Cancel running tasks and mark session invalidated."""
        async with self._lock:
            sess = self._sessions.get(session_id)
            if sess:
                sess.invalidated = True
                sess.revision += 1
                for task in sess.active_tasks.values():
                    if not task.done():
                        task.cancel()
                sess.active_tasks.clear()
                sess.log("invalidated", "Session invalidated by Stop")

    async def cleanup_expired(self):
        """Remove sessions idle longer than SESSION_TTL_SECONDS."""
        cutoff = time.monotonic() - SESSION_TTL_SECONDS
        async with self._lock:
            expired = [sid for sid, s in self._sessions.items()
                       if s.last_activity_at < cutoff]
            for sid in expired:
                s = self._sessions.pop(sid)
                for task in s.active_tasks.values():
                    if not task.done():
                        task.cancel()


# Singleton store — module-level, lives for process lifetime
session_store = SessionStore()
