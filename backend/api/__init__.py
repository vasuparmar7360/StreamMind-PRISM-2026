from fastapi import APIRouter
from backend.api.routes.health import router as health_router
from backend.api.routes.documents import router as documents_router
from backend.api.routes.search import router as search_router
from backend.api.routes.ask import router as ask_router
from backend.api.routes.decisions import router as decisions_router
from backend.api.routes.conflicts import router as conflicts_router
from backend.api.routes.actions import router as actions_router
from backend.api.routes.audit import router as audit_router
from backend.api.routes.memory import router as memory_router
from backend.api.routes.system import router as system_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(documents_router)
api_router.include_router(search_router)
api_router.include_router(ask_router)
api_router.include_router(decisions_router)
api_router.include_router(conflicts_router)
api_router.include_router(actions_router)
api_router.include_router(audit_router)
api_router.include_router(memory_router)
api_router.include_router(system_router)

__all__ = ["api_router"]


