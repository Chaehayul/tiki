from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import TicketPriority, TicketStatus, enum_values

if TYPE_CHECKING:
    from app.models.analysis import AnalysisResult
    from app.models.integration import ExternalSync


class Ticket(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tickets"

    analysis_result_id: Mapped[UUID] = mapped_column(
        ForeignKey("analysis_results.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, name="ticket_status", values_callable=enum_values),
        default=TicketStatus.DRAFT,
        nullable=False,
    )
    priority: Mapped[TicketPriority] = mapped_column(
        Enum(TicketPriority, name="ticket_priority", values_callable=enum_values),
        default=TicketPriority.MEDIUM,
        nullable=False,
    )
    assignee: Mapped[str | None] = mapped_column(String(100))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    analysis_result: Mapped["AnalysisResult"] = relationship(back_populates="tickets")
    external_syncs: Mapped[list["ExternalSync"]] = relationship(
        back_populates="ticket",
        cascade="all, delete-orphan",
    )
