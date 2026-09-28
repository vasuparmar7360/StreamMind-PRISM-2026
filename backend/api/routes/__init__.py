from backend.api.routes.health import router as health_router
from backend.api.routes.documents import router as documents_router
from backend.api.routes.search import router as search_router
from backend.api.routes.ask import router as ask_router
from backend.api.routes.decisions import router as decisions_router
from backend.api.routes.conflicts import router as conflicts_router
from backend.api.routes.actions import router as actions_router

__all__ = ["health_router", "documents_router", "search_router", "ask_router", "decisions_router", "conflicts_router", "actions_router"]

