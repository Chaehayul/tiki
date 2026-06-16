from enum import StrEnum


class FileKind(StrEnum):
    AUDIO = "audio"
    DOCUMENT = "document"
    TEXT = "text"
    UNKNOWN = "unknown"


class ProcessingStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TicketStatus(StrEnum):
    DRAFT = "draft"
    READY = "ready"
    SYNCED = "synced"
    FAILED = "failed"


class TicketPriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class IntegrationProvider(StrEnum):
    JIRA = "jira"
    NOTION = "notion"


class SyncStatus(StrEnum):
    PENDING = "pending"
    SYNCED = "synced"
    FAILED = "failed"


def enum_values(enum_cls: type[StrEnum]) -> list[str]:
    return [member.value for member in enum_cls]
