"""Optional speaker diarization integration for meeting audio."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


class SpeakerDiarizationService(ABC):
    @abstractmethod
    def diarize(self, audio_path: str) -> list[dict[str, Any]]:
        raise NotImplementedError


class NoopSpeakerDiarizationService(SpeakerDiarizationService):
    def diarize(self, audio_path: str) -> list[dict[str, Any]]:
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
    @lru_cache(maxsize=2)
    def _load_pipeline(model_name: str, token: str | None):
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
            return Pipeline.from_pretrained(model_name, token=token)
        except TypeError:
            return Pipeline.from_pretrained(model_name, use_auth_token=token)

    def diarize(self, audio_path: str) -> list[dict[str, Any]]:
        if not self.enabled:
            return []

        path = Path(audio_path)
        if not path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        pipeline = self._load_pipeline(self.model_name, self.token)
        try:
            diarization = pipeline(str(path))
        except Exception as exc:
            raise RuntimeError(f"Failed to diarize audio with {self.model_name}: {exc}") from exc

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

        return turns


def build_speaker_diarization_service() -> SpeakerDiarizationService:
    if not settings.diarization_enabled:
        return NoopSpeakerDiarizationService()
    return PyannoteSpeakerDiarizationService()
