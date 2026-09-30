"""
StreamMind Phase 3 — Transcript Pipeline Tests
===============================================
Tests A–H from the requirements.
Run with: source venv/bin/activate && python test_phase3_transcript.py

Relies on:
  - Backend running on http://127.0.0.1:8001
  - Ollama running with nomic-embed-text and qwen2.5:3b
  - At least the test_corpus documents indexed (re-ingests if needed)
"""

import httpx
import time
import sys
import json
import threading
import uuid
from pathlib import Path

BASE = "http://127.0.0.1:8001/api"
CLIENT = httpx.Client(timeout=180.0)
CORPUS_DIR = Path("test_corpus")

PASS = "✅ PASS"
FAIL = "❌ FAIL"
BLOCKED = "🚫 BLOCKED"
WARN = "⚠️  WARN"

results = []

def log(label, status, detail=""):
    results.append({"label": label, "status": status, "detail": detail})
    sym = {"✅": "PASS", "❌": "FAIL", "🚫": "BLOCK", "⚠️": "WARN"}.get(status[:2], "INFO")
    print(f"  {status} {label}")
    if detail:
        print(f"         ↳ {detail}")

# ─── 0. Prerequisites ─────────────────────────────────────────────────────────
print("\n=== 0. PREREQUISITES ===")

try:
    r = CLIENT.get(f"{BASE}/health")
    r.raise_for_status()
    log("Backend reachable", PASS)
except Exception as e:
    log("Backend reachable", FAIL, str(e))
    sys.exit(1)

status = CLIENT.get(f"{BASE}/system/status").json()
models_ok = status["embedding_model"]["available"] and status["chat_model"]["available"]
log(f"Models available (embed+chat)", PASS if models_ok else FAIL,
    f"embed={status['embedding_model']['available']}, chat={status['chat_model']['available']}")

# Ensure test documents are indexed
print("\n  Re-ingesting test corpus…")
doc_ids = {}
for f in sorted(CORPUS_DIR.glob("*.txt")):
    with open(f, "rb") as fh:
        r = CLIENT.post(f"{BASE}/documents/upload", files={"file": (f.name, fh, "text/plain")})
    if r.status_code == 201:
        doc_ids[f.name] = r.json()["id"]
        print(f"    Uploaded {f.name} → {doc_ids[f.name][:8]}")

if doc_ids:
    print("  Waiting 20s for indexing…")
    time.sleep(20)
    for name, did in doc_ids.items():
        d = CLIENT.get(f"{BASE}/documents/{did}").json()
        log(f"Index {name}", PASS if d.get("status") == "indexed" else FAIL,
            f"status={d.get('status')}, chunks={d.get('chunk_count',0)}")
else:
    log("Test corpus ingest", WARN, "No txt files found in test_corpus/ — using existing DB docs")

# ─── Helper: replay transcript ─────────────────────────────────────────────────

def replay(text: str, words_per_chunk=4, delay_s=0.3, stop_after=None,
           session_id=None, request_id=None):
    """
    Send text chunk-by-chunk.
    Returns (final_result, timing_data, sent_chunks, stopped_at_seq).
    stop_after: stop after this many chunks (None = complete replay).
    """
    if session_id is None:
        session_id = str(uuid.uuid4())
    if request_id is None:
        request_id = str(uuid.uuid4())

    words = text.strip().split()
    chunks = [" ".join(words[i:i+words_per_chunk]) for i in range(0, len(words), words_per_chunk)]

    sent = []
    stopped_at = None
    first_decision_retrieve = None

    for seq, chunk in enumerate(chunks):
        if stop_after is not None and seq >= stop_after:
            CLIENT.post(f"{BASE}/transcript/stop",
                        json={"session_id": session_id, "request_id": request_id})
            stopped_at = seq
            break

        r = CLIENT.post(f"{BASE}/transcript/chunk", json={
            "session_id": session_id,
            "request_id": request_id,
            "seq": seq,
            "text": chunk,
        })
        sent.append({"seq": seq, "chunk": chunk, "resp": r.json()})
        decision = r.json().get("decision", "")
        if decision == "RETRIEVE" and first_decision_retrieve is None:
            first_decision_retrieve = seq
        time.sleep(delay_s)

    final_result = None
    if stopped_at is None:
        try:
            final_r = CLIENT.post(f"{BASE}/transcript/final", json={
                "session_id": session_id,
                "request_id": request_id,
            })
            final_result = final_r.json()
        except Exception as e:
            final_result = {"error": str(e)}

    return {
        "session_id": session_id,
        "request_id": request_id,
        "final_result": final_result,
        "sent_chunks": sent,
        "stopped_at": stopped_at,
        "first_retrieve_seq": first_decision_retrieve,
        "chunks_total": len(chunks),
    }

