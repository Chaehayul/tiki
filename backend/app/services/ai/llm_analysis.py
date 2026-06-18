"""LLM summary and ticket extraction service boundary and implementation."""

from __future__ import annotations

import json
import logging
import re
import time
from abc import ABC, abstractmethod
from collections import Counter
from datetime import datetime
from functools import lru_cache
from textwrap import shorten
from typing import Any

from app.core.config import settings
from app.models.enums import TicketPriority, TicketStatus
from app.services.ai.rag_context import RAGContext, normalize_rag_context

logger = logging.getLogger(__name__)

ACTION_KEYWORDS: tuple[str, ...] = (
    "해야",
    "필요",
    "검토",
    "수정",
    "보완",
    "연동",
    "개발",
    "구현",
    "배포",
    "정리",
    "확인",
    "업로드",
    "테스트",
    "반영",
    "마이그레이션",
    "이관",
    "작업",
    "맡",
    "논의",
    "조율",
    "완료",
    "확보",
    "마감",
    "목표",
    "공유",
    "승인",
    "반려",
    "협의",
    "배정",
    "오픈",
)

HIGH_PRIORITY_KEYWORDS: tuple[str, ...] = (
    "긴급",
    "즉시",
    "오늘",
    "이번주",
    "장애",
    "막아",
    "배포",
    "오류",
    "에러",
)

LOW_PRIORITY_KEYWORDS: tuple[str, ...] = (
    "검토",
    "확인",
    "논의",
    "조율",
    "참고",
)

ASSIGNEE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"([가-힣]{2,4})님"),
)

NEGATION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:없|아니|못|안|않)(?:습니다|어요|었습니다|음|다|던|네요)?"),
    re.compile(r"추가\s*작업\s*은?\s*없"),
    re.compile(r"더\s*이상.*없"),
)

ACTION_SIGNAL_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:해야|필요|하기로|하겠|합시다|해주세요|검토|수정|보완|연동|개발|구현|배포|정리|확인|업로드|테스트|반영|마이그레이션|이관|대응|도입|준비|추가|고정|적용|진행|처리|실행|구성|할당|완료|확보|마감|목표|협의|공유|승인|반려|배정|오픈)"),
)

STRONG_ACTION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:해야|필요|검토|수정|보완|연동|구현|확인|반영|마이그레이션|이관|대응|도입|처리|실행|할당|해결|개선|조치|적용|완료|확보|마감|목표|협의|공유|승인|반려|배정|오픈)"),
)

DECISION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:결정|확정|합의|하기로|선정|동의|정리하겠습니다|정리하죠|하겠습니다|하죠|걸로 하겠습니다|목표로 하겠습니다|목표로 하죠)"),
)

DECISION_CONFIRMATION_MARKERS: tuple[str, ...] = (
    "결정",
    "확정",
    "합의",
    "하기로",
    "선정",
    "동의",
    "채택",
    "하겠습니다",
    "하죠",
    "걸로 하겠습니다",
    "목표로 하겠습니다",
    "목표로 하죠",
)

DECISION_TIMELINE_MARKERS: tuple[str, ...] = (
    "오늘",
    "내일",
    "이번 주",
    "이번주",
    "다음 주",
    "다음주",
    "다음 회의",
    "다음 단계",
    "후속",
    "오후",
    "이번 달",
    "이번달",
)

ISSUE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:문제|이슈|리스크|장애|오류|에러|미달|부족|빠듯|변수|지연|느리|불안정|남아)"),
)

NEXT_AGENDA_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:다음 회의|다음 안건|후속|추후|다음 단계|다음 스텝|다음 회의에서는|다음 회의에)"),
)

FOLLOWUP_AGENDA_MARKERS: tuple[str, ...] = (
    "검토",
    "공유",
    "정리",
    "점검",
    "확인",
    "준비",
    "비교",
    "반영",
    "논의",
    "설계",
    "후속",
    "다음 회의",
    "추후",
    "마무리",
)

DIRECTIONAL_DECLARATION_MARKERS: tuple[str, ...] = (
    "우선",
    "방향을 잡",
    "방향을 정",
    "중심으로",
    "우선 방향",
    "전략을 잡",
    "방침을 잡",
)

NEXT_AGENDA_DISALLOWED_MARKERS: tuple[str, ...] = (
    "최종",
    "확정",
    "결정",
    "합의",
    "동의",
    "선정",
    "채택",
)

QUESTION_LIKE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:없나요|있나요|어떤가요|할까요|되나요|괜찮은가요|맞나요|가능한가요)"),
)

SELF_ACTION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:하겠습니다|할게요|예정입니다|예정이에요|진행하겠습니다|확인하겠습니다|공유하겠습니다|모니터링 하겠습니다)"),
)

BACKGROUND_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:회의 시작|현재 개발 진행|진행 상황|먼저 공유|공유 부탁|다들|오늘은 현재|남은 일정|상담사 목록|오늘 오후|시작하겠습니다)"),
)

KEYWORD_CANDIDATES: tuple[tuple[str, str], ...] = (
    ("화자 분리", "cyan"),
    ("Whisper", "cyan"),
    ("STT", "cyan"),
    ("전처리", "cyan"),
    ("마스킹", "cyan"),
    ("음성", "cyan"),
    ("업로드", "cyan"),
    ("프롬프트", "purple"),
    ("LLM", "purple"),
    ("요약", "purple"),
    ("티켓", "purple"),
    ("Jira", "purple"),
    ("Notion", "purple"),
    ("action item", "purple"),
    ("배포", "green"),
    ("QA", "green"),
    ("일정", "green"),
    ("마감", "green"),
    ("완료", "green"),
    ("성능", "yellow"),
    ("속도", "yellow"),
    ("오류", "yellow"),
    ("에러", "yellow"),
    ("장애", "yellow"),
    ("리스크", "yellow"),
    ("문제", "yellow"),
    ("API", "yellow"),
)

FILLER_SENTENCES: set[str] = {
    "좋습니다",
    "네",
    "네,",
    "그럼",
    "그러면",
    "감사합니다",
    "알겠습니다",
}

