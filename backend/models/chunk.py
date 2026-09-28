from typing import List
from pydantic import BaseModel

class Chunk(BaseModel):
    chunk_id: str
    chunk_index: int
    word_count: int
    character_count: int
    text: str

class ChunkingResponse(BaseModel):
    document_id: str
    original_name: str
    total_chunks: int
    chunks: List[Chunk]
