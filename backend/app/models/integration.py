from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import IntegrationProvider, SyncStatus, enum_values
from app.models.ticket import Ticket


class ExternalSync(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "external_syncs"

    ticket_id: Mapped[UUID] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    provider: Mapped[IntegrationProvider] = mapped_column(
        Enum(IntegrationProvider, name="integration_provider", values_callable=enum_values),
        nullable=False,
    )
    status: Mapped[SyncStatus] = mapped_column(
        Enum(SyncStatus, name="sync_status", values_callable=enum_values),
        default=SyncStatus.PENDING,
        nullable=False,
    )
    external_id: Mapped[str | None] = mapped_column(String(255))
    external_url: Mapped[str | None] = mapped_column(String(500))
    error_message: Mapped[str | None] = mapped_column(Text)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    ticket: Mapped[Ticket] = relationship(back_populates="external_syncs")


class OAuthState(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "oauth_states"

    state: Mapped[str] = mapped_column(String(160), nullable=False, unique=True, index=True)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[IntegrationProvider] = mapped_column(
        Enum(IntegrationProvider, name="integration_provider", values_callable=enum_values),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ProjectIntegration(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "project_integrations"
    __table_args__ = (
        UniqueConstraint("project_id", "provider", name="uq_project_integrations_project_provider"),
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[IntegrationProvider] = mapped_column(
        Enum(IntegrationProvider, name="integration_provider", values_callable=enum_values),
        nullable=False,
    )
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str | None] = mapped_column(Text)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scope: Mapped[str | None] = mapped_column(Text)
    external_workspace_id: Mapped[str | None] = mapped_column(String(255))
    external_site_url: Mapped[str | None] = mapped_column(String(500))
    external_site_name: Mapped[str | None] = mapped_column(String(255))
    cloud_id: Mapped[str | None] = mapped_column(String(255))
    notion_workspace_id: Mapped[str | None] = mapped_column(String(255))
    notion_bot_id: Mapped[str | None] = mapped_column(String(255))
    connected_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="connected")


class MeetingExternalLink(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "meeting_external_links"
    __table_args__ = (
        UniqueConstraint("meeting_id", "provider", name="uq_meeting_external_links_meeting_provider"),
    )

    meeting_id: Mapped[UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[IntegrationProvider] = mapped_column(
        Enum(IntegrationProvider, name="integration_provider", values_callable=enum_values),
        nullable=False,
    )
    external_id: Mapped[str | None] = mapped_column(String(255))
    external_url: Mapped[str | None] = mapped_column(String(1000))
    external_type: Mapped[str] = mapped_column(String(80), nullable=False)
    sync_status: Mapped[SyncStatus] = mapped_column(
        Enum(SyncStatus, name="sync_status", values_callable=enum_values),
        default=SyncStatus.PENDING,
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(Text)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TaskExternalLink(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "task_external_links"
    __table_args__ = (
        UniqueConstraint("task_id", "project_id", "provider", name="uq_task_external_links_task_provider"),
    )

    task_id: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    meeting_id: Mapped[UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[IntegrationProvider] = mapped_column(
        Enum(IntegrationProvider, name="integration_provider", values_callable=enum_values),
        nullable=False,
    )
    external_id: Mapped[str | None] = mapped_column(String(255))
    external_key: Mapped[str | None] = mapped_column(String(255))
    external_url: Mapped[str | None] = mapped_column(String(1000))
    external_type: Mapped[str] = mapped_column(String(80), nullable=False)
    sync_status: Mapped[SyncStatus] = mapped_column(
        Enum(SyncStatus, name="sync_status", values_callable=enum_values),
        default=SyncStatus.PENDING,
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(Text)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
