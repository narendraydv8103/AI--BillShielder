import pytest
from backend.app.schemas.bill import NormalizedBill, BillItem
from backend.app.rules.engine import DeterministicRuleEngine
from backend.app.rules.definitions import ViolationType


def test_deterministic_icu_and_unbundling_checks():
    engine = DeterministicRuleEngine()

    items = [
        BillItem(
            item_id="1",
            item_name="ICU Bed & Nursing Charges",
            quantity=2.0,
            unit_rate=15000.0,  # Cap is 8500 -> excess = 6500 * 2 = 13000
            total_charge=30000.0,
        ),
        BillItem(
            item_id="2",
            item_name="Biomedical Waste Disposal Surcharge",
            quantity=1.0,
            unit_rate=3000.0,   # Prohibited unbundling -> excess = 3000
            total_charge=3000.0,
        ),
        BillItem(
            item_id="3",
            item_name="Routine Blood Test",
            quantity=1.0,
            unit_rate=500.0,
            total_charge=500.0,
        ),
    ]

    bill = NormalizedBill(
        hospital_name="Test Hospital",
        bill_number="BILL-001",
        items=items,
        subtotal_amount=33500.0,
        total_amount=33500.0,
    )

    result = engine.evaluate_bill(bill)

    assert result.total_billed == 33500.0
    assert result.potential_savings == 16000.0  # 13000 + 3000
    assert result.total_permissible == 17500.0
    assert len(result.discrepancies) == 2

    icu_disc = next(d for d in result.discrepancies if d.rule_id == "RULE-IND-ICU-001")
    assert icu_disc.violation_type == ViolationType.RATE_CAP_EXCEEDED
    assert icu_disc.excess_amount == 13000.0

    waste_disc = next(d for d in result.discrepancies if d.rule_id == "RULE-IND-UNBUNDLE-003")
    assert waste_disc.violation_type == ViolationType.ARBITRARY_SURCHARGE
    assert waste_disc.excess_amount == 3000.0
