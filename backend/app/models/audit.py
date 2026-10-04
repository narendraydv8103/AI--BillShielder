from typing import List, Optional
from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AuditJobModel(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Represents a hospital bill audit session/job."""
    __tablename__ = "audit_jobs"

    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)
    state_jurisdiction: Mapped[str] = mapped_column(String(100), default="Delhi", nullable=False)
    scheme_applied: Mapped[str] = mapped_column(String(100), default="CGHS", nullable=False)

    hospital_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    patient_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bill_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    total_billed_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_permissible_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    potential_savings: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Relationships
    documents: Mapped[List["BillDocumentModel"]] = relationship(
        "BillDocumentModel", back_populates="audit_job", cascade="all, delete-orphan"
    )
    findings: Mapped[List["FindingModel"]] = relationship(
        "FindingModel", back_populates="audit_job", cascade="all, delete-orphan"
    )


class BillDocumentModel(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Represents an uploaded hospital bill document (PDF/Image)."""
    __tablename__ = "bill_documents"

    audit_job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("audit_jobs.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), default="application/pdf", nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ocr_raw_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    audit_job: Mapped["AuditJobModel"] = relationship("AuditJobModel", back_populates="documents")


class FindingModel(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Represents a deterministic rule violation or billing discrepancy found."""
    __tablename__ = "audit_findings"

    audit_job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("audit_jobs.id", ondelete="CASCADE"), nullable=False
    )
    rule_id: Mapped[str] = mapped_column(String(100), nullable=False)
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    billed_amount: Mapped[float] = mapped_column(Float, nullable=False)
    permissible_amount: Mapped[float] = mapped_column(Float, nullable=False)
    excess_amount: Mapped[float] = mapped_column(Float, nullable=False)
    violation_type: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(50), default="HIGH", nullable=False)
    evidence_citation: Mapped[str] = mapped_column(Text, nullable=False)

    patient_explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    auditor_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    audit_job: Mapped["AuditJobModel"] = relationship("AuditJobModel", back_populates="findings")