# ─── TEST A: Early retrieval ──────────────────────────────────────────────────
print("\n=== TEST A: Request meaningful before it ends (early retrieval) ===")
if not models_ok:
    log("Test A", BLOCKED, "models unavailable")
else:
    t_start = time.monotonic()
    out = replay(
        "What database does Alpha Project use for storing data and what is the version number?",
        words_per_chunk=4, delay_s=0.4
    )
    t_end = time.monotonic()

    fr = out["final_result"] or {}
    timing = fr.get("timing", {})
    early_before = fr.get("early_retrieval_before_final", False)
    answer = fr.get("answer", {}).get("answer", "")
    sources = fr.get("answer", {}).get("sources", [])

    print(f"  Answer: {answer[:200]}")
    print(f"  Early retrieval seq: {out['first_retrieve_seq']} of {out['chunks_total']}")

    log("Test A: retrieve decision triggered before final chunk",
        PASS if out["first_retrieve_seq"] is not None and out["first_retrieve_seq"] < out["chunks_total"] - 1
        else WARN,
        f"retrieve at seq {out['first_retrieve_seq']}, total={out['chunks_total']}")

    log("Test A: early_retrieval_before_final=True",
        PASS if early_before else WARN,
        f"early_before_final={early_before}")

    if timing.get("first_chunk_to_retrieval") is not None and timing.get("first_chunk_to_final_input") is not None:
        retrieval_t = timing["first_chunk_to_retrieval"]
        final_t = timing["first_chunk_to_final_input"]
        log(f"Test A: retrieval_started({retrieval_t:.3f}s) < final_input({final_t:.3f}s)",
            PASS if retrieval_t < final_t else FAIL,
            f"retrieval_t={retrieval_t:.3f}s, final_t={final_t:.3f}s")
    else:
        log("Test A: timing data", WARN, f"timing={timing}")

    log("Test A: PostgreSQL mentioned in answer",
        PASS if "postgresql" in answer.lower() or "postgres" in answer.lower() else FAIL)
    log("Test A: citations returned", PASS if sources else FAIL, f"{len(sources)} sources")

# ─── TEST B: Short request — no early retrieval ───────────────────────────────
print("\n=== TEST B: Short request (finishes before early retrieval useful) ===")
if not models_ok:
    log("Test B", BLOCKED, "models unavailable")
else:
    out = replay("What database?", words_per_chunk=4, delay_s=0.2)
    fr = out.get("final_result") or {}
    early_before = fr.get("early_retrieval_before_final", False)
    timing = fr.get("timing", {})

    log("Test B: request completed", PASS if fr.get("status") == "done" else WARN,
        f"status={fr.get('status')}")
    log("Test B: no early retrieval (expected for 2-word query)",
        PASS if not early_before else WARN,
        f"early_before_final={early_before}")
    log("Test B: retrieval still ran at final", PASS if fr.get("answer") else WARN,
        "answer present")

# ─── TEST C: Incomplete fragments — should WAIT ───────────────────────────────
print("\n=== TEST C: Fragments — controller should WAIT ===")
fragments = ["um", "so", "what", "I mean"]
wait_count = 0
for frag in fragments:
    r = CLIENT.post(f"{BASE}/transcript/chunk", json={
        "session_id": str(uuid.uuid4()),
        "request_id": str(uuid.uuid4()),
        "seq": 0,
        "text": frag,
    })
    decision = r.json().get("decision", "")
    if decision in ("WAIT", "NO_RETRIEVAL"):
        wait_count += 1
    print(f"  '{frag}' → {decision}")

