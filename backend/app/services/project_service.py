from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import AppException
from app.models.project import Meeting, Project, ProjectMember
from app.models.user import User
from app.schemas.project import (
    MeetingCreate,
    MeetingUpdate,
    ProjectCreate,
    ProjectUpdate,
)


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

def _get_project_or_404(db: Session, project_id: UUID) -> Project:
    project = db.scalar(
        select(Project)
        .where(Project.id == project_id)
        .options(
            selectinload(Project.members),
            selectinload(Project.meetings),
            selectinload(Project.owner),
        )
    )
    if project is None:
        raise AppException(detail="Project not found", status_code=404, code="project_not_found")
    return project


def _assert_member(project: Project, user_id: UUID) -> None:
    is_owner = project.owner_id == user_id
    is_member = any(m.user_id == user_id for m in project.members)
    if not is_owner and not is_member:
        raise AppException(detail="Access denied", status_code=403, code="forbidden")


def _assert_owner(project: Project, user_id: UUID) -> None:
    if project.owner_id != user_id:
        raise AppException(detail="Only the project owner can perform this action", status_code=403, code="forbidden")


def _build_team_lead(project: Project) -> str:
    return project.owner.name if project.owner else "알 수 없음"


# ── Project CRUD ──────────────────────────────────────────────────────────────

def list_projects(db: Session, user_id: UUID) -> list[Project]:
    owned = db.scalars(
        select(Project)
        .where(Project.owner_id == user_id)
        .options(
            selectinload(Project.members),
            selectinload(Project.meetings),
            selectinload(Project.owner),
        )
    ).all()

    member_project_ids = db.scalars(
        select(ProjectMember.project_id).where(ProjectMember.user_id == user_id)
    ).all()

    if member_project_ids:
        member_projects = db.scalars(
            select(Project)
            .where(Project.id.in_(member_project_ids), Project.owner_id != user_id)
            .options(
                selectinload(Project.members),
                selectinload(Project.meetings),
                selectinload(Project.owner),
            )
        ).all()
    else:
        member_projects = []

    seen: set[UUID] = set()
    result = []
    for p in list(owned) + list(member_projects):
        if p.id not in seen:
            seen.add(p.id)
            result.append(p)
    return result


def create_project(db: Session, payload: ProjectCreate, user_id: UUID) -> Project:
    project = Project(
        name=payload.name,
        category=payload.category,
        color=payload.color,
        description=payload.description,
        owner_id=user_id,
    )
    db.add(project)
    db.flush()

    for invite in payload.members:
        member = ProjectMember(
            project_id=project.id,
            email=invite.email,
            name=invite.name,
            role=invite.role,
        )
        db.add(member)

    db.commit()
    db.refresh(project)
    return _get_project_or_404(db, project.id)


def get_project(db: Session, project_id: UUID, user_id: UUID) -> Project:
    project = _get_project_or_404(db, project_id)
    _assert_member(project, user_id)
    return project


def update_project(db: Session, project_id: UUID, payload: ProjectUpdate, user_id: UUID) -> Project:
    project = _get_project_or_404(db, project_id)
    _assert_owner(project, user_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    db.commit()
    return _get_project_or_404(db, project.id)


def delete_project(db: Session, project_id: UUID, user_id: UUID) -> None:
    project = _get_project_or_404(db, project_id)
    _assert_owner(project, user_id)
    db.delete(project)
    db.commit()


# ── Meeting CRUD ──────────────────────────────────────────────────────────────

def _get_meeting_or_404(db: Session, project_id: UUID, meeting_id: UUID) -> Meeting:
    meeting = db.scalar(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.project_id == project_id)
    )
    if meeting is None:
        raise AppException(detail="Meeting not found", status_code=404, code="meeting_not_found")
    return meeting


def list_meetings(db: Session, project_id: UUID, user_id: UUID) -> list[Meeting]:
    project = _get_project_or_404(db, project_id)
    _assert_member(project, user_id)
    return list(
        db.scalars(select(Meeting).where(Meeting.project_id == project_id).order_by(Meeting.date.desc())).all()
    )


def create_meeting(db: Session, project_id: UUID, payload: MeetingCreate, user_id: UUID) -> Meeting:
    project = _get_project_or_404(db, project_id)
    _assert_member(project, user_id)

    meeting = Meeting(
        project_id=project_id,
        title=payload.title,
        date=payload.date,
        round_number=payload.round_number,
        status=payload.status,
        meeting_type=payload.meeting_type,
        tags=payload.tags,
        participants=payload.participants,
        summary=payload.summary,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def get_meeting(db: Session, project_id: UUID, meeting_id: UUID, user_id: UUID) -> Meeting:
    project = _get_project_or_404(db, project_id)
    _assert_member(project, user_id)
    return _get_meeting_or_404(db, project_id, meeting_id)


def update_meeting(
    db: Session, project_id: UUID, meeting_id: UUID, payload: MeetingUpdate, user_id: UUID
) -> Meeting:
    project = _get_project_or_404(db, project_id)
    _assert_member(project, user_id)
    meeting = _get_meeting_or_404(db, project_id, meeting_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(meeting, field, value)

    db.commit()
    db.refresh(meeting)
    return meeting


def delete_meeting(db: Session, project_id: UUID, meeting_id: UUID, user_id: UUID) -> None:
    project = _get_project_or_404(db, project_id)
    _assert_member(project, user_id)
    meeting = _get_meeting_or_404(db, project_id, meeting_id)
    db.delete(meeting)
    db.commit()
