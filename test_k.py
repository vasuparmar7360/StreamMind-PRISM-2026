import httpx
import time
import sys
import uuid
import json

BASE = "http://127.0.0.1:8001/api"
CLIENT = httpx.Client(timeout=300.0)
PASS = "✅ PASS"
FAIL = "❌ FAIL"
WARN = "⚠️  WARN"

def log(label, status, detail=""):
    print(f"  {status} {label}")
    if detail:
        print(f"         ↳ {detail}")

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
        r = CLIENT.post(f"{BASE}/transcript/chunk", json={
            "session_id": session_id,
            "request_id": request_id,
            "seq": seq,
            "text": chunk,
        })
        time.sleep(delay_s)

    final_result = None
    try:
        final_r = CLIENT.post(f"{BASE}/transcript/final", json={
            "session_id": session_id,
            "request_id": request_id,
        }, timeout=60.0)
        final_result = final_r.json()
    except Exception as e:
        final_result = {"error": str(e)}

    trace = CLIENT.get(f"{BASE}/transcript/export/{session_id}").json()
    with open("trace_k.json", "w") as f:
        json.dump(trace, f, indent=2)

    return {
        "session_id": session_id,
        "request_id": request_id,
        "final_result": final_result,
        "trace": trace
    }

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