SENTENCE_SPLIT_PATTERN = re.compile(r"(?<=[.!?。])\s+|\n+")
WHITESPACE_PATTERN = re.compile(r"\s+")
DATE_PATTERN = re.compile(r"(?<!\d)(20\d{2}-\d{2}-\d{2})(?!\d)")
TITLE_CLEANUP_PATTERN = re.compile(r"^[\s\-\*\d\.\)\(\[\]#]+|[\s\-\*\d\.\)\(\[\]#]+$")
TITLE_PREFIX_CLEANUP_PATTERN = re.compile(
    r"^(?:20\d{2}-\d{2}-\d{2}(?:까지)?|(?:내일|오늘|이번주|이번 주|다음주|다음 주|금일|이번달|이번 달)(?:까지)?|까지)\s*"
)

DEFAULT_PROMPT_VERSION = "openai-v4"
DEFAULT_MODEL_NAME = settings.openai_model
MAX_ACTION_ITEMS = 5
MAX_SUMMARY_SENTENCES = 4
MAX_DECISIONS = 4
MAX_ISSUES = 4
MAX_NEXT_AGENDA = 4
MAX_KEYWORDS = 6

MEETING_ANALYSIS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "summary": {
            "type": "string",
            "description": "회의 핵심을 2~4문장으로 요약한 내용.",
        },
        "keywords": {
            "type": "array",
            "description": "회의 핵심 키워드 배지 목록.",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "type": {"type": "string", "enum": ["cyan", "purple", "green", "yellow"]},
                },
                "required": ["text", "type"],
                "additionalProperties": False,
            },
        },
        "decisions": {
            "type": "array",
            "description": "회의에서 확정된 주요 결정사항 목록.",
            "items": {"type": "string"},
        },
        "action_items": {
            "type": "array",
            "description": "후속 작업으로 전환할 수 있는 액션 아이템 목록.",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "티켓 제목."},
                    "description": {"type": "string", "description": "티켓 상세 설명."},
                    "priority": {
                        "type": "string",
                        "enum": [TicketPriority.LOW.value, TicketPriority.MEDIUM.value, TicketPriority.HIGH.value, TicketPriority.URGENT.value],
                    },
                    "status": {
                        "type": "string",
                        "enum": [TicketStatus.DRAFT.value, TicketStatus.READY.value],
                    },
                    "assignee": {
                        "type": ["string", "null"],
                        "description": "담당자 이름. 없으면 null.",
                    },
                    "due_at": {
                        "type": ["string", "null"],
                        "description": "마감일 ISO 형식 날짜(YYYY-MM-DD) 또는 null.",
                    },
                },
                "required": ["title", "description", "priority", "status", "assignee", "due_at"],
                "additionalProperties": False,
            },
        },
        "issues": {
            "type": "array",
            "description": "회의에서 언급된 이슈/리스크 목록.",
            "items": {
                "type": "object",
                "properties": {
                    "level": {"type": "string", "enum": ["high", "medium", "low"]},
                    "text": {"type": "string"},
                },
                "required": ["level", "text"],
                "additionalProperties": False,
            },
        },
        "next_agenda": {
            "type": "array",
            "description": "다음 회의에서 다룰 안건 목록.",
            "items": {"type": "string"},
        },
    },
    "required": ["summary", "keywords", "decisions", "action_items", "issues", "next_agenda"],
    "additionalProperties": False,
}


def _normalize_text_value(value: Any) -> str:
    return WHITESPACE_PATTERN.sub(" ", str(value or "")).strip()


def _build_context_block(context: Any | None) -> str:
    normalized = normalize_rag_context(context)
    if not normalized:
        return ""

    lines = normalized.to_prompt_lines()
    if not lines:
        return ""
    return "\n".join(["추가 컨텍스트:", *lines])


def _normalize_summary_value(summary: Any) -> str:
    normalized = _normalize_text_value(summary)
    if not normalized:
        return "요약할 텍스트가 없습니다."

    sentences = [part.strip() for part in SENTENCE_SPLIT_PATTERN.split(normalized) if part.strip()]
    if len(sentences) <= MAX_SUMMARY_SENTENCES:
        return normalized

    return " ".join(sentences[:MAX_SUMMARY_SENTENCES])


def _normalize_title_value(value: Any) -> str:
    title = _normalize_text_value(value).rstrip(".!?。")
    title = TITLE_CLEANUP_PATTERN.sub("", title)
    title = TITLE_PREFIX_CLEANUP_PATTERN.sub("", title)
    title = title.replace("기회안", "기획안")
    title = title.replace("인플로언서", "인플루언서")
    title = _normalize_text_value(title)
    return shorten(title, width=72, placeholder="...") if title else ""


def _normalize_description_value(value: Any, title: str) -> str:
    description = _normalize_text_value(value).rstrip(".!?。")
    if not description or description == title:
        return ""
    return shorten(description, width=240, placeholder="...")


def _normalize_priority_value(value: Any) -> str:
    candidate = str(value or TicketPriority.MEDIUM.value).strip().lower()
    if candidate in {priority.value for priority in TicketPriority}:
        return candidate
    return TicketPriority.MEDIUM.value


def _normalize_status_value(value: Any) -> str:
    candidate = str(value or TicketStatus.DRAFT.value).strip().lower()
    if candidate in {status.value for status in TicketStatus}:
        return candidate
    return TicketStatus.DRAFT.value


def _normalize_assignee_value(value: Any) -> str | None:
    candidate = _normalize_text_value(value)
    if not candidate or candidate.lower() in {"null", "none", "unknown", "미정"}:
        return None
    candidate = candidate.rstrip("님")
    return candidate or None


def _normalize_due_at_value(value: Any) -> str | None:
    candidate = _normalize_text_value(value)
    if not candidate or candidate.lower() in {"null", "none"}:
        return None

    try:
        return datetime.fromisoformat(candidate).date().isoformat()
    except ValueError:
        return None


