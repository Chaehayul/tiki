"""Compatibility facade for the AI processing pipeline.

This module keeps a simple public surface for older imports while delegating
actual work to the split services under app.services.ai and app.services.pipeline.
"""

from __future__ import annotations

import logging
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from textwrap import shorten
from typing import Any

from app.services.ai.llm_analysis import LLMAnalysisService, build_llm_analysis_service
from app.services.ai.document_ingestion import load_document_file
from app.services.ai.rag_context import RAGContext, normalize_rag_context
from app.services.ai.stt import SpeechToTextService, WhisperSpeechToTextService
from app.schemas.ai_input import AIInputChunk, build_ai_input_contract
from app.schemas.meeting_record import MeetingSearchChunk, MeetingSearchDocument, MeetingSearchSection
from app.services.pipeline.security_masking import mask_personal_information

logger = logging.getLogger(__name__)

SENTENCE_SPLIT_PATTERN = re.compile(r"(?<=[.!?。])\s+|\n+")
SCRIPT_SEGMENT_CONTRACT_VERSION = "v1"
TX_ROW_CONTRACT_VERSION = "v1"
AI_INPUT_CONTRACT_VERSION = "v1"
ANALYSIS_OUTPUT_CONTRACT_VERSION = "v1"
SUMMARY_REQUEST_CONTRACT_VERSION = "v1"
ANALYSIS_OUTPUT_FIELDS: tuple[str, ...] = (
    "meeting_title",
    "summary",
    "keywords",
    "decisions",
    "action_items",
    "issues",
    "next_agenda",
    "search_document",
    "document_summary",
)

SUMMARY_REQUEST_INPUT_KEYS: tuple[str, ...] = (
    "focus",
    "topic",
    "prompt",
    "instruction",
    "query",
    "length",
    "len",
    "summary_length",
    "target_fields",
    "contract_version",
)

SUMMARY_REQUEST_LENGTH_ALIASES: dict[str, str] = {
    "short": "short",
    "shorter": "short",
    "brief": "short",
    "concise": "short",
    "간결": "short",
    "간결하게": "short",
    "짧게": "short",
    "짧은": "short",
    "medium": "medium",
    "normal": "medium",
    "standard": "medium",
    "보통": "medium",
    "일반": "medium",
    "적당히": "medium",
    "long": "long",
    "detailed": "long",
    "detail": "long",
    "상세": "long",
    "자세히": "long",
}

def _format_mmss(seconds: Any) -> str | None:
    if seconds is None:
        return None
    try:
        total_seconds = int(round(float(seconds)))
    except (TypeError, ValueError):
        return None
    if total_seconds < 0:
        return None
    minutes, remainder = divmod(total_seconds, 60)
    return f"{minutes:02d}:{remainder:02d}"


def _coerce_mapping(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)

    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        dumped = model_dump()
        if isinstance(dumped, dict):
            return dict(dumped)

    dict_method = getattr(value, "dict", None)
    if callable(dict_method):
        dumped = dict_method()
        if isinstance(dumped, dict):
            return dict(dumped)

    return {}


def _normalize_summary_request_target_fields(value: Any) -> list[str]:
    if value in (None, "", [], {}, ()):
        return list(ANALYSIS_OUTPUT_FIELDS)

    if isinstance(value, str):
        items = [value]
    elif isinstance(value, (list, tuple, set)):
        items = list(value)
    else:
        items = [value]

    normalized: list[str] = []
    seen: set[str] = set()
    allowed = set(ANALYSIS_OUTPUT_FIELDS)

    for item in items:
        field = _normalize_segment_text(item)
        if not field or field not in allowed:
            continue
        if field in seen:
            continue
        seen.add(field)
        normalized.append(field)

    return normalized or list(ANALYSIS_OUTPUT_FIELDS)


def _normalize_summary_request_length(value: Any) -> str | None:
    candidate = _normalize_segment_text(value).lower()
    if not candidate:
        return None
    if candidate in SUMMARY_REQUEST_LENGTH_ALIASES:
        return SUMMARY_REQUEST_LENGTH_ALIASES[candidate]
    if "짧" in candidate or "간결" in candidate or "brief" in candidate or "concise" in candidate:
        return "short"
    if "상세" in candidate or "자세" in candidate or "detailed" in candidate:
        return "long"
    if "보통" in candidate or "medium" in candidate or "normal" in candidate:
        return "medium"
    return candidate


def _extract_summary_request_candidate(context: Any | None) -> dict[str, Any]:
    if not context:
        return {}

    candidate: dict[str, Any] = {}
    mapping = _coerce_mapping(context)
    if mapping:
        direct_has_request_fields = any(key in mapping for key in SUMMARY_REQUEST_INPUT_KEYS)
        nested = _coerce_mapping(mapping.get("summary_request") or mapping.get("summaryRequest"))
        if direct_has_request_fields:
            candidate = mapping
        elif nested:
            candidate = nested
        else:
            extra = _coerce_mapping(mapping.get("extra"))
            extra_direct_has_request_fields = any(key in extra for key in SUMMARY_REQUEST_INPUT_KEYS)
            nested_extra = _coerce_mapping(extra.get("summary_request") or extra.get("summaryRequest"))
            if extra_direct_has_request_fields:
                candidate = extra
            elif nested_extra:
                candidate = nested_extra

    if not candidate:
        normalized = normalize_rag_context(context)
        if normalized and isinstance(normalized.extra, dict):
            extra = dict(normalized.extra)
            if any(key in extra for key in SUMMARY_REQUEST_INPUT_KEYS):
                candidate = extra
            else:
                candidate = _coerce_mapping(extra.get("summary_request") or extra.get("summaryRequest"))

    return candidate

def _resolve_script_segment_who(speaker_fields: dict[str, Any]) -> str | None:
    for key in ("speaker_display_name", "participant_name", "speaker_label", "speaker_id", "speaker"):
        value = _normalize_segment_text(speaker_fields.get(key))
        if value and value.lower() not in {"none", "null", "unknown"}:
            return value
    return None

def _build_script_segment(
    *,
    index: int,
    text: Any = "",
    masked_text: Any | None = None,
    speaker: Any | None = None,
    speaker_id: Any | None = None,
    speaker_label: Any | None = None,
    participant_name: Any | None = None,
    speaker_display_name: Any | None = None,
    speaker_kind: Any | None = None,
    is_mapped: Any | None = None,
    start_seconds: Any | None = None,
    end_seconds: Any | None = None,
    duration_seconds: Any | None = None,
    confidence: Any | None = None,
    chunk_index: Any | None = None,
    chunk_local_index: Any | None = None,
    model_name: Any | None = None,
    chunk_difficulty: Any | None = None,
    source: str = "text",
    segment_label: Any | None = None,
    file_index: Any | None = None,
    file_path: Any | None = None,
    file_name: Any | None = None,
) -> dict[str, Any]:
    speaker_fields = _build_speaker_fields(
        speaker,
        speaker_id,
        speaker_label,
        participant_name=participant_name,
        speaker_display_name=speaker_display_name,
        speaker_kind=speaker_kind,
        is_mapped=is_mapped,
    )
    normalized_text = _normalize_segment_text(text)
    normalized_masked_text = _normalize_segment_text(masked_text if masked_text is not None else normalized_text)
    who = _resolve_script_segment_who(speaker_fields)
    when = _format_mmss(start_seconds)
    return {
        "contract_version": SCRIPT_SEGMENT_CONTRACT_VERSION,
        "index": index,
        "file_index": file_index,
        "file_path": file_path,
        "file_name": file_name,
        "segment_label": segment_label,
        "who": who,
        "when": when,
        "what": normalized_masked_text or normalized_text,
        "chunk_index": chunk_index,
        "chunk_local_index": chunk_local_index,
        "speaker": speaker_fields["speaker"],
        "speaker_id": speaker_fields["speaker_id"],
        "speaker_label": speaker_fields["speaker_label"],
        "participant_name": speaker_fields["participant_name"],
        "speaker_display_name": speaker_fields["speaker_display_name"],
        "speaker_kind": speaker_fields["speaker_kind"],
        "is_mapped": speaker_fields["is_mapped"],
        "start_seconds": start_seconds,
        "end_seconds": end_seconds,
        "duration_seconds": duration_seconds,
        "confidence": confidence,
        "text": normalized_text,
        "masked_text": normalized_masked_text,
        "model_name": model_name,
        "chunk_difficulty": chunk_difficulty,
        "source": source,
    }

