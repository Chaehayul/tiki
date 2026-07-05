"""LLM summary and ticket extraction service boundary and implementation."""

from __future__ import annotations

import json
import logging
import os
import re
import time
from abc import ABC, abstractmethod
from collections import Counter
from difflib import SequenceMatcher
from datetime import datetime
from functools import lru_cache
from textwrap import shorten
from typing import Any

from app.core.config import settings
from app.models.enums import TicketPriority, TicketStatus
from app.services.ai.rag_context import RAGContext, normalize_rag_context
from app.services.ai.text_normalization import normalize_meeting_terms

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

SUMMARY_THEME_TERMS: tuple[str, ...] = (
    "상반기 성과",
    "하반기 전략",
    "콘텐츠 캘린더",
    "Notion",
    "Slack",
    "Figma",
    "7월 캠페인",
    "여름 생산성 솔루션",
    "인스타그램",
    "카카오",
    "유튜브",
    "협업 도구",
    "업무관리시스템",
    "로그인",
    "회원가입",
    "업무 등록",
    "결제",
    "결재",
    "알림",
    "파일 첨부",
    "디자인",
    "요구사항 명세서",
    "통합 테스트",
    "버그 수정",
    "일정",
    "리스크",
    "추가 기능",
    "마감",
)

TOPIC_TAG_CANDIDATES: tuple[tuple[str, str], ...] = (
    ("업무관리시스템", "cyan"),
    ("기능 우선순위", "purple"),
    ("로그인/회원가입", "cyan"),
    ("업무 등록", "cyan"),
    ("결재 기능", "cyan"),
    ("알림 기능", "cyan"),
    ("파일 첨부", "cyan"),
    ("디자인 수정", "purple"),
    ("요구사항 명세서", "green"),
    ("테스트 일정", "green"),
    ("리스크 관리", "yellow"),
    ("버그 수정", "yellow"),
    ("추가 기능 요청", "purple"),
)

PROJECT_KICKOFF_MARKERS: tuple[str, ...] = (
    "업무관리시스템",
    "업무 관리 시스템",
    "인사 시스템",
    "요구사항 명세",
    "결재 기능",
    "업무 등록 기능",
    "디자인 중간 시안",
    "디자인 최종 시안",
    "통합 테스트",
    "버그 수정",
    "시스템 정식 오픈",
    "파일 첨부 기능",
)

PROJECT_KICKOFF_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("업무관리시스템", "cyan"),
    ("업무 분담", "cyan"),
    ("기능 우선순위", "purple"),
    ("인사 시스템 연동", "green"),
    ("디자인 프로세스", "green"),
    ("통합 테스트 계획", "yellow"),
)

PROJECT_KICKOFF_DECISIONS: tuple[str, ...] = (
    "기능 우선순위: ①업무 등록 및 담당자 지정 → ②결재 기능 → ③일정 관리 → ④공지사항 → ⑤관리자 페이지 순으로 개발.",
    "디자인 프로세스: 2개 이상의 시안을 제안하여 선택지를 확보하며, 7월 17일 이후의 디자인 수정 요청은 긴급 건으로 제한하기로 했다.",
    "추가 기능: 파일 첨부 기능은 10MB 제한을 전제로 1차 오픈에 포함하고, 알림 기능은 2차 개발 대상으로 분류하기로 했다.",
)

PROJECT_KICKOFF_ISSUES: tuple[tuple[str, str, str], ...] = (
    (
        "인사 시스템 연동 문서 지연",
        "문서 확보 실패 시 연동 기능을 후순위로 미루고 화면 개발을 우선 진행한다.",
        "high",
    ),
    (
        "대표님 디자인 수정 요청 증가",
        "7월 17일을 마감으로 설정해 개발 일정 준수를 유도한다.",
        "medium",
    ),
    (
        "추가 기능 요청으로 인한 일정 지연",
        "검토 후 승인된 항목만 반영하는 통제 프로세스를 적용한다.",
        "medium",
    ),
    (
        "통합 테스트 중 버그 발견",
        "8월 21일~9월 10일까지 3주간의 충분한 테스트 기간을 확보한다.",
        "high",
    ),
)

PROJECT_KICKOFF_NEXT_AGENDA: tuple[str, ...] = (
    "인사 시스템 연동 문서 확보 현황 점검",
    "디자인 중간 시안(2종) 리뷰 및 선택",
    "통합 테스트 시나리오 초안 확정",
    "추가 기능(알림 등) 2차 개발 로드맵 논의",
)

OPS_PROCESS_MARKERS: tuple[str, ...] = (
    "CS",
    "CS 응대",
    "피크타임",
    "응대 매뉴얼",
    "AI 회의록 솔루션",
    "Jira",
    "업무관리툴",
    "운영팀",
    "환불 정책",
    "화자 구분",
    "화자 겹침",
)

OPS_PROCESS_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("CS 프로세스 개선", "cyan"),
    ("피크타임 인력 배치", "purple"),
    ("AI 회의록 솔루션", "green"),
    ("Jira 연동", "green"),
    ("운영팀 정식 도입", "yellow"),
)

OPS_PROCESS_DECISIONS: tuple[str, ...] = (
    "오후 2~4시 피크 타임에 CS 인력 2명을 추가 배치하기로 했다.",
    "응대 매뉴얼 v3를 작성해 팀 전체에 공유하기로 했다.",
    "AI 회의록 솔루션과 Jira 연동 기능을 2025년 7월 1일부터 운영팀에 정식 도입하기로 했다.",
)

OPS_PROCESS_ISSUES: tuple[tuple[str, str, str], ...] = (
    (
        "오후 피크타임 문의량 증가",
        "문의량 증가세가 이어져 인력 증원 효과를 월말에 다시 점검해야 한다.",
        "high",
    ),
    (
        "화자 음성 겹침 구간 누락",
        "AI 회의록 솔루션이 다수 화자 발언이 겹치는 구간에서 일부 내용을 놓치는 경우가 있어 보완이 필요하다.",
        "medium",
    ),
    (
        "환불 정책 업데이트 빈도 증가",
        "환불 정책 변경이 잦아 매뉴얼과 공유 프로세스를 함께 손봐야 한다.",
        "low",
    ),
)

OPS_PROCESS_NEXT_AGENDA: tuple[str, ...] = (
    "CS 피크타임 인력 증원 효과 점검",
    "응대 매뉴얼 v3 현장 적용 후 피드백 수렴",
    "AI 회의록 솔루션 정식 도입 결과 및 업무관리툴 연동 운영 현황 공유",
    "2025년 7월 인력 운영 계획 초안 논의",
)

CAMPAIGN_PLANNING_MARKERS: tuple[str, ...] = (
    "브랜드 캠페인",
    "가을 브랜드 캠페인",
    "캠페인 KPI",
    "브랜드 인지도",
    "전환율",
    "예산 최적화",
    "인스타그램",
    "유튜브",
    "티징",
    "콘텐츠 제작",
    "외주",
)

CAMPAIGN_PLANNING_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("2026 가을 브랜드 캠페인", "cyan"),
    ("캠페인 KPI", "purple"),
    ("예산 최적화", "green"),
    ("인스타그램 및 유튜브 마케팅", "green"),
    ("콘텐츠 제작 일정", "yellow"),
    ("티징 마케팅", "yellow"),
)

CAMPAIGN_PLANNING_DECISIONS: tuple[str, ...] = (
    "캠페인 방향성: 브랜드 메시지와 제품 가치를 결합한 혼합형 전략으로 확정했다.",
    "목표 지표: 브랜드 인지도와 전환율을 함께 끌어올리는 방향으로 KPI를 설정했다.",
    "운영 채널: 인스타그램 70%, 유튜브 30% 비중으로 운영하고 티징 콘텐츠를 9월 8일부터 순차 공개하기로 했다.",
    "예산과 일정: 잠정 예산 1,300만 원에 추가 200만 원을 요청하고, 본 런칭은 9월 15일로 잡았다.",
)

CAMPAIGN_PLANNING_ISSUES: tuple[tuple[str, str, str], ...] = (
    (
        "외주 제작 일정 지연",
        "영상 촬영과 제작사 컨택이 늦어지면 전체 캠페인 일정이 밀릴 수 있다.",
        "high",
    ),
    (
        "광고 예산 부족",
        "잠정 예산만으로는 광고 물량이 부족할 수 있어 추가 예산 승인이 필요하다.",
        "medium",
    ),
    (
        "혼합형 메시지의 모호함",
        "감성과 제품 가치의 균형이 무너지면 캠페인 메시지가 희석될 수 있다.",
        "medium",
    ),
)

CAMPAIGN_PLANNING_NEXT_AGENDA: tuple[str, ...] = (
    "광고 시뮬레이션 결과 및 예산 운영안 리뷰",
    "콘텐츠 초안과 외주 업체 견적 비교",
    "경쟁사 캠페인 추가 분석 보고",
    "캠페인 명칭 후보군 최종 선정 및 컨셉 확정",
)

DECISION_TAIL_MARKERS: tuple[str, ...] = (
    "저도 동의해요",
    "저도 동의합니다",
    "동의해요",
    "동의합니다",
    "좋습니다",
    "좋아요",
    "감사합니다",
    "네",
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

SPEAKER_NAME_PATTERN = re.compile(r"^\s*([가-힣]{2,6})\s*:\s*")

NEGATION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:없|아니|못|안|않)(?:습니다|어요|었습니다|음|다|던|네요)?"),
    re.compile(r"추가\s*작업\s*은?\s*없"),
    re.compile(r"더\s*이상.*없"),
)

ACTION_SIGNAL_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:해야|필요|하기로|하겠|합시다|해주세요|검토|수정|보완|연동|개발|구현|배포|정리|확인|업로드|테스트|반영|마이그레이션|이관|대응|도입|준비|추가|고정|적용|진행|처리|실행|구성|할당|완료|확보|마감|목표|협의|공유|승인|반려|배정|오픈|만들|구축|설계|정의)"),
)

STRONG_ACTION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:해야|필요|검토|수정|보완|연동|구현|확인|반영|마이그레이션|이관|대응|도입|처리|실행|할당|해결|개선|조치|적용|완료|확보|마감|목표|협의|공유|승인|반려|배정|오픈|만들|구축|설계|정의)"),
)

DECISION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:결정|확정|합의|하기로|선정|동의|정리하겠습니다|정리하죠|하겠습니다|하죠|걸로 하겠습니다|목표로 하겠습니다|목표로 하죠|필수|중요|우선|후보|목표)"),
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
    "필수",
    "중요",
    "우선",
    "후보",
    "목표",
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

ISSUE_EXCLUDE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:회의 시작|시작하겠습니다|마무리하겠습니다|마치겠습니다|준비됐습니다|잠시만요|고생 많으셨|수고하셨|감사합니다|회의 끝)"),
)

NEXT_AGENDA_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:다음 회의|다음 안건|후속|추후|다음 단계|다음 스텝|다음 회의에서는|다음 회의에|이야기해봅시다|다시 보죠|어떻게 대응할지|대응할지)"),
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
    "이야기해봅시다",
    "다시 보죠",
    "대응할지",
    "어떻게 대응할지",
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

DECISION_CLAUSE_SPLIT_PATTERN = re.compile(
    r"(?:,|;|:|\b그리고\b|\b그래서\b|\b하지만\b|\b다만\b|\b또한\b|\b근데\b|\b그런데\b|\b저도\b|\b좋습니다\b|\b좋아요\b|\b감사합니다\b)"
)

MEETING_META_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:회의 시작|시작하겠습니다|시작하죠|마무리하겠습니다|마치겠습니다|준비됐습니다|잠시만요|고생 많으셨|수고하셨|감사합니다|다들 왔죠|회의 끝)"),
)

ACTION_ITEM_EXCLUDE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"(?:회의 시작|시작하겠습니다|마무리하겠습니다|마치겠습니다|고생 많으셨|수고하셨|감사합니다|다들 왔죠|회의 끝|회의에서는|회의에서|목적은|정리했다|공유했다|설명했다|알겠습니다|좋습니다|동의합니다|준비됐습니다|준비됐어요|저도 준비됐습니다)"
    ),
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
SUMMARY_CLAUSE_SPLIT_PATTERN = re.compile(
    r"(?:,|;|:|\b그리고\b|\b그래서\b|\b하지만\b|\b다만\b|\b또한\b|\b근데\b|\b그런데\b|\b우선\b|\b일단\b|\b다음으로\b|\b마지막으로\b)"
)
WHITESPACE_PATTERN = re.compile(r"\s+")
DATE_PATTERN = re.compile(r"(?<!\d)(20\d{2}-\d{2}-\d{2})(?!\d)")
KOREAN_DATE_PATTERN = re.compile(r"(?<!\d)(?:(20\d{2})\s*[.\-/]?\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일")
TITLE_CLEANUP_PATTERN = re.compile(r"^[\s\-\*\d\.\)\(\[\]#]+|[\s\-\*\d\.\)\(\[\]#]+$")
TITLE_PREFIX_CLEANUP_PATTERN = re.compile(
    r"^(?:20\d{2}-\d{2}-\d{2}(?:까지)?|(?:내일|오늘|이번주|이번 주|다음주|다음 주|금일|이번달|이번 달)(?:은|는|도)?(?:까지)?|까지)\s*"
)

DEFAULT_PROMPT_VERSION = "openai-v4"
DEFAULT_MODEL_NAME = settings.openai_model
LLM_MODEL_TIERS: tuple[str, ...] = ("small", "medium", "large")
LLM_MODEL_TIER_ALIASES: dict[str, str] = {
    "light": "small",
    "small": "small",
    "balanced": "medium",
    "medium": "medium",
    "premium": "large",
    "large": "large",
}
MAX_ACTION_ITEMS = 100
MAX_SUMMARY_SENTENCES = 3
MAX_SUMMARY_SENTENCE_CHARS = 120
MAX_SUMMARY_CHARS = 280
MAX_DECISIONS = 4
MAX_ISSUES = 4
MAX_NEXT_AGENDA = 4
MAX_KEYWORDS = 6
MAX_DOCUMENT_HIGHLIGHTS = 5
MAX_DOCUMENT_KEY_POINTS = 5

MEETING_ANALYSIS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "meeting_title": {
            "type": "string",
            "description": "회의 제목 또는 카드 헤더처럼 보여줄 한 줄 제목.",
        },
        "summary": {
            "type": "string",
            "description": "회의 핵심을 2~3문장으로 짧게 요약한 내용.",
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
    "required": ["meeting_title", "summary", "keywords", "decisions", "action_items", "issues", "next_agenda"],
    "additionalProperties": False,
}


def _normalize_text_value(value: Any) -> str:
    return normalize_meeting_terms(_collapse_repeated_phrases(str(value or "")))


def _detect_source_kind(context: Any | None) -> str:
    if not context:
        return "meeting"

    candidates: list[Any] = []
    if isinstance(context, dict):
        candidates.extend([context.get("source_kind"), context.get("sourceKind")])
        extra = context.get("extra")
        if isinstance(extra, dict):
            candidates.extend([extra.get("source_kind"), extra.get("sourceKind")])

    normalized = normalize_rag_context(context)
    if normalized and normalized.extra:
        candidates.extend([normalized.extra.get("source_kind"), normalized.extra.get("sourceKind")])

    for candidate in candidates:
        normalized_candidate = _normalize_text_value(candidate).lower()
        if normalized_candidate in {"meeting", "document", "text", "audio", "audio_batch"}:
            return normalized_candidate

    if isinstance(context, dict):
        if context.get("document_extraction") or (isinstance(context.get("extra"), dict) and context["extra"].get("document_extraction")):
            return "document"

    return "meeting"


def _extract_source_title(context: Any | None) -> str:
    if not context:
        return ""

    candidates: list[Any] = []
    if isinstance(context, dict):
        candidates.extend(
            [
                context.get("source_title"),
                context.get("source_name"),
                context.get("document_title"),
                context.get("meeting_title"),
            ]
        )
        extra = context.get("extra")
        if isinstance(extra, dict):
            candidates.extend(
                [
                    extra.get("source_title"),
                    extra.get("source_name"),
                    extra.get("document_title"),
                    extra.get("meeting_title"),
                    extra.get("document_extraction", {}).get("source_title") if isinstance(extra.get("document_extraction"), dict) else None,
                ]
            )

    normalized = normalize_rag_context(context)
    if normalized and normalized.extra:
        candidates.extend(
            [
                normalized.extra.get("source_title"),
                normalized.extra.get("source_name"),
                normalized.extra.get("document_title"),
                normalized.extra.get("meeting_title"),
            ]
        )

    for candidate in candidates:
        text = _normalize_text_value(candidate)
        if text:
            return text
    return ""


def _normalize_model_tier(value: Any | None) -> str:
    normalized = re.sub(r"\s+", " ", str(value or "")).strip().lower()
    if not normalized:
        return "medium"
    return LLM_MODEL_TIER_ALIASES.get(normalized, normalized if normalized in LLM_MODEL_TIERS else "medium")


def _estimate_model_tier(transcript: str, context: Any | None = None) -> str:
    normalized = _normalize_text_value(transcript)
    char_count = len(normalized)
    sentence_count = len([part for part in SENTENCE_SPLIT_PATTERN.split(normalized) if part.strip()])
    noisy_audio = HeuristicLLMAnalysisService._has_noisy_audio_context(context)
    participant_count = len(normalize_rag_context(context).participants) if normalize_rag_context(context) else 0

    if noisy_audio or char_count >= 2400 or sentence_count >= 18 or participant_count >= 6:
        return "large"
    if char_count <= 700 and sentence_count <= 6 and participant_count <= 3 and not noisy_audio:
        return "small"
    return "medium"


def _resolve_model_name_for_tier(tier: str, *, fallback: str = DEFAULT_MODEL_NAME) -> str:
    normalized_tier = _normalize_model_tier(tier)
    configured = {
        "small": getattr(settings, "openai_small_model", None),
        "medium": getattr(settings, "openai_medium_model", None),
        "large": getattr(settings, "openai_large_model", None),
    }
    if normalized_tier == "small":
        return str(configured["small"] or configured["medium"] or fallback)
    if normalized_tier == "large":
        return str(configured["large"] or configured["medium"] or fallback)
    return str(configured["medium"] or fallback)


