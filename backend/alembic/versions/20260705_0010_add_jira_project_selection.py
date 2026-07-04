"""add jira project selection to project integrations

Revision ID: 20260705_0010
Revises: 20260702_0009
Create Date: 2026-07-05
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260705_0010"
down_revision: str | None = "20260702_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("project_integrations", sa.Column("jira_project_key", sa.String(length=50), nullable=True))
    op.add_column("project_integrations", sa.Column("jira_project_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("project_integrations", "jira_project_name")
    op.drop_column("project_integrations", "jira_project_key")
