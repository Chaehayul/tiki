from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ── Meeting ──────────────────────────────────────────────────────────────────

class MeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    date: str = Field(description="날짜 문자열 (예: 2026.06.19)")
    round_number: int = Field(default=1, ge=1)
    status: str = Field(default="진행 중")
    meeting_type: str = Field(default="정기")
    tags: list[str] = Field(default_factory=list)
    participants: list[str] = Field(default_factory=list)
    summary: str | None = None
    action_items: list[dict] = Field(default_factory=list)
    action_items_count: int | None = None


class MeetingUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    date: str | None = None
    status: str | None = None
    meeting_type: str | None = None
    tags: list[str] | None = None
    participants: list[str] | None = None
    summary: str | None = None
    action_items: list[dict] | None = None
    action_items_count: int | None = None
    jira_linked_count: int | None = None


class MeetingResponse(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    date: str
    round_number: int
    status: str
    meeting_type: str
    tags: list[str]
    participants: list[str]
    summary: str | None
    action_items: list[dict]
    action_items_count: int
    jira_linked_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── ProjectMember ─────────────────────────────────────────────────────────────

class MemberInvite(BaseModel):
    email: str = Field(min_length=1, max_length=255)
    name: str | None = Field(default=None, max_length=100)
    role: str = Field(default="member", pattern="^(admin|member)$")


class MemberRoleUpdate(BaseModel):
    role: str = Field(pattern="^(admin|member)$")


class MemberResponse(BaseModel):
    id: UUID
    email: str
    name: str | None
    role: str
    position: str | None = None
    invite_status: str = "pending"
    invited_by_name: str | None = None
    project_id: UUID | None = None
    project_name: str | None = None
    responded_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Project ───────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=50)
    color: str = Field(default="#EEF3FF", max_length=20)
    description: str | None = None
    visibility: str = Field(default="members", pattern="^(private|members|org|project)$")
    meeting_template: str = Field(default="basic", max_length=50)
    jira_domain: str | None = Field(default=None, max_length=255)
    jira_email: str | None = Field(default=None, max_length=255)
    jira_token: str | None = None
    notion_database_id: str | None = Field(default=None, max_length=255)
    notion_token: str | None = None
    members: list[MemberInvite] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    category: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=20)
    description: str | None = None
    visibility: str | None = Field(default=None, pattern="^(private|members|org|project)$")
    meeting_template: str | None = Field(default=None, max_length=50)
    jira_domain: str | None = Field(default=None, max_length=255)
    jira_email: str | None = Field(default=None, max_length=255)
    jira_token: str | None = None
    notion_database_id: str | None = Field(default=None, max_length=255)
    notion_token: str | None = None


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    category: str
    color: str
    description: str | None
    visibility: str
    meeting_template: str
    jira_domain: str | None
    jira_email: str | None
    jira_token_configured: bool = False
    notion_database_id: str | None
    notion_token_configured: bool = False
    owner_id: UUID
    team_lead: str
    team_lead_position: str | None = None
    member_count: int
    members: list[MemberResponse]
    meetings: list[MeetingResponse]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectListItem(BaseModel):
    id: UUID
    name: str
    category: str
    color: str
    description: str | None
    visibility: str
    meeting_template: str
    owner_id: UUID
    team_lead: str
    member_count: int
    meeting_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Project Stats ─────────────────────────────────────────────────────────────

class UploadStatusBreakdown(BaseModel):
    pending: int = 0
    processing: int = 0
    completed: int = 0
    failed: int = 0


class ProjectStats(BaseModel):
    total_uploads: int
    uploads_by_status: UploadStatusBreakdown
    total_meetings: int
    total_tickets: int
    member_count: int