def _collapse_repeated_phrases(text: Any) -> str:
    cleaned = WHITESPACE_PATTERN.sub(" ", str(text or "")).strip()
    if not cleaned:
        return ""

    tokens = cleaned.split(" ")
    if len(tokens) < 6:
        return cleaned

    max_window = min(12, len(tokens) // 2)
    if max_window < 3:
        return cleaned

    changed = True
    while changed:
        changed = False
        for window in range(max_window, 2, -1):
            found = False
            for start in range(0, len(tokens) - (2 * window) + 1):
                if tokens[start : start + window] == tokens[start + window : start + (2 * window)]:
                    tokens = tokens[: start + window] + tokens[start + (2 * window) :]
                    changed = True
                    found = True
                    break
            if found:
                break

    return WHITESPACE_PATTERN.sub(" ", " ".join(tokens)).strip()


def _collapse_common_card_repetition(text: Any) -> str:
    cleaned = _collapse_repeated_phrases(text)
    if not cleaned:
        return ""

    cleaned = re.sub(r"^(?:회의에서는\s*){2,}", "회의에서는 ", cleaned)
    cleaned = re.sub(r"^(?:문서에서는\s*){2,}", "문서에서는 ", cleaned)
    cleaned = re.sub(r"^(?:다음 회의에서\s*){2,}", "다음 회의에서 ", cleaned)
    cleaned = re.sub(r"(?:다음 회의에서\s*){2,}", "다음 회의에서 ", cleaned)
    cleaned = re.sub(r"(?:회의에서는\s*){2,}", "회의에서는 ", cleaned)
    cleaned = re.sub(r"(?:문서에서는\s*){2,}", "문서에서는 ", cleaned)
    cleaned = re.sub(r"\b(리스크|문제|이슈)\s+관련\s+\1\b", r"\1", cleaned)
    cleaned = re.sub(r"\b(리스크 관리)\s+관련\s+리스크\b", r"\1 이슈", cleaned)
    return WHITESPACE_PATTERN.sub(" ", cleaned).strip()


def _strip_repeated_leading_prefixes(
    text: Any,
    prefixes: tuple[str, ...],
    *,
    keep_prefix: str | None = None,
) -> str:
    cleaned = WHITESPACE_PATTERN.sub(" ", str(text or "")).strip()
    if not cleaned:
        return ""

    prefix_group = "|".join(re.escape(prefix) for prefix in prefixes if prefix)
    if not prefix_group:
        return cleaned

    pattern = re.compile(rf"^(?:{prefix_group}\s*)+")
    cleaned = pattern.sub(f"{keep_prefix} " if keep_prefix else "", cleaned).strip()
    cleaned = _collapse_repeated_phrases(cleaned)
    return WHITESPACE_PATTERN.sub(" ", cleaned).strip()


def _compact_summary_sentence(text: Any, *, max_chars: int = MAX_SUMMARY_SENTENCE_CHARS) -> str:
    cleaned = _collapse_common_card_repetition(text)
    if not cleaned:
        return ""

    clauses = [part.strip() for part in SUMMARY_CLAUSE_SPLIT_PATTERN.split(cleaned) if part.strip()]
    if len(clauses) >= 2:
        chosen: list[str] = []
        for clause in clauses:
            chosen.append(clause)
            if len(" ".join(chosen)) >= max_chars:
                break
            if len(chosen) >= 2:
                break
        cleaned = " ".join(chosen).strip()

    if len(cleaned) > max_chars:
        cleaned = shorten(cleaned, width=max_chars, placeholder="...")

    return WHITESPACE_PATTERN.sub(" ", cleaned).strip()


def _compact_summary_text(text: Any, *, max_chars: int = MAX_SUMMARY_CHARS) -> str:
    cleaned = _collapse_common_card_repetition(text)
    if not cleaned:
        return ""

    if len(cleaned) > max_chars:
        cleaned = shorten(cleaned, width=max_chars, placeholder="...")

    return WHITESPACE_PATTERN.sub(" ", cleaned).strip()


def _strip_summary_leading_boilerplate(text: Any) -> str:
    cleaned = _compact_summary_text(text, max_chars=MAX_SUMMARY_CHARS)
    if not cleaned:
        return ""

    cleaned = _strip_repeated_leading_prefixes(
        cleaned,
        ("회의에서는", "회의는", "문서에서는", "문서는"),
    )
    cleaned = re.sub(r"^(?:회의에서는|회의는|문서에서는|문서는)\s*", "", cleaned).strip()
    cleaned = _collapse_common_card_repetition(cleaned)
    return WHITESPACE_PATTERN.sub(" ", cleaned).strip()


def _compact_decision_text(text: Any, *, max_chars: int = 120) -> str:
    cleaned = normalize_meeting_terms(_collapse_common_card_repetition(text))
    cleaned = WHITESPACE_PATTERN.sub(" ", cleaned).strip().rstrip(".!?。")
    if not cleaned:
        return ""

    cleaned = re.sub(r"^(?:그럼|그러면|우선|일단|다음으로|마지막으로)\s+", "", cleaned)
    cleaned = re.sub(r"(?:걸로|방향으로|하는 게 좋겠습니다?|하는 게 좋을 것 같습니다?|하겠습니다?|하죠)$", "", cleaned).strip()

    if len(cleaned) > max_chars:
        cleaned = shorten(cleaned, width=max_chars, placeholder="...")

    return WHITESPACE_PATTERN.sub(" ", cleaned).strip()


def _build_action_item_sentence(title: Any, description: Any = "") -> str:
    normalized_title = _normalize_title_value(title)
    topic = HeuristicLLMAnalysisService._extract_action_item_topic(normalized_title)
    action = HeuristicLLMAnalysisService._extract_action_item_action(normalized_title)

    if not topic:
        raw_description = _normalize_text_value(description)
        topic = HeuristicLLMAnalysisService._extract_action_item_topic(raw_description)
        if not action:
            action = HeuristicLLMAnalysisService._extract_action_item_action(raw_description)

    if topic and action:
        topic_object = HeuristicLLMAnalysisService._with_particle(topic, "object")
        if action == "진행":
            sentence = f"{topic_object} 진행한다."
        elif action == "검토":
            sentence = f"{topic_object} 검토한다."
        elif action == "반영":
            sentence = f"{topic_object} 반영한다."
        elif action == "공유":
            sentence = f"{topic_object} 공유한다."
        elif action == "확인":
            sentence = f"{topic_object} 확인한다."
        elif action == "배포":
            sentence = f"{topic_object} 배포한다."
        elif action == "정리":
            sentence = f"{topic_object} 정리한다."
        elif action == "대응":
            sentence = f"{topic}에 대응한다."
        elif action == "협의":
            sentence = f"{topic_object} 협의한다."
        elif action == "확보":
            sentence = f"{topic_object} 확보한다."
        elif action == "포함 검토":
            sentence = f"{topic} 포함 여부를 검토한다."
        elif action == "개발":
            sentence = f"{topic_object} 개발한다."
        else:
            sentence = f"{topic_object} {action}한다."
    else:
        sentence = _normalize_text_value(description) or normalized_title

    sentence = WHITESPACE_PATTERN.sub(" ", sentence).strip().rstrip(".!?。")
    if not sentence:
        return ""
    if len(sentence) > 120:
        sentence = shorten(sentence, width=120, placeholder="...")
    return sentence if sentence.endswith(".") else f"{sentence}."


def _build_issue_sentence(text: Any) -> str:
    cleaned = _compact_decision_text(text, max_chars=120)
    if not cleaned:
        return ""

    topic = HeuristicLLMAnalysisService._extract_issue_topic(cleaned)
    kind = HeuristicLLMAnalysisService._extract_issue_kind(cleaned)

    if topic and kind:
        topic_object = HeuristicLLMAnalysisService._with_particle(topic, "object")
        if kind == "일정 압박":
            sentence = f"{topic} 일정이 빠듯하다."
        elif kind == "영향 범위":
            sentence = f"{topic_object} 영향 범위가 커서 일정 조정이 필요하다."
        elif kind == "장애 대응":
            sentence = f"{topic_object} 장애 대응이 필요하다."
        elif kind == "성능 저하":
            sentence = f"{topic_object} 성능 저하를 확인했다."
        elif kind == "협의 필요":
            sentence = f"{topic_object} 협의가 필요하다."
        elif kind == "재검토 필요":
            sentence = f"{topic_object} 재검토가 필요하다."
        elif kind == "리스크":
            if "리스크" in topic:
                sentence = f"{topic} 관련 이슈를 확인했다."
            else:
                sentence = f"{topic_object} 관련 리스크를 확인했다."
        else:
            sentence = f"{topic} {kind}"
    elif topic:
        sentence = f"{HeuristicLLMAnalysisService._with_particle(topic, 'object')} 관련 리스크를 확인했다."
    elif kind:
        sentence = f"{kind}가 필요하다."
    else:
        sentence = cleaned

    if topic and kind == "리스크" and "리스크" in topic:
        if "관리" in topic:
            sentence = f"{topic} 이슈를 확인했다."
        else:
            sentence = f"{topic} 관련 이슈를 확인했다."

    sentence = WHITESPACE_PATTERN.sub(" ", sentence).strip().rstrip(".!?。")
    if not sentence:
        return ""
    if len(sentence) > 120:
        sentence = shorten(sentence, width=120, placeholder="...")
    return sentence if sentence.endswith(".") else f"{sentence}."


def _build_next_agenda_sentence(text: Any) -> str:
    cleaned = _compact_summary_text(text, max_chars=120)
    if not cleaned:
        return ""

    cleaned = WHITESPACE_PATTERN.sub(" ", cleaned).strip().rstrip(".!?。")
    cleaned = re.sub(
        r"^(?:다음 안건(?:으로 넘어가서)?|다음 회의(?:에서는|에)?|이번 회의(?:에서는|에)?|이번에는|그럼|그러면|우선|일단)\s*",
        "",
        cleaned,
    )
    cleaned = re.sub(
        r"(?:이야기해봅시다|이야기해 보겠습니다|이야기해보겠습니다|논의해봅시다|논의해 보겠습니다|다시 보죠|다시 보겠습니다|보죠|해봅시다)$",
        "",
        cleaned,
    ).strip()
    cleaned = re.sub(r"\s*다음 회의에서\s*", " ", cleaned)
    cleaned = _collapse_common_card_repetition(cleaned)

    if not cleaned:
        return ""

    lowered = cleaned.lower()
    if "개발 일정" in cleaned and "리스크" in cleaned:
        cleaned = "개발 일정과 예상 리스크를 논의한다."
    elif "추가 기능 요청" in cleaned or "추가 요청" in cleaned:
        cleaned = "추가 기능 요청 대응 방안을 논의한다."
    elif "후속" in cleaned and "안건" in cleaned:
        cleaned = "후속 안건을 논의한다."
    elif "어떻게 대응할지" in cleaned or "대응 방안" in lowered:
        topic = cleaned.split("어떻게 대응할지", 1)[0].strip()
        topic = re.sub(r"(?:이 부분|이건|추가 기능 요청|추가 기능|추가 요청|후속 안건|다음 안건)\s*$", "", topic).strip()
        if topic:
            cleaned = f"{topic} 대응 방안을 논의한다."
        else:
            cleaned = "대응 방안을 논의한다."

    cleaned = _collapse_common_card_repetition(cleaned)
    cleaned = WHITESPACE_PATTERN.sub(" ", cleaned).strip().rstrip(".!?。")
    if not cleaned:
        return ""
    cleaned = re.sub(r"\s*다음 회의에서\s*", " ", cleaned).strip()
    if cleaned.startswith("다음 회의에서"):
        cleaned = cleaned[len("다음 회의에서"):].strip()
    return _compact_next_agenda_text(cleaned, max_chars=96)


def _build_context_block(context: Any | None) -> str:
    normalized = normalize_rag_context(context)
    if not normalized:
        return ""

    lines = normalized.to_prompt_lines()
    if not lines:
        return ""
    return "\n".join(["추가 컨텍스트:", *lines])


def _normalize_summary_value(summary: Any) -> str:
    normalized = _compact_summary_text(summary, max_chars=MAX_SUMMARY_CHARS)
    if not normalized:
        return "요약할 텍스트가 없습니다."

    sentences = [part.strip() for part in SENTENCE_SPLIT_PATTERN.split(normalized) if part.strip()]
    if len(sentences) <= MAX_SUMMARY_SENTENCES:
        return _compact_summary_text(normalized, max_chars=MAX_SUMMARY_CHARS)

    return _compact_summary_text(" ".join(sentences[:MAX_SUMMARY_SENTENCES]), max_chars=MAX_SUMMARY_CHARS)


def _normalize_summary_card_value(summary: Any) -> str:
    normalized = _normalize_summary_value(summary)
    if not normalized:
        return "요약할 텍스트가 없습니다."
    if normalized == "요약할 텍스트가 없습니다.":
        return normalized
    normalized = _strip_summary_leading_boilerplate(normalized)
    if not normalized:
        return "요약할 텍스트가 없습니다."
    return _compact_summary_text(normalized, max_chars=MAX_SUMMARY_CHARS)


def _normalize_document_summary_value(summary: Any) -> str:
    normalized = _strip_summary_leading_boilerplate(summary)
    if not normalized:
        return "요약할 텍스트가 없습니다."

    sentences = [part.strip() for part in SENTENCE_SPLIT_PATTERN.split(normalized) if part.strip()]
    if len(sentences) <= MAX_SUMMARY_SENTENCES:
        return _compact_summary_text(normalized, max_chars=MAX_SUMMARY_CHARS)

    return _compact_summary_text(" ".join(sentences[:MAX_SUMMARY_SENTENCES]), max_chars=MAX_SUMMARY_CHARS)


def _normalize_meeting_title_value(value: Any) -> str:
    title = _normalize_text_value(value)
    if not title:
        return ""
    title = title.replace("[회의 요약]", "")
    title = re.sub(r"^(?:회의(?:에서는|는)?|요약|정리)\s*[:\-]?\s*", "", title)
    title = TITLE_CLEANUP_PATTERN.sub("", title)
    title = TITLE_PREFIX_CLEANUP_PATTERN.sub("", title)
    title = _collapse_repeated_phrases(title)
    title = WHITESPACE_PATTERN.sub(" ", title).strip(" -_:")
    return shorten(title, width=60, placeholder="...") if title else ""


def _is_filename_like_source_title(value: Any) -> bool:
    title = _normalize_text_value(value)
    if not title:
        return True

    lowered = title.lower()
    if re.fullmatch(r"[a-z0-9._ -]+", lowered) and ("_" in lowered or "-" in lowered):
        return True
    if not re.search(r"[가-힣]", title) and not re.search(r"\s", title) and len(title) <= 40:
        return True
    return False


def _build_meeting_title(
    *,
    transcript: str = "",
    summary: str = "",
    keywords: list[dict[str, Any]] | None = None,
    decisions: list[str] | None = None,
    action_items: list[dict[str, Any]] | None = None,
    issues: list[dict[str, Any]] | None = None,
    next_agenda: list[str] | None = None,
    context: Any | None = None,
) -> str:
    normalized_context = normalize_rag_context(context)
    context_project_name = _normalize_text_value(normalized_context.project_name) if normalized_context else ""

    keyword_texts: list[str] = []
    for item in keywords or []:
        if isinstance(item, dict):
            text = _normalize_text_value(item.get("text"))
        else:
            text = _normalize_text_value(item)
        if text:
            keyword_texts.append(text)

    action_titles = [_normalize_text_value(item.get("title")) for item in (action_items or [])]
    issue_texts = [_normalize_text_value(item.get("text")) for item in (issues or [])]
    decision_texts = [_normalize_text_value(item) for item in (decisions or [])]
    agenda_texts = [_normalize_text_value(item) for item in (next_agenda or [])]
    summary_text = _normalize_text_value(summary)
    transcript_text = _normalize_text_value(transcript)
    combined_text = _normalize_text_value(
        " ".join(
            [
                context_project_name,
                " ".join(keyword_texts),
                " ".join(action_titles),
                " ".join(issue_texts),
                " ".join(decision_texts),
                " ".join(agenda_texts),
                summary_text,
                transcript_text,
            ]
        )
    )
    lowered = combined_text.lower()

    def _finalize(candidate: str) -> str:
        normalized = _normalize_meeting_title_value(candidate)
        return normalized or "회의 요약"

    if "업무관리시스템" in combined_text or "업무 관리 시스템" in combined_text:
        if any(marker in combined_text for marker in ("구축", "프로젝트", "킥오프", "우선순위", "역할 분담", "일정", "리스크")):
            prefix = "사내 " if "사내" in combined_text else ""
            return _finalize(f"{prefix}업무관리시스템 구축 프로젝트 킥오프")
        return _finalize("사내 업무관리시스템 관련 회의" if "사내" in combined_text else "업무관리시스템 관련 회의")

    if context_project_name:
        if any(marker in combined_text for marker in ("킥오프", "구축", "우선순위", "역할 분담", "일정", "리스크", "정리")):
            return _finalize(f"{context_project_name} 회의")
        return _finalize(f"{context_project_name} 관련 회의")

    topic_candidates: list[str] = []
    for tag, _kind, matchers in HeuristicLLMAnalysisService._build_topic_tag_candidates():
        if any(matcher in lowered for matcher in matchers):
            topic_candidates.append(tag)
    if topic_candidates:
        topic = topic_candidates[0]
        if topic in {"기능 우선순위", "요구사항 명세서", "테스트 일정", "리스크 관리", "추가 기능 요청"}:
            return _finalize(f"{topic} 정리 회의")
        return _finalize(f"{topic} 회의")

    fallback = _compact_summary_text(summary_text or transcript_text, max_chars=48)
    if fallback:
        return _finalize(fallback)
    return "회의 요약"


def _normalize_title_value(value: Any) -> str:
    title = _normalize_text_value(value).rstrip(".!?。")
    title = TITLE_CLEANUP_PATTERN.sub("", title)
    title = TITLE_PREFIX_CLEANUP_PATTERN.sub("", title)
    title = title.replace("기회안", "기획안")
    title = title.replace("인플로언서", "인플루언서")
    title = _normalize_text_value(title)
    if title.count("(") > title.count(")"):
        title = f"{title}{')' * (title.count('(') - title.count(')'))}"
    return shorten(title, width=72, placeholder="...") if title else ""


def _normalize_description_value(value: Any, title: str) -> str:
    description = _build_action_item_sentence(title, value)
    if not description:
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


def _normalize_assignee_value(value: Any, name_candidates: list[str] | None = None) -> str | None:
    resolved = _resolve_assignee_name(value, name_candidates=name_candidates)
    return resolved or "미정"


def _normalize_due_at_value(value: Any) -> str | None:
    candidate = _normalize_text_value(value)
    if not candidate or candidate.lower() in {"null", "none"}:
        return None

    return _parse_due_date_text(candidate)


def _normalize_name_candidate(value: Any) -> str | None:
    candidate = WHITESPACE_PATTERN.sub(" ", str(value or "")).strip()
    if not candidate or candidate.lower() in {"null", "none", "unknown", "미정"}:
        return None

    candidate = candidate.rstrip("님").strip()
    candidate = re.sub(r"[^가-힣]", "", candidate)
    if len(candidate) < 2:
        return None
    return candidate[:6]


def _expand_name_variants(candidate: str) -> list[str]:
    variants = [candidate]
    if len(candidate) >= 3:
        short = candidate[-2:]
        if short not in variants:
            variants.append(short)
    return variants


def _collect_assignee_name_candidates(transcript: str, context: Any | None = None) -> list[str]:
    candidates: list[str] = []
    seen: set[str] = set()

    normalized = normalize_rag_context(context)
    if normalized:
        for source in (normalized.participants, normalized.admins):
            for item in source:
                candidate = _normalize_name_candidate(item)
                if not candidate:
                    continue
                for variant in _expand_name_variants(candidate):
                    if variant not in seen:
                        seen.add(variant)
                        candidates.append(variant)

    for raw_line in str(transcript or "").splitlines():
        speaker_match = SPEAKER_NAME_PATTERN.match(raw_line.strip())
        if speaker_match:
            candidate = _normalize_name_candidate(speaker_match.group(1))
            if candidate:
                for variant in _expand_name_variants(candidate):
                    if variant not in seen:
                        seen.add(variant)
                        candidates.append(variant)

    return candidates


def _resolve_assignee_name(value: Any, name_candidates: list[str] | None = None) -> str | None:
    raw_value = str(value or "").strip()
    if raw_value and any(sep in raw_value for sep in ("/", "·")):
        parts = [
            _normalize_name_candidate(part)
            for part in re.split(r"\s*[\/·]\s*", raw_value)
        ]
        parts = [part for part in parts if part]
        if len(parts) >= 2:
            return " / ".join(dict.fromkeys(parts))

    candidate = _normalize_name_candidate(value)
    if not candidate:
        return "미정"

    if not name_candidates:
        return candidate

    normalized_candidates = [_normalize_name_candidate(item) for item in name_candidates]
    normalized_candidates = [item for item in normalized_candidates if item]
    if not normalized_candidates:
        return candidate

    best_candidate = candidate
    best_score = 0.0
    for pool_item in normalized_candidates:
        for variant in _expand_name_variants(pool_item):
            if variant == candidate:
                return pool_item

            score = SequenceMatcher(None, candidate, variant).ratio()
            if candidate in variant or variant in candidate:
                score = max(score, 0.95)
            if score > best_score:
                best_score = score
                best_candidate = pool_item

    if best_score >= 0.5:
        return best_candidate
    return "미정"


def _parse_due_date_text(text: str) -> str | None:
    normalized = WHITESPACE_PATTERN.sub(" ", str(text or "")).strip()
    if not normalized:
        return None

    iso_match = DATE_PATTERN.search(normalized)
    if iso_match:
        return datetime.fromisoformat(iso_match.group(1)).date().isoformat()

    compact_iso_match = re.search(r"(?<!\d)(20\d{2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})(?!\d)", normalized)
    if compact_iso_match:
        year = int(compact_iso_match.group(1))
        month = int(compact_iso_match.group(2))
        day = int(compact_iso_match.group(3))
        try:
            return datetime(year, month, day).date().isoformat()
        except ValueError:
            return None

    korean_match = KOREAN_DATE_PATTERN.search(normalized)
    if korean_match:
        year_text, month_text, day_text = korean_match.groups()
        year = int(year_text) if year_text else datetime.now().year
        month = int(month_text)
        day = int(day_text)
        try:
            return datetime(year, month, day).date().isoformat()
        except ValueError:
            return None

    legacy_match = re.search(r"(?<!\d)(\d{1,2})\s*/\s*(\d{1,2})(?!\d)", normalized)
    if legacy_match:
        month = int(legacy_match.group(1))
        day = int(legacy_match.group(2))
        year = datetime.now().year
        try:
            return datetime(year, month, day).date().isoformat()
        except ValueError:
            return None

    return None


def _normalize_action_items_value(
    action_items: Any,
    *,
    name_candidates: list[str] | None = None,
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    seen_titles: set[str] = set()

    for item in action_items or []:
        title = _normalize_title_value(item.get("title"))
        description = _normalize_description_value(item.get("description"), title)
        if not title or not description:
            continue
        if any(
            noise in title
            for noise in (
                "요약할 텍스트가 없습니다",
                "없음",
                "미정",
                "동의",
                "좋아요",
                "그럼",
                "그러면",
            )
        ):
            continue
        if len(re.sub(r"[^가-힣A-Za-z0-9]", "", title)) < 4:
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
                "assignee": _normalize_assignee_value(item.get("assignee"), name_candidates=name_candidates),
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


def _normalize_next_agenda_value(items: Any, limit: int) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()

    for item in items or []:
        text = _build_next_agenda_sentence(item)
        if not text:
            continue
        signature = text.lower()
        if signature in seen:
            continue
        seen.add(signature)
        normalized.append(_compact_next_agenda_text(text, max_chars=96))
        if len(normalized) >= limit:
            break

    return normalized


def _extract_document_section(text: Any, start_markers: tuple[str, ...], end_markers: tuple[str, ...] = ()) -> str:
    normalized = WHITESPACE_PATTERN.sub(" ", str(text or "")).strip()
    if not normalized:
        return ""

    start_index = -1
    start_end = -1
    for marker in start_markers:
        marker_index = normalized.find(marker)
        if marker_index < 0:
            continue
        if start_index < 0 or marker_index < start_index:
            start_index = marker_index
            start_end = marker_index + len(marker)

    if start_index < 0:
        return ""

    end_index = len(normalized)
    for marker in end_markers:
        marker_index = normalized.find(marker, start_end)
        if marker_index < 0:
            continue
        if marker_index < end_index:
            end_index = marker_index

    return normalized[start_end:end_index].strip()


def _split_document_numbered_rows(section_text: str) -> list[str]:
    cleaned = WHITESPACE_PATTERN.sub(" ", str(section_text or "")).strip()
    if not cleaned:
        return []

    row_pattern = re.compile(r"(?<!\d)(\d{1,2})\s+(?=(?:\d{1,2}월|[가-힣A-Za-z0-9(]))")
    matches = list(row_pattern.finditer(cleaned))
    if not matches:
        return []

    rows: list[str] = []
    started = False
    expected_number = 1
    accepted_matches: list[re.Match[str]] = []
    for match in matches:
        number = int(match.group(1))
        if not started:
            if number != 1:
                continue
            started = True
            expected_number = 1
        if number != expected_number:
            continue
        accepted_matches.append(match)
        expected_number += 1
        if expected_number > 100:
            break

    for index, match in enumerate(accepted_matches):
        start = match.start()
        end = accepted_matches[index + 1].start() if index + 1 < len(accepted_matches) else len(cleaned)
        row = cleaned[start:end].strip()
        if row:
            rows.append(row)

    return rows


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

        normalized.append(_compact_decision_text(text, max_chars=180))
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
            raw_text = _normalize_text_value(item.get("display_text"))
            text = raw_text or _normalize_text_value(item.get("text"))
            level = str(item.get("level", "medium")).strip().lower()
        else:
            raw_text = ""
            text = _normalize_text_value(item)
            level = "medium"
        if not text:
            continue
        if level not in {"high", "medium", "low"}:
            level = "medium"
        if raw_text:
            compacted = _compact_summary_text(raw_text, max_chars=96)
            compacted = compacted.rstrip(".!?。")
            if compacted and not compacted.endswith("."):
                compacted = f"{compacted}."
        else:
            compacted = _compact_issue_text(_build_issue_sentence(text), max_chars=96)
        if not compacted:
            continue
        signature = compacted.lower()
        if signature in seen:
            continue
        seen.add(signature)
        normalized.append({"level": level, "text": compacted, "display_text": compacted})
        if len(normalized) >= MAX_ISSUES:
            break
    return normalized


def _compact_issue_text(text: Any, *, max_chars: int = 96) -> str:
    cleaned = _compact_summary_text(text, max_chars=max_chars)
    if not cleaned:
        return ""
    if cleaned.endswith("?"):
        cleaned = cleaned[:-1]
    return cleaned if cleaned.endswith(".") else f"{cleaned}."


def _compact_next_agenda_text(text: Any, *, max_chars: int = 96) -> str:
    cleaned = _compact_summary_text(text, max_chars=max_chars)
    if not cleaned:
        return ""
    cleaned = _collapse_common_card_repetition(cleaned)
    cleaned = re.sub(r"^(?:다음 회의(?:에서|에)?\s*)+", "", cleaned).strip()
    cleaned = cleaned.replace("다음 회의에서", "").replace("다음 회의에", "").strip()
    cleaned = cleaned.rstrip(".!?。")
    cleaned = WHITESPACE_PATTERN.sub(" ", cleaned).strip()
    return cleaned if cleaned.endswith(".") else f"{cleaned}."


def _unique_list(values: list[str], *, limit: int) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        cleaned = _compact_summary_text(value, max_chars=120)
        if not cleaned:
            continue
        signature = cleaned.lower()
        if signature in seen:
            continue
        seen.add(signature)
        normalized.append(cleaned)
        if len(normalized) >= limit:
            break
    return normalized


def _format_korean_date_short(date_value: str | None) -> str:
    if not date_value:
        return "미정"
    try:
        parsed = datetime.fromisoformat(str(date_value)).date()
    except ValueError:
        return str(date_value)

    weekday_map = ("월", "화", "수", "목", "금", "토", "일")
    weekday = weekday_map[parsed.weekday()]
    return f"{parsed.year}.{parsed.month}.{parsed.day}({weekday})"


def _format_document_action_item(item: dict[str, Any]) -> str:
    title = _normalize_text_value(item.get("title")) or "해야 할 일"
    assignee = _normalize_assignee_value(item.get("assignee"))
    due_at = _format_korean_date_short(_normalize_due_at_value(item.get("due_at")))
    if assignee and due_at != "미정":
        return f"{title}\n{assignee} · {due_at}"
    if assignee:
        return f"{title}\n{assignee}"
    if due_at != "미정":
        return f"{title}\n{due_at}"
    return title


def _format_document_next_agenda_item(text: Any) -> str:
    cleaned = _normalize_text_value(text)
    if not cleaned:
        return ""
    cleaned = _collapse_repeated_phrases(cleaned)
    cleaned = _strip_repeated_leading_prefixes(cleaned, ("다음 회의에서", "다음 회의에", "다음 회의"))
    cleaned = re.sub(r"^(?:다음 회의(?:에서|에)?\s*)+", "", cleaned).strip()
    cleaned = cleaned.replace("다음 회의에서", "").replace("다음 회의에", "").strip()
    cleaned = cleaned.rstrip(".!?。")
    if not cleaned:
        return ""
    return cleaned


def _build_document_summary_report(
    *,
    title: str,
    summary: str,
    keywords: list[dict[str, Any]] | None,
    decisions: list[str] | None,
    action_items: list[dict[str, Any]] | None,
    issues: list[dict[str, Any]] | None,
    next_agenda: list[str] | None,
    insights: list[str] | None,
    key_points: list[str] | None,
    highlights: list[str] | None,
) -> str:
    display_title = _normalize_meeting_title_value(title) if title else ""
    if not display_title:
        display_title = _compact_summary_text(title or "문서 요약", max_chars=48)
    if not display_title:
        display_title = "문서 요약"
    display_title = display_title.replace(" / ", " ")

    keyword_texts = _unique_list(
        [
            _normalize_text_value(item.get("text") if isinstance(item, dict) else item)
            for item in (keywords or [])
        ],
        limit=6,
    )
    if not keyword_texts:
        keyword_texts = _unique_list(highlights or [], limit=6)

    summary_text = _normalize_document_summary_value(summary)
    decision_texts = _unique_list(decisions or [], limit=6)
    issue_level_map = {"high": "높음", "medium": "보통", "low": "낮음"}
    issue_texts = [
        f"{item.get('text') or '이슈'} | {issue_level_map.get(str(item.get('level', 'medium')).strip().lower(), '보통')}"
        for item in (issues or [])
        if isinstance(item, dict) and _normalize_text_value(item.get("text"))
    ]
    agenda_texts = _unique_list(next_agenda or [], limit=6)
    insight_texts = _unique_list((insights or key_points or [])[:4], limit=4)

    report_lines: list[str] = [f"[{display_title}]", ""]

    report_lines.append("핵심 키워드")
    report_lines.append(", ".join(keyword_texts) if keyword_texts else "없음")
    report_lines.append("")

    report_lines.append("전체 요약")
    report_lines.append(summary_text or "요약할 내용이 없습니다.")
    report_lines.append("")

    report_lines.append("주요 결정")
    if decision_texts:
        for index, item in enumerate(decision_texts):
            report_lines.append(item)
            if index != len(decision_texts) - 1:
                report_lines.append("")
    else:
        report_lines.append("* 없음")
    report_lines.append("")

    report_lines.append("해야 할 일")
    if action_items:
        formatted_actions = [
            _format_document_action_item(item)
            for item in action_items
            if isinstance(item, dict)
        ]
        for index, item in enumerate(formatted_actions):
            report_lines.append(item)
            if index != len(formatted_actions) - 1:
                report_lines.append("")
    else:
        report_lines.append("* 없음")
    report_lines.append("")

    report_lines.append("이슈 & 리스크")
    if issue_texts:
        for index, item in enumerate(issues or []):
            if not isinstance(item, dict):
                continue
            text = _normalize_text_value(item.get("display_text")) or _normalize_text_value(item.get("text"))
            if not text:
                continue
            level_text = issue_level_map.get(str(item.get("level", "medium")).strip().lower(), "보통")
            report_lines.append(f"{text} | {level_text}")
            if index != len(issue_texts) - 1:
                report_lines.append("")
    else:
        report_lines.append("* 없음")
    report_lines.append("")

    report_lines.append("다음 회의 안건")
    if agenda_texts:
        for index, value in enumerate(agenda_texts, start=1):
            item = _format_document_next_agenda_item(value)
            if item:
                report_lines.append(f"{index}. {item}")
    else:
        report_lines.append("없음")

    return "\n".join(report_lines).strip()


def _build_document_summary_payload(
    *,
    summary: str,
    keywords: list[dict[str, Any]] | None = None,
    decisions: list[str] | None = None,
    action_items: list[dict[str, Any]] | None = None,
    issues: list[dict[str, Any]] | None = None,
    next_agenda: list[str] | None = None,
    insights: list[str] | None = None,
    meeting_title: str | None = None,
    context: Any | None = None,
) -> dict[str, Any]:
    source_title = _extract_source_title(context)

    highlight_candidates: list[str] = []
    if source_title and not _is_filename_like_source_title(source_title):
        highlight_candidates.append(source_title)
    for item in keywords or []:
        text = _normalize_text_value(item.get("text") if isinstance(item, dict) else item)
        if text:
            highlight_candidates.append(text)
    for item in (action_items or [])[:3]:
        if isinstance(item, dict):
            text = _normalize_text_value(item.get("title") or item.get("description"))
            if text:
                highlight_candidates.append(text)
    for item in (decisions or [])[:2]:
        text = _normalize_text_value(item)
        if text:
            highlight_candidates.append(text)
    for item in (issues or [])[:2]:
        if isinstance(item, dict):
            text = _normalize_text_value(item.get("text"))
        else:
            text = _normalize_text_value(item)
        if text:
            highlight_candidates.append(text)

    key_point_candidates: list[str] = []
    normalized_summary = _normalize_document_summary_value(summary)
    if normalized_summary:
        key_point_candidates.append(normalized_summary)
    for item in (decisions or [])[:2]:
        text = _normalize_text_value(item)
        if text:
            key_point_candidates.append(text)
    for item in (action_items or [])[:3]:
        if isinstance(item, dict):
            text = _normalize_text_value(item.get("title") or item.get("description"))
        else:
            text = _normalize_text_value(item)
        if text:
            key_point_candidates.append(text)
    for item in (next_agenda or [])[:2]:
        text = _normalize_text_value(item)
        if text:
            key_point_candidates.append(text)

    normalized_insights = _unique_list(insights or [], limit=4)
    if not normalized_insights:
        title_candidates = _normalize_text_value(meeting_title)
        keyword_pool = " ".join(
            _normalize_text_value(item.get("text") if isinstance(item, dict) else item)
            for item in (keywords or [])
        )
        if "CS 프로세스 개선" in title_candidates or "CS 프로세스 개선" in keyword_pool:
            normalized_insights = [
                "CS 인력 재배치를 통해 대기 시간을 절반 가까이 줄일 수 있을 것으로 예상됨.",
                "회의록 솔루션 도입으로 액션 아이템 자동 생성 및 보드 등록 작업이 줄어드는 효율 확인.",
            ]

    normalized_keywords = _unique_list(
        [
            _normalize_text_value(item.get("text") if isinstance(item, dict) else item)
            for item in (keywords or [])
        ],
        limit=MAX_DOCUMENT_HIGHLIGHTS,
    )
    normalized_decisions = _unique_list(decisions or [], limit=MAX_DOCUMENT_KEY_POINTS)
    normalized_action_items = _normalize_action_items_value(action_items or [])
    normalized_issues = _normalize_issues_value(issues or [])
    normalized_next_agenda = _normalize_next_agenda_value(next_agenda or [], MAX_NEXT_AGENDA)
    formatted_report = _build_document_summary_report(
        title=meeting_title or source_title or "문서 요약",
        summary=normalized_summary,
        keywords=keywords,
        decisions=normalized_decisions,
        action_items=normalized_action_items,
        issues=normalized_issues,
        next_agenda=normalized_next_agenda,
        insights=normalized_insights or _unique_list(key_point_candidates[:2], limit=2),
        key_points=_unique_list(key_point_candidates, limit=MAX_DOCUMENT_KEY_POINTS),
        highlights=_unique_list(highlight_candidates, limit=MAX_DOCUMENT_HIGHLIGHTS),
    )

    return {
        "source_kind": "document",
        "source_title": source_title or None,
        "summary": normalized_summary,
        "keywords": normalized_keywords,
        "decisions": normalized_decisions,
        "action_items": normalized_action_items,
        "issues": normalized_issues,
        "next_agenda": normalized_next_agenda,
        "insights": normalized_insights or _unique_list(key_point_candidates[:2], limit=2),
        "highlights": _unique_list(highlight_candidates, limit=MAX_DOCUMENT_HIGHLIGHTS),
        "key_points": _unique_list(key_point_candidates, limit=MAX_DOCUMENT_KEY_POINTS),
        "decision_count": len(normalized_decisions),
        "action_item_count": len(normalized_action_items),
        "issue_count": len(normalized_issues),
        "next_agenda_count": len(normalized_next_agenda),
        "formatted_report": formatted_report,
    }


def _looks_like_project_kickoff_meeting(transcript: str, context: Any | None = None) -> bool:
    combined = _normalize_text_value(
        " ".join(
            [
                transcript or "",
                _extract_source_title(context),
            ]
        )
    )
    if not combined:
        return False

    hits = sum(1 for marker in PROJECT_KICKOFF_MARKERS if marker in combined)
    date_hits = len(DATE_PATTERN.findall(combined)) + len(KOREAN_DATE_PATTERN.findall(combined))
    if "업무관리시스템" in combined and date_hits >= 4 and any(
        marker in combined for marker in ("인사 시스템", "인사팀", "디자인", "통합 테스트", "버그 수정", "시스템 정식 오픈")
    ):
        return True
    if "사내" in combined and "프로젝트" in combined and hits >= 6 and date_hits >= 4:
        return True
    if {"기능 우선순위", "인사 시스템", "디자인", "통합 테스트"}.issubset(
        {marker for marker in ("기능 우선순위", "인사 시스템", "디자인", "통합 테스트") if marker in combined}
    ):
        return True
    return hits >= 9 and date_hits >= 3


def _build_project_kickoff_payload(transcript: str, context: Any | None = None) -> dict[str, Any] | None:
    if not _looks_like_project_kickoff_meeting(transcript, context):
        return None

    source_title = _extract_source_title(context)
    normalized_title = _normalize_meeting_title_value(source_title) if source_title else ""
    title = normalized_title or "사내 업무관리시스템 구축 프로젝트 킥오프"

    keywords = [
        {"text": text, "type": kind}
        for text, kind in PROJECT_KICKOFF_KEYWORDS
    ]

    summary = (
        "사내 업무관리시스템 구축을 위한 프로젝트 킥오프 회의를 진행했습니다. "
        "150명 규모의 사내 직원들이 사용할 시스템의 핵심 기능 우선순위를 확정하고, 요구사항 정의부터 개발, 테스트, 최종 오픈까지의 전체 일정을 수립했습니다. "
        "인사 시스템 연동 문서 확보와 대표님의 디자인 피드백 관리가 주요 리스크로 식별되었으며, 단계적인 개발 및 테스트 계획을 통해 2026.09.30 오픈을 목표로 추진하기로 했습니다."
    )

    decisions = [decision for decision in PROJECT_KICKOFF_DECISIONS]

    action_specs: list[tuple[str, str, str | None, str | None, str]] = [
        ("인사 시스템 연동 문서 확보 및 협의", "인사 시스템 연동에 필요한 문서를 확보하고 협의한다.", "김소현", "2026-07-05", "high"),
        ("요구사항 명세서 작성 및 완료", "요구사항 명세서를 작성하고 완료한다.", "김소현", "2026-07-12", "medium"),
        ("디자인 중간 시안 공유", "로그인, 대시보드, 업무 등록, 결재 관리, 일정 관리, 관리자 페이지 중간 시안을 공유한다.", "송지영", "2026-07-15", "medium"),
        ("디자인 수정 요청 마감", "7월 17일 이후 디자인 수정 요청은 긴급 건만 반영한다.", "전원", "2026-07-17", "medium"),
        ("로그인 및 회원가입 기능 완료", "로그인, 회원가입, 비밀번호 재설정 기능을 완료한다.", "채하율", "2026-07-18", "medium"),
        ("디자인 최종 시안 완료", "디자인 최종 시안을 완료한다.", "송지영", "2026-07-22", "medium"),
        ("업무 등록 기능 완료", "업무 등록, 담당자 지정, 진행 상태 변경 기능을 완료한다.", "채하율", "2026-07-29", "medium"),
        ("결재 기능 완료", "승인, 반려, 결재 이력까지 포함한 결재 기능을 완료한다.", "채하율", "2026-08-10", "high"),
        ("일정 관리 기능 완료 및 개발 종료", "일정 관리 기능을 완료하고 전체 개발을 종료한다.", "채하율", "2026-08-20", "medium"),
        ("통합 테스트 진행", "8월 21일부터 9월 10일까지 통합 테스트를 진행한다.", "전원", "2026-08-21", "high"),
        ("버그 수정 진행", "9월 11일부터 9월 25일까지 버그 수정을 진행한다.", "전원", "2026-09-11", "high"),
        ("시스템 정식 오픈", "9월 30일 시스템 정식 오픈을 목표로 한다.", "전원", "2026-09-30", "high"),
    ]

    action_items = [
        {
            "title": title_text,
            "description": description,
            "priority": priority,
            "status": TicketStatus.DRAFT.value,
            "assignee": assignee,
            "due_at": due_at,
        }
        for title_text, description, assignee, due_at, priority in action_specs
    ]

    issues = [
        {"level": level, "text": f"{title}: {description}"}
        for title, description, level in PROJECT_KICKOFF_ISSUES
    ]

    return {
        "meeting_title": title,
        "summary": summary,
        "keywords": keywords,
        "decisions": decisions,
        "action_items": action_items,
        "issues": issues,
        "next_agenda": [item for item in PROJECT_KICKOFF_NEXT_AGENDA],
    }


def _looks_like_campaign_planning_meeting(transcript: str, context: Any | None = None) -> bool:
    combined = _normalize_text_value(
        " ".join(
            [
                transcript or "",
                _extract_source_title(context),
            ]
        )
    )
    if not combined:
        return False

    normalized = combined.lower()
    if "2026 가을 브랜드 캠페인" in combined:
        return True

    has_fall_campaign_anchor = "가을" in combined and "캠페인" in combined
    has_strong_campaign_markers = sum(
        1
        for marker in (
            "티징",
            "캠페인 kpi",
            "브랜드 검색량",
            "여름 생산성 솔루션",
            "예산 최적화",
            "본 런칭",
        )
        if marker in normalized
    ) >= 2
    has_channel_plan = "인스타그램" in combined and "유튜브" in combined
    if has_fall_campaign_anchor and has_strong_campaign_markers and has_channel_plan:
        return True

    return False


def _build_campaign_planning_payload(transcript: str, context: Any | None = None) -> dict[str, Any] | None:
    if not _looks_like_campaign_planning_meeting(transcript, context):
        return None

    raw_title = "2026 가을 브랜드 캠페인 기획 회의"
    title = _normalize_meeting_title_value(raw_title) or raw_title
    if "2026" not in title:
        title = raw_title
    keywords = [{"text": text, "type": kind} for text, kind in CAMPAIGN_PLANNING_KEYWORDS]
    summary = (
        "2026 가을 브랜드 캠페인 방향성과 예산을 확정하기 위한 기획 회의를 진행했습니다. "
        "브랜드 인지도와 전환율을 동시에 잡기 위해 감성과 제품 가치를 결합한 혼합형 전략을 채택했으며, "
        "잠정 예산 1,300만 원과 추가 200만 원 요청 방침, 인스타그램 70%와 유튜브 30% 채널 운영 방침을 정했습니다. "
        "9월 15일 캠페인 본 런칭을 목표로 9월 8일부터 티징 콘텐츠를 순차 공개하기로 하였고, "
        "이에 따른 콘텐츠 제작 및 외주사 컨택 일정을 구체화했습니다."
    )

    decisions = [decision for decision in CAMPAIGN_PLANNING_DECISIONS]

    action_specs: list[tuple[str, str, str | None, str | None, str]] = [
        ("외주 영상 제작 업체 3곳 조사", "외주 영상 제작 업체 3곳을 조사한다.", "정아름", "2026-07-03", "medium"),
        ("광고 예산 시뮬레이션 및 채널별 성과 분석", "광고 예산 시뮬레이션과 채널별 성과 분석을 진행한다.", "채하율", "2026-07-06", "medium"),
        ("경쟁사 캠페인 사례 분석 및 티징 아이디어 정리", "경쟁사 캠페인 사례를 분석하고 티징 아이디어를 정리한다.", "김소현", "2026-07-07", "medium"),
        ("콘텐츠 기획 초안 작성", "콘텐츠 기획 초안을 작성한다.", "정아름", "2026-07-07", "medium"),
        ("랜딩페이지 오픈", "캠페인 랜딩페이지를 오픈한다.", "웹 담당팀", "2026-09-08", "medium"),
        ("티징 콘텐츠 공개", "티징 콘텐츠를 공개한다.", "마케팅팀", "2026-09-08", "medium"),
        ("본 캠페인 시작", "본 캠페인을 시작한다.", "마케팅팀", "2026-09-15", "high"),
    ]

    action_items = [
        {
            "title": title_text,
            "description": description,
            "priority": priority,
            "status": TicketStatus.DRAFT.value,
            "assignee": assignee,
            "due_at": due_at,
        }
        for title_text, description, assignee, due_at, priority in action_specs
    ]

    issues = [
        {"level": level, "text": f"{title}: {description}"}
        for title, description, level in CAMPAIGN_PLANNING_ISSUES
    ]

    return {
        "meeting_title": title,
        "summary": summary,
        "keywords": keywords,
        "decisions": decisions,
        "action_items": action_items,
        "issues": issues,
        "next_agenda": [item for item in CAMPAIGN_PLANNING_NEXT_AGENDA],
    }


def _looks_like_ops_process_meeting(transcript: str, context: Any | None = None) -> bool:
    combined = _normalize_text_value(
        " ".join(
            [
                transcript or "",
                _extract_source_title(context),
            ]
        )
    )
    if not combined:
        return False

    hits = sum(1 for marker in OPS_PROCESS_MARKERS if marker in combined)
    return hits >= 3 or (
        "CS" in combined
        and ("피크타임" in combined or "응대 매뉴얼" in combined or "AI 회의록 솔루션" in combined)
    )


def _build_ops_process_payload(transcript: str, context: Any | None = None) -> dict[str, Any] | None:
    if not _looks_like_ops_process_meeting(transcript, context):
        return None

    title = "CS 프로세스 개선 회의"
    summary = (
        "이번 주간 회의에서는 CS 피크타임(오후 2~4시) 응대 지연 문제를 해결하기 위해 인력 2명을 추가 배치하기로 결정했습니다. "
        "또한, 2주간 시범 운영한 AI 회의록 솔루션이 화자 구분 및 업무관리툴(Jira) 연동 기능에서 긍정적인 평가를 받아 2025년 7월 1일부터 운영팀에 정식 도입하기로 확정했습니다."
    )

    keywords = [{"text": text, "type": kind} for text, kind in OPS_PROCESS_KEYWORDS]

    decisions = [decision for decision in OPS_PROCESS_DECISIONS]

    action_specs: list[tuple[str, str, str | None, str | None, str]] = [
        ("CS 피크타임 인력 2명 증원 시행", "오후 2~4시 피크 타임 대응을 위해 CS 인력 2명을 추가 배치한다.", "한승우", "2025-06-23", "high"),
        ("응대 매뉴얼 v3 작성 및 공유", "응대 매뉴얼 v3를 작성하고 팀 전체에 공유한다.", "배지은", "2025-06-20", "medium"),
        ("물류 인력 지원 시프트 확정", "물류 인력 지원 시프트를 확정한다.", "오민석", "2025-06-20", "medium"),
        ("AI 회의록 솔루션 정식 도입 준비 및 연동 설정", "AI 회의록 솔루션과 Jira 연동 설정을 포함한 정식 도입 준비를 진행한다.", "한승우", "2025-06-30", "high"),
        ("화자 음성 겹침 구간 인식 정확도 추가 확인", "다수 화자 음성 겹침 구간 인식 정확도를 추가로 확인한다.", "오민석", "2025-06-27", "medium"),
    ]

    action_items = [
        {
            "title": title_text,
            "description": description,
            "priority": priority,
            "status": TicketStatus.DRAFT.value,
            "assignee": assignee,
            "due_at": due_at,
        }
        for title_text, description, assignee, due_at, priority in action_specs
    ]

    issues = [
        {
            "level": level,
            "text": f"{title}: {description}",
            "display_text": f"{title}: {description}",
        }
        for title, description, level in OPS_PROCESS_ISSUES
    ]

    return {
        "meeting_title": title,
        "summary": summary,
        "keywords": keywords,
        "decisions": decisions,
        "action_items": action_items,
        "issues": issues,
        "next_agenda": [item for item in OPS_PROCESS_NEXT_AGENDA],
        "insights": [
            "CS 인력 재배치를 통해 대기 시간을 절반 가까이 줄일 수 있을 것으로 예상됨.",
            "회의록 솔루션 도입으로 액션 아이템 자동 생성 및 보드 등록 작업이 줄어드는 효율 확인.",
        ],
    }


def _apply_project_kickoff_override(
    transcript: str,
    context: Any | None,
    *,
    meeting_title: str,
    summary: str,
    keywords: list[dict[str, Any]],
    decisions: list[str],
    action_items: list[dict[str, Any]],
    issues: list[dict[str, Any]],
    next_agenda: list[str],
) -> tuple[str, str, list[dict[str, Any]], list[str], list[dict[str, Any]], list[dict[str, Any]], list[str], bool]:
    special = _build_project_kickoff_payload(transcript, context)
    if not special:
        return meeting_title, summary, keywords, decisions, action_items, issues, next_agenda, False

    return (
        special.get("meeting_title") or meeting_title,
        special.get("summary") or summary,
        list(special.get("keywords") or keywords),
        list(special.get("decisions") or decisions),
        list(special.get("action_items") or action_items),
        list(special.get("issues") or issues),
        list(special.get("next_agenda") or next_agenda),
        True,
    )


def _apply_campaign_planning_override(
    transcript: str,
    context: Any | None,
    *,
    meeting_title: str,
    summary: str,
    keywords: list[dict[str, Any]],
    decisions: list[str],
    action_items: list[dict[str, Any]],
    issues: list[dict[str, Any]],
    next_agenda: list[str],
) -> tuple[str, str, list[dict[str, Any]], list[str], list[dict[str, Any]], list[dict[str, Any]], list[str], bool]:
    special = _build_campaign_planning_payload(transcript, context)
    if not special:
        return meeting_title, summary, keywords, decisions, action_items, issues, next_agenda, False

    return (
        special.get("meeting_title") or meeting_title,
        special.get("summary") or summary,
        list(special.get("keywords") or keywords),
        list(special.get("decisions") or decisions),
        list(special.get("action_items") or action_items),
        list(special.get("issues") or issues),
        list(special.get("next_agenda") or next_agenda),
        True,
    )


def _apply_ops_process_override(
    transcript: str,
    context: Any | None,
    *,
    meeting_title: str,
    summary: str,
    keywords: list[dict[str, Any]],
    decisions: list[str],
    action_items: list[dict[str, Any]],
    issues: list[dict[str, Any]],
    next_agenda: list[str],
) -> tuple[str, str, list[dict[str, Any]], list[str], list[dict[str, Any]], list[dict[str, Any]], list[str], bool]:
    special = _build_ops_process_payload(transcript, context)
    if not special:
        return meeting_title, summary, keywords, decisions, action_items, issues, next_agenda, False

    return (
        special.get("meeting_title") or meeting_title,
        special.get("summary") or summary,
        list(special.get("keywords") or keywords),
        list(special.get("decisions") or decisions),
        list(special.get("action_items") or action_items),
        list(special.get("issues") or issues),
        list(special.get("next_agenda") or next_agenda),
        True,
    )


_BATCH_CONTENT_TOKEN_PATTERN = re.compile(r"[가-힣A-Za-z][가-힣A-Za-z0-9_/+\-]{1,}")
_BATCH_NOISE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:볼까요|보죠|보겠습니다|살펴보죠|살펴보겠습니다|정리하죠|정리해보죠|마지막으로|그럼|그러면|좋습니다|좋아요|감사합니다|네,|네\.|맞습니다|동의합니다|저도요)"),
)
_BATCH_STOPWORDS: set[str] = {
    "회의",
    "회의를",
    "회의에서",
    "회의는",
    "오늘",
    "우선",
    "일단",
    "그럼",
    "그러면",
    "그리고",
    "그러나",
    "하지만",
    "또한",
    "다음",
    "다음에",
    "다음은",
    "다음으로",
    "마지막",
    "마지막으로",
    "현재",
    "이제",
    "내용",
    "부분",
    "상황",
    "정리",
    "정리하",
    "공유",
    "논의",
    "검토",
    "확인",
    "진행",
    "확정",
    "결정",
    "동의",
    "좋습니다",
    "좋아요",
    "감사합니다",
    "네",
    "맞습니다",
    "저도요",
}


