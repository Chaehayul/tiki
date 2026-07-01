"""restore missing 20260629 revision marker

Revision ID: 20260629_0009
Revises: 20260626_0006
Create Date: 2026-06-29

This revision already exists in the shared database history but the local
migration file was missing from the workspace. Keep it as a no-op bridge so
future migrations can advance without rewriting the remote alembic version.
"""

from collections.abc import Sequence

revision: str = "20260629_0009"
down_revision: str | None = "20260626_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