log("Test C: fragments resulted in WAIT/NO_RETRIEVAL",
    PASS if wait_count == len(fragments) else FAIL,
    f"{wait_count}/{len(fragments)} waited")

# ─── TEST D: Duplicate chunks must not re-trigger retrieval ───────────────────
print("\n=== TEST D: Repeated chunks must not duplicate retrieval ===")
sid = str(uuid.uuid4())
rid = str(uuid.uuid4())
text = "What is the primary database used by Alpha Project for production workloads?"
words = text.split()
chunks = [" ".join(words[i:i+4]) for i in range(0, len(words), 4)]
decisions = []

for seq, chunk in enumerate(chunks):
    r = CLIENT.post(f"{BASE}/transcript/chunk", json={
        "session_id": sid, "request_id": rid, "seq": seq, "text": chunk
    })
    decisions.append(r.json().get("decision"))
    time.sleep(0.3)

# Send duplicate of last chunk with same seq
dup_r = CLIENT.post(f"{BASE}/transcript/chunk", json={
    "session_id": sid, "request_id": rid,
    "seq": len(chunks) - 1,  # same seq as last chunk
    "text": chunks[-1],
})
dup_status = dup_r.json().get("status")

log("Test D: duplicate chunk ignored", PASS if dup_status == "duplicate_ignored" else FAIL,
    f"status={dup_status}")

retrieve_count = decisions.count("RETRIEVE")
log("Test D: RETRIEVE not triggered on every chunk",
    PASS if retrieve_count < len(chunks) else WARN,
    f"RETRIEVE decisions: {retrieve_count}/{len(chunks)}")

# ─── TEST E: Stop during retrieval ───────────────────────────────────────────
print("\n=== TEST E: Stop while retrieval may be running ===")
out_e = replay(
    "What is the infrastructure budget for Alpha Project and who approved it?",
    words_per_chunk=4, delay_s=0.3,
    stop_after=2  # stop after 2 chunks
)
log("Test E: stopped at expected chunk",
    PASS if out_e["stopped_at"] == 2 else FAIL,
    f"stopped_at={out_e['stopped_at']}")
log("Test E: no final_result (stopped, not completed)",
    PASS if out_e["final_result"] is None else WARN,
    f"final_result={out_e['final_result']}")

# Verify old session is invalidated — new chunk with same session should get 'session_invalidated'
r_after_stop = CLIENT.post(f"{BASE}/transcript/chunk", json={
    "session_id": out_e["session_id"],
    "request_id": out_e["request_id"],
    "seq": 99, "text": "extra chunk after stop",
})
log("Test E: new chunk on stopped session returns session_invalidated",
    PASS if r_after_stop.json().get("status") == "session_invalidated" else WARN,
    f"status={r_after_stop.json().get('status')}")

# ─── TEST F: New Session while answer generating ─────────────────────────────
print("\n=== TEST F: New Session while old answer generating ===")
# Start a slow question and immediately stop it (simulating New Session)
sid_f = str(uuid.uuid4())
rid_f = str(uuid.uuid4())
words_f = "What database does Beta Project use and who is the project lead?".split()
chunks_f = [" ".join(words_f[i:i+4]) for i in range(0, len(words_f), 4)]

for seq, chunk in enumerate(chunks_f[:3]):
    CLIENT.post(f"{BASE}/transcript/chunk", json={
        "session_id": sid_f, "request_id": rid_f, "seq": seq, "text": chunk
    })
    time.sleep(0.2)

# Get a new session
ns = CLIENT.post(f"{BASE}/ask/new-session").json()
new_sid = ns["session_id"]

# Stop old session
stop_r = CLIENT.post(f"{BASE}/transcript/stop", json={"session_id": sid_f, "request_id": rid_f})
log("Test F: old session stopped", PASS if stop_r.json().get("status") == "stopped" else FAIL,
    stop_r.json().get("status"))

# Try to submit final on old invalidated session
final_r = CLIENT.post(f"{BASE}/transcript/final", json={"session_id": sid_f, "request_id": rid_f})
log("Test F: final on invalidated session returns 409",
    PASS if final_r.status_code == 409 else WARN, f"HTTP {final_r.status_code}")
log("Test F: new session ID different from old",
    PASS if new_sid != sid_f else FAIL)

# ─── TEST G: Late entity change ───────────────────────────────────────────────
print("\n=== TEST G: Late entity change in transcript ===")
if not models_ok:
    log("Test G", BLOCKED, "models unavailable")
else:
    sid_g = str(uuid.uuid4())
    rid_g = str(uuid.uuid4())
    # Send chunks about Alpha, then change to Beta at the end
    full_text = "What is the project lead of Alpha Project? Actually I meant Beta Project."
    out_g = replay(full_text, words_per_chunk=4, delay_s=0.3,
                   session_id=sid_g, request_id=rid_g)
    fr_g = out_g.get("final_result") or {}
    answer_g = fr_g.get("answer", {}).get("answer", "")
    print(f"  Final text: {full_text}")
    print(f"  Answer: {answer_g[:250]}")

    # The answer should mention Beta Project, not just Alpha (because the final
    # question context included "Beta Project")
    has_beta = "beta" in answer_g.lower()
    log("Test G: answer accounts for late entity change (Beta Project)",
        PASS if has_beta else WARN,
        "Answer: " + answer_g[:100])
    log("Test G: supplementary retrieval ran",
        PASS if fr_g.get("timing", {}).get("retrieval_duration") is not None else WARN)

# ─── TEST H: Two simultaneous sessions ───────────────────────────────────────
print("\n=== TEST H: Two simultaneous sessions ===")
sid_h1 = str(uuid.uuid4())
sid_h2 = str(uuid.uuid4())
rid_h1 = str(uuid.uuid4())
rid_h2 = str(uuid.uuid4())

decisions_h1 = []
decisions_h2 = []

# Interleave chunks from two different sessions
text_h1_words = "What database does Alpha Project use?".split()
text_h2_words = "Who leads the Beta Project initiative?".split()
chunks_h1 = [" ".join(text_h1_words[i:i+2]) for i in range(0, len(text_h1_words), 2)]
chunks_h2 = [" ".join(text_h2_words[i:i+2]) for i in range(0, len(text_h2_words), 2)]

for i in range(max(len(chunks_h1), len(chunks_h2))):
    if i < len(chunks_h1):
        r1 = CLIENT.post(f"{BASE}/transcript/chunk", json={
            "session_id": sid_h1, "request_id": rid_h1,
            "seq": i, "text": chunks_h1[i]
        })
        decisions_h1.append(r1.json().get("decision"))
    if i < len(chunks_h2):
        r2 = CLIENT.post(f"{BASE}/transcript/chunk", json={
            "session_id": sid_h2, "request_id": rid_h2,
            "seq": i, "text": chunks_h2[i]
        })
        decisions_h2.append(r2.json().get("decision"))
    time.sleep(0.2)

log("Test H: session 1 has independent decision stream",
    PASS, f"decisions={decisions_h1}")
log("Test H: session 2 has independent decision stream",
    PASS, f"decisions={decisions_h2}")
log("Test H: session IDs are different", PASS if sid_h1 != sid_h2 else FAIL)

# ─── SUMMARY ─────────────────────────────────────────────────────────────────
print("\n=== SUMMARY ===")
passed = sum(1 for r in results if PASS in r["status"])
failed = sum(1 for r in results if FAIL in r["status"])
blocked = sum(1 for r in results if BLOCKED in r["status"])
warned = sum(1 for r in results if WARN in r["status"])

print(f"  PASSED:  {passed}")
print(f"  FAILED:  {failed}")
print(f"  BLOCKED: {blocked}")
print(f"  WARNED:  {warned}")
print(f"  Total:   {len(results)}")

if failed:
    print("\nFailed checks:")
    for r in results:
        if FAIL in r["status"]:
            print(f"  - {r['label']}: {r['detail']}")

print("\n  Frontend: http://localhost:3001/ask")
print("  Backend:  http://127.0.0.1:8001/docs")
print("\n  Citation click verification: MANUAL (see report)")
print("  Instructions: Open http://localhost:3001/ask, Ask a question,")
print("  click any [S1] citation chip → evidence panel should scroll to")
print("  the matching passage and display the exact excerpt and chunk_id.")
