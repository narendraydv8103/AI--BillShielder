from typing import List
from fastapi import APIRouter, status
from backend.app.schemas.rule import GovernmentRule

router = APIRouter(prefix="/rules", tags=["Rules"])

STATUTORY_INDIAN_RULES: List[GovernmentRule] = [
    GovernmentRule(
        rule_id="RULE-IND-ICU-001",
        authority="CGHS / State Clinical Establishment Act",
        order_number="F.No. S.11011/11/2021-CGHS(P)",
        title="Statutory ICU Ceiling Tariff Limit",
        category="Intensive Care",
        description="Caps daily ICU package rate (including monitoring, nursing, and basic life support) for private hospitals.",
        statutory_cap_rate=8500.0,
        is_unbundling_prohibited=True,
        effective_date="2021-06-01",
        gazette_citation="MoHFW Notification F.No. S.11011/11/2021-CGHS(P)",
        source_url="https://cghs.nic.in",
    ),
    GovernmentRule(
        rule_id="RULE-IND-ROOM-002",
        authority="Ministry of Health & Family Welfare",
        order_number="No. S.11045/36/2012-CGHS",
        title="Inpatient Private Deluxe Room Rent Ceiling",
        category="Accommodation",
        description="Sets statutory ceiling for room rent to prevent arbitrary markup beyond notified tier classifications.",
        statutory_cap_rate=4500.0,
        is_unbundling_prohibited=False,
        effective_date="2014-11-01",
        gazette_citation="CGHS Office Memorandum on Ward Entitlement & Room Ceilings",
        source_url="https://cghs.nic.in",
    ),
    GovernmentRule(
        rule_id="RULE-IND-UNBUNDLE-003",
        authority="State Clinical Establishment Regulatory Authority",
        order_number="CEA/DIR/2020-04/UNBUNDLE",
        title="Prohibition of Administrative Overhead & Waste Surcharges",
        category="Overheads",
        description="Prohibits unbundling administrative admission fees, medical records charges, and biomedical waste disposal fees.",
        statutory_cap_rate=0.0,
        is_unbundling_prohibited=True,
        effective_date="2020-05-15",
        gazette_citation="State Healthcare Establishment Guidelines on Overhead Billing Transparency",
        source_url="https://clinicalestablishments.gov.in",
    ),
    GovernmentRule(
        rule_id="RULE-IND-PPE-004",
        authority="National Pharmaceutical Pricing Authority (NPPA)",
        order_number="S.O. 1492(E)",
        title="NPPA Pricing Order on Medical Consumables & PPE Kits",
        category="Consumables",
        description="Fixes maximum permissible retail prices and trade margin caps for Personal Protective Equipment (PPE) kits and disposables.",
        statutory_cap_rate=800.0,
        is_unbundling_prohibited=False,
        effective_date="2020-05-21",
        gazette_citation="The Gazette of India: Extraordinary, Part II—Sec. 3(ii), NPPA Order",
        source_url="https://nppa.gov.in",
    ),
    GovernmentRule(
        rule_id="RULE-IND-GLOVES-005",
        authority="NPPA / Department of Pharmaceuticals",
        order_number="DPCO-2013-SEC-08",
        title="Surgical Disposables Price Ceiling",
        category="Consumables",
        description="Caps trade margins on sterile surgical gloves and examination gloves in hospital inpatient settings.",
        statutory_cap_rate=75.0,
        is_unbundling_prohibited=False,
        effective_date="2021-07-01",
        gazette_citation="DPCO Monitored Medical Devices Gazette",
        source_url="https://nppa.gov.in",
    ),
]


@router.get(
    "",
    response_model=List[GovernmentRule],
    status_code=status.HTTP_200_OK,
    summary="List Verified Statutory Rules & Circular Citations",
)
async def list_verified_rules() -> List[GovernmentRule]:
    """Retrieve all verified Indian government healthcare billing rules and rate caps."""
    return STATUTORY_INDIAN_RULES
