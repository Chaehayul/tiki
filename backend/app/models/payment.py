from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class Payment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "payments"

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plan_id: Mapped[str] = mapped_column(String(20), nullable=False)
    billing: Mapped[str] = mapped_column(String(10), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="KRW")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="approved")
    toss_order_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    toss_payment_key: Mapped[str] = mapped_column(String(200), nullable=False)
    method: Mapped[str | None] = mapped_column(String(30))
    receipt_url: Mapped[str | None] = mapped_column(String(500))
