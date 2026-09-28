from pydantic import BaseModel

class DocumentResponse(BaseModel):
    id: str
    original_name: str
    stored_name: str
    extension: str
    size_bytes: int
    status: str
