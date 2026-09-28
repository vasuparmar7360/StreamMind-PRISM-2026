import os
import sys

# Add the project root to sys.path so we can import backend
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.db.session import engine
from backend.db.base import Base
from backend.db.models import Document, DocumentChunk, Decision, Conflict, ActionProposal, AuditEvent

def init_db():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully.")

if __name__ == "__main__":
    init_db()