def _normalize_action_items_value(action_items: Any) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    seen_titles: set[str] = set()

    for item in action_items or []:
        title = _normalize_title_value(item.get("title"))
        description = _normalize_description_value(item.get("description"), title)
        if not title or not description:
            continue

        signature = title.lower()
        if signature in seen_titles:
            continue
        seen_titles.add(signature)

        normalized.append(
            {
                "title": title,
                "description": description,
                "priority": _normalize_priority_value(item.get("priority")),
                "status": _normalize_status_value(item.get("status")),
                "assignee": _normalize_assignee_value(item.get("assignee")),
                "due_at": _normalize_due_at_value(item.get("due_at")),
            }
        )

        if len(normalized) >= MAX_ACTION_ITEMS:
            break

    return normalized


def _normalize_keywords_value(keywords: Any) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    seen: set[str] = set()

    for item in keywords or []:
        if isinstance(item, dict):
            text = _normalize_text_value(item.get("text"))
            kind = str(item.get("type", "cyan")).strip().lower()
        else:
            text = _normalize_text_value(item)
            kind = "cyan"

        if not text:
            continue
        if kind not in {"cyan", "purple", "green", "yellow"}:
            kind = "cyan"
        signature = text.lower()
        if signature in seen:
            continue
        seen.add(signature)
        normalized.append({"text": text[:24], "type": kind})
        if len(normalized) >= MAX_KEYWORDS:
            break

    return normalized


def _normalize_string_list_value(items: Any, limit: int) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()

    for item in items or []:
        text = _normalize_text_value(item)
        if not text:
            continue
        signature = text.lower()
        if signature in seen:
            continue
        seen.add(signature)
        normalized.append(shorten(text, width=180, placeholder="..."))
        if len(normalized) >= limit:
            break

    return normalized


TENTATIVE_DECISION_MARKERS: tuple[str, ...] = (
    "검토",
    "우선",
    "방향",
    "후보",
    "가능성",
    "논의",
    "조율",
)

FINAL_DECISION_MARKERS: tuple[str, ...] = (
    "결정",
    "확정",
    "합의",
    "동의",
    "선정",
    "채택",
    "마무리",
)


def _is_tentative_decision_text(text: str) -> bool:
    normalized = _normalize_text_value(text)
    if not normalized:
        return False

    has_tentative_marker = any(marker in normalized for marker in TENTATIVE_DECISION_MARKERS)
    has_final_marker = any(marker in normalized for marker in FINAL_DECISION_MARKERS)
    return has_tentative_marker and not has_final_marker


def _normalize_decisions_value(decisions: Any, limit: int) -> tuple[list[str], list[str]]:
    normalized: list[str] = []
    tentative: list[str] = []
    seen: set[str] = set()

    for item in decisions or []:
        text = _normalize_text_value(item)
        if not text:
            continue

        signature = text.lower()
        if signature in seen:
            continue
        seen.add(signature)

        if _is_tentative_decision_text(text) or not _is_strict_decision_text(text):
            tentative.append(shorten(text, width=180, placeholder="..."))
            continue

        normalized.append(shorten(text, width=180, placeholder="..."))
        if len(normalized) >= limit:
            break

    return normalized, tentative


def _is_strict_decision_text(text: str) -> bool:
    normalized = _normalize_text_value(text)
    if not normalized:
        return False

    has_confirmation_marker = any(marker in normalized for marker in DECISION_CONFIRMATION_MARKERS)
    has_timeline_marker = any(marker in normalized for marker in DECISION_TIMELINE_MARKERS)
    return has_confirmation_marker and not has_timeline_marker


def _is_followup_agenda_text(text: str) -> bool:
    normalized = _normalize_text_value(text)
    if not normalized:
        return False

    has_followup_marker = any(marker in normalized for marker in FOLLOWUP_AGENDA_MARKERS)
    has_directional_declaration = any(marker in normalized for marker in DIRECTIONAL_DECLARATION_MARKERS)
    has_disallowed_marker = any(marker in normalized for marker in NEXT_AGENDA_DISALLOWED_MARKERS)
    return has_followup_marker and not has_directional_declaration and not has_disallowed_marker


def _normalize_issues_value(issues: Any) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in issues or []:
        if isinstance(item, dict):
            text = _normalize_text_value(item.get("text"))
            level = str(item.get("level", "medium")).strip().lower()
        else:
            text = _normalize_text_value(item)
            level = "medium"
        if not text:
            continue
        if level not in {"high", "medium", "low"}:
            level = "medium"
        signature = text.lower()
        if signature in seen:
            continue
        seen.add(signature)
        normalized.append({"level": level, "text": shorten(text, width=220, placeholder="...")})
        if len(normalized) >= MAX_ISSUES:
            break
    return normalized


class LLMAnalysisService(ABC):
    @abstractmethod
    def summarize_and_extract_tickets(self, transcript: str, context: Any | None = None) -> dict[str, Any]:
        raise NotImplementedError


