from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TicketResponse(BaseModel):
    id: UUID
    analysis_result_id: UUID
    title: str
    description: str
    status: str
    priority: str
    assignee: str | None
    due_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TicketUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    assignee: str | None = None
    due_at: datetime | None = None
