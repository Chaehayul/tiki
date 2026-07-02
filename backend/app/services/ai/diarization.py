"""Optional speaker diarization integration for meeting audio."""

from __future__ import annotations

import os
import logging
import platform
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

from app.core.config import settings
from app.services.ai.audio_preprocessing import WhisperAudioPreprocessor

os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

logger = logging.getLogger(__name__)
# 같은 화자 내부의 아주 짧은 끊김만 합치고, 경계가 흔들릴 수 있는 구간은 보수적으로 유지한다.
DIARIZATION_MERGE_GAP_SECONDS = 0.35
TORCH_THREAD_LIMIT = 8
# VAD는 무음 구간을 줄이되, 화자 전환 경계를 너무 많이 잘라내지 않도록 보수적으로 유지한다.
VAD_MIN_SPEECH_SECONDS = 0.25
VAD_MIN_GAP_SECONDS = 0.18
VAD_SPEECH_PAD_SECONDS = 0.18
VAD_SEPARATOR_SECONDS = 0.12
VAD_FALLBACK_ENERGY_THRESHOLD = 0.01


@dataclass(slots=True)
class _SpeechWindow:
    compressed_start_seconds: float
    compressed_end_seconds: float
    original_start_seconds: float
    original_end_seconds: float


def _clean_label(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _merge_intervals(intervals: list[tuple[float, float]], *, max_gap_seconds: float) -> list[tuple[float, float]]:
    if not intervals:
        return []

    merged: list[tuple[float, float]] = []
    for start_seconds, end_seconds in sorted(intervals, key=lambda interval: (interval[0], interval[1])):
        if end_seconds <= start_seconds:
            continue
        if not merged:
            merged.append((start_seconds, end_seconds))
            continue

        previous_start, previous_end = merged[-1]
        if start_seconds - previous_end <= max_gap_seconds:
            merged[-1] = (previous_start, max(previous_end, end_seconds))
        else:
            merged.append((start_seconds, end_seconds))
    return merged


def _sum_interval_durations(intervals: list[tuple[float, float]]) -> float:
    total = 0.0
    for start_seconds, end_seconds in intervals:
        if end_seconds <= start_seconds:
            continue
        total += end_seconds - start_seconds
    return total


def _estimate_energy_intervals(samples: np.ndarray, sample_rate: int) -> list[tuple[float, float]]:
    if samples.size == 0:
        return []

    frame_size = max(1, int(sample_rate * 0.03))
    hop_size = max(1, int(frame_size * 0.5))
    active_frames: list[tuple[float, float]] = []

    for start_index in range(0, max(len(samples) - frame_size + 1, 1), hop_size):
        frame = samples[start_index : start_index + frame_size]
        if frame.size == 0:
            continue
        energy = float(np.sqrt(np.mean(np.square(frame, dtype=np.float32), dtype=np.float32)))
        if energy >= VAD_FALLBACK_ENERGY_THRESHOLD:
            start_seconds = start_index / float(sample_rate)
            end_seconds = min(len(samples), start_index + frame_size) / float(sample_rate)
            active_frames.append((start_seconds, end_seconds))

    return _merge_intervals(active_frames, max_gap_seconds=VAD_MIN_GAP_SECONDS)


def _build_compacted_waveform(
    samples: np.ndarray,
    sample_rate: int,
    intervals: list[tuple[float, float]],
) -> tuple[np.ndarray, list[_SpeechWindow]]:
    compacted_chunks: list[np.ndarray] = []
    windows: list[_SpeechWindow] = []
    cursor_samples = 0
    separator_samples = max(1, int(sample_rate * VAD_SEPARATOR_SECONDS))
    padding_samples = max(0, int(sample_rate * VAD_SPEECH_PAD_SECONDS))
    total_intervals = len(intervals)

    for index, (start_seconds, end_seconds) in enumerate(intervals):
        start_sample = max(0, int(round(start_seconds * sample_rate)) - padding_samples)
        end_sample = min(len(samples), int(round(end_seconds * sample_rate)) + padding_samples)
        if end_sample <= start_sample:
            continue

        chunk = np.asarray(samples[start_sample:end_sample], dtype=np.float32)
        if chunk.size == 0:
            continue

        compressed_start_seconds = cursor_samples / float(sample_rate)
        compressed_end_seconds = (cursor_samples + len(chunk)) / float(sample_rate)
        windows.append(
            _SpeechWindow(
                compressed_start_seconds=compressed_start_seconds,
                compressed_end_seconds=compressed_end_seconds,
                original_start_seconds=start_sample / float(sample_rate),
                original_end_seconds=end_sample / float(sample_rate),
            )
        )
        compacted_chunks.append(chunk)
        cursor_samples += len(chunk)

        if index < total_intervals - 1:
            compacted_chunks.append(np.zeros(separator_samples, dtype=np.float32))
            cursor_samples += separator_samples

    if not compacted_chunks:
        return np.asarray(samples, dtype=np.float32), []

    return np.concatenate(compacted_chunks).astype(np.float32, copy=False), windows


def _summarize_vad_windows(
    *,
    original_samples: np.ndarray,
    sample_rate: int,
    speech_windows: list[_SpeechWindow],
) -> dict[str, Any]:
    original_seconds = len(original_samples) / float(sample_rate) if sample_rate > 0 else 0.0
    speech_ranges = _merge_intervals(
        [
            (window.original_start_seconds, window.original_end_seconds)
            for window in speech_windows
            if window.original_end_seconds > window.original_start_seconds
        ],
        max_gap_seconds=0.0,
    )
    speech_seconds = _sum_interval_durations(speech_ranges)
    removed_seconds = max(0.0, original_seconds - speech_seconds)
    return {
        "vad_mode": "silero_pretrimmed" if speech_windows else "full_audio_fallback",
        "diarization_input_mode": "compacted_waveform" if speech_windows else "full_waveform",
        "vad_enabled": bool(speech_windows),
        "vad_window_count": len(speech_windows),
        "vad_original_seconds": round(original_seconds, 3),
        "vad_speech_seconds": round(speech_seconds, 3),
        "vad_removed_seconds": round(removed_seconds, 3),
        "vad_retained_ratio": round((speech_seconds / original_seconds), 4) if original_seconds > 0 else 0.0,
        "vad_compaction_ratio": round((original_seconds / speech_seconds), 4) if speech_seconds > 0 else None,
    }


def _map_compacted_time_to_original(
    time_seconds: float,
    windows: list[_SpeechWindow],
    *,
    prefer: str = "start",
) -> float:
    if not windows:
        return time_seconds

    prefer_start = prefer != "end"
    for index, window in enumerate(windows):
        if window.compressed_start_seconds <= time_seconds <= window.compressed_end_seconds:
            offset_seconds = time_seconds - window.compressed_start_seconds
            return window.original_start_seconds + offset_seconds

        if time_seconds < window.compressed_start_seconds:
            if prefer_start:
                return window.original_start_seconds
            if index > 0:
                return windows[index - 1].original_end_seconds
            return window.original_start_seconds

    return windows[-1].original_end_seconds


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
        self._last_vad_summary: dict[str, Any] | None = None

    @staticmethod
    def _resolve_device_name() -> str:
        try:
            import torch
        except ImportError as exc:  # pragma: no cover - optional dependency
            raise RuntimeError("torch is required for pyannote diarization but is not installed.") from exc

        if platform.system() == "Darwin":
            if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                return "mps"
            return "cpu"

        if platform.system() in {"Windows", "Linux"} and torch.cuda.is_available():
            return "cuda"

        return "cpu"

    @staticmethod
    def _configure_torch_threads() -> None:
        try:
            import torch
        except ImportError:  # pragma: no cover - dependency should exist when this runs
            return

        cpu_threads = min(TORCH_THREAD_LIMIT, os.cpu_count() or TORCH_THREAD_LIMIT)
        try:
            torch.set_num_threads(cpu_threads)
        except Exception:  # pragma: no cover - best effort tuning
            logger.debug("Failed to set torch num threads", exc_info=True)
        try:
            torch.set_num_interop_threads(1)
        except Exception:  # pragma: no cover - best effort tuning
            logger.debug("Failed to set torch interop threads", exc_info=True)

    @staticmethod
    def _clear_device_cache(device_name: str) -> None:
        try:
            import torch
        except ImportError:  # pragma: no cover - dependency should exist when this runs
            return

        if device_name == "cuda" and torch.cuda.is_available():
            try:
                torch.cuda.empty_cache()
            except Exception:  # pragma: no cover - best effort cleanup
                logger.debug("Failed to clear CUDA cache", exc_info=True)

        if device_name == "mps":
            mps = getattr(torch, "mps", None)
            if mps is None:
                mps = getattr(torch.backends, "mps", None)
            if mps is not None and hasattr(mps, "empty_cache"):
                try:
                    mps.empty_cache()
                except Exception:  # pragma: no cover - best effort cleanup
                    logger.debug("Failed to clear MPS cache", exc_info=True)

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

    @staticmethod
    @lru_cache(maxsize=1)
    def _load_silero_vad_model():
        try:
            from silero_vad import load_silero_vad
        except ImportError as exc:  # pragma: no cover - optional dependency
            raise RuntimeError(
                "silero-vad is required for VAD-assisted diarization. Install backend dependencies to enable it."
            ) from exc

        return load_silero_vad()

    def _extract_speech_windows(self, samples: np.ndarray, sample_rate: int) -> tuple[np.ndarray, list[_SpeechWindow]]:
        if samples.size == 0:
            return np.asarray(samples, dtype=np.float32), []

        try:
            from silero_vad import get_speech_timestamps

            vad_model = self._load_silero_vad_model()
            speech_timestamps = get_speech_timestamps(
                audio=np.asarray(samples, dtype=np.float32),
                model=vad_model,
                sampling_rate=sample_rate,
                threshold=0.5,
                min_speech_duration_ms=int(VAD_MIN_SPEECH_SECONDS * 1000),
                min_silence_duration_ms=int(VAD_MIN_GAP_SECONDS * 1000),
                speech_pad_ms=int(VAD_SPEECH_PAD_SECONDS * 1000),
            )
            intervals = [
                (timestamp["start"] / float(sample_rate), timestamp["end"] / float(sample_rate))
                for timestamp in speech_timestamps
                if timestamp.get("end", 0) > timestamp.get("start", 0)
            ]
        except Exception as exc:  # pragma: no cover - fallback path
            logger.warning("silero-vad unavailable for diarization, falling back to energy filter: %s", exc)
            intervals = _estimate_energy_intervals(samples, sample_rate)

        intervals = _merge_intervals(intervals, max_gap_seconds=VAD_MIN_GAP_SECONDS)
        intervals = [
            (max(0.0, start_seconds), min(len(samples) / float(sample_rate), end_seconds))
            for start_seconds, end_seconds in intervals
            if end_seconds - start_seconds >= VAD_MIN_SPEECH_SECONDS
        ]

        if not intervals:
            intervals = [(0.0, len(samples) / float(sample_rate))]

        compacted_waveform, windows = _build_compacted_waveform(np.asarray(samples, dtype=np.float32), sample_rate, intervals)
        if not windows:
            return np.asarray(samples, dtype=np.float32), []

        return compacted_waveform, windows

    def diarize(
        self,
        audio_path: str,
        *,
        samples: Any | None = None,
        sample_rate: int | None = None,
        num_speakers: int | None = None,
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

        device_name = self._resolve_device_name()
        self._configure_torch_threads()
        pipeline = self._load_pipeline(self.model_name, self.token, device_name)
        compacted_samples, speech_windows = self._extract_speech_windows(np.asarray(samples, dtype=np.float32), sample_rate)
        vad_summary = _summarize_vad_windows(
            original_samples=np.asarray(samples, dtype=np.float32),
            sample_rate=sample_rate,
            speech_windows=speech_windows,
        )
        self._last_vad_summary = vad_summary
        compacted_waveform = torch.from_numpy(np.asarray(compacted_samples, dtype=np.float32)).unsqueeze(0)
        total_speech_seconds = (
            vad_summary["vad_speech_seconds"] if speech_windows else float(len(samples) / float(sample_rate))
        )
        logger.info(
            "Starting diarization inference for %s (device=%s, sample_rate=%s, waveform_shape=%s, speech_windows=%s, vad_mode=%s, speech_ratio=%.4f, num_speakers=%s)",
            path.name,
            device_name,
            sample_rate,
            tuple(compacted_waveform.shape),
            len(speech_windows) if speech_windows else 0,
            vad_summary["vad_mode"],
            vad_summary["vad_retained_ratio"],
            num_speakers if num_speakers else "auto",
        )
        try:
            try:
                inference_kwargs: dict[str, Any] = {}
                if num_speakers and num_speakers > 0:
                    inference_kwargs["num_speakers"] = num_speakers
                with torch.inference_mode():
                    diarization = pipeline({"waveform": compacted_waveform, "sample_rate": sample_rate}, **inference_kwargs)
            except Exception as exc:
                try:
                    with torch.inference_mode():
                        diarization = pipeline(str(path), **({"num_speakers": num_speakers} if num_speakers and num_speakers > 0 else {}))
                except Exception as path_exc:
                    raise RuntimeError(f"Failed to diarize audio with {self.model_name}: {exc}") from path_exc

            annotation = getattr(diarization, "speaker_diarization", diarization)
            if not hasattr(annotation, "itertracks"):
                raise RuntimeError("Diarization pipeline returned an unsupported result type.")

            turns: list[dict[str, Any]] = []
            for turn, _track, speaker in annotation.itertracks(yield_label=True):
                mapped_start = _map_compacted_time_to_original(float(turn.start), speech_windows, prefer="start")
                mapped_end = _map_compacted_time_to_original(float(turn.end), speech_windows, prefer="end")
                if mapped_end <= mapped_start:
                    continue
                turns.append(
                    {
                        "start_seconds": round(mapped_start, 3),
                        "end_seconds": round(mapped_end, 3),
                        "speaker_id": str(speaker),
                    }
                )

            logger.info(
                "Diarization inference completed for %s (turns=%d, speakers=%d, speech_seconds=%.3f, original_seconds=%.3f)",
                path.name,
                len(turns),
                len({turn["speaker_id"] for turn in turns}),
                float(total_speech_seconds),
                len(samples) / float(sample_rate),
            )
            normalized_turns = _normalize_diarization_turns(turns)
            return normalized_turns
        finally:
            self._clear_device_cache(device_name)


def build_speaker_diarization_service() -> SpeakerDiarizationService:
    enabled = bool(settings.diarization_enabled or settings.huggingface_token)
    if not enabled:
        return NoopSpeakerDiarizationService()
    return PyannoteSpeakerDiarizationService(enabled=enabled)
