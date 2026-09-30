"""
StreamMind RAG Pipeline Validation Script
==========================================
Tests the full pipeline: upload → index → retrieve → generate → cite
Uses fictional test corpus documents. Does NOT hardcode expected answers.
"""

import httpx
import time
import sys
import json
from pathlib import Path

BASE_URL = "http://127.0.0.1:8001/api"
CORPUS_DIR = Path("test_corpus")
CLIENT = httpx.Client(timeout=120.0)

PASS = "✅ PASS"
FAIL = "❌ FAIL"
BLOCKED = "🚫 BLOCKED"
WARN = "⚠️  WARN"

results = []

def log(label, status, detail=""):
    results.append({"label": label, "status": status, "detail": detail})
    print(f"  {status} {label}")
    if detail:
        print(f"         {detail}")

# ─── 0. HEALTH CHECK ──────────────────────────────────────────────────────────
print("\n=== 0. HEALTH & MODEL AVAILABILITY ===")

try:
    r = CLIENT.get(f"{BASE_URL}/health")
    r.raise_for_status()
    log("Backend reachable", PASS, r.json().get("service"))
except Exception as e:
    log("Backend reachable", FAIL, str(e))
    print("Backend is not up — cannot continue.")
    sys.exit(1)

try:
    r = CLIENT.get(f"{BASE_URL}/system/status")
    r.raise_for_status()
    s = r.json()
    ollama_ok = s.get("ollama", {}).get("status") == "online"
    embed_ok = s.get("embedding_model", {}).get("available", False)
    chat_ok = s.get("chat_model", {}).get("available", False)
    db_ok = s.get("database", {}).get("status") == "online"

    log("PostgreSQL reachable", PASS if db_ok else FAIL)
    log("Ollama service reachable", PASS if ollama_ok else FAIL,
        "Start with: ollama serve" if not ollama_ok else "")
    log(f"Embedding model ({s['embedding_model']['name']}) available",
        PASS if embed_ok else BLOCKED)
    log(f"Generation model ({s['chat_model']['name']}) available",
        PASS if chat_ok else BLOCKED)
except Exception as e:
    log("System status", FAIL, str(e))

models_ok = embed_ok and chat_ok

# ─── 1. INGEST TEST CORPUS ────────────────────────────────────────────────────
print("\n=== 1. INGESTION & INDEXING ===")

doc_ids = {}
for doc_file in sorted(CORPUS_DIR.glob("*.txt")):
    print(f"\n  Uploading {doc_file.name}...")
    with open(doc_file, "rb") as f:
        r = CLIENT.post(f"{BASE_URL}/documents/upload",
                        files={"file": (doc_file.name, f, "text/plain")})
    if r.status_code != 201:
        log(f"Upload {doc_file.name}", FAIL, r.text[:200])
        continue
    doc_id = r.json()["id"]
    doc_ids[doc_file.name] = doc_id
    log(f"Upload {doc_file.name}", PASS, f"doc_id={doc_id}")

if not doc_ids:
    print("No documents uploaded — aborting.")
    sys.exit(1)

# Wait for background indexing
print("\n  Waiting 25s for background indexing to complete...")
time.sleep(25)

# Check status of each document
all_indexed = True
for name, doc_id in doc_ids.items():
    r = CLIENT.get(f"{BASE_URL}/documents/{doc_id}")
    if r.status_code != 200:
        log(f"Status check {name}", FAIL, r.text[:100])
        all_indexed = False
        continue
    d = r.json()
    status = d.get("status")
    chunks = d.get("chunk_count", 0)
    if status == "indexed" and chunks > 0:
        log(f"Index status {name}", PASS, f"status={status}, chunks={chunks}")
    elif status == "failed" and not models_ok:
        log(f"Index status {name}", BLOCKED,
            f"status=failed (expected: Ollama unavailable during indexing). Use /reindex after Ollama is available.")
        all_indexed = False
    else:
        log(f"Index status {name}", FAIL, f"status={status}, chunks={chunks}")
        all_indexed = False

# If indexing failed because Ollama was down, retry now that it's up
if not all_indexed and models_ok:
    print("\n  Some docs failed indexing — triggering reindex...")
    for name, doc_id in doc_ids.items():
        r = CLIENT.get(f"{BASE_URL}/documents/{doc_id}")
        if r.json().get("status") != "indexed":
            r2 = CLIENT.post(f"{BASE_URL}/documents/{doc_id}/reindex")
            log(f"Reindex {name}", PASS if r2.status_code == 200 else FAIL, r2.text[:100])
    print("  Waiting 25s for reindex...")
    time.sleep(25)
    for name, doc_id in doc_ids.items():
        r = CLIENT.get(f"{BASE_URL}/documents/{doc_id}")
        d = r.json()
        status = d.get("status")
        chunks = d.get("chunk_count", 0)
        log(f"Post-reindex status {name}", PASS if status == "indexed" else FAIL,
            f"status={status}, chunks={chunks}")

