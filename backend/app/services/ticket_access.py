from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.analysis import AnalysisResult
from app.models.file import ExtractedContent, UploadedFile
from app.models.project import Project, ProjectMember
from app.models.ticket import Ticket


def assert_ticket_access(db: Session, ticket: Ticket, user_id: UUID) -> None:
    accessible_project_id = db.scalar(
        select(Project.id)
        .join(UploadedFile, UploadedFile.project_id == Project.id)
        .join(ExtractedContent, ExtractedContent.uploaded_file_id == UploadedFile.id)
        .join(AnalysisResult, AnalysisResult.extracted_content_id == ExtractedContent.id)
        .outerjoin(
            ProjectMember,
            (ProjectMember.project_id == Project.id)
            & (ProjectMember.user_id == user_id)
            & (ProjectMember.invite_status == "accepted"),
        )
        .where(AnalysisResult.id == ticket.analysis_result_id)
        .where(
            or_(
                Project.owner_id == user_id,
                ProjectMember.user_id == user_id,
            )
        )
        .limit(1)
    )
    if accessible_project_id is None:
        raise AppException(detail="Access denied", status_code=403, code="forbidden")
