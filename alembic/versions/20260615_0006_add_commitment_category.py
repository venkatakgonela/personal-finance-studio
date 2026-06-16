"""add commitment category

Revision ID: 20260615_0006
Revises: 20260615_0005
Create Date: 2026-06-15

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260615_0006"
down_revision: str | Sequence[str] | None = "20260615_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "commitments",
        sa.Column("category", sa.String(length=120), nullable=False, server_default="Bills"),
    )


def downgrade() -> None:
    op.drop_column("commitments", "category")
