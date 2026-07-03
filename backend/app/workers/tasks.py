"""Async/background task entry points."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select

from app.core.config import settings
from app.db.database import SessionLocal
from app.models.analysis import AnalysisResult
from app.models.enums import FileKind, ProcessingStatus
from app.models.file import ExtractedContent, UploadedFile
from app.models.project import Project, ProjectMember
from app.models.ticket import Ticket
from app.services.ai_engine import get_default_ai_engine

logger = logging.getLogger(__name__)


def _log_progress(file_id: UUID, progress_pct: int, message: str) -> None:
    logger.info("File %s progress %d%% - %s", file_id, progress_pct, message)


def process_uploaded_file(file_id: UUID) -> None:
    db = SessionLocal()
    try:
        _run_pipeline(db, file_id)
    except Exception as exc:
        logger.exception("Pipeline failed for file %s", file_id)
        _mark_failed(db, file_id, str(exc))
    finally:
        db.close()


def _run_pipeline(db, file_id: UUID) -> None:
    uploaded_file = db.get(UploadedFile, file_id)
    if uploaded_file is None:
        raise ValueError(f"UploadedFile {file_id} not found")

    project_context = None
    if uploaded_file.project_id is not None:
        project = db.get(Project, uploaded_file.project_id)
        if project is not None:
            members = db.scalars(
                select(ProjectMember).where(ProjectMember.project_id == project.id)
            ).all()
            participant_names = [
                (member.name or member.email or "").strip()
                for member in members
                if (member.name or member.email or "").strip()
            ]
            project_context = {
                "project_name": project.name,
                "project_category": project.category,
                "participants": participant_names,
                "extra": {
                    "project_id": str(project.id),
                    "project_visibility": project.visibility,
                },
            }

    uploaded_file.status = ProcessingStatus.PROCESSING
    uploaded_file.started_at = datetime.now(UTC)
    db.commit()
    _log_progress(file_id, 10, "파일이 분석 큐에서 처리 단계로 이동했습니다")

    engine = get_default_ai_engine()
    if uploaded_file.file_kind == FileKind.AUDIO:
        _log_progress(file_id, 25, "오디오 전사와 초기 분석 파이프라인을 시작합니다")
        result = engine.process_audio_parallel(
            uploaded_file.storage_path,
            n_workers=settings.whisper_parallel_workers,
            rag_context=project_context,
            include_diarization=False,
        )
        _log_progress(file_id, 75, "전사 결과를 먼저 분석하고 있습니다")
        extraction_method = "whisper"
    elif uploaded_file.file_kind in {FileKind.DOCUMENT, FileKind.TEXT}:
        _log_progress(file_id, 25, "문서 추출 파이프라인을 시작합니다")
        result = engine.process_document(uploaded_file.storage_path, rag_context=project_context)
        _log_progress(file_id, 75, "문서 요약과 액션아이템을 정리하고 있습니다")
        extraction_method = result.analysis.extra_data.get("document_extraction", {}).get(
            "extraction_method",
            "document",
        )
        uploaded_file.page_count = result.analysis.extra_data.get("document_extraction", {}).get("page_count")
    else:
        raise ValueError(f"Unsupported file kind: {uploaded_file.file_kind}")

    extracted_content = ExtractedContent(
        uploaded_file_id=uploaded_file.id,
        raw_text=result.transcript,
        masked_text=result.masked_transcript,
        extraction_method=extraction_method,
    )
    db.add(extracted_content)
    db.flush()
    _log_progress(file_id, 85, "추출된 본문을 저장했습니다")

    analysis_result = AnalysisResult(
        extracted_content_id=extracted_content.id,
        summary=result.analysis.summary,
        action_items=result.analysis.action_items,
        model_name=result.analysis.model_name,
        prompt_version=result.analysis.prompt_version,
        extra_data=result.analysis.extra_data,
    )
    db.add(analysis_result)
    db.flush()
    _log_progress(file_id, 92, "분석 결과를 저장했습니다")

    for item in result.analysis.action_items:
        due_at = None
        if item.get("due_at"):
            raw = datetime.fromisoformat(item["due_at"])
            due_at = raw.astimezone(UTC) if raw.tzinfo else raw.replace(tzinfo=UTC)

        db.add(Ticket(
            analysis_result_id=analysis_result.id,
            title=item.get("title", "제목 없음"),
            description=item.get("description", ""),
            priority=item.get("priority", "medium"),
            status=item.get("status", "draft"),
            assignee=item.get("assignee"),
            due_at=due_at,
        ))

    uploaded_file.status = ProcessingStatus.COMPLETED
    uploaded_file.completed_at = datetime.now(UTC)
    db.commit()

    _log_progress(file_id, 100, "파이프라인이 완료되었습니다")


def _mark_failed(db, file_id: UUID, error_message: str) -> None:
    try:
        uploaded_file = db.get(UploadedFile, file_id)
        if uploaded_file:
            uploaded_file.status = ProcessingStatus.FAILED
            uploaded_file.error_message = error_message
            uploaded_file.completed_at = datetime.now(UTC)
            db.commit()
    except Exception:
        logger.exception("Failed to mark file %s as failed", file_id)
