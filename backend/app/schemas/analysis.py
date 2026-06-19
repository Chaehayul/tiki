from typing import Any
from uuid import UUID

from pydantic import BaseModel


class AnalysisResultResponse(BaseModel):
    file_id: UUID
    file_status: str
    original_filename: str
    project_id: UUID | None

    # 분석 결과 (파이프라인 미완료 시 None)
    summary: str | None
    action_items: list[dict[str, Any]] | None
    model_name: str | None
    prompt_version: str | None

    # 전사 텍스트 (마스킹 처리된 버전)
    masked_transcript: str | None
    extraction_method: str | None

    model_config = {"from_attributes": True}