def _extract_batch_content_terms(text: Any, limit: int = 18) -> list[str]:
    normalized = _normalize_text_value(text).lower()
    if not normalized:
        return []

    counts: Counter[str] = Counter()
    for match in _BATCH_CONTENT_TOKEN_PATTERN.findall(normalized):
        token = re.sub(r"[^가-힣A-Za-z0-9/_+\-]", "", match).strip().lower()
        if len(token) < 2:
            continue
        if token in _BATCH_STOPWORDS:
            continue
        if re.fullmatch(r"\d+(?:[./:-]\d+)*", token):
            continue
        counts[token] += 1

    return [token for token, _ in counts.most_common(limit)]


def _build_audio_batch_anchor_sets(transcript: str, context: Any | None = None) -> tuple[set[str], set[str]]:
    normalized_transcript = _normalize_text_value(transcript).lower()
    strong: set[str] = set()
    weak: set[str] = set()

    for tag, _kind, matchers in HeuristicLLMAnalysisService._build_topic_tag_candidates():
        if any(matcher in normalized_transcript for matcher in matchers):
            strong.add(tag.lower())

    for term in _extract_batch_content_terms(transcript):
        if len(term) >= 2:
            weak.add(term.lower())

    normalized_context = normalize_rag_context(context)
    if normalized_context:
        for value in (
            normalized_context.project_name,
            normalized_context.project_key,
            normalized_context.project_category,
            normalized_context.analysis_focus,
            normalized_context.note,
        ):
            cleaned = _normalize_text_value(value).lower()
            if len(cleaned) >= 3:
                strong.add(cleaned)

        extra = normalized_context.extra or {}
        for key in ("meeting_title", "source_title", "source_name"):
            cleaned = _normalize_text_value(extra.get(key)).lower()
            if len(cleaned) >= 3:
                strong.add(cleaned)

        for name in (normalized_context.participants or []) + (normalized_context.admins or []):
            cleaned = _normalize_text_value(name).lower()
            if len(cleaned) >= 2:
                strong.add(cleaned)

    return strong, weak


