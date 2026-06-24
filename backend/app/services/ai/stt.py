"""Local Whisper STT service boundary and implementation."""

from __future__ import annotations

import logging
import re
from abc import ABC, abstractmethod
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.services.ai.audio_preprocessing import AudioPreprocessingResult, WhisperAudioPreprocessor
from app.services.ai.diarization import NoopSpeakerDiarizationService, build_speaker_diarization_service
from app.services.ai.text_normalization import normalize_meeting_terms

logger = logging.getLogger(__name__)


class SpeechToTextService(ABC):
    @abstractmethod
    def transcribe(self, audio_path: str) -> str:
        raise NotImplementedError

    def transcribe_with_segments(self, audio_path: str) -> tuple[str, list[dict[str, Any]]]:
        """Optional richer transcription output with chunk metadata."""
        return self.transcribe(audio_path), []


def _normalize_speaker_fields(
    speaker: Any,
    speaker_id: Any | None = None,
    speaker_label: Any | None = None,
) -> dict[str, Any]:
    def clean(value: Any) -> str:
        return re.sub(r"\s+", " ", str(value or "")).strip()

    normalized_speaker = clean(speaker)
    normalized_speaker_id = clean(speaker_id)
    normalized_speaker_label = clean(speaker_label)

    if normalized_speaker.lower() in {"none", "null", "unknown"}:
        normalized_speaker = ""
    if normalized_speaker_id.lower() in {"none", "null", "unknown"}:
        normalized_speaker_id = ""
    if normalized_speaker_label.lower() in {"none", "null", "unknown"}:
        normalized_speaker_label = ""

    canonical_speaker = normalized_speaker or normalized_speaker_id or normalized_speaker_label or None
    if canonical_speaker is None:
        return {"speaker": None, "speaker_id": None, "speaker_label": None}

    return {
        "speaker": canonical_speaker,
        "speaker_id": normalized_speaker_id or canonical_speaker,
        "speaker_label": normalized_speaker_label or canonical_speaker,
    }


def _speaker_overlap_seconds(
    segment_start: float,
    segment_end: float,
    turn_start: float,
    turn_end: float,
) -> float:
    return max(0.0, min(segment_end, turn_end) - max(segment_start, turn_start))


