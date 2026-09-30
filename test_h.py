import httpx
import time
import sys
import uuid
import json

BASE = "http://127.0.0.1:8001/api"
CLIENT = httpx.Client(timeout=300.0)

def replay(text: str, words_per_chunk=4, delay_s=0.2):
    session_id = str(uuid.uuid4())
    request_id = str(uuid.uuid4())
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
    
    trace = CLIENT.get(f"{BASE}/transcript/export/{session_id}").json()
    with open("trace_h.json", "w") as f:
        json.dump(trace, f, indent=2)

def main():
    replay("What is the project lead of Alpha Project? Wait, actually I meant Beta Project.")

if __name__ == "__main__":
    main()
