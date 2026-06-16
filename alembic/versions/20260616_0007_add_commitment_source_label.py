"""add commitment source label

Revision ID: 20260616_0007
Revises: 20260615_0006
Create Date: 2026-06-16

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260616_0007"
down_revision: str | Sequence[str] | None = "20260615_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("commitments", sa.Column("source_label", sa.String(length=240), nullable=True))


def downgrade() -> None:
    op.drop_column("commitments", "source_label")
