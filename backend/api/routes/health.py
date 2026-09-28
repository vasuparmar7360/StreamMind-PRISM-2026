from fastapi import APIRouter
from backend.core.config import settings

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", summary="Health Check")
@router.get("/", include_in_schema=False)
async def health_check():
    """Health check endpoint to verify backend operational status."""
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "local": True,
    }
