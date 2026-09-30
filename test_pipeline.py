import httpx
import time
import sys

BASE_URL = "http://127.0.0.1:8001/api"
client = httpx.Client(timeout=60.0)

print("1. Uploading test_doc.pdf...")
with open("test_doc.pdf", "rb") as f:
    files = {"file": ("test_doc.pdf", f, "application/pdf")}
    res = client.post(f"{BASE_URL}/documents/upload", files=files)
    if res.status_code != 201:
        print(f"Upload failed: {res.status_code} - {res.text}")
        sys.exit(1)
    doc_id = res.json()["id"]
    print(f"Uploaded successfully. Document ID: {doc_id}")

print("Waiting for background indexing to complete...")
time.sleep(10) # Give it some time to process

print("2. Fetching document text (Extraction)...")
res = client.get(f"{BASE_URL}/documents/{doc_id}/text")
if res.status_code != 200:
    print(f"Extraction failed: {res.status_code} - {res.text}")
else:
    print(f"Extraction successful: {res.json()['character_count']} characters extracted.")

print("3. Fetching document chunks...")
res = client.get(f"{BASE_URL}/documents/{doc_id}/chunks")
if res.status_code != 200:
    print(f"Chunking failed: {res.status_code} - {res.text}")
else:
    chunks = res.json()["chunks"]
    print(f"Chunking successful: {len(chunks)} chunks created.")
    if len(chunks) > 0:
        print("Sample chunk metadata:", {k: v for k, v in chunks[0].items() if k != 'text'})

print("4. Testing asking a question (Retrieval & Answers)...")
ask_payload = {
    "question": "What is this document about?",
    "stream": False,
    "conversation_id": "test_session_1"
}
res = client.post(f"{BASE_URL}/ask", json=ask_payload)
if res.status_code != 200:
    print(f"Ask failed: {res.status_code} - {res.text}")
else:
    data = res.json()
    print("Answer:")
    print(data.get("answer"))
    citations = data.get("citations", [])
    print(f"Citations returned: {len(citations)}")
    for c in citations:
        print(f" - [{c['citation_id']}] from {c.get('source_document_name')} (score: {c.get('similarity_score', 0):.2f})")

print("5. Testing an unsupported question...")
ask_payload_unsupported = {
    "question": "What is the secret recipe for Krabby Patty?",
    "stream": False,
    "conversation_id": "test_session_1"
}
res = client.post(f"{BASE_URL}/ask", json=ask_payload_unsupported)
if res.status_code == 200:
    print("Answer to unsupported question:")
    print(res.json().get("answer"))
else:
    print(f"Unsupported ask failed: {res.status_code} - {res.text}")

