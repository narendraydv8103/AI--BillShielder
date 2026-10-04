import json
import urllib.request
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_api():
    print("--- 1. Testing /health ---")
    with urllib.request.urlopen(f"{BASE_URL}/health") as resp:
        health = json.loads(resp.read().decode())
        print(f"Health: status={health.get('status')}, demo_mode={health.get('demo_mode')}")

    print("\n--- 2. Testing /audit/sample-bills ---")
    with urllib.request.urlopen(f"{BASE_URL}/audit/sample-bills") as resp:
        sample_bills = json.loads(resp.read().decode())
        print(f"Loaded {len(sample_bills)} sample bills:")
        for b in sample_bills:
            print(f"  - [{b['id']}] {b['title']} (Rs. {b['total_amount']:,})")

    print("\n--- 3. Testing /audit/sample-bills/SAMPLE-APOLLO-001 ---")
    with urllib.request.urlopen(f"{BASE_URL}/audit/sample-bills/SAMPLE-APOLLO-001") as resp:
        bill = json.loads(resp.read().decode())
        print(f"Bill details: {bill['hospital_name']}, {len(bill['items'])} items, Total: Rs. {bill['total_amount']:,}")

    print("\n--- 4. Testing /audit/analyze-bill ---")
    req = urllib.request.Request(
        f"{BASE_URL}/audit/analyze-bill",
        data=json.dumps(bill).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        audit_report = json.loads(resp.read().decode())
        print(f"Audit Result: {audit_report['findings_count']} findings")
        print(f"  - Total Billed: Rs. {audit_report['total_billed']:,}")
        print(f"  - Arithmetic Errors: Rs. {audit_report['arithmetic_error_total']:,}")
        print(f"  - Suspicious Surcharges: Rs. {audit_report['suspicious_charges_total']:,}")
        print(f"  - Disallowed Items: Rs. {audit_report['disallowed_items_total']:,}")
        print(f"  - Potential Review Total: Rs. {audit_report['potential_savings']:,}")

    print("\n--- 5. Testing /audit/chat ---")
    chat_payload = {
        "message": "Why was ICU nursing flagged as an unbundled charge on this bill?",
        "bill": bill,
        "findings": audit_report["findings"]
    }
    req = urllib.request.Request(
        f"{BASE_URL}/audit/chat",
        data=json.dumps(chat_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        chat_res = json.loads(resp.read().decode())
        print(f"Chat Reply:\n{chat_res['reply'][:250]}...\n")
        print(f"Citations: {chat_res.get('rule_citations')}")

    print("\n--- 6. Testing /audit/dispute-letter ---")
    letter_payload = {
        "report": audit_report,
        "recipient_title": "The Medical Superintendent / Patient Relations Desk"
    }
    req = urllib.request.Request(
        f"{BASE_URL}/audit/dispute-letter",
        data=json.dumps(letter_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        letter_res = json.loads(resp.read().decode())
        print(f"Dispute letter generated: {len(letter_res['html_content'])} bytes HTML, {len(letter_res['markdown_content'])} bytes Markdown")
        print(f"Letter Summary: {letter_res['summary']}")

    print("\n--- 7. Testing /audit/statutory-rules ---")
    with urllib.request.urlopen(f"{BASE_URL}/audit/statutory-rules") as resp:
        rules = json.loads(resp.read().decode())
        print(f"Total codified statutory rules available: {len(rules)}")

    print("\n>>> ALL 7 WORKFLOW TESTS COMPLETED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    test_api()
