from datetime import datetime

from sqlalchemy import DateTime, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import new_id, utc_now


class IntegrationConnection(Base):
    __tablename__ = "integration_connections"
    __table_args__ = (
        UniqueConstraint("provider", name="uq_integration_connections_provider"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    provider: Mapped[str] = mapped_column(String(80), nullable=False)
    environment: Mapped[str] = mapped_column(String(40), nullable=False, default="production")
    base_url: Mapped[str] = mapped_column(String(255), nullable=False)
    auth_url: Mapped[str] = mapped_column(String(255), nullable=False)
    token_url: Mapped[str] = mapped_column(String(255), nullable=False)
    client_id: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    encrypted_client_secret: Mapped[str] = mapped_column(Text(), nullable=False, default="")
    encrypted_access_token: Mapped[str] = mapped_column(Text(), nullable=False, default="")
    encrypted_refresh_token: Mapped[str] = mapped_column(Text(), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="configured")
    validation_message: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    company_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    company_url: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    selected_bank_account_url: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    selected_bank_account_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    sync_cursor_updated_since: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    last_validated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )
