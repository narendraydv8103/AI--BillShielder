from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ViolationType(str, Enum):
    CALCULATION_ERROR = "CALCULATION_ERROR"
    DUPLICATE_ENTRY = "DUPLICATE_ENTRY"
    RATE_CAP_EXCEEDED = "RATE_CAP_EXCEEDED"
    UNBUNDLING_PROHIBITED = "UNBUNDLING_PROHIBITED"
    ARBITRARY_SURCHARGE = "ARBITRARY_SURCHARGE"
    INSURANCE_NON_PAYABLE = "INSURANCE_NON_PAYABLE"
    GST_MISCALCULATION = "GST_MISCALCULATION"
    UNVERIFIED_PRICE_VARIANCE = "UNVERIFIED_PRICE_VARIANCE"


class RuleSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class RuleDiscrepancy(BaseModel):
    rule_id: str
    rule_title: str
    item_name: str
    billed_amount: float
    permissible_amount: float
    excess_amount: float
    violation_type: ViolationType
    severity: RuleSeverity
    statutory_citation: str
    calculation_details: Dict[str, Any] = Field(default_factory=dict)


class RuleEvaluationResult(BaseModel):
    total_billed: float
    total_permissible: float
    potential_savings: float
    discrepancies: List[RuleDiscrepancy] = Field(default_factory=list)
