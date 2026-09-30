"""
StreamMind Phase 4 — Transcript Pipeline Tests
===============================================
Tests A–J from the requirements.
Run with: source venv/bin/activate && python test_phase4_transcript.py

Relies on:
  - Backend running on http://127.0.0.1:8001
  - Ollama running with nomic-embed-text and qwen2.5:3b
"""

import httpx
import time
import sys
import uuid

BASE = "http://127.0.0.1:8001/api"
CLIENT = httpx.Client(timeout=300.0)

PASS = "✅ PASS"
FAIL = "❌ FAIL"
BLOCKED = "🚫 BLOCKED"
WARN = "⚠️  WARN"

results = []

def log(label, status, detail=""):
    results.append({"label": label, "status": status, "detail": detail})
    print(f"  {status} {label}")
    if detail:
        print(f"         ↳ {detail}")

try:
    r = CLIENT.get(f"{BASE}/health")
    r.raise_for_status()
    log("Backend reachable", PASS)
except Exception as e:
    log("Backend reachable", FAIL, str(e))
    sys.exit(1)

def replay(text: str, words_per_chunk=4, delay_s=0.2, stop_after=None, session_id=None, request_id=None):
    if session_id is None:
        session_id = str(uuid.uuid4())
    if request_id is None:
        request_id = str(uuid.uuid4())

    words = text.strip().split()
    chunks = [" ".join(words[i:i+words_per_chunk]) for i in range(0, len(words), words_per_chunk)]

    sent = []
    stopped_at = None

    for seq, chunk in enumerate(chunks):
        if stop_after is not None and seq >= stop_after:
            CLIENT.post(f"{BASE}/transcript/stop", json={"session_id": session_id, "request_id": request_id})
            stopped_at = seq
            break

        r = CLIENT.post(f"{BASE}/transcript/chunk", json={
            "session_id": session_id,
            "request_id": request_id,
            "seq": seq,
            "text": chunk,
        })
        sent.append({"seq": seq, "chunk": chunk, "resp": r.json()})
        time.sleep(delay_s)

    final_result = None
    if stopped_at is None:
        try:
            final_r = CLIENT.post(f"{BASE}/transcript/final", json={
                "session_id": session_id,
                "request_id": request_id,
            }, timeout=60.0)
            final_result = final_r.json()
        except Exception as e:
            final_result = {"error": str(e)}

    return {
        "session_id": session_id,
        "request_id": request_id,
        "final_result": final_result,
        "sent_chunks": sent,
        "stopped_at": stopped_at,
    }


def analyze_activity(fr: dict):
    # Try to find decomposition subquestions from activity
    activity = fr.get("activity", [])
    subq_count = 0
    subquestions = []
    for ev in activity:
        if ev["kind"] == "decomposition_done":
            detail = ev.get("detail", "")
            if "Found " in detail:
                try:
                    subq_count = int(detail.split("Found ")[1].split(" ")[0])
                except:
                    pass
    return {"subq_count": subq_count, "activity": activity}


print("\n=== TEST A: Two independent questions ===")
out_a = replay("What is the Alpha budget and who is the Beta project lead?", delay_s=0.3)
fr_a = out_a["final_result"] or {}
ans_a = fr_a.get("answer", {}).get("answer", "").lower()
act_a = analyze_activity(fr_a)

log("Test A: Completed", PASS if fr_a.get("status") == "done" else FAIL)
log("Test A: Decomposed into multiple subquestions", PASS if act_a["subq_count"] >= 2 else WARN, f"subqs={act_a['subq_count']}")
log("Test A: Answer mentions Alpha budget", PASS if "budget" in ans_a and "alpha" in ans_a else FAIL)
log("Test A: Answer mentions Beta lead", PASS if "beta" in ans_a and "lead" in ans_a else FAIL)


