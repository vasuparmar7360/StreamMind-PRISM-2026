import requests
import time
import os
import shutil

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

def propose_action(decision_id: str):
    res = requests.post(f"{BASE_URL}/actions/propose", json={"decision_id": decision_id})
    return res.json()

def approve_action(action_id: str):
    res = requests.post(f"{BASE_URL}/actions/{action_id}/approve")
    res.raise_for_status()
    return res.json()
    
def reject_action(action_id: str):
    res = requests.post(f"{BASE_URL}/actions/{action_id}/reject", json={"reason": "Test rejection"})
    res.raise_for_status()
    return res.json()

def execute_action(action_id: str):
    res = requests.post(f"{BASE_URL}/actions/{action_id}/execute")
    return res.json()
    
def get_audit(params=None):
    res = requests.get(f"{BASE_URL}/audit", params=params)
    res.raise_for_status()
    return res.json()

def clear_data():
    if os.path.exists("data/workspace/tasks"):
        shutil.rmtree("data/workspace/tasks")
    if os.path.exists("data/workspace/briefs"):
        shutil.rmtree("data/workspace/briefs")
        
    # Resolve any open conflicts to ensure action proposal works
    res = requests.get(f"{BASE_URL}/conflicts?status=open")
    if res.status_code == 200:
        conflicts = res.json().get("conflicts", [])
        for c in conflicts:
            requests.post(f"{BASE_URL}/conflicts/{c['id']}/resolve", json={"resolution": "keep_existing"})

def run_tests():
    print("=" * 60)
    print("PHASE 15 — AUDIT TRAIL PERSISTENCE — AUTOMATED TESTS")
    print("=" * 60)

    clear_data()
    
    # Pre-test: get initial count
    initial_audit = get_audit()
    initial_count = initial_audit["total"]

    print("\n--- Test 1: Complete Demo Flow ---")
    doc1 = upload("Audit_Test_1.txt", "The team has replaced Django with Flask because it is simpler.")
    index(doc1["id"])
    detect_decisions(doc1["id"])
    
    # Wait for processing
    time.sleep(1)
    
    doc2 = upload("Audit_Test_2.txt", "The team has replaced Flask with Express because it is better.")
    index(doc2["id"])
    res = detect_decisions(doc2["id"])
    print("detect_decisions res:", res)
    decision_id = res["persisted_decisions"][0]["id"] if "persisted_decisions" in res else res["decisions"][0]["id"]
    
    action_prop = propose_action(decision_id)
    print("propose_action res:", action_prop)
    action_id_1 = action_prop["id"]
    
    approve_action(action_id_1)
    execute_action(action_id_1)
    
    # Verify Audit Events
    audit = get_audit()
    events = audit["events"]
    types = [e["event_type"] for e in events]
    
    assert "document_uploaded" in types
    assert "document_index_started" in types
    assert "document_index_failed" in types # since Ollama is bypassed
    assert "decision_created" in types
    assert "decision_replaced" in types
    assert "action_proposed" in types
    assert "action_approved" in types
    assert "action_execution_started" in types
    assert "action_executed" in types
    print("  ✓ Complete flow generated all expected audit events.")

    print("\n--- Test 2: Conflict Flow ---")
    doc3 = upload("Audit_Conflict_1.txt", "Database = PostgreSQL.")
    index(doc3["id"])
    detect_decisions(doc3["id"])
    
    doc4 = upload("Audit_Conflict_2.txt", "Database = MongoDB.")
    index(doc4["id"])
    detect_decisions(doc4["id"])
    
    # Get conflicts
    conflicts_res = requests.get(f"{BASE_URL}/conflicts?status=open")
    conflicts = conflicts_res.json()["conflicts"]
    assert len(conflicts) > 0
    conflict_id = conflicts[0]["id"]
    
    # Resolve conflict
    res = requests.post(f"{BASE_URL}/conflicts/{conflict_id}/resolve", json={"resolution": "keep_existing"})
    res.raise_for_status()
    
    audit = get_audit()
    types = [e["event_type"] for e in audit["events"]]
    assert "conflict_detected" in types
    assert "conflict_resolved" in types
    print("  ✓ Conflict flow generated detection and resolution audit events.")

    print("\n--- Test 3: Rejected Action ---")
    doc5 = upload("Audit_Reject.txt", "The team has replaced Express with Spring because it is better.")
    index(doc5["id"])
    res = detect_decisions(doc5["id"])
    dec_id = res["decisions"][0]["id"]
    
    action_prop = propose_action(dec_id)
    action_id = action_prop["id"]
    reject_action(action_id)
    
    audit = get_audit({"action_id": action_id})
    types = [e["event_type"] for e in audit["events"]]
    assert "action_proposed" in types
    assert "action_rejected" in types
    assert "action_executed" not in types
    print("  ✓ Rejected action logged properly.")
    
    print("\n--- Test 4: Failed Execution ---")
    # Simulate execution without approval
    action_prop = propose_action(dec_id)
    action_id = action_prop["id"]
    
    res = execute_action(action_id)
    assert res.get("status_code") == 400 or "detail" in res
    
    audit = get_audit({"action_id": action_id})
    types = [e["event_type"] for e in audit["events"]]
    assert "action_proposed" in types
    assert "action_executed" not in types
    print("  ✓ Failed/blocked execution did not log success.")

    print("\n--- Test 5: Idempotency ---")
    # Execute already executed action from Test 1
    # We use action_id from Test 1
    res = execute_action(action_id_1)
    assert res.get("status_code") == 400 or "detail" in res
    
    audit = get_audit({"action_id": action_id_1})
    exec_count = len([e for e in audit["events"] if e["event_type"] == "action_executed"])
    assert exec_count == 1
    print("  ✓ Duplicate successful executions avoided.")

    print("\n============================================================")
    print("ALL PHASE 15 TESTS PASSED ✓")
    print("============================================================")

if __name__ == "__main__":
    run_tests()