def _attach_speaker_labels(
    segments: list[dict[str, Any]],
    speaker_turns: list[dict[str, Any]],
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
        return normalized_segments, {"enabled": False, "status": "disabled", "speaker_count": 0, "turn_count": 0}

    speaker_aliases: dict[str, str] = {}
    annotated_segments: list[dict[str, Any]] = []

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
                speaker_label = speaker_aliases.setdefault(speaker_id, f"화자 {len(speaker_aliases) + 1}")
                speaker_fields = {
                    "speaker": speaker_label,
                    "speaker_id": speaker_id,
                    "speaker_label": speaker_label,
                }

        annotated_segments.append({**segment, **speaker_fields})

    summary = {
        "enabled": True,
        "status": "applied",
        "speaker_count": len(speaker_aliases),
        "turn_count": len(speaker_turns),
        "speakers": list(speaker_aliases.values()),
    }
    return annotated_segments, summary


class WhisperSpeechToTextService(SpeechToTextService):
    """Lazy-loading Whisper wrapper.

    The model is loaded on first use so app startup stays lightweight.
    """

    def __init__(self, model_name: str | None = None, language: str | None = "ko") -> None:
        self.model_name = model_name or settings.whisper_model
        self.light_model_name = settings.whisper_light_model
        self.language = language
        self.preprocessor = WhisperAudioPreprocessor()
        self.diarization_service = build_speaker_diarization_service()
        self._last_preprocessing: AudioPreprocessingResult | None = None
        self._last_diarization_summary: dict[str, Any] | None = None

    @staticmethod
    @lru_cache(maxsize=4)
    def _load_model(model_name: str):
        try:
            import whisper
        except ImportError as exc:  # pragma: no cover - dependency should exist in backend env
            raise RuntimeError(
                "openai-whisper is not installed. Add it to backend requirements before using STT."
            ) from exc

        logger.info("Loading Whisper model: %s", model_name)
        return whisper.load_model(model_name)

    def transcribe(self, audio_path: str) -> str:
        path = Path(audio_path)
        if not path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        self._last_diarization_summary = {"enabled": False, "status": "not_requested", "speaker_count": 0, "turn_count": 0}
        preprocessing = self.preprocessor.prepare(path)
        self._last_preprocessing = preprocessing
        model_name = self._select_model_name(preprocessing)
        logger.info("Starting STT for %s using Whisper(%s)", path, model_name)
        text, _segments = self._transcribe_preprocessed_with_segments(preprocessing)

        logger.info(
            "STT completed for %s (chars=%s, chunks=%s, strategy=%s)",
            path.name,
            len(text),
            len(preprocessing.chunks),
            preprocessing.strategy,
        )
        return text

    def transcribe_with_segments(self, audio_path: str) -> tuple[str, list[dict[str, Any]]]:
        path = Path(audio_path)
        if not path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        preprocessing = self.preprocessor.prepare(path)
        self._last_preprocessing = preprocessing
        model_name = self._select_model_name(preprocessing)
        logger.info("Starting STT with segments for %s using Whisper(%s)", path, model_name)
        text, segments = self._transcribe_preprocessed_with_segments(preprocessing)
        speaker_turns, diarization_summary = self._diarize_audio(path)
        segments, attachment_summary = _attach_speaker_labels(segments, speaker_turns)
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

    def _diarize_audio(self, audio_path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        if not settings.diarization_enabled:
            return [], {"enabled": False, "status": "disabled", "speaker_count": 0, "turn_count": 0}

        try:
            speaker_turns = self.diarization_service.diarize(str(audio_path))
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
            "model_name": getattr(self.diarization_service, "model_name", None),
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

        if not preprocessing.chunking_enabled or len(preprocessing.chunks) <= 1:
            logger.info("Parallel STT: single chunk, using sequential path for %s", path.name)
            model = self._load_model(model_name)
            return self._transcribe_preprocessed_with_segments(model, preprocessing)

        logger.info(
            "Parallel STT starting for %s (chunks=%d, workers=%d, model=%s)",
            path.name, len(preprocessing.chunks), n_workers, model_name,
        )

        options: dict[str, object] = {
            "task": "transcribe",
            "temperature": 0.0,
            "condition_on_previous_text": False,
            "beam_size": 5,
            "best_of": 5,
            "patience": 1.0,
            "no_speech_threshold": 0.4,
            "compression_ratio_threshold": 2.4,
            "logprob_threshold": -1.0,
            "fp16": False,
            "verbose": False,
            "initial_prompt": self._build_initial_prompt(preprocessing),
        }
        if self.language:
            options["language"] = self.language

        raw_results = transcribe_chunks_parallel(
            preprocessing.chunks, model_name, options, n_workers=n_workers,
        )

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

    def prepare_audio(self, audio_path: str) -> AudioPreprocessingResult:
        """Expose audio splitting metadata for debugging and future diarization."""
        return self.preprocessor.prepare(audio_path)

    def get_last_preprocessing(self) -> AudioPreprocessingResult | None:
        return self._last_preprocessing

    def get_last_diarization(self) -> dict[str, Any] | None:
        return self._last_diarization_summary

    def _select_model_name(self, preprocessing: AudioPreprocessingResult) -> str:
        if self._is_model_cached(self.light_model_name):
            if not preprocessing.is_noisy or preprocessing.duration_seconds < 120.0:
                return self.light_model_name
        return self.model_name

    def _select_chunk_model_name(self, preprocessing: AudioPreprocessingResult, chunk: Any) -> str:
        if self.light_model_name == self.model_name:
            return self.model_name
        if not self._is_model_cached(self.light_model_name):
            return self.model_name

        difficulty = self._score_chunk_difficulty(preprocessing, chunk)
        return self.light_model_name if difficulty <= 1 else self.model_name

    @staticmethod
    def _is_model_cached(model_name: str) -> bool:
        cache_dir = Path.home() / ".cache" / "whisper"
        return (cache_dir / f"{model_name}.pt").exists()

    def _resolve_available_model_name(self, preferred: str) -> str:
        candidates = [preferred]
        if preferred != self.light_model_name:
            candidates.append(self.light_model_name)
        if self.model_name not in candidates:
            candidates.append(self.model_name)
        if "base" not in candidates:
            candidates.append("base")

        for candidate in candidates:
            if candidate and self._is_model_cached(candidate):
                return candidate
        return preferred

    def _transcribe_preprocessed_with_segments(
        self,
        preprocessing: AudioPreprocessingResult,
    ) -> tuple[str, list[dict[str, Any]]]:
        options: dict[str, object] = {
            "task": "transcribe",
            "temperature": 0.0,
            "condition_on_previous_text": False,
            "beam_size": 5,
            "best_of": 5,
            "patience": 1.0,
            "no_speech_threshold": 0.4,
            "compression_ratio_threshold": 2.4,
            "logprob_threshold": -1.0,
            "fp16": False,
            "verbose": False,
            "initial_prompt": self._build_initial_prompt(preprocessing),
        }
        if self.language:
            options["language"] = self.language

        segments: list[str] = []
        structured_segments: list[dict[str, Any]] = []
        loaded_models: dict[str, Any] = {}

        def get_model(name: str):
            resolved_name = self._resolve_available_model_name(name)
            model = loaded_models.get(resolved_name)
            if model is None:
                model = self._load_model(resolved_name)
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
