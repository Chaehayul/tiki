"""Optional speaker diarization integration for meeting audio."""

from __future__ import annotations

import logging
import re
from abc import ABC, abstractmethod
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

from app.core.config import settings
from app.services.ai.audio_preprocessing import WhisperAudioPreprocessor

logger = logging.getLogger(__name__)
DIARIZATION_MERGE_GAP_SECONDS = 0.6


def _clean_label(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _normalize_diarization_turns(turns: list[dict[str, Any]]) -> list[dict[str, Any]]:
    parsed_turns: list[dict[str, Any]] = []
    for order, turn in enumerate(turns):
        try:
            start_seconds = float(turn.get("start_seconds") or 0.0)
            end_seconds = float(turn.get("end_seconds") or 0.0)
        except (TypeError, ValueError):
            continue

        if end_seconds <= start_seconds:
            continue

        speaker_id = _clean_label(turn.get("speaker_id") or turn.get("speaker_label") or turn.get("speaker") or f"speaker_{order + 1}")
        if not speaker_id:
            continue

        speaker_label = _clean_label(turn.get("speaker_label") or turn.get("speaker") or speaker_id) or speaker_id
        parsed_turns.append(
            {
                "turn_index": order,
                "start_seconds": round(start_seconds, 3),
                "end_seconds": round(end_seconds, 3),
                "speaker_id": speaker_id,
                "speaker_label": speaker_label,
                "speaker": speaker_label,
            }
        )

    parsed_turns.sort(key=lambda row: (row["start_seconds"], row["end_seconds"], row["turn_index"]))

    normalized: list[dict[str, Any]] = []
    for turn in parsed_turns:
        if normalized:
            previous = normalized[-1]
            same_speaker = previous["speaker_id"] == turn["speaker_id"]
            close_gap = float(turn["start_seconds"]) - float(previous["end_seconds"]) <= DIARIZATION_MERGE_GAP_SECONDS
            if same_speaker and close_gap:
                previous["end_seconds"] = round(max(float(previous["end_seconds"]), float(turn["end_seconds"])), 3)
                continue

        normalized.append(turn)

    for index, turn in enumerate(normalized):
        turn["turn_index"] = index

    return normalized


class SpeakerDiarizationService(ABC):
    @abstractmethod
    def diarize(
        self,
        audio_path: str,
        *,
        samples: Any | None = None,
        sample_rate: int | None = None,
    ) -> list[dict[str, Any]]:
        raise NotImplementedError


class NoopSpeakerDiarizationService(SpeakerDiarizationService):
    def diarize(
        self,
        audio_path: str,
        *,
        samples: Any | None = None,
        sample_rate: int | None = None,
    ) -> list[dict[str, Any]]:
        return []


class PyannoteSpeakerDiarizationService(SpeakerDiarizationService):
    def __init__(
        self,
        model_name: str | None = None,
        token: str | None = None,
        enabled: bool = True,
    ) -> None:
        self.model_name = model_name or settings.diarization_model
        self.token = token or settings.huggingface_token
        self.enabled = enabled

    @staticmethod
    def _resolve_device_name() -> str:
        try:
            import torch
        except ImportError as exc:  # pragma: no cover - optional dependency
            raise RuntimeError("torch is required for pyannote diarization but is not installed.") from exc

        if torch.cuda.is_available():
            return "cuda"

        mps = getattr(torch.backends, "mps", None)
        if mps is not None and mps.is_available():
            return "mps"

        return "cpu"

    @staticmethod
    @lru_cache(maxsize=4)
    def _load_pipeline(model_name: str, token: str | None, device_name: str):
        try:
            from pyannote.audio import Pipeline
        except ImportError as exc:  # pragma: no cover - optional dependency
            raise RuntimeError(
                "pyannote.audio is not installed. Add it to backend requirements to enable diarization."
            ) from exc

        if not token:
            raise RuntimeError(
                "A Hugging Face token is required for pyannote diarization. Set HF_TOKEN or HUGGINGFACE_ACCESS_TOKEN."
            )

        logger.info("Loading diarization pipeline: %s", model_name)
        try:
            pipeline = Pipeline.from_pretrained(model_name, token=token)
        except TypeError:
            pipeline = Pipeline.from_pretrained(model_name, use_auth_token=token)

        if device_name != "cpu":
            try:
                import torch

                pipeline.to(torch.device(device_name))
                logger.info("Moved diarization pipeline to %s", device_name)
            except Exception as exc:  # pragma: no cover - device fallback path
                logger.warning("Falling back to CPU diarization because %s device setup failed: %s", device_name, exc)

        return pipeline

    def diarize(
        self,
        audio_path: str,
        *,
        samples: Any | None = None,
        sample_rate: int | None = None,
    ) -> list[dict[str, Any]]:
        if not self.enabled:
            return []
        try:
            import torch
        except ImportError as exc:  # pragma: no cover - optional dependency
            raise RuntimeError("torch is required for pyannote diarization but is not installed.") from exc

        path = Path(audio_path)
        if not path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        if samples is None or sample_rate is None:
            preprocessor = WhisperAudioPreprocessor()
            samples = preprocessor.load_audio(path)
            sample_rate = preprocessor.sample_rate

        waveform = torch.from_numpy(np.asarray(samples, dtype=np.float32)).unsqueeze(0)
        device_name = self._resolve_device_name()
        pipeline = self._load_pipeline(self.model_name, self.token, device_name)
        try:
            diarization = pipeline({"waveform": waveform, "sample_rate": sample_rate})
        except Exception as exc:
            try:
                diarization = pipeline(str(path))
            except Exception as path_exc:
                raise RuntimeError(f"Failed to diarize audio with {self.model_name}: {exc}") from path_exc

        annotation = getattr(diarization, "speaker_diarization", diarization)
        if not hasattr(annotation, "itertracks"):
            raise RuntimeError("Diarization pipeline returned an unsupported result type.")

        turns: list[dict[str, Any]] = []
        for turn, _track, speaker in annotation.itertracks(yield_label=True):
            turns.append(
                {
                    "start_seconds": round(float(turn.start), 3),
                    "end_seconds": round(float(turn.end), 3),
                    "speaker_id": str(speaker),
                }
            )

        return _normalize_diarization_turns(turns)


def build_speaker_diarization_service() -> SpeakerDiarizationService:
    if not settings.diarization_enabled:
        return NoopSpeakerDiarizationService()
    return PyannoteSpeakerDiarizationService()
