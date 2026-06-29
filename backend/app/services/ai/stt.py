"""Local Whisper STT service boundary and implementation."""

from __future__ import annotations

import os
import logging
import re
from abc import ABC, abstractmethod
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from app.core.config import settings
from app.services.ai.audio_preprocessing import AudioPreprocessingResult, WhisperAudioPreprocessor
from app.services.ai.text_normalization import normalize_meeting_terms

os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

logger = logging.getLogger(__name__)
GENERIC_SPEAKER_LABEL_PREFIX = "팀원"
MIN_MINOR_SPEAKER_TURN_SECONDS = 4.0
MIN_MINOR_SPEAKER_RATIO = 0.02
MIN_MINOR_SPEAKER_COUNT_TRIGGER = 5
MIN_MINOR_SPEAKER_MULTI_TURN_SECONDS = 4.5
MIN_MINOR_SPEAKER_MULTI_TURN_RATIO = 0.04
MIN_MINOR_SPEAKER_MULTI_TURN_MAX_COUNT = 2
LIGHT_PROFILE_MAX_DURATION_SECONDS = 90.0
TranscriptionProfile = Literal["light", "balanced", "premium", "small", "medium", "large"]
DEFAULT_TRANSCRIPTION_PROFILE: TranscriptionProfile = "balanced"
TRANSCRIPTION_PROFILE_SETTINGS: dict[TranscriptionProfile, dict[str, Any]] = {
    "light": {
        "preprocessor": {
            "min_chunk_seconds": 60.0,
            "transcription_overlap_seconds": 0.15,
            "noisy_chunk_overlap_seconds": 0.8,
            "max_chunk_seconds": 240.0,
        },
        "options": {
            "beam_size": 1,
            "best_of": 1,
            "patience": 0.0,
            "no_speech_threshold": 0.5,
            "compression_ratio_threshold": 3.0,
            "logprob_threshold": -1.25,
        },
        "noisy_options": {
            "beam_size": 1,
            "best_of": 1,
            "patience": 0.0,
            "no_speech_threshold": 0.45,
            "compression_ratio_threshold": 2.8,
            "logprob_threshold": -1.2,
        },
    },
    "balanced": {
        "preprocessor": {
            "transcription_overlap_seconds": 0.75,
            "noisy_chunk_overlap_seconds": 2.4,
            "max_chunk_seconds": 180.0,
        },
        "options": {
            "beam_size": 3,
            "best_of": 3,
            "patience": 0.8,
            "no_speech_threshold": 0.4,
            "compression_ratio_threshold": 2.4,
            "logprob_threshold": -1.0,
        },
        "noisy_options": {
            "beam_size": 4,
            "best_of": 4,
            "patience": 1.0,
            "no_speech_threshold": 0.35,
            "compression_ratio_threshold": 2.2,
            "logprob_threshold": -1.05,
        },
    },
    "premium": {
        "preprocessor": {
            "transcription_overlap_seconds": 1.0,
            "noisy_chunk_overlap_seconds": 3.0,
            "max_chunk_seconds": 180.0,
        },
        "options": {
            "beam_size": 5,
            "best_of": 5,
            "patience": 1.2,
            "no_speech_threshold": 0.35,
            "compression_ratio_threshold": 2.2,
            "logprob_threshold": -0.95,
        },
        "noisy_options": {
            "beam_size": 6,
            "best_of": 6,
            "patience": 1.3,
            "no_speech_threshold": 0.3,
            "compression_ratio_threshold": 2.0,
            "logprob_threshold": -1.0,
        },
    },
}

TRANSCRIPTION_PROFILE_ALIASES: dict[str, TranscriptionProfile] = {
    "small": "light",
    "light": "light",
    "medium": "balanced",
    "balanced": "balanced",
    "large": "premium",
    "premium": "premium",
}

WHISPER_ENGINE_AUTO = "auto"
WHISPER_ENGINE_OPENAI = "openai-whisper"
WHISPER_ENGINE_FASTER = "faster-whisper"
WHISPER_ENGINE_ALIASES: dict[str, str] = {
    "auto": WHISPER_ENGINE_AUTO,
    "openai": WHISPER_ENGINE_OPENAI,
    "openai-whisper": WHISPER_ENGINE_OPENAI,
    "whisper": WHISPER_ENGINE_OPENAI,
    "faster": WHISPER_ENGINE_FASTER,
    "faster-whisper": WHISPER_ENGINE_FASTER,
}


def _normalize_transcription_profile(value: Any | None) -> TranscriptionProfile:
    normalized = re.sub(r"\s+", " ", str(value or "")).strip().lower()
    aliased = TRANSCRIPTION_PROFILE_ALIASES.get(normalized, normalized)
    if aliased in TRANSCRIPTION_PROFILE_SETTINGS:
        return aliased  # type: ignore[return-value]
    return DEFAULT_TRANSCRIPTION_PROFILE


def _build_generic_speaker_label(index: int) -> str:
    return f"{GENERIC_SPEAKER_LABEL_PREFIX} {index}"


def _normalize_whisper_engine(value: Any | None) -> str:
    normalized = re.sub(r"\s+", "-", str(value or "")).strip().lower()
    return WHISPER_ENGINE_ALIASES.get(normalized, WHISPER_ENGINE_AUTO)


