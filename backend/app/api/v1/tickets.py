from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.exceptions import AppException
from app.db.database import get_db
from app.models.analysis import AnalysisResult
from app.models.file import ExtractedContent, UploadedFile
from app.models.project import Project, ProjectMember
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.ticket import TicketResponse, TicketUpdate

router = APIRouter(prefix="/tickets", tags=["tickets"])


def _assert_ticket_access(db: Session, ticket: Ticket, user_id: UUID) -> None:
    project_id = db.scalar(
        select(UploadedFile.project_id)
        .join(ExtractedContent, ExtractedContent.uploaded_file_id == UploadedFile.id)
        .join(AnalysisResult, AnalysisResult.extracted_content_id == ExtractedContent.id)
        .where(AnalysisResult.id == ticket.analysis_result_id)
    )
    if project_id is None:
        raise AppException(detail="Access denied", status_code=403, code="forbidden")

    is_owner = db.scalar(select(Project.id).where(Project.id == project_id, Project.owner_id == user_id)) is not None
    is_member = db.scalar(select(ProjectMember.id).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)) is not None

    if not is_owner and not is_member:
        raise AppException(detail="Access denied", status_code=403, code="forbidden")


@router.get("/{ticket_id}", response_model=TicketResponse)
def get_ticket(
    ticket_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketResponse:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise AppException(detail="Ticket not found", status_code=404, code="not_found")
    _assert_ticket_access(db, ticket, current_user.id)
    return TicketResponse.model_validate(ticket)


@router.patch("/{ticket_id}", response_model=TicketResponse)
def update_ticket(
    ticket_id: UUID,
    payload: TicketUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketResponse:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise AppException(detail="Ticket not found", status_code=404, code="not_found")
    _assert_ticket_access(db, ticket, current_user.id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ticket, field, value)

    db.commit()
    db.refresh(ticket)
    return TicketResponse.model_validate(ticket)


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket(
    ticket_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise AppException(detail="Ticket not found", status_code=404, code="not_found")
    _assert_ticket_access(db, ticket, current_user.id)
    db.delete(ticket)
    db.commit()
