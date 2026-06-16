"""add manual commitment controls

Revision ID: 20260615_0005
Revises: 20260615_0004
Create Date: 2026-06-15

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260615_0005"
down_revision: str | Sequence[str] | None = "20260615_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("commitments", sa.Column("end_date", sa.Date(), nullable=True))
    op.add_column("commitments", sa.Column("occurrence_count", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("commitments", "occurrence_count")
    op.drop_column("commitments", "end_date")
