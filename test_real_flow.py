import httpx
import time
import sys
import uuid
import json

BASE = "http://127.0.0.1:8001/api"
CLIENT = httpx.Client(timeout=300.0)

def replay(text: str, session_id: str, request_id: str, words_per_chunk=4, delay_s=0.2):
    words = text.strip().split()
    chunks = [" ".join(words[i:i+words_per_chunk]) for i in range(0, len(words), words_per_chunk)]

    for seq, chunk in enumerate(chunks):
        r = CLIENT.post(f"{BASE}/transcript/chunk", json={
            "session_id": session_id,
            "request_id": request_id,
            "seq": seq,
            "text": chunk,
        })
        time.sleep(delay_s)

    final_r = CLIENT.post(f"{BASE}/transcript/final", json={
        "session_id": session_id,
        "request_id": request_id,
    }, timeout=120.0)
    return final_r.json()

def export_trace(session_id: str):
    return CLIENT.get(f"{BASE}/transcript/export/{session_id}").json()

def main():
    session_id = str(uuid.uuid4())
    req_a = str(uuid.uuid4())
    req_b = str(uuid.uuid4())

    print("Running Part A...")
    text_a = "What is the Alpha project budget and who leads the Beta project?"
    res_a = replay(text_a, session_id, req_a)
    print("Part A Answer:")
    print(res_a.get("answer", {}).get("answer"))
    
    trace_a = export_trace(session_id)
    with open("trace_a.json", "w") as f:
        json.dump(trace_a, f, indent=2)

    print("\nRunning Part B...")
    text_b = "Use Q3 2025 for Alpha’s budget instead; keep the Beta lead question."
    res_b = replay(text_b, session_id, req_b)
    print("Part B Answer:")
    print(res_b.get("answer", {}).get("answer"))
    
    trace_b = export_trace(session_id)
    with open("trace_b.json", "w") as f:
        json.dump(trace_b, f, indent=2)

    print("\nCheck trace files trace_a.json and trace_b.json")

if __name__ == "__main__":
    main()
