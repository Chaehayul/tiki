from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

AI_INPUT_CONTRACT_VERSION = "v1"
AI_INPUT_SOURCE_KIND_AUDIO = "audio"
AI_INPUT_SOURCE_KIND_AUDIO_BATCH = "audio_batch"
AI_INPUT_SOURCE_KIND_TEXT = "text"
AI_INPUT_SOURCE_KIND_DOCUMENT = "document"


def _normalize_text(value: Any) -> str:
    return " ".join(str(value or "").split()).strip()


def _clean_optional_text(value: Any) -> str | None:
    text = _normalize_text(value)
    return text or None


def normalize_source_kind(value: Any, default: str = AI_INPUT_SOURCE_KIND_TEXT) -> str:
    normalized = _normalize_text(value).lower()
    if normalized in {
        AI_INPUT_SOURCE_KIND_AUDIO,
        AI_INPUT_SOURCE_KIND_AUDIO_BATCH,
        AI_INPUT_SOURCE_KIND_TEXT,
        AI_INPUT_SOURCE_KIND_DOCUMENT,
    }:
        return normalized
    return default


class AIInputChunk(BaseModel):
    index: int
    chunk_kind: str = "segment"
    title: str | None = None
    text: str = ""
    masked_text: str = ""
    page_number: int | None = None
    paragraph_index: int | None = None
    start_seconds: float | None = None
    end_seconds: float | None = None
    duration_seconds: float | None = None
    speaker: str | None = None
    speaker_id: str | None = None
    speaker_label: str | None = None
    speaker_display_name: str | None = None
    speaker_kind: str | None = None
    is_mapped: bool | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_mapping(cls, data: dict[str, Any], *, chunk_kind: str = "segment", index: int | None = None) -> "AIInputChunk":
        metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
        normalized_metadata = {
            key: value
            for key, value in metadata.items()
            if value not in (None, "", [], {}, ())
        }
        return cls(
            index=int(data.get("index", index if index is not None else 0)),
            chunk_kind=_normalize_text(data.get("chunk_kind")) or chunk_kind,
            title=_clean_optional_text(data.get("title")),
            text=_normalize_text(data.get("text")),
            masked_text=_normalize_text(data.get("masked_text")),
            page_number=data.get("page_number"),
            paragraph_index=data.get("paragraph_index"),
            start_seconds=data.get("start_seconds"),
            end_seconds=data.get("end_seconds"),
            duration_seconds=data.get("duration_seconds"),
            speaker=_clean_optional_text(data.get("speaker")),
            speaker_id=_clean_optional_text(data.get("speaker_id")),
            speaker_label=_clean_optional_text(data.get("speaker_label")),
            speaker_display_name=_clean_optional_text(data.get("speaker_display_name")),
            speaker_kind=_clean_optional_text(data.get("speaker_kind")),
            is_mapped=data.get("is_mapped"),
            metadata=normalized_metadata,
        )


class AIInputContract(BaseModel):
    contract_version: str = AI_INPUT_CONTRACT_VERSION
    source_kind: str
    source_name: str | None = None
    source_path: str | None = None
    source_title: str | None = None
    source_text: str = ""
    masked_source_text: str = ""
    chunks: list[AIInputChunk] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


def build_ai_input_contract(
    *,
    source_kind: Any,
    source_text: Any = "",
    masked_source_text: Any = "",
    chunks: list[dict[str, Any]] | list[AIInputChunk] | None = None,
    source_name: Any = None,
    source_path: Any = None,
    source_title: Any = None,
    context: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
    contract_version: str = AI_INPUT_CONTRACT_VERSION,
) -> AIInputContract:
    normalized_chunks: list[AIInputChunk] = []
    for index, chunk in enumerate(chunks or []):
        if isinstance(chunk, AIInputChunk):
            normalized_chunks.append(chunk)
            continue
        if isinstance(chunk, dict):
            normalized_chunks.append(AIInputChunk.from_mapping(chunk, index=index))
            continue
        normalized_chunks.append(
            AIInputChunk(
                index=index,
                text=_normalize_text(chunk),
                masked_text=_normalize_text(chunk),
            )
        )

    normalized_context = {
        key: value
        for key, value in dict(context or {}).items()
        if value not in (None, "", [], {}, ())
    }
    normalized_metadata = {
        key: value
        for key, value in dict(metadata or {}).items()
        if value not in (None, "", [], {}, ())
    }

    return AIInputContract(
        contract_version=contract_version,
        source_kind=normalize_source_kind(source_kind),
        source_name=_clean_optional_text(source_name),
        source_path=_clean_optional_text(source_path),
        source_title=_clean_optional_text(source_title),
        source_text=_normalize_text(source_text),
        masked_source_text=_normalize_text(masked_source_text),
        chunks=normalized_chunks,
        context=normalized_context,
        metadata=normalized_metadata,
    )
