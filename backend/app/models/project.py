from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import User


class Project(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="#EEF3FF")
    description: Mapped[str | None] = mapped_column(Text)
    visibility: Mapped[str] = mapped_column(String(20), nullable=False, default="members")
    meeting_template: Mapped[str] = mapped_column(String(50), nullable=False, default="basic")
    jira_domain: Mapped[str | None] = mapped_column(String(255))
    jira_email: Mapped[str | None] = mapped_column(String(255))
    jira_token: Mapped[str | None] = mapped_column(Text)
    notion_database_id: Mapped[str | None] = mapped_column(String(255))
    notion_token: Mapped[str | None] = mapped_column(Text)
    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    owner: Mapped["User"] = relationship("User", foreign_keys=[owner_id])
    members: Mapped[list["ProjectMember"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )
    meetings: Mapped[list["Meeting"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Meeting.date.desc()",
    )


class ProjectMember(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "project_members"

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str | None] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="member")

    project: Mapped["Project"] = relationship(back_populates="members")
    user: Mapped["User | None"] = relationship("User", foreign_keys=[user_id])


class Meeting(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "meetings"

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[str] = mapped_column(String(20), nullable=False)
    round_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="진행 중")
    meeting_type: Mapped[str] = mapped_column(String(20), nullable=False, default="정기")
    tags: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    participants: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    action_items: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    action_items_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    jira_linked_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    project: Mapped["Project"] = relationship(back_populates="meetings")
