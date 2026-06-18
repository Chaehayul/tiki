"""RAG context normalization helpers for meeting analysis."""

from __future__ import annotations

from dataclasses import dataclass, field
from textwrap import shorten
from typing import Any


def _normalize_text(value: Any) -> str:
    return " ".join(str(value or "").split()).strip()


def _normalize_list(values: Any, limit: int = 8) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()

    for item in values or []:
        text = _normalize_text(item)
        if not text:
            continue
        signature = text.lower()
        if signature in seen:
            continue
        seen.add(signature)
        normalized.append(shorten(text, width=120, placeholder="..."))
        if len(normalized) >= limit:
            break

    return normalized


CATEGORY_ANALYSIS_FOCUS: dict[str, list[str]] = {
    "개발": [
        "티켓, 배포, API, QA, 장애 같은 개발 문맥을 우선 반영한다.",
        "기술 용어와 구현 단계 표현을 일반적인 표현보다 우선한다.",
    ],
    "디자인": [
        "UI, UX, 컴포넌트, 가이드, 피드백 같은 디자인 문맥을 우선 반영한다.",
        "시안, 수정, 사용자 경험 관련 표현을 적극 반영한다.",
    ],
    "기획": [
        "요구사항, 일정, 범위, 우선순위 같은 기획 문맥을 우선 반영한다.",
        "결정사항과 후속 액션을 명확히 분리한다.",
    ],
    "마케팅": [
        "캠페인, 콘텐츠, 채널, KPI, 전환 같은 마케팅 문맥을 우선 반영한다.",
        "실행 계획과 성과 지표를 분리해서 정리한다.",
    ],
    "기타": [
        "프로젝트별 전용 용어와 팀 규칙을 우선 반영한다.",
        "회의 문맥을 일반화하지 말고 해당 프로젝트 기준으로 해석한다.",
    ],
}


def _resolve_category_analysis_focus(category: str | None) -> list[str]:
    normalized_category = _normalize_text(category)
    if not normalized_category:
        return []

    for key, focus_items in CATEGORY_ANALYSIS_FOCUS.items():
        if key in normalized_category:
            return list(focus_items)

    return list(CATEGORY_ANALYSIS_FOCUS.get("기타", []))


@dataclass(slots=True)
class RAGContext:
    project_name: str | None = None
    project_key: str | None = None
    project_category: str | None = None
    analysis_focus: list[str] = field(default_factory=list)
    ticket_rules: list[str] = field(default_factory=list)
    glossary: list[str] = field(default_factory=list)
    example_tickets: list[str] = field(default_factory=list)
    preferred_keywords: list[str] = field(default_factory=list)
    participants: list[str] = field(default_factory=list)
    admins: list[str] = field(default_factory=list)
    integration_targets: list[str] = field(default_factory=list)
    note: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "project_name": self.project_name,
            "project_key": self.project_key,
            "project_category": self.project_category,
            "analysis_focus": list(self.analysis_focus),
            "ticket_rules": list(self.ticket_rules),
            "glossary": list(self.glossary),
            "example_tickets": list(self.example_tickets),
            "preferred_keywords": list(self.preferred_keywords),
            "participants": list(self.participants),
            "admins": list(self.admins),
            "integration_targets": list(self.integration_targets),
            "note": self.note,
            "extra": dict(self.extra),
        }

    def to_prompt_lines(self) -> list[str]:
        lines: list[str] = []
        if self.project_name:
            lines.append(f"- project_name: {self.project_name}")
        if self.project_key:
            lines.append(f"- project_key: {self.project_key}")
        if self.project_category:
            lines.append(f"- project_category: {self.project_category}")

        focus = _normalize_list(self.analysis_focus)
        if focus:
            lines.append("- analysis_focus:")
            lines.extend(f"  - {item}" for item in focus)

        for label, values in (
            ("ticket_rules", self.ticket_rules),
            ("glossary", self.glossary),
            ("example_tickets", self.example_tickets),
            ("preferred_keywords", self.preferred_keywords),
            ("participants", self.participants),
            ("admins", self.admins),
            ("integration_targets", self.integration_targets),
        ):
            items = _normalize_list(values)
            if not items:
                continue
            lines.append(f"- {label}:")
            lines.extend(f"  - {item}" for item in items)

        if self.note:
            lines.append(f"- note: {shorten(_normalize_text(self.note), width=200, placeholder='...')}")

        if self.extra:
            lines.append("- extra:")
            for key, value in self.extra.items():
                if value in (None, "", [], {}, ()):
                    continue
                if isinstance(value, (list, tuple, set)):
                    items = _normalize_list(value)
                    if not items:
                        continue
                    lines.append(f"  - {key}:")
                    lines.extend(f"    - {item}" for item in items)
                    continue
                text = shorten(_normalize_text(value), width=120, placeholder="...")
                if text:
                    lines.append(f"  - {key}: {text}")

        return lines


def normalize_rag_context(context: Any | None) -> RAGContext | None:
    if not context:
        return None

    if isinstance(context, RAGContext):
        return context

    if isinstance(context, str):
        text = _normalize_text(context)
        return RAGContext(note=text or None) if text else None

    if isinstance(context, dict):
        reserved_keys = {
            "project_name",
            "project_key",
            "project_category",
            "analysis_focus",
            "ticket_rules",
            "glossary",
            "example_tickets",
            "preferred_keywords",
            "participants",
            "admins",
            "integration_targets",
            "note",
            "extra",
        }
        extra = context.get("extra")
        extra_dict = dict(extra) if isinstance(extra, dict) else {}
        for key, value in context.items():
            if key in reserved_keys:
                continue
            extra_dict[key] = value

        project_category = _normalize_text(context.get("project_category")) or None
        analysis_focus = _normalize_list(context.get("analysis_focus"))
        if not analysis_focus:
            analysis_focus = _resolve_category_analysis_focus(project_category)

        return RAGContext(
            project_name=_normalize_text(context.get("project_name")) or None,
            project_key=_normalize_text(context.get("project_key")) or None,
            project_category=project_category,
            analysis_focus=analysis_focus,
            ticket_rules=_normalize_list(context.get("ticket_rules")),
            glossary=_normalize_list(context.get("glossary")),
            example_tickets=_normalize_list(context.get("example_tickets")),
            preferred_keywords=_normalize_list(context.get("preferred_keywords")),
            participants=_normalize_list(context.get("participants")),
            admins=_normalize_list(context.get("admins")),
            integration_targets=_normalize_list(context.get("integration_targets")),
            note=_normalize_text(context.get("note")) or None,
            extra=extra_dict,
        )

    if isinstance(context, (list, tuple, set)):
        return RAGContext(note="\n".join(_normalize_list(context)) or None)

    text = _normalize_text(context)
    return RAGContext(note=text or None) if text else None
