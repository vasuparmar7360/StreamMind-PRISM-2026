import httpx
import time
import uuid
import json

BASE = "http://127.0.0.1:8001/api"
CLIENT = httpx.Client(timeout=300.0)
PASS = "✅ PASS"
FAIL = "❌ FAIL"

def log(label, status, detail=""):
    print(f"  {status} {label}")
    if detail:
        print(f"         ↳ {detail}")

def replay(text: str, words_per_chunk=4, delay_s=0.2, session_id=None, request_id=None, trace_file=None):
    if session_id is None:
        session_id = str(uuid.uuid4())
    if request_id is None:
        request_id = str(uuid.uuid4())

    words = text.strip().split()
    chunks = [" ".join(words[i:i+words_per_chunk]) for i in range(0, len(words), words_per_chunk)]

    for seq, chunk in enumerate(chunks):
        CLIENT.post(f"{BASE}/transcript/chunk", json={
            "session_id": session_id,
            "request_id": request_id,
            "seq": seq,
            "text": chunk,
        })
        time.sleep(delay_s)

    try:
        final_r = CLIENT.post(f"{BASE}/transcript/final", json={
            "session_id": session_id,
            "request_id": request_id,
        }, timeout=60.0)
        final_result = final_r.json()
    except Exception as e:
        final_result = {"error": str(e)}
        
    trace = CLIENT.get(f"{BASE}/transcript/export/{session_id}").json()
    if trace_file:
        with open(trace_file, "w") as f:
            json.dump(trace, f, indent=2)

    return {
        "session_id": session_id,
        "request_id": request_id,
        "final_result": final_result
    }

print("\n=== TEST GENERALIZATION: Alpha/Beta Example ===")
out1 = replay("What is the Alpha project budget and who leads the Beta project?", delay_s=0.3, trace_file="trace_gen_1.json")
sid = out1["session_id"]
out2 = replay("Use Q3 2025 for Alpha's budget instead; keep the Beta lead question.", delay_s=0.3, session_id=sid, trace_file="trace_gen_2.json")
ans2 = out2["final_result"].get("answer", {}).get("answer", "").lower()
print(f"Alpha/Beta follow-up answer: {ans2}")
log("Beta lead preserved", PASS if "beta" in ans2 and "aisha" in ans2 else FAIL)
log("Alpha Q3 handled correctly", PASS if "alpha" in ans2 and ("insufficient" in ans2 or "cannot find" in ans2 or "not provide" in ans2 or "no supporting" in ans2 or "not present" in ans2) and "12,500" not in ans2[:ans2.find("beta")] else FAIL)

print("\n=== TEST GENERALIZATION: New Synthetic Example ===")
out3 = replay("What backend language does the Alpha project use, and what is the Beta project's primary database?", delay_s=0.3, trace_file="trace_gen_3.json")
sid2 = out3["session_id"]
ans3 = out3["final_result"].get("answer", {}).get("answer", "").lower()
print(f"Synthetic initial answer: {ans3}")

out4 = replay("What about the Gamma project instead of Alpha? Keep the Beta question.", delay_s=0.3, session_id=sid2, trace_file="trace_gen_4.json")
ans4 = out4["final_result"].get("answer", {}).get("answer", "").lower()
print(f"Synthetic follow-up answer: {ans4}")
log("Beta DB preserved", PASS if "beta" in ans4 and "mongodb" in ans4 else FAIL)
log("Gamma handled correctly", PASS if "gamma" in ans4 and ("insufficient" in ans4 or "cannot find" in ans4 or "not provide" in ans4 or "no supporting" in ans4 or "not present" in ans4 or "not mention" in ans4) else FAIL)