class _FasterWhisperTranscriptionAdapter:
    """Normalize faster-whisper output to the same dict shape as openai-whisper."""

    _OPTION_KEY_MAP = {
        "logprob_threshold": "log_prob_threshold",
        "fp16": None,
        "verbose": None,
    }

    def __init__(self, model: Any, *, model_name: str, device_name: str, compute_type: str) -> None:
        self._model = model
        self.model_name = model_name
        self.device_name = device_name
        self.compute_type = compute_type

    @staticmethod
    def _safe_float(value: Any | None) -> float | None:
        try:
            if value is None:
                return None
            return float(value)
        except (TypeError, ValueError):
            return None

    def _normalize_options(self, options: dict[str, Any]) -> dict[str, Any]:
        normalized: dict[str, Any] = {}
        for key, value in options.items():
            mapped_key = self._OPTION_KEY_MAP.get(key, key)
            if mapped_key is None:
                continue
            normalized[mapped_key] = value

        # Faster-whisper already supports VAD internally, but we keep it disabled here
        # because this service pre-chunks meeting audio before inference.
        normalized.setdefault("vad_filter", False)
        return normalized

    def transcribe(self, audio: Any, **options: Any) -> dict[str, Any]:
        filtered_options = self._normalize_options(options)
        segments, info = self._model.transcribe(audio, **filtered_options)

        normalized_segments: list[dict[str, Any]] = []
        normalized_texts: list[str] = []
        for index, segment in enumerate(segments):
            text = str(getattr(segment, "text", "") or "")
            normalized_texts.append(text)
            normalized_segments.append(
                {
                    "id": index,
                    "seek": None,
                    "start": self._safe_float(getattr(segment, "start", None)) or 0.0,
                    "end": self._safe_float(getattr(segment, "end", None)) or 0.0,
                    "text": text,
                    "tokens": list(getattr(segment, "tokens", []) or []),
                    "avg_logprob": self._safe_float(getattr(segment, "avg_logprob", None)),
                    "compression_ratio": self._safe_float(getattr(segment, "compression_ratio", None)),
                    "no_speech_prob": self._safe_float(getattr(segment, "no_speech_prob", None)),
                }
            )

        return {
            "text": " ".join(text.strip() for text in normalized_texts if text.strip()).strip(),
            "segments": normalized_segments,
            "language": getattr(info, "language", None),
            "language_probability": getattr(info, "language_probability", None),
        }


class SpeechToTextService(ABC):
    @abstractmethod
    def transcribe(self, audio_path: str) -> str:
        raise NotImplementedError

    def transcribe_with_segments(
        self,
        audio_path: str,
        *,
        participant_names: list[str] | None = None,
    ) -> tuple[str, list[dict[str, Any]]]:
        """Optional richer transcription output with chunk metadata."""
        return self.transcribe(audio_path), []


def _normalize_speaker_fields(
    speaker: Any,
    speaker_id: Any | None = None,
    speaker_label: Any | None = None,
    participant_name: Any | None = None,
    speaker_display_name: Any | None = None,
    speaker_kind: Any | None = None,
    is_mapped: Any | None = None,
) -> dict[str, Any]:
    def clean(value: Any) -> str:
        return re.sub(r"\s+", " ", str(value or "")).strip()

    normalized_speaker = clean(speaker)
    normalized_speaker_id = clean(speaker_id)
    normalized_speaker_label = clean(speaker_label)
    normalized_participant_name = clean(participant_name)
    normalized_speaker_display_name = clean(speaker_display_name)
    normalized_speaker_kind = clean(speaker_kind)

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


def _is_minor_speaker_bucket(
    bucket: dict[str, Any],
    *,
    total_speech_seconds: float,
    speaker_count: int,
) -> bool:
    if speaker_count < MIN_MINOR_SPEAKER_COUNT_TRIGGER:
        return False

    try:
        speech_seconds = float(bucket.get("speech_seconds") or 0.0)
        turn_count = int(bucket.get("turn_count") or 0)
    except (TypeError, ValueError):
        return False

    if turn_count > 1:
        if turn_count > MIN_MINOR_SPEAKER_MULTI_TURN_MAX_COUNT:
            return False
        if speech_seconds > MIN_MINOR_SPEAKER_MULTI_TURN_SECONDS:
            return False
        if total_speech_seconds <= 0:
            return False
        return (speech_seconds / total_speech_seconds) <= MIN_MINOR_SPEAKER_MULTI_TURN_RATIO

    if speech_seconds > MIN_MINOR_SPEAKER_TURN_SECONDS:
        return False
    if total_speech_seconds <= 0:
        return False

    return (speech_seconds / total_speech_seconds) <= MIN_MINOR_SPEAKER_RATIO


def _speaker_overlap_seconds(
    segment_start: float,
    segment_end: float,
    turn_start: float,
    turn_end: float,
) -> float:
    return max(0.0, min(segment_end, turn_end) - max(segment_start, turn_start))


def _normalize_participant_names(participant_names: list[str] | None) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for name in participant_names or []:
        cleaned = re.sub(r"\s+", " ", str(name or "")).strip()
        if not cleaned:
            continue
        signature = cleaned.lower()
        if signature in seen:
            continue
        seen.add(signature)
        normalized.append(cleaned)
    return normalized


