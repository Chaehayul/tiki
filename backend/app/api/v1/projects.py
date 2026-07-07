from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.exceptions import AppException
from app.db.database import get_db
from app.models.analysis import AnalysisResult
from app.models.enums import ProcessingStatus
from app.models.enums import IntegrationProvider
from app.models.file import ExtractedContent, UploadedFile
from app.models.project import Project
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.project import (
    MeetingCreate,
    MeetingResponse,
    MeetingUpdate,
    MemberInvite,
    MemberResponse,
    MemberRoleUpdate,
    ProjectCreate,
    ProjectListItem,
    ProjectResponse,
    ProjectStats,
    ProjectUpdate,
    UploadStatusBreakdown,
)
from app.schemas.integration import JiraProjectOptionResponse, JiraProjectSelectRequest, ProjectIntegrationsResponse
from app.schemas.ticket import ExternalSyncResponse, ProjectTicketItem
from app.schemas.upload import UploadedFileResponse
from app.services import project_service
from app.services import external_integration_service

router = APIRouter(prefix="/projects", tags=["projects"])


def _to_member_response(member) -> MemberResponse:
    return MemberResponse(
        id=member.id,
        email=member.email,
        name=member.name,
        role=member.role,
        position=member.user.position if getattr(member, "user", None) else None,
        invite_status=member.invite_status,
        invited_by_name=member.invited_by.name if getattr(member, "invited_by", None) else None,
        project_id=member.project_id,
        project_name=member.project.name if getattr(member, "project", None) else None,
        responded_at=member.responded_at,
        created_at=member.created_at,
    )