# ─── 2. VERIFY EMBEDDINGS IN DATABASE ────────────────────────────────────────
print("\n=== 2. EMBEDDING VERIFICATION ===")

if models_ok:
    for name, doc_id in doc_ids.items():
        r = CLIENT.get(f"{BASE_URL}/documents/{doc_id}/chunks")
        if r.status_code != 200:
            log(f"Chunks for {name}", FAIL, r.text[:100])
            continue
        chunks = r.json().get("chunks", [])
        # Note: chunk endpoint doesn't return embeddings for security (they're large).
        # We verify via the search below — if retrieval works, embeddings exist.
        log(f"Chunks returned for {name}", PASS if chunks else FAIL, f"count={len(chunks)}")
else:
    log("Embedding verification", BLOCKED, "Models unavailable")

# ─── 3. RETRIEVAL & GENERATION TESTS ─────────────────────────────────────────
print("\n=== 3. RETRIEVAL & GENERATION TESTS ===")

SESSION_A = CLIENT.post(f"{BASE_URL}/ask/new-session").json()["session_id"]
print(f"  Session A ID: {SESSION_A[:8]}...")

def ask(question, session_id=SESSION_A, label=None):
    print(f"\n  Q: {question}")
    try:
        r = CLIENT.post(f"{BASE_URL}/ask", json={
            "question": question,
            "top_k": 5,
            "session_id": session_id
        })
        if r.status_code != 200:
            log(label or question[:50], FAIL, f"HTTP {r.status_code}: {r.text[:200]}")
            return None
        return r.json()
    except Exception as e:
        log(label or question[:50], FAIL, str(e))
        return None

if not models_ok:
    print("  Models unavailable — QA tests BLOCKED")
    log("All QA tests", BLOCKED, "Ollama embedding/generation models not available")
else:
    # TEST A: Direct single-source question
    resp = ask("What database does Alpha Project use?", label="Test A: Single-source direct question")
    if resp:
        answer = resp.get("answer", "")
        sources = resp.get("sources", [])
        status = resp.get("status", "")
        print(f"  A: {answer[:300]}")
        print(f"  Status: {status}, Sources: {len(sources)}")
        contains_postgres = "postgresql" in answer.lower() or "postgres" in answer.lower()
        avoids_mongodb = "mongodb" not in answer.lower()
        has_sources = len(sources) > 0
        # Check that cited source comes from doc_alpha
        alpha_cited = any("alpha" in s.get("document_name", "").lower() for s in sources)

        log("Test A: Answer mentions PostgreSQL", PASS if contains_postgres else FAIL, answer[:150])
        log("Test A: Answer does NOT mention MongoDB (wrong-source guard)", PASS if avoids_mongodb else FAIL)
        log("Test A: Citations returned", PASS if has_sources else FAIL, f"{len(sources)} sources")
        log("Test A: Citation from Alpha doc", PASS if alpha_cited else FAIL,
            str([s.get("document_name") for s in sources]))
        if sources:
            for s in sources:
                print(f"    Cited chunk_id={s['chunk_id']}, doc={s['document_name']}, score={s['similarity_score']:.3f}")
                print(f"    Excerpt: {s['excerpt'][:100]}")

    # TEST B: Paraphrased question
    resp = ask("Who is responsible for leading the Alpha initiative?", label="Test B: Paraphrased single-source")
    if resp:
        answer = resp.get("answer", "")
        sources = resp.get("sources", [])
        print(f"  A: {answer[:300]}")
        contains_jordan = "jordan" in answer.lower()
        log("Test B: Answer identifies Jordan Chen", PASS if contains_jordan else FAIL, answer[:150])
        log("Test B: Citations returned", PASS if sources else FAIL, f"{len(sources)} sources")

    # TEST C: Cross-document question
    resp = ask(
        "What are the Q2 2025 infrastructure budgets for Alpha Project and Beta Project?",
        label="Test C: Multi-document cross-reference"
    )
    if resp:
        answer = resp.get("answer", "")
        sources = resp.get("sources", [])
        print(f"  A: {answer[:400]}")
        has_alpha_budget = "12,500" in answer or "12500" in answer
        has_beta_budget = "8,200" in answer or "8200" in answer
        multi_docs = len(set(s.get("document_name") for s in sources)) >= 2

        log("Test C: Mentions Alpha budget ($12,500)", PASS if has_alpha_budget else FAIL)
        log("Test C: Mentions Beta budget ($8,200)", PASS if has_beta_budget else FAIL)
        log("Test C: Sources from multiple documents", PASS if multi_docs else WARN,
            str([s.get("document_name") for s in sources]))

    # TEST D: Absent fact — should return explicit uncertainty
    resp = ask("What is the mobile app release date for Alpha Project?",
               label="Test D: Absent fact — should admit uncertainty")
    if resp:
        answer = resp.get("answer", "")
        sources = resp.get("sources", [])
        status = resp.get("status", "")
        print(f"  A: {answer[:300]}")
        print(f"  Status: {status}")
        admits_uncertainty = (
            "insufficient" in answer.lower()
            or "not found" in answer.lower()
            or "no information" in answer.lower()
            or "cannot find" in answer.lower()
            or "don't have" in answer.lower()
            or "do not have" in answer.lower()
            or status == "insufficient_evidence"
        )
        log("Test D: Admits insufficient evidence", PASS if admits_uncertainty else FAIL, answer[:200])

