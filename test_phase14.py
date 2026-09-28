import json
import httpx
from typing import Dict, Any

BASE_URL = "http://127.0.0.1:8000"

def upload(filename: str, content: str) -> Dict[str, Any]:
    with httpx.Client() as client:
        res = client.post(
            f"{BASE_URL}/api/documents/upload",
            files={"file": (filename, content.encode("utf-8"), "text/plain")}
        )
        res.raise_for_status()
        return res.json()

def process_decisions(doc_id: str) -> Dict[str, Any]:
    with httpx.Client(timeout=30.0) as client:
        res = client.post(f"{BASE_URL}/api/documents/{doc_id}/decisions")
        res.raise_for_status()
        return res.json()

def propose_action(decision_id: str) -> Dict[str, Any]:
    with httpx.Client(timeout=60.0) as client:
        res = client.post(
            f"{BASE_URL}/api/actions/propose",
            json={"decision_id": decision_id}
        )
        if res.status_code != 200:
            return {"status_code": res.status_code, "detail": res.json().get("detail")}
        return res.json()

def get_action(action_id: str) -> Dict[str, Any]:
    with httpx.Client() as client:
        res = client.get(f"{BASE_URL}/api/actions/{action_id}")
        res.raise_for_status()
        return res.json()

def approve_action(action_id: str) -> Dict[str, Any]:
    with httpx.Client() as client:
        res = client.post(f"{BASE_URL}/api/actions/{action_id}/approve")
        res.raise_for_status()
        return res.json()

def reject_action(action_id: str) -> Dict[str, Any]:
    with httpx.Client() as client:
        res = client.post(
            f"{BASE_URL}/api/actions/{action_id}/reject",
            json={"reason": "Testing rejection"}
        )
        res.raise_for_status()
        return res.json()

def execute_action(action_id: str) -> Dict[str, Any]:
    with httpx.Client() as client:
        res = client.post(f"{BASE_URL}/api/actions/{action_id}/execute")
        if res.status_code != 200:
            return {"status_code": res.status_code, "detail": res.json().get("detail")}
        return res.json()

def run_tests():
    print("=" * 60)
    print("PHASE 14 — ACTION PROPOSALS + HUMAN APPROVAL GATE — AUTOMATED TESTS")
    print("=" * 60)
    
    # 1. Setup Decisions
    doc = upload("Phase14_Base.txt", "Demo Date = 9 October. Reason: Sensor delivery delayed.\nDatabase = MySQL.")
    res = process_decisions(doc["id"])
    
    demo_decision_id = None
    db_decision_id = None
    for d in res["decisions"]:
        if "demo" in d["topic"].lower():
            demo_decision_id = d["id"]
        if "database" in d["topic"].lower():
            db_decision_id = d["id"]
            
    assert demo_decision_id, "Demo decision not found"
    
    # 2. Test 1: Generate Action Proposal
    print("\n--- Test 1: Generate Action Proposal ---")
    proposal = propose_action(demo_decision_id)
    assert proposal.get("status") == "pending", f"Expected pending status, got {proposal}"
    assert proposal.get("action_type") in ["create_task", "save_brief"], "Expected valid action type"
    action_id_1 = proposal["id"]
    print("  ✓ Action Proposal generated successfully. ID:", action_id_1)
    
    # 3. Test 2 & 3: Approve and Execute Action
    print("\n--- Test 2 & 3: Approve and Execute Action ---")
    approved = approve_action(action_id_1)
    assert approved["status"] == "approved", "Expected approved status"
    
    executed = execute_action(action_id_1)
    assert executed.get("status") == "executed", f"Expected executed status, got {executed}"
    assert executed["execution_status"] == "success", "Expected execution success"
    print(f"  ✓ Action executed successfully. File path: {executed['execution_result']['result']['file_path']}")
    
    # 4. Test 4: Execution without approval
    print("\n--- Test 4: Execution without approval ---")
    proposal_2 = propose_action(demo_decision_id)
    action_id_2 = proposal_2["id"]
    exec_fail_1 = execute_action(action_id_2)
    assert exec_fail_1.get("status_code") == 400, f"Expected 400, got {exec_fail_1}"
    assert "user approval" in exec_fail_1["detail"], "Expected user approval error"
    print("  ✓ Execution blocked for pending action.")
    
    # 5. Test 5: Rejection and rejection execution
    print("\n--- Test 5: Rejection and rejection execution ---")
    rejected = reject_action(action_id_2)
    assert rejected["status"] == "rejected", "Expected rejected status"
    exec_fail_2 = execute_action(action_id_2)
    assert exec_fail_2.get("status_code") == 400, f"Expected 400, got {exec_fail_2}"
    assert "Rejected actions cannot be executed" in exec_fail_2["detail"], "Expected rejection error message"
    print("  ✓ Execution blocked for rejected action.")
    
    # 6. Test 6: Duplicate execution
    print("\n--- Test 6: Duplicate execution ---")
    exec_fail_3 = execute_action(action_id_1)
    assert exec_fail_3.get("status_code") == 400, f"Expected 400, got {exec_fail_3}"
    assert "Action already executed" in exec_fail_3["detail"], "Expected already executed error"
    print("  ✓ Duplicate execution blocked.")
    
    # 7. Test 7: Open conflict safety
    print("\n--- Test 7: Open conflict safety ---")
    conflict_doc = upload("Phase14_Conflict.txt", "Database = PostgreSQL.")
    process_decisions(conflict_doc["id"])
    
    # Attempt to propose action on the db decision which now has an open conflict
    conflict_fail = propose_action(db_decision_id)
    print("Conflict fail output:", conflict_fail)
    assert conflict_fail.get("status_code") == 400, f"Expected 400 for conflict, got {conflict_fail}"
    assert "open conflict" in conflict_fail["detail"].lower(), "Expected open conflict error"
    print("  ✓ Action proposal blocked by open conflict.")
    
    print("\n============================================================")
    print("ALL PHASE 14 TESTS PASSED ✓")
    print("============================================================")

if __name__ == "__main__":
    run_tests()
