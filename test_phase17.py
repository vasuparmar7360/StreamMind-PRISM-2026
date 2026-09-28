import requests
import pytest
import os
from sqlalchemy import create_engine, text

BASE_URL = "http://localhost:8000/api"

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    engine = create_engine("postgresql+psycopg://vasuparmar@127.0.0.1:5432/ownmind")
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE audit_events, action_proposals, conflicts, decisions, document_chunks, documents CASCADE;"))
    yield

def upload_file(filename: str, content: str):
    path = f"/tmp/{filename}"
    with open(path, "w") as f:
        f.write(content)
        
    with open(path, "rb") as f:
        res = requests.post(f"{BASE_URL}/documents/upload", files={"file": (filename, f, "text/plain")})
    
    os.remove(path)
    return res.json()

def test_health_check():
    res = requests.get(f"{BASE_URL}/health")
    assert res.status_code == 200
    
def test_upload_and_extract():
    doc = upload_file("Test1.txt", "Project Demo Date: 7 October")
    assert "id" in doc
    
    res_index = requests.post(f"{BASE_URL}/documents/{doc['id']}/index")
    # If ollama is offline, it raises 503, which is expected.
    assert res_index.status_code in [200, 503]
    
    res_dec = requests.post(f"{BASE_URL}/documents/{doc['id']}/decisions")
    assert res_dec.status_code == 200
    data = res_dec.json()
    assert data["decisions_detected"] == 1
    assert data["decisions"][0]["value"] == "7 October"
    
def test_conflict_detection():
    doc = upload_file("Test_Conflict.txt", "Demo Date = 9 October")
    res_index = requests.post(f"{BASE_URL}/documents/{doc['id']}/index")
    
    res_dec = requests.post(f"{BASE_URL}/documents/{doc['id']}/decisions")
    assert res_dec.status_code == 200
    data = res_dec.json()
    assert data["conflicts_created"] == 1
    
    # Check open conflicts
    con_res = requests.get(f"{BASE_URL}/conflicts?status=open")
    assert con_res.status_code == 200
    conflicts = con_res.json()["conflicts"]
    assert len(conflicts) >= 1
    assert conflicts[-1]["candidate_value"] == "9 October"
    
def test_memory_summary():
    res = requests.get(f"{BASE_URL}/memory/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["documents_uploaded"] >= 2
    assert data["active_decisions"] >= 1
    assert data["open_conflicts"] >= 1
    assert data["audit_events"] >= 1

def test_system_status():
    res = requests.get(f"{BASE_URL}/system/status")
    assert res.status_code == 200
    data = res.json()
    assert data["backend"]["status"] == "online"
    assert data["database"]["status"] == "online"
    assert "ollama" in data

def test_safe_removal():
    doc = upload_file("Test_Remove.txt", "Some random text.")
    res_del = requests.delete(f"{BASE_URL}/documents/{doc['id']}")
    assert res_del.status_code == 200
    assert res_del.json()["status"] == "removed"
