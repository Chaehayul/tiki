"""alter uploaded_files project_id to uuid fk

Revision ID: 20260619_0004
Revises: 20260619_0003
Create Date: 2026-06-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260619_0004"
down_revision: str | None = "20260619_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 기존 String(100) → UUID nullable, FK to projects
    op.alter_column(
        "uploaded_files",
        "project_id",
        existing_type=sa.String(length=100),
        type_=postgresql.UUID(as_uuid=True),
        nullable=True,
        postgresql_using="project_id::uuid",
    )
    op.create_index(
        op.f("ix_uploaded_files_project_id"),
        "uploaded_files",
        ["project_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_uploaded_files_project_id",
        "uploaded_files",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_uploaded_files_project_id", "uploaded_files", type_="foreignkey")
    op.drop_index(op.f("ix_uploaded_files_project_id"), table_name="uploaded_files")
    op.alter_column(
        "uploaded_files",
        "project_id",
        existing_type=postgresql.UUID(as_uuid=True),
        type_=sa.String(length=100),
        nullable=False,
        postgresql_using="project_id::text",
    )