def _to_project_response(project: Project) -> ProjectResponse:
    accepted_member_count = sum(1 for member in project.members if member.invite_status == "accepted")
    return ProjectResponse(
        id=project.id,
        name=project.name,
        category=project.category,
        color=project.color,
        description=project.description,
        visibility=project.visibility,
        meeting_template=project.meeting_template,
        jira_domain=project.jira_domain,
        jira_email=project.jira_email,
        jira_token_configured=bool(project.jira_token),
        notion_database_id=project.notion_database_id,
        notion_token_configured=bool(project.notion_token),
        owner_id=project.owner_id,
        team_lead=project.owner.name if project.owner else "알 수 없음",
        team_lead_position=project.owner.position if project.owner else None,
        member_count=accepted_member_count + 1,
        members=[_to_member_response(m) for m in project.members],
        meetings=[MeetingResponse.model_validate(m) for m in project.meetings],
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def _to_list_item(project: Project) -> ProjectListItem:
    accepted_member_count = sum(1 for member in project.members if member.invite_status == "accepted")
    return ProjectListItem(
        id=project.id,
        name=project.name,
        category=project.category,
        color=project.color,
        description=project.description,
        visibility=project.visibility,
        meeting_template=project.meeting_template,
        owner_id=project.owner_id,
        team_lead=project.owner.name if project.owner else "알 수 없음",
        member_count=accepted_member_count + 1,
        meeting_count=len(project.meetings),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


# ── Project ───────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ProjectListItem])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectListItem]:
    projects = project_service.list_projects(db, current_user.id)
    return [_to_list_item(p) for p in projects]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    project = project_service.create_project(db, payload, current_user.id)
    return _to_project_response(project)


@router.get("/invitations", response_model=list[MemberResponse])
def list_my_invitations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MemberResponse]:
    invitations = project_service.list_my_invitations(db, current_user)
    return [_to_member_response(invitation) for invitation in invitations]


@router.post("/invitations/{invitation_id}/accept", response_model=MemberResponse)
def accept_invitation(
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MemberResponse:
    invitation = project_service.respond_to_invitation(db, invitation_id, current_user, "accepted")
    return _to_member_response(invitation)


@router.post("/invitations/{invitation_id}/decline", response_model=MemberResponse)
def decline_invitation(
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MemberResponse:
    invitation = project_service.respond_to_invitation(db, invitation_id, current_user, "declined")
    return _to_member_response(invitation)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    project = project_service.get_project(db, project_id, current_user.id)
    return _to_project_response(project)


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    project = project_service.update_project(db, project_id, payload, current_user.id)
    return _to_project_response(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    project_service.delete_project(db, project_id, current_user.id)


@router.get("/{project_id}/integrations", response_model=ProjectIntegrationsResponse)
def get_project_integrations(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectIntegrationsResponse:
    statuses = external_integration_service.list_project_integration_status(db, project_id, current_user.id)
    return ProjectIntegrationsResponse(**statuses)


@router.post("/{project_id}/integrations/{provider}/sync-meetings")
def sync_project_integration_meetings(
    project_id: UUID,
    provider: IntegrationProvider,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    statuses = external_integration_service.list_project_integration_status(db, project_id, current_user.id)
    provider_status = statuses.get(provider.value)
    if provider_status is None or not provider_status.connected:
        raise AppException(detail=f"{provider.value} is not connected", status_code=403, code=f"{provider.value}_not_connected")
    return external_integration_service.sync_project_meeting_resources(db, project_id, provider)


@router.delete("/{project_id}/integrations/{provider}", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_project_integration(
    project_id: UUID,
    provider: IntegrationProvider,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    external_integration_service.disconnect_project_integration(db, project_id, provider, current_user.id)


@router.get("/{project_id}/integrations/jira/projects", response_model=list[JiraProjectOptionResponse])
def list_jira_projects(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[JiraProjectOptionResponse]:
    options = external_integration_service.list_jira_projects(db, project_id, current_user.id)
    return [JiraProjectOptionResponse(key=option.key, name=option.name) for option in options]


@router.put("/{project_id}/integrations/jira/project", response_model=ProjectIntegrationsResponse)
def set_jira_project(
    project_id: UUID,
    payload: JiraProjectSelectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectIntegrationsResponse:
    external_integration_service.set_jira_project(db, project_id, current_user.id, payload.key, payload.name)
    external_integration_service.sync_project_meeting_resources(db, project_id, IntegrationProvider.JIRA)
    statuses = external_integration_service.list_project_integration_status(db, project_id, current_user.id)
    return ProjectIntegrationsResponse(**statuses)


# ── Project Stats ─────────────────────────────────────────────────────────────

@router.get("/{project_id}/stats", response_model=ProjectStats)
def get_project_stats(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectStats:
    project = project_service.get_project(db, project_id, current_user.id)

    upload_rows = db.execute(
        select(UploadedFile.status, func.count().label("cnt"))
        .where(UploadedFile.project_id == project_id)
        .group_by(UploadedFile.status)
    ).all()

    status_map: dict[str, int] = {s.value: 0 for s in ProcessingStatus}
    for row in upload_rows:
        status_map[row.status] = row.cnt

    total_tickets = db.scalar(
        select(func.count(Ticket.id))
        .join(AnalysisResult, AnalysisResult.id == Ticket.analysis_result_id)
        .join(ExtractedContent, ExtractedContent.id == AnalysisResult.extracted_content_id)
        .join(UploadedFile, UploadedFile.id == ExtractedContent.uploaded_file_id)
        .where(UploadedFile.project_id == project_id)
    ) or 0

    return ProjectStats(
        total_uploads=sum(status_map.values()),
        uploads_by_status=UploadStatusBreakdown(**status_map),
        total_meetings=len(project.meetings),
        total_tickets=total_tickets,
        member_count=sum(1 for member in project.members if member.invite_status == "accepted") + 1,
    )


# ── Project Uploads ───────────────────────────────────────────────────────────

@router.get("/{project_id}/uploads", response_model=list[UploadedFileResponse])
def list_project_uploads(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UploadedFileResponse]:
    project_service.get_project(db, project_id, current_user.id)
    files = db.scalars(
        select(UploadedFile)
        .where(UploadedFile.project_id == project_id)
        .order_by(UploadedFile.created_at.desc())
    ).all()
    return [UploadedFileResponse.from_uploaded_file(f) for f in files]


# ── Meeting ───────────────────────────────────────────────────────────────────

@router.get("/{project_id}/meetings", response_model=list[MeetingResponse])
def list_meetings(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MeetingResponse]:
    meetings = project_service.list_meetings(db, project_id, current_user.id)
    return [MeetingResponse.model_validate(m) for m in meetings]


@router.post(
    "/{project_id}/meetings",
    response_model=MeetingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_meeting(
    project_id: UUID,
    payload: MeetingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeetingResponse:
    meeting = project_service.create_meeting(db, project_id, payload, current_user.id)
    return MeetingResponse.model_validate(meeting)


@router.get("/{project_id}/meetings/{meeting_id}", response_model=MeetingResponse)
def get_meeting(
    project_id: UUID,
    meeting_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeetingResponse:
    meeting = project_service.get_meeting(db, project_id, meeting_id, current_user.id)
    return MeetingResponse.model_validate(meeting)


@router.patch("/{project_id}/meetings/{meeting_id}", response_model=MeetingResponse)
def update_meeting(
    project_id: UUID,
    meeting_id: UUID,
    payload: MeetingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeetingResponse:
    meeting = project_service.update_meeting(db, project_id, meeting_id, payload, current_user.id)
    return MeetingResponse.model_validate(meeting)


@router.delete("/{project_id}/meetings/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(
    project_id: UUID,
    meeting_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    project_service.delete_meeting(db, project_id, meeting_id, current_user.id)


# ── Project Tickets ───────────────────────────────────────────────────────────

def _to_project_ticket_item(ticket) -> ProjectTicketItem:
    uploaded_file = ticket.analysis_result.extracted_content.uploaded_file
    return ProjectTicketItem(
        id=ticket.id,
        title=ticket.title,
        description=ticket.description,
        status=ticket.status,
        priority=ticket.priority,
        assignee=ticket.assignee,
        due_at=ticket.due_at,
        file_id=uploaded_file.id,
        file_name=uploaded_file.original_filename,
        external_syncs=[ExternalSyncResponse.model_validate(s) for s in ticket.external_syncs],
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


@router.get("/{project_id}/tickets", response_model=list[ProjectTicketItem])
def list_project_tickets(
    project_id: UUID,
    status: str | None = None,
    assignee: str | None = None,
    file_id: UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectTicketItem]:
    tickets = project_service.list_project_tickets(
        db, project_id, current_user.id,
        status=status,
        assignee=assignee,
        file_id=file_id,
    )
    return [_to_project_ticket_item(t) for t in tickets]


# ── Project Members ───────────────────────────────────────────────────────────

@router.post(
    "/{project_id}/members",
    response_model=MemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def invite_member(
    project_id: UUID,
    payload: MemberInvite,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MemberResponse:
    member = project_service.invite_member(db, project_id, payload, current_user.id)
    return _to_member_response(member)


@router.delete("/{project_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    project_id: UUID,
    member_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    project_service.remove_member(db, project_id, member_id, current_user.id)


@router.patch("/{project_id}/members/{member_id}", response_model=MemberResponse)
def update_member_role(
    project_id: UUID,
    member_id: UUID,
    payload: MemberRoleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MemberResponse:
    member = project_service.update_member_role(db, project_id, member_id, payload, current_user.id)
    return _to_member_response(member)
