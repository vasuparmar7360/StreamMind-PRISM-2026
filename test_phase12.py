import json
import httpx
import sys

BASE_URL = "http://127.0.0.1:8000"

def upload_file(filename: str, content: str):
    url = f"{BASE_URL}/api/documents/upload"
    files = {"file": (filename, content.encode("utf-8"), "text/plain")}
    res = httpx.post(url, files=files, timeout=10.0)
    assert res.status_code == 201, f"Upload failed: {res.text}"
    return res.json()

def process_decisions(doc_id: str):
    url = f"{BASE_URL}/api/documents/{doc_id}/decisions"
    res = httpx.post(url, timeout=15.0)
    assert res.status_code == 200, f"Decision processing failed: {res.text}"
    return res.json()

def get_decisions(status: str = None):
    url = f"{BASE_URL}/api/decisions"
    params = {"status": status} if status else {}
    res = httpx.get(url, params=params, timeout=10.0)
    assert res.status_code == 200, f"Get decisions failed: {res.text}"
    return res.json()

def get_decision_lineage(decision_id: str):
    url = f"{BASE_URL}/api/decisions/{decision_id}"
    res = httpx.get(url, timeout=10.0)
    assert res.status_code == 200, f"Get decision lineage failed: {res.text}"
    return res.json()

