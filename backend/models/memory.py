from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from datetime import datetime

class MemorySummaryResponse(BaseModel):
    documents_uploaded: int
    documents_indexed: int
    total_chunks: int
    active_decisions: int
    replaced_decisions: int
    ambiguous_decisions: int
    open_conflicts: int
    pending_actions: int
    executed_actions: int
    audit_events: int

class TraceableDecision(BaseModel):
    id: str
    topic: str
    value: str
    status: str
    reason: Optional[str]
    source_document: Optional[str]
    source_document_id: Optional[str]
    source_chunk_id: Optional[str]
    source_date: Optional[str]

class MemoryInventoryResponse(BaseModel):
    documents: List[Dict[str, Any]]
    active_decisions: List[TraceableDecision]
    historical_decisions: List[TraceableDecision]
    open_conflicts: List[Dict[str, Any]]
    pending_actions: List[Dict[str, Any]]

class SystemStatusResponse(BaseModel):
    backend: Dict[str, str]
    database: Dict[str, Any]
    ollama: Dict[str, str]
    chat_model: Dict[str, Any]
    embedding_model: Dict[str, Any]
    privacy: Dict[str, bool]

class SettingsResponse(BaseModel):
    local_only: bool
    chat_model: str
    embedding_model: str
    max_upload_size_mb: int
    chunk_size_words: int
    chunk_overlap_words: int
    search_top_k: int

class DependencyCheckResponse(BaseModel):
    status: str
    dependencies: Dict[str, List[Dict[str, Any]]]

class ProjectMemoryExportResponse(BaseModel):
    product: str
    export_version: str
    created_at: str
    memory: Dict[str, Any]
    settings: Dict[str, Any]
