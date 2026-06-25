from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user
from app.core.config import BACKEND_DIR, settings
from app.core.exceptions import AppException
from app.db.database import get_db
from app.models.analysis import AnalysisResult
from app.models.enums import ProcessingStatus
from app.models.file import ExtractedContent, UploadedFile
from app.models.project import Project, ProjectMember
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.analysis import AnalysisResultResponse
from app.schemas.ticket import TicketResponse
from app.schemas.upload import UploadBatchResponse, UploadedFileResponse
from app.workers.tasks import process_uploaded_file
from app.services.pipeline.file_processing import (
    AUDIO_EXTENSIONS,
    MAX_UPLOAD_BYTES,
    build_storage_path,
    classify_file_kind,
)

router = APIRouter(prefix="/uploads", tags=["uploads"])


def _assert_project_access(db: Session, project_id: UUID, user_id: UUID) -> None:
    """Raise 404/403 if project doesn't exist or user has no access."""
    project = db.get(Project, project_id)
    if project is None:
        raise AppException(detail="Project not found", status_code=404, code="not_found")
    is_owner = project.owner_id == user_id
    is_member = db.scalar(
        select(ProjectMember.id).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    ) is not None
    if not is_owner and not is_member:
        raise AppException(detail="Access denied", status_code=403, code="forbidden")


def _assert_file_access(db: Session, uploaded_file: UploadedFile, user_id: UUID) -> None:
    """Raise 403 if user is neither owner nor member of the file's project."""
    if uploaded_file.project_id is None:
        return
    is_owner = db.scalar(
        select(Project.id).where(
            Project.id == uploaded_file.project_id,
            Project.owner_id == user_id,
        )
    ) is not None
    is_member = db.scalar(
        select(ProjectMember.id).where(
            ProjectMember.project_id == uploaded_file.project_id,
            ProjectMember.user_id == user_id,
        )
    ) is not None
    if not is_owner and not is_member:
        raise AppException(detail="Access denied", status_code=403, code="forbidden")


@router.get("", response_model=list[UploadedFileResponse])
def list_uploaded_files(
    project_id: UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UploadedFileResponse]:
    stmt = (
        select(UploadedFile)
        .outerjoin(Project, Project.id == UploadedFile.project_id)
        .outerjoin(
            ProjectMember,
            (ProjectMember.project_id == UploadedFile.project_id)
            & (ProjectMember.user_id == current_user.id),
        )
        .where(
            or_(
                UploadedFile.project_id.is_(None),
                Project.owner_id == current_user.id,
                ProjectMember.user_id == current_user.id,
            )
        )
        .order_by(UploadedFile.created_at.desc())
    )
    if project_id:
        stmt = stmt.where(UploadedFile.project_id == project_id)
    files = db.scalars(stmt).all()
    return [UploadedFileResponse.model_validate(f) for f in files]