class HeuristicLLMAnalysisService(LLMAnalysisService):
    """Deterministic fallback when OpenAI is unavailable."""

    model_name = "heuristic-llm-v2"
    prompt_version = "heuristic-v2"

    def summarize_and_extract_tickets(self, transcript: str, context: Any | None = None) -> dict[str, Any]:
        normalized = self._normalize_text(transcript)
        if not normalized:
            return {
                "summary": "요약할 텍스트가 없습니다.",
                "action_items": [],
                "model_name": self.model_name,
                "prompt_version": self.prompt_version,
                "extra_data": {"input_characters": 0, "sentence_count": 0},
            }

        analysis_text = self._normalize_dialogue_transcript(transcript)
        sentences = self._split_sentences(analysis_text)
        noisy_audio = self._has_noisy_audio_context(context)
        if noisy_audio:
            sentences = self._filter_noise_sentences(sentences)
        context_block = _build_context_block(context)
        action_sentences = self._rank_action_sentences(sentences)
        summary = self._build_summary(sentences, analysis_text, noisy_context=noisy_audio)
        action_items = self._build_action_items(action_sentences)
        decisions = self._build_decisions(sentences)
        issues = self._build_issues(sentences)
        next_agenda = self._build_next_agenda(sentences)
        keywords = self._build_keywords(analysis_text, summary, action_items, decisions, issues, next_agenda)
        summary, action_items = self._normalize_analysis_output(summary, action_items)

        return {
            "summary": summary,
            "keywords": keywords,
            "decisions": decisions,
            "action_items": action_items,
            "issues": issues,
            "next_agenda": next_agenda,
            "model_name": self.model_name,
            "prompt_version": self.prompt_version,
                "extra_data": {
                    "input_characters": len(normalized),
                    "sentence_count": len(sentences),
                    "action_sentence_count": len(action_sentences),
                    "keyword_hits": dict(self._keyword_counter(normalized)),
                    "decision_count": len(decisions),
                    "issue_count": len(issues),
                    "next_agenda_count": len(next_agenda),
                    "context_present": bool(context_block),
                    "context_characters": len(context_block),
                    "audio_noise_context": noisy_audio,
                },
            }

    @staticmethod
    def _normalize_text(text: str) -> str:
        return WHITESPACE_PATTERN.sub(" ", text or "").strip()

    @staticmethod
    def _normalize_dialogue_transcript(text: str) -> str:
        lines: list[str] = []
        speaker_pattern = re.compile(r"^\s*(?:[가-힣]{2,6}|[A-Za-z][\w·-]{1,20})\s*:\s*")
        bracket_pattern = re.compile(r"^\s*[\(\[][^\)\]]*[\)\]]\s*$")

        for raw_line in str(text or "").splitlines():
            line = raw_line.strip()
            if not line or bracket_pattern.match(line):
                continue

            line = speaker_pattern.sub("", line)
            line = line.strip()
            if not line or line in FILLER_SENTENCES:
                continue

            lines.append(WHITESPACE_PATTERN.sub(" ", line))

        return "\n".join(lines).strip()

    @staticmethod
    def _split_sentences(text: str) -> list[str]:
        candidates = [part.strip() for part in SENTENCE_SPLIT_PATTERN.split(text) if part.strip()]
        candidates = [part for part in candidates if part not in FILLER_SENTENCES]
        if len(candidates) >= 2:
            if any(len(part) > 160 for part in candidates):
                expanded: list[str] = []
                for part in candidates:
                    if len(part) <= 160:
                        expanded.append(part)
                        continue

                    clauses = [
                        chunk.strip()
                        for chunk in re.split(
                            r"(?:,|;|:|\b그리고\b|\b그럼\b|\b그래서\b|\b하지만\b|\b다만\b|\b또한\b|\b일단\b|\b우선\b|\b마지막으로\b)",
                            part,
                        )
                        if chunk.strip()
                    ]
                    if clauses:
                        expanded.extend(clauses)
                    else:
                        expanded.append(part)

                if len(expanded) >= 2:
                    return expanded
            return candidates

        # Whisper transcripts often arrive as one long block, so chunk by clause.
        chunks = [chunk.strip() for chunk in re.split(r"[,:;]|(?<=다)\s+", text) if chunk.strip()]
        chunks = [chunk for chunk in chunks if chunk not in FILLER_SENTENCES]
        return chunks or ([text] if text else [])

    @staticmethod
    def _keyword_counter(text: str) -> Counter[str]:
        lowered = text.lower()
        counter: Counter[str] = Counter()
        for keyword in ACTION_KEYWORDS:
            hits = lowered.count(keyword.lower())
            if hits:
                counter[keyword] += hits
        return counter

    def _rank_action_sentences(self, sentences: list[str]) -> list[str]:
        scored: list[tuple[int, int, str]] = []
        for index, sentence in enumerate(sentences):
            score = self._score_sentence(sentence)
            if score > 0:
                scored.append((score, index, sentence))

        scored.sort(key=lambda item: (-item[0], item[1]))
        return [sentence for _, _, sentence in scored[:MAX_ACTION_ITEMS]]

    def _score_sentence(self, sentence: str) -> int:
        if self._contains_negated_action(sentence):
            return 0
        if self._is_question_like(sentence):
            return 0

        lowered = sentence.lower()
        has_strong_action = any(pattern.search(sentence) for pattern in STRONG_ACTION_PATTERNS)
        has_action_signal = any(pattern.search(sentence) for pattern in ACTION_SIGNAL_PATTERNS)
        has_deadline_context = bool(DATE_PATTERN.findall(sentence)) or any(
            marker in lowered for marker in ("까지", "마감", "완료", "목표", "담당", "확보", "협의", "공유", "정리", "결재", "오픈")
        )

        if any(pattern.search(sentence) for pattern in BACKGROUND_PATTERNS):
            if not has_strong_action and not has_deadline_context:
                return 0

        if not has_strong_action and not has_action_signal and not has_deadline_context:
            return 0

        score = 3

        for pattern in ACTION_SIGNAL_PATTERNS:
            if pattern.search(sentence):
                score += 3
                break

        if self._extract_assignee(sentence):
            score += 1

        if self._extract_due_at(sentence):
            score += 1

        for keyword in ACTION_KEYWORDS:
            if keyword.lower() in lowered:
                score += 1

        for keyword in HIGH_PRIORITY_KEYWORDS:
            if keyword.lower() in lowered:
                score += 2

        for keyword in LOW_PRIORITY_KEYWORDS:
            if keyword.lower() in lowered:
                score += 1

        if has_deadline_context:
            score += 2

        return score

    @staticmethod
    def _contains_negated_action(sentence: str) -> bool:
        return any(pattern.search(sentence) for pattern in NEGATION_PATTERNS)

    def _build_summary(self, sentences: list[str], fallback_text: str, noisy_context: bool = False) -> str:
        ranked = self._rank_summary_sentences(sentences, noisy_context=noisy_context)
        picked = ranked[:MAX_SUMMARY_SENTENCES]
        if not picked:
            picked = [shorten(fallback_text, width=180, placeholder="...")]

        summary = " ".join(picked)
        return WHITESPACE_PATTERN.sub(" ", summary).strip()

    def _rank_summary_sentences(self, sentences: list[str], noisy_context: bool = False) -> list[str]:
        scored: list[tuple[int, int, str]] = []
        for index, sentence in enumerate(sentences):
            text = self._cleanup_sentence(sentence)
            if not text or self._is_question_like(text):
                continue
            if noisy_context and self._looks_like_noise_sentence(text):
                continue
            if any(pattern.search(text) for pattern in BACKGROUND_PATTERNS) and not any(
                pattern.search(text) for pattern in STRONG_ACTION_PATTERNS
            ):
                continue

            token_count = len([token for token in text.split(" ") if token])
            lowered = text.lower()
            if token_count < 4 and not (
                len(DATE_PATTERN.findall(text)) >= 1
                or any(keyword in lowered for keyword in ACTION_KEYWORDS)
                or any(marker in lowered for marker in DECISION_CONFIRMATION_MARKERS)
                or any(marker in lowered for marker in FOLLOWUP_AGENDA_MARKERS)
            ):
                continue

            score = token_count
            if any(keyword in lowered for keyword in ACTION_KEYWORDS):
                score += 2
            if any(marker in lowered for marker in DECISION_CONFIRMATION_MARKERS):
                score += 2
            if any(marker in lowered for marker in FOLLOWUP_AGENDA_MARKERS):
                score += 1
            if len(DATE_PATTERN.findall(text)) >= 1:
                score += 1
            if "우선순위" in text or "일정" in text or "리스크" in text:
                score += 2
            if "담당" in text or "마감" in text or "완료" in text:
                score += 1
            scored.append((score, index, text))

        scored.sort(key=lambda item: (-item[0], item[1]))
        picked = sorted(scored[:MAX_SUMMARY_SENTENCES], key=lambda item: item[1])
        return [sentence for _, _, sentence in picked]

    def _build_action_items(self, sentences: list[str]) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        seen_titles: set[str] = set()

        for sentence in sentences:
            if self._looks_like_noisy_action_candidate(sentence):
                continue

            title = self._build_title(sentence)
            if title in seen_titles:
                continue
            seen_titles.add(title)

            items.append(
                {
                    "title": title,
                    "description": sentence.strip(),
                    "status": TicketStatus.DRAFT.value,
                    "priority": self._infer_priority(sentence).value,
                    "assignee": self._extract_assignee(sentence),
                    "due_at": self._extract_due_at(sentence),
                }
            )
            if len(items) >= MAX_ACTION_ITEMS:
                break

        return items

    @staticmethod
    def _looks_like_noisy_action_candidate(sentence: str) -> bool:
        cleaned = WHITESPACE_PATTERN.sub(" ", sentence or "").strip()
        if not cleaned:
            return True

        token_count = len([token for token in cleaned.split(" ") if token])
        if token_count >= 20:
            return True

        if len(DATE_PATTERN.findall(cleaned)) >= 2:
            return True

        numeric_tokens = len(re.findall(r"\d+", cleaned))
        if numeric_tokens >= 4:
            return True

        if len(cleaned) >= 120 and not any(keyword in cleaned for keyword in ACTION_KEYWORDS):
            return True

        return False

    @staticmethod
    def _build_title(sentence: str) -> str:
        cleaned = sentence.strip().rstrip(".!?。")
        cleaned = TITLE_CLEANUP_PATTERN.sub("", cleaned)
        cleaned = WHITESPACE_PATTERN.sub(" ", cleaned).strip()
        cleaned = TITLE_PREFIX_CLEANUP_PATTERN.sub("", cleaned)
        return shorten(cleaned, width=72, placeholder="...")

    @staticmethod
    def _infer_priority(sentence: str) -> TicketPriority:
        lowered = sentence.lower()
        if any(keyword in lowered for keyword in HIGH_PRIORITY_KEYWORDS):
            return TicketPriority.HIGH
        if any(keyword in lowered for keyword in LOW_PRIORITY_KEYWORDS):
            return TicketPriority.LOW
        return TicketPriority.MEDIUM

    @staticmethod
    def _extract_assignee(sentence: str) -> str | None:
        for pattern in ASSIGNEE_PATTERNS:
            match = pattern.search(sentence)
            if match:
                return match.group(1)
        return None

    @staticmethod
    def _extract_due_at(sentence: str) -> str | None:
        match = DATE_PATTERN.search(sentence)
        if match:
            return datetime.fromisoformat(match.group(1)).date().isoformat()
        return None

    def _build_decisions(self, sentences: list[str]) -> list[str]:
        picked = self._pick_sentence_list(sentences, DECISION_PATTERNS, MAX_DECISIONS)
        decisions: list[str] = []
        seen: set[str] = set()
        for sentence in picked:
            if self._is_question_like(sentence):
                continue
            text = self._cleanup_sentence(sentence)
            if not text:
                continue
            if not _is_strict_decision_text(text):
                continue
            signature = text.lower()
            if signature in seen:
                continue
            seen.add(signature)
            decisions.append(text)
        return decisions

    def _build_issues(self, sentences: list[str]) -> list[dict[str, Any]]:
        picked = self._pick_sentence_list(sentences, ISSUE_PATTERNS, MAX_ISSUES)
        issues: list[dict[str, Any]] = []
        seen: set[str] = set()
        for sentence in picked:
            if self._is_question_like(sentence) or self._is_self_action(sentence):
                continue
            text = self._cleanup_sentence(sentence)
            if not text:
                continue
            signature = text.lower()
            if signature in seen:
                continue
            seen.add(signature)
            issues.append(
                {
                    "level": self._infer_issue_level(text),
                    "text": text,
                }
            )
        return issues

    def _build_next_agenda(self, sentences: list[str]) -> list[str]:
        picked = self._pick_sentence_list(sentences, NEXT_AGENDA_PATTERNS, MAX_NEXT_AGENDA)
        cleaned: list[str] = []
        seen: set[str] = set()
        for sentence in picked:
            if self._is_question_like(sentence) or self._is_self_action(sentence):
                continue
            text = self._cleanup_sentence(sentence)
            if not text:
                continue
            signature = text.lower()
            if signature in seen:
                continue
            seen.add(signature)
            cleaned.append(text)
        return cleaned

    @staticmethod
    def _filter_noise_sentences(sentences: list[str]) -> list[str]:
        filtered: list[str] = []
        for sentence in sentences:
            if HeuristicLLMAnalysisService._looks_like_noise_sentence(sentence):
                continue
            filtered.append(sentence)
        return filtered or sentences

    @staticmethod
    def _looks_like_noise_sentence(sentence: str) -> bool:
        cleaned = WHITESPACE_PATTERN.sub(" ", sentence or "").strip()
        if not cleaned:
            return True

        if cleaned in FILLER_SENTENCES:
            return True

        compact = re.sub(r"[\s\W_]+", "", cleaned)
        if len(compact) <= 1:
            return True
        if re.fullmatch(r"(.)\1{3,}", compact):
            return True
        if compact in {"음", "어", "네", "예", "아", "그", "응", "맞", "맞아", "아니", "좋아"}:
            return True

        return False

    @staticmethod
    def _has_noisy_audio_context(context: Any | None) -> bool:
        normalized = normalize_rag_context(context)
        if not normalized:
            return False

        extra = normalized.extra or {}
        audio_preprocessing = extra.get("audio_preprocessing")
        if isinstance(audio_preprocessing, dict):
            if audio_preprocessing.get("raw_noisy") or audio_preprocessing.get("noisy_recording"):
                return True
            quality_flags = audio_preprocessing.get("quality_flags") or []
            if any("noise" in str(flag).lower() for flag in quality_flags):
                return True
        return False

    def _build_keywords(
        self,
        transcript: str,
        summary: str,
        action_items: list[dict[str, Any]],
        decisions: list[str],
        issues: list[dict[str, Any]],
        next_agenda: list[str],
    ) -> list[dict[str, str]]:
        haystack = " ".join(
            [
                transcript or "",
                summary or "",
                " ".join(item.get("title", "") for item in action_items),
                " ".join(decisions),
                " ".join(issue.get("text", "") for issue in issues),
                " ".join(next_agenda),
            ]
        )
        lowered = haystack.lower()
        keywords: list[dict[str, str]] = []
        seen: set[str] = set()

        for term, kind in KEYWORD_CANDIDATES:
            term_lower = term.lower()
            if term_lower in lowered and term_lower not in seen:
                seen.add(term_lower)
                keywords.append({"text": term, "type": kind})
            if len(keywords) >= MAX_KEYWORDS:
                break

        if not keywords and summary:
            fallback_terms = self._split_sentences(summary)[:MAX_KEYWORDS]
            for term in fallback_terms:
                cleaned = self._cleanup_sentence(term)
                if cleaned and cleaned.lower() not in seen:
                    seen.add(cleaned.lower())
                    keywords.append({"text": cleaned[:16], "type": "cyan"})
                if len(keywords) >= MAX_KEYWORDS:
                    break

        return keywords

    @staticmethod
    def _pick_sentence_list(
        sentences: list[str],
        patterns: tuple[re.Pattern[str], ...],
        limit: int,
    ) -> list[str]:
        scored: list[tuple[int, int, str]] = []
        for index, sentence in enumerate(sentences):
            if any(pattern.search(sentence) for pattern in patterns):
                score = len(sentence)
                if "다음 회의" in sentence or "다음 안건" in sentence:
                    score += 10
                if "결정" in sentence or "확정" in sentence:
                    score += 10
                if "문제" in sentence or "이슈" in sentence or "리스크" in sentence:
                    score += 10
                scored.append((score, index, sentence))

        scored.sort(key=lambda item: (-item[0], item[1]))
        return [sentence for _, _, sentence in scored[:limit]]

    @staticmethod
    def _cleanup_sentence(sentence: str) -> str:
        cleaned = WHITESPACE_PATTERN.sub(" ", sentence or "").strip()
        cleaned = cleaned.rstrip(".!?。")
        cleaned = TITLE_CLEANUP_PATTERN.sub("", cleaned)
        return WHITESPACE_PATTERN.sub(" ", cleaned).strip()

    @staticmethod
    def _infer_issue_level(text: str) -> str:
        lowered = text.lower()
        high_signals = ("장애", "오류", "에러", "중단", "심각", "막혀", "미달", "속도 8", "8초", "즉시")
        medium_signals = ("문제", "이슈", "리스크", "부족", "지연", "빠듯", "변수", "불안정", "남아")
        low_signals = ("검토", "주의", "가능성", "추가 데이터", "일부")

        if any(signal in lowered for signal in high_signals):
            return "high"
        if any(signal in lowered for signal in medium_signals):
            return "medium"
        if any(signal in lowered for signal in low_signals):
            return "low"
        return "medium"

    @staticmethod
    def _is_question_like(sentence: str) -> bool:
        return any(pattern.search(sentence) for pattern in QUESTION_LIKE_PATTERNS)

    @staticmethod
    def _is_self_action(sentence: str) -> bool:
        return any(pattern.search(sentence) for pattern in SELF_ACTION_PATTERNS)

    def _normalize_analysis_output(
        self,
        summary: str,
        action_items: list[dict[str, Any]],
    ) -> tuple[str, list[dict[str, Any]]]:
        normalized_summary = self._normalize_summary(summary)
        normalized_items = self._normalize_action_items(action_items)
        return normalized_summary, normalized_items

    @staticmethod
    def _normalize_summary(summary: str) -> str:
        normalized = WHITESPACE_PATTERN.sub(" ", summary or "").strip()
        if not normalized:
            return "요약할 텍스트가 없습니다."

        sentences = [part.strip() for part in SENTENCE_SPLIT_PATTERN.split(normalized) if part.strip()]
        if len(sentences) <= MAX_SUMMARY_SENTENCES:
            return normalized

        return " ".join(sentences[:MAX_SUMMARY_SENTENCES])

    @classmethod
    def _normalize_action_items(cls, action_items: Any) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        seen_titles: set[str] = set()

        for item in action_items or []:
            title = cls._normalize_title(item.get("title"))
            description = cls._normalize_description(item.get("description"), title)
            if not title or not description:
                continue

            normalized_priority = cls._normalize_priority(item.get("priority"))
            normalized_status = cls._normalize_status(item.get("status"))
            assignee = cls._normalize_assignee(item.get("assignee"))
            due_at = cls._normalize_due_at(item.get("due_at"))

            signature = title.lower()
            if signature in seen_titles:
                continue
            seen_titles.add(signature)

            normalized.append(
                {
                    "title": title,
                    "description": description,
                    "priority": normalized_priority,
                    "status": normalized_status,
                    "assignee": assignee,
                    "due_at": due_at,
                }
            )

            if len(normalized) >= MAX_ACTION_ITEMS:
                break

        return normalized

    @staticmethod
    def _normalize_title(value: Any) -> str:
        title = WHITESPACE_PATTERN.sub(" ", str(value or "")).strip().rstrip(".!?。")
        title = TITLE_CLEANUP_PATTERN.sub("", title)
        title = WHITESPACE_PATTERN.sub(" ", title).strip()
        title = TITLE_PREFIX_CLEANUP_PATTERN.sub("", title)
        return shorten(title, width=72, placeholder="...") if title else ""

    @staticmethod
    def _normalize_description(value: Any, title: str) -> str:
        description = WHITESPACE_PATTERN.sub(" ", str(value or "")).strip()
        description = description.rstrip(".!?。")
        if not description:
            return ""
        if description == title:
            return ""
        return shorten(description, width=240, placeholder="...")

    @staticmethod
    def _normalize_priority(value: Any) -> str:
        candidate = str(value or TicketPriority.MEDIUM.value).strip().lower()
        if candidate in {priority.value for priority in TicketPriority}:
            return candidate
        return TicketPriority.MEDIUM.value

    @staticmethod
    def _normalize_status(value: Any) -> str:
        candidate = str(value or TicketStatus.DRAFT.value).strip().lower()
        if candidate in {status.value for status in TicketStatus}:
            return candidate
        return TicketStatus.DRAFT.value

    @staticmethod
    def _normalize_assignee(value: Any) -> str | None:
        candidate = WHITESPACE_PATTERN.sub(" ", str(value or "")).strip()
        if not candidate or candidate.lower() in {"null", "none", "unknown", "미정"}:
            return None
        candidate = candidate.rstrip("님")
        return candidate or None

    @staticmethod
    def _normalize_due_at(value: Any) -> str | None:
        candidate = WHITESPACE_PATTERN.sub(" ", str(value or "")).strip()
        if not candidate or candidate.lower() in {"null", "none"}:
            return None

        try:
            return datetime.fromisoformat(candidate).date().isoformat()
        except ValueError:
            return None