def run_tests():
    print("==================================================")
    print("PHASE 12 DECISION MEMORY & LINEAGE AUTOMATED TESTS")
    print("==================================================")

    # 1. TEST CASE 1: DEMO DATE
    print("\n--- Test Case 1: Demo Date (7 Oct -> 9 Oct) ---")
    doc_a = upload_file("Project_Plan.txt", "The project demo is scheduled for 7 October.")
    doc_a_id = doc_a["id"]
    print(f"Uploaded Project_Plan.txt (id={doc_a_id})")

    res_a = process_decisions(doc_a_id)
    print(f"Project_Plan.txt result: new={res_a['new_decisions']}, updated={res_a['updated_decisions']}, decisions={json.dumps(res_a['decisions'], indent=2)}")
    assert res_a["new_decisions"] == 1
    assert len(res_a["decisions"]) == 1
    dec_7_oct = res_a["decisions"][0]
    assert dec_7_oct["value"] == "7 October"
    assert dec_7_oct["status"] == "active"
    assert dec_7_oct["supersedes_decision_id"] is None

    # Document B with explicit replacement
    doc_b = upload_file("Meeting_Update_21Sep.txt", "Because sensor delivery was delayed, the demo has been moved from 7 October to 9 October.")
    doc_b_id = doc_b["id"]
    print(f"\nUploaded Meeting_Update_21Sep.txt (id={doc_b_id})")

    res_b = process_decisions(doc_b_id)
    print(f"Meeting_Update_21Sep.txt result: updated={res_b['updated_decisions']}, decisions={json.dumps(res_b['decisions'], indent=2)}")
    assert res_b["updated_decisions"] == 1
    dec_9_oct = res_b["decisions"][0]
    assert dec_9_oct["value"] == "9 October"
    assert dec_9_oct["status"] == "active"
    assert dec_9_oct["supersedes_decision_id"] == dec_7_oct["id"]
    assert "sensor delivery" in dec_9_oct["reason"].lower()

    # Check lineage
    lineage_b = get_decision_lineage(dec_9_oct["id"])
    print(f"\nLineage for Demo Date: {json.dumps(lineage_b, indent=2)}")
    assert lineage_b["topic"] == "Demo Date"
    assert lineage_b["current"]["value"] == "9 October"
    assert lineage_b["current"]["status"] == "active"
    assert len(lineage_b["lineage"]) == 2
    assert lineage_b["lineage"][0]["value"] == "7 October"
    assert lineage_b["lineage"][0]["status"] == "replaced"
    assert lineage_b["lineage"][0]["source"] == "Project_Plan.txt"
    assert lineage_b["lineage"][1]["value"] == "9 October"
    assert lineage_b["lineage"][1]["status"] == "active"
    assert lineage_b["lineage"][1]["source"] == "Meeting_Update_21Sep.txt"
    print("✓ Test Case 1 PASSED: 7 October -> 9 October lineage verified.")

    # 2. TEST CASE 2: BACKEND FRAMEWORK (Flask -> FastAPI)
    print("\n--- Test Case 2: Backend Framework (Flask -> FastAPI) ---")
    doc_c = upload_file("Tech_Stack_Initial.txt", "The backend framework selected for the project is Flask.")
    doc_c_id = doc_c["id"]
    res_c = process_decisions(doc_c_id)
    print(f"Tech_Stack_Initial.txt result: new={res_c['new_decisions']}, decisions={json.dumps(res_c['decisions'], indent=2)}")
    assert res_c["new_decisions"] == 1
    dec_flask = res_c["decisions"][0]
    assert dec_flask["value"] == "Flask"
    assert dec_flask["status"] == "active"

    doc_d = upload_file("Tech_Stack_Update.txt", "The team has replaced Flask with FastAPI because FastAPI integrates better with the Python AI services.")
    doc_d_id = doc_d["id"]
    res_d = process_decisions(doc_d_id)
    print(f"Tech_Stack_Update.txt result: updated={res_d['updated_decisions']}, decisions={json.dumps(res_d['decisions'], indent=2)}")
    assert res_d["updated_decisions"] == 1
    dec_fastapi = res_d["decisions"][0]
    assert dec_fastapi["value"] == "FastAPI"
    assert dec_fastapi["status"] == "active"
    assert dec_fastapi["supersedes_decision_id"] == dec_flask["id"]

    lineage_d = get_decision_lineage(dec_fastapi["id"])
    print(f"\nLineage for Backend Framework: {json.dumps(lineage_d, indent=2)}")
    assert len(lineage_d["lineage"]) == 2
    assert lineage_d["lineage"][0]["value"] == "Flask"
    assert lineage_d["lineage"][0]["status"] == "replaced"
    assert lineage_d["lineage"][1]["value"] == "FastAPI"
    assert lineage_d["lineage"][1]["status"] == "active"
    print("✓ Test Case 2 PASSED: Flask -> FastAPI lineage verified.")

    # 3. TEST CASE 3: DUPLICATE DECISION (FastAPI repeated)
    print("\n--- Test Case 3: Duplicate Decision (FastAPI repeated) ---")
    doc_e = upload_file("Backend_Notes.txt", "The project backend uses FastAPI.")
    doc_e_id = doc_e["id"]
    res_e = process_decisions(doc_e_id)
    print(f"Backend_Notes.txt result: unchanged={res_e['unchanged_decisions']}, updated={res_e['updated_decisions']}, new={res_e['new_decisions']}")
    assert res_e["unchanged_decisions"] == 1
    assert res_e["updated_decisions"] == 0
    assert res_e["new_decisions"] == 0

    # Ensure no fake FastAPI -> FastAPI lineage
    lineage_e = get_decision_lineage(dec_fastapi["id"])
    assert len(lineage_e["lineage"]) == 2, "Lineage should remain Flask -> FastAPI, no fake replacement!"
    print("✓ Test Case 3 PASSED: No fake replacement or duplicate active decision created.")

    # 4. TEST CASE 4: AMBIGUOUS DATA ("MongoDB is also being considered")
    print("\n--- Test Case 4: Ambiguous Data ('MongoDB is also being considered') ---")
    # First establish PostgreSQL as selected database
    doc_f = upload_file("Database_Selection.txt", "PostgreSQL has been selected as the project database.")
    doc_f_id = doc_f["id"]
    res_f = process_decisions(doc_f_id)
    assert res_f["new_decisions"] == 1
    dec_postgres = res_f["decisions"][0]
    assert dec_postgres["value"] == "PostgreSQL"
    assert dec_postgres["status"] == "active"

    # Now upload document with consideration
    doc_g = upload_file("Database_Exploration.txt", "MongoDB is also being considered.")
    doc_g_id = doc_g["id"]
    res_g = process_decisions(doc_g_id)
    print(f"Database_Exploration.txt result: detected={res_g['decisions_detected']}, new={res_g['new_decisions']}, decisions={res_g['decisions']}")
    assert res_g["decisions_detected"] == 0 or len(res_g["decisions"]) == 0
    # Verify PostgreSQL is still active!
    active_dbs = [d for d in get_decisions("active")["decisions"] if d["topic"].lower() == "database"]
    assert len(active_dbs) == 1
    assert active_dbs[0]["value"] == "PostgreSQL"
    assert active_dbs[0]["status"] == "active"
    print("✓ Test Case 4 PASSED: 'considered' was correctly rejected and did not alter PostgreSQL.")

    # 5. TEST CASE 5: UNCLEAR CONTRADICTION ("Database = MongoDB" without replacement wording)
    print("\n--- Test Case 5: Unclear Contradiction ('Database = MongoDB') ---")
    doc_h = upload_file("Database_Contradiction.txt", "Database = MongoDB")
    doc_h_id = doc_h["id"]
    res_h = process_decisions(doc_h_id)
    print(f"Database_Contradiction.txt result: ambiguous={res_h['ambiguous_decisions']}, updated={res_h['updated_decisions']}, new={res_h['new_decisions']}, decisions={json.dumps(res_h['decisions'], indent=2)}")
    assert res_h["ambiguous_decisions"] == 1
    assert res_h["updated_decisions"] == 0

    # Verify PostgreSQL is STILL ACTIVE
    active_dbs = [d for d in get_decisions("active")["decisions"] if d["topic"].lower() == "database"]
    assert len(active_dbs) == 1
    assert active_dbs[0]["value"] == "PostgreSQL"

    # Verify MongoDB is stored as AMBIGUOUS
    ambig_dbs = [d for d in get_decisions("ambiguous")["decisions"] if d["topic"].lower() == "database"]
    assert len(ambig_dbs) == 1
    assert ambig_dbs[0]["value"] == "MongoDB"
    print("✓ Test Case 5 PASSED: Unclear contradiction marked as AMBIGUOUS; PostgreSQL kept ACTIVE.")

    # 6. TEST CASE 6: IDEMPOTENCY
    print("\n--- Test Case 6: Idempotency (Processing same doc twice) ---")
    all_dec_before = get_decisions()
    count_before = all_dec_before["total"]

    res_b_again = process_decisions(doc_b_id)
    print(f"Reprocessing Meeting_Update_21Sep.txt: unchanged={res_b_again['unchanged_decisions']}, new={res_b_again['new_decisions']}, updated={res_b_again['updated_decisions']}")
    assert res_b_again["unchanged_decisions"] == 1
    assert res_b_again["new_decisions"] == 0
    assert res_b_again["updated_decisions"] == 0

    res_d_again = process_decisions(doc_d_id)
    print(f"Reprocessing Tech_Stack_Update.txt: unchanged={res_d_again['unchanged_decisions']}, new={res_d_again['new_decisions']}, updated={res_d_again['updated_decisions']}")
    assert res_d_again["unchanged_decisions"] == 1
    assert res_d_again["new_decisions"] == 0
    assert res_d_again["updated_decisions"] == 0

    all_dec_after = get_decisions()
    count_after = all_dec_after["total"]
    assert count_before == count_after, f"Database count changed from {count_before} to {count_after} on idempotent run!"
    print(f"✓ Test Case 6 PASSED: Re-processing documents is completely idempotent (count stayed {count_after}).")

    # 7. VERIFY HISTORICAL PRESERVATION
    print("\n--- Verification: Historical Decisions Remain Stored ---")
    replaced = get_decisions("replaced")
    print(f"Replaced decisions count: {replaced['total']}")
    replaced_vals = [d["value"] for d in replaced["decisions"]]
    assert "7 October" in replaced_vals
    assert "Flask" in replaced_vals
    print("✓ Historical decisions (7 October, Flask) remain stored with status='replaced'.")

    # 8. VERIFY PREVIOUS FEATURES STILL WORK
    print("\n--- Verification: Previous Features Operational ---")
    res_root = httpx.get(f"{BASE_URL}/")
    assert res_root.status_code == 200
    res_health = httpx.get(f"{BASE_URL}/api/health")
    assert res_health.status_code == 200

    # Verify search & ask routes exist and don't crash
    res_search = httpx.post(f"{BASE_URL}/api/search", json={"query": "demo date", "top_k": 3})
    assert res_search.status_code in [200, 503]
    res_ask = httpx.post(f"{BASE_URL}/api/ask", json={"question": "When is the demo?", "top_k": 3})
    assert res_ask.status_code in [200, 503]
    print(f"✓ Root, Health, Search, and Ask endpoints responded without crashing (ask status: {res_ask.status_code}).")

    print("\n==================================================")
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
