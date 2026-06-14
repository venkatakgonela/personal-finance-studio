"""initial finance schema

Revision ID: 20260614_0001
Revises:
Create Date: 2026-06-14

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260614_0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "entities",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("type", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("name", "type", name="uq_entities_name_type"),
    )
    op.create_table(
        "profiles",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("entity_id", sa.String(length=36), sa.ForeignKey("entities.id"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("role", sa.String(length=80), nullable=False, server_default="owner"),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("entity_id", "name", name="uq_profiles_entity_name"),
    )
    op.create_table(
        "accounts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("entity_id", sa.String(length=36), sa.ForeignKey("entities.id"), nullable=False),
        sa.Column("profile_id", sa.String(length=36), sa.ForeignKey("profiles.id"), nullable=True),
        sa.Column("provider", sa.String(length=120), nullable=False),
        sa.Column("display_name", sa.String(length=180), nullable=False),
        sa.Column("source_account_name", sa.String(length=180), nullable=False),
        sa.Column("account_type", sa.String(length=40), nullable=False, server_default="unknown"),
        sa.Column("current_balance", sa.Numeric(14, 2), nullable=True),
        sa.Column("balance_as_of", sa.Date(), nullable=True),
        sa.Column(
            "include_in_cash_on_hand",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("include_in_forecast", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "entity_id",
            "provider",
            "source_account_name",
            name="uq_accounts_entity_provider_source_name",
        ),
    )
    op.create_table(
        "import_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("entity_id", sa.String(length=36), sa.ForeignKey("entities.id"), nullable=False),
        sa.Column("source", sa.String(length=80), nullable=False),
        sa.Column("source_filename", sa.String(length=255), nullable=False),
        sa.Column("source_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("valid_row_count", sa.Integer(), nullable=False),
        sa.Column("duplicate_fingerprint_count", sa.Integer(), nullable=False),
        sa.Column("imported_transaction_count", sa.Integer(), nullable=False),
        sa.Column("skipped_duplicate_count", sa.Integer(), nullable=False),
        sa.Column("date_start", sa.Date(), nullable=True),
        sa.Column("date_end", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="complete"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "transactions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("entity_id", sa.String(length=36), sa.ForeignKey("entities.id"), nullable=False),
        sa.Column("account_id", sa.String(length=36), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column(
            "import_id",
            sa.String(length=36),
            sa.ForeignKey("import_logs.id"),
            nullable=True,
        ),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("merchant_name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("description", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("direction", sa.String(length=20), nullable=False),
        sa.Column("source_category", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="posted"),
        sa.Column("reviewed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "transaction_type",
            sa.String(length=40),
            nullable=False,
            server_default="needs_review",
        ),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column("notes", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("sub_type", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("entity_id", "fingerprint", name="uq_transactions_entity_fingerprint"),
    )
    op.create_index(
        "ix_transactions_entity_date",
        "transactions",
        ["entity_id", "transaction_date"],
    )
    op.create_table(
        "internal_transfer_matches",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("entity_id", sa.String(length=36), sa.ForeignKey("entities.id"), nullable=False),
        sa.Column(
            "from_transaction_id",
            sa.String(length=36),
            sa.ForeignKey("transactions.id"),
            nullable=False,
        ),
        sa.Column(
            "to_transaction_id",
            sa.String(length=36),
            sa.ForeignKey("transactions.id"),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("date_gap_days", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Numeric(5, 2), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="candidate"),
        sa.Column("reason", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "entity_id",
            "from_transaction_id",
            "to_transaction_id",
            name="uq_internal_transfer_pair",
        ),
    )


def downgrade() -> None:
    op.drop_table("internal_transfer_matches")
    op.drop_index("ix_transactions_entity_date", table_name="transactions")
    op.drop_table("transactions")
    op.drop_table("import_logs")
    op.drop_table("accounts")
    op.drop_table("profiles")
    op.drop_table("entities")
