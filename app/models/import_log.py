from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import new_id, utc_now


class ImportLog(Base):
    __tablename__ = "import_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    entity_id: Mapped[str] = mapped_column(ForeignKey("entities.id"), nullable=False)
    source: Mapped[str] = mapped_column(String(80), nullable=False)
    source_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    source_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    row_count: Mapped[int] = mapped_column(Integer(), nullable=False)
    valid_row_count: Mapped[int] = mapped_column(Integer(), nullable=False)
    duplicate_fingerprint_count: Mapped[int] = mapped_column(Integer(), nullable=False)
    imported_transaction_count: Mapped[int] = mapped_column(Integer(), nullable=False)
    skipped_duplicate_count: Mapped[int] = mapped_column(Integer(), nullable=False)
    date_start: Mapped[date | None] = mapped_column(Date(), nullable=True)
    date_end: Mapped[date | None] = mapped_column(Date(), nullable=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="complete")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    transactions = relationship("Transaction", back_populates="import_log")