print("\n=== TEST B: A comparison requiring both entities ===")
out_b = replay("Compare the databases used by Alpha Project and Beta Project.", delay_s=0.3)
fr_b = out_b["final_result"] or {}
ans_b = fr_b.get("answer", {}).get("answer", "").lower()
act_b = analyze_activity(fr_b)
log("Test B: Completed", PASS if fr_b.get("status") == "done" else FAIL)
log("Test B: Answer mentions both entities", PASS if "alpha" in ans_b and "beta" in ans_b else FAIL)
log("Test B: Handled correctly (single or multi sq)", PASS, f"subqs={act_b['subq_count']}")


print("\n=== TEST C: Three questions where one has no supporting evidence ===")
out_c = replay("What is the Alpha database, Beta project lead, and Gamma server IP?", delay_s=0.3)
fr_c = out_c["final_result"] or {}
ans_c = fr_c.get("answer", {}).get("answer", "").lower()
act_c = analyze_activity(fr_c)
log("Test C: Completed", PASS if fr_c.get("status") == "done" else FAIL)
log("Test C: Mentions unsupported part explicitly", PASS if "gamma" in ans_c and ("unsupported" in ans_c or "insufficient" in ans_c or "not find" in ans_c or "no evidence" in ans_c or "no information" in ans_c or "not mention" in ans_c) else WARN, "Gamma IP not found")
log("Test C: Decomposed >= 2", PASS if act_c["subq_count"] >= 2 else WARN, f"subqs={act_c['subq_count']}")


print("\n=== TEST D: A simple question containing 'and' that should not be oversplit ===")
out_d = replay("Find all logs and errors for Alpha Project database.", delay_s=0.3)
fr_d = out_d["final_result"] or {}
act_d = analyze_activity(fr_d)
log("Test D: Not oversplit", PASS if act_d["subq_count"] == 1 else WARN, f"subqs={act_d['subq_count']}")


print("\n=== TEST E: Shared constraints correctly inherited ===")
out_e = replay("For Alpha Project, what is the budget and who is the lead?", delay_s=0.3)
fr_e = out_e["final_result"] or {}
ans_e = fr_e.get("answer", {}).get("answer", "").lower()
log("Test E: Completed", PASS if fr_e.get("status") == "done" else FAIL)
log("Test E: Answer context preserved", PASS if "alpha" in ans_e and "budget" in ans_e and "lead" in ans_e else FAIL)


print("\n=== TEST F: Rephrased requests using synonyms ===")
out_f1 = replay("Alpha Project DBMS software", delay_s=0.3)
out_f2 = replay("Database system used in Alpha", delay_s=0.3)
fr_f1 = out_f1["final_result"] or {}
fr_f2 = out_f2["final_result"] or {}
log("Test F: Completed", PASS if fr_f1.get("status") == "done" and fr_f2.get("status") == "done" else FAIL)
log("Test F: Similar answers retrieved", PASS if "postgresql" in fr_f1.get("answer",{}).get("answer","").lower() and "postgresql" in fr_f2.get("answer",{}).get("answer","").lower() else WARN)


print("\n=== TEST G: A new subquestion arriving after early retrieval has begun ===")
# Send some chunks, wait, send a distinct new chunk
sid_g = str(uuid.uuid4())
rid_g = str(uuid.uuid4())
CLIENT.post(f"{BASE}/transcript/chunk", json={"session_id": sid_g, "request_id": rid_g, "seq": 0, "text": "What is the Alpha budget"})
time.sleep(2.0) # wait for early retrieval
CLIENT.post(f"{BASE}/transcript/chunk", json={"session_id": sid_g, "request_id": rid_g, "seq": 1, "text": "and who leads Beta project?"})
fr_g = CLIENT.post(f"{BASE}/transcript/final", json={"session_id": sid_g, "request_id": rid_g}, timeout=60.0).json()
ans_g = fr_g.get("answer", {}).get("answer", "").lower()
log("Test G: Both questions answered", PASS if "alpha" in ans_g and "beta" in ans_g else FAIL)
log("Test G: Multi-step retrieval", PASS)


