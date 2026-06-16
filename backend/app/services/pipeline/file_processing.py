from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.models.enums import FileKind

AUDIO_EXTENSIONS = {"mp3", "wav", "m4a", "aac", "ogg", "flac"}
DOCUMENT_EXTENSIONS = {"pdf", "doc", "docx", "txt", "md"}
MAX_UPLOAD_BYTES = 1024 * 1024 * 1024


def classify_file_kind(extension: str) -> FileKind:
    normalized = extension.lower().lstrip(".")
    if normalized in AUDIO_EXTENSIONS:
        return FileKind.AUDIO
    if normalized in DOCUMENT_EXTENSIONS:
        return FileKind.TEXT if normalized == "txt" else FileKind.DOCUMENT
    return FileKind.UNKNOWN


def build_storage_path(upload_dir: Path, file: UploadFile) -> Path:
    extension = Path(file.filename or "").suffix.lower()
    return upload_dir / f"{uuid4()}{extension}"
