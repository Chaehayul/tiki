"""Async/background task entry points."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from app.db.database import SessionLocal
from app.models.analysis import AnalysisResult
from app.models.enums import ProcessingStatus
from app.models.file import ExtractedContent, UploadedFile
from app.models.ticket import Ticket
from app.services.ai_engine import get_default_ai_engine

logger = logging.getLogger(__name__)


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

    uploaded_file.status = ProcessingStatus.PROCESSING
    uploaded_file.started_at = datetime.now(UTC)
    db.commit()

    result = get_default_ai_engine().process_audio(uploaded_file.storage_path)

    extracted_content = ExtractedContent(
        uploaded_file_id=uploaded_file.id,
        raw_text=result.transcript,
        masked_text=result.masked_transcript,
        extraction_method="whisper",
    )
    db.add(extracted_content)
    db.flush()

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

    for item in result.analysis.action_items:
        due_at = None
        if item.get("due_at"):
            due_at = datetime.fromisoformat(item["due_at"]).replace(tzinfo=UTC)

        db.add(Ticket(
            analysis_result_id=analysis_result.id,
            title=item["title"],
            description=item["description"],
            priority=item["priority"],
            status=item["status"],
            assignee=item.get("assignee"),
            due_at=due_at,
        ))

    uploaded_file.status = ProcessingStatus.COMPLETED
    uploaded_file.completed_at = datetime.now(UTC)
    db.commit()

    logger.info("Pipeline completed for file %s", file_id)


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
