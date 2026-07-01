"""add meeting action items

Revision ID: 20260701_0004
Revises: 20260629_0009
Create Date: 2026-07-01
"""

from collections.abc import Sequence
from alembic import op

revision: str = "20260701_0004"
down_revision: str | None = "20260629_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS action_items JSONB NOT NULL DEFAULT '[]'")


def downgrade() -> None:
    op.execute("ALTER TABLE meetings DROP COLUMN IF EXISTS action_items")
