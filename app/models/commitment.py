from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import new_id, utc_now


class Commitment(Base):
    __tablename__ = "commitments"
    __table_args__ = (
        UniqueConstraint("entity_id", "source", "source_key", name="uq_commitments_source_key"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    entity_id: Mapped[str] = mapped_column(ForeignKey("entities.id"), nullable=False)
    owner_profile_id: Mapped[str | None] = mapped_column(ForeignKey("profiles.id"), nullable=True)
    shared_scope: Mapped[str] = mapped_column(String(40), nullable=False, default="household")
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    commitment_type: Mapped[str] = mapped_column(String(40), nullable=False, default="bill")
    frequency: Mapped[str] = mapped_column(String(40), nullable=False, default="custom")
    expected_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    estimate_method: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        default="recent_average",
    )
    next_due_date: Mapped[date | None] = mapped_column(Date(), nullable=True)
    source: Mapped[str] = mapped_column(String(80), nullable=False, default="detected")
    source_key: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="candidate")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    bill_instances = relationship("BillInstance", back_populates="commitment")


class BillInstance(Base):
    __tablename__ = "bill_instances"
    __table_args__ = (
        UniqueConstraint(
            "commitment_id",
            "due_date",
            "matched_transaction_id",
            name="uq_bill_instances_commitment_due_match",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    commitment_id: Mapped[str] = mapped_column(ForeignKey("commitments.id"), nullable=False)
    entity_id: Mapped[str] = mapped_column(ForeignKey("entities.id"), nullable=False)
    due_date: Mapped[date] = mapped_column(Date(), nullable=False)
    expected_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    estimated_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    actual_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    paid_date: Mapped[date | None] = mapped_column(Date(), nullable=True)
    paid_account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="planned")
    matched_transaction_id: Mapped[str | None] = mapped_column(
        ForeignKey("transactions.id"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    commitment = relationship("Commitment", back_populates="bill_instances")
