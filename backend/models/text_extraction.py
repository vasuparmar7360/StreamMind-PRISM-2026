from pydantic import BaseModel

class DocumentTextResponse(BaseModel):
    document_id: str
    original_name: str
    status: str
    character_count: int
    word_count: int
    text: str
