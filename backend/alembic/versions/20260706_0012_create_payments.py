"""create payments table

Revision ID: 20260706_0012
Revises: 20260706_0011
Create Date: 2026-07-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260706_0012"
down_revision: str | None = "20260706_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("plan_id", sa.String(length=20), nullable=False),
        sa.Column("billing", sa.String(length=10), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="KRW"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="approved"),
        sa.Column("toss_order_id", sa.String(length=100), nullable=False, unique=True, index=True),
        sa.Column("toss_payment_key", sa.String(length=200), nullable=False),
        sa.Column("method", sa.String(length=30), nullable=True),
        sa.Column("receipt_url", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("payments")
