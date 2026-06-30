from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class SummaryRequestPayload(BaseModel):
    contract_version: str = "v1"
    focus: str | None = None
    prompt: str | None = None
    length: str | None = None
    target_fields: list[str] = Field(
        default_factory=lambda: [
            "summary",
            "keywords",
            "decisions",
            "action_items",
            "issues",
            "next_agenda",
            "search_document",
        ]
    )


class AnalysisResultResponse(BaseModel):
    contract_version: str = "v1"
    file_id: UUID
    file_status: str
    original_filename: str
    project_id: UUID | None

    # 분석 결과 (파이프라인 미완료 시 None)
    meeting_title: str | None
    summary: str | None
    keywords: list[dict[str, Any]] | None
    decisions: list[str] | None
    action_items: list[dict[str, Any]] | None
    issues: list[dict[str, Any]] | None
    next_agenda: list[str] | None
    segments: list[dict[str, Any]] | None
    tx: list[dict[str, Any]] | None
    search_document: dict[str, Any] | None
    document_summary: dict[str, Any] | None
    summary_request: SummaryRequestPayload | None
    extra_data: dict[str, Any] | None
    model_name: str | None
    prompt_version: str | None

    # 전사 텍스트 (마스킹 처리된 버전)
    masked_transcript: str | None
    extraction_method: str | None

    model_config = {"from_attributes": True}
