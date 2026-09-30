import json
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized configuration for StreamMind AI Backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    APP_NAME: str = "StreamMind AI Backend"
    APP_VERSION: str = "0.1.0"
    HOST: str = "127.0.0.1"
    PORT: int = 8001
    DEBUG: bool = True
    FRONTEND_URL: str = "http://localhost:3001"
    MAX_UPLOAD_SIZE_MB: int = 25
    CHUNK_SIZE_WORDS: int = 600
    CHUNK_OVERLAP_WORDS: int = 100
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    EMBEDDING_MODEL: str = "nomic-embed-text"
    DATABASE_URL: str = "postgresql+psycopg://vasuparmar@127.0.0.1:5432/ownmind"
    SEARCH_MIN_SIMILARITY: float = 0.5
    CHAT_MODEL: str = "qwen2.5:3b"
    ASK_TOP_K: int = 5
    MAX_CONTEXT_CHARACTERS: int = 4000
    LOCAL_ONLY: bool = True
    EMBEDDING_DIMENSION: int = 768
    SEARCH_TOP_K: int = 5




    # Default allowed origins for local development (supports list, comma-separated string, or JSON array)
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @property
    def allowed_origins(self) -> List[str]:
        """Aggregate CORS_ORIGINS with FRONTEND_URL, deduplicated."""
        raw = self.CORS_ORIGINS
        origins: List[str] = []

        if isinstance(raw, list):
            origins = [str(item).strip() for item in raw if str(item).strip()]
        elif isinstance(raw, str):
            raw_stripped = raw.strip()
            if raw_stripped.startswith("[") and raw_stripped.endswith("]"):
                try:
                    parsed = json.loads(raw_stripped)
                    if isinstance(parsed, list):
                        origins = [str(x).strip() for x in parsed if str(x).strip()]
                except Exception:
                    origins = [x.strip() for x in raw_stripped.split(",") if x.strip()]
            else:
                origins = [x.strip() for x in raw_stripped.split(",") if x.strip()]

        # Ensure FRONTEND_URL is always included
        if self.FRONTEND_URL and self.FRONTEND_URL not in origins:
            origins.append(self.FRONTEND_URL)

        return origins


settings = Settings()