def _attach_speaker_labels(
    segments: list[dict[str, Any]],
    speaker_turns: list[dict[str, Any]],
    *,
    meeting_duration_seconds: float | None = None,
    participant_names: list[str] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not segments:
        return [], {"enabled": bool(speaker_turns), "status": "empty", "speaker_count": 0, "turn_count": len(speaker_turns)}

    if not speaker_turns:
        normalized_segments = []
        for segment in segments:
            speaker_fields = _normalize_speaker_fields(
                segment.get("speaker"),
                segment.get("speaker_id"),
                segment.get("speaker_label"),
            )
            normalized_segments.append({**segment, **speaker_fields})
        return normalized_segments, {}

    ordered_speaker_ids: list[str] = []
    speaker_aliases: dict[str, str] = {}
    speaker_stats: dict[str, dict[str, Any]] = {}
    annotated_segments: list[dict[str, Any]] = []
    speaker_order: dict[str, int] = {}

    ordered_turns = sorted(
        speaker_turns,
        key=lambda turn: (
            float(turn.get("start_seconds") or 0.0),
            float(turn.get("end_seconds") or 0.0),
        ),
    )

    for turn in ordered_turns:
        speaker_id = str(turn.get("speaker_id") or turn.get("speaker") or turn.get("speaker_label") or "").strip()
        if not speaker_id:
            continue
        speaker_label = speaker_aliases.setdefault(speaker_id, _build_generic_speaker_label(len(speaker_aliases) + 1))
        speaker_order.setdefault(speaker_id, len(speaker_order))
        if speaker_id not in ordered_speaker_ids:
            ordered_speaker_ids.append(speaker_id)

        try:
            turn_start = float(turn.get("start_seconds") or 0.0)
            turn_end = float(turn.get("end_seconds") or 0.0)
        except (TypeError, ValueError):
            turn_start = turn_end = 0.0
        turn_duration = max(0.0, turn_end - turn_start)
        bucket = speaker_stats.setdefault(
            speaker_id,
            {
                "speaker_id": speaker_id,
                "speaker_label": speaker_label,
                "speech_seconds": 0.0,
                "turn_count": 0,
                "first_start_seconds": turn_start,
                "last_end_seconds": turn_end,
            },
        )
        bucket["speaker_label"] = speaker_label
        bucket["speech_seconds"] += turn_duration
        bucket["turn_count"] += 1
        bucket["first_start_seconds"] = min(bucket["first_start_seconds"], turn_start)
        bucket["last_end_seconds"] = max(bucket["last_end_seconds"], turn_end)

    total_speech_seconds = sum(float(bucket.get("speech_seconds") or 0.0) for bucket in speaker_stats.values())
    raw_speaker_count = len(speaker_stats)
    minor_speaker_ids = {
        speaker_id
        for speaker_id, bucket in speaker_stats.items()
        if _is_minor_speaker_bucket(bucket, total_speech_seconds=total_speech_seconds, speaker_count=raw_speaker_count)
    }
    active_speaker_ids = [speaker_id for speaker_id in ordered_speaker_ids if speaker_id not in minor_speaker_ids]
    if not active_speaker_ids and speaker_stats:
        minor_speaker_ids = set()
        active_speaker_ids = list(ordered_speaker_ids)

    participant_names_normalized = _normalize_participant_names(participant_names)
    active_speaker_stats: dict[str, dict[str, Any]] = {
        speaker_id: speaker_stats[speaker_id] for speaker_id in active_speaker_ids if speaker_id in speaker_stats
    }
    speaker_display_names: dict[str, str] = {speaker_id: speaker_aliases[speaker_id] for speaker_id in active_speaker_ids}
    speaker_participant_mapping: list[dict[str, Any]] = []
    if participant_names_normalized and active_speaker_stats:
        ranked_speakers = sorted(
            active_speaker_stats.values(),
            key=lambda bucket: (
                -float(bucket.get("speech_seconds") or 0.0),
                float(bucket.get("first_start_seconds") or 0.0),
                speaker_order.get(str(bucket.get("speaker_id") or ""), 10_000),
            ),
        )
        for index, bucket in enumerate(ranked_speakers):
            if index >= len(participant_names_normalized):
                break
            speaker_id = str(bucket.get("speaker_id") or "").strip()
            participant_name = participant_names_normalized[index]
            if not speaker_id:
                continue
            generic_label = speaker_aliases.get(speaker_id, _build_generic_speaker_label(len(speaker_aliases) + 1))
            speaker_display_names[speaker_id] = participant_name
            bucket["participant_name"] = participant_name
            bucket["speaker_alias"] = generic_label
            speaker_participant_mapping.append(
                {
                    "speaker_id": speaker_id,
                    "speaker_alias": generic_label,
                    "speaker_display_name": participant_name,
                    "speaker_kind": "participant",
                    "is_mapped": True,
                    "participant_name": participant_name,
                }
            )

    for segment in segments:
        speaker_fields = _normalize_speaker_fields(
            segment.get("speaker"),
            segment.get("speaker_id"),
            segment.get("speaker_label"),
        )
        segment_start = segment.get("start_seconds")
        segment_end = segment.get("end_seconds")

        best_turn: dict[str, Any] | None = None
        best_overlap = 0.0
        if segment_start is not None and segment_end is not None:
            try:
                segment_start_f = float(segment_start)
                segment_end_f = float(segment_end)
            except (TypeError, ValueError):
                segment_start_f = segment_end_f = 0.0
            for turn in speaker_turns:
                turn_start = turn.get("start_seconds")
                turn_end = turn.get("end_seconds")
                if turn_start is None or turn_end is None:
                    continue
                try:
                    overlap = _speaker_overlap_seconds(
                        segment_start_f,
                        segment_end_f,
                        float(turn_start),
                        float(turn_end),
                    )
                except (TypeError, ValueError):
                    continue
                if overlap > best_overlap:
                    best_overlap = overlap
                    best_turn = turn

        if best_turn is not None and best_overlap > 0:
            speaker_id = str(best_turn.get("speaker_id") or best_turn.get("speaker") or best_turn.get("speaker_label") or "")
            if speaker_id:
                if speaker_id in minor_speaker_ids:
                    speaker_fields = {
                        "speaker": "기타",
                        "speaker_id": speaker_id,
                        "speaker_label": "기타",
                        "participant_name": None,
                        "speaker_display_name": "기타",
                        "speaker_kind": "minor",
                        "is_mapped": False,
                    }
                else:
                    speaker_label = speaker_display_names.get(
                        speaker_id,
                        speaker_aliases.setdefault(speaker_id, _build_generic_speaker_label(len(speaker_aliases) + 1)),
                    )
                    participant_name = None
                    bucket = active_speaker_stats.get(speaker_id)
                    if bucket:
                        participant_name = bucket.get("participant_name")
                    speaker_kind = "participant" if participant_name else "generic"
                    speaker_fields = {
                        "speaker": speaker_label,
                        "speaker_id": speaker_id,
                        "speaker_label": speaker_label,
                        "participant_name": participant_name,
                        "speaker_display_name": participant_name or speaker_label,
                        "speaker_kind": speaker_kind,
                        "is_mapped": bool(participant_name),
                    }

        annotated_segments.append({**segment, **speaker_fields})

    if meeting_duration_seconds is None:
        meeting_duration_seconds = max(
            [float(turn.get("end_seconds") or 0.0) for turn in ordered_turns] or [0.0]
        )

    speaker_statistics: list[dict[str, Any]] = []
    active_turn_count = 0
    expected_participant_count = len(participant_names_normalized)
    mapped_participant_count = 0
    for speaker_id in active_speaker_ids:
        bucket = speaker_stats.get(speaker_id)
        if not bucket:
            continue
        speech_seconds = float(bucket.get("speech_seconds") or 0.0)
        if bucket.get("participant_name"):
            mapped_participant_count += 1
        active_turn_count += int(bucket.get("turn_count") or 0)
        speaker_statistics.append(
            {
                "speaker_id": speaker_id,
                "speaker_label": speaker_display_names.get(speaker_id, bucket.get("speaker_label")),
                "speaker_alias": bucket.get("speaker_label"),
                "participant_name": bucket.get("participant_name"),
                "speaker_display_name": bucket.get("participant_name") or speaker_display_names.get(speaker_id, bucket.get("speaker_label")),
                "speaker_kind": "participant" if bucket.get("participant_name") else "generic",
                "is_mapped": bool(bucket.get("participant_name")),
                "speech_seconds": round(speech_seconds, 3),
                "speech_ratio": round((speech_seconds / total_speech_seconds), 4) if total_speech_seconds > 0 else 0.0,
                "meeting_ratio": round((speech_seconds / meeting_duration_seconds), 4) if meeting_duration_seconds and meeting_duration_seconds > 0 else 0.0,
                "turn_count": bucket.get("turn_count", 0),
                "first_start_seconds": round(float(bucket.get("first_start_seconds") or 0.0), 3),
                "last_end_seconds": round(float(bucket.get("last_end_seconds") or 0.0), 3),
            }
        )

    if expected_participant_count:
        if len(active_speaker_ids) > expected_participant_count:
            validation_status = "more_speakers_than_participants"
        elif len(active_speaker_ids) < expected_participant_count:
            validation_status = "fewer_speakers_than_participants"
        else:
            validation_status = "ok"
    else:
        validation_status = "unknown"

    summary = {
        "enabled": True,
        "status": "applied",
        "speaker_count": len(active_speaker_ids),
        "turn_count": active_turn_count,
        "raw_speaker_count": len(speaker_stats),
        "raw_turn_count": len(speaker_turns),
        "discarded_speaker_count": len(minor_speaker_ids),
        "discarded_turn_count": len(speaker_turns) - active_turn_count,
        "ignored_speaker_ids": sorted(minor_speaker_ids),
        "speakers": [speaker_display_names.get(speaker_id, speaker_aliases[speaker_id]) for speaker_id in active_speaker_ids],
        "speaker_participant_mapping": speaker_participant_mapping,
        "total_speech_seconds": round(total_speech_seconds, 3),
        "meeting_duration_seconds": round(float(meeting_duration_seconds or 0.0), 3),
        "speaker_statistics": speaker_statistics,
        "expected_participant_count": expected_participant_count or None,
        "mapped_participant_count": mapped_participant_count,
        "unmapped_speaker_count": max(0, len(active_speaker_ids) - mapped_participant_count),
        "speaker_count_delta": (
            len(active_speaker_ids) - expected_participant_count if expected_participant_count else None
        ),
        "validation_status": validation_status,
    }
    return annotated_segments, summary


class WhisperSpeechToTextService(SpeechToTextService):
    """Lazy-loading Whisper wrapper.

    The model is loaded on first use so app startup stays lightweight.
    """

    def __init__(
        self,
        model_name: str | None = None,
        language: str | None = "ko",
        transcription_profile: TranscriptionProfile | str | None = None,
    ) -> None:
        self.model_name = model_name or settings.whisper_model
        self.medium_model_name = settings.whisper_medium_model or self.model_name
        self.light_model_name = settings.whisper_light_model
        self.language = language
        self.transcription_profile = _normalize_transcription_profile(transcription_profile)
        self.device_name = self._resolve_device_name()
        self.whisper_engine = self._resolve_whisper_engine_name(self.device_name)
        profile_settings = TRANSCRIPTION_PROFILE_SETTINGS[self.transcription_profile]
        self.preprocessor = WhisperAudioPreprocessor(**profile_settings["preprocessor"])
        self._diarization_service: Any | None = None
        self._last_preprocessing: AudioPreprocessingResult | None = None
        self._last_diarization_summary: dict[str, Any] | None = None

    @staticmethod
    def _resolve_device_name() -> str:
        try:
            import torch
        except ImportError as exc:  # pragma: no cover - dependency should exist in backend env
            raise RuntimeError("torch is required for Whisper transcription but is not installed.") from exc

        if torch.cuda.is_available():
            return "cuda"

        mps = getattr(torch.backends, "mps", None)
        if mps is not None and mps.is_available():
            return "mps"

        return "cpu"

    @staticmethod
    def _resolve_whisper_engine_name(device_name: str) -> str:
        configured = _normalize_whisper_engine(settings.whisper_engine)
        if configured != WHISPER_ENGINE_AUTO:
            return configured

        if device_name == "mps":
            return WHISPER_ENGINE_OPENAI

        try:
            import faster_whisper  # noqa: F401
        except ImportError:
            return WHISPER_ENGINE_OPENAI

        return WHISPER_ENGINE_FASTER

    @staticmethod
    def _resolve_compute_type_name(device_name: str, whisper_engine: str) -> str:
        if whisper_engine == WHISPER_ENGINE_FASTER:
            if device_name == "cuda":
                return "float16"
            return "int8"
        return "float16" if device_name == "cuda" else "float32"

    @staticmethod
    @lru_cache(maxsize=8)
    def _load_model(model_name: str, device_name: str | None = None, whisper_engine: str | None = None):
        resolved_device_name = device_name or WhisperSpeechToTextService._resolve_device_name()
        resolved_engine = whisper_engine or WhisperSpeechToTextService._resolve_whisper_engine_name(resolved_device_name)

        if resolved_engine == WHISPER_ENGINE_FASTER:
            try:
                from faster_whisper import WhisperModel
            except ImportError as exc:  # pragma: no cover - dependency should exist in backend env
                raise RuntimeError(
                    "faster-whisper is not installed. Add it to backend requirements before using the fast STT path."
                ) from exc

            compute_type = WhisperSpeechToTextService._resolve_compute_type_name(resolved_device_name, resolved_engine)
            logger.info("Loading faster-whisper model: %s", model_name)
            logger.info("Using Whisper device: %s (compute_type=%s)", resolved_device_name, compute_type)
            return _FasterWhisperTranscriptionAdapter(
                WhisperModel(model_name, device=resolved_device_name, compute_type=compute_type),
                model_name=model_name,
                device_name=resolved_device_name,
                compute_type=compute_type,
            )

        try:
            import whisper
        except ImportError as exc:  # pragma: no cover - dependency should exist in backend env
            raise RuntimeError(
                "openai-whisper is not installed. Add it to backend requirements before using STT."
            ) from exc

        logger.info("Loading Whisper model: %s", model_name)
        logger.info("Using Whisper device: %s", resolved_device_name)
        return whisper.load_model(model_name, device=resolved_device_name)

    def transcribe(self, audio_path: str) -> str:
        path = Path(audio_path)
        if not path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        self._last_diarization_summary = {"enabled": False, "status": "not_requested", "speaker_count": 0, "turn_count": 0}
        preprocessing = self.preprocessor.prepare(path)
        self._last_preprocessing = preprocessing
        model_name = self._select_model_name(preprocessing)
        logger.info("Starting STT for %s using Whisper(%s)", path, model_name)
        try:
            try:
                text, _segments = self._transcribe_preprocessed_with_segments(preprocessing)
            except Exception as exc:
                if self.whisper_engine == WHISPER_ENGINE_OPENAI:
                    raise
                logger.warning(
                    "Whisper engine '%s' failed for %s; retrying with openai-whisper: %s",
                    self.whisper_engine,
                    path.name,
                    exc,
                )
                text, _segments = self._transcribe_preprocessed_with_segments(
                    preprocessing,
                    whisper_engine=WHISPER_ENGINE_OPENAI,
                )
            logger.info(
                "STT completed for %s (chars=%s, chunks=%s, strategy=%s)",
                path.name,
                len(text),
                len(preprocessing.chunks),
                preprocessing.strategy,
            )
            return text
        finally:
            self._clear_device_cache()

    def transcribe_with_segments(
        self,
        audio_path: str,
        *,
        participant_names: list[str] | None = None,
    ) -> tuple[str, list[dict[str, Any]]]:
        path = Path(audio_path)
        if not path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        preprocessing = self.preprocessor.prepare(path)
        self._last_preprocessing = preprocessing
        model_name = self._select_model_name(preprocessing)
        logger.info("Starting STT with segments for %s using Whisper(%s)", path, model_name)
        try:
            try:
                text, segments = self._transcribe_preprocessed_with_segments(preprocessing)
            except Exception as exc:
                if self.whisper_engine == WHISPER_ENGINE_OPENAI:
                    raise
                logger.warning(
                    "Whisper engine '%s' failed for %s; retrying with openai-whisper: %s",
                    self.whisper_engine,
                    path.name,
                    exc,
                )
                text, segments = self._transcribe_preprocessed_with_segments(
                    preprocessing,
                    whisper_engine=WHISPER_ENGINE_OPENAI,
                )
            speaker_turns, diarization_summary = self._diarize_audio(path, preprocessing=preprocessing)
            segments, attachment_summary = _attach_speaker_labels(
                segments,
                speaker_turns,
                meeting_duration_seconds=preprocessing.duration_seconds,
                participant_names=participant_names,
            )
            diarization_summary.update(attachment_summary)
            self._last_diarization_summary = diarization_summary

            logger.info(
                "STT segment output completed for %s (chars=%s, chunks=%s, strategy=%s)",
                path.name,
                len(text),
                len(preprocessing.chunks),
                preprocessing.strategy,
            )
            return text, segments
        finally:
            self._clear_device_cache()

    def _diarize_audio(
        self,
        audio_path: Path,
        *,
        preprocessing: AudioPreprocessingResult | None = None,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        diarization_service = self._get_diarization_service()
        if diarization_service is None:
            return [], {
                "enabled": False,
                "status": "disabled",
                "speaker_count": 0,
                "turn_count": 0,
            }

        try:
            speaker_turns = diarization_service.diarize(
                str(audio_path),
                samples=getattr(preprocessing, "samples", None),
                sample_rate=getattr(preprocessing, "sample_rate", None),
            )
        except Exception as exc:
            logger.warning("Speaker diarization skipped for %s: %s", audio_path.name, exc)
            return [], {
                "enabled": True,
                "status": "unavailable",
                "reason": str(exc),
                "speaker_count": 0,
                "turn_count": 0,
            }

        speaker_ids = sorted(
            {
                str(turn.get("speaker_id") or turn.get("speaker_label") or turn.get("speaker"))
                for turn in speaker_turns
                if turn.get("speaker_id") or turn.get("speaker_label") or turn.get("speaker")
            }
        )
        return speaker_turns, {
            "enabled": True,
            "status": "applied" if speaker_turns else "empty",
            "speaker_count": len(speaker_ids),
            "turn_count": len(speaker_turns),
            "model_name": getattr(diarization_service, "model_name", None),
            "speakers": speaker_ids,
        }

    def transcribe_with_segments_parallel(
        self,
        audio_path: str,
        n_workers: int = 2,
    ) -> tuple[str, list[dict[str, Any]]]:
        """Parallel variant: splits audio into chunks and transcribes them concurrently.

        Each worker thread owns its own Whisper model instance. Falls back to
        the sequential path when the audio produces only one chunk.
        """
        from app.services.pipeline.parallel_transcription import transcribe_chunks_parallel

        path = Path(audio_path)
        if not path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        preprocessing = self.preprocessor.prepare(path)
        self._last_preprocessing = preprocessing
        model_name = self._select_model_name(preprocessing)
        use_openai_fallback = self.whisper_engine != WHISPER_ENGINE_OPENAI

        try:
            if not preprocessing.chunking_enabled or len(preprocessing.chunks) <= 1:
                logger.info("Parallel STT: single chunk, using sequential path for %s", path.name)
                return self._transcribe_preprocessed_with_segments(preprocessing)

            logger.info(
                "Parallel STT starting for %s (chunks=%d, workers=%d, model=%s)",
                path.name, len(preprocessing.chunks), n_workers, model_name,
            )

            options = self._build_transcription_options(preprocessing)

            raw_results = transcribe_chunks_parallel(
                preprocessing.chunks,
                model_name,
                options,
                n_workers=n_workers,
                device_name=self.device_name,
            )
            if use_openai_fallback and any(raw.get("error") for raw in raw_results.values()):
                raise RuntimeError("parallel transcription failed for one or more chunks")

            # Assemble results in chunk order with the same filtering logic used
            # by the sequential _transcribe_preprocessed_with_segments.
            segments: list[str] = []
            structured_segments: list[dict[str, Any]] = []

            for chunk in preprocessing.chunks:
                raw = raw_results.get(chunk.index, {"text": "", "segments": []})
                chunk_text = self._clean_transcript_text(raw.get("text") or "")
                chunk_segments = list(raw.get("segments") or [])
                core_start = chunk.core_start_seconds if chunk.core_start_seconds is not None else chunk.start_seconds
                core_end = chunk.core_end_seconds if chunk.core_end_seconds is not None else chunk.end_seconds
                chunk_kept_texts: list[str] = []

                if chunk_segments:
                    for local_index, segment in enumerate(chunk_segments):
                        text = self._clean_transcript_text(segment.get("text") or "")
                        segment_start = float(segment.get("start") or 0.0)
                        segment_end = float(segment.get("end") or 0.0)
                        if not self._should_keep_segment(text, segment, preprocessing):
                            continue
                        if not self._is_segment_in_core_region(segment_start, segment_end, core_start, core_end):
                            continue

                        start_seconds = chunk.start_seconds + segment_start
                        end_seconds = chunk.start_seconds + segment_end
                        confidence = self._segment_confidence(segment)
                        chunk_kept_texts.append(text)
                        segments.append(text)
                        structured_segments.append(
                            {
                                "index": len(structured_segments),
                                "chunk_index": chunk.index,
                                "chunk_local_index": local_index,
                                "start_seconds": round(start_seconds, 3),
                                "end_seconds": round(end_seconds, 3),
                                "duration_seconds": round(max(0.0, end_seconds - start_seconds), 3),
                                "text": text,
                                "confidence": confidence,
                                "avg_logprob": segment.get("avg_logprob"),
                                "no_speech_prob": segment.get("no_speech_prob"),
                                "compression_ratio": segment.get("compression_ratio"),
                            }
                        )
                    if not chunk_kept_texts and chunk_text and not self._is_likely_noise_text(chunk_text):
                        segments.append(chunk_text)
                        structured_segments.append(
                            {
                                "index": len(structured_segments),
                                "chunk_index": chunk.index,
                                "start_seconds": round(chunk.start_seconds, 3),
                                "end_seconds": round(chunk.end_seconds, 3),
                                "duration_seconds": round(chunk.duration_seconds, 3),
                                "text": chunk_text,
                                "confidence": 0.45 if preprocessing.is_noisy else 0.7,
                                "avg_logprob": None,
                                "no_speech_prob": None,
                                "compression_ratio": None,
                            }
                        )
                    continue

                if chunk_text and not self._is_likely_noise_text(chunk_text):
                    segments.append(chunk_text)
                    structured_segments.append(
                        {
                            "index": len(structured_segments),
                            "chunk_index": chunk.index,
                            "start_seconds": round(chunk.start_seconds, 3),
                            "end_seconds": round(chunk.end_seconds, 3),
                            "duration_seconds": round(chunk.duration_seconds, 3),
                            "text": chunk_text,
                            "confidence": 0.55 if preprocessing.is_noisy else 0.75,
                            "avg_logprob": None,
                            "no_speech_prob": None,
                            "compression_ratio": None,
                        }
                    )

            logger.info(
                "Parallel STT completed for %s (chars=%d, chunks=%d, strategy=%s)",
                path.name,
                sum(len(s) for s in segments),
                len(preprocessing.chunks),
                preprocessing.strategy,
            )
            return " ".join(segments).strip(), structured_segments
        except Exception as exc:
            if not use_openai_fallback:
                raise
            logger.warning(
                "Parallel Whisper engine '%s' failed for %s; retrying with openai-whisper: %s",
                self.whisper_engine,
                path.name,
                exc,
            )
            return self._transcribe_preprocessed_with_segments(
                preprocessing,
                whisper_engine=WHISPER_ENGINE_OPENAI,
            )
        finally:
            self._clear_device_cache()

    def prepare_audio(self, audio_path: str) -> AudioPreprocessingResult:
        """Expose audio splitting metadata for debugging and future diarization."""
        return self.preprocessor.prepare(audio_path)

    def get_last_preprocessing(self) -> AudioPreprocessingResult | None:
        return self._last_preprocessing

    def get_last_diarization(self) -> dict[str, Any] | None:
        return self._last_diarization_summary

    def _select_model_name(self, preprocessing: AudioPreprocessingResult) -> str:
        if self.transcription_profile == "light":
            if preprocessing.duration_seconds >= LIGHT_PROFILE_MAX_DURATION_SECONDS or preprocessing.chunking_enabled:
                return self._resolve_available_model_name(self.medium_model_name)
            return self._resolve_available_model_name(self.light_model_name)
        if self.transcription_profile == "balanced":
            return self._resolve_available_model_name(self.medium_model_name)
        return self._resolve_available_model_name(self.model_name)

    def _select_chunk_model_name(self, preprocessing: AudioPreprocessingResult, chunk: Any) -> str:
        return self._select_model_name(preprocessing)

    def _resolve_available_model_name(self, preferred: str) -> str:
        return preferred

    def _build_transcription_options(self, preprocessing: AudioPreprocessingResult) -> dict[str, object]:
        profile_settings = TRANSCRIPTION_PROFILE_SETTINGS[self.transcription_profile]
        options: dict[str, object] = {
            "task": "transcribe",
            "temperature": 0.0,
            "condition_on_previous_text": False,
            "fp16": self.device_name == "cuda",
            "verbose": False,
            "initial_prompt": self._build_initial_prompt(preprocessing),
            **profile_settings["options"],
        }
        if preprocessing.is_noisy:
            options.update(profile_settings["noisy_options"])
        if self.language:
            options["language"] = self.language
        return options

    @staticmethod
    def _clear_device_cache() -> None:
        try:
            import torch
        except ImportError:  # pragma: no cover - dependency should exist in backend env
            return

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        mps = getattr(torch, "mps", None)
        if mps is None:
            mps = getattr(torch.backends, "mps", None)
        if mps is not None and hasattr(mps, "empty_cache"):
            try:
                mps.empty_cache()
            except Exception:  # pragma: no cover - best effort cleanup
                logger.debug("Failed to clear MPS cache", exc_info=True)

    def _get_diarization_service(self):
        if not settings.diarization_enabled:
            return None
        if self._diarization_service is None:
            from app.services.ai.diarization import build_speaker_diarization_service

            self._diarization_service = build_speaker_diarization_service()
        return self._diarization_service

    def _transcribe_preprocessed_with_segments(
        self,
        preprocessing: AudioPreprocessingResult,
        *,
        whisper_engine: str | None = None,
    ) -> tuple[str, list[dict[str, Any]]]:
        options = self._build_transcription_options(preprocessing)

        segments: list[str] = []
        structured_segments: list[dict[str, Any]] = []
        loaded_models: dict[str, Any] = {}
        resolved_whisper_engine = whisper_engine or self.whisper_engine

        def get_model(name: str):
            resolved_name = self._resolve_available_model_name(name)
            model = loaded_models.get(resolved_name)
            if model is None:
                model = self._load_model(resolved_name, self.device_name, resolved_whisper_engine)
                loaded_models[resolved_name] = model
            return model

        for chunk in preprocessing.chunks:
            chunk_model_name = self._select_chunk_model_name(preprocessing, chunk)
            model = get_model(chunk_model_name)
            chunk_difficulty = self._score_chunk_difficulty(preprocessing, chunk)
            result = model.transcribe(chunk.samples, **options)
            chunk_text = self._clean_transcript_text(result.get("text") or "")
            chunk_segments = list(result.get("segments") or [])
            core_start = chunk.core_start_seconds if chunk.core_start_seconds is not None else chunk.start_seconds
            core_end = chunk.core_end_seconds if chunk.core_end_seconds is not None else chunk.end_seconds
            chunk_kept_texts: list[str] = []

            if chunk_segments:
                for local_index, segment in enumerate(chunk_segments):
                    text = self._clean_transcript_text(segment.get("text") or "")
                    segment_start = float(segment.get("start") or 0.0)
                    segment_end = float(segment.get("end") or 0.0)
                    if not self._should_keep_segment(text, segment, preprocessing):
                        continue
                    if not self._is_segment_in_core_region(segment_start, segment_end, core_start, core_end):
                        continue

                    start_seconds = chunk.start_seconds + segment_start
                    end_seconds = chunk.start_seconds + segment_end
                    confidence = self._segment_confidence(segment)
                    chunk_kept_texts.append(text)
                    segments.append(text)
                    structured_segments.append(
                        {
                            "index": len(structured_segments),
                            "chunk_index": chunk.index,
                            "chunk_local_index": local_index,
                            "start_seconds": round(start_seconds, 3),
                            "end_seconds": round(end_seconds, 3),
                            "duration_seconds": round(max(0.0, end_seconds - start_seconds), 3),
                            "text": text,
                            "confidence": confidence,
                            "model_name": chunk_model_name,
                            "chunk_difficulty": chunk_difficulty,
                            "avg_logprob": segment.get("avg_logprob"),
                            "no_speech_prob": segment.get("no_speech_prob"),
                            "compression_ratio": segment.get("compression_ratio"),
                        }
                    )
                if not chunk_kept_texts and chunk_text and not self._is_likely_noise_text(chunk_text):
                    segments.append(chunk_text)
                    structured_segments.append(
                        {
                            "index": len(structured_segments),
                            "chunk_index": chunk.index,
                            "start_seconds": round(chunk.start_seconds, 3),
                            "end_seconds": round(chunk.end_seconds, 3),
                            "duration_seconds": round(chunk.duration_seconds, 3),
                            "text": chunk_text,
                            "confidence": 0.45 if preprocessing.is_noisy else 0.7,
                            "model_name": chunk_model_name,
                            "chunk_difficulty": chunk_difficulty,
                            "avg_logprob": None,
                            "no_speech_prob": None,
                            "compression_ratio": None,
                        }
                    )
                continue

            if chunk_text and not self._is_likely_noise_text(chunk_text):
                segments.append(chunk_text)
                structured_segments.append(
                    {
                        "index": len(structured_segments),
                        "chunk_index": chunk.index,
                        "start_seconds": round(chunk.start_seconds, 3),
                        "end_seconds": round(chunk.end_seconds, 3),
                        "duration_seconds": round(chunk.duration_seconds, 3),
                        "text": chunk_text,
                        "confidence": 0.55 if preprocessing.is_noisy else 0.75,
                        "model_name": chunk_model_name,
                        "chunk_difficulty": chunk_difficulty,
                        "avg_logprob": None,
                        "no_speech_prob": None,
                        "compression_ratio": None,
                    }
                )

        return " ".join(segments).strip(), structured_segments

    def _score_chunk_difficulty(self, preprocessing: AudioPreprocessingResult, chunk: Any) -> int:
        score = 0
        chunk_duration = max(0.0, float(chunk.end_seconds) - float(chunk.start_seconds))
        core_start = chunk.core_start_seconds if chunk.core_start_seconds is not None else chunk.start_seconds
        core_end = chunk.core_end_seconds if chunk.core_end_seconds is not None else chunk.end_seconds
        core_duration = max(0.0, float(core_end) - float(core_start))
        core_ratio = core_duration / chunk_duration if chunk_duration > 0 else 0.0

        if preprocessing.is_noisy:
            score += 2
        if chunk_duration >= 360.0:
            score += 2
        elif chunk_duration >= 180.0:
            score += 1
        if core_ratio < 0.65:
            score += 2
        elif core_ratio < 0.8:
            score += 1
        if preprocessing.strategy == "noisy_fixed_window_split":
            score += 1
        if any(flag in {"dense_audio_activity", "residual_background_noise"} for flag in preprocessing.quality_flags):
            score += 1
        return score

    @staticmethod
    def _build_initial_prompt(preprocessing: AudioPreprocessingResult) -> str:
        prompt = "한국어 회의록 전사입니다. 여러 사람이 참여하는 회의 대화입니다."
        prompt += " 잡음, 잔향, 에어컨 소리, 키보드 소리, 겹치는 발화는 무시하고 의미 있는 발화만 전사하세요."
        prompt += " 회의 핵심 용어 예시: 결재, 업무 등록, 일정 관리, 관리자 페이지, 요구사항 명세서, 통합 테스트, 버그 수정, 배포, 오픈, 리스크, 인사팀, 디자인 시안, 로그인, 대시보드, 담당자 지정."
        prompt += " 업무 시스템 회의에서는 approval 의미는 결재로 유지하고, payment 의미일 때만 결제로 표기하세요."
        if preprocessing.is_noisy:
            prompt += " 녹음 품질이 좋지 않으므로 끊긴 단어, 중복 음절, 배경 잡음을 억지로 복원하지 말고 명확한 회의 발화만 남기세요."
        return prompt

    @staticmethod
    def _clean_transcript_text(text: str) -> str:
        cleaned = re.sub(r"\s+", " ", str(text or "")).strip()
        cleaned = cleaned.replace("…", ".")
        return normalize_meeting_terms(cleaned)

    @staticmethod
    def _is_likely_noise_text(text: str) -> bool:
        cleaned = re.sub(r"[\s\W_]+", "", str(text or ""), flags=re.UNICODE)
        if len(cleaned) < 2:
            return True
        if re.fullmatch(r"(.)\1{3,}", cleaned):
            return True
        if not re.search(r"[0-9A-Za-z가-힣]", cleaned):
            return True
        return False

    def _should_keep_segment(
        self,
        text: str,
        segment: dict[str, Any],
        preprocessing: AudioPreprocessingResult,
    ) -> bool:
        if not text or self._is_likely_noise_text(text):
            return False

        no_speech_prob = self._safe_float(segment.get("no_speech_prob"))
        avg_logprob = self._safe_float(segment.get("avg_logprob"))
        compression_ratio = self._safe_float(segment.get("compression_ratio"))
        text_length = len(text)

        if no_speech_prob is not None and no_speech_prob >= 0.85 and text_length <= 40:
            return False
        if avg_logprob is not None and avg_logprob <= -1.35 and text_length <= 32:
            return False
        if compression_ratio is not None and compression_ratio >= 2.8 and text_length <= 48:
            return False
        if preprocessing.is_noisy and no_speech_prob is not None and no_speech_prob >= 0.72 and text_length <= 60:
            return False
        return True

    @staticmethod
    def _is_segment_in_core_region(start_seconds: float, end_seconds: float, core_start: float, core_end: float) -> bool:
        midpoint = (start_seconds + end_seconds) / 2.0
        return core_start <= midpoint <= core_end

    @staticmethod
    def _segment_confidence(segment: dict[str, Any]) -> float:
        avg_logprob = WhisperSpeechToTextService._safe_float(segment.get("avg_logprob"))
        no_speech_prob = WhisperSpeechToTextService._safe_float(segment.get("no_speech_prob"))
        compression_ratio = WhisperSpeechToTextService._safe_float(segment.get("compression_ratio"))

        score = 0.72
        if avg_logprob is not None:
            score += max(-0.35, min(0.25, (avg_logprob + 1.0) / 5.0))
        if no_speech_prob is not None:
            score -= min(0.45, max(0.0, no_speech_prob * 0.5))
        if compression_ratio is not None and compression_ratio > 2.4:
            score -= min(0.2, (compression_ratio - 2.4) * 0.08)
        return round(max(0.05, min(0.95, score)), 3)

    @staticmethod
    def _safe_float(value: Any) -> float | None:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
