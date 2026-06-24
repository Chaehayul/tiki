from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class MeetingSearchChunk(BaseModel):
    chunk_index: int | None = None
    chunk_local_index: int | None = None
    speaker: str | None = None
    speaker_id: str | None = None
    speaker_label: str | None = None
    start_seconds: float | None = None
    end_seconds: float | None = None
    duration_seconds: float | None = None
    model_name: str | None = None
    chunk_difficulty: int | None = None
    text: str = ""
    masked_text: str = ""
    search_text: str = ""


class MeetingSearchDocument(BaseModel):
    version: str = "v1"
    meeting_title: str | None = None
    project_name: str | None = None
    summary: str = ""
    keywords: list[str] = Field(default_factory=list)
    keyword_items: list[dict[str, Any]] = Field(default_factory=list)
    decisions: list[str] = Field(default_factory=list)
    action_items: list[dict[str, Any]] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)
    next_agenda: list[str] = Field(default_factory=list)
    chunks: list[MeetingSearchChunk] = Field(default_factory=list)
    search_text: str = ""

