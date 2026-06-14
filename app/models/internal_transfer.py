from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import new_id, utc_now


class InternalTransferMatch(Base):
    __tablename__ = "internal_transfer_matches"
    __table_args__ = (
        UniqueConstraint(
            "entity_id",
            "from_transaction_id",
            "to_transaction_id",
            name="uq_internal_transfer_pair",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    entity_id: Mapped[str] = mapped_column(ForeignKey("entities.id"), nullable=False)
    from_transaction_id: Mapped[str] = mapped_column(
        ForeignKey("transactions.id"),
        nullable=False,
    )
    to_transaction_id: Mapped[str] = mapped_column(
        ForeignKey("transactions.id"),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    date_gap_days: Mapped[int] = mapped_column(Integer(), nullable=False)
    confidence: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="candidate")
    reason: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    from_transaction = relationship("Transaction", foreign_keys=[from_transaction_id])
    to_transaction = relationship("Transaction", foreign_keys=[to_transaction_id])
