from fastapi import APIRouter
from backend.services.system_status_service import SystemStatusService
from backend.models.memory import SystemStatusResponse, SettingsResponse

router = APIRouter(tags=["system"])

@router.get("/system/status", response_model=SystemStatusResponse)
async def get_system_status():
    """Returns the current status of system dependencies."""
    return await SystemStatusService.get_status()

@router.get("/settings", response_model=SettingsResponse)
def get_settings():
    """Returns safe application settings."""
    return SystemStatusService.get_settings()
