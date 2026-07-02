"""project oauth integrations

Revision ID: 20260702_0009
Revises: 20260702_0008
Create Date: 2026-07-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260702_0009"
down_revision: str | None = "20260702_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    integration_provider = postgresql.ENUM("jira", "notion", name="integration_provider", create_type=False)
    sync_status = postgresql.ENUM("pending", "synced", "failed", name="sync_status", create_type=False)

    op.create_table(
        "oauth_states",
        sa.Column("state", sa.String(length=160), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", integration_provider, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("state"),
    )
    op.create_index(op.f("ix_oauth_states_project_id"), "oauth_states", ["project_id"], unique=False)
    op.create_index(op.f("ix_oauth_states_state"), "oauth_states", ["state"], unique=True)
    op.create_index(op.f("ix_oauth_states_user_id"), "oauth_states", ["user_id"], unique=False)

    op.create_table(
        "project_integrations",
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", integration_provider, nullable=False),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scope", sa.Text(), nullable=True),
        sa.Column("external_workspace_id", sa.String(length=255), nullable=True),
        sa.Column("external_site_url", sa.String(length=500), nullable=True),
        sa.Column("external_site_name", sa.String(length=255), nullable=True),
        sa.Column("cloud_id", sa.String(length=255), nullable=True),
        sa.Column("notion_workspace_id", sa.String(length=255), nullable=True),
        sa.Column("notion_bot_id", sa.String(length=255), nullable=True),
        sa.Column("connected_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="connected"),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["connected_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "provider", name="uq_project_integrations_project_provider"),
    )
    op.create_index(op.f("ix_project_integrations_project_id"), "project_integrations", ["project_id"], unique=False)

    op.create_table(
        "meeting_external_links",
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", integration_provider, nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("external_url", sa.String(length=1000), nullable=True),
        sa.Column("external_type", sa.String(length=80), nullable=False),
        sa.Column("sync_status", sync_status, nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("meeting_id", "provider", name="uq_meeting_external_links_meeting_provider"),
    )
    op.create_index(op.f("ix_meeting_external_links_meeting_id"), "meeting_external_links", ["meeting_id"], unique=False)
    op.create_index(op.f("ix_meeting_external_links_project_id"), "meeting_external_links", ["project_id"], unique=False)

    op.create_table(
        "task_external_links",
        sa.Column("task_id", sa.String(length=120), nullable=False),
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", integration_provider, nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("external_key", sa.String(length=255), nullable=True),
        sa.Column("external_url", sa.String(length=1000), nullable=True),
        sa.Column("external_type", sa.String(length=80), nullable=False),
        sa.Column("sync_status", sync_status, nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("task_id", "project_id", "provider", name="uq_task_external_links_task_provider"),
    )
    op.create_index(op.f("ix_task_external_links_meeting_id"), "task_external_links", ["meeting_id"], unique=False)
    op.create_index(op.f("ix_task_external_links_project_id"), "task_external_links", ["project_id"], unique=False)
    op.create_index(op.f("ix_task_external_links_task_id"), "task_external_links", ["task_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_task_external_links_task_id"), table_name="task_external_links")
    op.drop_index(op.f("ix_task_external_links_project_id"), table_name="task_external_links")
    op.drop_index(op.f("ix_task_external_links_meeting_id"), table_name="task_external_links")
    op.drop_table("task_external_links")
    op.drop_index(op.f("ix_meeting_external_links_project_id"), table_name="meeting_external_links")
    op.drop_index(op.f("ix_meeting_external_links_meeting_id"), table_name="meeting_external_links")
    op.drop_table("meeting_external_links")
    op.drop_index(op.f("ix_project_integrations_project_id"), table_name="project_integrations")
    op.drop_table("project_integrations")
    op.drop_index(op.f("ix_oauth_states_user_id"), table_name="oauth_states")
    op.drop_index(op.f("ix_oauth_states_state"), table_name="oauth_states")
    op.drop_index(op.f("ix_oauth_states_project_id"), table_name="oauth_states")
    op.drop_table("oauth_states")