# ─── 4. SESSION ISOLATION TEST ────────────────────────────────────────────────
print("\n=== 4. SESSION ISOLATION TEST ===")

# Since the backend is currently stateless (no server-side conversation history stored),
# session isolation means: session_id is echoed correctly and a New Session
# generates a different ID, preventing responses from bleeding across sessions.

SESSION_B_data = CLIENT.post(f"{BASE_URL}/ask/new-session")
SESSION_B = SESSION_B_data.json()["session_id"]

print(f"  Session A: {SESSION_A[:8]}...")
print(f"  Session B: {SESSION_B[:8]}...")

ids_different = SESSION_A != SESSION_B
log("New Session generates different ID", PASS if ids_different else FAIL)

# Ask under session A, check echoed session_id
if models_ok:
    r_a = CLIENT.post(f"{BASE_URL}/ask", json={
        "question": "What programming language does Alpha Project use?",
        "session_id": SESSION_A
    })
    if r_a.status_code == 200:
        echoed = r_a.json().get("session_id")
        log("Session A: session_id echoed correctly", PASS if echoed == SESSION_A else FAIL,
            f"sent={SESSION_A[:8]} echoed={str(echoed)[:8] if echoed else 'None'}")
    
    # Ask under session B — should echo session B ID, not session A
    r_b = CLIENT.post(f"{BASE_URL}/ask", json={
        "question": "What caching layer does Beta Project use?",
        "session_id": SESSION_B
    })
    if r_b.status_code == 200:
        echoed_b = r_b.json().get("session_id")
        log("Session B: session_id echoed correctly", PASS if echoed_b == SESSION_B else FAIL,
            f"sent={SESSION_B[:8]} echoed={str(echoed_b)[:8] if echoed_b else 'None'}")
        log("Session B response does NOT carry Session A id",
            PASS if echoed_b != SESSION_A else FAIL)
else:
    log("Session isolation echo test", BLOCKED, "Models unavailable for generation")

print("\n  Note: The backend is currently stateless — conversational history is not persisted.")
print("  Session IDs isolate responses at the client level. Server-side conversation")
print("  memory will be added in the streaming/multi-turn phase.")

# ─── 5. SUMMARY ───────────────────────────────────────────────────────────────
print("\n=== SUMMARY ===")
passed = sum(1 for r in results if PASS in r["status"])
failed = sum(1 for r in results if FAIL in r["status"])
blocked = sum(1 for r in results if BLOCKED in r["status"])
warned = sum(1 for r in results if WARN in r["status"])

print(f"  PASSED:  {passed}")
print(f"  FAILED:  {failed}")
print(f"  BLOCKED: {blocked}")
print(f"  WARNED:  {warned}")
print(f"\n  Total checks: {len(results)}")
print(f"\n  Frontend URL: http://localhost:3001")
print(f"  Backend docs: http://127.0.0.1:8001/docs")
print(f"  Ask page:     http://localhost:3001/ask")

if failed > 0:
    print(f"\nFailed checks:")
    for r in results:
        if FAIL in r["status"]:
            print(f"  - {r['label']}: {r['detail']}")
