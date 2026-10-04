import re
from typing import Optional
from pydantic import BaseModel


class ParsedCurrency(BaseModel):
    """
    Structured outcome of currency parsing preserving explicit semantics:
    signs, parenthesized credits, discounts, and ambiguity indicators.
    """
    amount: Optional[float] = None
    is_negative: bool = False
    is_parenthesized: bool = False
    is_discount_or_credit: bool = False
    is_ambiguous: bool = False
    raw_text: str = ""
    error_message: Optional[str] = None


# Patterns for currency symbols and words
CURRENCY_PREFIXES = re.compile(r"^(?:₹|rs\.?|inr\.?)\s*", re.IGNORECASE)
DISCOUNT_KEYWORDS = re.compile(r"(?:discount|rebate|concession|credit|cr)\b", re.IGNORECASE)


def parse_indian_currency(text: Optional[str]) -> ParsedCurrency:
    """
    Parse an Indian currency string with strict accounting semantics.

    Semantics:
    1. Leading minus (e.g. '-500.00', '- 1,200.00') -> negative amount.
    2. Trailing minus (e.g. '500.00-') -> negative amount.
    3. Parenthesized value (e.g. '(500.00)', '(₹ 1,500.00)') -> negative credit.
    4. Trailing CR (e.g. '500.00 CR') -> credit (negative adjustment).
    5. Indian lakhs/crores comma formatting (e.g. '1,50,000.00', '10,000') -> correctly normalized.
    6. Ambiguous / multi-dot strings (e.g. '12.34.56', '12/10/2024') -> flagged ambiguous, amount=None.
    """
    if text is None:
        return ParsedCurrency(raw_text="", is_ambiguous=True, error_message="Input text is None")

    raw = text.strip()
    if not raw:
        return ParsedCurrency(raw_text="", is_ambiguous=True, error_message="Empty currency string")

    is_negative = False
    is_parenthesized = False
    is_discount_or_credit = bool(DISCOUNT_KEYWORDS.search(raw))

    cleaned = raw

    # Check for parenthesized accounting credit: (xxx.xx)
    if cleaned.startswith("(") and cleaned.endswith(")"):
        is_parenthesized = True
        is_negative = True
        cleaned = cleaned[1:-1].strip()

    # Strip trailing Indian '/-' or '/' suffix before checking trailing minus
    if cleaned.endswith("/-") or cleaned.endswith("/="):
        cleaned = cleaned[:-2].strip()
    elif cleaned.endswith("/"):
        cleaned = cleaned[:-1].strip()

    # Check for leading plus: e.g. "+500.00"
    if cleaned.startswith("+"):
        cleaned = cleaned[1:].strip()

    # Check for leading minus
    if cleaned.startswith("-"):
        is_negative = True
        cleaned = cleaned[1:].strip()

    # Check for trailing minus (accounting negative: e.g. "500.00-")
    if cleaned.endswith("-"):
        is_negative = True
        cleaned = cleaned[:-1].strip()

    # Check for trailing CR / Credit
    cr_match = re.search(r"\s*(?:cr|credit)\s*$", cleaned, re.IGNORECASE)
    if cr_match:
        is_discount_or_credit = True
        is_negative = True
        cleaned = cleaned[: cr_match.start()].strip()

    # Strip currency symbols and prefixes
    cleaned = CURRENCY_PREFIXES.sub("", cleaned).strip()

    # Check for leading minus after prefix: e.g. "₹ -500.00"
    if cleaned.startswith("-"):
        is_negative = True
        cleaned = cleaned[1:].strip()

    # If discount keyword was in prefix, e.g. "Discount: 500"
    cleaned = re.sub(r"^(?:discount|less|rebate)\s*[:\-]?\s*", "", cleaned, flags=re.IGNORECASE).strip()

    # Verify if remainder looks like a valid number with optional commas and decimal
    # Reject strings with multiple decimals (e.g. 12.34.56) or dates (e.g. 12/10/2024)
    if cleaned.count(".") > 1 or "/" in cleaned or "-" in cleaned:
        return ParsedCurrency(
            raw_text=raw,
            is_ambiguous=True,
            error_message=f"Ambiguous format with multiple separators: '{raw}'",
        )

    # Remove Indian grouping commas
    num_str = cleaned.replace(",", "")

    # Must match digits with optional single dot and digits
    if not re.match(r"^\d+(?:\.\d+)?$", num_str):
        return ParsedCurrency(
            raw_text=raw,
            is_ambiguous=True,
            error_message=f"Non-numeric currency content: '{raw}'",
        )

    try:
        val = float(num_str)
        if is_negative and val > 0:
            val = -val

        return ParsedCurrency(
            amount=val,
            is_negative=is_negative or (val < 0),
            is_parenthesized=is_parenthesized,
            is_discount_or_credit=is_discount_or_credit,
            is_ambiguous=False,
            raw_text=raw,
        )
    except ValueError as e:
        return ParsedCurrency(
            raw_text=raw,
            is_ambiguous=True,
            error_message=str(e),
        )