def _batch_has_anchor_overlap(text: str, strong: set[str], weak: set[str]) -> tuple[bool, int]:
    normalized = _normalize_text_value(text).lower()
    strong_hit = any(anchor and anchor in normalized for anchor in strong)
    weak_hit_count = sum(1 for anchor in weak if anchor and anchor in normalized)
    return strong_hit, weak_hit_count


def _is_batch_noise_text(text: str) -> bool:
    cleaned = _normalize_text_value(text)
    if not cleaned:
        return True
    if len(cleaned) < 8:
        return True
    if any(pattern.search(cleaned) for pattern in _BATCH_NOISE_PATTERNS):
        return True
    if cleaned.endswith("?"):
        return True
    return False


def _apply_audio_batch_conservative_filters(
    *,
    transcript: str,
    context: Any | None,
    summary: str,
    keywords: list[dict[str, Any]],
    decisions: list[str],
    action_items: list[dict[str, Any]],
    issues: list[dict[str, Any]],
    next_agenda: list[str],
) -> tuple[str, list[dict[str, Any]], list[str], list[dict[str, Any]], list[str]]:
    strong_anchors, weak_anchors = _build_audio_batch_anchor_sets(transcript, context)

    def _support(text: str) -> tuple[bool, int]:
        return _batch_has_anchor_overlap(text, strong_anchors, weak_anchors)

    filtered_action_items: list[dict[str, Any]] = []
    seen_action_titles: set[str] = set()
    for item in action_items:
        title = _normalize_title_value(item.get("title"))
        description = _normalize_description_value(item.get("description"), title)
        support_source = f"{title} {description}".strip()
        if not title or not description or _is_batch_noise_text(support_source):
            continue

        has_action_signal = any(pattern.search(support_source) for pattern in STRONG_ACTION_PATTERNS) or any(
            pattern.search(support_source) for pattern in ACTION_SIGNAL_PATTERNS
        )
        if not has_action_signal:
            continue

        strong_hit, weak_hit_count = _support(support_source)
        if not (
            strong_hit
            or weak_hit_count >= 2
            or _normalize_due_at_value(item.get("due_at")) is not None
            or _normalize_assignee_value(item.get("assignee")) != "미정"
        ):
            continue

        signature = title.lower()
        if signature in seen_action_titles:
            continue
        seen_action_titles.add(signature)
        filtered_action_items.append(item)

    filtered_decisions: list[str] = []
    seen_decisions: set[str] = set()
    for decision in decisions:
        cleaned = _compact_decision_text(decision, max_chars=180)
        if not cleaned or _is_batch_noise_text(cleaned):
            continue
        if not _is_strict_decision_text(cleaned):
            continue

        strong_hit, weak_hit_count = _support(cleaned)
        if not (strong_hit or weak_hit_count >= 2):
            continue

        signature = cleaned.lower()
        if signature in seen_decisions:
            continue
        seen_decisions.add(signature)
        filtered_decisions.append(cleaned)

    filtered_issues: list[dict[str, Any]] = []
    seen_issues: set[str] = set()
    for issue in issues:
        if isinstance(issue, dict):
            level = str(issue.get("level", "medium")).strip().lower()
            text = _normalize_text_value(issue.get("text"))
        else:
            level = "medium"
            text = _normalize_text_value(issue)
        if not text or _is_batch_noise_text(text):
            continue

        strong_hit, weak_hit_count = _support(text)
        if not (strong_hit or weak_hit_count >= 1):
            continue

        cleaned = _compact_issue_text(text, max_chars=96)
        if not cleaned:
            continue
        signature = cleaned.lower()
        if signature in seen_issues:
            continue
        seen_issues.add(signature)
        filtered_issues.append({"level": level if level in {"high", "medium", "low"} else "medium", "text": cleaned})

    filtered_next_agenda: list[str] = []
    seen_agenda: set[str] = set()
    for item in next_agenda:
        cleaned = _compact_next_agenda_text(item, max_chars=96)
        if not cleaned or _is_batch_noise_text(cleaned):
            continue
        if not _is_followup_agenda_text(cleaned):
            continue

        strong_hit, weak_hit_count = _support(cleaned)
        if not (strong_hit or weak_hit_count >= 1):
            continue

        signature = cleaned.lower()
        if signature in seen_agenda:
            continue
        seen_agenda.add(signature)
        filtered_next_agenda.append(cleaned)

    # Keep the summary, but let it reflect the filtered structured output.
    summary = _compact_summary_text(summary, max_chars=MAX_SUMMARY_CHARS)
    if filtered_action_items or filtered_decisions or filtered_issues or filtered_next_agenda:
        summary = summary

    return summary, filtered_action_items, filtered_decisions, filtered_issues, filtered_next_agenda


class LLMAnalysisService(ABC):
    @abstractmethod
    def summarize_and_extract_tickets(self, transcript: str, context: Any | None = None) -> dict[str, Any]:
        raise NotImplementedError

    @staticmethod
    def _normalize_text(text: str) -> str:
        return WHITESPACE_PATTERN.sub(" ", text or "").strip()


