"""reclassify unresponded project invites

Revision ID: 20260701_0006
Revises: 20260701_0005
Create Date: 2026-07-01
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260701_0006"
down_revision: str | None = "20260701_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE project_members
        SET invite_status = 'pending'
        WHERE invite_status = 'accepted'
          AND responded_at IS NULL
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE project_members
        SET invite_status = 'accepted'
        WHERE invite_status = 'pending'
          AND responded_at IS NULL
        """
    )
