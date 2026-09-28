import httpx
from typing import List, Dict, Any
from fastapi import HTTPException
from backend.core.config import settings
from backend.models.chunk import Chunk

class EmbeddingService:
    @staticmethod
    async def is_ollama_available() -> bool:
        """
        Check if Ollama is running and reachable locally.
        """
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.get(f"{settings.OLLAMA_BASE_URL}/")
                return response.status_code == 200
        except Exception:
            return False

    @staticmethod
    async def embed_text(text: str) -> List[float]:
        """
        Embeds a single piece of text using the local Ollama model.
        """
        text = text.strip()
        if not text:
            raise ValueError("Empty text provided for embedding.")
            
        url = f"{settings.OLLAMA_BASE_URL}/api/embeddings"
        payload = {
            "model": settings.EMBEDDING_MODEL,
            "prompt": text
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload)
                
            if response.status_code != 200:
                raise Exception(f"Ollama returned {response.status_code}: {response.text}")
                
            data = response.json()
            embedding = data.get("embedding")
            if not embedding or not isinstance(embedding, list):
                raise Exception("Invalid embedding format returned from Ollama.")
                
            return embedding
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail="Local embedding service is unavailable.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")

    @staticmethod
    async def embed_chunks(chunks: List[Chunk]) -> List[Dict[str, Any]]:
        """
        Embeds a list of chunks and retains metadata.
        Returns a list of dicts with the full vector accessible to the service layer.
        """
        results = []
        for chunk in chunks:
            text = chunk.text.strip()
            if not text:
                continue
                
            embedding = await EmbeddingService.embed_text(text)
            
            results.append({
                "chunk_id": chunk.chunk_id,
                "chunk_index": chunk.chunk_index,
                "embedding": embedding,
                "embedding_dimension": len(embedding),
                "model": settings.EMBEDDING_MODEL
            })
            
        return results
