import pytest
from backend.app.schemas.bill import NormalizedBill, BillItem


@pytest.mark.asyncio
async def test_rules_endpoint(client):
    response = await client.get("/api/v1/rules")
    assert response.status_code == 200
    rules = response.json()
    assert len(rules) >= 4
    rule_ids = [r["rule_id"] for r in rules]
    assert "RULE-IND-ICU-001" in rule_ids
    assert "RULE-IND-PPE-004" in rule_ids


@pytest.mark.asyncio
async def test_demo_audit_execution(client):
    response = await client.post("/api/v1/audit/demo")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "COMPLETED"
    assert data["total_billed"] > 0
    assert data["potential_savings"] > 0
    assert len(data["findings"]) > 0
    first_finding = data["findings"][0]
    assert "patient_explanation" in first_finding
    assert "evidence_citation" in first_finding
    assert "recommended_action" in first_finding
    assert "calculation_basis" in first_finding


@pytest.mark.asyncio
async def test_sample_bills_endpoint(client):
    response = await client.get("/api/v1/audit/sample-bills")
    assert response.status_code == 200
    catalog = response.json()
    assert len(catalog) == 3
    ids = [b["id"] for b in catalog]
    assert "apollo-icu-unbundling" in ids
    assert "max-duplicate-arithmetic" in ids
    assert "fortis-surgical-gst" in ids

    # Test fetching a specific bill
    res_bill = await client.get("/api/v1/audit/sample-bills/max-duplicate-arithmetic")
    assert res_bill.status_code == 200
    bill = res_bill.json()
    assert bill["hospital_name"] == "Max Super Speciality Hospital, New Delhi"
    assert len(bill["items"]) == 10


@pytest.mark.asyncio
async def test_analyze_normalized_bill_endpoint(client):
    # Fetch Max bill with duplicate and arithmetic error
    res_bill = await client.get("/api/v1/audit/sample-bills/max-duplicate-arithmetic")
    bill_data = res_bill.json()

    # Run audit on this bill
    response = await client.post("/api/v1/audit/analyze-bill", json=bill_data)
    assert response.status_code == 200
    report = response.json()
    assert report["status"] == "COMPLETED"
    assert report["findings_count"] > 0

    # Verify duplicate was caught
    v_types = [f["violation_type"] for f in report["findings"]]
    assert "DUPLICATE_ENTRY" in v_types
    assert "CALCULATION_ERROR" in v_types


@pytest.mark.asyncio
async def test_chat_endpoint(client):
    chat_payload = {
        "message": "Why is the biomedical waste disposal charge flagged?",
        "findings": [
            {
                "finding_id": "fnd-1",
                "rule_id": "RULE-IND-UNBUNDLE-003",
                "item_name": "Biomedical Waste Disposal Surcharge",
                "billed_amount": 3400.0,
                "permissible_amount": 0.0,
                "excess_amount": 3400.0,
                "violation_type": "ARBITRARY_SURCHARGE",
                "severity": "HIGH",
                "evidence_citation": "Govt Notification on Healthcare Waste Management",
                "patient_explanation": "Biomedical waste must be part of overhead.",
            }
        ],
        "history": [],
    }
    response = await client.post("/api/v1/audit/chat", json=chat_payload)
    assert response.status_code == 200
    data = response.json()
    assert "Biomedical Waste" in data["reply"]
    assert len(data["suggested_actions"]) > 0


@pytest.mark.asyncio
async def test_dispute_letter_endpoint(client):
    # Get a demo report first
    res_report = await client.post("/api/v1/audit/demo")
    report_data = res_report.json()

    letter_payload = {
        "report": report_data,
        "recipient_title": "The Medical Superintendent",
        "notes": "Please issue refund.",
    }
    response = await client.post("/api/v1/audit/dispute-letter", json=letter_payload)
    assert response.status_code == 200
    data = response.json()
    assert "html_content" in data
    assert "markdown_content" in data
    assert "Formal Notice" in data["html_content"]
    assert data["summary"]["disputed_amount"] > 0
