import httpx
import uuid
import time
import json

BASE = "http://127.0.0.1:8001/api"
CLIENT = httpx.Client(timeout=300.0)

def test_turn1():
    session_id = str(uuid.uuid4())
    request_id = str(uuid.uuid4())
    text = "What is the Alpha project budget and who leads the Beta project?"
    words = text.split()
    chunks = [" ".join(words[i:i+4]) for i in range(0, len(words), 4)]
    
    for seq, chunk in enumerate(chunks):
        CLIENT.post(f"{BASE}/transcript/chunk", json={
            "session_id": session_id,
            "request_id": request_id,
            "seq": seq,
            "text": chunk,
        })
        time.sleep(0.3)
        
    final_r = CLIENT.post(f"{BASE}/transcript/final", json={
        "session_id": session_id,
        "request_id": request_id,
    })
    
    trace = CLIENT.get(f"{BASE}/transcript/export/{session_id}").json()
    with open("trace_t1.json", "w") as f:
        json.dump(trace, f, indent=2)
        
    print(final_r.json())

test_turn1()
