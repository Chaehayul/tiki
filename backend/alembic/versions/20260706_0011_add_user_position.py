"""add position to users

Revision ID: 20260706_0011
Revises: 20260705_0010
Create Date: 2026-07-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260706_0011"
down_revision: str | None = "20260705_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("position", sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "position")
