"""add account overdraft limit

Revision ID: 20260615_0004
Revises: 20260615_0003
Create Date: 2026-06-15

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260615_0004"
down_revision: str | Sequence[str] | None = "20260615_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("overdraft_limit", sa.Numeric(14, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("accounts", "overdraft_limit")
