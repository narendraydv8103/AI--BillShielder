from typing import Any, Dict, List
from backend.app.schemas.bill import NormalizedBill, BillItem


def get_sample_bills_catalog() -> List[Dict[str, Any]]:
    """Return catalog metadata for quick-select demo bills."""
    return [
        {
            "id": "apollo-icu-unbundling",
            "title": "Apollo Hospital — ICU & Overhead Unbundling",
            "hospital_name": "Apollo Specialty Healthcare India Ltd.",
            "patient_name": "Ramesh Kumar Sharma",
            "bill_number": "DEL-2024-89211",
            "admission_date": "2024-10-08",
            "discharge_date": "2024-10-12",
            "total_amount": 101540.0,
            "discrepancy_types": ["Statutory ICU Tariff Cap", "Room Rent Cap", "Biomedical Waste Surcharge", "PPE Consumables Cap"],
            "description": "Critical care bill illustrating ICU overcharging above statutory caps and unbundling of bio-waste & administrative overheads.",
        },
        {
            "id": "max-duplicate-arithmetic",
            "title": "Max Healthcare — Duplicate Billing & Math Errors",
            "hospital_name": "Max Super Speciality Hospital, New Delhi",
            "patient_name": "Sunita Agarwal",
            "bill_number": "MAX-2024-55102",
            "admission_date": "2024-10-14",
            "discharge_date": "2024-10-17",
            "total_amount": 48200.0,
            "discrepancy_types": ["Verified Arithmetic Discrepancy", "Duplicate Consultation", "Duplicate CBC Lab Test", "IRDAI Non-Payables"],
            "description": "Multi-category bill with verified mathematical calculation error, duplicate service entries, and IRDAI non-payable admission kit.",
        },
        {
            "id": "fortis-surgical-gst",
            "title": "Fortis Memorial — Surgical Package & GST Overcharge",
            "hospital_name": "Fortis Memorial Research Institute, Gurgaon",
            "patient_name": "Vikramaditya Malhotra",
            "bill_number": "FOR-2024-91238",
            "admission_date": "2024-09-20",
            "discharge_date": "2024-09-23",
            "total_amount": 133200.0,
            "discrepancy_types": ["Surgical Package Unbundling", "GST Exemption Violation", "Prohibited Administration Fee"],
            "description": "Surgical inpatient bill with unbundled pre/post-op care from surgical package and improper GST levied on exempt healthcare.",
        },
    ]


