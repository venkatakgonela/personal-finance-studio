"""daily freeagent sync interval

Revision ID: 20260616_0009
Revises: 20260616_0008
Create Date: 2026-06-16

"""
from collections.abc import Sequence

from alembic import op

revision: str = "20260616_0009"
down_revision: str | Sequence[str] | None = "20260616_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "UPDATE integration_accounts "
        "SET sync_interval_minutes = 1440 "
        "WHERE sync_interval_minutes < 1440"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE integration_accounts "
        "SET sync_interval_minutes = 180 "
        "WHERE sync_interval_minutes = 1440"
    )
