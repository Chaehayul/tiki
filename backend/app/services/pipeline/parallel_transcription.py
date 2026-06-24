"""Parallel Whisper inference infrastructure.

Each worker thread owns its own Whisper model instance so there is no
model-level contention. The main thread handles all segment filtering and
assembly after inference completes.
"""

from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from app.services.ai.audio_preprocessing import AudioChunk

logger = logging.getLogger(__name__)

_thread_local = threading.local()

DEFAULT_WORKER_COUNT = 2


def _get_thread_model(model_name: str) -> Any:
    """Return a Whisper model for the current thread, loading it on first use."""
    if not hasattr(_thread_local, "models"):
        _thread_local.models: dict[str, Any] = {}
    if model_name not in _thread_local.models:
        try:
            import whisper
        except ImportError as exc:
            raise RuntimeError(
                "openai-whisper is not installed. Add it to backend requirements."
            ) from exc
        logger.info(
            "Worker thread '%s' loading Whisper model '%s'",
            threading.current_thread().name,
            model_name,
        )
        _thread_local.models[model_name] = whisper.load_model(model_name)
    return _thread_local.models[model_name]


def _transcribe_one_chunk(
    chunk: AudioChunk,
    model_name: str,
    options: dict[str, Any],
) -> tuple[int, dict[str, Any]]:
    """Transcribe a single chunk in the calling thread.

    Returns ``(chunk_index, raw_whisper_result)``.
    """
    try:
        model = _get_thread_model(model_name)
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
) -> dict[int, dict[str, Any]]:
    """Transcribe *chunks* in parallel using per-thread Whisper models.

    Returns a mapping of ``chunk_index → raw_whisper_result``.
    Segment filtering and assembly are left to the caller.
    """
    effective_workers = min(n_workers, len(chunks))
    logger.info(
        "Parallel STT: %d chunks, %d workers, model=%s",
        len(chunks),
        effective_workers,
        model_name,
    )

    results: dict[int, dict[str, Any]] = {}
    with ThreadPoolExecutor(
        max_workers=effective_workers,
        thread_name_prefix="whisper-worker",
    ) as executor:
        futures = {
            executor.submit(_transcribe_one_chunk, chunk, model_name, options): chunk.index
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
