from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import new_id, utc_now


class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = (
        UniqueConstraint(
            "entity_id",
            "provider",
            "source_account_name",
            name="uq_accounts_entity_provider_source_name",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    entity_id: Mapped[str] = mapped_column(ForeignKey("entities.id"), nullable=False)
    profile_id: Mapped[str | None] = mapped_column(ForeignKey("profiles.id"), nullable=True)
    provider: Mapped[str] = mapped_column(String(120), nullable=False)
    display_name: Mapped[str] = mapped_column(String(180), nullable=False)
    source_account_name: Mapped[str] = mapped_column(String(180), nullable=False)
    account_type: Mapped[str] = mapped_column(String(40), nullable=False, default="unknown")
    current_balance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    balance_as_of: Mapped[date | None] = mapped_column(Date(), nullable=True)
    include_in_cash_on_hand: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    include_in_forecast: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    entity = relationship("Entity", back_populates="accounts")
    profile = relationship("Profile", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account")
