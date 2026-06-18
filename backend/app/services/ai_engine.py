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


def _build_tx_rows(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for index, segment in enumerate(segments):
        start_seconds = segment.get("start_seconds")
        text = segment.get("masked_text") or segment.get("text") or ""
        rows.append(
            {
                "time": _format_mmss(start_seconds),
                "ts": int(round(float(start_seconds))) if start_seconds is not None else None,
                "spk": segment.get("speaker"),
                "txt": text,
                "confidence": segment.get("confidence"),
                "index": segment.get("index", index),
            }
        )
    return rows


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
            {
                "index": index,
                "speaker": None,
                "start_seconds": None,
                "end_seconds": None,
                "confidence": None,
                "text": sentence,
                "masked_text": sentence,
                "source": "text",
            }
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
        return AIProcessingResult(
            transcript=text,
            masked_transcript=masked_text,
            segments=segments,
            analysis=analysis,
        )

    def process_audio(self, file_path: str, rag_context: Any | None = None) -> AIProcessingResult:
        transcriber = getattr(self.stt_service, "transcribe_with_segments", None)
        if callable(transcriber):
            transcript, raw_segments = transcriber(file_path)
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
            {
                "index": segment.get("index", index),
                "speaker": segment.get("speaker"),
                "start_seconds": segment.get("start_seconds"),
                "end_seconds": segment.get("end_seconds"),
                "duration_seconds": segment.get("duration_seconds"),
                "confidence": segment.get("confidence"),
                "text": segment.get("text", ""),
                "masked_text": mask_personal_information(segment.get("text", "")),
                "source": "audio_chunk",
            }
            for index, segment in enumerate(raw_segments)
        ] or _build_sentence_segments(masked_transcript)

        analysis_data = self.llm_service.summarize_and_extract_tickets(masked_transcript, context=analysis_context)
        context_snapshot = _build_context_snapshot(rag_context)
        evidence = _build_evidence_items(masked_transcript, analysis_data, segments, context_snapshot=context_snapshot)
        analysis = _build_analysis_payload(analysis_data, evidence=evidence)
        if preprocessing:
            analysis.extra_data["audio_preprocessing"] = _summarize_audio_preprocessing(preprocessing)
        return AIProcessingResult(
            transcript=transcript,
            masked_transcript=masked_transcript,
            segments=segments,
            analysis=analysis,
        )

    def process_audio_batch(self, file_paths: list[str], rag_context: Any | None = None) -> AIProcessingBatchResult:
        if not file_paths:
            raise ValueError("At least one audio file path is required.")

        file_results: list[AIFileProcessingResult] = []
        transcript_segments: list[str] = []
        masked_segments: list[str] = []
        timeline_segments: list[dict[str, Any]] = []
        audio_preprocessing_summaries: list[dict[str, Any]] = []

        for index, file_path in enumerate(file_paths):
            transcriber = getattr(self.stt_service, "transcribe_with_segments", None)
            if callable(transcriber):
                transcript, raw_segments = transcriber(file_path)
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
                {
                    "index": segment.get("index", segment_index),
                    "file_index": index,
                    "file_path": file_path,
                    "file_name": Path(file_path).name,
                    "segment_label": segment_label,
                    "speaker": segment.get("speaker"),
                    "start_seconds": segment.get("start_seconds"),
                    "end_seconds": segment.get("end_seconds"),
                    "duration_seconds": segment.get("duration_seconds"),
                    "confidence": segment.get("confidence"),
                    "text": segment.get("text", ""),
                    "masked_text": mask_personal_information(segment.get("text", "")),
                    "source": "audio_chunk",
                }
                for segment_index, segment in enumerate(raw_segments)
            ]
            if not file_segments:
                file_segments = [
                    {
                        "index": 0,
                        "file_index": index,
                        "file_path": file_path,
                        "file_name": Path(file_path).name,
                        "segment_label": segment_label,
                        "speaker": None,
                        "start_seconds": None,
                        "end_seconds": None,
                        "duration_seconds": None,
                        "confidence": None,
                        "text": transcript.strip(),
                        "masked_text": masked_transcript.strip(),
                        "source": "text_fallback",
                    }
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
        context_snapshot = _build_context_snapshot(rag_context)
        evidence = _build_evidence_items(
            combined_masked_transcript,
            analysis_data,
            timeline_segments,
            context_snapshot=context_snapshot,
        )
        analysis = _build_analysis_payload(analysis_data, evidence=evidence)
        if audio_preprocessing_summaries:
            analysis.extra_data["audio_preprocessing"] = audio_preprocessing_summaries
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
