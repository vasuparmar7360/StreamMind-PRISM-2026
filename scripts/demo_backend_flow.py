import requests
import json
import time

BASE_URL = "http://localhost:8000/api"

def upload_and_process(filename: str, content: str):
    print(f"\n--- Uploading: {filename} ---")
    path = f"/tmp/{filename}"
    with open(path, "w") as f:
        f.write(content)
        
    with open(path, "rb") as f:
        res = requests.post(f"{BASE_URL}/documents/upload", files={"file": (filename, f, "text/plain")})
    
    doc = res.json()
    print("Uploaded:", doc["id"])
    
    print("Indexing (this may fail with 503 if Ollama is down)...")
    res_index = requests.post(f"{BASE_URL}/documents/{doc['id']}/index")
    if res_index.status_code == 503:
        print("Indexing bypassed: Ollama is offline.")
    elif res_index.status_code == 200:
        print("Indexed:", res_index.json())
        
    print("Extracting Decisions...")
    res_dec = requests.post(f"{BASE_URL}/documents/{doc['id']}/decisions")
    if res_dec.status_code == 200:
        print(f"Decisions detected: {res_dec.json().get('decisions_detected')}")
    else:
        print("Decision extraction failed.")
    return doc

def main():
    print("=" * 50)
    print(" OwnMind End-to-End Backend Demo Flow")
    print("=" * 50)
    
    # 1. Upload Project Plan
    doc1 = upload_and_process(
        "01_Project_Plan.txt", 
        "Project Demo Date: 7 October\nBackend Framework: Flask\nDatabase: PostgreSQL\n"
    )
    
    # 2. Upload Meeting Update
    doc2 = upload_and_process(
        "02_Meeting_Update.txt",
        "Because sensor delivery was delayed, the project demo has been moved from 7 October to 9 October.\n"
    )
    
    # 3. Check Decisions Lineage
    res = requests.post(f"{BASE_URL}/documents/{doc2['id']}/decisions")
    if res.status_code == 200:
        decisions = res.json().get("decisions", [])
        if decisions:
            dec_id = decisions[0]["id"]
            print(f"\n--- Checking Lineage for {dec_id} ---")
            lin = requests.get(f"{BASE_URL}/decisions/lineage/{dec_id}").json()
            print("Current Topic:", lin["current"]["topic"])
            print("Current Value:", lin["current"]["value"])
            if lin.get("replaced"):
                print("Replaced Value:", lin["replaced"]["value"])
    
    # 4. Ask OwnMind
    print("\n--- Asking OwnMind ---")
    ask_res = requests.post(f"{BASE_URL}/ask", json={"question": "Why was the demo moved?", "top_k": 3})
    if ask_res.status_code == 503:
        print("Ask OwnMind bypassed: Ollama is offline.")
    else:
        print("Answer:", ask_res.json().get("answer"))
        
    print("\n--- Final Status ---")
    mem = requests.get(f"{BASE_URL}/memory/summary").json()
    print("Memory Summary:", json.dumps(mem, indent=2))
    
    print("\nDemo flow complete.")

if __name__ == "__main__":
    main()
