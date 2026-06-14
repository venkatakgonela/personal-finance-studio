from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import new_id, utc_now


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint("entity_id", "fingerprint", name="uq_transactions_entity_fingerprint"),
        Index("ix_transactions_entity_date", "entity_id", "transaction_date"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    entity_id: Mapped[str] = mapped_column(ForeignKey("entities.id"), nullable=False)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    import_id: Mapped[str | None] = mapped_column(ForeignKey("import_logs.id"), nullable=True)
    transaction_date: Mapped[date] = mapped_column(Date(), nullable=False)
    merchant_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    description: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    direction: Mapped[str] = mapped_column(String(20), nullable=False)
    source_category: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="posted")
    reviewed: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    transaction_type: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default="needs_review",
    )
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    notes: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    sub_type: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    account = relationship("Account", back_populates="transactions")
    import_log = relationship("ImportLog", back_populates="transactions")
