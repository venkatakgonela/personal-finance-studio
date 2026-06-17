"""add freeagent account sync state

Revision ID: 20260616_0008
Revises: 20260616_0007
Create Date: 2026-06-16

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260616_0008"
down_revision: str | Sequence[str] | None = "20260616_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "integration_accounts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("connection_id", sa.String(length=36), nullable=False),
        sa.Column("provider", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("external_account_url", sa.String(length=255), nullable=False),
        sa.Column("external_account_name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("local_account_id", sa.String(length=36), nullable=False, server_default=""),
        sa.Column("is_managed", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("auto_sync_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sync_interval_minutes", sa.Integer(), nullable=False, server_default="1440"),
        sa.Column("sync_cursor_updated_since", sa.String(length=40), nullable=False, server_default=""),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_balance_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_status", sa.String(length=40), nullable=False, server_default="never_synced"),
        sa.Column("last_sync_message", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("last_imported_transaction_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_skipped_duplicate_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["connection_id"], ["integration_connections.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "connection_id",
            "external_account_url",
            name="uq_integration_accounts_connection_external_url",
        ),
    )


def downgrade() -> None:
    op.drop_table("integration_accounts")
