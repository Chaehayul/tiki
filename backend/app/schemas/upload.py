from datetime import UTC, datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import ProcessingStatus


class UploadProcessingState(BaseModel):
    status: str
    phase: str
    progress_pct: int
    status_message: str
    can_retry: bool = False


class UploadedFileResponse(BaseModel):
    id: UUID
    project_id: UUID | None
    meeting_id: UUID | None = None
    project_key: str
    project_name: str
    original_filename: str
    file_size_bytes: int
    file_extension: str
    file_kind: str
    status: str
    processing_state: UploadProcessingState

    @classmethod
    def from_uploaded_file(cls, uploaded_file) -> "UploadedFileResponse":
        status = ProcessingStatus(uploaded_file.status)
        started_at = getattr(uploaded_file, "started_at", None)
        now = datetime.now(UTC)

        if status == ProcessingStatus.PENDING:
            state = UploadProcessingState(
                status=status.value,
                phase="queued",
                progress_pct=10,
                status_message="업로드가 저장되어 분석을 기다리고 있습니다.",
                can_retry=False,
            )
        elif status == ProcessingStatus.PROCESSING:
            if started_at is None:
                progress_pct = 65
                status_message = "AI 분석을 진행 중입니다."
            else:
                elapsed_seconds = max(0.0, (now - started_at).total_seconds())
                if elapsed_seconds < 20:
                    progress_pct = 22
                    status_message = "파일 전처리를 준비 중입니다."
                elif elapsed_seconds < 120:
                    progress_pct = 48
                    status_message = "전사와 문서 추출을 진행 중입니다."
                elif elapsed_seconds < 240:
                    progress_pct = 72
                    status_message = "요약과 해야 할 일을 정리 중입니다."
                else:
                    progress_pct = 88
                    status_message = "결과를 최종 저장 중입니다."

            state = UploadProcessingState(
                status=status.value,
                phase="processing",
                progress_pct=progress_pct,
                status_message=status_message,
                can_retry=False,
            )
        elif status == ProcessingStatus.COMPLETED:
            state = UploadProcessingState(
                status=status.value,
                phase="completed",
                progress_pct=100,
                status_message="분석이 완료되었습니다.",
                can_retry=False,
            )
        elif status == ProcessingStatus.FAILED:
            state = UploadProcessingState(
                status=status.value,
                phase="failed",
                progress_pct=100,
                status_message="분석에 실패했습니다. 다시 시도할 수 있습니다.",
                can_retry=True,
            )
        else:
            state = UploadProcessingState(
                status=str(uploaded_file.status),
                phase="unknown",
                progress_pct=0,
                status_message="상태를 확인할 수 없습니다.",
                can_retry=False,
            )

        meeting_id = None
        content = getattr(uploaded_file, "extracted_content", None)
        analysis = getattr(content, "analysis_result", None) if content is not None else None
        extra_data = getattr(analysis, "extra_data", None) if analysis is not None else None
        if isinstance(extra_data, dict):
            raw_meeting_id = extra_data.get("created_meeting_id") or extra_data.get("meeting_id")
            if raw_meeting_id:
                try:
                    meeting_id = UUID(str(raw_meeting_id))
                except (TypeError, ValueError):
                    meeting_id = None

        return cls(
            id=uploaded_file.id,
            project_id=uploaded_file.project_id,
            meeting_id=meeting_id,
            project_key=uploaded_file.project_key,
            project_name=uploaded_file.project_name,
            original_filename=uploaded_file.original_filename,
            file_size_bytes=uploaded_file.file_size_bytes,
            file_extension=uploaded_file.file_extension,
            file_kind=str(uploaded_file.file_kind),
            status=str(uploaded_file.status),
            processing_state=state,
        )

    model_config = {"from_attributes": True}


class UploadBatchResponse(BaseModel):
    files: list[UploadedFileResponse]
    message: str = "upload accepted"
