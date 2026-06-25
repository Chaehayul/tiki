"""Audio preprocessing helpers for Whisper STT."""

from __future__ import annotations

import logging
import hashlib
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class AudioChunk:
    index: int
    start_seconds: float
    end_seconds: float
    samples: Any
    core_start_seconds: float | None = None
    core_end_seconds: float | None = None

    @property
    def duration_seconds(self) -> float:
        return max(0.0, self.end_seconds - self.start_seconds)

    def to_dict(self) -> dict[str, Any]:
        payload = {
            "index": self.index,
            "start_seconds": round(self.start_seconds, 3),
            "end_seconds": round(self.end_seconds, 3),
            "duration_seconds": round(self.duration_seconds, 3),
            "sample_count": int(self.samples.shape[0]),
        }
        if self.core_start_seconds is not None:
            payload["core_start_seconds"] = round(self.core_start_seconds, 3)
        if self.core_end_seconds is not None:
            payload["core_end_seconds"] = round(self.core_end_seconds, 3)
        return payload


@dataclass(slots=True)
class AudioPreprocessingResult:
    source_path: str
    sample_rate: int
    duration_seconds: float
    strategy: str
    chunking_enabled: bool
    samples: Any | None = None
    chunks: list[AudioChunk] = field(default_factory=list)
    load_metadata: dict[str, Any] = field(default_factory=dict)
    quality_flags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_path": self.source_path,
            "sample_rate": self.sample_rate,
            "duration_seconds": round(self.duration_seconds, 3),
            "strategy": self.strategy,
            "chunking_enabled": self.chunking_enabled,
            "chunk_count": len(self.chunks),
            "chunks": [chunk.to_dict() for chunk in self.chunks],
            "load_metadata": dict(self.load_metadata),
            "quality_flags": list(self.quality_flags),
        }

    @property
    def is_noisy(self) -> bool:
        return bool(self.load_metadata.get("raw_noisy") or self.load_metadata.get("noisy_recording"))


