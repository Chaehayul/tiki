"""add project invitation status

Revision ID: 20260701_0005
Revises: 20260701_0004
Create Date: 2026-07-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260701_0005"
down_revision: str | None = "20260701_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("project_members", sa.Column("invited_by_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column(
        "project_members",
        sa.Column("invite_status", sa.String(length=20), server_default="pending", nullable=False),
    )
    op.add_column("project_members", sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_project_members_invited_by_id"), "project_members", ["invited_by_id"], unique=False)
    op.create_foreign_key(
        op.f("fk_project_members_invited_by_id_users"),
        "project_members",
        "users",
        ["invited_by_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_project_members_invited_by_id_users"), "project_members", type_="foreignkey")
    op.drop_index(op.f("ix_project_members_invited_by_id"), table_name="project_members")
    op.drop_column("project_members", "responded_at")
    op.drop_column("project_members", "invite_status")
    op.drop_column("project_members", "invited_by_id")
