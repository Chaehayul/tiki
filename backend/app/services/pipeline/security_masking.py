import re

MASK = "***"

MASKING_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b"),
    re.compile(r"\b01[016789]-?\d{3,4}-?\d{4}\b"),
)


def mask_personal_information(text: str) -> str:
    masked = text
    for pattern in MASKING_PATTERNS:
        masked = pattern.sub(MASK, masked)
    return masked