@router.post(
    "",
    response_model=UploadBatchResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_files(
    background_tasks: BackgroundTasks,
    project_id: UUID | None = Form(default=None),
    project_key: str = Form(...),
    project_name: str = Form(...),
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UploadBatchResponse:
    if not files:
        raise AppException(detail="No files uploaded", code="empty_upload")

    if project_id is not None:
        _assert_project_access(db, project_id, current_user.id)

    upload_dir = (BACKEND_DIR / settings.upload_dir).resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)

    saved_files: list[UploadedFile] = []

    for file in files:
        filename = file.filename or "uploaded-file"
        extension = Path(filename).suffix.lower().lstrip(".")

        if extension not in AUDIO_EXTENSIONS:
            raise AppException(
                detail="Only audio files are currently supported by the frontend",
                code="unsupported_file_type",
            )

    for file in files:
        filename = file.filename or "uploaded-file"
        extension = Path(filename).suffix.lower().lstrip(".")
        storage_path = build_storage_path(upload_dir, file)
        file_size_bytes = 0

        with storage_path.open("wb") as output_file:
            while chunk := await file.read(1024 * 1024):
                file_size_bytes += len(chunk)
                if file_size_bytes > MAX_UPLOAD_BYTES:
                    storage_path.unlink(missing_ok=True)
                    raise AppException(
                        detail="File size exceeds 1GB limit",
                        code="file_too_large",
                    )
                output_file.write(chunk)

        uploaded_file = UploadedFile(
            project_id=project_id,
            project_key=project_key,
            project_name=project_name,
            original_filename=filename,
            storage_path=str(storage_path),
            content_type=file.content_type,
            file_extension=extension,
            file_size_bytes=file_size_bytes,
            file_kind=classify_file_kind(extension),
        )
        db.add(uploaded_file)
        saved_files.append(uploaded_file)

    db.commit()

    for uploaded_file in saved_files:
        db.refresh(uploaded_file)

    for uploaded_file in saved_files:
        background_tasks.add_task(process_uploaded_file, uploaded_file.id)

    return UploadBatchResponse(
        files=[
            UploadedFileResponse.model_validate(uploaded_file)
            for uploaded_file in saved_files
        ],
    )


@router.get("/{file_id}", response_model=UploadedFileResponse)
def get_uploaded_file(
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UploadedFileResponse:
    uploaded_file = db.get(UploadedFile, file_id)
    if uploaded_file is None:
        raise AppException(detail="Uploaded file not found", status_code=404, code="not_found")
    _assert_file_access(db, uploaded_file, current_user.id)
    return UploadedFileResponse.model_validate(uploaded_file)


@router.post("/{file_id}/retry", response_model=UploadedFileResponse)
def retry_analysis(
    file_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UploadedFileResponse:
    uploaded_file = db.get(UploadedFile, file_id)
    if uploaded_file is None:
        raise AppException(detail="Uploaded file not found", status_code=404, code="not_found")
    _assert_file_access(db, uploaded_file, current_user.id)
    if uploaded_file.status != ProcessingStatus.FAILED:
        raise AppException(
            detail="Only failed files can be retried",
            status_code=400,
            code="invalid_status",
        )
    if not Path(uploaded_file.storage_path).exists():
        raise AppException(
            detail="Original file no longer exists on disk and cannot be retried",
            status_code=409,
            code="file_missing",
        )

    uploaded_file.status = ProcessingStatus.PENDING
    uploaded_file.error_message = None
    db.commit()
    db.refresh(uploaded_file)

    background_tasks.add_task(process_uploaded_file, uploaded_file.id)
    return UploadedFileResponse.model_validate(uploaded_file)


@router.get("/{file_id}/analysis", response_model=AnalysisResultResponse)
def get_analysis(
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalysisResultResponse:
    uploaded_file = db.scalar(
        select(UploadedFile)
        .where(UploadedFile.id == file_id)
        .options(
            selectinload(UploadedFile.extracted_content).selectinload(
                ExtractedContent.analysis_result
            )
        )
    )
    if uploaded_file is None:
        raise AppException(detail="Uploaded file not found", status_code=404, code="not_found")
    _assert_file_access(db, uploaded_file, current_user.id)

    content = uploaded_file.extracted_content
    analysis = content.analysis_result if content else None
    extra_data = analysis.extra_data if analysis else {}

    return AnalysisResultResponse(
        file_id=uploaded_file.id,
        file_status=uploaded_file.status,
        original_filename=uploaded_file.original_filename,
        project_id=uploaded_file.project_id,
        summary=analysis.summary if analysis else None,
        action_items=analysis.action_items if analysis else None,
        segments=extra_data.get("script_segments"),
        tx=extra_data.get("tx"),
        model_name=analysis.model_name if analysis else None,
        prompt_version=analysis.prompt_version if analysis else None,
        masked_transcript=content.masked_text if content else None,
        extraction_method=content.extraction_method if content else None,
    )


@router.get("/{file_id}/tickets", response_model=list[TicketResponse])
def list_file_tickets(
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TicketResponse]:
    uploaded_file = db.get(UploadedFile, file_id)
    if uploaded_file is None:
        raise AppException(detail="Uploaded file not found", status_code=404, code="not_found")
    _assert_file_access(db, uploaded_file, current_user.id)

    tickets = db.scalars(
        select(Ticket)
        .join(AnalysisResult, AnalysisResult.id == Ticket.analysis_result_id)
        .join(ExtractedContent, ExtractedContent.id == AnalysisResult.extracted_content_id)
        .where(ExtractedContent.uploaded_file_id == file_id)
        .order_by(Ticket.created_at.asc())
    ).all()
    return [TicketResponse.model_validate(t) for t in tickets]
