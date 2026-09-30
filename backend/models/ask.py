from pydantic import BaseModel, Field
from typing import List, Optional

class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, description="The natural-language question to ask.")
    top_k: int = Field(default=5, ge=1, le=10, description="The maximum number of chunks to retrieve for context.")
    session_id: Optional[str] = Field(default=None, description="Opaque session identifier for conversation isolation.")

class AskSource(BaseModel):
    label: str
    document_id: str
    document_name: str
    chunk_id: str
    chunk_index: int
    excerpt: str
    similarity_score: float

class AskResponse(BaseModel):
    question: str
    status: str # answered, insufficient_evidence, conflicting_evidence, model_unavailable
    answer: str
    model: Optional[str] = None
    sources: List[AskSource] = []
    session_id: Optional[str] = None  # Echoed back so frontend can bind responses to sessions
    answer_version: Optional[int] = None
    what_changed: Optional[str] = None
