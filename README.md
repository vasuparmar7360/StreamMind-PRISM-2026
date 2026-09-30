# StreamMind PRISM 2026

> **Sovereign AI Knowledge Engine** — Upload documents, extract structured knowledge, and chat with your data using a fully local LLM stack. No cloud. No data leaves your machine.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [1. Clone the repository](#1-clone-the-repository)
  - [2. Set up the Python backend](#2-set-up-the-python-backend)
  - [3. Set up PostgreSQL](#3-set-up-postgresql)
  - [4. Set up Ollama (local LLM)](#4-set-up-ollama-local-llm)
  - [5. Set up the Next.js frontend](#5-set-up-the-nextjs-frontend)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Usage Guide](#usage-guide)
  - [Uploading Documents](#uploading-documents)
  - [Knowledge Extraction](#knowledge-extraction)
  - [Asking Questions (RAG)](#asking-questions-rag)
  - [Same-Session Follow-up Questions](#same-session-follow-up-questions)
  - [Decisions & Actions](#decisions--actions)
- [RAG Pipeline Deep Dive](#rag-pipeline-deep-dive)
- [API Reference](#api-reference)
- [Docker Setup](#docker-setup)
- [Demo Walkthrough](#demo-walkthrough)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**StreamMind PRISM 2026** is a fully local, privacy-first AI knowledge management system. It ingests PDFs, DOCX, TXT, and Markdown files, extracts structured knowledge (entities, facts, decisions, action items), and answers natural language questions grounded in your documents — with citations pointing back to specific pages and chunks.

The system supports **same-session follow-up questions**, maintaining conversation context across turns without re-uploading or re-querying from scratch. All inference runs locally via [Ollama](https://ollama.com) — no API keys required.

---

## Key Features

| Feature | Description |
|---|---|
| 📄 **Document Ingestion** | Upload PDF, DOCX, TXT, MD — up to 25 MB |
| 🧠 **Structured Extraction** | Deterministic + LLM-hybrid parsing for facts, decisions, entities, action items |
| 🔍 **Semantic RAG** | Vector similarity search over embedded chunks using `nomic-embed-text` |
| 💬 **Conversational Memory** | Same-session follow-up handling with subquestion lifecycle management |
| 📌 **Citation Validation** | Every answer claim is verified against source labels before display |
| 🏛️ **Decision Memory** | Tracks project decisions, detects conflicts, archives stale decisions |
| ✅ **Action Items** | Extracts and tracks open tasks with owner and deadline |
| 🔒 **100% Local** | Ollama + PostgreSQL + Next.js — zero cloud dependency |
| 📊 **Audit Log** | Full event trail for every upload, index, query, and extraction |
| 🐳 **Docker Ready** | `docker-compose.yml` for one-command deployment |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Frontend (port 3001)            │
│  Knowledge | Ask | Decisions | Actions | Audit | Settings   │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST
┌──────────────────────▼──────────────────────────────────────┐
│               FastAPI Backend (port 8001)                    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Documents   │  │   Ask/RAG    │  │  Decisions &     │  │
│  │  API         │  │   API        │  │  Actions API     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘  │
│         │                 │                                   │
│  ┌──────▼───────┐  ┌──────▼───────────────────────────────┐ │
│  │  Indexing    │  │       ConversationService             │ │
│  │  Pipeline    │  │  ┌────────────┐  ┌─────────────────┐ │ │
│  │  ─────────── │  │  │ Decompose  │  │  Update Plan    │ │ │
│  │  Extract     │  │  │ Subqs      │  │  (follow-ups)   │ │ │
│  │  Chunk       │  │  └────────────┘  └─────────────────┘ │ │
│  │  Embed       │  │  ┌────────────┐  ┌─────────────────┐ │ │
│  │  Store       │  │  │  Retrieve  │  │  Evaluate       │ │ │
│  └──────────────┘  │  │  Evidence  │  │  Evidence       │ │ │
│                    │  └────────────┘  └─────────────────┘ │ │
│  ┌──────────────┐  │  ┌────────────────────────────────┐  │ │
│  │  Extraction  │  │  │  Generate Grounded Answer      │  │ │
│  │  Service     │  │  │  + Citation Validation         │  │ │
│  │  (hybrid)    │  │  └────────────────────────────────┘  │ │
│  └──────────────┘  └──────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                       │                │
          ┌────────────▼──┐    ┌────────▼──────────┐
          │  PostgreSQL   │    │  Ollama (local)   │
          │  (pgvector)   │    │  qwen2.5:3b       │
          │               │    │  nomic-embed-text │
          └───────────────┘    └───────────────────┘
```

---

## Tech Stack

### Backend
| Component | Technology |
|---|---|
| API Framework | FastAPI + Uvicorn |
| Language | Python 3.11+ |
| Database | PostgreSQL 16 + pgvector |
| ORM | SQLAlchemy 2.x |
| Local LLM | Ollama (`qwen2.5:3b`) |
| Embeddings | Ollama (`nomic-embed-text`) |
| PDF Parsing | PyMuPDF (`fitz`) |
| HTTP Client | httpx |
| Config | pydantic-settings |

### Frontend
| Component | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI Components | Radix UI + shadcn/ui |
| Icons | Lucide React |

---

## Project Structure

```
StreamMind-Samsung/
├── app/                        # Next.js App Router pages
│   ├── ask/                    # Conversational RAG interface
│   ├── knowledge/              # Document library & extraction viewer
│   ├── decisions/              # Decision registry
│   ├── actions/                # Action items tracker
│   ├── audit-log/              # Event audit trail
│   └── page.tsx                # Landing/dashboard page
│
├── backend/
│   ├── api/
│   │   └── routes/
│   │       ├── ask.py          # POST /api/ask — RAG query endpoint
│   │       ├── documents.py    # Upload, index, retrieve documents
│   │       ├── decisions.py    # Decision CRUD + lineage
│   │       ├── actions.py      # Action item management
│   │       ├── transcript.py   # Real-time SSE + final transcript
│   │       ├── audit.py        # Audit log queries
│   │       ├── health.py       # Health check
│   │       └── system.py       # System status (Ollama, DB)
│   │
│   ├── services/
│   │   ├── conversation_service.py     # Core RAG turn processing
│   │   ├── llm_service.py              # Ollama LLM calls (decompose, evaluate, generate)
│   │   ├── retrieval_service.py        # pgvector semantic search
│   │   ├── retrieval_controller.py     # Multi-subquestion retrieval orchestration
│   │   ├── session_state.py            # Conversation session memory
│   │   ├── extraction_service.py       # Hybrid structured extraction
│   │   ├── indexing_service.py         # Document indexing pipeline
│   │   ├── chunking_service.py         # Page-aware text chunking
│   │   ├── embedding_service.py        # Ollama embedding generation
│   │   ├── text_extraction_service.py  # PDF/DOCX/TXT text extraction
│   │   ├── decision_memory_service.py  # Decision conflict detection & storage
│   │   ├── database_service.py         # DB query helpers
│   │   └── audit_service.py            # Audit event recording
│   │
│   ├── db/
│   │   ├── models.py           # SQLAlchemy ORM models
│   │   └── session.py          # DB session factory
│   │
│   ├── models/                 # Pydantic request/response models
│   ├── core/
│   │   └── config.py           # Centralized settings (pydantic-settings)
│   └── main.py                 # FastAPI app factory + CORS
│
├── components/                 # React components
│   ├── knowledge/              # Document cards, detail panel, pipeline viewer
│   ├── ask-page.tsx            # Chat interface with live transcript
│   ├── live-transcript-panel.tsx # SSE-based real-time reasoning display
│   └── ...
│
├── lib/
│   ├── api.ts                  # Typed API client
│   └── navigation.ts           # Route helpers
│
├── Dockerfile                  # Backend Docker image
├── docker-compose.yml          # Full stack (backend + postgres)
├── requirements.txt            # Python dependencies
└── StreamMind_Demo_Knowledge_Base.pdf  # Demo document
```

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.11+ | |
| Node.js | 18+ | |
| PostgreSQL | 15 or 16 | With `pgvector` extension |
| Ollama | Latest | [ollama.com](https://ollama.com) |
| Git | Any | |

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/vasuparmar7360/StreamMind-PRISM-2026.git
cd StreamMind-PRISM-2026
```

### 2. Set up the Python backend

```bash
# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate      # macOS/Linux
# venv\Scripts\activate       # Windows

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Set up PostgreSQL

```bash
# Create the database (adjust user as needed)
psql -U postgres -c "CREATE DATABASE ownmind;"

# Enable the pgvector extension
psql -U postgres -d ownmind -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run the schema migration (SQLAlchemy will auto-create tables on first run)
```

### 4. Set up Ollama (local LLM)

```bash
# Install Ollama from https://ollama.com/download
# Then pull the required models:
ollama pull qwen2.5:3b
ollama pull nomic-embed-text

# Verify Ollama is running
curl http://127.0.0.1:11434/
```

### 5. Set up the Next.js frontend

```bash
npm install
```

---

## Configuration

Create a `.env` file in the project root (or set environment variables):

```env
# Database
DATABASE_URL=postgresql+psycopg://your_user@127.0.0.1:5432/ownmind

# Ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
EMBEDDING_MODEL=nomic-embed-text
CHAT_MODEL=qwen2.5:3b

# Backend
HOST=127.0.0.1
PORT=8001
FRONTEND_URL=http://localhost:3001

# Tuning
MAX_UPLOAD_SIZE_MB=25
CHUNK_SIZE_WORDS=600
CHUNK_OVERLAP_WORDS=100
ASK_TOP_K=5
SEARCH_MIN_SIMILARITY=0.5
```

> **Note:** The default `DATABASE_URL` uses the system username. Update it to match your PostgreSQL setup.

---

## Running the Application

Start all three services in separate terminals:

**Terminal 1 — Backend**
```bash
source venv/bin/activate
uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload
```

**Terminal 2 — Frontend**
```bash
npm run dev
```

**Terminal 3 — Ollama** (if not running as a system service)
```bash
ollama serve
```

Then open **http://localhost:3001** in your browser.

---

## Usage Guide

### Uploading Documents

1. Navigate to the **Knowledge** page.
2. Click **Add Documents** and select a PDF, DOCX, TXT, or MD file (max 25 MB).
3. The system automatically:
   - Extracts text with page-awareness
   - Splits into overlapping chunks (~600 words, 100-word overlap)
   - Generates semantic embeddings via `nomic-embed-text`
   - Stores chunks + vectors in PostgreSQL (pgvector)
   - Runs hybrid structured extraction (facts, entities, decisions, actions)

### Knowledge Extraction

After upload, click on any document card to see:

| Section | Description |
|---|---|
| **Extracted Entities** | Named entities: people, projects, technologies, dates, values |
| **Extracted Facts** | Verified factual statements from the document |
| **Detected Decisions** | Confirmed project decisions with topic, value, and effective date |
| **Action Items** | Open tasks with owner, deadline, and status |
| **Source Preview** | Raw chunk text with page/section metadata |

Extraction uses a **two-stage hybrid approach**:
1. **Deterministic parser** — regex-based, works offline, parses structured headings (`Fact A1.`, `Decision A1:`, `Action A1:`, `Entities explicitly represented in this document`)
2. **LLM extraction** — Ollama-powered deep extraction merged and deduplicated with deterministic results

The deterministic parser is always the safety net — malformed LLM output never causes empty sections.

### Asking Questions (RAG)

1. Navigate to the **Ask** page.
2. Type any natural language question about your documents.
3. The system runs the full RAG pipeline:
   - **Decompose** the question into focused subquestions
   - **Retrieve** semantically relevant chunks for each subquestion
   - **Evaluate** whether retrieved evidence actually supports each subquestion
   - **Generate** a grounded answer with inline citations `[S1]`, `[S2]`
   - **Validate** all citations — hallucinated labels are caught and repaired
4. The answer displays with:
   - Inline source labels
   - Source panel showing document name, chunk excerpt, similarity score

### Same-Session Follow-up Questions

After receiving an answer, you can refine it without starting over:

```
Turn 1: "What is the Alpha project budget and who leads the Beta project?"
→ Answer: Alpha Q2 2025 budget is USD 12,500/month [S1]. Aisha Okonkwo leads Beta [S2].

Turn 2 (same session): "Use Q3 2025 for Alpha's budget instead; keep the Beta lead question."
→ Answer: No approved Alpha Q3 2025 budget exists in this document [S1]. Aisha Okonkwo leads Beta [S2].
```

The system:
- Classifies the follow-up (`changed_constraint`, `added_info`, `removed_info`, `new_topic`)
- Builds a transactional update plan (retained / removed / added subquestions)
- Preserves evidence for unchanged subquestions
- Only re-retrieves evidence for changed or new subquestions
- Never cross-applies a value from one period/entity to another

### Decisions & Actions

- **Decisions page** — Browse all extracted decisions. Conflicts between documents are automatically detected and flagged.
- **Actions page** — View, approve, reject, or execute extracted action items.

---

## RAG Pipeline Deep Dive

```
Query Input
    │
    ▼
┌─────────────────────────────┐
│  1. Classify (follow-up?)   │  LLM → category: new_topic | changed_constraint | added_info
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  2. Build Update Plan        │  For follow-ups: retained / removed / added subquestion IDs
│     (follow-ups only)        │  Server-assigned IDs — never trust LLM-generated IDs
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  3. Decompose into Subqs    │  LLM → ["What is Alpha Q3 budget?", "Who leads Beta?"]
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  4. Early Raw Retrieval     │  Semantic search on full query (parallel, non-blocking)
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  5. Per-Subquestion         │  Semantic search per subquestion query
│     Retrieval               │  Top-K chunks per subquestion
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  6. Evidence Evaluation     │  LLM validates each chunk actually answers each subquestion
│                             │  Prevents hallucination of unsupported claims
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  7. Answer Generation       │  LLM generates grounded answer using validated evidence
│                             │  Inline citations [S1], [S2]...
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  8. Citation Validation     │  Regex detects all inline labels
│                             │  Validates against sources list
│                             │  Repairs or strips invalid labels
└─────────────────────────────┘
    │
    ▼
Final Answer + Sources + Session State Commit
```

**Key Correctness Guarantees:**
- Q2 2025 values are never reported as Q3 2025 values
- Unsupported subquestions → `insufficient_evidence` status, clearly stated in answer
- Session state is committed unconditionally — follow-up context is never lost
- `is_followup` determined by committed session state, not answer version counter

---

## API Reference

### Documents

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/documents` | List all indexed documents |
| `POST` | `/api/documents/upload` | Upload a new document |
| `GET` | `/api/documents/{id}` | Get document details + extraction data |
| `POST` | `/api/documents/{id}/reindex` | Re-run indexing pipeline |
| `DELETE` | `/api/documents/{id}` | Remove document (with dependency check) |

### Ask / RAG

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ask` | Submit a question (returns immediate response + starts background processing) |
| `POST` | `/api/ask/new-session` | Create a fresh conversation session |
| `GET` | `/api/transcript/stream/{session_id}` | SSE stream for real-time reasoning steps |
| `GET` | `/api/transcript/export/{session_id}` | Full transcript + final answer |
| `POST` | `/api/transcript/final` | Finalize and retrieve the completed answer |

### Decisions & Actions

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/decisions` | List all decisions |
| `GET` | `/api/decisions/{id}` | Decision detail + lineage |
| `GET` | `/api/actions` | List action items |
| `POST` | `/api/actions/{id}/approve` | Approve an action |
| `POST` | `/api/actions/{id}/execute` | Mark action as executed |

### System

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/system/status` | Ollama + DB status |
| `GET` | `/api/memory/summary` | Decision/conflict/action counts |
| `GET` | `/api/audit` | Audit event log |

---

## Docker Setup

Run the full backend stack with Docker Compose:

```bash
# Build and start
docker compose up --build

# Backend will be available at http://localhost:8001
# Run the frontend separately:
npm run dev
```

The `docker-compose.yml` starts:
- **PostgreSQL 16** with pgvector
- **FastAPI backend** with auto-migration

> Ollama must still run natively on the host (GPU passthrough for containers is optional).

---

## Demo Walkthrough

Use the included `StreamMind_Demo_Knowledge_Base.pdf` to reproduce the full demo:

### Step 1 — Upload
Upload `StreamMind_Demo_Knowledge_Base.pdf` via the Knowledge page.

### Step 2 — Verify Extraction
Click the document card. You should see:

**Entities:** Alpha Project, Beta Project, Aisha Okonkwo, CTO, Q2 2025, Q3 2025, 10 February 2025, USD 12,500 per month

**Facts:**
- The Q2 2025 infrastructure budget for Alpha Project is USD 12,500 per month.
- This document contains no approved Alpha Project budget for Q3 2025.
- Aisha Okonkwo leads Beta Project.
- _(+ 3 more)_

**Decisions:** Decision A1, Decision B1

**Action Items:** Action A1, Action B1

### Step 3 — Question 1
Ask: `What is the Alpha project budget and who leads the Beta project?`

**Expected answer:**
> The Alpha project budget for Q2 2025 is USD 12,500 per month [S1]. Aisha Okonkwo leads the Beta project [S2].

### Step 4 — Follow-up (same session)
Ask: `Use Q3 2025 for Alpha's budget instead; keep the Beta lead question.`

**Expected answer:**
> The Alpha project budget for Q3 2025 is not present in the provided evidence [S1]. Aisha Okonkwo leads the Beta project [S2].

✅ USD 12,500 is **not** returned for Q3 2025  
✅ Beta lead is **preserved** from turn 1  
✅ Same session ID, incremented answer version

---

## Known Limitations

- **Single-node only** — Session state is in-memory; horizontal scaling requires Redis or a shared session store.
- **Small LLM (3B)** — `qwen2.5:3b` occasionally struggles with complex multi-hop questions. Upgrading to `qwen2.5:7b` or `llama3.1:8b` significantly improves accuracy.
- **Single chunk per PDF** — Very large PDFs may be stored as one chunk if they fit under the word limit. The chunking service can be tuned via `CHUNK_SIZE_WORDS`.
- **English only** — Prompts are in English; other languages may work but are untested.
- **No authentication** — This is a demo/local system. Add OAuth2 or API key auth before exposing externally.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

Please keep changes scoped and include tests for any new RAG pipeline logic.

---

## Resources

### 📁 Project Assets (Google Drive)

All demo assets, presentation slides, architecture diagrams, and supplementary documentation are available here:

**[🔗 StreamMind PRISM 2026 — Google Drive](https://drive.google.com/drive/folders/1PMS4ymYu774PWlgXPrteUA35hcpyKjZ6?usp=drive_link)**

> Includes: demo PDF, screenshots, slide deck, and evaluation traces.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with ❤️ for local-first AI · **StreamMind PRISM 2026**

[📁 Google Drive Assets](https://drive.google.com/drive/folders/1PMS4ymYu774PWlgXPrteUA35hcpyKjZ6?usp=drive_link) · [GitHub](https://github.com/vasuparmar7360/StreamMind-PRISM-2026)

</div>
