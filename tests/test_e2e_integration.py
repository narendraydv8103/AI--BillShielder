import json
import sys
import urllib.request
import urllib.error
from fastapi.testclient import TestClient
from backend.main import app

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_api():
    # Detect if live server is reachable, otherwise use TestClient
    live_server = False
    try:
        with urllib.request.urlopen(f"{BASE_URL}/health", timeout=1.0) as resp:
            if resp.status == 200:
                live_server = True
    except Exception:
        live_server = False

    if live_server:
        print("[Mode: Live Daemon at 127.0.0.1:8000]")
        client_get = lambda path: json.loads(urllib.request.urlopen(f"{BASE_URL}{path}").read().decode())
        def client_post(path, data):
            req = urllib.request.Request(
                f"{BASE_URL}{path}",
                data=json.dumps(data).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            return json.loads(urllib.request.urlopen(req).read().decode())
    else:
        print("[Mode: Direct ASGI TestClient]")
        tc = TestClient(app)
        client_get = lambda path: tc.get(f"/api/v1{path}").json()
        client_post = lambda path, data: tc.post(f"/api/v1{path}", json=data).json()

    print("--- 1. Testing /health ---")
    health = client_get("/health")
    assert health.get("status") in ["healthy", "connected"]
    print(f"Health: status={health.get('status')}, demo_mode={health.get('demo_mode')}")

    print("\n--- 2. Testing /audit/sample-bills ---")
    sample_bills = client_get("/audit/sample-bills")
    assert len(sample_bills) >= 3
    print(f"Loaded {len(sample_bills)} sample bills:")
    for b in sample_bills:
        print(f"  - [{b['id']}] {b.get('title', b['hospital_name'])} (Rs. {b['total_amount']:,})")

    first_id = sample_bills[0]["id"]
    print(f"\n--- 3. Testing /audit/sample-bills/{first_id} ---")
    bill = client_get(f"/audit/sample-bills/{first_id}")
    assert "hospital_name" in bill
    assert len(bill["items"]) > 0
    print(f"Bill details: {bill['hospital_name']}, {len(bill['items'])} items, Total: Rs. {bill['total_amount']:,}")

    print("\n--- 4. Testing /audit/analyze-bill ---")
    audit_report = client_post("/audit/analyze-bill", bill)
    assert audit_report["findings_count"] > 0
    print(f"Audit Result: {audit_report['findings_count']} findings")
    print(f"  - Total Billed: Rs. {audit_report['total_billed']:,}")
    print(f"  - Arithmetic Errors: Rs. {audit_report['arithmetic_error_total']:,}")
    print(f"  - Suspicious Surcharges: Rs. {audit_report['suspicious_charges_total']:,}")
    print(f"  - Disallowed Items: Rs. {audit_report['disallowed_items_total']:,}")
    print(f"  - Potential Review Total: Rs. {audit_report['potential_savings']:,}")

    print("\n--- 5. Testing /audit/chat ---")
    chat_payload = {
        "message": "Why was ICU nursing flagged on this bill?",
        "bill": bill,
        "findings": audit_report["findings"]
    }
    chat_res = client_post("/audit/chat", chat_payload)
    assert "reply" in chat_res
    print(f"Chat Reply:\n{chat_res['reply'][:200]}...\n")
    print(f"Citations: {chat_res.get('rule_citations')}")

    print("\n--- 6. Testing /audit/dispute-letter ---")
    letter_payload = {
        "report": audit_report,
        "recipient_title": "The Medical Superintendent / Patient Relations Desk"
    }
    letter_res = client_post("/audit/dispute-letter", letter_payload)
    assert "html_content" in letter_res
    assert "markdown_content" in letter_res
    print(f"Dispute letter generated: {len(letter_res['html_content'])} bytes HTML, {len(letter_res['markdown_content'])} bytes Markdown")
    print(f"Letter Summary: {letter_res['summary']}")

    print("\n--- 7. Testing /audit/statutory-rules ---")
    rules = client_get("/audit/statutory-rules")
    assert len(rules) >= 4
    print(f"Total codified statutory rules available: {len(rules)}")

    print("\n>>> ALL 7 WORKFLOW TESTS COMPLETED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    test_api()
