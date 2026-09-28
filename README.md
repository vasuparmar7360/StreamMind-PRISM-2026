# OwnMind AI Backend

This is the backend for OwnMind AI, a completely private, local-first second brain project built with FastAPI, PostgreSQL, pgvector, and Ollama.

## Quick Start (Startup Sequence)

1. **Start PostgreSQL**: Ensure your local Postgres server is running and the `ownmind` database is created with the `pgvector` extension enabled.
2. **Start Ollama**: Run the Ollama app locally. Ensure `OLLAMA_BASE_URL` in `.env` (default: `http://127.0.0.1:11434`) is reachable.
3. **Verify Local Models**:
   ```bash
   ollama pull qwen2.5:3b
   ollama pull nomic-embed-text
   ```
4. **Start FastAPI Backend**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```
5. **Start Next.js Frontend**:
   ```bash
   npm install
   npm run dev
   ```

## API Documentation
Once running, interactive API docs are available at: http://127.0.0.1:8000/docs