def get_sample_bill_by_id(bill_id: str) -> NormalizedBill:
    """Instantiate a realistic synthetic NormalizedBill by ID."""
    if bill_id == "max-duplicate-arithmetic":
        items = [
            BillItem(
                item_id="item-1",
                item_name="Doctor In-Patient Consultation (Dr. S. Mehta)",
                category="Professional Fees",
                quantity=1.0,
                unit_rate=3000.0,
                total_charge=3000.0,
                service_date="2024-10-15",
            ),
            # Duplicate consultation on same date
            BillItem(
                item_id="item-2",
                item_name="Doctor In-Patient Consultation (Dr. S. Mehta)",
                category="Professional Fees",
                quantity=1.0,
                unit_rate=3000.0,
                total_charge=3000.0,
                service_date="2024-10-15",
            ),
            BillItem(
                item_id="item-3",
                item_name="Complete Blood Count (CBC) Panel",
                category="Diagnostics",
                quantity=1.0,
                unit_rate=950.0,
                total_charge=950.0,
                service_date="2024-10-15",
            ),
            # Duplicate diagnostic test
            BillItem(
                item_id="item-4",
                item_name="Complete Blood Count (CBC) Panel",
                category="Diagnostics",
                quantity=1.0,
                unit_rate=950.0,
                total_charge=950.0,
                service_date="2024-10-15",
            ),
            # Arithmetic calculation error: 2 x 1500 = 3000, but billed as 4500
            BillItem(
                item_id="item-5",
                item_name="Specialist Nursing Care (Night Shift)",
                category="Accommodation",
                quantity=2.0,
                unit_rate=1500.0,
                total_charge=4500.0,  # Math error! Should be 3000
                service_date="2024-10-16",
            ),
            BillItem(
                item_id="item-6",
                item_name="Syringe Infusion Pump Surcharge",
                category="Overhead Surcharge",
                quantity=3.0,
                unit_rate=1200.0,
                total_charge=3600.0,
            ),
            BillItem(
                item_id="item-7",
                item_name="Admission Kit & Thermometer",
                category="Consumables",
                quantity=1.0,
                unit_rate=1200.0,
                total_charge=1200.0,
            ),
            BillItem(
                item_id="item-8",
                item_name="Inpatient Room Rent (Twin Sharing)",
                category="Accommodation",
                quantity=3.0,
                unit_rate=5000.0,
                total_charge=15000.0,
            ),
            BillItem(
                item_id="item-9",
                item_name="Sterile Surgical Gloves 7.5",
                category="Consumables",
                quantity=10.0,
                unit_rate=250.0,
                total_charge=2500.0,
            ),
            BillItem(
                item_id="item-10",
                item_name="Pharmacy: Ceftriaxone 1g IV",
                category="Pharmacy",
                quantity=5.0,
                unit_rate=480.0,
                total_charge=2400.0,
            ),
        ]
        total = sum(i.total_charge for i in items)
        return NormalizedBill(
            hospital_name="Max Super Speciality Hospital, New Delhi",
            hospital_city="Delhi",
            bill_number="MAX-2024-55102",
            bill_date="2024-10-17",
            admission_date="2024-10-14",
            discharge_date="2024-10-17",
            patient_name="Sunita Agarwal",
            patient_uhid="MX-882910",
            ward_type="Twin Sharing Deluxe",
            items=items,
            subtotal_amount=total,
            discount_amount=0.0,
            tax_amount=0.0,
            total_amount=total,
        )

    elif bill_id == "fortis-surgical-gst":
        items = [
            BillItem(
                item_id="item-1",
                item_name="Laparoscopic Cholecystectomy Surgical Procedure Package",
                category="General Healthcare Service",
                quantity=1.0,
                unit_rate=85000.0,
                total_charge=85000.0,
                service_date="2024-09-21",
            ),
            # Unbundled pre-op surgeon fee (prohibited under package rule)
            BillItem(
                item_id="item-2",
                item_name="Surgeon Pre-Operative Consultation & Planning",
                category="Professional Fees",
                quantity=1.0,
                unit_rate=12000.0,
                total_charge=12000.0,
                service_date="2024-09-20",
            ),
            BillItem(
                item_id="item-3",
                item_name="Post-Operative Wound Care & Dressing Surcharge",
                category="Consumables",
                quantity=1.0,
                unit_rate=4500.0,
                total_charge=4500.0,
                service_date="2024-09-22",
            ),
            BillItem(
                item_id="item-4",
                item_name="Inpatient Room Rent (Single Private Room)",
                category="Accommodation",
                quantity=3.0,
                unit_rate=5500.0,
                total_charge=16500.0,
            ),
            BillItem(
                item_id="item-5",
                item_name="High Risk Consumable PPE Kit",
                category="Consumables",
                quantity=3.0,
                unit_rate=1400.0,
                total_charge=4200.0,
            ),
            BillItem(
                item_id="item-6",
                item_name="Administrative Record Processing Fee",
                category="Overhead Surcharge",
                quantity=1.0,
                unit_rate=3000.0,
                total_charge=3000.0,
            ),
        ]
        subtotal = sum(i.total_charge for i in items)
        tax = 8000.0  # Erroneous GST charged on exempt healthcare
        total = subtotal + tax
        return NormalizedBill(
            hospital_name="Fortis Memorial Research Institute, Gurgaon",
            hospital_city="Gurgaon",
            bill_number="FOR-2024-91238",
            bill_date="2024-09-23",
            admission_date="2024-09-20",
            discharge_date="2024-09-23",
            patient_name="Vikramaditya Malhotra",
            patient_uhid="FM-440192",
            ward_type="Single Private Deluxe",
            items=items,
            subtotal_amount=subtotal,
            discount_amount=0.0,
            tax_amount=tax,
            total_amount=total,
        )

    # Default: Apollo ICU bill
    from backend.app.services.audit_orchestrator import AuditOrchestrationService
    return AuditOrchestrationService().get_demo_normalized_bill()
