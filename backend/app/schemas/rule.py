from typing import List, Optional
from pydantic import BaseModel


class GovernmentRule(BaseModel):
    rule_id: str
    authority: str  # e.g., "CGHS", "PMJAY", "Delhi_Govt", "Maharashtra_Govt", "NPPA"
    order_number: str
    title: str
    category: str
    description: str
    statutory_cap_rate: Optional[float] = None
    is_unbundling_prohibited: bool = False
    effective_date: str
    gazette_citation: str
    source_url: Optional[str] = None
