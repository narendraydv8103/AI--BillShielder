from typing import Optional
from sqlalchemy import Boolean, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class GovernmentRuleModel(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Represents a verified Indian statutory healthcare billing rule."""
    __tablename__ = "government_rules"

    authority: Mapped[str] = mapped_column(String(100), nullable=False)  # CGHS, PMJAY, State
    order_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    statutory_cap_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_unbundling_prohibited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    effective_date: Mapped[str] = mapped_column(String(50), nullable=False)
    gazette_citation: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
