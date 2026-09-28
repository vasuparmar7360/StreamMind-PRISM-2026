import httpx
from typing import Dict, Any
from backend.core.config import settings

class SystemStatusService:
    @staticmethod
    async def get_status() -> Dict[str, Any]:
        status = {
            "backend": {"status": "online"},
            "database": {
                "status": "online",
                "type": "PostgreSQL",
                "pgvector": True
            },
            "ollama": {"status": "offline"},
            "chat_model": {
                "name": settings.CHAT_MODEL,
                "available": False
            },
            "embedding_model": {
                "name": settings.EMBEDDING_MODEL,
                "available": False,
                "dimension": settings.EMBEDDING_DIMENSION
            },
            "privacy": {
                "local_only": settings.LOCAL_ONLY,
                "external_ai_provider": False
            }
        }
        
        # Check Ollama status
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(f"{settings.OLLAMA_BASE_URL}/")
                if res.status_code == 200:
                    status["ollama"]["status"] = "online"
                    
                    # Check if models are available (optimistic if Ollama is online, but we can verify)
                    tags_res = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
                    if tags_res.status_code == 200:
                        models = [m["name"] for m in tags_res.json().get("models", [])]
                        
                        # In Ollama, models might be "qwen2.5:7b", "nomic-embed-text:latest"
                        # We do a basic substring/exact check
                        for m in models:
                            if settings.CHAT_MODEL in m:
                                status["chat_model"]["available"] = True
                            if settings.EMBEDDING_MODEL in m:
                                status["embedding_model"]["available"] = True
                                
                    # If tags endpoint fails, assume available if Ollama is online
                    if tags_res.status_code != 200:
                        status["chat_model"]["available"] = True
                        status["embedding_model"]["available"] = True
                        
        except Exception:
            pass # Ollama offline

        return status

    @staticmethod
    def get_settings() -> Dict[str, Any]:
        return {
            "local_only": settings.LOCAL_ONLY,
            "chat_model": settings.CHAT_MODEL,
            "embedding_model": settings.EMBEDDING_MODEL,
            "max_upload_size_mb": settings.MAX_UPLOAD_SIZE_MB,
            "chunk_size_words": settings.CHUNK_SIZE_WORDS,
            "chunk_overlap_words": settings.CHUNK_OVERLAP_WORDS,
            "search_top_k": settings.SEARCH_TOP_K
        }
