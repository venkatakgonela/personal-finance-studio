"""add freeagent integration connection

Revision ID: 20260615_0003
Revises: 20260614_0002
Create Date: 2026-06-15

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260615_0003"
down_revision: str | Sequence[str] | None = "20260614_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "integration_connections",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("environment", sa.String(length=40), nullable=False, server_default="production"),
        sa.Column("base_url", sa.String(length=255), nullable=False),
        sa.Column("auth_url", sa.String(length=255), nullable=False),
        sa.Column("token_url", sa.String(length=255), nullable=False),
        sa.Column("client_id", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("encrypted_client_secret", sa.Text(), nullable=False, server_default=""),
        sa.Column("encrypted_access_token", sa.Text(), nullable=False, server_default=""),
        sa.Column("encrypted_refresh_token", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="configured"),
        sa.Column("validation_message", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("company_name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("company_url", sa.String(length=255), nullable=False, server_default=""),
        sa.Column(
            "selected_bank_account_url",
            sa.String(length=255),
            nullable=False,
            server_default="",
        ),
        sa.Column(
            "selected_bank_account_name",
            sa.String(length=255),
            nullable=False,
            server_default="",
        ),
        sa.Column(
            "sync_cursor_updated_since",
            sa.String(length=40),
            nullable=False,
            server_default="",
        ),
        sa.Column("last_validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("provider", name="uq_integration_connections_provider"),
    )


def downgrade() -> None:
    op.drop_table("integration_connections")
