from typing import List
from pydantic import BaseModel

class EmbeddedChunk(BaseModel):
    chunk_id: str
    chunk_index: int
    status: str

class DocumentEmbeddingResponse(BaseModel):
    document_id: str
    original_name: str
    status: str
    model: str
    total_chunks: int
    embedding_dimension: int
    embedded_chunks: List[EmbeddedChunk]