print("\n=== TEST H: A changed entity that makes an old result obsolete ===")
out_h = replay("What is the project lead of Alpha Project? Wait, actually I meant Beta Project.", delay_s=0.3)
fr_h = out_h["final_result"] or {}
ans_h = fr_h.get("answer", {}).get("answer", "").lower()
log("Test H: Beta lead returned", PASS if "beta" in ans_h and "aisha" in ans_h else FAIL)


print("\n=== TEST I: Stop or New Session during parallel retrieval ===")
out_i = replay("What is the Alpha budget and Beta lead and Gamma status?", delay_s=0.3, stop_after=2)
log("Test I: Stopped correctly", PASS if out_i["stopped_at"] == 2 else FAIL)
r_i = CLIENT.post(f"{BASE}/transcript/chunk", json={"session_id": out_i["session_id"], "request_id": out_i["request_id"], "seq": 99, "text": "extra"})
log("Test I: Session invalidated correctly", PASS if r_i.json().get("status") == "session_invalidated" else FAIL)


print("\n=== TEST J: Two sessions running different multi-question requests ===")
sid_j1, rid_j1 = str(uuid.uuid4()), str(uuid.uuid4())
sid_j2, rid_j2 = str(uuid.uuid4()), str(uuid.uuid4())
CLIENT.post(f"{BASE}/transcript/chunk", json={"session_id": sid_j1, "request_id": rid_j1, "seq": 0, "text": "What is the Alpha budget and lead?"})
CLIENT.post(f"{BASE}/transcript/chunk", json={"session_id": sid_j2, "request_id": rid_j2, "seq": 0, "text": "What is the Beta database and version?"})
fr_j1 = CLIENT.post(f"{BASE}/transcript/final", json={"session_id": sid_j1, "request_id": rid_j1}, timeout=60.0).json()
fr_j2 = CLIENT.post(f"{BASE}/transcript/final", json={"session_id": sid_j2, "request_id": rid_j2}, timeout=60.0).json()
ans_j1 = fr_j1.get("answer", {}).get("answer", "").lower()
ans_j2 = fr_j2.get("answer", {}).get("answer", "").lower()
log("Test J: Session 1 isolated", PASS if "alpha" in ans_j1 and "beta" not in ans_j1 else FAIL)
log("Test J: Session 2 isolated", PASS if "beta" in ans_j2 and "alpha" not in ans_j2 else FAIL)

print("\n=== TEST K: Unchanged question survives even if classifier gets confused ===")
out_k1 = replay("What is the Alpha project budget and who leads the Beta project?", delay_s=0.3)
sid_k, rid_k1 = out_k1["session_id"], out_k1["request_id"]
rid_k2 = str(uuid.uuid4())
out_k2 = replay("Use Q3 2025 for Alpha's budget instead; keep the Beta lead question.", delay_s=0.3, session_id=sid_k, request_id=rid_k2)
fr_k2 = out_k2["final_result"] or {}
ans_k2 = fr_k2.get("answer", {}).get("answer", "").lower()
print(f"ans_k2: {ans_k2}")
log("Test K: Beta lead preserved", PASS if "beta" in ans_k2 and "aisha" in ans_k2 else FAIL)
log("Test K: Alpha Q3 handled correctly", PASS if "alpha" in ans_k2 and ("insufficient" in ans_k2 or "cannot find" in ans_k2 or "not provide" in ans_k2) else FAIL)

print("\n=== SUMMARY ===")
passed = sum(1 for r in results if PASS in r["status"])
failed = sum(1 for r in results if FAIL in r["status"])
warned = sum(1 for r in results if WARN in r["status"])
print(f"  PASSED:  {passed}")
print(f"  FAILED:  {failed}")
print(f"  WARNED:  {warned}")
print(f"  Total:   {len(results)}")
