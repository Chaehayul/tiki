"""Background task entry points for uploaded meeting files."""

import logging
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import select

from app.core.config import settings
from app.db.database import SessionLocal
from app.models.analysis import AnalysisResult
from app.models.enums import FileKind, ProcessingStatus, TicketStatus
from app.models.file import ExtractedContent, UploadedFile
from app.models.project import Meeting, Project, ProjectMember
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
        # A failed flush/commit above leaves the session's transaction aborted —
        # writing the failure status through the same session without rolling
        # back first raises PendingRollbackError, so _mark_failed silently fails
        # too and the row is stuck at "processing" forever with no error ever
        # recorded (indistinguishable from a genuinely hung analysis).
        db.rollback()
        _mark_failed(db, file_id, str(exc))
    finally:
        db.close()


def _project_context_for_upload(db, uploaded_file: UploadedFile) -> dict | None:
    if uploaded_file.project_id is None:
        return None

    project = db.get(Project, uploaded_file.project_id)
    if project is None:
        return None

    members = db.scalars(select(ProjectMember).where(ProjectMember.project_id == project.id)).all()
    participant_names = [
        (member.name or member.email or "").strip()
        for member in members
        if (member.name or member.email or "").strip()
    ]
    return {
        "project_name": project.name,
        "project_category": project.category,
        "participants": participant_names,
        "extra": {
            "project_id": str(project.id),
            "project_visibility": project.visibility,
        },
    }


def _normalize_action_items(raw_items) -> list[dict]:
    normalized: list[dict] = []
    for item in raw_items or []:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or item.get("text") or "").strip()
        if not title:
            continue
        normalized.append(
            {
                **item,
                "id": str(item.get("id") or item.get("task_id") or uuid4()),
                "title": title,
                # Always start a freshly analyzed task at 검토대기, regardless of
                # any status-like word the extractor happened to pick up from the
                # source text (e.g. a meeting note that already had its own
                # "진행중"/"미착수" labels per line) — those aren't TIKI's own
                # workflow states and must not be mistaken for one, especially
                # since the frontend's legacy STATUS_LABEL alias table maps
                # "진행중" straight to "검토완료".
                "status": "검토대기",
            }
        )
    return normalized


def _parse_due_at(value) -> datetime | None:
    if not value:
        return None
    try:
        raw = datetime.fromisoformat(str(value))
    except ValueError:
        return None
    return raw.astimezone(UTC) if raw.tzinfo else raw.replace(tzinfo=UTC)


def _run_pipeline(db, file_id: UUID) -> None:
    uploaded_file = db.get(UploadedFile, file_id)
    if uploaded_file is None:
        raise ValueError(f"UploadedFile {file_id} not found")

    project_context = _project_context_for_upload(db, uploaded_file)

    uploaded_file.status = ProcessingStatus.PROCESSING
    uploaded_file.started_at = datetime.now(UTC)
    db.commit()
    _log_progress(file_id, 10, "파일 분석을 시작했습니다.")

    engine = get_default_ai_engine()
    if uploaded_file.file_kind == FileKind.AUDIO:
        _log_progress(file_id, 25, "오디오 전사와 화자 분리 파이프라인을 시작합니다.")
        result = engine.process_audio_parallel(
            uploaded_file.storage_path,
            n_workers=settings.whisper_parallel_workers,
            rag_context=project_context,
            include_diarization=False,
        )
        _log_progress(file_id, 75, "전사 결과를 분석하고 있습니다.")
        extraction_method = "whisper"
    elif uploaded_file.file_kind in {FileKind.DOCUMENT, FileKind.TEXT}:
        _log_progress(file_id, 25, "문서 추출 파이프라인을 시작합니다.")
        result = engine.process_document(uploaded_file.storage_path, rag_context=project_context)
        _log_progress(file_id, 75, "문서 요약과 해야 할 일을 정리하고 있습니다.")
        extraction_meta = result.analysis.extra_data.get("document_extraction", {})
        extraction_method = extraction_meta.get("extraction_method", "document")
        uploaded_file.page_count = extraction_meta.get("page_count")
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
    _log_progress(file_id, 85, "추출된 본문을 저장했습니다.")

    action_items = _normalize_action_items(result.analysis.action_items)
    extra_data = dict(result.analysis.extra_data or {})

    analysis_result = AnalysisResult(
        extracted_content_id=extracted_content.id,
        summary=result.analysis.summary,
        action_items=action_items,
        model_name=result.analysis.model_name,
        prompt_version=result.analysis.prompt_version,
        extra_data=extra_data,
    )
    db.add(analysis_result)
    db.flush()
    _log_progress(file_id, 92, "분석 결과를 저장했습니다.")

    meeting = None
    if uploaded_file.project_id is not None:
        title = (
            getattr(result.analysis, "meeting_title", None)
            or extra_data.get("meeting_title")
            or uploaded_file.original_filename
        )
        raw_keywords = extra_data.get("keywords") or getattr(result.analysis, "keywords", []) or []
        tags = []
        for keyword in raw_keywords:
            text = str(keyword.get("text") if isinstance(keyword, dict) else keyword).strip()
            if text:
                tags.append(text if text.startswith("#") else f"#{text}")

        # Groq/OpenAI both failed and the analysis fell back to the rule-based
        # heuristic service (see LangChainAnalysisService.summarize_and_extract_tickets) —
        # flag it visibly wherever tags are shown, since it's a best-effort stand-in,
        # not a real AI analysis.
        if extra_data.get("analysis_provider") == "heuristic":
            tags.insert(0, "#검토필요(AI분석실패)")

        meeting = Meeting(
            project_id=uploaded_file.project_id,
            title=str(title).strip()[:255] or uploaded_file.original_filename,
            date=uploaded_file.created_at.strftime("%Y.%m.%d"),
            round_number=1,
            status="검토대기",
            meeting_type="업로드",
            tags=tags[:12] or ["#회의록"],
            participants=list((project_context or {}).get("participants") or []),
            summary=result.analysis.summary,
            action_items=action_items,
            action_items_count=len(action_items),
        )
        db.add(meeting)
        db.flush()

        analysis_result.extra_data = {
            **extra_data,
            "created_meeting_id": str(meeting.id),
            "created_project_id": str(uploaded_file.project_id),
            "source_uploaded_file_id": str(uploaded_file.id),
        }

    for item in action_items:
        db.add(
            Ticket(
                analysis_result_id=analysis_result.id,
                title=item.get("title", "제목 없음"),
                description=item.get("description", ""),
                priority=item.get("priority", "medium"),
                # item["status"] holds the meeting task's Korean workflow status
                # (검토대기/진행중/완료 등), not a ticket_status enum value — a
                # freshly created ticket always starts as "draft" (not yet synced
                # to Jira/Notion) regardless of that workflow status.
                status=TicketStatus.DRAFT.value,
                assignee=item.get("assignee"),
                due_at=_parse_due_at(item.get("due_at")),
            )
        )

    uploaded_file.status = ProcessingStatus.COMPLETED
    uploaded_file.completed_at = datetime.now(UTC)
    db.commit()

    if meeting is not None:
        try:
            from app.services import external_integration_service

            external_integration_service.sync_connected_meeting_resources(db, meeting)
        except Exception:
            logger.exception("Failed to sync meeting %s to external providers", meeting.id)

    _log_progress(file_id, 100, "파일 분석 파이프라인이 완료되었습니다.")


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
