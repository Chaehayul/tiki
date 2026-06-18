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

logger = logging.getLogger(__name__)


class SpeechToTextService(ABC):
    @abstractmethod
    def transcribe(self, audio_path: str) -> str:
        raise NotImplementedError

    def transcribe_with_segments(self, audio_path: str) -> tuple[str, list[dict[str, Any]]]:
        """Optional richer transcription output with chunk metadata."""
        return self.transcribe(audio_path), []


class WhisperSpeechToTextService(SpeechToTextService):
    """Lazy-loading Whisper wrapper.

    The model is loaded on first use so app startup stays lightweight.
    """

    def __init__(self, model_name: str | None = None, language: str | None = "ko") -> None:
        self.model_name = model_name or settings.whisper_model
        self.language = language
        self.preprocessor = WhisperAudioPreprocessor()
        self._last_preprocessing: AudioPreprocessingResult | None = None

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

        logger.info("Starting STT for %s using Whisper(%s)", path, self.model_name)
        model = self._load_model(self.model_name)
        preprocessing = self.preprocessor.prepare(path)
        self._last_preprocessing = preprocessing
        text, _segments = self._transcribe_preprocessed_with_segments(model, preprocessing)

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

        logger.info("Starting STT with segments for %s using Whisper(%s)", path, self.model_name)
        model = self._load_model(self.model_name)
        preprocessing = self.preprocessor.prepare(path)
        self._last_preprocessing = preprocessing
        text, segments = self._transcribe_preprocessed_with_segments(model, preprocessing)

        logger.info(
            "STT segment output completed for %s (chars=%s, chunks=%s, strategy=%s)",
            path.name,
            len(text),
            len(preprocessing.chunks),
            preprocessing.strategy,
        )
        return text, segments

    def prepare_audio(self, audio_path: str) -> AudioPreprocessingResult:
        """Expose audio splitting metadata for debugging and future diarization."""
        return self.preprocessor.prepare(audio_path)

    def get_last_preprocessing(self) -> AudioPreprocessingResult | None:
        return self._last_preprocessing

    def _transcribe_preprocessed_with_segments(
        self,
        model,
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
        for chunk in preprocessing.chunks:
            result = model.transcribe(chunk.samples, **options)
            chunk_text = self._clean_transcript_text(result.get("text") or "")
            chunk_segments = list(result.get("segments") or [])

            if chunk_segments:
                for local_index, segment in enumerate(chunk_segments):
                    text = self._clean_transcript_text(segment.get("text") or "")
                    if not self._should_keep_segment(text, segment, preprocessing):
                        continue

                    start_seconds = chunk.start_seconds + float(segment.get("start") or 0.0)
                    end_seconds = chunk.start_seconds + float(segment.get("end") or 0.0)
                    confidence = self._segment_confidence(segment)
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

        return " ".join(segments).strip(), structured_segments

    @staticmethod
    def _build_initial_prompt(preprocessing: AudioPreprocessingResult) -> str:
        prompt = "한국어 회의록 전사입니다. 여러 사람이 참여하는 회의 대화입니다."
        prompt += " 잡음, 잔향, 에어컨 소리, 키보드 소리, 겹치는 발화는 무시하고 의미 있는 발화만 전사하세요."
        if preprocessing.is_noisy:
            prompt += " 녹음 품질이 좋지 않으므로 끊긴 단어, 중복 음절, 배경 잡음을 억지로 복원하지 말고 명확한 회의 발화만 남기세요."
        return prompt

    @staticmethod
    def _clean_transcript_text(text: str) -> str:
        cleaned = re.sub(r"\s+", " ", str(text or "")).strip()
        cleaned = cleaned.replace("…", ".")
        return cleaned

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
