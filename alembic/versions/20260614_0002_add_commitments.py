"""add commitments

Revision ID: 20260614_0002
Revises: 20260614_0001
Create Date: 2026-06-14

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260614_0002"
down_revision: str | Sequence[str] | None = "20260614_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "commitments",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("entity_id", sa.String(length=36), sa.ForeignKey("entities.id"), nullable=False),
        sa.Column(
            "owner_profile_id",
            sa.String(length=36),
            sa.ForeignKey("profiles.id"),
            nullable=True,
        ),
        sa.Column("shared_scope", sa.String(length=40), nullable=False, server_default="household"),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("commitment_type", sa.String(length=40), nullable=False, server_default="bill"),
        sa.Column("frequency", sa.String(length=40), nullable=False, server_default="custom"),
        sa.Column("expected_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column(
            "estimate_method",
            sa.String(length=80),
            nullable=False,
            server_default="recent_average",
        ),
        sa.Column("next_due_date", sa.Date(), nullable=True),
        sa.Column("source", sa.String(length=80), nullable=False, server_default="detected"),
        sa.Column("source_key", sa.String(length=160), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="candidate"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("entity_id", "source", "source_key", name="uq_commitments_source_key"),
    )
    op.create_table(
        "bill_instances",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "commitment_id",
            sa.String(length=36),
            sa.ForeignKey("commitments.id"),
            nullable=False,
        ),
        sa.Column("entity_id", sa.String(length=36), sa.ForeignKey("entities.id"), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("expected_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("estimated_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("actual_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("paid_date", sa.Date(), nullable=True),
        sa.Column(
            "paid_account_id",
            sa.String(length=36),
            sa.ForeignKey("accounts.id"),
            nullable=True,
        ),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="planned"),
        sa.Column(
            "matched_transaction_id",
            sa.String(length=36),
            sa.ForeignKey("transactions.id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "commitment_id",
            "due_date",
            "matched_transaction_id",
            name="uq_bill_instances_commitment_due_match",
        ),
    )


def downgrade() -> None:
    op.drop_table("bill_instances")
    op.drop_table("commitments")
