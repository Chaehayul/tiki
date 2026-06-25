"""Compatibility facade for the AI processing pipeline.

This module keeps a simple public surface for older imports while delegating
actual work to the split services under app.services.ai and app.services.pipeline.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.services.ai.llm_analysis import LLMAnalysisService, build_llm_analysis_service
from app.services.ai.rag_context import RAGContext, normalize_rag_context
from app.services.ai.stt import SpeechToTextService, WhisperSpeechToTextService
from app.schemas.meeting_record import MeetingSearchChunk, MeetingSearchDocument
from app.services.pipeline.security_masking import mask_personal_information

logger = logging.getLogger(__name__)

SENTENCE_SPLIT_PATTERN = re.compile(r"(?<=[.!?。])\s+|\n+")


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
    return {
        "index": index,
        "file_index": file_index,
        "file_path": file_path,
        "file_name": file_name,
        "segment_label": segment_label,
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
                "time": _format_mmss(normalized["start_seconds"]),
                "ts": int(round(float(normalized["start_seconds"]))) if normalized["start_seconds"] is not None else None,
                "spk": normalized["speaker"],
                "speaker_id": normalized["speaker_id"],
                "speaker_label": normalized["speaker_label"],
                "participant_name": normalized["participant_name"],
                "speaker_display_name": normalized["speaker_display_name"],
                "speaker_kind": normalized["speaker_kind"],
                "is_mapped": normalized["is_mapped"],
                "segment_label": normalized["segment_label"],
                "txt": normalized["masked_text"] or normalized["text"] or "",
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


@dataclass(slots=True)
class AIAnalysisPayload:
    summary: str
    action_items: list[dict[str, Any]]
    keywords: list[dict[str, Any]] = field(default_factory=list)
    decisions: list[str] = field(default_factory=list)
    actions: list[dict[str, Any]] = field(default_factory=list)
    issues: list[dict[str, Any]] = field(default_factory=list)
    next_agenda: list[str] = field(default_factory=list)
    evidence: list[dict[str, Any]] = field(default_factory=list)
    model_name: str | None = None
    prompt_version: str | None = None
    extra_data: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        actions = self.actions or [self._action_item_to_action(item) for item in self.action_items]
        return {
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
            "extra_data": self.extra_data,
        }

    @staticmethod
    def _action_item_to_action(item: dict[str, Any]) -> dict[str, Any]:
        return {
            "text": str(item.get("title", "")).strip() or str(item.get("description", "")).strip(),
            "assignee": item.get("assignee"),
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
        return {
            "transcript": self.transcript,
            "masked_transcript": self.masked_transcript,
            "segments": self.segments,
            "tx": tx,
            "meeting_minutes": {
                "summary": analysis.get("summary", ""),
                "keywords": analysis.get("keywords", []),
                "decisions": analysis.get("decisions", []),
                "actions": analysis.get("actions", []),
                "action_items": analysis.get("action_items", []),
                "issues": analysis.get("issues", []),
                "next_agenda": analysis.get("next_agenda", []),
                "segments": self.segments,
                "tx": tx,
                "evidence": analysis.get("evidence", []),
                "model_name": analysis.get("model_name"),
                "prompt_version": analysis.get("prompt_version"),
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
        return {
            "file_count": self.file_count,
            "files": [file_result.to_dict() for file_result in self.files],
            "transcript": self.transcript,
            "masked_transcript": self.masked_transcript,
            "segments": self.segments,
            "tx": tx,
            "meeting_minutes": {
                "summary": analysis.get("summary", ""),
                "keywords": analysis.get("keywords", []),
                "decisions": analysis.get("decisions", []),
                "actions": analysis.get("actions", []),
                "action_items": analysis.get("action_items", []),
                "issues": analysis.get("issues", []),
                "next_agenda": analysis.get("next_agenda", []),
                "segments": self.segments,
                "tx": tx,
                "evidence": analysis.get("evidence", []),
                "model_name": analysis.get("model_name"),
                "prompt_version": analysis.get("prompt_version"),
                "extra_data": analysis.get("extra_data", {}),
            },
            "analysis": analysis,
        }


def _build_analysis_payload(
    analysis_data: dict[str, Any],
    *,
    evidence: list[dict[str, Any]] | None = None,
) -> AIAnalysisPayload:
    action_items = list(analysis_data.get("action_items", []))
    actions = list(analysis_data.get("actions", [])) or [AIAnalysisPayload._action_item_to_action(item) for item in action_items]
    return AIAnalysisPayload(
        summary=str(analysis_data.get("summary", "")),
        action_items=action_items,
        keywords=list(analysis_data.get("keywords", [])),
        decisions=list(analysis_data.get("decisions", [])),
        actions=actions,
        issues=list(analysis_data.get("issues", [])),
        next_agenda=list(analysis_data.get("next_agenda", [])),
        evidence=list(evidence or []),
        model_name=analysis_data.get("model_name"),
        prompt_version=analysis_data.get("prompt_version"),
        extra_data=dict(analysis_data.get("extra_data", {})),
    )


def build_project_rag_context(project: dict[str, Any] | None = None, **overrides: Any) -> dict[str, Any]:
    base = {
        "project_name": None,
        "project_key": None,
        "project_category": None,
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

    snapshot = normalized.to_dict()
    return {
        key: value
        for key, value in snapshot.items()
        if key in {
            "project_name",
            "project_key",
            "project_category",
            "analysis_focus",
            "ticket_rules",
            "glossary",
            "example_tickets",
            "preferred_keywords",
            "participants",
            "admins",
            "integration_targets",
            "note",
        }
        and value not in (None, "", [], {}, ())
    }


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
    if context_snapshot:
        title = _normalize_segment_text(context_snapshot.get("meeting_title")) or None
        project_name = _normalize_segment_text(context_snapshot.get("project_name")) or None

    search_text = _join_search_parts(
        title,
        project_name,
        analysis_data.get("summary"),
        keywords,
        decisions,
        [item["title"] for item in action_items if item.get("title")],
        [item["description"] for item in action_items if item.get("description")],
        issues,
        next_agenda,
        [chunk["search_text"] for chunk in search_chunks],
        transcript,
        masked_transcript,
    )

    document = MeetingSearchDocument(
        meeting_title=title,
        project_name=project_name,
        summary=_normalize_segment_text(analysis_data.get("summary")),
        keywords=keywords,
        keyword_items=keyword_items,
        decisions=decisions,
        action_items=action_items,
        issues=issues,
        next_agenda=next_agenda,
        chunks=search_chunks,
        search_text=search_text,
    )
    return document.model_dump()


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
    ) -> None:
        self.stt_service = stt_service or WhisperSpeechToTextService()
        self.llm_service = llm_service or build_llm_analysis_service()

    def transcribe_audio(self, file_path: str) -> str:
        return self.stt_service.transcribe(file_path)

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
        evidence = _build_evidence_items(masked_text, analysis_data, segments, context_snapshot=context_snapshot)
        analysis = _build_analysis_payload(analysis_data, evidence=evidence)
        script_segments = _build_script_segments(segments)
        analysis.extra_data["script_segments"] = script_segments
        analysis.extra_data["tx"] = _build_tx_rows(script_segments)
        analysis.extra_data["search_document"] = _build_meeting_search_document(
            transcript=text,
            masked_transcript=masked_text,
            analysis_data=analysis_data,
            segments=segments,
            context_snapshot=context_snapshot,
        )
        return AIProcessingResult(
            transcript=text,
            masked_transcript=masked_text,
            segments=segments,
            analysis=analysis,
        )

    def process_audio(self, file_path: str, rag_context: Any | None = None) -> AIProcessingResult:
        context_snapshot = _build_context_snapshot(rag_context)
        participant_names = list(context_snapshot.get("participants") or []) if context_snapshot else []
        transcriber = getattr(self.stt_service, "transcribe_with_segments", None)
        if callable(transcriber):
            transcript, raw_segments = transcriber(file_path, participant_names=participant_names)
        else:
            transcript = self.transcribe_audio(file_path)
            raw_segments = []

        masked_transcript = mask_personal_information(transcript)
        preprocessing = None
        get_last_preprocessing = getattr(self.stt_service, "get_last_preprocessing", None)
        if callable(get_last_preprocessing):
            preprocessing = get_last_preprocessing()
        analysis_context = _augment_context_with_audio_quality(rag_context, preprocessing)
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
        stt_routing = _summarize_stt_routing(segments)
        if stt_routing:
            analysis.extra_data["stt_routing"] = stt_routing
        script_segments = _build_script_segments(segments)
        analysis.extra_data["script_segments"] = script_segments
        analysis.extra_data["tx"] = _build_tx_rows(script_segments)
        analysis.extra_data["search_document"] = _build_meeting_search_document(
            transcript=transcript,
            masked_transcript=masked_transcript,
            analysis_data=analysis_data,
            segments=segments,
            context_snapshot=context_snapshot,
        )
        return AIProcessingResult(
            transcript=transcript,
            masked_transcript=masked_transcript,
            segments=segments,
            analysis=analysis,
        )

    def process_audio_parallel(
        self,
        file_path: str,
        n_workers: int = 2,
        rag_context: Any | None = None,
    ) -> AIProcessingResult:
        """Parallel variant of process_audio for long multi-chunk recordings.

        Uses per-thread Whisper model instances to transcribe audio chunks
        concurrently, then runs masking, LLM analysis, and evidence building
        the same way as the sequential path.
        """
        parallel_transcribe = getattr(self.stt_service, "transcribe_with_segments_parallel", None)
        if not callable(parallel_transcribe):
            return self.process_audio(file_path, rag_context=rag_context)

        transcript, raw_segments = parallel_transcribe(file_path, n_workers=n_workers)

        masked_transcript = mask_personal_information(transcript)
        preprocessing = None
        get_last_preprocessing = getattr(self.stt_service, "get_last_preprocessing", None)
        if callable(get_last_preprocessing):
            preprocessing = get_last_preprocessing()
        analysis_context = _augment_context_with_audio_quality(rag_context, preprocessing)
        segments = [
            {
                "index": segment.get("index", index),
                "speaker": segment.get("speaker"),
                "start_seconds": segment.get("start_seconds"),
                "end_seconds": segment.get("end_seconds"),
                "duration_seconds": segment.get("duration_seconds"),
                "confidence": segment.get("confidence"),
                "text": segment.get("text", ""),
                "masked_text": mask_personal_information(segment.get("text", "")),
                "source": "audio_chunk_parallel",
            }
            for index, segment in enumerate(raw_segments)
        ] or _build_sentence_segments(masked_transcript)

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
        return AIProcessingResult(
            transcript=transcript,
            masked_transcript=masked_transcript,
            segments=segments,
            analysis=analysis,
        )

    def process_audio_batch(self, file_paths: list[str], rag_context: Any | None = None) -> AIProcessingBatchResult:
        if not file_paths:
            raise ValueError("At least one audio file path is required.")

        context_snapshot = _build_context_snapshot(rag_context)
        participant_names = list(context_snapshot.get("participants") or []) if context_snapshot else []
        file_results: list[AIFileProcessingResult] = []
        transcript_segments: list[str] = []
        masked_segments: list[str] = []
        timeline_segments: list[dict[str, Any]] = []
        audio_preprocessing_summaries: list[dict[str, Any]] = []
        diarization_summaries: list[dict[str, Any]] = []

        for index, file_path in enumerate(file_paths):
            transcriber = getattr(self.stt_service, "transcribe_with_segments", None)
            if callable(transcriber):
                transcript, raw_segments = transcriber(file_path, participant_names=participant_names)
            else:
                transcript = self.transcribe_audio(file_path)
                raw_segments = []

            masked_transcript = mask_personal_information(transcript)
            preprocessing = None
            get_last_preprocessing = getattr(self.stt_service, "get_last_preprocessing", None)
            if callable(get_last_preprocessing):
                preprocessing = get_last_preprocessing()
            preprocessing_summary = _summarize_audio_preprocessing(preprocessing)
            if preprocessing_summary:
                audio_preprocessing_summaries.append(preprocessing_summary)
            get_last_diarization = getattr(self.stt_service, "get_last_diarization", None)
            if callable(get_last_diarization):
                diarization_summary = get_last_diarization()
                if diarization_summary:
                    diarization_summaries.append({"file_index": index, "file_path": file_path, **diarization_summary})
            segment_label = f"[SEGMENT {index + 1}]"

            file_results.append(
                AIFileProcessingResult(
                    index=index,
                    file_path=file_path,
                    segment_label=segment_label,
                    transcript=transcript,
                    masked_transcript=masked_transcript,
                    audio_preprocessing=preprocessing_summary,
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
                    segment_label=segment_label,
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
                        segment_label=segment_label,
                        file_index=index,
                        file_path=file_path,
                        file_name=Path(file_path).name,
                    )
                ] if transcript.strip() else []

            timeline_segments.extend(file_segments)

            if transcript.strip():
                transcript_segments.append(f"{segment_label}\n{transcript.strip()}")
            if masked_transcript.strip():
                masked_segments.append(f"{segment_label}\n{masked_transcript.strip()}")

        combined_transcript = "\n\n".join(transcript_segments)
        combined_masked_transcript = "\n\n".join(masked_segments)
        batch_context = _augment_context_with_audio_quality(
            rag_context,
            {
                "strategy": "batch",
                "chunking_enabled": any(item.get("chunking_enabled") for item in audio_preprocessing_summaries),
                "chunk_count": sum(int(item.get("chunk_count") or 0) for item in audio_preprocessing_summaries),
                "quality_flags": sorted(
                    {
                        flag
                        for item in audio_preprocessing_summaries
                        for flag in (item.get("quality_flags") or [])
                    }
                ),
            },
        )
        analysis_data = self.llm_service.summarize_and_extract_tickets(combined_masked_transcript, context=batch_context)
        evidence = _build_evidence_items(
            combined_masked_transcript,
            analysis_data,
            timeline_segments,
            context_snapshot=context_snapshot,
        )
        analysis = _build_analysis_payload(analysis_data, evidence=evidence)
        if audio_preprocessing_summaries:
            analysis.extra_data["audio_preprocessing"] = audio_preprocessing_summaries
        if diarization_summaries:
            analysis.extra_data["speaker_diarization"] = diarization_summaries
        stt_routing = _summarize_stt_routing(timeline_segments)
        if stt_routing:
            analysis.extra_data["stt_routing"] = stt_routing
        script_segments = _build_script_segments(timeline_segments)
        analysis.extra_data["script_segments"] = script_segments
        analysis.extra_data["tx"] = _build_tx_rows(script_segments)
        analysis.extra_data["search_document"] = _build_meeting_search_document(
            transcript=combined_transcript,
            masked_transcript=combined_masked_transcript,
            analysis_data=analysis_data,
            segments=timeline_segments,
            context_snapshot=context_snapshot,
        )
        return AIProcessingBatchResult(
            file_count=len(file_paths),
            files=file_results,
            transcript=combined_transcript,
            masked_transcript=combined_masked_transcript,
            segments=timeline_segments,
            analysis=analysis,
        )


_DEFAULT_AI_ENGINE: AIEngine | None = None


def get_default_ai_engine() -> AIEngine:
    global _DEFAULT_AI_ENGINE
    if _DEFAULT_AI_ENGINE is None:
        _DEFAULT_AI_ENGINE = AIEngine()
    return _DEFAULT_AI_ENGINE


def transcribe_audio(file_path: str) -> str:
    return get_default_ai_engine().transcribe_audio(file_path)


def prepare_audio(file_path: str) -> dict[str, Any]:
    return get_default_ai_engine().prepare_audio(file_path)


def summarize_meeting(text: str, rag_context: Any | None = None) -> str:
    return get_default_ai_engine().summarize_meeting(text, rag_context=rag_context)


def extract_tickets(summary: str, rag_context: Any | None = None) -> list[dict[str, Any]]:
    return get_default_ai_engine().extract_tickets(summary, rag_context=rag_context)


def process_audio(file_path: str, rag_context: Any | None = None) -> dict[str, Any]:
    """Convenience wrapper for callers that prefer dict payloads."""
    result = get_default_ai_engine().process_audio(file_path, rag_context=rag_context)
    logger.info("AI pipeline completed for %s", file_path)
    return result.to_dict()


def process_audio_parallel(
    file_path: str, n_workers: int = 2, rag_context: Any | None = None
) -> dict[str, Any]:
    """Parallel variant of process_audio. Falls back to sequential for short files."""
    result = get_default_ai_engine().process_audio_parallel(
        file_path, n_workers=n_workers, rag_context=rag_context
    )
    logger.info("AI parallel pipeline completed for %s", file_path)
    return result.to_dict()


def process_audio_batch(file_paths: list[str], rag_context: Any | None = None) -> dict[str, Any]:
    """Convenience wrapper for ordered multi-file audio inputs."""
    result = get_default_ai_engine().process_audio_batch(file_paths, rag_context=rag_context)
    logger.info("AI batch pipeline completed for %s files", len(file_paths))
    return result.to_dict()


def process_text(text: str, rag_context: Any | None = None) -> dict[str, Any]:
    """Convenience wrapper for text-only inputs."""
    result = get_default_ai_engine().process_text(text, rag_context=rag_context)
    logger.info("AI text pipeline completed")
    return result.to_dict()
