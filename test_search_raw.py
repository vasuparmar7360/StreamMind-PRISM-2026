import asyncio
from backend.services.retrieval_service import RetrievalService
from backend.db.session import SessionLocal
from backend.models.search import SearchRequest

async def main():
    db = SessionLocal()
    req = SearchRequest(query="What is the Alpha project budget and who leads the Beta project?", min_similarity=0.3)
    results = await RetrievalService.search_chunks(db, req)
    for r in results.results:
        print(f"Score: {r.similarity_score:.4f}, Doc: {r.document_name}")

asyncio.run(main())
