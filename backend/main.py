import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio

# Ensure the project root is in sys.path for clean, reliable imports
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.core.config import settings
from backend.api import api_router

from backend.services.session_state import session_store

async def session_cleanup_task():
    while True:
        await asyncio.sleep(60)
        await session_store.cleanup_expired()

@asynccontextmanager
async def lifespan(app: FastAPI):
    cleanup_task = asyncio.create_task(session_cleanup_task())
    yield
    cleanup_task.cancel()

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend service for OwnMind AI — Sovereign Second Brain for Project Teams.",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS configuration for local frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(api_router, prefix="/api")


@app.get("/", summary="Root Endpoint")
async def root():
    """Root entry point confirming backend availability."""
    return {
        "message": "StreamMind AI Backend is running",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