class WhisperAudioPreprocessor:
    """Split long audio into Whisper-friendly chunks.

    The first pass uses simple energy-based silence detection so we can keep the
    implementation lightweight and dependency-free. If no usable silence is
    detected, the audio falls back to fixed-size hard splitting.

    The defaults are tuned for meeting recordings:
    - keep short meetings intact when possible,
    - avoid overly tiny chunks that hurt context,
    - still cap very long segments so Whisper stays stable.
    """

    def __init__(
        self,
        sample_rate: int = 16_000,
        frame_ms: int = 30,
        min_silence_seconds: float = 1.2,
        min_chunk_seconds: float = 45.0,
        max_chunk_seconds: float = 180.0,
        transcription_overlap_seconds: float = 0.85,
        noisy_split_threshold_seconds: float = 90.0,
        noisy_fixed_window_seconds: float = 60.0,
        noisy_chunk_overlap_seconds: float = 3.0,
        padding_seconds: float = 0.25,
        absolute_silence_floor: float = 0.0025,
    ) -> None:
        self.sample_rate = sample_rate
        self.frame_ms = frame_ms
        self.min_silence_seconds = min_silence_seconds
        self.min_chunk_seconds = min_chunk_seconds
        self.max_chunk_seconds = max_chunk_seconds
        self.transcription_overlap_seconds = transcription_overlap_seconds
        self.noisy_split_threshold_seconds = noisy_split_threshold_seconds
        self.noisy_fixed_window_seconds = noisy_fixed_window_seconds
        self.noisy_chunk_overlap_seconds = noisy_chunk_overlap_seconds
        self.padding_seconds = padding_seconds
        self.absolute_silence_floor = absolute_silence_floor

    @staticmethod
    @lru_cache(maxsize=1)
    def _load_audio_loader():
        try:
            from whisper.audio import load_audio
        except ImportError as exc:  # pragma: no cover - dependency should exist in backend env
            raise RuntimeError(
                "openai-whisper is not installed. Add it to backend requirements before using STT."
            ) from exc

        return load_audio

    @staticmethod
    @lru_cache(maxsize=1)
    def _load_numpy():
        try:
            import numpy as np
        except ImportError as exc:  # pragma: no cover - optional in local dev env
            raise RuntimeError(
                "numpy is required for audio chunking. Install backend dependencies to enable STT preprocessing."
            ) from exc

        return np

    def load_audio(self, audio_path: str | Path) -> np.ndarray:
        np = self._load_numpy()
        path = Path(audio_path)
        if not path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        load_audio = self._load_audio_loader()
        samples = load_audio(str(path))
        if not isinstance(samples, np.ndarray):
            samples = np.asarray(samples, dtype=np.float32)

        if samples.ndim != 1:
            samples = np.asarray(samples).reshape(-1).astype(np.float32, copy=False)

        samples = samples.astype(np.float32, copy=False)
        raw_profile = self._estimate_energy_profile(samples)
        raw_noisy = self._looks_noisy(samples)
        ffmpeg_denoised = False
        stationary_noise_suppressed = False
        if raw_noisy:
            denoised_path = self._try_ffmpeg_denoise(path)
            if denoised_path is not None:
                try:
                    samples = load_audio(str(denoised_path))
                    if not isinstance(samples, np.ndarray):
                        samples = np.asarray(samples, dtype=np.float32)
                    if samples.ndim != 1:
                        samples = np.asarray(samples).reshape(-1).astype(np.float32, copy=False)
                    samples = samples.astype(np.float32, copy=False)
                    ffmpeg_denoised = True
                    logger.info("Applied ffmpeg denoise for %s", path.name)
                except Exception as exc:  # pragma: no cover - fallback path
                    logger.warning("ffmpeg denoise failed for %s: %s", path.name, exc)

        samples = self._remove_dc_and_low_freq(samples)
        samples = self._normalize_audio_level(samples)
        if self._looks_noisy(samples) and not ffmpeg_denoised:
            samples = self._suppress_stationary_noise(samples)
            samples = self._normalize_audio_level(samples)
            stationary_noise_suppressed = True

        post_profile = self._estimate_energy_profile(samples)
        quality_flags: list[str] = []
        if raw_noisy:
            quality_flags.append("raw_noise_detected")
        if ffmpeg_denoised:
            quality_flags.append("ffmpeg_denoised")
        if stationary_noise_suppressed:
            quality_flags.append("stationary_noise_suppressed")
        if post_profile:
            if post_profile["active_ratio"] >= 0.8:
                quality_flags.append("dense_audio_activity")
            if post_profile["noise_floor"] / max(post_profile["peak"], 1e-7) >= 0.18:
                quality_flags.append("residual_background_noise")

        self._last_load_metadata = {
            "source_path": str(path),
            "raw_noisy": raw_noisy,
            "ffmpeg_denoised": ffmpeg_denoised,
            "stationary_noise_suppressed": stationary_noise_suppressed,
            "raw_profile": raw_profile,
            "post_profile": post_profile,
            "quality_flags": quality_flags,
        }
        return samples

    def _try_ffmpeg_denoise(self, audio_path: Path) -> Path | None:
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            return None

        cache_dir = Path(tempfile.gettempdir()) / "tiki_audio_cache"
        cache_dir.mkdir(parents=True, exist_ok=True)

        stat = audio_path.stat()
        cache_key = hashlib.sha1(f"{audio_path.resolve()}|{stat.st_mtime_ns}|{stat.st_size}".encode("utf-8")).hexdigest()
        output_path = cache_dir / f"{cache_key}.wav"
        if output_path.exists():
            return output_path

        filter_chain = "highpass=f=90,lowpass=f=7200,afftdn=nr=28:nf=-55:tn=1:tr=1"
        command = [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(audio_path),
            "-ac",
            "1",
            "-ar",
            str(self.sample_rate),
            "-af",
            filter_chain,
            "-c:a",
            "pcm_s16le",
            str(output_path),
        ]

        try:
            subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            return None

        return output_path

    def prepare(self, audio_path: str | Path) -> AudioPreprocessingResult:
        path = Path(audio_path)
        samples = self.load_audio(path)
        duration_seconds = len(samples) / float(self.sample_rate) if len(samples) else 0.0
        load_meta = getattr(self, "_last_load_metadata", {})
        raw_noisy = bool(load_meta.get("raw_noisy"))
        ffmpeg_denoised = bool(load_meta.get("ffmpeg_denoised"))
        quality_flags = list(load_meta.get("quality_flags", []) or [])

        if duration_seconds == 0:
            chunk = AudioChunk(index=0, start_seconds=0.0, end_seconds=0.0, samples=samples, core_start_seconds=0.0, core_end_seconds=0.0)
            return AudioPreprocessingResult(
                source_path=str(path),
                sample_rate=self.sample_rate,
                duration_seconds=0.0,
                strategy="empty",
                chunking_enabled=False,
                samples=samples,
                chunks=[chunk],
                load_metadata=dict(load_meta),
                quality_flags=quality_flags,
            )

        if ffmpeg_denoised and duration_seconds <= 30 * 60 and not raw_noisy:
            chunk = AudioChunk(
                index=0,
                start_seconds=0.0,
                end_seconds=duration_seconds,
                samples=samples,
                core_start_seconds=0.0,
                core_end_seconds=duration_seconds,
            )
            return AudioPreprocessingResult(
                source_path=str(path),
                sample_rate=self.sample_rate,
                duration_seconds=duration_seconds,
                strategy="ffmpeg_denoised_single_chunk",
                chunking_enabled=False,
                samples=samples,
                chunks=[chunk],
                load_metadata=dict(load_meta),
                quality_flags=quality_flags,
            )

        noisy_recording = self._should_force_quality_split(samples, duration_seconds) or raw_noisy
        if noisy_recording:
            quality_flags.append("forced_quality_split")

        if duration_seconds <= self.max_chunk_seconds and not noisy_recording:
            chunk = AudioChunk(
                index=0,
                start_seconds=0.0,
                end_seconds=duration_seconds,
                samples=samples,
                core_start_seconds=0.0,
                core_end_seconds=duration_seconds,
            )
            return AudioPreprocessingResult(
                source_path=str(path),
                sample_rate=self.sample_rate,
                duration_seconds=duration_seconds,
                strategy="single_chunk",
                chunking_enabled=False,
                samples=samples,
                chunks=[chunk],
                load_metadata={**load_meta, "noisy_recording": noisy_recording},
                quality_flags=quality_flags,
            )

        if noisy_recording:
            intervals = self._build_fixed_windows(duration_seconds)
            strategy = "noisy_fixed_window_split"
            chunk_specs = self._apply_overlap_to_intervals(
                intervals,
                duration_seconds,
                overlap_seconds=self.noisy_chunk_overlap_seconds,
            )
        else:
            intervals = self._detect_speech_intervals(samples, duration_seconds)
            if not intervals:
                intervals = self._build_fixed_windows(duration_seconds)
                strategy = "fixed_window_split"
            else:
                strategy = "silence_split" if len(intervals) > 1 else "single_chunk"

        intervals = self._merge_close_intervals(intervals)
        intervals = self._pad_intervals(intervals, duration_seconds)
        intervals = self._split_long_intervals(intervals)
        if noisy_recording:
            chunk_specs = self._apply_overlap_to_intervals(
                intervals,
                duration_seconds,
                overlap_seconds=self.noisy_chunk_overlap_seconds,
            )
        else:
            chunk_specs = self._apply_overlap_to_intervals(
                intervals,
                duration_seconds,
                overlap_seconds=self.transcription_overlap_seconds,
            )

        chunks = self._materialize_chunks(samples, chunk_specs)
        chunks = self._merge_short_chunks(chunks)
        chunks = [self._reindex_chunk(chunk, index) for index, chunk in enumerate(chunks)]

        if len(chunks) == 1 and noisy_recording and duration_seconds > self.noisy_split_threshold_seconds:
            intervals = self._build_fixed_windows(duration_seconds)
            chunk_specs = self._apply_overlap_to_intervals(
                intervals,
                duration_seconds,
                overlap_seconds=self.noisy_chunk_overlap_seconds,
            )
            chunks = self._materialize_chunks(samples, chunk_specs)
            chunks = self._merge_short_chunks(chunks)
            chunks = [self._reindex_chunk(chunk, index) for index, chunk in enumerate(chunks)]
            strategy = "noisy_fixed_window_split" if len(chunks) > 1 else "single_chunk"
        elif len(chunks) == 1:
            chunks = [AudioChunk(index=0, start_seconds=0.0, end_seconds=duration_seconds, samples=samples, core_start_seconds=0.0, core_end_seconds=duration_seconds)]

        return AudioPreprocessingResult(
            source_path=str(path),
            sample_rate=self.sample_rate,
            duration_seconds=duration_seconds,
            strategy=strategy,
            chunking_enabled=len(chunks) > 1,
            samples=samples,
            chunks=chunks,
            load_metadata={**load_meta, "noisy_recording": noisy_recording, "strategy": strategy},
            quality_flags=quality_flags,
        )

    def _normalize_audio_level(self, samples: np.ndarray) -> np.ndarray:
        np = self._load_numpy()
        if not len(samples):
            return samples.astype(np.float32, copy=False)

        peak = float(np.max(np.abs(samples)))
        if peak <= 0.0:
            return samples.astype(np.float32, copy=False)

        target_peak = 0.95
        scale = target_peak / peak
        if 0.85 <= scale <= 1.15:
            return samples.astype(np.float32, copy=False)

        # Keep the adjustment conservative so background noise does not get
        # over-amplified on very quiet recordings.
        scale = max(0.8, min(scale, 1.8))
        if scale == 1.0:
            return samples.astype(np.float32, copy=False)

        normalized = samples * scale
        return np.clip(normalized, -1.0, 1.0).astype(np.float32, copy=False)

    def _remove_dc_and_low_freq(self, samples: np.ndarray) -> np.ndarray:
        np = self._load_numpy()
        if not len(samples):
            return samples.astype(np.float32, copy=False)

        centered = samples - float(np.mean(samples))
        if len(centered) < 2:
            return centered.astype(np.float32, copy=False)

        # Gentle first-order high-pass filter to reduce rumble / HVAC hum.
        alpha = 0.995
        filtered = np.empty_like(centered, dtype=np.float32)
        filtered[0] = centered[0]
        for index in range(1, len(centered)):
            filtered[index] = alpha * (filtered[index - 1] + centered[index] - centered[index - 1])
        return np.clip(filtered, -1.0, 1.0).astype(np.float32, copy=False)

    def _looks_noisy(self, samples: np.ndarray) -> bool:
        profile = self._estimate_energy_profile(samples)
        if not profile:
            return False
        active_ratio = profile["active_ratio"]
        peak = profile["peak"]
        noise_floor = profile["noise_floor"]
        if peak <= 0.0:
            return False

        # Constant background noise usually keeps most frames active.
        return active_ratio >= 0.6 and noise_floor / peak >= 0.14

    def _suppress_stationary_noise(self, samples: np.ndarray) -> np.ndarray:
        np = self._load_numpy()
        if len(samples) == 0:
            return samples.astype(np.float32, copy=False)

        frame_size = int(self.sample_rate * 0.032)
        hop_size = max(1, frame_size // 2)
        window = np.hanning(frame_size).astype(np.float32)
        padded = self._pad_for_stft(samples, frame_size, hop_size)
        frames = self._frame_audio(padded, frame_size, hop_size)
        if frames.size == 0:
            return samples.astype(np.float32, copy=False)

        frame_rms = np.sqrt(np.mean(np.square(frames, dtype=np.float32), axis=1, dtype=np.float32))
        quiet_count = max(1, min(len(frames), int(round(len(frames) * 0.2))))
        quiet_indices = np.argsort(frame_rms)[:quiet_count]
        noise_frames = frames[quiet_indices]

        noise_spectrum = np.mean(np.abs(np.fft.rfft(noise_frames * window, axis=1)), axis=0)
        noise_floor = np.maximum(noise_spectrum, 1e-7)
        reduction = 0.8

        denoised_frames = np.empty_like(frames, dtype=np.float32)
        for index, frame in enumerate(frames):
            spectrum = np.fft.rfft(frame * window)
            magnitude = np.abs(spectrum)
            phase = np.exp(1j * np.angle(spectrum))
            cleaned_magnitude = magnitude - noise_floor * reduction
            cleaned_magnitude = np.maximum(cleaned_magnitude, noise_floor * 0.08)
            cleaned_spectrum = cleaned_magnitude * phase
            cleaned = np.fft.irfft(cleaned_spectrum, n=frame_size).astype(np.float32, copy=False)
            denoised_frames[index] = cleaned * window

        reconstructed = self._overlap_add(denoised_frames, len(padded), frame_size, hop_size)
        reconstructed = reconstructed[: len(samples)]
        return np.clip(reconstructed, -1.0, 1.0).astype(np.float32, copy=False)

    def _pad_for_stft(self, samples: np.ndarray, frame_size: int, hop_size: int) -> np.ndarray:
        np = self._load_numpy()
        if len(samples) == 0:
            return samples.astype(np.float32, copy=False)

        pad_length = frame_size
        padded = np.pad(samples, (pad_length, pad_length), mode="reflect")
        remainder = (len(padded) - frame_size) % hop_size
        if remainder:
            padded = np.pad(padded, (0, hop_size - remainder), mode="constant")
        return padded.astype(np.float32, copy=False)

    def _frame_audio(self, samples: np.ndarray, frame_size: int, hop_size: int) -> np.ndarray:
        np = self._load_numpy()
        if len(samples) < frame_size:
            return np.empty((0, frame_size), dtype=np.float32)

        frame_count = 1 + (len(samples) - frame_size) // hop_size
        frames = np.empty((frame_count, frame_size), dtype=np.float32)
        for index in range(frame_count):
            start = index * hop_size
            frames[index] = samples[start : start + frame_size]
        return frames

    def _overlap_add(self, frames: np.ndarray, output_length: int, frame_size: int, hop_size: int) -> np.ndarray:
        np = self._load_numpy()
        output = np.zeros(output_length, dtype=np.float32)
        window_sum = np.zeros(output_length, dtype=np.float32)
        window = np.hanning(frame_size).astype(np.float32)

        for index, frame in enumerate(frames):
            start = index * hop_size
            end = min(output_length, start + frame_size)
            length = end - start
            if length <= 0:
                continue
            output[start:end] += frame[:length] * window[:length]
            window_sum[start:end] += window[:length] ** 2

        nonzero = window_sum > 1e-7
        output[nonzero] /= window_sum[nonzero]
        return output

    def _should_force_quality_split(self, samples: np.ndarray, duration_seconds: float) -> bool:
        if duration_seconds < self.noisy_split_threshold_seconds:
            return False

        profile = self._estimate_energy_profile(samples)
        if not profile:
            return False

        active_ratio = profile["active_ratio"]
        peak = profile["peak"]
        noise_floor = profile["noise_floor"]
        if peak <= 0.0:
            return False

        # Meetings often have dense speech. Only force fixed windows when the
        # signal looks both dense and noisy enough that silence-based splitting
        # is unlikely to help.
        if active_ratio >= 0.92:
            return True

        if duration_seconds >= 180.0 and active_ratio >= 0.82 and noise_floor / peak >= 0.18:
            return True

        # Very flat energy profiles often mean constant background noise.
        if noise_floor / peak >= 0.22 and duration_seconds >= 120.0:
            return True

        return False

    def _estimate_energy_profile(self, samples: np.ndarray) -> dict[str, float] | None:
        np = self._load_numpy()
        frame_size = max(1, int(self.sample_rate * self.frame_ms / 1000))
        frame_count = int(np.ceil(len(samples) / frame_size))
        rms_values: list[float] = []

        for frame_index in range(frame_count):
            start = frame_index * frame_size
            end = min(len(samples), start + frame_size)
            frame = samples[start:end]
            if frame.size == 0:
                continue
            rms = float(np.sqrt(np.mean(np.square(frame, dtype=np.float32), dtype=np.float32)))
            rms_values.append(rms)

        if not rms_values:
            return None

        rms_array = np.asarray(rms_values, dtype=np.float32)
        noise_floor = float(np.percentile(rms_array, 20))
        peak = float(np.percentile(rms_array, 95))
        threshold = max(noise_floor * 1.6, self.absolute_silence_floor)
        active_ratio = float(np.mean(rms_array > threshold))
        return {
            "noise_floor": noise_floor,
            "peak": peak,
            "threshold": threshold,
            "active_ratio": active_ratio,
        }

    def _build_fixed_windows(self, duration_seconds: float) -> list[tuple[float, float]]:
        if duration_seconds <= 0:
            return []

        window_seconds = min(self.noisy_fixed_window_seconds, self.max_chunk_seconds)
        window_seconds = max(self.min_chunk_seconds, window_seconds)
        if duration_seconds <= window_seconds:
            return [(0.0, duration_seconds)]

        intervals: list[tuple[float, float]] = []
        cursor = 0.0
        while cursor < duration_seconds:
            end = min(duration_seconds, cursor + window_seconds)
            intervals.append((cursor, end))
            cursor = end
        return intervals

    def _detect_speech_intervals(self, samples: np.ndarray, duration_seconds: float) -> list[tuple[float, float]]:
        np = self._load_numpy()
        frame_size = max(1, int(self.sample_rate * self.frame_ms / 1000))
        frame_count = int(np.ceil(len(samples) / frame_size))
        rms_values: list[float] = []

        for frame_index in range(frame_count):
            start = frame_index * frame_size
            end = min(len(samples), start + frame_size)
            frame = samples[start:end]
            if frame.size == 0:
                continue
            rms = float(np.sqrt(np.mean(np.square(frame, dtype=np.float32), dtype=np.float32)))
            rms_values.append(rms)

        if not rms_values:
            return []

        rms_array = np.asarray(rms_values, dtype=np.float32)
        noise_floor = float(np.percentile(rms_array, 15))
        threshold = max(noise_floor * 1.8, self.absolute_silence_floor)
        active = rms_array > threshold

        intervals: list[tuple[float, float]] = []
        start_frame: int | None = None

        for index, is_active in enumerate(active):
            if is_active and start_frame is None:
                start_frame = index
            elif not is_active and start_frame is not None:
                intervals.append(self._frame_to_interval(start_frame, index))
                start_frame = None

        if start_frame is not None:
            intervals.append(self._frame_to_interval(start_frame, len(active)))

        return [(max(0.0, start), min(duration_seconds, end)) for start, end in intervals if end > start]

    def _frame_to_interval(self, start_frame: int, end_frame: int) -> tuple[float, float]:
        frame_duration = self.frame_ms / 1000.0
        return (start_frame * frame_duration, end_frame * frame_duration)

    def _merge_close_intervals(self, intervals: list[tuple[float, float]]) -> list[tuple[float, float]]:
        if not intervals:
            return []

        merged: list[tuple[float, float]] = [intervals[0]]
        for start, end in intervals[1:]:
            previous_start, previous_end = merged[-1]
            if start - previous_end <= self.min_silence_seconds:
                merged[-1] = (previous_start, max(previous_end, end))
            else:
                merged.append((start, end))
        return merged

    def _pad_intervals(self, intervals: list[tuple[float, float]], duration_seconds: float) -> list[tuple[float, float]]:
        padded: list[tuple[float, float]] = []
        for start, end in intervals:
            padded.append(
                (
                    max(0.0, start - self.padding_seconds),
                    min(duration_seconds, end + self.padding_seconds),
                )
            )
        return padded

    def _split_long_intervals(self, intervals: list[tuple[float, float]]) -> list[tuple[float, float]]:
        split_intervals: list[tuple[float, float]] = []
        for start, end in intervals:
            duration = end - start
            if duration <= self.max_chunk_seconds:
                split_intervals.append((start, end))
                continue

            cursor = start
            while cursor < end:
                next_end = min(end, cursor + self.max_chunk_seconds)
                split_intervals.append((cursor, next_end))
                cursor = next_end
        return split_intervals

    def _materialize_chunks(self, samples: np.ndarray, intervals: list[tuple[float, float]]) -> list[AudioChunk]:
        chunks: list[AudioChunk] = []
        for index, spec in enumerate(intervals):
            if len(spec) == 4:
                start, end, core_start, core_end = spec
            else:
                start, end = spec  # type: ignore[misc]
                core_start, core_end = start, end
            start_sample = max(0, int(start * self.sample_rate))
            end_sample = min(len(samples), int(end * self.sample_rate))
            if end_sample <= start_sample:
                continue

            chunk_samples = samples[start_sample:end_sample]
            chunks.append(
                AudioChunk(
                    index=index,
                    start_seconds=start,
                    end_seconds=end,
                    samples=chunk_samples,
                    core_start_seconds=core_start,
                    core_end_seconds=core_end,
                )
            )

        if not chunks and len(samples):
            chunks.append(
                AudioChunk(
                    index=0,
                    start_seconds=0.0,
                    end_seconds=len(samples) / self.sample_rate,
                    samples=samples,
                    core_start_seconds=0.0,
                    core_end_seconds=len(samples) / self.sample_rate,
                )
            )

        return chunks

    def _merge_short_chunks(self, chunks: list[AudioChunk]) -> list[AudioChunk]:
        np = self._load_numpy()
        if not chunks:
            return []

        merged: list[AudioChunk] = []
        for chunk in chunks:
            if merged and chunk.duration_seconds < self.min_chunk_seconds:
                previous = merged[-1]
                merged_duration = max(0.0, chunk.end_seconds - previous.start_seconds)
                if previous.duration_seconds < self.min_chunk_seconds or merged_duration <= self.max_chunk_seconds * 1.15:
                    merged[-1] = AudioChunk(
                        index=previous.index,
                        start_seconds=previous.start_seconds,
                        end_seconds=chunk.end_seconds,
                        samples=np.concatenate((previous.samples, chunk.samples)),
                        core_start_seconds=previous.core_start_seconds if previous.core_start_seconds is not None else previous.start_seconds,
                        core_end_seconds=chunk.core_end_seconds if chunk.core_end_seconds is not None else chunk.end_seconds,
                    )
                    continue
            merged.append(chunk)
        return merged

    @staticmethod
    def _reindex_chunk(chunk: AudioChunk, index: int) -> AudioChunk:
        return AudioChunk(
            index=index,
            start_seconds=chunk.start_seconds,
            end_seconds=chunk.end_seconds,
            samples=chunk.samples,
            core_start_seconds=chunk.core_start_seconds,
            core_end_seconds=chunk.core_end_seconds,
        )

    def _intervals_to_specs(self, intervals: list[tuple[float, float]]) -> list[tuple[float, float, float, float]]:
        return [(start, end, start, end) for start, end in intervals]

    def _apply_overlap_to_intervals(
        self,
        intervals: list[tuple[float, float]],
        duration_seconds: float,
        *,
        overlap_seconds: float,
    ) -> list[tuple[float, float, float, float]]:
        if not intervals:
            return []

        overlap = max(0.0, min(overlap_seconds, self.min_chunk_seconds / 2))
        specs: list[tuple[float, float, float, float]] = []
        for index, (core_start, core_end) in enumerate(intervals):
            actual_start = core_start
            actual_end = core_end
            if index > 0:
                actual_start = max(0.0, core_start - overlap)
            if index < len(intervals) - 1:
                actual_end = min(duration_seconds, core_end + overlap)
            specs.append((actual_start, actual_end, core_start, core_end))
        return specs


def prepare_audio_chunks(audio_path: str | Path) -> AudioPreprocessingResult:
    return WhisperAudioPreprocessor().prepare(audio_path)
