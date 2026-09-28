from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.services.memory_service import MemoryService
from backend.services.system_status_service import SystemStatusService
from backend.models.memory import (
    MemorySummaryResponse, MemoryInventoryResponse, ProjectMemoryExportResponse
)

router = APIRouter(prefix="/memory", tags=["memory"])

@router.get("/summary", response_model=MemorySummaryResponse)
def get_memory_summary(db: Session = Depends(get_db)):
    """Returns accurate counts of all memory structures."""
    return MemoryService.get_summary(db)

@router.get("", response_model=MemoryInventoryResponse)
def get_memory_inventory(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    """Returns structured overview of stored project memory without embeddings."""
    return MemoryService.get_inventory(db, limit, offset)

@router.get("/export", response_model=ProjectMemoryExportResponse)
def export_memory(db: Session = Depends(get_db)):
    """Exports structured JSON of OwnMind project memory."""
    settings_data = SystemStatusService.get_settings()
    return MemoryService.export_memory(db, settings_data)
