from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import BACKEND_DIR, settings
from app.core.exceptions import AppException
from app.db.database import get_db
from app.models.file import ExtractedContent, UploadedFile
from app.schemas.analysis import AnalysisResultResponse
from app.schemas.upload import UploadBatchResponse, UploadedFileResponse
from app.workers.tasks import process_uploaded_file
from app.services.pipeline.file_processing import (
    AUDIO_EXTENSIONS,
    MAX_UPLOAD_BYTES,
    build_storage_path,
    classify_file_kind,
)

router = APIRouter(prefix="/uploads", tags=["uploads"])


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
    db: Session = Depends(get_db),
) -> UploadBatchResponse:
    if not files:
        raise AppException(detail="No files uploaded", code="empty_upload")

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
    db: Session = Depends(get_db),
) -> UploadedFileResponse:
    uploaded_file = db.get(UploadedFile, file_id)
    if uploaded_file is None:
        raise AppException(detail="Uploaded file not found", status_code=404, code="not_found")

    return UploadedFileResponse.model_validate(uploaded_file)


@router.get("/{file_id}/analysis", response_model=AnalysisResultResponse)
def get_analysis(
    file_id: UUID,
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

    content = uploaded_file.extracted_content
    analysis = content.analysis_result if content else None

    return AnalysisResultResponse(
        file_id=uploaded_file.id,
        file_status=uploaded_file.status,
        original_filename=uploaded_file.original_filename,
        project_id=uploaded_file.project_id,
        summary=analysis.summary if analysis else None,
        action_items=analysis.action_items if analysis else None,
        model_name=analysis.model_name if analysis else None,
        prompt_version=analysis.prompt_version if analysis else None,
        masked_transcript=content.masked_text if content else None,
        extraction_method=content.extraction_method if content else None,
    )
