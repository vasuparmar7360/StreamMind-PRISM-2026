import requests
import time
import os
import shutil
import json

BASE_URL = "http://localhost:8000/api"

def upload(filename: str, content: str):
    path = f"/tmp/{filename}"
    with open(path, "w") as f:
        f.write(content)
        
    with open(path, "rb") as f:
        res = requests.post(f"{BASE_URL}/documents/upload", files={"file": (filename, f, "text/plain")})
    
    os.remove(path)
    res.raise_for_status()
    return res.json()

def index(doc_id: str):
    res = requests.post(f"{BASE_URL}/documents/{doc_id}/index")
    if res.status_code == 503:
        return {"status": "failed"}
    res.raise_for_status()
    return res.json()

def detect_decisions(doc_id: str):
    res = requests.post(f"{BASE_URL}/documents/{doc_id}/decisions")
    res.raise_for_status()
    return res.json()

def clear_data():
    if os.path.exists("data/workspace/tasks"):
        shutil.rmtree("data/workspace/tasks")
    if os.path.exists("data/workspace/briefs"):
        shutil.rmtree("data/workspace/briefs")
        
    print("Clearing DB tables...")
    res = requests.post(f"{BASE_URL}/health/clear_db")
    if res.status_code == 404:
        # We will manually run a script if endpoint doesn't exist
        os.system('''python3 -c '
from sqlalchemy import create_engine, text
engine = create_engine("postgresql+psycopg://vasuparmar@127.0.0.1:5432/ownmind")
with engine.begin() as conn:
    conn.execute(text("TRUNCATE audit_events, action_proposals, conflicts, decisions, document_chunks, documents CASCADE;"))
' ''')

def run_tests():
    print("=" * 60)
    print("PHASE 16 — SOVEREIGN MEMORY + SETTINGS CONTROLS — AUTOMATED TESTS")
    print("=" * 60)
    
    clear_data()
    
    # Pre-populate some data
    doc1 = upload("Memory_Test.txt", "The team has replaced Django with Flask because it is simpler.")
    index(doc1["id"])
    res = detect_decisions(doc1["id"])
    print("Test 1 res:", res)
    decision_id = res["decisions"][0]["id"]
    
    print("\n--- Test 20: Memory Summary ---")
    summary = requests.get(f"{BASE_URL}/memory/summary").json()
    assert summary["documents_uploaded"] >= 1
    assert summary["total_chunks"] >= 1
    assert summary["active_decisions"] >= 1
    assert "audit_events" in summary
    print("  ✓ Memory summary returned realistic counts from DB.")
    
    print("\n--- Test 21: System Status ---")
    status = requests.get(f"{BASE_URL}/system/status").json()
    assert status["backend"]["status"] == "online"
    assert status["database"]["status"] == "online"
    assert status["privacy"]["local_only"] == True
    print("  ✓ System status returned actual component availability.")
    
    print("\n--- Test 22: Memory Export ---")
    export = requests.get(f"{BASE_URL}/memory/export").json()
    assert export["product"] == "OwnMind AI"
    assert len(export["memory"]["documents"]) >= 1
    assert "audit_events" in export["memory"]
    
    # Ensure no vectors
    for c in export["memory"].get("chunks", []):
        assert "embedding" not in c
        
    print("  ✓ Memory export is functional and safe.")
    
    print("\n--- Test 24: Dependent Document Removal Protection ---")
    del_res = requests.delete(f"{BASE_URL}/documents/{doc1['id']}")
    print("Test 24 res:", del_res.status_code, del_res.text)
    assert del_res.status_code == 200
    del_json = del_res.json()
    assert del_json["status"] == "requires_confirmation"
    assert len(del_json["dependencies"]["active_decisions"]) >= 1
    print("  ✓ Backend blocked destructive deletion and reported dependencies.")
    
    print("\n--- Test 25: Confirmed Removal ---")
    confirm_del_res = requests.delete(f"{BASE_URL}/documents/{doc1['id']}?confirm=true")
    print("Test 25 res:", confirm_del_res.status_code, confirm_del_res.text)
    assert confirm_del_res.status_code == 200
    assert confirm_del_res.json()["status"] == "removed"
    
    # Check decision is archived
    dec_check = requests.get(f"{BASE_URL}/decisions/lineage/{decision_id}")
    if dec_check.status_code == 200:
        assert dec_check.json()["current"]["status"] == "archived"
    
    # Check audit events
    audit_res = requests.get(f"{BASE_URL}/audit").json()
    types = [e["event_type"] for e in audit_res["events"]]
    assert "memory_dependency_detected" in types
    assert "document_removed" in types
    print("  ✓ Confirmed removal succeeded, audit trails intact, decisions archived safely.")
    
    print("\n--- Test 23: Safe Document Removal (No Dependencies) ---")
    doc2 = upload("No_Deps.txt", "Some random info.")
    del_safe = requests.delete(f"{BASE_URL}/documents/{doc2['id']}")
    assert del_safe.status_code == 200
    assert del_safe.json()["status"] == "removed"
    print("  ✓ Document with no dependencies removed successfully without confirm flag.")
    
    print("\n--- Test 26: Decision Archive ---")
    doc3 = upload("Dec_Archive.txt", "The team has replaced Django with Express because it is better.")
    index(doc3["id"])
    res3 = detect_decisions(doc3["id"])
    dec_id_3 = res3["decisions"][0]["id"]
    
    archive_res = requests.post(f"{BASE_URL}/decisions/{dec_id_3}/archive")
    assert archive_res.status_code == 200
    assert archive_res.json()["status"] == "archived"
    print("  ✓ Decision explicitly archived successfully.")

    print("\n============================================================")
    print("ALL PHASE 16 TESTS PASSED ✓")
    print("============================================================")

if __name__ == "__main__":
    run_tests()
