from pydantic import BaseModel, Field
from typing import List

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="The natural-language query to search for.")
    top_k: int = Field(default=5, ge=1, le=20, description="The maximum number of results to return.")

class SearchResult(BaseModel):
    chunk_id: str
    document_id: str
    document_name: str
    chunk_index: int
    text: str
    similarity_score: float

class SearchResponse(BaseModel):
    query: str
    total_results: int
    results: List[SearchResult]