def _build_tx_rows(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for index, segment in enumerate(segments):
        normalized = _build_script_segment(
            index=segment.get("index", index),
            text=segment.get("text", ""),
            masked_text=segment.get("masked_text"),
            speaker=segment.get("speaker"),
            speaker_id=segment.get("speaker_id"),
            speaker_label=segment.get("speaker_label"),
            participant_name=segment.get("participant_name"),
            speaker_display_name=segment.get("speaker_display_name"),
            speaker_kind=segment.get("speaker_kind"),
            is_mapped=segment.get("is_mapped"),
            start_seconds=segment.get("start_seconds"),
            confidence=segment.get("confidence"),
            source=segment.get("source", "text"),
            segment_label=segment.get("segment_label"),
            chunk_index=segment.get("chunk_index"),
            chunk_local_index=segment.get("chunk_local_index"),
            model_name=segment.get("model_name"),
            chunk_difficulty=segment.get("chunk_difficulty"),
            file_index=segment.get("file_index"),
            file_path=segment.get("file_path"),
            file_name=segment.get("file_name"),
        )
        rows.append(
            {
                "contract_version": TX_ROW_CONTRACT_VERSION,
                "time": _format_mmss(normalized["start_seconds"]),
                "when": normalized["when"],
                "ts": int(round(float(normalized["start_seconds"]))) if normalized["start_seconds"] is not None else None,
                "spk": normalized["speaker"],
                "who": normalized["who"],
                "speaker_id": normalized["speaker_id"],
                "speaker_label": normalized["speaker_label"],
                "participant_name": normalized["participant_name"],
                "speaker_display_name": normalized["speaker_display_name"],
                "speaker_kind": normalized["speaker_kind"],
                "is_mapped": normalized["is_mapped"],
                "segment_label": normalized["segment_label"],
                "what": normalized["what"] or normalized["masked_text"] or normalized["text"] or "",
                "txt": normalized["what"] or normalized["masked_text"] or normalized["text"] or "",
                "confidence": normalized["confidence"],
                "source": normalized["source"],
                "index": normalized["index"],
            }
        )
    return rows

def _build_script_segments(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for index, segment in enumerate(segments):
        rows.append(
            _build_script_segment(
                index=segment.get("index", index),
                text=segment.get("text", ""),
                masked_text=segment.get("masked_text", segment.get("text", "")),
                speaker=segment.get("speaker"),
                speaker_id=segment.get("speaker_id"),
                speaker_label=segment.get("speaker_label"),
                participant_name=segment.get("participant_name"),
                speaker_display_name=segment.get("speaker_display_name"),
                speaker_kind=segment.get("speaker_kind"),
                is_mapped=segment.get("is_mapped"),
                start_seconds=segment.get("start_seconds"),
                end_seconds=segment.get("end_seconds"),
                duration_seconds=segment.get("duration_seconds"),
                confidence=segment.get("confidence"),
                chunk_index=segment.get("chunk_index"),
                chunk_local_index=segment.get("chunk_local_index"),
                model_name=segment.get("model_name"),
                chunk_difficulty=segment.get("chunk_difficulty"),
                source=segment.get("source", "audio_chunk"),
                segment_label=segment.get("segment_label"),
                file_index=segment.get("file_index"),
                file_path=segment.get("file_path"),
                file_name=segment.get("file_name"),
            )
        )
    return rows

def _build_speaker_fields(
    speaker: Any,
    speaker_id: Any | None = None,
    speaker_label: Any | None = None,
    participant_name: Any | None = None,
    speaker_display_name: Any | None = None,
    speaker_kind: Any | None = None,
    is_mapped: Any | None = None,
) -> dict[str, Any]:
    normalized_speaker = _normalize_segment_text(speaker)
    normalized_speaker_id = _normalize_segment_text(speaker_id)
    normalized_speaker_label = _normalize_segment_text(speaker_label)
    normalized_participant_name = _normalize_segment_text(participant_name)
    normalized_speaker_display_name = _normalize_segment_text(speaker_display_name)
    normalized_speaker_kind = _normalize_segment_text(speaker_kind)

    if normalized_speaker.lower() in {"none", "null", "unknown"}:
        normalized_speaker = ""
    if normalized_speaker_id.lower() in {"none", "null", "unknown"}:
        normalized_speaker_id = ""
    if normalized_speaker_label.lower() in {"none", "null", "unknown"}:
        normalized_speaker_label = ""
    if normalized_participant_name.lower() in {"none", "null", "unknown"}:
        normalized_participant_name = ""
    if normalized_speaker_display_name.lower() in {"none", "null", "unknown"}:
        normalized_speaker_display_name = ""

    canonical_speaker = normalized_speaker or normalized_speaker_id or normalized_speaker_label or None
    if canonical_speaker is None:
        return {
            "speaker": None,
            "speaker_id": None,
            "speaker_label": None,
            "participant_name": None,
            "speaker_display_name": None,
            "speaker_kind": normalized_speaker_kind or "unknown",
            "is_mapped": bool(is_mapped) if is_mapped is not None else False,
        }

    display_name = (
        normalized_participant_name
        or normalized_speaker_display_name
        or normalized_speaker_label
        or canonical_speaker
    )
    resolved_kind = normalized_speaker_kind or ("participant" if normalized_participant_name else "generic")
    mapped = bool(is_mapped) if is_mapped is not None else bool(normalized_participant_name)

    return {
        "speaker": canonical_speaker,
        "speaker_id": normalized_speaker_id or canonical_speaker,
        "speaker_label": normalized_speaker_label or canonical_speaker,
        "participant_name": normalized_participant_name or None,
        "speaker_display_name": display_name or None,
        "speaker_kind": resolved_kind,
        "is_mapped": mapped,
    }

def _join_search_parts(*parts: Any) -> str:
    values: list[str] = []
    seen: set[str] = set()
    for part in parts:
        if part is None:
            continue
        if isinstance(part, (list, tuple, set)):
            candidates = part
        else:
            candidates = (part,)
        for candidate in candidates:
            text = _normalize_segment_text(candidate)
            if not text:
                continue
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            values.append(text)
    return " | ".join(values)


def _build_ai_input_chunks(
    segments: list[dict[str, Any]],
    *,
    chunk_kind: str = "segment",
) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    for index, segment in enumerate(segments):
        speaker_fields = _build_speaker_fields(
            segment.get("speaker"),
            segment.get("speaker_id"),
            segment.get("speaker_label"),
            participant_name=segment.get("participant_name"),
            speaker_display_name=segment.get("speaker_display_name"),
            speaker_kind=segment.get("speaker_kind"),
            is_mapped=segment.get("is_mapped"),
        )
        text = _normalize_segment_text(segment.get("text"))
        masked_text = _normalize_segment_text(segment.get("masked_text") or text)
        chunks.append(
            AIInputChunk(
                index=segment.get("index", index),
                chunk_kind=segment.get("chunk_kind", chunk_kind),
                title=segment.get("segment_label") or segment.get("title"),
                text=text,
                masked_text=masked_text,
                page_number=segment.get("page_number"),
                paragraph_index=segment.get("paragraph_index"),
                start_seconds=segment.get("start_seconds"),
                end_seconds=segment.get("end_seconds"),
                duration_seconds=segment.get("duration_seconds"),
                speaker=speaker_fields["speaker"],
                speaker_id=speaker_fields["speaker_id"],
                speaker_label=speaker_fields["speaker_label"],
                speaker_display_name=speaker_fields["speaker_display_name"],
                speaker_kind=speaker_fields["speaker_kind"],
                is_mapped=speaker_fields["is_mapped"],
                metadata={
                    key: value
                    for key, value in {
                        "source": segment.get("source"),
                        "segment_label": segment.get("segment_label"),
                        "chunk_index": segment.get("chunk_index"),
                        "chunk_local_index": segment.get("chunk_local_index"),
                        "model_name": segment.get("model_name"),
                        "chunk_difficulty": segment.get("chunk_difficulty"),
                        "file_index": segment.get("file_index"),
                        "file_path": segment.get("file_path"),
                        "file_name": segment.get("file_name"),
                        "confidence": segment.get("confidence"),
                    }.items()
                    if value not in (None, "", [], {}, ())
                },
            ).model_dump()
        )
    return chunks


def _build_ai_input_contract(
    *,
    source_kind: str,
    source_text: str,
    masked_source_text: str,
    segments: list[dict[str, Any]],
    context_snapshot: dict[str, Any] | None = None,
    source_name: str | None = None,
    source_path: str | None = None,
    source_title: str | None = None,
    metadata: dict[str, Any] | None = None,
    chunk_kind: str = "segment",
) -> dict[str, Any]:
    normalized_source_kind = _normalize_segment_text(source_kind) or "text"
    chunks = _build_ai_input_chunks(segments, chunk_kind=chunk_kind)
    contract = build_ai_input_contract(
        contract_version=AI_INPUT_CONTRACT_VERSION,
        source_kind=normalized_source_kind,
        source_name=source_name,
        source_path=source_path,
        source_title=source_title,
        source_text=source_text,
        masked_source_text=masked_source_text,
        chunks=chunks,
        context=dict(context_snapshot or {}),
        metadata={
            key: value
            for key, value in {
                "segment_count": len(chunks),
                "chunk_kind": chunk_kind,
                **(metadata or {}),
            }.items()
            if value not in (None, "", [], {}, ())
        },
    )
    return contract.model_dump()


def _build_summary_request_contract(context: Any | None) -> dict[str, Any] | None:
    candidate = _extract_summary_request_candidate(context)
    if not candidate:
        return None

    focus = _normalize_segment_text(candidate.get("focus") or candidate.get("topic"))
    prompt = _normalize_segment_text(
        candidate.get("prompt") or candidate.get("instruction") or candidate.get("query")
    )
    length = _normalize_segment_text(
        candidate.get("length") or candidate.get("len") or candidate.get("summary_length")
    )
    length = _normalize_summary_request_length(length)

    if not any((focus, prompt, length)):
        return None

    return {
        "contract_version": SUMMARY_REQUEST_CONTRACT_VERSION,
        "focus": focus or None,
        "prompt": prompt or None,
        "length": length or None,
        "target_fields": _normalize_summary_request_target_fields(candidate.get("target_fields")),
    }


def _compact_search_document_context(search_document: Any | None) -> dict[str, Any]:
    if not isinstance(search_document, dict):
        return {}

    compact: dict[str, Any] = {}
    meeting_title = _normalize_segment_text(search_document.get("meeting_title"))
    project_name = _normalize_segment_text(search_document.get("project_name"))
    source_kind = _normalize_segment_text(search_document.get("source_kind"))
    source_name = _normalize_segment_text(search_document.get("source_name"))
    source_path = _normalize_segment_text(search_document.get("source_path"))
    source_title = _normalize_segment_text(search_document.get("source_title"))
    summary = _normalize_segment_text(search_document.get("summary"))
    keywords = [
        _normalize_segment_text(item.get("text") if isinstance(item, dict) else item)
        for item in search_document.get("keywords", [])
        if _normalize_segment_text(item.get("text") if isinstance(item, dict) else item)
    ]
    decisions = [
        _normalize_segment_text(item)
        for item in search_document.get("decisions", [])
        if _normalize_segment_text(item)
    ]
    action_items = []
    for item in search_document.get("action_items", []):
        if not isinstance(item, dict):
            continue
        title = _normalize_segment_text(item.get("title"))
        description = _normalize_segment_text(item.get("description"))
        assignee = _normalize_segment_text(item.get("assignee")) or item.get("assignee")
        due_at = _normalize_segment_text(item.get("due_at")) or item.get("due_at")
        row = " | ".join(part for part in [title, description, assignee, due_at] if part)
        if row:
            action_items.append(row)
    issues = [
        _normalize_segment_text(item.get("text") if isinstance(item, dict) else item)
        for item in search_document.get("issues", [])
        if _normalize_segment_text(item.get("text") if isinstance(item, dict) else item)
    ]
    next_agenda = [
        _normalize_segment_text(item)
        for item in search_document.get("next_agenda", [])
        if _normalize_segment_text(item)
    ]
    sections = []
    for section in search_document.get("sections", []):
        if not isinstance(section, dict):
            continue
        section_type = _normalize_segment_text(section.get("section_type") or section.get("title"))
        section_title = _normalize_segment_text(section.get("title"))
        section_text = _normalize_segment_text(section.get("text"))
        if not section_text:
            continue
        header = section_title or section_type or "section"
        sections.append(f"{header}: {shorten(section_text, width=240, placeholder='...')}")
    indexable_text = _normalize_segment_text(search_document.get("indexable_text") or search_document.get("search_text"))
    if meeting_title:
        compact["meeting_title"] = meeting_title
    if project_name:
        compact["project_name"] = project_name
    if source_kind:
        compact["source_kind"] = source_kind
    if source_name:
        compact["source_name"] = source_name
    if source_path:
        compact["source_path"] = source_path
    if source_title:
        compact["source_title"] = source_title
    if summary:
        compact["search_document_summary"] = summary
    if keywords:
        compact["search_document_keywords"] = keywords[:12]
    if decisions:
        compact["search_document_decisions"] = decisions[:12]
    if action_items:
        compact["search_document_action_items"] = action_items[:12]
    if issues:
        compact["search_document_issues"] = issues[:12]
    if next_agenda:
        compact["search_document_next_agenda"] = next_agenda[:12]
    if sections:
        compact["search_document_sections"] = sections[:12]
    if indexable_text:
        compact["search_document_indexable_text"] = shorten(indexable_text, width=600, placeholder="...")
    retrieval_context = search_document.get("retrieval_context") if isinstance(search_document.get("retrieval_context"), dict) else {}
    rag_context = search_document.get("rag_context") if isinstance(search_document.get("rag_context"), dict) else {}
    for source in (retrieval_context, rag_context):
        for key, value in source.items():
            if value not in (None, "", [], {}, ()):
                compact.setdefault(key, value)
    return compact


def _build_summary_regeneration_rag_context(
    *,
    transcript: str,
    summary_request: dict[str, Any] | None = None,
    search_document: dict[str, Any] | None = None,
    rag_context: Any | None = None,
) -> dict[str, Any]:
    context_snapshot = _build_context_snapshot(rag_context) or {}
    snapshot = dict(context_snapshot)

    base_extra = dict(snapshot.get("extra") or {})
    if search_document:
        compact = _compact_search_document_context(search_document)
        for key, value in compact.items():
            if key in {"meeting_title", "project_name", "source_kind", "source_name", "source_path", "source_title"}:
                snapshot.setdefault(key, value)
            else:
                base_extra[key] = value
        if not snapshot.get("meeting_title"):
            meeting_title = _normalize_segment_text(search_document.get("meeting_title"))
            if meeting_title:
                snapshot["meeting_title"] = meeting_title

    if summary_request:
        normalized_summary_request = _build_summary_request_contract(summary_request)
        focus = _normalize_segment_text((normalized_summary_request or {}).get("focus"))
        prompt = _normalize_segment_text((normalized_summary_request or {}).get("prompt"))
        length = _normalize_segment_text((normalized_summary_request or {}).get("length"))
        if focus:
            existing_focus = list(snapshot.get("analysis_focus") or [])
            if focus not in existing_focus:
                existing_focus.insert(0, focus)
            snapshot["analysis_focus"] = existing_focus[:3]
            base_extra["summary_request_focus"] = focus
        if prompt:
            base_extra["summary_request_prompt"] = prompt
        if length:
            base_extra["summary_request_length"] = length
        if normalized_summary_request:
            base_extra["summary_request"] = normalized_summary_request

    if transcript:
        base_extra.setdefault("source_excerpt", shorten(_normalize_segment_text(transcript), width=240, placeholder="..."))

    if base_extra:
        snapshot["extra"] = base_extra

    return {key: value for key, value in snapshot.items() if value not in (None, "", [], {}, ())}

@dataclass(slots=True)
class AIAnalysisPayload:
    meeting_title: str | None
    summary: str
    action_items: list[dict[str, Any]]
    contract_version: str = ANALYSIS_OUTPUT_CONTRACT_VERSION
    keywords: list[dict[str, Any]] = field(default_factory=list)
    decisions: list[str] = field(default_factory=list)
    actions: list[dict[str, Any]] = field(default_factory=list)
    issues: list[dict[str, Any]] = field(default_factory=list)
    next_agenda: list[str] = field(default_factory=list)
    evidence: list[dict[str, Any]] = field(default_factory=list)
    model_name: str | None = None
    prompt_version: str | None = None
    summary_request: dict[str, Any] | None = None
    search_document: dict[str, Any] | None = None
    document_summary: dict[str, Any] | None = None
    extra_data: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        actions = self.actions or [self._action_item_to_action(item) for item in self.action_items]
        return {
            "contract_version": self.contract_version,
            "meeting_title": self.meeting_title,
            "summary": self.summary,
            "keywords": self.keywords,
            "decisions": self.decisions,
            "action_items": self.action_items,
            "actions": actions,
            "issues": self.issues,
            "next_agenda": self.next_agenda,
            "evidence": self.evidence,
            "model_name": self.model_name,
            "prompt_version": self.prompt_version,
            "summary_request": self.summary_request,
            "search_document": self.search_document,
            "document_summary": self.document_summary,
            "extra_data": self.extra_data,
        }

    @staticmethod
    def _action_item_to_action(item: dict[str, Any]) -> dict[str, Any]:
        return {
            "text": str(item.get("title", "")).strip() or str(item.get("description", "")).strip(),
            "assignee": item.get("assignee") or "미정",
            "due": item.get("due_at"),
            "status": item.get("status"),
        }

@dataclass(slots=True)
class AIProcessingResult:
    transcript: str
    masked_transcript: str
    segments: list[dict[str, Any]]
    analysis: AIAnalysisPayload

    def to_dict(self) -> dict[str, Any]:
        analysis = self.analysis.to_dict()
        tx = _build_tx_rows(self.segments)
        summary_request = analysis.get("summary_request")
        search_document = analysis.get("extra_data", {}).get("search_document")
        document_summary = analysis.get("extra_data", {}).get("document_summary")
        return {
            "analysis_contract_version": analysis.get("contract_version", ANALYSIS_OUTPUT_CONTRACT_VERSION),
            "transcript": self.transcript,
            "masked_transcript": self.masked_transcript,
            "segments": self.segments,
            "tx": tx,
            "meeting_minutes": {
                "contract_version": analysis.get("contract_version", ANALYSIS_OUTPUT_CONTRACT_VERSION),
                "meeting_title": analysis.get("meeting_title", ""),
                "summary": analysis.get("summary", ""),
                "keywords": analysis.get("keywords", []),
                "decisions": analysis.get("decisions", []),
                "actions": analysis.get("actions", []),
                "action_items": analysis.get("action_items", []),
                "issues": analysis.get("issues", []),
                "next_agenda": analysis.get("next_agenda", []),
                "search_document": search_document,
                "document_summary": document_summary,
                "summary_request": summary_request,
                "segments": self.segments,
                "tx": tx,
                "evidence": analysis.get("evidence", []),
                "model_name": analysis.get("model_name"),
                "prompt_version": analysis.get("prompt_version"),
                "analysis_contract_version": analysis.get("extra_data", {}).get(
                    "analysis_contract_version",
                    ANALYSIS_OUTPUT_CONTRACT_VERSION,
                ),
                "extra_data": analysis.get("extra_data", {}),
            },
            "analysis": analysis,
        }

@dataclass(slots=True)
class AIFileProcessingResult:
    index: int
    file_path: str
    segment_label: str
    transcript: str
    masked_transcript: str
    audio_preprocessing: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        payload = {
            "index": self.index,
            "file_path": self.file_path,
            "file_name": Path(self.file_path).name,
            "segment_label": self.segment_label,
            "transcript": self.transcript,
            "masked_transcript": self.masked_transcript,
        }
        if self.audio_preprocessing:
            payload["audio_preprocessing"] = self.audio_preprocessing
        return payload

@dataclass(slots=True)
class AIProcessingBatchResult:
    file_count: int
    files: list[AIFileProcessingResult]
    transcript: str
    masked_transcript: str
    segments: list[dict[str, Any]]
    analysis: AIAnalysisPayload

    def to_dict(self) -> dict[str, Any]:
        analysis = self.analysis.to_dict()
        tx = _build_tx_rows(self.segments)
        summary_request = analysis.get("summary_request")
        search_document = analysis.get("extra_data", {}).get("search_document")
        document_summary = analysis.get("extra_data", {}).get("document_summary")
        return {
            "analysis_contract_version": analysis.get("contract_version", ANALYSIS_OUTPUT_CONTRACT_VERSION),
            "file_count": self.file_count,
            "files": [file_result.to_dict() for file_result in self.files],
            "transcript": self.transcript,
            "masked_transcript": self.masked_transcript,
            "segments": self.segments,
            "tx": tx,
            "meeting_minutes": {
                "contract_version": analysis.get("contract_version", ANALYSIS_OUTPUT_CONTRACT_VERSION),
                "meeting_title": analysis.get("meeting_title", ""),
                "summary": analysis.get("summary", ""),
                "keywords": analysis.get("keywords", []),
                "decisions": analysis.get("decisions", []),
                "actions": analysis.get("actions", []),
                "action_items": analysis.get("action_items", []),
                "issues": analysis.get("issues", []),
                "next_agenda": analysis.get("next_agenda", []),
                "search_document": search_document,
                "document_summary": document_summary,
                "summary_request": summary_request,
                "segments": self.segments,
                "tx": tx,
                "evidence": analysis.get("evidence", []),
                "model_name": analysis.get("model_name"),
                "prompt_version": analysis.get("prompt_version"),
                "analysis_contract_version": analysis.get("extra_data", {}).get(
                    "analysis_contract_version",
                    ANALYSIS_OUTPUT_CONTRACT_VERSION,
                ),
                "extra_data": analysis.get("extra_data", {}),
            },
            "analysis": analysis,
        }

def _build_analysis_payload(
    analysis_data: dict[str, Any],
    *,
    evidence: list[dict[str, Any]] | None = None,
    summary_request: dict[str, Any] | None = None,
) -> AIAnalysisPayload:
    action_items = list(analysis_data.get("action_items", []))
    actions = list(analysis_data.get("actions", [])) or [AIAnalysisPayload._action_item_to_action(item) for item in action_items]
    return AIAnalysisPayload(
        meeting_title=str(analysis_data.get("meeting_title", "")) or None,
        summary=str(analysis_data.get("summary", "")),
        action_items=action_items,
        contract_version=str(analysis_data.get("contract_version") or ANALYSIS_OUTPUT_CONTRACT_VERSION),
        keywords=list(analysis_data.get("keywords", [])),
        decisions=list(analysis_data.get("decisions", [])),
        actions=actions,
        issues=list(analysis_data.get("issues", [])),
        next_agenda=list(analysis_data.get("next_agenda", [])),
        evidence=list(evidence or []),
        model_name=analysis_data.get("model_name"),
        prompt_version=analysis_data.get("prompt_version"),
        summary_request=summary_request if summary_request is not None else analysis_data.get("summary_request"),
        extra_data=dict(analysis_data.get("extra_data", {})),
    )


def _attach_analysis_contract_metadata(
    analysis: AIAnalysisPayload,
    *,
    summary_request: dict[str, Any] | None = None,
    search_document: dict[str, Any] | None = None,
) -> None:
    analysis.extra_data["analysis_contract_version"] = ANALYSIS_OUTPUT_CONTRACT_VERSION
    analysis.extra_data["analysis_output_fields"] = list(ANALYSIS_OUTPUT_FIELDS)
    analysis.extra_data["meeting_title"] = analysis.meeting_title
    analysis.extra_data["summary"] = analysis.summary
    analysis.extra_data["keywords"] = list(analysis.keywords)
    analysis.extra_data["decisions"] = list(analysis.decisions)
    analysis.extra_data["action_items"] = list(analysis.action_items)
    analysis.extra_data["issues"] = list(analysis.issues)
    analysis.extra_data["next_agenda"] = list(analysis.next_agenda)
    if summary_request is not None:
        analysis.summary_request = summary_request
    if analysis.summary_request is not None:
        analysis.extra_data["summary_request"] = analysis.summary_request
    if search_document is not None:
        analysis.search_document = search_document
        analysis.extra_data["search_document"] = search_document
    document_summary = analysis.extra_data.get("document_summary")
    if isinstance(document_summary, dict):
        analysis.document_summary = document_summary

def build_project_rag_context(project: dict[str, Any] | None = None, **overrides: Any) -> dict[str, Any]:
    base = {
        "project_name": None,
        "project_key": None,
        "project_category": None,
        "source_kind": None,
        "source_name": None,
        "source_path": None,
        "source_title": None,
        "meeting_title": None,
        "ticket_rules": [],
        "glossary": [],
        "example_tickets": [],
        "preferred_keywords": [],
        "participants": [],
        "admins": [],
        "integration_targets": [],
        "note": None,
        "extra": {},
    }

    if project:
        base["project_name"] = project.get("name") or project.get("project_name")
        base["project_key"] = project.get("key") or project.get("project_key")
        base["project_category"] = project.get("category") or project.get("project_category")
        base["participants"] = project.get("participants") or []
        base["admins"] = project.get("admins") or []
        base["note"] = project.get("customRules") or project.get("note")

    base.update({k: v for k, v in overrides.items() if k in base or k == "extra"})
    normalized = normalize_rag_context(base)
    return normalized.to_dict() if normalized else {}

def _split_sentences(text: str) -> list[str]:
    return [part.strip() for part in SENTENCE_SPLIT_PATTERN.split(text or "") if part.strip()]

def _normalize_segment_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()

def _build_sentence_segments(text: str) -> list[dict[str, Any]]:
    sentences = _split_sentences(text)
    segments: list[dict[str, Any]] = []
    for index, sentence in enumerate(sentences):
        segments.append(
            _build_script_segment(
                index=index,
                text=sentence,
                masked_text=sentence,
                source="text",
                segment_label=f"[SEGMENT {index + 1}]",
            )
        )
    return segments

def _build_context_snapshot(context: Any | None) -> dict[str, Any] | None:
    normalized = normalize_rag_context(context)
    if not normalized:
        return None

    return normalized.to_search_context()


def _ensure_search_source_metadata(
    context_snapshot: dict[str, Any] | None,
    *,
    source_kind: str,
    source_name: str | None = None,
    source_path: str | None = None,
    source_title: str | None = None,
) -> dict[str, Any]:
    snapshot = dict(context_snapshot or {})
    snapshot.setdefault("source_kind", source_kind)
    if source_name:
        snapshot.setdefault("source_name", source_name)
    if source_path:
        snapshot.setdefault("source_path", source_path)
    if source_title:
        snapshot.setdefault("source_title", source_title)
    return {key: value for key, value in snapshot.items() if value not in (None, "", [], {}, ())}


def _merge_participants(*sources: Any) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for source in sources:
        if not isinstance(source, (list, tuple, set)):
            continue
        for item in source:
            text = str(item or "").strip()
            if not text or text in seen:
                continue
            seen.add(text)
            merged.append(text)
    return merged


def _build_document_analysis_context(document: Any, rag_context: Any | None = None) -> dict[str, Any]:
    document_extraction = {
        "source_path": getattr(document, "source_path", None),
        "source_name": getattr(document, "source_name", None),
        "source_kind": getattr(document, "source_kind", None),
        "extraction_method": getattr(document, "extraction_method", None),
        "page_count": getattr(document, "page_count", None),
        "chunk_count": len(getattr(document, "chunks", []) or []),
    }

    if isinstance(rag_context, dict):
        analysis_context = dict(rag_context)
    else:
        normalized_context = normalize_rag_context(rag_context)
        analysis_context = normalized_context.to_dict() if normalized_context else {}

    document_participants = getattr(document, "metadata", {}).get("participants") if getattr(document, "metadata", None) else None
    merged_participants = _merge_participants(analysis_context.get("participants"), document_participants)

    extra = dict(analysis_context.get("extra") or {})
    extra.update(
        {
            "source_kind": "document",
            "source_title": getattr(document, "metadata", {}).get("source_title") if getattr(document, "metadata", None) else None,
            "source_name": getattr(document, "source_name", None),
            "source_path": getattr(document, "source_path", None),
            "participants": merged_participants,
            "document_extraction": document_extraction,
        }
    )
    extra = {key: value for key, value in extra.items() if value not in (None, "", [], {}, ())}

    analysis_context["source_kind"] = "document"
    analysis_context["source_title"] = getattr(document, "metadata", {}).get("source_title") if getattr(document, "metadata", None) else None
    analysis_context["source_name"] = getattr(document, "source_name", None)
    analysis_context["source_path"] = getattr(document, "source_path", None)
    analysis_context["participants"] = merged_participants
    analysis_context["document_extraction"] = document_extraction
    if extra:
        analysis_context["extra"] = extra
    return analysis_context


def _build_search_retrieval_context(
    *,
    context_snapshot: dict[str, Any] | None,
    analysis_data: dict[str, Any],
    sections: list[dict[str, Any]],
    chunks: list[dict[str, Any]],
    indexable_text: str,
) -> dict[str, Any]:
    section_types = []
    for section in sections:
        if not isinstance(section, dict):
            continue
        section_type = _normalize_segment_text(section.get("section_type") or section.get("title"))
        if section_type:
            section_types.append(section_type)

    retrieval_context: dict[str, Any] = {
        "contract_version": "v2",
        "source_kind": _normalize_segment_text(context_snapshot.get("source_kind")) if context_snapshot else None,
        "source_name": _normalize_segment_text(context_snapshot.get("source_name")) if context_snapshot else None,
        "source_path": _normalize_segment_text(context_snapshot.get("source_path")) if context_snapshot else None,
        "source_title": _normalize_segment_text(context_snapshot.get("source_title")) if context_snapshot else None,
        "meeting_title": _normalize_segment_text(context_snapshot.get("meeting_title"))
        if context_snapshot
        else _normalize_segment_text(analysis_data.get("meeting_title")) or None,
        "project_name": _normalize_segment_text(context_snapshot.get("project_name")) if context_snapshot else None,
        "section_types": list(dict.fromkeys(section_types)),
        "section_count": len(sections),
        "chunk_count": len(chunks),
        "keyword_count": len(analysis_data.get("keywords", []) or []),
        "decision_count": len(analysis_data.get("decisions", []) or []),
        "action_item_count": len(analysis_data.get("action_items", []) or []),
        "issue_count": len(analysis_data.get("issues", []) or []),
        "next_agenda_count": len(analysis_data.get("next_agenda", []) or []),
        "indexed_fields": [
            "meeting_title",
            "project_name",
            "summary",
            "keywords",
            "decisions",
            "action_items",
            "issues",
            "next_agenda",
            "sections",
            "chunks",
            "indexable_text",
        ],
        "searchable_text_preview": shorten(_normalize_segment_text(indexable_text), width=300, placeholder="...") if indexable_text else "",
    }
    return {key: value for key, value in retrieval_context.items() if value not in (None, "", [], {}, ())}

def _build_meeting_search_document(
    *,
    transcript: str,
    masked_transcript: str,
    analysis_data: dict[str, Any],
    segments: list[dict[str, Any]],
    context_snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    keyword_items = list(analysis_data.get("keywords", []))
    keywords = [
        _normalize_segment_text(item.get("text"))
        for item in keyword_items
        if isinstance(item, dict) and _normalize_segment_text(item.get("text"))
    ]
    decisions = [
        _normalize_segment_text(item)
        for item in analysis_data.get("decisions", [])
        if _normalize_segment_text(item)
    ]
    action_items = []
    for item in analysis_data.get("action_items", []):
        if not isinstance(item, dict):
            continue
        normalized_item = {
            "title": _normalize_segment_text(item.get("title")),
            "description": _normalize_segment_text(item.get("description")),
            "priority": item.get("priority"),
            "assignee": _normalize_segment_text(item.get("assignee")) or item.get("assignee"),
            "due_at": item.get("due_at"),
            "status": item.get("status"),
        }
        if normalized_item["title"] or normalized_item["description"]:
            action_items.append(normalized_item)
    issues = [
        _normalize_segment_text(item.get("text") if isinstance(item, dict) else item)
        for item in analysis_data.get("issues", [])
        if _normalize_segment_text(item.get("text") if isinstance(item, dict) else item)
    ]
    next_agenda = [
        _normalize_segment_text(item)
        for item in analysis_data.get("next_agenda", [])
        if _normalize_segment_text(item)
    ]
    sections = _build_search_sections(
        transcript=transcript,
        masked_transcript=masked_transcript,
        summary=_normalize_segment_text(analysis_data.get("summary")),
        keywords=keywords,
        keyword_items=keyword_items,
        decisions=decisions,
        action_items=action_items,
        issues=issues,
        next_agenda=next_agenda,
    )

    search_chunks: list[dict[str, Any]] = []
    for index, segment in enumerate(segments):
        speaker_fields = _build_speaker_fields(
            segment.get("speaker"),
            segment.get("speaker_id"),
            segment.get("speaker_label"),
            participant_name=segment.get("participant_name"),
            speaker_display_name=segment.get("speaker_display_name"),
            speaker_kind=segment.get("speaker_kind"),
            is_mapped=segment.get("is_mapped"),
        )
        chunk_text = _normalize_segment_text(segment.get("masked_text") or segment.get("text"))
        if not chunk_text:
            continue
        chunk = MeetingSearchChunk(
            chunk_index=segment.get("chunk_index", index),
            chunk_local_index=segment.get("chunk_local_index"),
            speaker=speaker_fields["speaker"],
            speaker_id=speaker_fields["speaker_id"],
            speaker_label=speaker_fields["speaker_label"],
            participant_name=speaker_fields["participant_name"],
            speaker_display_name=speaker_fields["speaker_display_name"],
            speaker_kind=speaker_fields["speaker_kind"],
            is_mapped=speaker_fields["is_mapped"],
            start_seconds=segment.get("start_seconds"),
            end_seconds=segment.get("end_seconds"),
            duration_seconds=segment.get("duration_seconds"),
            model_name=segment.get("model_name"),
            chunk_difficulty=segment.get("chunk_difficulty"),
            text=_normalize_segment_text(segment.get("text")),
            masked_text=chunk_text,
            search_text=_join_search_parts(
                speaker_fields["speaker_display_name"] or speaker_fields["speaker_label"] or speaker_fields["speaker_id"] or speaker_fields["speaker"],
                chunk_text,
            ),
        )
        search_chunks.append(chunk.model_dump())

    title = None
    project_name = None
    rag_context_contract: dict[str, Any] = {}
    if context_snapshot:
        title = _normalize_segment_text(context_snapshot.get("meeting_title")) or None
        project_name = _normalize_segment_text(context_snapshot.get("project_name")) or None
        rag_context_contract = {
            key: value
            for key, value in context_snapshot.items()
            if value not in (None, "", [], {}, ())
        }
    if not title:
        title = _normalize_segment_text(analysis_data.get("meeting_title")) or None

    indexable_text = _join_search_parts(
        title,
        project_name,
        [section["text"] for section in sections if section.get("text")],
        [chunk["search_text"] for chunk in search_chunks],
        transcript,
        masked_transcript,
    )

    search_retrieval_context = _build_search_retrieval_context(
        context_snapshot=context_snapshot,
        analysis_data=analysis_data,
        sections=sections,
        chunks=search_chunks,
        indexable_text=indexable_text,
    )

    document = MeetingSearchDocument(
        version="v2",
        contract_version="v2",
        source_text=transcript,
        masked_source_text=masked_transcript,
        meeting_title=title,
        project_name=project_name,
        source_kind=_normalize_segment_text(context_snapshot.get("source_kind")) if context_snapshot else None,
        source_name=_normalize_segment_text(context_snapshot.get("source_name")) if context_snapshot else None,
        source_path=_normalize_segment_text(context_snapshot.get("source_path")) if context_snapshot else None,
        source_title=_normalize_segment_text(context_snapshot.get("source_title")) if context_snapshot else None,
        summary=_normalize_segment_text(analysis_data.get("summary")),
        keywords=keywords,
        keyword_items=keyword_items,
        decisions=decisions,
        action_items=action_items,
        issues=issues,
        next_agenda=next_agenda,
        sections=sections,
        chunks=search_chunks,
        indexable_text=indexable_text,
        indexed_text=indexable_text,
        search_text=indexable_text,
        retrieval_context=search_retrieval_context,
        rag_context=rag_context_contract,
    )
    return document.model_dump()


def _build_search_sections(
    *,
    transcript: str,
    masked_transcript: str,
    summary: str,
    keywords: list[str],
    keyword_items: list[dict[str, Any]],
    decisions: list[str],
    action_items: list[dict[str, Any]],
    issues: list[str],
    next_agenda: list[str],
) -> list[dict[str, Any]]:
    sections: list[MeetingSearchSection] = []

    if summary:
        sections.append(MeetingSearchSection(section_type="summary", title="요약", text=summary, weight=1.0))
    if keywords:
        sections.append(
            MeetingSearchSection(
                section_type="keywords",
                title="키워드",
                text=_join_search_parts([item.get("text", "") for item in keyword_items], keywords),
                weight=0.8,
            )
        )
    for index, decision in enumerate(decisions):
        if decision:
            sections.append(
                MeetingSearchSection(
                    section_type="decision",
                    title="결정사항",
                    text=decision,
                    weight=0.95,
                )
            )
    for index, item in enumerate(action_items):
        title = _normalize_segment_text(item.get("title"))
        description = _normalize_segment_text(item.get("description"))
        if title or description:
            sections.append(
                MeetingSearchSection(
                    section_type="action_item",
                    title=title or "해야 할 일",
                    text=_join_search_parts(title, description),
                    weight=1.0,
                )
            )
    for issue in issues:
        if issue:
            sections.append(
                MeetingSearchSection(
                    section_type="issue",
                    title="이슈",
                    text=issue,
                    weight=0.85,
                )
            )
    for agenda in next_agenda:
        if agenda:
            sections.append(
                MeetingSearchSection(
                    section_type="next_agenda",
                    title="다음 안건",
                    text=agenda,
                    weight=0.75,
                )
            )

    transcript_text = _join_search_parts(masked_transcript, transcript)
    if transcript_text:
        sections.append(
            MeetingSearchSection(
                section_type="transcript",
                title="본문",
                text=transcript_text,
                weight=0.6,
            )
        )

    return [section.model_dump() for section in sections]

def _build_script_contract(
    *,
    transcript: str,
    masked_transcript: str,
    analysis_data: dict[str, Any],
    segments: list[dict[str, Any]],
    context_snapshot: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    script_segments = _build_script_segments(segments)
    tx_rows = _build_tx_rows(script_segments)
    search_document = _build_meeting_search_document(
        transcript=transcript,
        masked_transcript=masked_transcript,
        analysis_data=analysis_data,
        segments=script_segments,
        context_snapshot=context_snapshot,
    )
    return script_segments, tx_rows, search_document

def _summarize_audio_preprocessing(preprocessing: Any | None) -> dict[str, Any] | None:
    if preprocessing is None:
        return None

    if hasattr(preprocessing, "to_dict"):
        preprocessing_data = preprocessing.to_dict()
    elif isinstance(preprocessing, dict):
        preprocessing_data = dict(preprocessing)
    else:
        return None

    load_metadata = dict(preprocessing_data.get("load_metadata") or {})
    quality_flags = list(preprocessing_data.get("quality_flags") or [])
    summary = {
        "source_path": preprocessing_data.get("source_path"),
        "strategy": preprocessing_data.get("strategy"),
        "sample_rate": preprocessing_data.get("sample_rate"),
        "duration_seconds": preprocessing_data.get("duration_seconds"),
        "chunking_enabled": preprocessing_data.get("chunking_enabled"),
        "chunk_count": preprocessing_data.get("chunk_count"),
        "quality_flags": quality_flags,
        "raw_noisy": bool(load_metadata.get("raw_noisy")),
        "ffmpeg_denoised": bool(load_metadata.get("ffmpeg_denoised")),
        "stationary_noise_suppressed": bool(load_metadata.get("stationary_noise_suppressed")),
        "noisy_recording": bool(load_metadata.get("noisy_recording")),
    }
    return {key: value for key, value in summary.items() if value not in (None, "", [], {}, ())}

def _summarize_stt_routing(segments: list[dict[str, Any]] | None) -> list[dict[str, Any]] | None:
    if not segments:
        return None

    by_chunk: dict[int, dict[str, Any]] = {}
    for segment in segments:
        chunk_index = segment.get("chunk_index")
        if chunk_index is None:
            continue

        try:
            chunk_index_int = int(chunk_index)
        except (TypeError, ValueError):
            continue

        bucket = by_chunk.setdefault(
            chunk_index_int,
            {
                "chunk_index": chunk_index_int,
                "start_seconds": segment.get("start_seconds"),
                "end_seconds": segment.get("end_seconds"),
                "model_name": segment.get("model_name"),
                "chunk_difficulty": segment.get("chunk_difficulty"),
                "segment_count": 0,
            },
        )
        bucket["segment_count"] += 1
        if segment.get("model_name"):
            bucket["model_name"] = segment.get("model_name")
        if segment.get("chunk_difficulty") is not None:
            bucket["chunk_difficulty"] = segment.get("chunk_difficulty")
        if bucket.get("start_seconds") is None or (
            segment.get("start_seconds") is not None and segment.get("start_seconds") < bucket.get("start_seconds")
        ):
            bucket["start_seconds"] = segment.get("start_seconds")
        if bucket.get("end_seconds") is None or (
            segment.get("end_seconds") is not None and segment.get("end_seconds") > bucket.get("end_seconds")
        ):
            bucket["end_seconds"] = segment.get("end_seconds")

    for bucket in by_chunk.values():
        start_seconds = bucket.get("start_seconds")
        end_seconds = bucket.get("end_seconds")
        if start_seconds is not None and end_seconds is not None:
            try:
                bucket["chunk_duration_seconds"] = round(max(0.0, float(end_seconds) - float(start_seconds)), 3)
            except (TypeError, ValueError):
                pass

    routing = [
        {key: value for key, value in item.items() if value not in (None, "", [], {}, ())}
        for item in sorted(by_chunk.values(), key=lambda row: row["chunk_index"])
    ]
    return routing or None


def _merge_audio_files_for_transcription(file_paths: list[str]) -> Path | None:
    if len(file_paths) <= 1:
        return Path(file_paths[0]) if file_paths else None

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return None

    output_handle = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    output_handle.close()
    output_path = Path(output_handle.name)

    command = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error"]
    for file_path in file_paths:
        command.extend(["-i", file_path])
    concat_inputs = "".join(f"[{index}:a]" for index in range(len(file_paths)))
    command.extend(
        [
            "-filter_complex",
            f"{concat_inputs}concat=n={len(file_paths)}:v=0:a=1[out]",
            "-map",
            "[out]",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            str(output_path),
        ]
    )

    try:
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        output_path.unlink(missing_ok=True)
        return None

    return output_path


def _derive_batch_source_title(file_paths: list[str]) -> str | None:
    if not file_paths:
        return None

    stem = Path(file_paths[0]).stem
    stem = re.sub(r"[_\-\s]*\d+$", "", stem).strip(" _-")
    stem = re.sub(r"[_\-]+", " ", stem).strip()
    stem = re.sub(r"\s+", " ", stem).strip()
    return stem or None

def _augment_context_with_audio_quality(context: Any | None, preprocessing: Any | None) -> dict[str, Any] | Any | None:
    audio_summary = _summarize_audio_preprocessing(preprocessing)
    if not audio_summary:
        return context

    normalized = normalize_rag_context(context)
    context_dict = normalized.to_dict() if normalized else {}
    existing_note = context_dict.get("note")
    audio_note_parts = [
        "오디오 품질 메모",
        f"strategy={audio_summary.get('strategy')}",
    ]
    if audio_summary.get("raw_noisy"):
        audio_note_parts.append("raw_noisy=true")
    if audio_summary.get("ffmpeg_denoised"):
        audio_note_parts.append("ffmpeg_denoised=true")
    if audio_summary.get("stationary_noise_suppressed"):
        audio_note_parts.append("stationary_noise_suppressed=true")
    if audio_summary.get("quality_flags"):
        audio_note_parts.append(f"quality_flags={', '.join(audio_summary['quality_flags'])}")

    audio_note = "; ".join(audio_note_parts)
    context_dict["note"] = f"{existing_note} | {audio_note}" if existing_note else audio_note
    extra = dict(context_dict.get("extra") or {})
    extra["audio_preprocessing"] = audio_summary
    context_dict["extra"] = extra
    return context_dict


def _extract_matched_terms(sentence: str, candidates: list[str]) -> list[str]:
    normalized_sentence = sentence.lower()
    matched: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        token = _normalize_segment_text(candidate)
        if len(token) < 2:
            continue

        terms = [term for term in re.split(r"[^\w가-힣]+", token) if len(term) >= 2]
        if len(token) <= 40:
            terms.append(token)

        for term in terms:
            normalized_term = term.lower()
            if normalized_term in seen:
                continue
            if normalized_term and normalized_term in normalized_sentence:
                seen.add(normalized_term)
                matched.append(term)
    return matched

def _build_evidence_items(
    transcript: str,
    analysis_data: dict[str, Any],
    segments: list[dict[str, Any]],
    *,
    context_snapshot: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    evidence: list[dict[str, Any]] = []
    sentences = _split_sentences(transcript)
    if not sentences:
        return evidence

    def pick_best_sentence(candidates: list[str]) -> tuple[int | None, str | None]:
        best_score = 0
        best_index: int | None = None
        best_sentence: str | None = None
        needles = [
            token
            for candidate in candidates
            for token in re.split(r"\s+", _normalize_segment_text(candidate))
            if len(token) >= 2
        ]
        needles = list(dict.fromkeys(needles))
        if not needles:
            return None, None

        for index, sentence in enumerate(sentences):
            normalized_sentence = sentence.lower()
            score = sum(1 for needle in needles if needle.lower() in normalized_sentence)
            if score > best_score:
                best_score = score
                best_index = index
                best_sentence = sentence

        if best_score == 0:
            return None, None
        return best_index, best_sentence

    buckets = [
        ("action_item", list(analysis_data.get("action_items", []))),
        ("decision", list(analysis_data.get("decisions", []))),
        ("issue", list(analysis_data.get("issues", []))),
        ("next_agenda", list(analysis_data.get("next_agenda", []))),
    ]

    for kind, items in buckets:
        for item in items:
            if isinstance(item, dict):
                raw_text = _normalize_segment_text(item.get("title") or item.get("text") or item.get("description"))
                extra_hint = _normalize_segment_text(item.get("description") or item.get("title") or item.get("text"))
                candidates = [raw_text, extra_hint]
            else:
                raw_text = _normalize_segment_text(item)
                candidates = [raw_text]

            index, sentence = pick_best_sentence(candidates)
            if sentence is None:
                continue

            matched_terms = _extract_matched_terms(sentence, candidates)
            segment_ref = None
            if index is not None and index < len(segments):
                segment_ref = segments[index]

            context_used: dict[str, Any] | None = None
            if context_snapshot:
                preferred_keywords = list(context_snapshot.get("preferred_keywords", []) or [])
                analysis_focus = list(context_snapshot.get("analysis_focus", []) or [])
                glossary = list(context_snapshot.get("glossary", []) or [])
                ticket_rules = list(context_snapshot.get("ticket_rules", []) or [])
                matched_context_keywords = [
                    keyword
                    for keyword in preferred_keywords
                    if _normalize_segment_text(keyword).lower() in sentence.lower()
                ]
                context_used = {
                    "project_name": context_snapshot.get("project_name"),
                    "project_key": context_snapshot.get("project_key"),
                    "project_category": context_snapshot.get("project_category"),
                    "matched_preferred_keywords": matched_context_keywords,
                    "analysis_focus": analysis_focus[:3],
                    "glossary": glossary[:5],
                    "ticket_rules": ticket_rules[:5],
                }
                context_used = {
                    key: value
                    for key, value in context_used.items()
                    if value not in (None, "", [], {}, ())
                }
                if not context_used:
                    context_used = None

            evidence.append(
                {
                    "kind": kind,
                    "item": raw_text,
                    "source_sentence": sentence,
                    "matched_terms": matched_terms,
                    "source_excerpt": sentence,
                    "sentence_index": index,
                    "segment_index": segment_ref.get("index") if segment_ref else None,
                    "segment_start_seconds": segment_ref.get("start_seconds") if segment_ref else None,
                    "segment_end_seconds": segment_ref.get("end_seconds") if segment_ref else None,
                    "speaker": segment_ref.get("speaker") if segment_ref else None,
                    "confidence": segment_ref.get("confidence") if segment_ref else None,
                    "context_used": context_used,
                    "source": "transcript_alignment",
                }
            )
            if len(evidence) >= 12:
                return evidence

    return evidence

class AIEngine:
    """Thin orchestration layer for STT, masking, and meeting analysis."""

    def __init__(
        self,
        stt_service: SpeechToTextService | None = None,
        llm_service: LLMAnalysisService | None = None,
        transcription_profile: str | None = None,
    ) -> None:
        self.stt_service = stt_service or WhisperSpeechToTextService(transcription_profile=transcription_profile)
        self.llm_service = llm_service or build_llm_analysis_service()

    def warm_up(self, *, preload_secondary_models: bool = False, preload_diarization: bool = True) -> None:
        """Preload reusable AI models for long-lived server/worker processes."""
        warm_up_stt = getattr(self.stt_service, "warm_up", None)
        if callable(warm_up_stt):
            try:
                warm_up_stt(preload_secondary_models=preload_secondary_models)
            except Exception as exc:  # pragma: no cover - best effort warmup
                logger.warning("STT warm-up failed: %s", exc)

        if preload_diarization:
            get_diarization_service = getattr(self.stt_service, "_get_diarization_service", None)
            if callable(get_diarization_service):
                try:
                    diarization_service = get_diarization_service()
                    warm_up_diarization = getattr(diarization_service, "warm_up", None)
                    if callable(warm_up_diarization):
                        warm_up_diarization()
                except Exception as exc:  # pragma: no cover - best effort warmup
                    logger.warning("Diarization warm-up failed from AIEngine: %s", exc)

    def transcribe_audio(self, file_path: str, *, n_workers: int | None = None) -> str:
        return self.stt_service.transcribe(file_path, n_workers=n_workers)

    def prepare_audio(self, file_path: str) -> dict[str, Any]:
        """Expose chunking metadata for inspection and future diarization work."""
        preprocessing = self.stt_service.prepare_audio(file_path)
        return preprocessing.to_dict()

    def summarize_meeting(self, text: str, rag_context: Any | None = None) -> str:
        analysis = self.llm_service.summarize_and_extract_tickets(mask_personal_information(text), context=rag_context)
        return str(analysis.get("summary", ""))

    def extract_tickets(self, summary: str, rag_context: Any | None = None) -> list[dict[str, Any]]:
        analysis = self.llm_service.summarize_and_extract_tickets(mask_personal_information(summary), context=rag_context)
        return list(analysis.get("action_items", []))

    def process_text(self, text: str, rag_context: Any | None = None) -> AIProcessingResult:
        masked_text = mask_personal_information(text)
        analysis_data = self.llm_service.summarize_and_extract_tickets(masked_text, context=rag_context)
        segments = _build_sentence_segments(masked_text)
        context_snapshot = _build_context_snapshot(rag_context)
        summary_request = _build_summary_request_contract(rag_context)
        ai_input_contract = _build_ai_input_contract(
            source_kind="text",
            source_text=text,
            masked_source_text=masked_text,
            segments=segments,
            context_snapshot=context_snapshot,
            source_title=context_snapshot.get("meeting_title") if context_snapshot else None,
            metadata={"source": "text"},
        )
        evidence = _build_evidence_items(masked_text, analysis_data, segments, context_snapshot=context_snapshot)
        analysis = _build_analysis_payload(analysis_data, evidence=evidence)
        script_segments, tx_rows, search_document = _build_script_contract(
            transcript=text,
            masked_transcript=masked_text,
            analysis_data=analysis_data,
            segments=segments,
            context_snapshot=context_snapshot,
        )
        _attach_analysis_contract_metadata(
            analysis,
            summary_request=summary_request,
            search_document=search_document,
        )
        analysis.extra_data["script_segment_contract_version"] = SCRIPT_SEGMENT_CONTRACT_VERSION
        analysis.extra_data["ai_input_contract_version"] = AI_INPUT_CONTRACT_VERSION
        analysis.extra_data["ai_input_contract"] = ai_input_contract
        analysis.extra_data["script_segments"] = script_segments
        analysis.extra_data["tx"] = tx_rows
        return AIProcessingResult(
            transcript=text,
            masked_transcript=masked_text,
            segments=segments,
            analysis=analysis,
        )

    def regenerate_summary(
        self,
        transcript: str,
        *,
        masked_transcript: str | None = None,
        summary_request: dict[str, Any] | None = None,
        search_document: dict[str, Any] | None = None,
        rag_context: Any | None = None,
    ) -> AIProcessingResult:
        """Regenerate summary using the current transcript and search contract."""
        prompt_context = _build_summary_regeneration_rag_context(
            transcript=transcript,
            summary_request=summary_request,
            search_document=search_document,
            rag_context=rag_context,
        )
        result = self.process_text(transcript, rag_context=prompt_context)
        if summary_request is not None:
            summary_contract = _build_summary_request_contract({"summary_request": summary_request})
            if summary_contract is not None:
                result.analysis.summary_request = summary_contract
                result.analysis.extra_data["summary_request"] = summary_contract
                result.analysis.extra_data["summary_request_contract"] = summary_contract
        if masked_transcript:
            result.masked_transcript = masked_transcript
        return result

    def process_document(self, file_path: str, rag_context: Any | None = None, source_name: str | None = None) -> AIProcessingResult:
        document = load_document_file(file_path)
        if source_name:
            document.source_name = source_name
            source_title = Path(source_name).stem.strip()
            if source_title:
                document.metadata["source_title"] = source_title
        document.masked_text = mask_personal_information(document.text)
        analysis_context = _build_document_analysis_context(document, rag_context)
        context_snapshot = _build_context_snapshot(analysis_context)
        if context_snapshot is None:
            context_snapshot = {}
        if not context_snapshot.get("meeting_title"):
            context_snapshot["meeting_title"] = document.metadata.get("source_title") or document.source_name
        summary_request = _build_summary_request_contract(rag_context)
        analysis_data = self.llm_service.summarize_and_extract_tickets(document.masked_text, context=analysis_context)
        segments = _build_sentence_segments(document.masked_text)
        ai_input_contract = document.to_ai_input_contract()
        evidence = _build_evidence_items(document.masked_text, analysis_data, segments, context_snapshot=context_snapshot)
        analysis = _build_analysis_payload(analysis_data, evidence=evidence, summary_request=summary_request)
        analysis.extra_data["document_extraction"] = {
            "source_path": document.source_path,
            "source_name": document.source_name,
            "source_kind": document.source_kind,
            "extraction_method": document.extraction_method,
            "page_count": document.page_count,
            "chunk_count": len(document.chunks),
            "source_title": document.metadata.get("source_title"),
        }
        script_segments, tx_rows, search_document = _build_script_contract(
            transcript=document.text,
            masked_transcript=document.masked_text,
            analysis_data=analysis_data,
            segments=segments,
            context_snapshot=context_snapshot,
        )
        _attach_analysis_contract_metadata(
            analysis,
            summary_request=summary_request,
            search_document=search_document,
        )
        analysis.extra_data["ai_input_contract_version"] = AI_INPUT_CONTRACT_VERSION
        analysis.extra_data["ai_input_contract"] = ai_input_contract
        analysis.extra_data["script_segment_contract_version"] = SCRIPT_SEGMENT_CONTRACT_VERSION
        analysis.extra_data["script_segments"] = script_segments
        analysis.extra_data["tx"] = tx_rows
        return AIProcessingResult(
            transcript=document.text,
            masked_transcript=document.masked_text,
            segments=segments,
            analysis=analysis,
        )

    def process_audio(
        self,
        file_path: str,
        rag_context: Any | None = None,
        *,
        include_diarization: bool = True,
        n_workers: int | None = None,
    ) -> AIProcessingResult:
        context_snapshot = _build_context_snapshot(rag_context)
        context_snapshot = _ensure_search_source_metadata(
            context_snapshot,
            source_kind="audio",
            source_name=Path(file_path).name,
            source_path=file_path,
            source_title=Path(file_path).stem,
        )
        participant_names = list(context_snapshot.get("participants") or []) if context_snapshot else []
        transcriber = getattr(self.stt_service, "transcribe_with_segments", None)
        if callable(transcriber):
            transcript, raw_segments = transcriber(
                file_path,
                participant_names=participant_names,
                include_diarization=include_diarization,
                n_workers=n_workers,
            )
        else:
            transcript = self.transcribe_audio(file_path, n_workers=n_workers)
            raw_segments = []

        masked_transcript = mask_personal_information(transcript)
        preprocessing = None
        get_last_preprocessing = getattr(self.stt_service, "get_last_preprocessing", None)
        if callable(get_last_preprocessing):
            preprocessing = get_last_preprocessing()
        analysis_context = _augment_context_with_audio_quality(rag_context, preprocessing)
        summary_request = _build_summary_request_contract(rag_context)
        segments = [
            _build_script_segment(
                index=segment.get("index", index),
                text=segment.get("text", ""),
                masked_text=mask_personal_information(segment.get("text", "")),
                speaker=segment.get("speaker"),
                speaker_id=segment.get("speaker_id"),
                speaker_label=segment.get("speaker_label"),
                participant_name=segment.get("participant_name"),
                speaker_display_name=segment.get("speaker_display_name"),
                speaker_kind=segment.get("speaker_kind"),
                is_mapped=segment.get("is_mapped"),
                start_seconds=segment.get("start_seconds"),
                end_seconds=segment.get("end_seconds"),
                duration_seconds=segment.get("duration_seconds"),
                confidence=segment.get("confidence"),
                chunk_index=segment.get("chunk_index"),
                chunk_local_index=segment.get("chunk_local_index"),
                model_name=segment.get("model_name"),
                chunk_difficulty=segment.get("chunk_difficulty"),
                source="audio_chunk",
            )
            for index, segment in enumerate(raw_segments)
        ] or _build_sentence_segments(masked_transcript)
        ai_input_contract = _build_ai_input_contract(
            source_kind="audio",
            source_text=transcript,
            masked_source_text=masked_transcript,
            segments=segments,
            context_snapshot=context_snapshot,
            source_name=Path(file_path).name,
            source_path=file_path,
            source_title=context_snapshot.get("meeting_title") if context_snapshot else None,
            metadata={
                "source": "audio",
                "audio_preprocessing": _summarize_audio_preprocessing(preprocessing) if preprocessing else None,
            },
        )

        analysis_data = self.llm_service.summarize_and_extract_tickets(masked_transcript, context=analysis_context)
        evidence = _build_evidence_items(masked_transcript, analysis_data, segments, context_snapshot=context_snapshot)
        analysis = _build_analysis_payload(analysis_data, evidence=evidence)
        if preprocessing:
            analysis.extra_data["audio_preprocessing"] = _summarize_audio_preprocessing(preprocessing)
        get_last_diarization = getattr(self.stt_service, "get_last_diarization", None)
        if callable(get_last_diarization):
            diarization_summary = get_last_diarization()
            if diarization_summary:
                analysis.extra_data["speaker_diarization"] = diarization_summary
        get_last_stt_routing = getattr(self.stt_service, "get_last_stt_routing", None)
        stt_routing = get_last_stt_routing() if callable(get_last_stt_routing) else None
        if not stt_routing:
            stt_routing = _summarize_stt_routing(segments)
        if stt_routing:
            analysis.extra_data["stt_routing"] = stt_routing
        script_segments, tx_rows, search_document = _build_script_contract(
            transcript=transcript,
            masked_transcript=masked_transcript,
            analysis_data=analysis_data,
            segments=segments,
            context_snapshot=context_snapshot,
        )
        _attach_analysis_contract_metadata(
            analysis,
            summary_request=summary_request,
            search_document=search_document,
        )
        analysis.extra_data["script_segment_contract_version"] = SCRIPT_SEGMENT_CONTRACT_VERSION
        analysis.extra_data["ai_input_contract_version"] = AI_INPUT_CONTRACT_VERSION
        analysis.extra_data["ai_input_contract"] = ai_input_contract
        analysis.extra_data["script_segments"] = script_segments
        analysis.extra_data["tx"] = tx_rows
        return AIProcessingResult(
            transcript=transcript,
            masked_transcript=masked_transcript,
            segments=segments,
            analysis=analysis,
        )

    def process_audio_parallel(
        self,
        file_path: str,
        n_workers: int | None = None,
        rag_context: Any | None = None,
        *,
        include_diarization: bool = True,
    ) -> AIProcessingResult:
        """Parallel variant of process_audio for long multi-chunk recordings.

        Uses per-thread Whisper model instances to transcribe audio chunks
        concurrently, then runs masking, LLM analysis, and evidence building
        the same way as the sequential path.
        """
        parallel_transcribe = getattr(self.stt_service, "transcribe_with_segments_parallel", None)
        if not callable(parallel_transcribe):
            return self.process_audio(
                file_path,
                rag_context=rag_context,
                include_diarization=include_diarization,
                n_workers=n_workers,
            )

        context_snapshot = _build_context_snapshot(rag_context)
        context_snapshot = _ensure_search_source_metadata(
            context_snapshot,
            source_kind="audio",
            source_name=Path(file_path).name,
            source_path=file_path,
            source_title=Path(file_path).stem,
        )
        participant_names = list(context_snapshot.get("participants") or []) if context_snapshot else []
        transcript, raw_segments = parallel_transcribe(
            file_path,
            n_workers=n_workers,
            participant_names=participant_names,
            include_diarization=include_diarization,
        )

        masked_transcript = mask_personal_information(transcript)
        preprocessing = None
        get_last_preprocessing = getattr(self.stt_service, "get_last_preprocessing", None)
        if callable(get_last_preprocessing):
            preprocessing = get_last_preprocessing()
        analysis_context = _augment_context_with_audio_quality(rag_context, preprocessing)
        summary_request = _build_summary_request_contract(rag_context)
        segments = [
            _build_script_segment(
                index=segment.get("index", index),
                text=segment.get("text", ""),
                masked_text=mask_personal_information(segment.get("text", "")),
                speaker=segment.get("speaker"),
                speaker_id=segment.get("speaker_id"),
                speaker_label=segment.get("speaker_label"),
                participant_name=segment.get("participant_name"),
                speaker_display_name=segment.get("speaker_display_name"),
                speaker_kind=segment.get("speaker_kind"),
                is_mapped=segment.get("is_mapped"),
                start_seconds=segment.get("start_seconds"),
                end_seconds=segment.get("end_seconds"),
                duration_seconds=segment.get("duration_seconds"),
                confidence=segment.get("confidence"),
                chunk_index=segment.get("chunk_index"),
                chunk_local_index=segment.get("chunk_local_index"),
                model_name=segment.get("model_name"),
                chunk_difficulty=segment.get("chunk_difficulty"),
                source="audio_chunk_parallel",
            )
            for index, segment in enumerate(raw_segments)
        ] or _build_sentence_segments(masked_transcript)
        ai_input_contract = _build_ai_input_contract(
            source_kind="audio",
            source_text=transcript,
            masked_source_text=masked_transcript,
            segments=segments,
            context_snapshot=context_snapshot,
            source_name=Path(file_path).name,
            source_path=file_path,
            source_title=context_snapshot.get("meeting_title") if context_snapshot else None,
            metadata={
                "source": "audio",
                "audio_preprocessing": _summarize_audio_preprocessing(preprocessing) if preprocessing else None,
                "parallel_workers": n_workers,
            },
        )

        analysis_data = self.llm_service.summarize_and_extract_tickets(
            masked_transcript, context=analysis_context
        )
        context_snapshot = _build_context_snapshot(rag_context)
        evidence = _build_evidence_items(
            masked_transcript, analysis_data, segments, context_snapshot=context_snapshot
        )
        analysis = _build_analysis_payload(analysis_data, evidence=evidence)
        if preprocessing:
            preprocessing_summary = _summarize_audio_preprocessing(preprocessing)
            if preprocessing_summary:
                preprocessing_summary["parallel_workers"] = n_workers
                analysis.extra_data["audio_preprocessing"] = preprocessing_summary
        get_last_diarization = getattr(self.stt_service, "get_last_diarization", None)
        if callable(get_last_diarization):
            diarization_summary = get_last_diarization()
            if diarization_summary:
                analysis.extra_data["speaker_diarization"] = diarization_summary
        get_last_stt_routing = getattr(self.stt_service, "get_last_stt_routing", None)
        stt_routing = get_last_stt_routing() if callable(get_last_stt_routing) else None
        if not stt_routing:
            stt_routing = _summarize_stt_routing(segments)
        if stt_routing:
            analysis.extra_data["stt_routing"] = stt_routing
        script_segments, tx_rows, search_document = _build_script_contract(
            transcript=transcript,
            masked_transcript=masked_transcript,
            analysis_data=analysis_data,
            segments=segments,
            context_snapshot=context_snapshot,
        )
        _attach_analysis_contract_metadata(
            analysis,
            summary_request=summary_request,
            search_document=search_document,
        )
        analysis.extra_data["script_segment_contract_version"] = SCRIPT_SEGMENT_CONTRACT_VERSION
        analysis.extra_data["ai_input_contract_version"] = AI_INPUT_CONTRACT_VERSION
        analysis.extra_data["ai_input_contract"] = ai_input_contract
        analysis.extra_data["script_segments"] = script_segments
        analysis.extra_data["tx"] = tx_rows
        return AIProcessingResult(
            transcript=transcript,
            masked_transcript=masked_transcript,
            segments=segments,
            analysis=analysis,
        )

    def process_audio_batch(
        self,
        file_paths: list[str],
        rag_context: Any | None = None,
        *,
        include_diarization: bool = True,
        n_workers: int | None = None,
    ) -> AIProcessingBatchResult:
        if not file_paths:
            raise ValueError("At least one audio file path is required.")

        context_snapshot = _build_context_snapshot(rag_context)
        context_snapshot = _ensure_search_source_metadata(
            context_snapshot,
            source_kind="audio_batch",
            source_name=Path(file_paths[0]).name,
            source_path=file_paths[0],
            source_title=_derive_batch_source_title(file_paths),
        )
        participant_names = list(context_snapshot.get("participants") or []) if context_snapshot else []
        file_results: list[AIFileProcessingResult] = []
        transcript_segments: list[str] = []
        masked_segments: list[str] = []
        timeline_segments: list[dict[str, Any]] = []
        audio_preprocessing_summaries: list[dict[str, Any]] = []
        diarization_summaries: list[dict[str, Any]] = []
        file_windows: list[dict[str, Any]] = []

        for index, file_path in enumerate(file_paths):
            preprocessing = None
            prepare_audio = getattr(self.stt_service, "prepare_audio", None)
            if callable(prepare_audio):
                try:
                    preprocessing = prepare_audio(file_path)
                except Exception as exc:  # pragma: no cover - fallback path
                    logger.warning("Audio preprocessing failed for batch file %s: %s", file_path, exc)
            preprocessing_summary = _summarize_audio_preprocessing(preprocessing)
            if preprocessing_summary:
                audio_preprocessing_summaries.append(preprocessing_summary)

            duration_seconds = None
            if preprocessing is not None:
                duration_seconds = getattr(preprocessing, "duration_seconds", None)
            if duration_seconds is None and preprocessing_summary:
                duration_seconds = preprocessing_summary.get("duration_seconds")
            try:
                duration_seconds = float(duration_seconds or 0.0)
            except (TypeError, ValueError):
                duration_seconds = 0.0

            file_windows.append(
                {
                    "index": index,
                    "file_path": file_path,
                    "file_name": Path(file_path).name,
                    "segment_label": f"[PART {index + 1}/{len(file_paths)} | {Path(file_path).name}]",
                    "start_seconds": 0.0,
                    "end_seconds": duration_seconds,
                    "duration_seconds": duration_seconds,
                    "audio_preprocessing": preprocessing_summary,
                }
            )

            get_last_diarization = getattr(self.stt_service, "get_last_diarization", None)
            if callable(get_last_diarization):
                diarization_summary = get_last_diarization()
                if diarization_summary:
                    diarization_summaries.append({"file_index": index, "file_path": file_path, **diarization_summary})

        cumulative_seconds = 0.0
        for window in file_windows:
            window["start_seconds"] = cumulative_seconds
            cumulative_seconds += float(window.get("duration_seconds") or 0.0)
            window["end_seconds"] = cumulative_seconds

        merged_audio_path = _merge_audio_files_for_transcription(file_paths)
        cleanup_merged_audio = len(file_paths) > 1 and merged_audio_path is not None
        batch_source_title = _derive_batch_source_title(file_paths)

        try:
            if merged_audio_path is not None:
                transcriber = getattr(self.stt_service, "transcribe_with_segments", None)
                if callable(transcriber):
                    combined_transcript, merged_segments = transcriber(
                        str(merged_audio_path),
                        participant_names=participant_names,
                        include_diarization=include_diarization,
                        n_workers=n_workers,
                    )
                else:
                    combined_transcript = self.transcribe_audio(str(merged_audio_path))
                    merged_segments = []

                combined_masked_transcript = mask_personal_information(combined_transcript)
                get_last_diarization = getattr(self.stt_service, "get_last_diarization", None)
                if callable(get_last_diarization):
                    diarization_summary = get_last_diarization()
                    if diarization_summary:
                        diarization_summaries.append(
                            {
                                "file_index": 0,
                                "file_path": str(merged_audio_path),
                                "file_count": len(file_paths),
                                **diarization_summary,
                            }
                        )

                def _resolve_file_window(segment_start: Any, segment_end: Any) -> dict[str, Any]:
                    if not file_windows:
                        return {
                            "index": 0,
                            "file_path": file_paths[0],
                            "file_name": Path(file_paths[0]).name,
                            "segment_label": "[PART 1/1]",
                            "start_seconds": 0.0,
                            "end_seconds": 0.0,
                        }

                    try:
                        start_value = float(segment_start or 0.0)
                    except (TypeError, ValueError):
                        start_value = 0.0
                    try:
                        end_value = float(segment_end or start_value)
                    except (TypeError, ValueError):
                        end_value = start_value
                    midpoint = (start_value + end_value) / 2.0

                    for window in file_windows:
                        if midpoint < float(window["end_seconds"]) or window is file_windows[-1]:
                            if midpoint >= float(window["start_seconds"]):
                                return window
                    return file_windows[-1]

                segments_by_file: dict[int, list[dict[str, Any]]] = {window["index"]: [] for window in file_windows}
                for segment_index, segment in enumerate(merged_segments):
                    window = _resolve_file_window(segment.get("start_seconds"), segment.get("end_seconds"))
                    file_index = int(window["index"])
                    file_segment = _build_script_segment(
                        index=segment.get("index", segment_index),
                        text=segment.get("text", ""),
                        masked_text=mask_personal_information(segment.get("text", "")),
                        speaker=segment.get("speaker"),
                        speaker_id=segment.get("speaker_id"),
                        speaker_label=segment.get("speaker_label"),
                        participant_name=segment.get("participant_name"),
                        speaker_display_name=segment.get("speaker_display_name"),
                        speaker_kind=segment.get("speaker_kind"),
                        is_mapped=segment.get("is_mapped"),
                        start_seconds=segment.get("start_seconds"),
                        end_seconds=segment.get("end_seconds"),
                        duration_seconds=segment.get("duration_seconds"),
                        confidence=segment.get("confidence"),
                        chunk_index=segment.get("chunk_index"),
                        chunk_local_index=segment.get("chunk_local_index"),
                        model_name=segment.get("model_name"),
                        chunk_difficulty=segment.get("chunk_difficulty"),
                        source="audio_batch",
                        segment_label=window["segment_label"],
                        file_index=file_index,
                        file_path=window["file_path"],
                        file_name=window["file_name"],
                    )
                    timeline_segments.append(file_segment)
                    segments_by_file[file_index].append(file_segment)

                for window in file_windows:
                    file_segments = segments_by_file.get(window["index"], [])
                    file_transcript = "\n".join(segment.get("text", "").strip() for segment in file_segments if segment.get("text", "").strip())
                    file_masked_transcript = "\n".join(
                        segment.get("masked_text", "").strip() for segment in file_segments if segment.get("masked_text", "").strip()
                    )

                    file_results.append(
                        AIFileProcessingResult(
                            index=window["index"],
                            file_path=window["file_path"],
                            segment_label=window["segment_label"],
                            transcript=file_transcript,
                            masked_transcript=file_masked_transcript,
                            audio_preprocessing=window.get("audio_preprocessing"),
                        )
                    )

                    if file_transcript:
                        transcript_segments.append(f"{window['segment_label']}\n{file_transcript}")
                    if file_masked_transcript:
                        masked_segments.append(f"{window['segment_label']}\n{file_masked_transcript}")
            else:
                # Fallback path: merge failed, so analyze each file independently.
                for window in file_windows:
                    index = int(window["index"])
                    file_path = str(window["file_path"])
                    transcriber = getattr(self.stt_service, "transcribe_with_segments", None)
                    if callable(transcriber):
                        transcript, raw_segments = transcriber(
                            file_path,
                            participant_names=participant_names,
                            include_diarization=include_diarization,
                            n_workers=n_workers,
                        )
                    else:
                        transcript = self.transcribe_audio(file_path)
                        raw_segments = []

                    masked_transcript = mask_personal_information(transcript)
                    get_last_diarization = getattr(self.stt_service, "get_last_diarization", None)
                    if callable(get_last_diarization):
                        diarization_summary = get_last_diarization()
                        if diarization_summary:
                            diarization_summaries.append({"file_index": index, "file_path": file_path, **diarization_summary})

                    file_results.append(
                        AIFileProcessingResult(
                            index=index,
                            file_path=file_path,
                            segment_label=window["segment_label"],
                            transcript=transcript,
                            masked_transcript=masked_transcript,
                            audio_preprocessing=window.get("audio_preprocessing"),
                        )
                    )

                    file_segments = [
                        _build_script_segment(
                            index=segment.get("index", segment_index),
                            text=segment.get("text", ""),
                            masked_text=mask_personal_information(segment.get("text", "")),
                            speaker=segment.get("speaker"),
                            speaker_id=segment.get("speaker_id"),
                            speaker_label=segment.get("speaker_label"),
                            participant_name=segment.get("participant_name"),
                            speaker_display_name=segment.get("speaker_display_name"),
                            speaker_kind=segment.get("speaker_kind"),
                            is_mapped=segment.get("is_mapped"),
                            start_seconds=segment.get("start_seconds"),
                            end_seconds=segment.get("end_seconds"),
                            duration_seconds=segment.get("duration_seconds"),
                            confidence=segment.get("confidence"),
                            chunk_index=segment.get("chunk_index"),
                            chunk_local_index=segment.get("chunk_local_index"),
                            model_name=segment.get("model_name"),
                            chunk_difficulty=segment.get("chunk_difficulty"),
                            source="audio_chunk",
                            segment_label=window["segment_label"],
                            file_index=index,
                            file_path=file_path,
                            file_name=Path(file_path).name,
                        )
                        for segment_index, segment in enumerate(raw_segments)
                    ]
                    if not file_segments:
                        file_segments = [
                            _build_script_segment(
                                index=0,
                                text=transcript.strip(),
                                masked_text=masked_transcript.strip(),
                                participant_name=None,
                                speaker_display_name=None,
                                speaker_kind="unknown",
                                is_mapped=False,
                                source="text_fallback",
                                segment_label=window["segment_label"],
                                file_index=index,
                                file_path=file_path,
                                file_name=Path(file_path).name,
                            )
                        ] if transcript.strip() else []

                    timeline_segments.extend(file_segments)

                    if transcript.strip():
                        transcript_segments.append(f"{window['segment_label']}\n{transcript.strip()}")
                    if masked_transcript.strip():
                        masked_segments.append(f"{window['segment_label']}\n{masked_transcript.strip()}")

            combined_transcript = "\n\n".join(transcript_segments)
            combined_masked_transcript = "\n\n".join(masked_segments)
            summary_request = _build_summary_request_contract(rag_context)
            batch_context = _augment_context_with_audio_quality(
                rag_context,
                {
                    "source_kind": "audio_batch",
                    "strategy": "merged_audio_batch" if len(file_paths) > 1 else "single_file",
                    "batch_file_count": len(file_paths),
                    "meeting_title": batch_source_title,
                    "source_title": batch_source_title,
                    "batch_files": [
                        {
                            "index": window["index"],
                            "file_name": window["file_name"],
                            "duration_seconds": window["duration_seconds"],
                            "start_seconds": window["start_seconds"],
                            "end_seconds": window["end_seconds"],
                        }
                        for window in file_windows
                    ],
                    "chunking_enabled": any(item.get("chunking_enabled") for item in audio_preprocessing_summaries),
                    "chunk_count": sum(int(item.get("chunk_count") or 0) for item in audio_preprocessing_summaries),
                    "quality_flags": sorted(
                        {
                            flag
                            for item in audio_preprocessing_summaries
                            for flag in (item.get("quality_flags") or [])
                        }
                    ),
                    "note": "같은 회의의 순차 분할 파일이므로 한 번의 회의로 합쳐서 요약하라.",
                },
            )
            batch_context = dict(batch_context or {})
            if batch_source_title:
                batch_context.setdefault("meeting_title", batch_source_title)
                batch_context.setdefault("source_title", batch_source_title)
            ai_input_contract = _build_ai_input_contract(
                source_kind="audio_batch",
                source_text=combined_transcript,
                masked_source_text=combined_masked_transcript,
                segments=timeline_segments,
                context_snapshot=batch_context,
                source_title=(batch_context.get("meeting_title") if batch_context else None) or batch_source_title,
                metadata={
                    "source": "audio_batch",
                    "file_count": len(file_paths),
                    "batch_mode": "merged_audio" if cleanup_merged_audio else "fallback_file_by_file",
                },
            )
            analysis_data = self.llm_service.summarize_and_extract_tickets(combined_masked_transcript, context=batch_context)
            evidence = _build_evidence_items(
                combined_masked_transcript,
                analysis_data,
                timeline_segments,
                context_snapshot=batch_context,
            )
            analysis = _build_analysis_payload(analysis_data, evidence=evidence)
            if audio_preprocessing_summaries:
                analysis.extra_data["audio_preprocessing"] = audio_preprocessing_summaries
            if diarization_summaries:
                analysis.extra_data["speaker_diarization"] = diarization_summaries
            get_last_stt_routing = getattr(self.stt_service, "get_last_stt_routing", None)
            stt_routing = get_last_stt_routing() if callable(get_last_stt_routing) else None
            if not stt_routing:
                stt_routing = _summarize_stt_routing(timeline_segments)
            if stt_routing:
                analysis.extra_data["stt_routing"] = stt_routing
            script_segments, tx_rows, search_document = _build_script_contract(
                transcript=combined_transcript,
                masked_transcript=combined_masked_transcript,
                analysis_data=analysis_data,
                segments=timeline_segments,
                context_snapshot=batch_context,
            )
            _attach_analysis_contract_metadata(
                analysis,
                summary_request=summary_request,
                search_document=search_document,
            )
            analysis.extra_data["script_segment_contract_version"] = SCRIPT_SEGMENT_CONTRACT_VERSION
            analysis.extra_data["ai_input_contract_version"] = AI_INPUT_CONTRACT_VERSION
            analysis.extra_data["ai_input_contract"] = ai_input_contract
            analysis.extra_data["script_segments"] = script_segments
            analysis.extra_data["tx"] = tx_rows
            return AIProcessingBatchResult(
                file_count=len(file_paths),
                files=file_results,
                transcript=combined_transcript,
                masked_transcript=combined_masked_transcript,
                segments=timeline_segments,
                analysis=analysis,
            )
        finally:
            if cleanup_merged_audio and merged_audio_path is not None:
                merged_audio_path.unlink(missing_ok=True)

_DEFAULT_AI_ENGINE: AIEngine | None = None

def get_default_ai_engine() -> AIEngine:
    global _DEFAULT_AI_ENGINE
    if _DEFAULT_AI_ENGINE is None:
        _DEFAULT_AI_ENGINE = AIEngine()
    return _DEFAULT_AI_ENGINE

def transcribe_audio(file_path: str, *, n_workers: int | None = None) -> str:
    return get_default_ai_engine().transcribe_audio(file_path, n_workers=n_workers)

def prepare_audio(file_path: str) -> dict[str, Any]:
    return get_default_ai_engine().prepare_audio(file_path)

def summarize_meeting(text: str, rag_context: Any | None = None) -> str:
    return get_default_ai_engine().summarize_meeting(text, rag_context=rag_context)

def extract_tickets(summary: str, rag_context: Any | None = None) -> list[dict[str, Any]]:
    return get_default_ai_engine().extract_tickets(summary, rag_context=rag_context)

def process_document(file_path: str, rag_context: Any | None = None) -> dict[str, Any]:
    result = get_default_ai_engine().process_document(file_path, rag_context=rag_context)
    logger.info("AI document pipeline completed for %s", file_path)
    return result.to_dict()

def process_audio(
    file_path: str,
    rag_context: Any | None = None,
    *,
    include_diarization: bool = True,
    n_workers: int | None = None,
) -> dict[str, Any]:
    """Convenience wrapper for callers that prefer dict payloads."""
    result = get_default_ai_engine().process_audio(
        file_path,
        rag_context=rag_context,
        include_diarization=include_diarization,
        n_workers=n_workers,
    )
    logger.info("AI pipeline completed for %s", file_path)
    return result.to_dict()

def process_audio_parallel(
    file_path: str,
    n_workers: int | None = None,
    rag_context: Any | None = None,
    *,
    include_diarization: bool = True,
) -> dict[str, Any]:
    """Parallel variant of process_audio. Falls back to sequential for short files."""
    result = get_default_ai_engine().process_audio_parallel(
        file_path,
        n_workers=n_workers,
        rag_context=rag_context,
        include_diarization=include_diarization,
    )
    logger.info("AI parallel pipeline completed for %s", file_path)
    return result.to_dict()

def process_audio_batch(
    file_paths: list[str],
    rag_context: Any | None = None,
    *,
    include_diarization: bool = True,
    n_workers: int | None = None,
) -> dict[str, Any]:
    """Convenience wrapper for ordered multi-file audio inputs."""
    result = get_default_ai_engine().process_audio_batch(
        file_paths,
        rag_context=rag_context,
        include_diarization=include_diarization,
        n_workers=n_workers,
    )
    logger.info("AI batch pipeline completed for %s files", len(file_paths))
    return result.to_dict()

def process_text(text: str, rag_context: Any | None = None) -> dict[str, Any]:
    """Convenience wrapper for text-only inputs."""
    result = get_default_ai_engine().process_text(text, rag_context=rag_context)
    logger.info("AI text pipeline completed")
    return result.to_dict()
