from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.core.config import settings
import psycopg
import logging

logger = logging.getLogger(__name__)

engine = None
SessionLocal = None

try:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
except Exception as e:
    logger.error(f"Failed to initialize database engine: {e}")

def get_db():
    if not SessionLocal:
        raise Exception("Database session factory is not initialized. Is PostgreSQL running?")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