class OpenAIAnalysisService(LLMAnalysisService):
    """OpenAI-backed meeting analysis using the Responses API."""

    def __init__(self, model_name: str | None = None, prompt_version: str = DEFAULT_PROMPT_VERSION) -> None:
        self.model_name = model_name or DEFAULT_MODEL_NAME
        self.prompt_version = prompt_version
        self._client = self._load_client()

    def _create_response_with_retry(self, normalized: str, context: Any | None = None) -> Any:
        try:
            from openai import APIConnectionError, APITimeoutError, RateLimitError
        except ImportError:  # pragma: no cover - openai is available in runtime env
            retryable_errors = ()
        else:
            retryable_errors = (APIConnectionError, APITimeoutError, RateLimitError)

        last_error: Exception | None = None
        max_attempts = 3

        for attempt in range(1, max_attempts + 1):
            try:
                return self._client.responses.create(
                    model=self.model_name,
                    instructions=self._build_instructions(context),
                    input=normalized,
                    text={
                        "format": {
                            "type": "json_schema",
                            "name": "meeting_analysis",
                            "strict": True,
                            "schema": MEETING_ANALYSIS_SCHEMA,
                        }
                    },
                )
            except retryable_errors as exc:  # type: ignore[misc]
                last_error = exc
                if attempt >= max_attempts:
                    raise
                delay_seconds = min(2.0, 0.75 * attempt)
                logger.warning(
                    "OpenAI analysis request failed on attempt %s/%s; retrying in %.2fs: %s",
                    attempt,
                    max_attempts,
                    delay_seconds,
                    exc,
                )
                time.sleep(delay_seconds)

        if last_error is not None:
            raise last_error
        raise RuntimeError("OpenAI request failed before a response was returned")

    @staticmethod
    @lru_cache(maxsize=1)
    def _load_client():
        api_key = settings.openai_api_key
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")

        try:
            from openai import OpenAI
        except ImportError as exc:  # pragma: no cover - dependency installed in runtime env
            raise RuntimeError("openai package is not installed") from exc

        return OpenAI(api_key=api_key)

    def summarize_and_extract_tickets(self, transcript: str, context: Any | None = None) -> dict[str, Any]:
        normalized = self._normalize_text(transcript)
        if not normalized:
            return {
                "summary": "요약할 텍스트가 없습니다.",
                "action_items": [],
                "model_name": self.model_name,
                "prompt_version": self.prompt_version,
                "extra_data": {"input_characters": 0, "source": "openai"},
        }

        try:
            noisy_audio = HeuristicLLMAnalysisService._has_noisy_audio_context(context)
            response = self._create_response_with_retry(normalized, context)

            payload = self._parse_response_payload(response)
            normalized_summary = _normalize_summary_value(payload.get("summary", ""))
            normalized_action_items = _normalize_action_items_value(payload.get("action_items", []))
            normalized_keywords = _normalize_keywords_value(payload.get("keywords", []))
            normalized_decisions, tentative_decisions = _normalize_decisions_value(payload.get("decisions", []), MAX_DECISIONS)
            normalized_issues = _normalize_issues_value(payload.get("issues", []))
            next_agenda_source = list(payload.get("next_agenda", []) or [])
            next_agenda_candidates = [
                item
                for item in next_agenda_source + tentative_decisions
                if _is_followup_agenda_text(item)
            ]
            normalized_next_agenda = _normalize_string_list_value(next_agenda_candidates, MAX_NEXT_AGENDA)
            return {
                "summary": normalized_summary,
                "keywords": normalized_keywords,
                "decisions": normalized_decisions,
                "action_items": normalized_action_items,
                "issues": normalized_issues,
                "next_agenda": normalized_next_agenda,
                "model_name": self.model_name,
                "prompt_version": self.prompt_version,
                "extra_data": {
                    "source": "openai",
                    "input_characters": len(normalized),
                    "action_item_count": len(normalized_action_items),
                    "decision_count": len(normalized_decisions),
                    "issue_count": len(normalized_issues),
                    "next_agenda_count": len(normalized_next_agenda),
                    "context_present": bool(_build_context_block(context)),
                    "audio_noise_context": noisy_audio,
                    "usage": self._serialize_usage(getattr(response, "usage", None)),
                },
            }
        except Exception as exc:
            logger.warning("OpenAI analysis request failed; falling back to heuristic service: %s", exc)
            fallback = HeuristicLLMAnalysisService().summarize_and_extract_tickets(normalized, context=context)
            fallback["extra_data"] = dict(fallback.get("extra_data", {}))
            fallback["extra_data"].update(
                {
                    "source": "openai_fallback",
                    "fallback_error": str(exc),
                    "input_characters": len(normalized),
                    "context_present": bool(_build_context_block(context)),
                    "audio_noise_context": HeuristicLLMAnalysisService._has_noisy_audio_context(context),
                }
            )
            return fallback

    @staticmethod
    def _normalize_text(text: str) -> str:
        return WHITESPACE_PATTERN.sub(" ", text or "").strip()

    @staticmethod
    def _build_instructions(context: Any | None = None) -> str:
        context_block = _build_context_block(context)
        instruction = (
            "너는 TIKI의 회의록 분석기다.\n"
            "출력은 반드시 JSON만 허용되며, 마크다운/설명문/코드펜스는 절대 쓰지 마라.\n"
            "아래 JSON 스키마를 정확히 지켜라.\n\n"
        )
        if context_block:
            instruction += f"{context_block}\n\n"
        instruction += (
            "작업 원칙:\n"
            "- 회의 핵심만 한국어로 2~4문장으로 요약하라. 장황한 부연 설명은 쓰지 마라.\n"
            "- 입력에 잡음, 잔향, 끊긴 발화, 중복 음절이 섞여 있으면 의미 있는 회의 발화만 사용하고 소음성 문구는 무시하라.\n"
            "- keywords에는 회의의 핵심 주제 4~6개를 담아라. type은 cyan, purple, green, yellow 중 하나를 써라.\n"
            "- decisions에는 회의에서 확정된 주요 결정사항만 넣어라.\n"
            "- decisions에는 실행 계획, 일정, 준비 작업, 배포, 수정, 테스트 같은 문장을 넣지 마라. 이런 문장은 action_items 또는 next_agenda로 옮겨라.\n"
            "- 검토/우선/방향/후보/가능성/논의/조율처럼 아직 확정되지 않은 내용은 decisions에 넣지 말고 next_agenda에 넣어라.\n"
            "- action_items에는 '실제로 실행 가능한 일'만 넣어라.\n"
            "- 다음은 action item 후보가 아니다: 단순 의견, 잡담, 배경 설명, 반복 발언.\n"
            "- 다음은 반드시 action item으로 분리하라: 결정사항, 할당된 작업, 장애 대응, 검토 요청, 마감일이 있는 일.\n"
            "- 하나의 문장에 여러 작업이 섞이면 작업 단위로 쪼개라.\n"
            "- 제목은 60자 내로 짧고 명확하게 써라.\n"
            "- 설명은 왜 필요한지, 무엇을 해야 하는지, 의존성이 있으면 무엇인지까지 담아라.\n"
            "- 우선순위는 low, medium, high, urgent 중 하나만 사용하라.\n"
            "- urgent는 명시적 긴급성, 장애, 즉시 대응, 마감 임박이 있을 때만 써라.\n"
            "- 담당자와 마감일이 명시되지 않으면 null로 둬라. 추측하지 마라.\n"
            "- 이름, 날짜, 숫자는 회의에서 실제 언급된 값만 사용하라.\n"
            "- 애매하면 action_items를 비워도 된다. 억지로 채우지 마라.\n"
            "- 중복되는 항목은 하나로 합쳐라.\n"
            "- issues에는 진행 리스크, 장애, 성능 저하, 일정 압박 같은 항목만 넣어라.\n"
            "- next_agenda에는 다음 회의에서 다룰 후속 안건, 검토 중인 선택지, 미확정 논점만 넣어라.\n"
            "- '방향을 잡는다', '중심으로 진행한다' 같은 선언형 문장은 next_agenda가 아니라 decisions 또는 summary로 돌려라.\n"
            "- 회의 내용이 불완전하면 요약에서도 그 한계를 반영하되, 여전히 최선의 요약을 제공하라.\n"
            "- 제목과 설명이 사실상 같은 경우는 action item으로 내보내지 마라.\n"
            "- '추가 작업 없음', '공유사항', '참고'만 있는 문장은 action item으로 만들지 마라.\n"
        )
        return instruction

    @staticmethod
    def _parse_response_payload(response: Any) -> dict[str, Any]:
        text = getattr(response, "output_text", None)
        if not text:
            text = OpenAIAnalysisService._extract_output_text(response)

        if not text:
            raise RuntimeError("OpenAI response did not contain output text")

        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise RuntimeError("OpenAI response was not valid JSON") from exc

    @staticmethod
    def _extract_output_text(response: Any) -> str:
        chunks: list[str] = []
        for item in getattr(response, "output", []) or []:
            for content in getattr(item, "content", []) or []:
                if getattr(content, "type", None) == "output_text":
                    chunks.append(getattr(content, "text", ""))
        return "".join(chunks).strip()

    @staticmethod
    # Response normalization is handled by _normalize_analysis_output so both
    # OpenAI and heuristic paths end up with the same contract.

    @staticmethod
    def _serialize_usage(usage: Any) -> dict[str, Any] | None:
        if usage is None:
            return None
        if hasattr(usage, "model_dump"):
            return usage.model_dump()
        if isinstance(usage, dict):
            return usage
        return {"value": str(usage)}


def build_llm_analysis_service() -> LLMAnalysisService:
    """Prefer OpenAI when configured, otherwise fall back to heuristic analysis."""

    if settings.openai_api_key:
        try:
            return OpenAIAnalysisService()
        except Exception as exc:
            logger.warning("OpenAI analysis unavailable, falling back to heuristic service: %s", exc)

    return HeuristicLLMAnalysisService()
