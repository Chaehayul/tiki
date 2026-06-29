"""Parallel Whisper inference infrastructure.

Each worker thread owns its own Whisper model instance so there is no
model-level contention. The main thread handles all segment filtering and
assembly after inference completes.
"""

from __future__ import annotations

import os
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from app.services.ai.audio_preprocessing import AudioChunk
from app.services.ai.stt import WhisperSpeechToTextService

os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

logger = logging.getLogger(__name__)

_thread_local = threading.local()

DEFAULT_WORKER_COUNT = 2


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


def _get_thread_model(model_name: str, device_name: str) -> Any:
    """Return a Whisper model for the current thread, loading it on first use."""
    if not hasattr(_thread_local, "models"):
        _thread_local.models: dict[str, Any] = {}
    cache_key = f"{model_name}:{device_name}"
    if cache_key not in _thread_local.models:
        logger.info(
            "Worker thread '%s' loading Whisper model '%s'",
            threading.current_thread().name,
            model_name,
        )
        _thread_local.models[cache_key] = WhisperSpeechToTextService._load_model(model_name, device_name)
    return _thread_local.models[cache_key]


def _transcribe_one_chunk(
    chunk: AudioChunk,
    model_name: str,
    options: dict[str, Any],
    device_name: str,
) -> tuple[int, dict[str, Any]]:
    """Transcribe a single chunk in the calling thread.

    Returns ``(chunk_index, raw_whisper_result)``.
    """
    try:
        model = _get_thread_model(model_name, device_name)
        result = model.transcribe(chunk.samples, **options)
        return chunk.index, {
            "text": str(result.get("text") or ""),
            "segments": list(result.get("segments") or []),
        }
    except Exception as exc:
        logger.error("Chunk %d transcription error: %s", chunk.index, exc)
        return chunk.index, {"text": "", "segments": [], "error": str(exc)}


def transcribe_chunks_parallel(
    chunks: list[AudioChunk],
    model_name: str,
    options: dict[str, Any],
    n_workers: int = DEFAULT_WORKER_COUNT,
    device_name: str | None = None,
) -> dict[int, dict[str, Any]]:
    """Transcribe *chunks* in parallel using per-thread Whisper models.

    Returns a mapping of ``chunk_index → raw_whisper_result``.
    Segment filtering and assembly are left to the caller.
    """
    effective_workers = min(n_workers, len(chunks))
    resolved_device_name = device_name or _resolve_device_name()
    logger.info(
        "Parallel STT: %d chunks, %d workers, model=%s, device=%s",
        len(chunks),
        effective_workers,
        model_name,
        resolved_device_name,
    )

    results: dict[int, dict[str, Any]] = {}
    with ThreadPoolExecutor(
        max_workers=effective_workers,
        thread_name_prefix="whisper-worker",
    ) as executor:
        futures = {
            executor.submit(_transcribe_one_chunk, chunk, model_name, options, resolved_device_name): chunk.index
            for chunk in chunks
        }
        for future in as_completed(futures):
            chunk_index, raw = future.result()
            results[chunk_index] = raw

    failed = [idx for idx, r in results.items() if r.get("error")]
    if failed:
        logger.warning(
            "%d/%d chunks failed during parallel transcription: indices %s",
            len(failed),
            len(chunks),
            failed,
        )

    return results