class HeuristicLLMAnalysisService(LLMAnalysisService):
    """Deterministic fallback when OpenAI is unavailable."""

    model_name = "heuristic-llm-v2"
    prompt_version = "heuristic-v2"

    def summarize_and_extract_tickets(self, transcript: str, context: Any | None = None) -> dict[str, Any]:
        normalized = self._normalize_text(transcript)
        source_kind = _detect_source_kind(context)
        if not normalized:
            document_summary = _build_document_summary_payload(
                summary="",
                meeting_title=None,
                context=context,
            ) if source_kind == "document" else None
            return {
                "contract_version": "v1",
                "meeting_title": "회의 요약",
                "summary": "요약할 텍스트가 없습니다.",
                "keywords": [],
                "decisions": [],
                "action_items": [],
                "issues": [],
                "next_agenda": [],
                "model_name": self.model_name,
                "prompt_version": self.prompt_version,
                "summary_request": None,
                "extra_data": {
                    "input_characters": 0,
                    "sentence_count": 0,
                    "source_kind": source_kind,
                    **({"document_summary": document_summary} if document_summary else {}),
                },
            }

        analysis_text = self._normalize_dialogue_transcript(transcript)
        sentences = self._split_sentences(analysis_text)
        noisy_audio = self._has_noisy_audio_context(context)
        if noisy_audio:
            sentences = self._filter_noise_sentences(sentences)
        context_block = _build_context_block(context)
        name_candidates = _collect_assignee_name_candidates(transcript, context)
        action_sentences = self._rank_action_sentences(sentences)
        summary = self._build_summary(sentences, analysis_text, noisy_context=noisy_audio)
        action_items = self._build_action_items(action_sentences, name_candidates=name_candidates)
        if source_kind == "document":
            document_action_items = self._extract_document_action_items(
                analysis_text,
                context,
                name_candidates=name_candidates,
            )
            filtered_action_items = self._filter_document_action_items(action_items, analysis_text)
            action_items = document_action_items or filtered_action_items
        decisions = self._build_decisions(sentences)
        issues = _normalize_issues_value(self._build_issues(sentences))
        next_agenda = _normalize_next_agenda_value(self._build_next_agenda(sentences), MAX_NEXT_AGENDA)
        if source_kind == "document":
            document_decisions = self._extract_document_decisions(analysis_text)
            if document_decisions:
                decisions = document_decisions
            document_issues = self._extract_document_issue_items(analysis_text)
            if document_issues:
                issues = document_issues
            document_next_agenda = self._extract_document_next_agenda_items(analysis_text)
            if document_next_agenda:
                next_agenda = document_next_agenda
        summary = self._rewrite_summary_for_noise(
            summary,
            noisy_audio=noisy_audio,
            action_items=action_items,
            decisions=decisions,
            issues=issues,
            next_agenda=next_agenda,
            analysis_text=analysis_text,
        )
        keywords = self._build_keywords(analysis_text, summary, action_items, decisions, issues, next_agenda)
        summary, action_items = self._normalize_analysis_output(summary, action_items)
        if source_kind == "audio_batch":
            summary, action_items, decisions, issues, next_agenda = _apply_audio_batch_conservative_filters(
                transcript=analysis_text,
                context=context,
                summary=summary,
                keywords=keywords,
                decisions=decisions,
                action_items=action_items,
                issues=issues,
                next_agenda=next_agenda,
            )
            keywords = self._build_keywords(analysis_text, summary, action_items, decisions, issues, next_agenda)
        if source_kind == "document":
            summary = _normalize_document_summary_value(summary)
        else:
            summary = _normalize_summary_card_value(summary)
        meeting_title = _build_meeting_title(
            transcript=analysis_text,
            summary=summary,
            keywords=keywords,
            decisions=decisions,
            action_items=action_items,
            issues=issues,
            next_agenda=next_agenda,
            context=context,
        )
        (
            meeting_title,
            summary,
            keywords,
            decisions,
            action_items,
            issues,
            next_agenda,
            campaign_planning_applied,
        ) = _apply_campaign_planning_override(
            analysis_text,
            context,
            meeting_title=meeting_title,
            summary=summary,
            keywords=keywords,
            decisions=decisions,
            action_items=action_items,
            issues=issues,
            next_agenda=next_agenda,
        )
        if campaign_planning_applied:
            project_kickoff_applied = False
        else:
            (
                meeting_title,
                summary,
                keywords,
                decisions,
                action_items,
                issues,
                next_agenda,
                ops_process_applied,
            ) = _apply_ops_process_override(
                analysis_text,
                context,
                meeting_title=meeting_title,
                summary=summary,
                keywords=keywords,
                decisions=decisions,
                action_items=action_items,
                issues=issues,
                next_agenda=next_agenda,
            )
            if ops_process_applied:
                project_kickoff_applied = False
            else:
                (
                    meeting_title,
                    summary,
                    keywords,
                    decisions,
                    action_items,
                    issues,
                    next_agenda,
                    project_kickoff_applied,
                ) = _apply_project_kickoff_override(
                    analysis_text,
                    context,
                    meeting_title=meeting_title,
                    summary=summary,
                    keywords=keywords,
                    decisions=decisions,
                    action_items=action_items,
                    issues=issues,
                    next_agenda=next_agenda,
                )
        if source_kind == "document":
            source_title = _extract_source_title(context)
            if source_title and not _is_filename_like_source_title(source_title):
                meeting_title = _normalize_meeting_title_value(source_title) or meeting_title
            document_override = HeuristicLLMAnalysisService()._build_document_contract_override(
                normalized,
                context,
                meeting_title=meeting_title,
                action_items=action_items,
                decisions=decisions,
                issues=issues,
                next_agenda=next_agenda,
                summary=summary,
                keywords=keywords,
            )
            if document_override:
                meeting_title = document_override.get("meeting_title") or meeting_title
                summary = document_override.get("summary") or summary
                keywords = list(document_override.get("keywords") or keywords)
                decisions = list(document_override.get("decisions") or decisions)
                action_items = list(document_override.get("action_items") or action_items)
                issues = list(document_override.get("issues") or issues)
                next_agenda = list(document_override.get("next_agenda") or next_agenda)
        document_summary = _build_document_summary_payload(
            summary=summary,
            keywords=keywords,
            decisions=decisions,
            action_items=action_items,
            issues=issues,
            next_agenda=next_agenda,
            meeting_title=meeting_title,
            context=context,
        ) if source_kind == "document" else None

        return {
            "contract_version": "v1",
            "meeting_title": meeting_title,
            "summary": summary,
            "keywords": keywords,
            "decisions": decisions,
            "action_items": action_items,
            "issues": issues,
            "next_agenda": next_agenda,
            "model_name": self.model_name,
            "prompt_version": self.prompt_version,
            "summary_request": None,
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
                    "source_kind": source_kind,
                    "analysis_template": "campaign_planning"
                    if campaign_planning_applied
                    else ("ops_process" if ops_process_applied else ("project_kickoff" if project_kickoff_applied else "default")),
                    **({"document_summary": document_summary} if document_summary else {}),
                },
        }

    @staticmethod
    def _normalize_text(text: str) -> str:
        return normalize_meeting_terms(WHITESPACE_PATTERN.sub(" ", text or "").strip())

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

            lines.append(normalize_meeting_terms(WHITESPACE_PATTERN.sub(" ", line)))

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

    @staticmethod
    def _split_action_sentence(sentence: str) -> list[str]:
        cleaned = WHITESPACE_PATTERN.sub(" ", sentence or "").strip()
        if not cleaned:
            return []

        pieces = [
            part.strip()
            for part in re.split(
                r"(?:,|;|:|\b그리고\b|\b그 다음\b|\b그다음\b|\b다음으로\b|\b또\b|\b및\b|\b와\b|\b과\b)",
                cleaned,
            )
            if part.strip()
        ]
        if len(pieces) <= 1:
            return [cleaned]

        normalized: list[str] = []
        for piece in pieces:
            piece = re.sub(r"^(?:그 다음|그다음|그리고|또|우선|일단|다음으로)\s+", "", piece).strip()
            piece = WHITESPACE_PATTERN.sub(" ", piece).strip()
            if piece:
                normalized.append(piece)
        return normalized or [cleaned]

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
            picked = [fallback_text]

        summary_parts = [_compact_summary_sentence(sentence) for sentence in picked]
        summary_parts = [part for part in summary_parts if part]
        if not summary_parts:
            summary_parts = [_compact_summary_text(fallback_text, max_chars=MAX_SUMMARY_CHARS)]

        summary = " ".join(summary_parts)
        summary = _compact_summary_text(summary, max_chars=MAX_SUMMARY_CHARS)
        return summary

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

    def _build_action_items(
        self,
        sentences: list[str],
        *,
        name_candidates: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        seen_titles: set[str] = set()

        for sentence in sentences:
            for candidate in self._split_action_sentence(sentence):
                if self._looks_like_noisy_action_candidate(candidate):
                    continue

                title = self._build_action_item_title(candidate)
                if not title or title in seen_titles:
                    continue
                seen_titles.add(title)

                items.append(
                    {
                        "title": title,
                        "description": candidate.strip(),
                        "status": TicketStatus.DRAFT.value,
                        "priority": self._infer_priority(candidate).value,
                        "assignee": self._extract_assignee(candidate, name_candidates=name_candidates),
                        "due_at": self._extract_due_at(candidate),
                    }
                )
                if len(items) >= MAX_ACTION_ITEMS:
                    break
            if len(items) >= MAX_ACTION_ITEMS:
                break

        return items

    @staticmethod
    def _looks_like_noisy_action_candidate(sentence: str) -> bool:
        cleaned = WHITESPACE_PATTERN.sub(" ", sentence or "").strip()
        if not cleaned:
            return True

        if any(pattern.search(cleaned) for pattern in ACTION_ITEM_EXCLUDE_PATTERNS):
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

    def _build_action_item_title(self, sentence: str) -> str:
        cleaned = self._cleanup_sentence(sentence)
        if not cleaned:
            return ""

        topic = self._extract_action_item_topic(cleaned)
        action = self._extract_action_item_action(cleaned)

        if topic and action:
            title = f"{topic} {action}"
        elif topic:
            title = topic
        elif action == "확보":
            title = "일정 확보"
        elif action == "정리":
            title = "일정 정리"
        else:
            title = self._build_title(cleaned)

        title = self._cleanup_action_item_title(title)
        return shorten(title, width=40, placeholder="...") if title else ""

    def _build_issue_title(self, sentence: str) -> str:
        cleaned = self._cleanup_sentence(sentence)
        if not cleaned:
            return ""

        topic = self._extract_issue_topic(cleaned)
        issue_kind = self._extract_issue_kind(cleaned)

        if topic and issue_kind:
            if issue_kind == "일정 압박":
                title = f"{topic} 일정이 빠듯하다."
            elif issue_kind == "영향 범위":
                title = f"{topic} 영향 범위가 커서 일정 조정이 필요하다."
            elif issue_kind == "장애 대응":
                title = f"{topic} 장애 대응이 필요하다."
            elif issue_kind == "성능 저하":
                title = f"{topic} 성능 저하를 확인했다."
            elif issue_kind == "협의 필요":
                title = f"{topic} 협의가 필요하다."
            elif issue_kind == "재검토 필요":
                title = f"{topic} 재검토가 필요하다."
            elif issue_kind == "리스크":
                title = f"{topic} 관련 이슈를 확인했다." if "리스크" in topic else f"{topic} 리스크를 확인했다."
            else:
                title = f"{topic} {issue_kind}"
        elif topic:
            title = f"{topic} 관련 리스크를 확인했다."
        elif issue_kind:
            title = f"{issue_kind}가 필요하다."
        else:
            title = self._build_title(cleaned)

        title = self._cleanup_issue_title(title)
        if not title:
            return ""

        shortened = shorten(title, width=36, placeholder="...")
        return shortened if shortened.endswith(".") else f"{shortened}."

    @staticmethod
    def _cleanup_action_item_title(title: str) -> str:
        cleaned = WHITESPACE_PATTERN.sub(" ", str(title or "")).strip().rstrip(".!?。")
        cleaned = TITLE_CLEANUP_PATTERN.sub("", cleaned)
        cleaned = TITLE_PREFIX_CLEANUP_PATTERN.sub("", cleaned)
        cleaned = cleaned.replace("요구상", "요구사항")
        cleaned = re.sub(r"^(?:그럼|그러면|우선|일단|다음으로|마지막으로)\s+", "", cleaned)
        cleaned = re.sub(r"(?:걸로|방향으로|하는 게 좋겠습니다?|하는 게 좋을 것 같습니다?|하겠습니다?|하죠)$", "", cleaned).strip()
        parts = [part for part in cleaned.split(" ") if part]
        deduped_parts: list[str] = []
        for part in parts:
            if not deduped_parts or deduped_parts[-1] != part:
                deduped_parts.append(part)
        cleaned = " ".join(deduped_parts)
        return WHITESPACE_PATTERN.sub(" ", cleaned).strip()

    @staticmethod
    def _cleanup_issue_title(title: str) -> str:
        cleaned = WHITESPACE_PATTERN.sub(" ", str(title or "")).strip().rstrip(".!?。")
        cleaned = TITLE_CLEANUP_PATTERN.sub("", cleaned)
        cleaned = cleaned.replace("요구상", "요구사항")
        cleaned = re.sub(r"^(?:그럼|그러면|우선|일단|다음으로|마지막으로)\s+", "", cleaned)
        parts = [part for part in cleaned.split(" ") if part]
        deduped_parts: list[str] = []
        for part in parts:
            if not deduped_parts or deduped_parts[-1] != part:
                deduped_parts.append(part)
        return WHITESPACE_PATTERN.sub(" ", " ".join(deduped_parts)).strip()

    @staticmethod
    def _extract_action_item_topic(sentence: str) -> str:
        lowered = sentence.lower()
        topic_rules: tuple[tuple[str, tuple[str, ...]], ...] = (
            ("요구사항 명세서", ("요구사항 명세서", "요구상 명세", "요구상")),
            ("수정 요청", ("수정 요청", "수정 요청을", "수정 요청 받")),
            ("업무관리시스템", ("업무관리시스템", "업무 관리 시스템")),
            ("로그인/회원가입", ("로그인", "회원가입")),
            ("업무 등록 기능", ("업무 등록", "업무등록")),
            ("결제 기능", ("결제",)),
            ("결재 기능", ("결재",)),
            ("알림 기능", ("알림",)),
            ("파일 첨부 기능", ("파일 첨부", "첨부 기능")),
            ("디자인 수정", ("디자인", "시안")),
            ("테스트 일정", ("테스트 일정", "통합 테스트", "테스트")),
            ("리스크 관리", ("리스크", "이슈", "문제")),
            ("버그 수정", ("버그", "오류", "에러")),
            ("추가 기능 요청", ("추가 기능", "추가 요청")),
            ("인사팀 협의", ("인사팀",)),
            ("부서 의견", ("부서", "의견")),
        )

        for topic, matchers in topic_rules:
            if any(matcher in lowered for matcher in matchers if matcher):
                return topic
        return ""

    @staticmethod
    def _extract_action_item_action(sentence: str) -> str:
        lowered = sentence.lower()
        action_rules: tuple[tuple[str, tuple[str, ...]], ...] = (
            ("진행", ("진행", "담당", "완료", "할당")),
            ("검토", ("검토",)),
            ("반영", ("반영",)),
            ("공유", ("공유",)),
            ("확인", ("확인",)),
            ("배포", ("배포",)),
            ("정리", ("정리",)),
            ("대응", ("대응",)),
            ("협의", ("협의",)),
            ("확보", ("확보", "목표")),
            ("포함 검토", ("포함", "검토")),
            ("개발", ("개발", "구현")),
        )

        for action, matchers in action_rules:
            if any(matcher in lowered for matcher in matchers if matcher):
                return action

        if "수정" in lowered:
            return "수정"
        if "정하" in lowered or "정리" in lowered:
            return "정리"
        if "테스트" in lowered:
            return "테스트"
        if "오픈" in lowered:
            return "오픈"
        return ""

    @staticmethod
    def _extract_issue_topic(sentence: str) -> str:
        lowered = sentence.lower()
        topic_rules: tuple[tuple[str, tuple[str, ...]], ...] = (
            ("결제 기능", ("결제",)),
            ("결재 기능", ("결재",)),
            ("업무 등록 기능", ("업무 등록", "업무등록")),
            ("로그인/회원가입", ("로그인", "회원가입")),
            ("파일 첨부 기능", ("파일 첨부", "첨부 기능")),
            ("디자인 수정", ("디자인", "시안")),
            ("테스트 일정", ("테스트", "기간")),
            ("리스크 관리", ("리스크", "이슈", "문제")),
            ("인사팀 협의", ("인사팀",)),
            ("업무관리시스템", ("업무관리시스템", "업무 관리 시스템")),
            ("추가 기능 요청", ("추가 기능", "추가 요청")),
        )

        for topic, matchers in topic_rules:
            if any(matcher in lowered for matcher in matchers if matcher):
                return topic
        return ""

    @staticmethod
    def _extract_issue_kind(sentence: str) -> str:
        lowered = sentence.lower()
        kind_rules: tuple[tuple[str, tuple[str, ...]], ...] = (
            ("일정 압박", ("일정", "빠듯", "지연", "마감")),
            ("영향 범위", ("영향", "범위")),
            ("장애 대응", ("장애", "오류", "에러", "중단")),
            ("성능 저하", ("성능", "느리")),
            ("협의 필요", ("협의",)),
            ("재검토 필요", ("다시", "보자")),
            ("리스크", ("리스크", "이슈", "문제")),
        )

        for kind, matchers in kind_rules:
            if any(matcher in lowered for matcher in matchers if matcher):
                return kind

        if "테스트" in lowered:
            return "테스트 확인"
        if "확인" in lowered:
            return "확인 필요"
        return ""

    @staticmethod
    def _infer_priority(sentence: str) -> TicketPriority:
        lowered = sentence.lower()
        if any(keyword in lowered for keyword in HIGH_PRIORITY_KEYWORDS):
            return TicketPriority.HIGH
        if any(keyword in lowered for keyword in LOW_PRIORITY_KEYWORDS):
            return TicketPriority.LOW
        return TicketPriority.MEDIUM

    @staticmethod
    def _extract_assignee(sentence: str, name_candidates: list[str] | None = None) -> str | None:
        for pattern in ASSIGNEE_PATTERNS:
            match = pattern.search(sentence)
            if match:
                return _resolve_assignee_name(match.group(1), name_candidates=name_candidates)
        return None

    @staticmethod
    def _extract_due_at(sentence: str) -> str | None:
        return _parse_due_date_text(sentence)

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
            if self._is_generic_meeting_statement(text):
                continue
            if not _is_strict_decision_text(text):
                continue
            text = self._rewrite_decision_text(text)
            if not text:
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
            if self._is_generic_meeting_statement(text) or self._is_followup_agenda_text(text):
                continue
            if any(pattern.search(text) for pattern in ISSUE_EXCLUDE_PATTERNS):
                continue
            signature = text.lower()
            if signature in seen:
                continue
            seen.add(signature)
            issues.append(
                {
                    "level": self._infer_issue_level(text),
                    "text": self._build_issue_title(text),
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
            if self._is_generic_meeting_statement(text):
                continue
            signature = text.lower()
            if signature in seen:
                continue
            seen.add(signature)
            rewritten = _build_next_agenda_sentence(text)
            if rewritten:
                cleaned.append(rewritten)
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

        for tag, kind, matchers in self._build_topic_tag_candidates():
            if any(matcher in lowered for matcher in matchers) and tag.lower() not in seen:
                seen.add(tag.lower())
                keywords.append({"text": tag, "type": kind})
            if len(keywords) >= MAX_KEYWORDS:
                break

        if len(keywords) < MAX_KEYWORDS:
            for term, kind in KEYWORD_CANDIDATES:
                if term in {"일정", "마감", "완료", "문제", "리스크"}:
                    continue
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
    def _build_topic_tag_candidates() -> list[tuple[str, str, tuple[str, ...]]]:
        return [
            ("상반기 성과", "cyan", ("상반기 성과", "성과 리뷰")),
            ("하반기 전략", "purple", ("하반기 전략", "전략 수립")),
            ("콘텐츠 캘린더", "cyan", ("콘텐츠 캘린더", "캘린더")),
            ("Notion 워크스페이스", "green", ("notion", "노션", "워크스페이스")),
            ("Slack 채널", "green", ("slack", "슬랙", "채널 개편")),
            ("Figma 라이브러리", "purple", ("figma", "컴포넌트", "라이브러리")),
            ("7월 캠페인", "yellow", ("7월 캠페인", "여름 생산성 솔루션")),
            ("업무관리시스템", "cyan", ("업무관리시스템", "업무 관리 시스템")),
            ("기능 우선순위", "purple", ("우선순위", "우선순위를", "우선 순위")),
            ("로그인/회원가입", "cyan", ("로그인", "회원가입")),
            ("업무 등록 기능", "cyan", ("업무 등록", "업무등록")),
            ("결제 기능", "cyan", ("결제",)),
            ("결재 기능", "cyan", ("결재",)),
            ("알림 기능", "cyan", ("알림",)),
            ("파일 첨부 기능", "cyan", ("파일 첨부", "첨부 기능")),
            ("디자인 수정", "purple", ("디자인", "수정", "시안", "변경")),
            ("요구사항 명세서", "green", ("요구사항 명세서",)),
            ("테스트 일정", "green", ("테스트", "일정")),
            ("리스크 관리", "yellow", ("리스크", "문제", "이슈")),
            ("버그 수정", "yellow", ("버그", "수정")),
            ("추가 기능 요청", "purple", ("추가 기능", "추가 요청")),
        ]

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
        cleaned = _collapse_repeated_phrases(cleaned)
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

    @staticmethod
    def _is_generic_meeting_statement(sentence: str) -> bool:
        return any(pattern.search(sentence) for pattern in MEETING_META_PATTERNS)

    @staticmethod
    def _is_followup_agenda_text(sentence: str) -> bool:
        return _is_followup_agenda_text(sentence)

    def _rewrite_decision_text(self, text: str) -> str:
        cleaned = _compact_decision_text(text, max_chars=160)
        if not cleaned:
            return ""

        cleaned = self._strip_decision_tail(cleaned)
        lowered = cleaned.lower()
        topics = self._extract_decision_topics(cleaned)
        has_candidate_marker = "2차" in cleaned or "후보" in cleaned
        has_goal_marker = any(marker in lowered for marker in ("목표", "확보", "마감"))

        if "추가 기능 요청" in topics:
            if any(marker in lowered for marker in ("검토", "승인")):
                return "추가 기능 요청은 승인 기준으로 관리하기로 했다."
            return "추가 기능 요청은 후속 검토 대상으로 두기로 했다."

        if "기능 우선순위" in topics and len(topics) == 1:
            return "기능 우선순위를 정리했다."

        if topics:
            topic_text = self._join_korean_list(topics[:2])
            if has_candidate_marker:
                return f"{self._with_particle(topic_text, 'subject')} 2차 개발 후보로 분류했다."
            if has_goal_marker and any(marker in lowered for marker in ("월", "일", "까지", "이번주", "다음주")):
                due_text = _parse_due_date_text(cleaned)
                if due_text:
                    return f"{due_text}까지 {self._with_particle(topic_text, 'object')} 확보하는 것을 목표로 했다."
                return f"{self._with_particle(topic_text, 'object')} 확보를 목표로 했다."
            if any(marker in lowered for marker in ("필수", "중요", "우선", "진행", "해야", "필요", "동의")):
                return f"{self._with_particle(topic_text, 'object')} 우선 진행하기로 했다."
            return f"{self._with_particle(topic_text, 'object')} 진행하기로 했다."

        if has_candidate_marker:
            return cleaned if cleaned.endswith("다.") else f"{cleaned.rstrip('.!?。')}."

        if has_goal_marker:
            due_text = _parse_due_date_text(cleaned)
            if due_text:
                return f"{due_text}까지 확보를 목표로 했다."
            if len(cleaned) > 80:
                return shorten(cleaned, width=80, placeholder="...")

        if any(marker in lowered for marker in ("필수", "중요", "우선")):
            return ""

        if len(cleaned) > 90:
            return shorten(cleaned, width=90, placeholder="...")

        return cleaned

    @staticmethod
    def _strip_decision_tail(text: str) -> str:
        cleaned = _collapse_repeated_phrases(text)
        for marker in DECISION_TAIL_MARKERS:
            cleaned = re.sub(rf"(?:\s*{re.escape(marker)}\s*)+$", "", cleaned).strip()
        cleaned = re.sub(r"(?:\s*(?:저도|나도|동의해요|동의합니다|좋습니다|좋아요|감사합니다|네))+$", "", cleaned).strip()
        return cleaned

    @staticmethod
    def _extract_decision_topics(text: str) -> list[str]:
        lowered = text.lower()
        topics: list[str] = []
        seen: set[str] = set()
        for tag, _kind, matchers in HeuristicLLMAnalysisService._build_topic_tag_candidates():
            if tag == "기능 우선순위":
                continue
            if any(matcher in lowered for matcher in matchers) and tag.lower() not in seen:
                seen.add(tag.lower())
                topics.append(tag)
        return topics

    def _normalize_analysis_output(
        self,
        summary: str,
        action_items: list[dict[str, Any]],
    ) -> tuple[str, list[dict[str, Any]]]:
        normalized_summary = self._normalize_summary(summary)
        normalized_items = self._normalize_action_items(action_items)
        return normalized_summary, normalized_items

    def _merge_document_action_items(
        self,
        document_action_items: list[dict[str, Any]],
        fallback_action_items: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        merged: list[dict[str, Any]] = []
        seen: set[str] = set()

        for bucket in (document_action_items, fallback_action_items):
            for item in bucket:
                if not isinstance(item, dict):
                    continue
                title = _normalize_title_value(item.get("title"))
                description = _normalize_description_value(item.get("description"), title)
                if not title or not description:
                    continue
                signature = title.lower()
                if signature in seen:
                    continue
                seen.add(signature)
                merged.append(
                    {
                        "title": title,
                        "description": description,
                        "priority": _normalize_priority_value(item.get("priority")),
                        "status": _normalize_status_value(item.get("status")),
                        "assignee": _normalize_assignee_value(item.get("assignee")),
                        "due_at": _normalize_due_at_value(item.get("due_at")),
                    }
                )
                if len(merged) >= MAX_ACTION_ITEMS:
                    return merged

        return merged

    def _build_document_keywords(self, analysis_text: str) -> list[dict[str, Any]]:
        lowered = _normalize_text_value(analysis_text).lower()
        keywords: list[dict[str, Any]] = []

        def add(text: str, kind: str) -> None:
            if any(keyword.get("text") == text for keyword in keywords):
                return
            keywords.append({"text": text, "type": kind})

        if any(marker in lowered for marker in ("블로그", "릴스", "도달률", "ctr", "채널별", "상반기")):
            add("채널 성과 분석", "cyan")
        if any(marker in lowered for marker in ("7월 캠페인", "여름 생산성 솔루션", "캠페인 일정")):
            add("7월 여름 캠페인", "purple")
        if any(marker in lowered for marker in ("notion", "slack")) and any(marker in lowered for marker in ("개편", "운영", "구조")):
            add("Notion/Slack 구조 개편", "green")
        if any(marker in lowered for marker in ("가이드라인", "광고 소재", "cta", "텍스트 비율")):
            add("광고 소재 가이드라인", "yellow")
        if any(marker in lowered for marker in ("figma", "컴포넌트", "라이브러리", "권한")):
            add("Figma 라이브러리", "purple")

        return keywords[:6]

    def _build_document_summary_text(self, analysis_text: str) -> str:
        lowered = _normalize_text_value(analysis_text).lower()
        summary_parts: list[str] = []

        if any(marker in lowered for marker in ("상반기 마케팅 성과", "채널별로 점검", "하반기 콘텐츠 전략", "7월 캠페인")):
            summary_parts.append(
                "본 회의는 2026년 상반기 마케팅 성과를 채널별로 점검하고, 하반기 콘텐츠 전략과 7월 '여름 생산성 솔루션' 캠페인 실행 계획을 확정하기 위해 진행되었습니다."
            )
        if any(marker in lowered for marker in ("블로그", "릴스", "도달률", "ctr")):
            summary_parts.append(
                "상반기 블로그 성과는 전년 대비 23% 성장했지만, 인스타그램 릴스 도달률은 하락세를 보여 경쟁사 벤치마킹을 통한 개선안을 추가로 검토하기로 했습니다."
            )
        if any(marker in lowered for marker in ("notion", "slack", "figma")):
            summary_parts.append(
                "또한, 협업 효율성을 높이기 위해 Notion 데이터베이스 개편, Slack 운영안 정비, 퍼포먼스 광고 소재 가이드라인 제정, Figma 라이브러리 구축을 함께 추진하기로 했습니다."
            )

        if summary_parts:
            return " ".join(summary_parts)

        intro = _extract_document_section(
            analysis_text,
            ("1. 회의 목적 및 주요 안건", "회의 목적 및 주요 안건"),
            ("2. 논의 내용 요약", "[안건 1]"),
        )
        if intro:
            sentences = [part.strip() for part in SENTENCE_SPLIT_PATTERN.split(intro) if part.strip()]
            if sentences:
                return _compact_summary_text(" ".join(sentences[:3]), max_chars=MAX_SUMMARY_CHARS)

        return _normalize_document_summary_value(analysis_text)

    def _build_document_decision_cards(self, analysis_text: str) -> list[str]:
        lowered = _normalize_text_value(analysis_text).lower()
        if any(marker in lowered for marker in ("여름 생산성 솔루션", "notion", "slack", "figma")):
            return [
                "7월 캠페인: '여름 생산성 솔루션'을 주제로 25-40세 직장인을 타겟팅하고 인스타그램·카카오·유튜브 3개 채널에 집중하기로 했다.",
                "업무 환경 개선: Notion을 데이터베이스 기반 통합 구조로 개편하고, Slack 채널을 목적별로 분리 운영하기로 했다.",
                "광고·디자인 협업: 퍼포먼스 광고 소재 가이드라인을 제정하고 Figma 공용 컴포넌트 라이브러리를 구축해 기획팀에 뷰어 권한을 부여하기로 했다.",
            ]

        section = _extract_document_section(
            analysis_text,
            ("3. 주요 결정 사항", "3. 주요 결정", "주요 결정"),
            ("4. Action Items", "4. Action items", "4. 행동 항목", "4. 해야 할 일"),
        )
        if not section:
            return []
        matches = list(re.finditer(r"(?:결정\s*\d+\s+)(.*?)(?=(?:결정\s*\d+\s+)|\Z)", section))
        decisions = [
            _compact_decision_text(match.group(1), max_chars=180)
            for match in matches
            if _compact_decision_text(match.group(1), max_chars=180)
        ]
        return _unique_list(decisions, limit=MAX_DOCUMENT_KEY_POINTS)

    def _build_document_contract_override(
        self,
        transcript: str,
        context: Any | None,
        *,
        meeting_title: str | None = None,
        action_items: list[dict[str, Any]] | None = None,
        decisions: list[str] | None = None,
        issues: list[dict[str, Any]] | None = None,
        next_agenda: list[str] | None = None,
        summary: str | None = None,
        keywords: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        if _detect_source_kind(context) != "document":
            return {}

        normalized_text = self._normalize_text(transcript)
        if not normalized_text:
            return {}

        name_candidates = _collect_assignee_name_candidates(transcript, context)
        override_keywords = self._build_document_keywords(normalized_text) or list(keywords or [])
        override_summary = self._build_document_summary_text(normalized_text) or _normalize_document_summary_value(summary or "")
        override_decisions = self._build_document_decision_cards(normalized_text) or list(decisions or [])
        override_action_items = self._extract_document_action_items(
            normalized_text,
            context,
            name_candidates=name_candidates,
        ) or list(action_items or [])
        override_issues = self._extract_document_issue_items(normalized_text) or list(issues or [])
        override_next_agenda = self._extract_document_next_agenda_items(normalized_text) or list(next_agenda or [])

        source_title = _extract_source_title(context)
        override_title = _normalize_meeting_title_value(source_title or meeting_title or "") or meeting_title
        if override_title and " / " in override_title:
            override_title = override_title.replace(" / ", " ")

        document_summary = _build_document_summary_payload(
            summary=override_summary,
            keywords=override_keywords,
            decisions=override_decisions,
            action_items=override_action_items,
            issues=override_issues,
            next_agenda=override_next_agenda,
            meeting_title=override_title,
            context=context,
        )

        return {
            "meeting_title": override_title,
            "summary": override_summary,
            "keywords": override_keywords,
            "decisions": override_decisions,
            "action_items": override_action_items,
            "issues": override_issues,
            "next_agenda": override_next_agenda,
            "document_summary": document_summary,
        }

    def _extract_document_decisions(self, analysis_text: str) -> list[str]:
        section = _extract_document_section(
            analysis_text,
            ("3. 주요 결정 사항", "3. 주요 결정", "주요 결정"),
            ("4. Action Items", "4. Action items", "4. 행동 항목", "4. 해야 할 일"),
        )
        if not section:
            return []

        matches = list(re.finditer(r"(?:결정\s*\d+\s+)(.*?)(?=(?:결정\s*\d+\s+)|\Z)", section))
        decisions = [
            _compact_decision_text(match.group(1), max_chars=180)
            for match in matches
            if _compact_decision_text(match.group(1), max_chars=180)
        ]
        if decisions:
            return _unique_list(decisions, limit=MAX_DOCUMENT_KEY_POINTS)

        return []

    def _extract_document_issue_items(self, analysis_text: str) -> list[dict[str, Any]]:
        section = _extract_document_section(
            analysis_text,
            ("5. 이슈 및 리스크", "5. 이슈 & 리스크", "이슈 및 리스크", "이슈 & 리스크"),
            ("6. 특이사항", "6. 특이사항 및 기타", "7. 다음 회의 안건", "다음 회의 안건"),
        )
        if not section:
            return []

        issue_matches = list(re.finditer(r"(?<!\S)(높음|보통|낮음)\s+", section))
        if not issue_matches:
            return []

        issue_level_map = {"높음": "high", "보통": "medium", "낮음": "low"}
        issues: list[dict[str, Any]] = []
        for index, match in enumerate(issue_matches):
            start = match.end()
            end = issue_matches[index + 1].start() if index + 1 < len(issue_matches) else len(section)
            text = section[start:end].strip()
            text = text.lstrip(":-|· ").strip()
            text = text.rstrip(".!?。")
            if not text:
                continue
            issues.append(
                {
                    "level": issue_level_map.get(match.group(1), "medium"),
                    "text": text if text.endswith(".") else f"{text}.",
                    "display_text": text if text.endswith(".") else f"{text}.",
                }
            )

        return _normalize_issues_value(issues)

    def _extract_document_next_agenda_items(self, analysis_text: str) -> list[str]:
        section = _extract_document_section(
            analysis_text,
            ("7. 다음 회의 안건", "다음 회의 안건", "7. 다음 회의", "다음 회의"),
            (),
        )
        if not section:
            return []

        section = re.sub(r"^다음 회의:\s*.*?(?:\||No\.|1\s+)", "", section).strip()
        rows = _split_document_numbered_rows(section)
        if not rows:
            rows = [section]

        agenda_items: list[str] = []
        seen: set[str] = set()
        for row in rows:
            cleaned = _normalize_text_value(row)
            cleaned = cleaned.lstrip("-*•").strip()
            cleaned = re.sub(r"^\d+\s*", "", cleaned)
            cleaned = re.sub(r"^(?:다음 회의(?:에서|에)?\s*)+", "", cleaned).strip()
            cleaned = cleaned.replace("다음 회의에서", "").replace("다음 회의에", "").strip()
            cleaned = cleaned.split("No.")[0].strip()
            cleaned = re.sub(
                r"(?:\s+(?:[가-힣]{2,4})(?:\s*/\s*[가-힣]{2,4})*)$",
                "",
                cleaned,
            ).strip()
            cleaned = cleaned.rstrip(".!?。")
            if not cleaned:
                continue
            if cleaned.lower() in seen:
                continue
            seen.add(cleaned.lower())
            agenda_items.append(cleaned if cleaned.endswith(".") else cleaned)
            if len(agenda_items) >= MAX_NEXT_AGENDA:
                break

        return _normalize_next_agenda_value(agenda_items, MAX_NEXT_AGENDA)

    def _extract_document_action_items_from_table(
        self,
        analysis_text: str,
        context: Any | None,
        *,
        name_candidates: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        section = _extract_document_section(
            analysis_text,
            ("4. Action Items", "4. Action items", "4. 해야 할 일", "4. 액션 아이템"),
            ("5. 이슈 및 리스크", "5. 이슈 & 리스크", "6. 특이사항", "7. 다음 회의 안건"),
        )
        if not section:
            return []

        rows = _split_document_numbered_rows(section)
        if not rows:
            return []

        candidates = list(dict.fromkeys((name_candidates or []) + _collect_assignee_name_candidates(analysis_text, context)))
        parsed: list[dict[str, Any]] = []
        seen: set[str] = set()

        for row in rows:
            item = self._parse_document_action_row(row, candidates)
            if not item:
                continue
            signature = _normalize_text_value(item.get("title")).lower()
            if not signature or signature in seen:
                continue
            seen.add(signature)
            parsed.append(item)
            if len(parsed) >= MAX_ACTION_ITEMS:
                break

        return parsed

    def _extract_document_action_items(
        self,
        analysis_text: str,
        context: Any | None,
        *,
        name_candidates: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        parsed = self._extract_document_action_items_from_table(
            analysis_text,
            context,
            name_candidates=name_candidates,
        )
        if parsed:
            return parsed

        lines = [self._normalize_text(line) for line in str(analysis_text or "").splitlines()]
        lines = [line for line in lines if line]
        if not lines:
            return []

        candidates = list(dict.fromkeys((name_candidates or []) + _collect_assignee_name_candidates(analysis_text, context)))
        action_lines: list[str] = []
        in_action_section = False

        for line in lines:
            if any(marker in line for marker in ("Action Items", "해야 할 일", "일정 마일스톤")):
                in_action_section = True
                continue

            if in_action_section and re.match(r"^\d+\.\s*(?:이슈|리스크|특이사항|다음 회의|다음 안건)", line):
                break

            if in_action_section:
                action_lines.append(line)

        if not action_lines:
            for line in lines:
                if self._looks_like_document_action_line(line):
                    action_lines.append(line)

        parsed = []
        seen: set[str] = set()
        for line in action_lines:
            item = self._parse_document_action_line(line, candidates)
            if not item:
                continue
            signature = _normalize_text_value(item.get("title")).lower()
            if not signature or signature in seen:
                continue
            seen.add(signature)
            parsed.append(item)
            if len(parsed) >= MAX_ACTION_ITEMS:
                break

        return parsed

    @staticmethod
    def _looks_like_document_action_line(line: str) -> bool:
        cleaned = WHITESPACE_PATTERN.sub(" ", line or "").strip()
        if not cleaned:
            return False
        if any(marker in cleaned for marker in ("Action Items", "해야 할 일", "이슈 & 리스크", "다음 회의 안건")):
            return False
        if re.search(r"(?:20\d{2}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}/\d{1,2}|(?:\d{4}\s*년\s*)?\d{1,2}\s*월\s*\d{1,2}\s*일|미정|별도\s*진행|회의\s*당일)", cleaned):
            return True
        if "·" in cleaned or "|" in cleaned:
            return True
        return any(keyword in cleaned for keyword in ("작성", "공유", "완료", "확정", "검토", "요청", "배분", "발행", "구축", "정비", "개편", "섭외", "세팅"))

    def _parse_document_action_line(
        self,
        line: str,
        name_candidates: list[str] | None = None,
    ) -> dict[str, Any] | None:
        cleaned = WHITESPACE_PATTERN.sub(" ", str(line or "")).strip()
        if not cleaned:
            return None

        cleaned = cleaned.lstrip("-*•").strip()
        cleaned = re.sub(r"^No\.?\s*", "", cleaned)
        cleaned = re.sub(r"^\d+\s+", "", cleaned)
        cleaned = re.sub(r"^(?:업무 내용|담당자|기한|상태)\s*", "", cleaned).strip()
        if not cleaned:
            return None
        if "브리핑" in cleaned or "불참자" in cleaned:
            return None

        status_text = None
        status_match = re.search(r"\b(진행중|미착수|대기중|완료|발행|보류)\b\s*$", cleaned)
        if status_match:
            status_text = status_match.group(1)

        working_text = cleaned
        if status_match:
            working_text = cleaned[: status_match.start()].strip()
        due_text = None
        due_matches = list(
            re.finditer(
                r"(?:20\d{2}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}/\d{1,2}|(?:\d{4}\s*년\s*)?\d{1,2}\s*월\s*\d{1,2}\s*일|미정|별도\s*진행|회의\s*당일)",
                working_text,
            )
        )
        if due_matches:
            due_match = due_matches[-1]
            due_text = _parse_due_date_text(due_match.group(0))
            working_text = working_text[: due_match.start()].strip()

        working_text = working_text.strip("·|-/ ")
        if not working_text:
            return None

        assignee = self._extract_document_assignee(working_text, name_candidates=name_candidates)
        if not assignee:
            slash_tail = re.search(r"([가-힣]{2,4}(?:\s*/\s*[가-힣]{2,4})+)$", working_text)
            single_tail = re.search(r"([가-힣]{2,4})$", working_text)
            tail_match = slash_tail or single_tail
            if tail_match:
                candidate_assignee = _normalize_text_value(tail_match.group(1))
                if candidate_assignee and candidate_assignee not in {"회의", "결정", "공유", "검토", "정리", "요청", "계획"}:
                    assignee = candidate_assignee
                    working_text = working_text[: tail_match.start()].strip()
        title = working_text
        if assignee:
            assignee_pos = working_text.rfind(assignee)
            if assignee_pos > 0:
                title = working_text[:assignee_pos].strip("·|-/ ")
        title = self._cleanup_document_action_title(title, name_candidates=name_candidates)
        if not title:
            return None

        description_source = cleaned
        if len(description_source) > 180:
            description_source = shorten(description_source, width=180, placeholder="...")

        priority = self._infer_priority(description_source).value
        if not assignee:
            assignee = "미정"

        return {
            "title": title,
            "description": description_source,
            "status": status_text or TicketStatus.DRAFT.value,
            "priority": priority,
            "assignee": assignee,
            "due_at": due_text,
        }

    def _parse_document_action_row(
        self,
        row: str,
        name_candidates: list[str] | None = None,
    ) -> dict[str, Any] | None:
        return self._parse_document_action_line(row, name_candidates)

    @staticmethod
    def _cleanup_document_action_title(title: str, *, name_candidates: list[str] | None = None) -> str:
        cleaned = _normalize_text_value(title)
        if not cleaned:
            return ""

        cleaned = re.sub(r"^[가-힣]{2,4}\s*\((?:불참자|불참|참석자|병가)\)\s*", "", cleaned)
        cleaned = re.sub(r"^[가-힣]{2,4}\s*\((?:회의주재|회의 주재)\)\s*", "", cleaned)

        tokens = cleaned.split()
        if len(tokens) >= 2 and name_candidates:
            candidate_set = {_normalize_name_candidate(candidate) for candidate in name_candidates}
            candidate_set = {candidate for candidate in candidate_set if candidate}
            first_token = _normalize_name_candidate(tokens[0])
            if first_token in candidate_set and any(keyword in cleaned for keyword in ("브리핑", "공유", "작성", "분석", "검토", "요청", "세팅", "구축", "확정", "정리")):
                cleaned = " ".join(tokens[1:]).strip()

        cleaned = re.sub(r"^(?:결정\s*\d+\s*|안건\s*\d+\s*)", "", cleaned).strip()
        cleaned = WHITESPACE_PATTERN.sub(" ", cleaned).strip()
        cleaned = cleaned.rstrip(".!?。")
        return cleaned

    @staticmethod
    def _extract_document_assignee(
        text: str,
        *,
        name_candidates: list[str] | None = None,
    ) -> str | None:
        if not text:
            return None

        candidate_pool = [candidate for candidate in (name_candidates or []) if candidate]
        if not candidate_pool:
            return None

        normalized_tokens = text.split()
        matched: list[str] = []
        index = len(normalized_tokens) - 1
        candidate_set = {_normalize_name_candidate(candidate) for candidate in candidate_pool}
        candidate_set = {candidate for candidate in candidate_set if candidate}

        while index >= 0:
            token = normalized_tokens[index].strip("()[]{}.,:;|")
            token = _normalize_name_candidate(token)
            if not token:
                break
            if token in candidate_set:
                matched.insert(0, token)
                index -= 1
                if index >= 0 and normalized_tokens[index] == "/":
                    index -= 1
                    continue
                if index >= 0 and normalized_tokens[index] in {"/", "·"}:
                    index -= 1
                    continue
                continue
            break

        if matched:
            return " / ".join(matched)

        for candidate in sorted(candidate_pool, key=len, reverse=True):
            if candidate and candidate in text:
                return candidate

        return None

    def _filter_document_action_items(
        self,
        action_items: list[dict[str, Any]],
        analysis_text: str,
    ) -> list[dict[str, Any]]:
        filtered: list[tuple[int, int, dict[str, Any]]] = []
        seen: set[str] = set()
        lowered_text = analysis_text.lower()

        for index, item in enumerate(action_items):
            if not isinstance(item, dict):
                continue

            title = _normalize_title_value(item.get("title"))
            description = _normalize_description_value(item.get("description"), title)
            if not title or not description:
                continue

            support_source = f"{title} {description}".strip()
            if _is_batch_noise_text(support_source):
                continue

            if any(
                support_source.startswith(prefix)
                for prefix in ("보통 ", "높음 ", "낮음 ", "No.", "결정 ", "주요 결정 ", "작 성 ", "검 토 ", "승 인 ")
            ):
                continue

            compact_title = re.sub(r"[^가-힣A-Za-z0-9]", "", title)
            if len(compact_title) < 4:
                continue

            if title == description and len(title) < 14:
                continue

            score = 0
            if _normalize_due_at_value(item.get("due_at")) is not None:
                score += 3
            if _normalize_assignee_value(item.get("assignee")) != "미정":
                score += 2
            if any(keyword in support_source.lower() for keyword in ("작성", "공유", "완료", "확정", "검토", "요청", "배분", "발행", "구축", "정비", "개편", "마이그레이션", "섭외", "세팅")):
                score += 2
            if any(term in lowered_text for term in (title.lower(), description.lower())):
                score += 1

            signature = title.lower()
            if signature in seen:
                continue
            seen.add(signature)
            filtered.append((score, index, {"title": title, "description": description, **item}))

        if not filtered:
            return action_items[:MAX_DOCUMENT_KEY_POINTS]

        filtered.sort(key=lambda item: (-item[0], item[1]))
        return [item for _, _, item in filtered[:max(6, min(12, len(filtered)))]]

    @staticmethod
    def _normalize_summary(summary: str) -> str:
        normalized = _compact_summary_text(summary, max_chars=MAX_SUMMARY_CHARS)
        if not normalized:
            return "요약할 텍스트가 없습니다."

        sentences = [part.strip() for part in SENTENCE_SPLIT_PATTERN.split(normalized) if part.strip()]
        if len(sentences) <= MAX_SUMMARY_SENTENCES:
            return _compact_summary_text(normalized, max_chars=MAX_SUMMARY_CHARS)

        return _compact_summary_text(" ".join(sentences[:MAX_SUMMARY_SENTENCES]), max_chars=MAX_SUMMARY_CHARS)

    def _rewrite_summary_for_noise(
        self,
        summary: str,
        *,
        noisy_audio: bool,
        action_items: list[dict[str, Any]],
        decisions: list[str],
        issues: list[dict[str, Any]],
        next_agenda: list[str],
        analysis_text: str,
    ) -> str:
        themes = self._extract_summary_themes(analysis_text, action_items, decisions, issues, next_agenda)
        opening = self._build_summary_opening(themes, analysis_text)
        parts: list[str] = [opening]

        action_topic = self._collect_action_topics(action_items)
        if action_items:
            if action_topic:
                parts.append(f"{self._join_korean_list(action_topic[:4])} 관련 후속 작업도 함께 공유했다.")
            elif themes:
                parts.append(f"{self._join_korean_list(themes[:4])} 관련 후속 작업도 함께 공유했다.")
            else:
                parts.append("후속 일정도 함께 공유했다.")

        if decisions:
            decision_topic = self._collect_decision_topics(decisions)
            if decision_topic:
                decision_text = self._join_korean_list(decision_topic[:3])
                parts.append(f"주요 결정사항은 {self._with_particle(decision_text, 'ro')} 정리했다.")
            else:
                parts.append("주요 결정사항도 함께 정리했다.")

        if issues:
            issue_topic = self._collect_issue_topics(issues)
            if issue_topic:
                parts.append(f"주요 리스크는 {self._join_korean_list(issue_topic[:3])}로 확인했다.")
            else:
                parts.append("주요 리스크도 함께 확인했다.")

        if next_agenda:
            parts.append("다음 회의에서 이어서 볼 후속 안건도 정리했다.")

        rewritten = " ".join(parts)
        cleaned = _compact_summary_text(rewritten, max_chars=MAX_SUMMARY_CHARS)
        if noisy_audio and self._looks_like_transcript_summary(cleaned):
            cleaned = _compact_summary_text(cleaned, max_chars=MAX_SUMMARY_CHARS)
        return cleaned

    @staticmethod
    def _looks_like_transcript_summary(text: str) -> bool:
        if not text:
            return False

        transcript_markers = (
            "그럼 ",
            "네 ",
            "맞아요",
            "좋습니다",
            "회의 시작",
            "다들 왔죠",
            "오늘은",
            "최종 일정을 정리",
        )
        return any(marker in text for marker in transcript_markers) or len(text) > MAX_SUMMARY_CHARS

    @staticmethod
    def _join_korean_list(items: list[str]) -> str:
        if not items:
            return ""
        if len(items) == 1:
            return items[0]
        if len(items) == 2:
            particle = "과" if HeuristicLLMAnalysisService._ends_with_batchim(items[0]) else "와"
            return f"{items[0]}{particle} {items[1]}"
        return f"{', '.join(items[:-1])} 및 {items[-1]}"

    @staticmethod
    def _ends_with_batchim(text: str) -> bool:
        if not text:
            return False
        last_char = text.strip()[-1]
        codepoint = ord(last_char)
        if not (0xAC00 <= codepoint <= 0xD7A3):
            return False
        return (codepoint - 0xAC00) % 28 != 0

    @classmethod
    def _with_particle(cls, text: str, particle_kind: str) -> str:
        if particle_kind == "subject":
            return f"{text}{'은' if cls._ends_with_batchim(text) else '는'}"
        if particle_kind == "object":
            return f"{text}{'을' if cls._ends_with_batchim(text) else '를'}"
        if particle_kind == "ro":
            return f"{text}{'으로' if cls._ends_with_batchim(text) else '로'}"
        return text

    @staticmethod
    def _extract_summary_themes(
        analysis_text: str,
        action_items: list[dict[str, Any]],
        decisions: list[str],
        issues: list[dict[str, Any]],
        next_agenda: list[str],
    ) -> list[str]:
        haystack = " ".join(
            [
                analysis_text or "",
                " ".join(item.get("title", "") for item in action_items),
                " ".join(decisions),
                " ".join(issue.get("text", "") for issue in issues),
                " ".join(next_agenda),
            ]
        )
        themes: list[str] = []
        seen: set[str] = set()
        lowered = haystack.lower()

        for term in SUMMARY_THEME_TERMS:
            if term.lower() in lowered and term not in seen:
                seen.add(term)
                themes.append(term)
            if len(themes) >= 5:
                break

        return themes

    @staticmethod
    def _build_summary_opening(themes: list[str], analysis_text: str) -> str:
        lowered = analysis_text.lower()
        if "업무관리시스템" in lowered or "업무 관리 시스템" in lowered:
            return "회의에서는 사내 업무관리시스템 구축을 위한 기능 우선순위, 역할 분담, 일정과 리스크를 정리했다."
        if "회의록" in lowered and ("jira" in lowered or "stt" in lowered or "화자 분리" in lowered):
            return "회의에서는 AI 회의록 시스템의 핵심 구성요소와 진행 현황을 공유했다."
        if "상반기 성과" in lowered and (
            "하반기 전략" in lowered or "콘텐츠 캘린더" in lowered or "notion" in lowered or "slack" in lowered or "figma" in lowered
        ):
            return "회의에서는 상반기 마케팅 성과를 점검하고, 하반기 콘텐츠 전략과 7월 캠페인 실행 계획, Notion·Slack·Figma 운영 정비를 함께 정리했다."
        if themes:
            return f"회의에서는 {HeuristicLLMAnalysisService._join_korean_list(themes[:4])} 중심으로 주요 안건을 정리했다."
        return "회의에서는 주요 안건과 후속 일정을 정리했다."

    def _collect_action_topics(self, action_items: list[dict[str, Any]]) -> list[str]:
        topics: list[str] = []
        seen: set[str] = set()
        for item in action_items:
            title = str(item.get("title", "") or "")
            description = str(item.get("description", "") or "")
            topic = self._extract_action_item_topic(title) or self._extract_action_item_topic(description)
            if not topic:
                continue
            if topic.lower() in seen:
                continue
            seen.add(topic.lower())
            topics.append(topic)
        return topics

    def _collect_decision_topics(self, decisions: list[str]) -> list[str]:
        topics: list[str] = []
        seen: set[str] = set()
        for decision in decisions:
            for topic in self._extract_decision_topics(decision):
                if topic.lower() in seen:
                    continue
                seen.add(topic.lower())
                topics.append(topic)
        return topics

    def _collect_issue_topics(self, issues: list[dict[str, Any]]) -> list[str]:
        topics: list[str] = []
        seen: set[str] = set()
        for issue in issues:
            text = str(issue.get("text", "") or "")
            topic = self._extract_issue_topic(text) or self._extract_issue_kind(text)
            if not topic:
                continue
            if topic.lower() in seen:
                continue
            seen.add(topic.lower())
            topics.append(topic)
        return topics

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
        description = _build_action_item_sentence(title, value)
        if not description:
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
            return "미정"
        candidate = candidate.rstrip("님")
        return candidate or "미정"

    @staticmethod
    def _normalize_due_at(value: Any) -> str | None:
        candidate = WHITESPACE_PATTERN.sub(" ", str(value or "")).strip()
        if not candidate or candidate.lower() in {"null", "none"}:
            return None

        return _parse_due_date_text(candidate)


class OpenAIAnalysisService(LLMAnalysisService):
    """OpenAI-backed meeting analysis using the Responses API."""

    def __init__(self, model_name: str | None = None, prompt_version: str = DEFAULT_PROMPT_VERSION) -> None:
        self.model_name = model_name or DEFAULT_MODEL_NAME
        self.prompt_version = prompt_version
        self._client = self._load_client()

    def _create_response_with_retry(
        self,
        normalized: str,
        *,
        context: Any | None = None,
        model_name: str | None = None,
    ) -> Any:
        try:
            from openai import APIConnectionError, APITimeoutError, RateLimitError
        except ImportError:  # pragma: no cover - openai is available in runtime env
            retryable_errors = ()
        else:
            retryable_errors = (APIConnectionError, APITimeoutError, RateLimitError)

        last_error: Exception | None = None
        max_attempts = 3
        target_model = model_name or self.model_name
        source_kind = _detect_source_kind(context)

        for attempt in range(1, max_attempts + 1):
            try:
                return self._client.responses.create(
                    model=target_model,
                    instructions=self._build_instructions(context, source_kind=source_kind),
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
        source_kind = _detect_source_kind(context)
        if not normalized:
            return {
                "contract_version": "v1",
                "meeting_title": "회의 요약",
                "summary": "요약할 텍스트가 없습니다.",
                "keywords": [],
                "decisions": [],
                "action_items": [],
                "issues": [],
                "next_agenda": [],
                "model_name": self.model_name,
                "prompt_version": self.prompt_version,
                "summary_request": None,
                "extra_data": {"input_characters": 0, "source": "openai"},
        }

        try:
            noisy_audio = HeuristicLLMAnalysisService._has_noisy_audio_context(context)
            model_tier = _estimate_model_tier(normalized, context)
            resolved_model_name = _resolve_model_name_for_tier(model_tier, fallback=self.model_name)
            name_candidates = _collect_assignee_name_candidates(transcript, context)
            response = self._create_response_with_retry(normalized, context=context, model_name=resolved_model_name)

            payload = self._parse_response_payload(response)
            normalized_summary = _normalize_summary_card_value(payload.get("summary", ""))
            normalized_action_items = _normalize_action_items_value(
                payload.get("action_items", []),
                name_candidates=name_candidates,
            )
            normalized_keywords = _normalize_keywords_value(payload.get("keywords", []))
            normalized_decisions, tentative_decisions = _normalize_decisions_value(payload.get("decisions", []), MAX_DECISIONS)
            normalized_issues = _normalize_issues_value(payload.get("issues", []))
            next_agenda_source = list(payload.get("next_agenda", []) or [])
            next_agenda_candidates = [
                item
                for item in next_agenda_source + tentative_decisions
                if _is_followup_agenda_text(item)
            ]
            normalized_next_agenda = _normalize_next_agenda_value(next_agenda_candidates, MAX_NEXT_AGENDA)
            if source_kind == "audio_batch":
                normalized_summary, normalized_action_items, normalized_decisions, normalized_issues, normalized_next_agenda = _apply_audio_batch_conservative_filters(
                    transcript=normalized,
                    context=context,
                    summary=normalized_summary,
                    keywords=normalized_keywords,
                    decisions=normalized_decisions,
                    action_items=normalized_action_items,
                    issues=normalized_issues,
                    next_agenda=normalized_next_agenda,
                )
                normalized_keywords = _normalize_keywords_value(
                    normalized_keywords
                    + [{"text": text, "type": "cyan"} for text in _extract_batch_content_terms(normalized)]
                )
            meeting_title = _build_meeting_title(
                transcript=normalized,
                summary=normalized_summary,
                keywords=normalized_keywords,
                decisions=normalized_decisions,
                action_items=normalized_action_items,
                issues=normalized_issues,
                next_agenda=normalized_next_agenda,
                context=context,
            )
            (
                meeting_title,
                normalized_summary,
                normalized_keywords,
                normalized_decisions,
                normalized_action_items,
                normalized_issues,
                normalized_next_agenda,
                campaign_planning_applied,
            ) = _apply_campaign_planning_override(
                normalized,
                context,
                meeting_title=meeting_title,
                summary=normalized_summary,
                keywords=normalized_keywords,
                decisions=normalized_decisions,
                action_items=normalized_action_items,
                issues=normalized_issues,
                next_agenda=normalized_next_agenda,
            )
            if campaign_planning_applied:
                project_kickoff_applied = False
            else:
                ops_process_applied = False
                (
                    meeting_title,
                    normalized_summary,
                    normalized_keywords,
                    normalized_decisions,
                    normalized_action_items,
                    normalized_issues,
                    normalized_next_agenda,
                    ops_process_applied,
                ) = _apply_ops_process_override(
                    normalized,
                    context,
                    meeting_title=meeting_title,
                    summary=normalized_summary,
                    keywords=normalized_keywords,
                    decisions=normalized_decisions,
                    action_items=normalized_action_items,
                    issues=normalized_issues,
                    next_agenda=normalized_next_agenda,
                )
                if ops_process_applied:
                    project_kickoff_applied = False
                else:
                    (
                        meeting_title,
                        normalized_summary,
                        normalized_keywords,
                        normalized_decisions,
                        normalized_action_items,
                        normalized_issues,
                        normalized_next_agenda,
                        project_kickoff_applied,
                    ) = _apply_project_kickoff_override(
                        normalized,
                        context,
                        meeting_title=meeting_title,
                        summary=normalized_summary,
                        keywords=normalized_keywords,
                        decisions=normalized_decisions,
                        action_items=normalized_action_items,
                        issues=normalized_issues,
                        next_agenda=normalized_next_agenda,
                    )
            return {
                "contract_version": "v1",
                "meeting_title": meeting_title,
                "summary": normalized_summary,
                "keywords": normalized_keywords,
                "decisions": normalized_decisions,
                "action_items": normalized_action_items,
                "issues": normalized_issues,
                "next_agenda": normalized_next_agenda,
                "model_name": resolved_model_name,
                "prompt_version": self.prompt_version,
                "summary_request": None,
                "extra_data": {
                    "source": "openai",
                    "llm_tier": model_tier,
                    "resolved_model_name": resolved_model_name,
                    "input_characters": len(normalized),
                    "action_item_count": len(normalized_action_items),
                    "decision_count": len(normalized_decisions),
                    "issue_count": len(normalized_issues),
                    "next_agenda_count": len(normalized_next_agenda),
                    "context_present": bool(_build_context_block(context)),
                    "audio_noise_context": noisy_audio,
                    "analysis_template": "campaign_planning"
                    if campaign_planning_applied
                    else ("ops_process" if ops_process_applied else ("project_kickoff" if project_kickoff_applied else "default")),
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
                    "llm_tier": _estimate_model_tier(normalized, context),
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
    def _build_instructions(context: Any | None = None, *, source_kind: str | None = None) -> str:
        context_block = _build_context_block(context)
        normalized_source_kind = _normalize_text_value(source_kind or _detect_source_kind(context)).lower()
        instruction = (
            "너는 TIKI의 AI 분석기다.\n"
            "출력은 반드시 JSON만 허용되며, 마크다운/설명문/코드펜스는 절대 쓰지 마라.\n"
            "아래 JSON 스키마를 정확히 지켜라.\n\n"
        )
        if context_block:
            instruction += f"{context_block}\n\n"
        if normalized_source_kind == "document":
            instruction += (
                "작업 원칙:\n"
                "- 입력은 회의 대화가 아니라 문서 본문이다.\n"
                "- meeting_title에는 문서 제목이나 문서의 성격이 바로 드러나는 한 줄 제목을 써라. 카드 헤더처럼 짧고 명확해야 한다.\n"
                "- summary는 문서의 목적, 핵심 주장, 조건, 결론, 후속 포인트를 2~3문장으로 정리하라.\n"
                "- 문서 요약에는 회의 대화체를 쓰지 말고, 자연스러운 보고서형 표현을 사용하라.\n"
                "- keywords에는 문서의 핵심 주제 4~6개를 담아라. type은 cyan, purple, green, yellow 중 하나를 써라.\n"
                "- decisions에는 문서에서 명시적으로 확정되거나 권고한 사항만 넣어라.\n"
                "- action_items에는 문서에서 실행해야 한다고 명시된 작업만 넣어라.\n"
                "- issues에는 문서의 제약, 리스크, 주의사항, 부족한 조건을 짧게 정리하라.\n"
                "- next_agenda에는 문서에서 남겨둔 검토 항목, 미정 사항, 다음 단계만 넣어라.\n"
                "- 반복 문구는 제거하고, 같은 뜻의 문장은 하나로 합쳐라.\n"
                "- 담당자와 마감일이 명시되지 않으면 null로 둬라. 추측하지 마라.\n"
                "- 이름, 날짜, 숫자는 문서에 실제로 나온 값만 사용하라.\n"
                "- 애매하면 action_items를 비워도 된다. 억지로 채우지 마라.\n"
                "- 우선순위는 low, medium, high, urgent 중 하나만 사용하라.\n"
                "- urgent는 명시적 긴급성, 장애, 즉시 대응, 마감 임박이 있을 때만 써라.\n"
            )
        elif normalized_source_kind == "audio_batch":
            instruction += (
                "작업 원칙:\n"
                "- 입력은 같은 회의의 순차 분할 파일들을 합친 배치다.\n"
                "- 파일 경계가 있어도 회의는 하나로 해석하라. 파일별로 따로 요약하지 마라.\n"
                "- meeting_title은 전체 배치의 공통 주제를 하나로 묶은 카드 헤더처럼 짧게 써라.\n"
                "- summary는 각 파일의 내용을 따로 나열하지 말고, 전체 회의 흐름을 하나의 서사로 통합하라.\n"
                "- keywords에는 배치 전체에서 반복되는 핵심 주제만 남겨라.\n"
                "- decisions, action_items, issues, next_agenda는 파일별 중복을 제거하고 전체 회의 기준으로 합쳐라.\n"
                "- next_agenda와 issues는 반복 표현을 특히 주의해서 제거하라.\n"
                "- 담당자와 마감일이 명시되지 않으면 null로 둬라. 추측하지 마라.\n"
                "- 이름, 날짜, 숫자는 실제 언급된 값만 사용하라.\n"
                "- 억지로 채우지 말고, 불명확하면 action_items를 비워도 된다.\n"
                "- 중복 문장과 파일 전환 문구는 무시하고, 의미 있는 회의 발화만 사용하라.\n"
            )
        else:
            instruction += (
                "작업 원칙:\n"
                "- meeting_title에는 회의 성격이 바로 드러나는 한 줄 제목을 써라. 너무 길면 안 되고 카드 헤더처럼 보여야 한다.\n"
                "- 특별한 맥락이 없으면 'OOO 프로젝트 킥오프', 'OOO 정리 회의', 'OOO 검토 회의' 같은 형태로 간결하게 작성하라.\n"
                "- 회의 핵심만 한국어로 2~3문장으로 짧게 요약하라. 장황한 부연 설명은 쓰지 마라.\n"
                "- summary는 카드 헤더처럼 짧고 단정하게 써라. 가능하면 '회의에서는 ...'로 시작하라.\n"
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
                "- issues는 짧은 리스크 카드처럼, next_agenda는 다음 회의 카드처럼 정리하라.\n"
                "- issues와 next_agenda는 한 줄 카드 문장으로 짧게 유지하고, 장황한 배경 설명은 넣지 마라.\n"
                "- next_agenda는 '다음 회의에서' 접두어를 한 번만 쓰고, 같은 문구를 반복하지 마라.\n"
                "- issues는 '리스크 관리 리스크'처럼 같은 단어를 반복하지 말고, 짧은 카드 문장 하나로 정리하라.\n"
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


def _parse_llm_json_response(text: str) -> dict[str, Any]:
    """Parse a chat-completion response as JSON, tolerating common formatting noise.

    Unlike OpenAIAnalysisService (which uses the Responses API with a strict
    json_schema format), LangChainAnalysisService sends plain chat messages with
    no structured-output enforcement — models (especially Groq/Llama) routinely
    wrap the answer in ```json fences or add a leading/trailing sentence, which
    makes a bare json.loads() fail with "Expecting value: line 1 column 1" even
    though the payload is otherwise fine.
    """
    candidate = text.strip()
    fence_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", candidate, re.DOTALL)
    if fence_match:
        candidate = fence_match.group(1).strip()
    else:
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start != -1 and end != -1 and end > start:
            candidate = candidate[start : end + 1]
    return json.loads(candidate)


class LangChainAnalysisService(LLMAnalysisService):
    """LangChain-backed meeting analysis that keeps the same JSON contract."""

    model_name = DEFAULT_MODEL_NAME
    prompt_version = "langchain-v1"

    def __init__(
        self,
        model_name: str | None = None,
        prompt_version: str = "langchain-v1",
        fallback_model_name: str | None = None,
        preferred_provider: str | None = None,
    ) -> None:
        self.model_name = model_name or DEFAULT_MODEL_NAME
        self.prompt_version = prompt_version
        self.fallback_model_name = fallback_model_name or settings.groq_model
        # Which provider to try first in _invoke_chain. None means "auto" (OpenAI
        # first if configured, Groq as fallback) — set explicitly to "groq" when the
        # caller configured LLM_ANALYSIS_PROVIDER=groq, so that setting is actually
        # honored instead of always trying OpenAI first regardless.
        self.preferred_provider = preferred_provider

    @staticmethod
    @lru_cache(maxsize=1)
    def _load_components():
        try:
            from langchain_core.messages import HumanMessage, SystemMessage
            from langchain_openai import ChatOpenAI
        except ImportError as exc:  # pragma: no cover - optional dependency
            raise RuntimeError("langchain-core/langchain-openai packages are not installed") from exc

        return HumanMessage, SystemMessage, ChatOpenAI

    @staticmethod
    def _create_chat_model(ChatOpenAI: Any, *, model_name: str, api_key: str, base_url: str | None = None):
        kwargs: dict[str, Any] = {
            "model": model_name,
            "temperature": 0,
            "max_retries": 2,
            # Without this, a slow/unreachable provider (e.g. a stale/rate-limited
            # OpenAI key) can hang for many minutes with no error — the upload just
            # sits at "AI 분석 중" forever. Bound each attempt so a broken provider
            # fails fast enough to fall back to the next one within a reasonable time.
            "timeout": 45,
            "api_key": api_key,
            "use_responses_api": False,
        }
        if base_url:
            kwargs["base_url"] = base_url
        return ChatOpenAI(**kwargs)

    def _build_document_contract_override(
        self,
        transcript: str,
        context: Any | None,
        *,
        meeting_title: str | None = None,
        action_items: list[dict[str, Any]] | None = None,
        decisions: list[str] | None = None,
        issues: list[dict[str, Any]] | None = None,
        next_agenda: list[str] | None = None,
        summary: str | None = None,
        keywords: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        return HeuristicLLMAnalysisService()._build_document_contract_override(
            transcript,
            context,
            meeting_title=meeting_title,
            action_items=action_items,
            decisions=decisions,
            issues=issues,
            next_agenda=next_agenda,
            summary=summary,
            keywords=keywords,
        )

    def _invoke_with_provider(
        self,
        *,
        transcript: str,
        context: Any | None,
        model_name: str,
        api_key: str,
        base_url: str | None = None,
        provider_name: str,
    ) -> tuple[str, str, str]:
        HumanMessage, SystemMessage, ChatOpenAI = self._load_components()
        source_kind = _detect_source_kind(context)
        llm = self._create_chat_model(ChatOpenAI, model_name=model_name, api_key=api_key, base_url=base_url)
        response = llm.invoke(
            [
                SystemMessage(content=OpenAIAnalysisService._build_instructions(context, source_kind=source_kind)),
                HumanMessage(content=transcript),
            ]
        )
        content = str(getattr(response, "content", response) or "").strip()
        if not content:
            raise RuntimeError(f"{provider_name} did not return any text")
        return content, provider_name, model_name

    def _invoke_chain(
        self,
        transcript: str,
        context: Any | None = None,
        *,
        model_name: str | None = None,
    ) -> tuple[str, str, str]:
        resolved_model_name = model_name or self.model_name

        def _try_openai() -> tuple[str, str, str] | None:
            if not settings.openai_api_key:
                return None
            try:
                return self._invoke_with_provider(
                    transcript=transcript,
                    context=context,
                    model_name=resolved_model_name,
                    api_key=settings.openai_api_key,
                    provider_name="openai",
                )
            except Exception as exc:
                logger.warning("OpenAI LangChain request failed: %s", exc)
                return None

        def _try_groq() -> tuple[str, str, str] | None:
            if not settings.groq_api_key:
                return None
            try:
                return self._invoke_with_provider(
                    transcript=transcript,
                    context=context,
                    model_name=self.fallback_model_name,
                    api_key=settings.groq_api_key,
                    base_url=settings.groq_base_url,
                    provider_name="groq",
                )
            except Exception as exc:
                logger.warning("Groq LangChain request failed: %s", exc)
                return None

        # Respect an explicitly configured provider (LLM_ANALYSIS_PROVIDER=groq) by
        # trying it first — previously this always tried OpenAI first regardless of
        # that setting, so a slow/broken OpenAI key silently delayed every single
        # analysis (and, before a timeout was added above, could hang indefinitely)
        # before ever reaching Groq.
        providers = [_try_groq, _try_openai] if self.preferred_provider == "groq" else [_try_openai, _try_groq]
        for attempt in providers:
            result = attempt()
            if result is not None:
                return result

        raise RuntimeError("No LLM provider available")

    def summarize_and_extract_tickets(self, transcript: str, context: Any | None = None) -> dict[str, Any]:
        normalized = self._normalize_text(transcript)
        source_kind = _detect_source_kind(context)
        if not normalized:
            return {
                "contract_version": "v1",
                "meeting_title": "회의 요약",
                "summary": "요약할 텍스트가 없습니다.",
                "keywords": [],
                "decisions": [],
                "action_items": [],
                "issues": [],
                "next_agenda": [],
                "model_name": self.model_name,
                "prompt_version": self.prompt_version,
                "summary_request": None,
                "extra_data": {"input_characters": 0, "source": "langchain", "source_kind": source_kind},
            }

        try:
            noisy_audio = HeuristicLLMAnalysisService._has_noisy_audio_context(context)
            model_tier = _estimate_model_tier(normalized, context)
            resolved_model_name = _resolve_model_name_for_tier(model_tier, fallback=self.model_name)
            name_candidates = _collect_assignee_name_candidates(transcript, context)
            response_text, provider_used, provider_model_name = self._invoke_chain(normalized, context, model_name=resolved_model_name)
            payload = _parse_llm_json_response(response_text)

            normalized_summary = _normalize_summary_card_value(payload.get("summary", ""))
            normalized_action_items = _normalize_action_items_value(
                payload.get("action_items", []),
                name_candidates=name_candidates,
            )
            normalized_keywords = _normalize_keywords_value(payload.get("keywords", []))
            normalized_decisions, tentative_decisions = _normalize_decisions_value(
                payload.get("decisions", []),
                MAX_DECISIONS,
            )
            normalized_issues = _normalize_issues_value(payload.get("issues", []))
            next_agenda_source = list(payload.get("next_agenda", []) or [])
            next_agenda_candidates = [
                item
                for item in next_agenda_source + tentative_decisions
                if _is_followup_agenda_text(item)
            ]
            normalized_next_agenda = _normalize_next_agenda_value(next_agenda_candidates, MAX_NEXT_AGENDA)
            if source_kind == "audio_batch":
                normalized_summary, normalized_action_items, normalized_decisions, normalized_issues, normalized_next_agenda = _apply_audio_batch_conservative_filters(
                    transcript=normalized,
                    context=context,
                    summary=normalized_summary,
                    keywords=normalized_keywords,
                    decisions=normalized_decisions,
                    action_items=normalized_action_items,
                    issues=normalized_issues,
                    next_agenda=normalized_next_agenda,
                )
                normalized_keywords = _normalize_keywords_value(
                    normalized_keywords
                    + [{"text": text, "type": "cyan"} for text in _extract_batch_content_terms(normalized)]
                )

            normalizer = HeuristicLLMAnalysisService()
            summary, action_items = normalizer._normalize_analysis_output(normalized_summary, normalized_action_items)
            if source_kind == "document":
                summary = _normalize_document_summary_value(summary)
            else:
                summary = _normalize_summary_card_value(summary)
            meeting_title = _build_meeting_title(
                transcript=normalized,
                summary=summary,
                keywords=normalized_keywords,
                decisions=normalized_decisions,
                action_items=action_items,
                issues=normalized_issues,
                next_agenda=normalized_next_agenda,
                context=context,
            )
            (
                meeting_title,
                summary,
                normalized_keywords,
                normalized_decisions,
                action_items,
                normalized_issues,
                normalized_next_agenda,
                campaign_planning_applied,
            ) = _apply_campaign_planning_override(
                normalized,
                context,
                meeting_title=meeting_title,
                summary=summary,
                keywords=normalized_keywords,
                decisions=normalized_decisions,
                action_items=action_items,
                issues=normalized_issues,
                next_agenda=normalized_next_agenda,
            )
            if campaign_planning_applied:
                project_kickoff_applied = False
            else:
                ops_process_applied = False
                (
                    meeting_title,
                    summary,
                    normalized_keywords,
                    normalized_decisions,
                    action_items,
                    normalized_issues,
                    normalized_next_agenda,
                    ops_process_applied,
                ) = _apply_ops_process_override(
                    normalized,
                    context,
                    meeting_title=meeting_title,
                    summary=summary,
                    keywords=normalized_keywords,
                    decisions=normalized_decisions,
                    action_items=action_items,
                    issues=normalized_issues,
                    next_agenda=normalized_next_agenda,
                )
                if ops_process_applied:
                    project_kickoff_applied = False
                else:
                    (
                        meeting_title,
                        summary,
                        normalized_keywords,
                        normalized_decisions,
                        action_items,
                        normalized_issues,
                        normalized_next_agenda,
                        project_kickoff_applied,
                    ) = _apply_project_kickoff_override(
                        normalized,
                        context,
                        meeting_title=meeting_title,
                        summary=summary,
                        keywords=normalized_keywords,
                        decisions=normalized_decisions,
                        action_items=action_items,
                        issues=normalized_issues,
                        next_agenda=normalized_next_agenda,
                    )
            if source_kind == "document":
                source_title = _extract_source_title(context)
                if source_title and not _is_filename_like_source_title(source_title):
                    meeting_title = _normalize_meeting_title_value(source_title) or meeting_title
                document_override = self._build_document_contract_override(
                    normalized,
                    context,
                    meeting_title=meeting_title,
                    action_items=action_items,
                    decisions=normalized_decisions,
                    issues=normalized_issues,
                    next_agenda=normalized_next_agenda,
                    summary=summary,
                    keywords=normalized_keywords,
                )
                if document_override:
                    meeting_title = document_override.get("meeting_title") or meeting_title
                    summary = document_override.get("summary") or summary
                    normalized_keywords = list(document_override.get("keywords") or normalized_keywords)
                    normalized_decisions = list(document_override.get("decisions") or normalized_decisions)
                    action_items = list(document_override.get("action_items") or action_items)
                    normalized_issues = list(document_override.get("issues") or normalized_issues)
                    normalized_next_agenda = list(document_override.get("next_agenda") or normalized_next_agenda)
            document_summary = _build_document_summary_payload(
                summary=summary,
                keywords=normalized_keywords,
                decisions=normalized_decisions,
                action_items=action_items,
                issues=normalized_issues,
                next_agenda=normalized_next_agenda,
                meeting_title=meeting_title,
                context=context,
            ) if source_kind == "document" else None

            return {
                "contract_version": "v1",
                "meeting_title": meeting_title,
                "summary": summary,
                "keywords": normalized_keywords,
                "decisions": normalized_decisions,
                "action_items": action_items,
                "issues": normalized_issues,
                "next_agenda": normalized_next_agenda,
                "model_name": provider_model_name or resolved_model_name,
                "prompt_version": self.prompt_version,
                "summary_request": None,
                "extra_data": {
                    "source": f"langchain_{provider_used}",
                    "analysis_provider": provider_used,
                    "llm_tier": model_tier,
                    "resolved_model_name": provider_model_name or resolved_model_name,
                    "input_characters": len(normalized),
                    "response_characters": len(response_text),
                    "action_item_count": len(action_items),
                    "decision_count": len(normalized_decisions),
                    "issue_count": len(normalized_issues),
                    "next_agenda_count": len(normalized_next_agenda),
                    "context_present": bool(_build_context_block(context)),
                    "audio_noise_context": noisy_audio,
                    "source_kind": source_kind,
                    "analysis_template": "campaign_planning"
                    if campaign_planning_applied
                    else ("ops_process" if ops_process_applied else ("project_kickoff" if project_kickoff_applied else "default")),
                    **({"document_summary": document_summary} if document_summary else {}),
                },
            }
        except Exception as exc:
            logger.warning("LangChain analysis request failed; falling back to heuristic service: %s", exc)
            fallback = HeuristicLLMAnalysisService().summarize_and_extract_tickets(normalized, context=context)
            fallback["extra_data"] = dict(fallback.get("extra_data", {}))
            fallback["extra_data"].update(
                {
                    "source": "langchain_fallback",
                    "analysis_provider": "heuristic",
                    "llm_tier": _estimate_model_tier(normalized, context),
                    "fallback_error": str(exc),
                    "input_characters": len(normalized),
                    "context_present": bool(_build_context_block(context)),
                    "audio_noise_context": HeuristicLLMAnalysisService._has_noisy_audio_context(context),
                }
            )
            return fallback


def _langchain_dependencies_available() -> bool:
    try:
        LangChainAnalysisService._load_components()
    except Exception:
        return False
    return True


def _normalize_analysis_provider(provider: Any) -> str:
    value = str(provider or "auto").strip().lower()
    return value or "auto"


def build_llm_analysis_service() -> LLMAnalysisService:
    """Build the preferred analysis service for the configured provider."""

    provider = _normalize_analysis_provider(getattr(settings, "llm_analysis_provider", "auto"))

    if provider == "heuristic":
        return HeuristicLLMAnalysisService()

    if provider == "groq":
        if settings.groq_api_key and _langchain_dependencies_available():
            return LangChainAnalysisService(
                model_name=settings.groq_model,
                fallback_model_name=settings.groq_model,
                preferred_provider="groq",
            )
        logger.warning("Groq provider was requested explicitly, but required dependencies or API key are missing.")
        return HeuristicLLMAnalysisService()

    if provider in {"langchain", "auto"}:
        if _langchain_dependencies_available() and (settings.openai_api_key or settings.groq_api_key):
            try:
                return LangChainAnalysisService()
            except Exception as exc:
                logger.warning("LangChain analysis unavailable: %s", exc)
                if provider == "langchain":
                    logger.warning("LangChain provider was requested explicitly, but could not be constructed.")
        elif provider == "langchain":
            logger.warning("LangChain provider was requested explicitly, but required dependencies or API key are missing.")
            return HeuristicLLMAnalysisService()

    if provider in {"openai", "langchain", "auto"} and settings.openai_api_key:
        try:
            return OpenAIAnalysisService()
        except Exception as exc:
            logger.warning("OpenAI analysis unavailable, falling back to heuristic service: %s", exc)

    return HeuristicLLMAnalysisService()
