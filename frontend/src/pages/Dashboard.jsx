import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { clearAuthSession } from "../api/apiClient";
import Header from "../components/Header";
import Footer from "../components/Footer";
import MobileTab from "../components/MobileTab";
import ToastPopup from "../components/toastpopup";

// 가상의 팀원 목록 (스타트업 '네오테크' 시나리오 반영)
const TEAM_MEMBERS = [
  { name: "정아름", role: "프론트엔드 리드", avatar: "user" },
  { name: "김민수", role: "백엔드 리드", avatar: "user" },
  { name: "송지영", role: "PM & 아키텍트", avatar: "user" },
  { name: "김소현", role: "서비스 기획", avatar: "user" },
  { name: "채하율", role: "데이터 엔지니어", avatar: "user" },
  { name: "박디자이너", role: "UI/UX 디자이너", avatar: "user" }
];

// 가상의 회의록 타임라인 텍스트 (상세 페이지로 이전, 대시보드에는 미노출)
const TRANSCRIPT_MOCK = [
  { time: "01:15", speaker: "김소현", text: "이번 스프린트에서는 TIKI 브랜드 전용 컬러 팔레트를 프론트엔드에 완전히 정착시켜야 해요." },
  { time: "03:12", speaker: "정아름", text: "네, 알겠습니다. TIKI 컬러 팔레트 프론트엔드 환경에 CSS 변수 정의 및 테마 반영 작업은 제가 맡을게요." },
  { time: "07:45", speaker: "송지영", text: "좋습니다. 백엔드 세션 처리도 이슈가 있어요." },
  { time: "11:45", speaker: "김민수", text: "네, 그 부분은 제가 API 규격에 맞춰 세션 리프레시 토큰 흐름을 재설계하겠습니다." },
  { time: "21:10", speaker: "채하율", text: "대시보드 UI MVP 디자인 최종 시안을 어제 전달받았어요." },
  { time: "24:02", speaker: "박디자이너", text: "디자인팀에서 마이그레이션이 끝나는 대로 피그마에 최종 업로드할게요." }
];

// 프로젝트 정보 — ProjectList의 카테고리 팔레트와 동일한 토큰을 사용해 두 화면의 시각 언어를 통일
const PROJECTS = {
  TIKI: { key: "TIKI", name: "TIKI 앱 개발", color: "#0099CC", bg: "#EEF3FF", border: "rgba(0,153,204,0.32)" },
  MKT: { key: "MKT", name: "마케팅 캠페인 Q3", color: "#EF4444", bg: "#FCE8E6", border: "rgba(239,68,68,0.3)" },
  DS: { key: "DS", name: "데이터 인프라 구축", color: "#10B981", bg: "#E6F4EA", border: "rgba(16,185,129,0.3)" }
};

// 프로젝트별 회의명 — 대시보드 곳곳(오늘의 최우선 업무, AI 리마인드 등)에서 동일하게 참조
const MEETING_TITLES = {
  TIKI: "네오테크 6월 3주차 스프린트 회의",
  MKT: "마케팅 캠페인 Q3 킥오프 회의",
  DS: "데이터 인프라 구축 점검 회의"
};

// 우선순위 → 영문 배지 표기 (오늘의 최우선 업무 카드에서 사용)
const PRIORITY_EN = {
  "높음": { label: "High", bg: "#FCE8E6", text: "#EF4444" },
  "보통": { label: "Medium", bg: "#EEF3FF", text: "#0099CC" },
  "낮음": { label: "Low", bg: "#F1F4F8", text: "#5A6F8A" }
};

// AI가 분석한 액션 아이템 초기 데이터
const INITIAL_ACTION_ITEMS = [
  {
    id: 1,
    title: "[TIKI 서비스] 컬러 팔레트 프론트엔드 환경에 CSS 변수 정의 및 테마 반영 작업",
    priority: "보통",
    projectKey: "TIKI",
    assignee: "정아름",
    assignees: ["정아름"],
    avatar: "user",
    status: "검증 전", // 검증 전, 진행중, 연동 완료
    dueDate: "2026-06-23",
    meetingDate: "2026-06-16",
    description: "회의록 03분 12초 영역 기인. 메인 배경(#F8FAFF), 서피스(#FFFFFF), 주요 액션(#0099CC) 및 테두리 변수를 Tailwind 설정 혹은 전역 CSS에 반영하여 디자인 컴포넌트 전체의 일관성을 확보할 것.",
    contextTime: "03:12",
    jiraLink: ""
  },
  {
    id: 2,
    title: "로그인 만료 세션 예외 처리 및 토큰 리프레시 로직 보완",
    priority: "낮음",
    projectKey: "TIKI",
    assignee: "김소현",
    assignees: ["김소현", "김민수", "송지영"],
    avatar: "user",
    status: "연동 완료",
    dueDate: "2026-06-30",
    meetingDate: "2026-06-16",
    description: "회의록 11분 45초 영역 기인. 사용자가 장시간 자리를 비우거나 브라우저를 종료했을 때 세션 만료가 뜨지 않는 버그 방지. Redis 연동 세션 스펙을 검토하고 자동 갱신 API 연동 수행.",
    contextTime: "11:45",
    jiraLink: "https://jira.atlassian.com/browse/TIKI-102"
  },
  {
    id: 3,
    title: "대시보드 UI MVP 디자인 최종 시안 Figma 업로드 및 검토 요청",
    priority: "낮음",
    projectKey: "TIKI",
    assignee: "채하율",
    assignees: ["채하율"],
    avatar: "user",
    status: "연동 완료",
    dueDate: "2026-06-18",
    meetingDate: "2026-06-16",
    description: "회의록 24분 02초 영역 기인. 시제품 자재 및 컴포넌트 단위 디자인 가이드 Figma 업로드 완료 후 Jira 연계 에픽 생성.",
    contextTime: "24:02",
    jiraLink: "https://jira.atlassian.com/browse/TIKI-104"
  },
  {
    id: 4,
    title: "Q3 캠페인 랜딩페이지 카피 및 A/B 테스트 시안 정리",
    priority: "보통",
    projectKey: "MKT",
    assignee: "송지영",
    assignees: ["송지영"],
    avatar: "user",
    status: "진행중",
    dueDate: "2026-06-20",
    meetingDate: "2026-06-17",
    description: "마케팅 캠페인 회의 기인. 랜딩페이지 카피 2종, 헤드라인 A/B 테스트 시안을 정리하고 디자인팀에 전달.",
    contextTime: "09:40",
    jiraLink: ""
  },
  {
    id: 5,
    title: "데이터 파이프라인 야간 배치 실패 알림 연동",
    priority: "높음",
    projectKey: "DS",
    assignee: "채하율",
    assignees: ["채하율", "김민수"],
    avatar: "user",
    status: "검증 전",
    dueDate: "2026-06-19",
    meetingDate: "2026-06-17",
    description: "데이터 인프라 회의 기인. 야간 배치 실패 시 Slack 알림이 누락되는 문제 해결 및 모니터링 대시보드 연동.",
    contextTime: "15:02",
    jiraLink: ""
  },
  {
    id: 6,
    title: "정아름 - 디자인 시스템 컴포넌트 네이밍 컨벤션 문서화",
    priority: "낮음",
    projectKey: "TIKI",
    assignee: "정아름",
    assignees: ["정아름"],
    avatar: "user",
    status: "검증 전",
    dueDate: "2026-07-03",
    meetingDate: "2026-06-16",
    description: "회의록 31분 20초 영역 기인. 팀 전체가 참고할 수 있도록 디자인 시스템 컴포넌트의 네이밍 규칙과 명명 기준을 정리해 문서로 남길 것.",
    contextTime: "31:20",
    jiraLink: ""
  }
];

// AI가 회의록에서 추출한 "약속/리마인드" 초기 데이터 (액션 아이템과 별개 트랙)
const INITIAL_REMINDERS = [
  {
    id: 1,
    name: "김민수",
    task: "레퍼런스 조사 자료 전달",
    deadlineLabel: "오늘까지",
    projectKey: "TIKI",
    contextTime: "31:54",
    dismissed: false
  },
  {
    id: 2,
    name: "송지영",
    task: "A/B 테스트 시안 공유",
    deadlineLabel: "이번 주 안으로",
    projectKey: "MKT",
    contextTime: "14:08",
    dismissed: false
  },
  {
    id: 3,
    name: "박디자이너",
    task: "Figma 최종 업로드 확인 회신",
    deadlineLabel: "내일까지",
    projectKey: "TIKI",
    contextTime: "24:40",
    dismissed: true
  }
];

// 상태 탭 정의
const STATUS_TABS = ["전체", "검증 전", "진행중", "연동 완료"];

// 상태별 dot 색상 (지정 팔레트 그대로 사용)
const STATUS_DOT = {
  "검증 전": "#F59E0B",
  "진행중": "#7C3AED",
  "연동 완료": "#10B981"
};

const STATUS_BADGE_CLASS = {
  "검증 전": "border-[#F59E0B]/40 text-[#B97309]",
  "진행중": "border-[#7C3AED]/40 text-[#7C3AED]",
  "연동 완료": "border-[#10B981]/40 text-[#0E8F69]"
};

// 현재 로그인한 사용자 기준값 — 팀원 데모 로그인 시 "정아름"을 본인으로 간주
const CURRENT_USER_NAME = "정아름";

// Lucide 아이콘 모사 컴포넌트
function LucideIcon({ name, size = 16, className = "" }) {
  const icons = {
    user: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    users: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    clock: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    sparkles: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5 5 3Z" />
        <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z" />
      </svg>
    ),
    plus: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
    upload: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
    zap: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    trash: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    ),
    check: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    checkCircle: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    alertTriangle: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    calendar: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    chevronRight: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    ),
    chevronDown: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    ),
    x: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
    search: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    logOut: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    ),
    lock: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    jira: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M11.53 2 4 9.53a1.5 1.5 0 0 0 0 2.12l3.18 3.18 4.35-4.35 4.35 4.35 3.18-3.18a1.5 1.5 0 0 0 0-2.12L11.53 2Z" fill="currentColor" opacity="0.55"/>
        <path d="M11.53 9.18 4 16.71a1.5 1.5 0 0 0 0 2.12L7.18 22l4.35-4.35-4.35-4.35Z" fill="currentColor"/>
        <path d="M15.88 9.18 11.53 13.53l4.35 4.35L19.06 14.7a1.5 1.5 0 0 0 0-2.12l-3.18-3.4Z" fill="currentColor" opacity="0.85"/>
      </svg>
    ),
    arrowUpRight: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="7" y1="17" x2="17" y2="7" />
        <polyline points="7 7 17 7 17 17" />
      </svg>
    ),
    loader: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
      </svg>
    ),
    target: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
    grid: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="8" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
        <rect x="13" y="13" width="8" height="8" rx="1.5" />
      </svg>
    ),
    bell: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
    inbox: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
      </svg>
    )
  };

  return icons[name] || null;
}

// 마감일 관련 헬퍼: 오늘 기준 D-Day 계산
function getDDayInfo(dueDateStr) {
  const today = new Date("2026-06-18T00:00:00"); // 데모 기준 "오늘" 고정 (실서비스에선 new Date()로 교체)
  const due = new Date(`${dueDateStr}T00:00:00`);
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: `D+${Math.abs(diffDays)}`, urgent: true, overdue: true };
  if (diffDays === 0) return { label: "D-DAY", urgent: true, overdue: false };
  if (diffDays <= 2) return { label: `D-${diffDays}`, urgent: true, overdue: false };
  return { label: `D-${diffDays}`, urgent: false, overdue: false };
}

// 담당자 표시 헬퍼
// 규칙: 팀원 혼자만 표시되는 상황은 노출하지 않는다.
//  - 본인 혼자 → 이름 그대로 노출 ("정아름")
//  - 본인 + 다른 팀원 → 이름 그대로 노출 ("정아름, 김민수")
//  - 다른 팀원 1인 단독 → 익명화 ("담당자 1명")
//  - 다른 팀원 2인 이상 → 익명화 + 인원수 ("담당자 3명")
function formatAssignees(assignees, fallbackName) {
  const list = assignees && assignees.length > 0 ? assignees : [fallbackName];
  const includesMe = list.includes(CURRENT_USER_NAME);

  if (includesMe) {
    return list.join(", ");
  }
  return `담당자 ${list.length}명`;
}

// 리스트에서 "내 담당 여부" 빠르게 판별 (필터/하이라이트용)
function isAssignedToMe(item) {
  const list = item.assignees && item.assignees.length > 0 ? item.assignees : [item.assignee];
  return list.includes(CURRENT_USER_NAME);
}

// 프로젝트 배지 — ProjectList의 카테고리 배지와 동일한 톤(연한 배경 + 텍스트 컬러)으로 통일
function ProjectBadge({ project, size = "sm" }) {
  if (!project) return null;
  const isSmall = size === "sm";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 ${
        isSmall ? "h-5 px-2 text-[10px]" : "h-6 px-2.5 text-[11px]"
      }`}
      style={{ backgroundColor: project.bg, color: project.color }}
    >
      {project.key}
    </span>
  );
}

// D-day 배지 — 전 항목 공통 표시. urgent(D-3 이내/지연)만 강조색, 그 외엔 중립색.
function DDayBadge({ dday }) {
  return (
    <span
      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
        dday.overdue
          ? "border-[#EF4444]/40 text-[#EF4444]"
          : dday.urgent
          ? "border-[#F59E0B]/40 text-[#B97309]"
          : "border-[#9AA7B8]/30 text-[#5A6F8A]"
      }`}
    >
      {dday.label}
    </span>
  );
}

export default function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 1단계: 사용자 로그인 상태 관리
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem("tiki_access_token")));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("tiki_user") || "null");
    } catch {
      return null;
    }
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  useEffect(() => {
    const syncAuthSession = () => {
      setIsAuthenticated(Boolean(localStorage.getItem("tiki_access_token")));
      try {
        setUser(JSON.parse(localStorage.getItem("tiki_user") || "null"));
      } catch {
        setUser(null);
      }
    };

    window.addEventListener("storage", syncAuthSession);
    window.addEventListener("tiki-auth-changed", syncAuthSession);
    return () => {
      window.removeEventListener("storage", syncAuthSession);
      window.removeEventListener("tiki-auth-changed", syncAuthSession);
    };
  }, []);
  const [loginForm, setLoginForm] = useState({ email: "tiki@neotech.com", password: "••••••••" });

  // 2단계: 대시보드 상태 관리
  const [actionItems, setActionItems] = useState(INITIAL_ACTION_ITEMS);
  const [statusFilter, setStatusFilter] = useState("전체");
  const [projectFilter, setProjectFilter] = useState("전체"); // ProjectList의 카테고리 필터와 동일한 패턴
  const [searchQuery, setSearchQuery] = useState(""); // 실시간 검색어
  const [isProjectFilterOpen, setIsProjectFilterOpen] = useState(false); // 프로젝트 드롭다운 열림 상태
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false); // 오늘의 최우선 업무 + AI 리마인드 통합 패널 — 기본 접힘
  const [selectedItem, setSelectedItem] = useState(null);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [isStatusSortOpen, setIsStatusSortOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [integratingId, setIntegratingId] = useState(null); // Jira 연동 모션 진행 중인 행
  const [justCompletedId, setJustCompletedId] = useState(null); // 방금 연동 완료되어 하이라이트할 행

  // AI 리마인드 상태 관리 (액션 아이템과는 별개의 "약속 확인" 트랙)
  const [reminders, setReminders] = useState(INITIAL_REMINDERS);

  const dueDateInputRef = useRef(null);
  const assigneeDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);
  const projectDropdownRef = useRef(null);

  // 업로드 시뮬레이션 관련 상태
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPhase, setUploadPhase] = useState("IDLE");
  const [uploadProgress, setUploadProgress] = useState(0);

  // 모달 입력 제어
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    assignee: ""
  });

  // 토스트 메시지 상태
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  const triggerToast = (msg, type = "info") => {
    setToast({ show: true, message: msg, type });
    setTimeout(() => setToast({ show: false, message: "", type: "info" }), 3000);
  };

  useEffect(() => {
    const flashToast = sessionStorage.getItem("tiki_flash_toast");
    if (flashToast) {
      triggerToast(flashToast);
      sessionStorage.removeItem("tiki_flash_toast");
    }
  }, []);

  useEffect(() => {
    if (!isAssigneeOpen && !isStatusSortOpen && !isProjectFilterOpen) return;
    const handleOutsideClick = (e) => {
      if (isAssigneeOpen && assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target)) {
        setIsAssigneeOpen(false);
      }
      if (isStatusSortOpen && statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) {
        setIsStatusSortOpen(false);
      }
      if (isProjectFilterOpen && projectDropdownRef.current && !projectDropdownRef.current.contains(e.target)) {
        setIsProjectFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isAssigneeOpen, isStatusSortOpen, isProjectFilterOpen]);

  useEffect(() => {
    if (!selectedItem) setDeleteTargetId(null);
  }, [selectedItem]);

  // 로그인 모드 진입
  const handleLogin = (e) => {
    e.preventDefault();
    const demoUser = { name: CURRENT_USER_NAME, email: loginForm.email };
    localStorage.setItem("tiki_access_token", "demo-dashboard-token");
    localStorage.setItem("tiki_user", JSON.stringify(demoUser));
    setUser(demoUser);
    setIsAuthenticated(true);
    setShowLoginModal(false);
    triggerToast("네오테크 가상 B2B 도메인으로 로그인되었습니다.", "success");
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    triggerToast("로그아웃 되었습니다.", "info");
  };

  // 티켓 상세 편집창 진입 시 폼 세팅
  const openEditModal = (item) => {
    setSelectedItem(item);
    setIsAssigneeOpen(false);
    setEditForm({
      title: item.title,
      description: item.description,
      dueDate: item.dueDate,
      assignee: item.assignee
    });
  };

  // A. 수정 (Edit) 기능
  const handleSaveEdit = () => {
    setActionItems(prev => prev.map(item => {
      if (item.id === selectedItem.id) {
        return { ...item, ...editForm, status: "진행중" };
      }
      return item;
    }));
    setSelectedItem(null);
    triggerToast("액션 아이템이 성공적으로 수정(사용자 변경)되었습니다.", "success");
  };

  // A-1. 검증 (Verify) 기능 — "검증 전" 항목을 빠르게 "진행중"으로 전환 (모달을 열지 않는 1-click 액션)
  const handleVerify = (itemId) => {
    setActionItems(prev => prev.map(item => (
      item.id === itemId ? { ...item, status: "진행중" } : item
    )));
    triggerToast("액션 아이템이 검증되어 진행중 상태로 전환되었습니다.", "success");
  };

  const handleQuickVerify = (e, itemId) => {
    e.stopPropagation();
    handleVerify(itemId);
  };

  // B. 승인 (Approve) 기능 — 연동 완료 처리 전, 짧은 모션(연동 중 표시)을 거쳐 자연스럽게 정리
  const handleApprove = (itemId) => {
    setIntegratingId(itemId);
    setTimeout(() => {
      setActionItems(prev => prev.map(item => {
        if (item.id === itemId) {
          const randomTicketNum = Math.floor(Math.random() * 800) + 100;
          return {
            ...item,
            status: "연동 완료",
            jiraLink: `https://jira.atlassian.com/browse/NEO-${randomTicketNum}`
          };
        }
        return item;
      }));
      setIntegratingId(null);
      setSelectedItem(null);
      setJustCompletedId(itemId);
      setTimeout(() => setJustCompletedId(null), 1200);
      triggerToast("Jira API를 호출하여 티켓 생성이 승인 완료되었습니다!", "ai");
    }, 700);
  };

  // 리스트 행에서 바로 연동(원클릭 승인)
  const handleQuickApprove = (e, itemId) => {
    e.stopPropagation();
    handleApprove(itemId);
  };

  // C. 삭제 (Delete) 기능
  const openDeleteConfirm = (itemId) => setDeleteTargetId(itemId);
  const closeDeleteConfirm = () => setDeleteTargetId(null);

  const handleDelete = () => {
    if (deleteTargetId == null) return;
    setActionItems(prev => prev.filter(item => item.id !== deleteTargetId));
    setSelectedItem(null);
    setDeleteTargetId(null);
    triggerToast("액션 아이템이 삭제되었습니다.", "warning");
  };

  // D. AI 리마인드 — "준비 완료"로 표시(해당 약속 확인 처리)
  const handleDismissReminder = (reminderId) => {
    setReminders(prev => prev.map(r => (
      r.id === reminderId ? { ...r, dismissed: true } : r
    )));
    triggerToast("리마인드를 확인 완료로 표시했습니다.", "success");
  };

  // 업로드 체험 시뮬레이션
  const handleFileUploadSimulate = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadFile(file);
      setUploadPhase("UPLOADING");
      setUploadProgress(0);
    }
  };

  useEffect(() => {
    let interval;
    if (uploadPhase === "UPLOADING") {
      interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setUploadPhase("PROCESSING");
            return 100;
          }
          return prev + 10;
        });
      }, 200);
    } else if (uploadPhase === "PROCESSING") {
      interval = setTimeout(() => {
        const newAction = {
          id: Date.now(),
          title: `[보안 마스킹 가동] 신규 업로드된 ${uploadFile?.name || "회의록"} 기반 자동 태스크`,
          priority: "높음",
          projectKey: "TIKI",
          assignee: CURRENT_USER_NAME,
          assignees: [CURRENT_USER_NAME],
          avatar: "user",
          status: "검증 전",
          dueDate: "2026-06-25",
          meetingDate: "2026-06-18",
          description: "새로 업로드한 오디오에서 RAG를 기반으로 도메인 전문 용어(Figma, Celery, React)를 식별 및 마스킹한 뒤 추출해 낸 태스크입니다.",
          contextTime: "01:15",
          jiraLink: ""
        };
        setActionItems(prev => [newAction, ...prev]);
        setUploadPhase("COMPLETED");
        triggerToast("AI 분석 및 액션 아이템 추출이 완료되어 목록에 추가되었습니다!", "ai");
      }, 2500);
    }
    return () => {
      clearInterval(interval);
      clearTimeout(interval);
    };
  }, [uploadPhase, uploadFile?.name]);

  const uploadStateLabels = {
    IDLE: "대기 중",
    UPLOADING: "업로드 중",
    PROCESSING: "AI 분석 중",
    COMPLETED: "분석 완료",
    FAILED: "오류 발생"
  };

  const openDueDatePicker = () => {
    if (typeof dueDateInputRef.current?.showPicker === "function") {
      dueDateInputRef.current.showPicker();
    }
  };

  // 상태 필터 + 프로젝트 필터 + 실시간 검색 필터링 (제목/담당자 대상)
  // 리스트는 항상 내 담당 항목만 노출
  const isAnyFilterActive = statusFilter !== "전체" || projectFilter !== "전체" || searchQuery.trim() !== "";

  const filteredItems = useMemo(() => {
    const byAssignee = actionItems.filter((item) => isAssignedToMe(item));

    const byStatus = statusFilter === "전체"
      ? byAssignee
      : byAssignee.filter((item) => item.status === statusFilter);

    const byProject = projectFilter === "전체"
      ? byStatus
      : byStatus.filter((item) => item.projectKey === projectFilter);

    const query = searchQuery.trim().toLowerCase();
    if (!query) return byProject;

    return byProject.filter((item) => {
      const haystack = [
        item.title,
        item.assignee,
        ...(item.assignees || []),
        PROJECTS[item.projectKey]?.name || ""
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [actionItems, statusFilter, projectFilter, searchQuery]);


  // 프로젝트별 그룹핑 — ProjectList의 카테고리 그룹 섹션 구조를 동일하게 적용
  // 각 그룹 내부에서는 연동 완료 항목을 하단으로 자연스럽게 정렬
  const groupedByProject = useMemo(() => {
    const groups = {};
    filteredItems.forEach((item) => {
      if (!groups[item.projectKey]) groups[item.projectKey] = [];
      groups[item.projectKey].push(item);
    });

    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        const aDone = a.status === "연동 완료" ? 1 : 0;
        const bDone = b.status === "연동 완료" ? 1 : 0;
        return aDone - bDone;
      });
    });

    // 원본 PROJECTS 순서를 기준으로 그룹 순서 고정 (TIKI → MKT → DS)
    return Object.keys(PROJECTS)
      .filter((key) => groups[key] && groups[key].length > 0)
      .map((key) => ({ projectKey: key, items: groups[key] }));
  }, [filteredItems]);

  // 헤더 개인화 인사에 쓰이는 값 — "오늘 처리할 내 아이템 개수"만 한 줄로 보여준다.
  const firstName = user?.name || "사용자";
  const myPendingCount = actionItems.filter((item) => item.status !== "연동 완료" && isAssignedToMe(item)).length;

  // 내 업무 기준 파생 데이터 — "오늘의 최우선 업무" 카드에서 사용
  // AI Score(정렬 가중치)는 화면에는 노출하지 않고 정렬 기준으로만 사용한다.
  const myActiveItems = useMemo(() => {
    const priorityWeight = { "높음": 3, "보통": 2, "낮음": 1 };
    return actionItems
      .filter((item) => isAssignedToMe(item) && item.status !== "연동 완료")
      .sort((a, b) => {
        const weightDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        if (weightDiff !== 0) return weightDiff;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
  }, [actionItems]);

  const topPriorityItems = myActiveItems.slice(0, 2);

  const activeReminderCount = reminders.filter((r) => !r.dismissed).length;

  const projectFilterOptions = ["전체", ...Object.keys(PROJECTS)];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFF] text-[#0D1B2A] font-sans antialiased pt-20 pb-20 md:pb-0 [font-family:'Pretendard',-apple-system,sans-serif]">
      <style>
        {`
          .date-input-neutral {
            color: #0D1B2A;
            -webkit-text-fill-color: #0D1B2A;
          }
          .date-input-neutral::-webkit-datetime-edit,
          .date-input-neutral::-webkit-datetime-edit-year-field,
          .date-input-neutral::-webkit-datetime-edit-month-field,
          .date-input-neutral::-webkit-datetime-edit-day-field {
            color: #0D1B2A;
            -webkit-text-fill-color: #0D1B2A;
          }
          .date-input-neutral:focus::-webkit-datetime-edit,
          .date-input-neutral:focus::-webkit-datetime-edit-year-field,
          .date-input-neutral:focus::-webkit-datetime-edit-month-field,
          .date-input-neutral:focus::-webkit-datetime-edit-day-field {
            color: #0D1B2A;
            -webkit-text-fill-color: #0D1B2A;
            background: transparent;
          }
          @keyframes rowSettle {
            0% { opacity: 0; transform: translateY(-6px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .row-settle { animation: rowSettle 0.35s ease-out; }
          @keyframes spinSlow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin-slow { animation: spinSlow 0.9s linear infinite; }
          @keyframes completeFlash {
            0% { background-color: rgba(16,185,129,0.14); }
            100% { background-color: rgba(16,185,129,0); }
          }
          .complete-flash { animation: completeFlash 1.1s ease-out; }
        `}
      </style>

      <Header
        isMobile={isMobile}
        isLoggedIn={isAuthenticated}
        user={user}
        onLogout={handleLogout}
        phase={uploadPhase}
        stateLabels={uploadStateLabels}
      />

      {/* 1단계: 랜딩 페이지 (비인증 상태) — 기존 유지, 절대 수정하지 않음 */}
      {!isAuthenticated && (
        <div className="flex-1 flex flex-col">
          <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-28 bg-gradient-to-b from-[#F8FAFF] via-white to-[#F8FAFF]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none">
              <div className="absolute top-12 left-10 w-72 h-72 bg-[#EEF3FF] rounded-full blur-3xl opacity-60"></div>
              <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#7C3AED]/5 rounded-full blur-3xl opacity-60"></div>
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#7C3AED] bg-[#7C3AED]/10 rounded-full mb-6">
                <LucideIcon name="sparkles" size={12} className="text-[#7C3AED]" />
                2026 AI · 협업 툴 마그네틱 플러그인
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#0D1B2A] leading-tight mb-6">
                회의만 하세요, <br />
                <span className="bg-gradient-to-r from-[#0099CC] via-[#7C3AED] to-[#EF4444] bg-clip-text text-transparent">
                  티켓은 TIKI가 만듭니다
                </span>
              </h1>
              <p className="max-w-2xl mx-auto text-base sm:text-lg lg:text-xl text-[#5A6F8A] leading-relaxed mb-10">
                수기로 회의 정리하고 Jira 복사/붙여넣기 하던 수동 파이프라인은 끝났습니다.
                AI가 회의의 깊은 맥락을 읽고 정밀한 업무 티켓을 자동 빌드합니다.
              </p>

              <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                <Link
                  to="/login"
                  className="w-full sm:w-auto px-8 py-4 text-base font-bold text-white bg-[#0099CC] hover:bg-[#0086b3] rounded-2xl shadow-xl shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 no-underline"
                >
                  지금 무료로 시작하기 <LucideIcon name="sparkles" size={16} />
                </Link>
                <a
                  href="#how-it-works"
                  className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-[#0D1B2A] hover:text-[#0099CC] bg-white border border-[rgba(0,100,180,0.12)] rounded-2xl hover:bg-[#EEF3FF] transition-all text-center"
                >
                  기능 작동 방식 알아보기
                </a>
              </div>

              <div className="mt-16 border border-[rgba(0,100,180,0.12)] rounded-2xl bg-white shadow-2xl p-4 lg:p-6 max-w-5xl mx-auto transition-all">
                <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3 mb-4 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#EF4444]"></span>
                    <span className="w-3 h-3 rounded-full bg-[#F59E0B]"></span>
                    <span className="w-3 h-3 rounded-full bg-[#10B981]"></span>
                  </div>
                  <span className="min-w-0 flex-1 text-[10px] sm:text-xs text-[#5A6F8A] font-mono truncate">
                    https://tiki.neotech.io/dashboard
                  </span>
                  <span className="shrink-0 text-[10px] sm:text-xs text-[#0099CC] font-bold whitespace-nowrap">
                    <span className="sm:hidden">● LIVE</span>
                    <span className="hidden sm:inline">● LIVE DEMO PREVIEW</span>
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 mb-5 bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl text-left">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                      <span className="text-xs font-bold text-[#10B981]">AI 분석 완료</span>
                    </div>
                    <h4 className="text-base sm:text-lg font-bold text-[#0D1B2A] truncate">
                      네오테크 6월 3주차 스프린트 회의
                    </h4>
                    <p className="text-xs sm:text-[13px] text-[#5A6F8A] mt-1">
                      참여자 4명 · 녹화 시간 38분 · 액션아이템 7개 추출
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 w-full sm:w-auto px-4 py-2.5 text-sm font-bold text-white bg-[#0099CC] hover:bg-[#0086b3] rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    Jira 전송 준비됨
                    <LucideIcon name="chevronRight" size={14} className="text-white" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
                  {INITIAL_ACTION_ITEMS.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="border border-[rgba(0,100,180,0.12)] hover:border-[rgba(0,153,204,0.5)] rounded-xl p-4 bg-white hover:bg-[#EEF3FF] transition-colors"
                    >
                      <div className="flex justify-between items-center mb-2.5 gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#5A6F8A]">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_DOT[item.status] || "#94A3B8" }}></span>
                          {item.status}
                        </span>
                        {item.jiraLink && <LucideIcon name="jira" size={12} className="text-[#0099CC]" />}
                      </div>
                      <h4 className="text-sm font-bold text-[#0D1B2A] line-clamp-1">{item.title}</h4>
                      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-[#5A6F8A]">
                        <span className="flex items-center gap-1 truncate">
                          <LucideIcon name="user" size={10} />
                          {item.assignee}
                        </span>
                        <span className="text-[#0099CC] flex items-center gap-1 shrink-0">
                          <LucideIcon name="clock" size={10} />
                          {item.contextTime}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section id="how-it-works" className="py-20 bg-white border-t border-[rgba(0,100,180,0.12)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="text-3xl font-extrabold text-[#0D1B2A] tracking-tight mb-4">
                  TIKI는 어떤 기술로 워크플로우를 완성할까요?
                </h2>
                <p className="text-[#5A6F8A]">
                  단순히 받아쓰기만 하는 받아쓰기 도구가 아닙니다.
                  TIKI는 회의 종료 즉시 도메인을 해석하여 실제 행동 지침으로 정량화합니다.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-[#F8FAFF] border border-[rgba(0,100,180,0.08)]">
                  <div className="w-16 h-16 rounded-2xl bg-[#EEF3FF] text-[#0099CC] flex items-center justify-center text-xl font-extrabold mb-6 shadow-sm">
                    01
                  </div>
                  <h3 className="text-lg font-bold text-[#0D1B2A] mb-3">회의록 사후 업로드</h3>
                  <p className="text-sm text-[#5A6F8A] leading-relaxed">
                    실시간 스트리밍의 불안정성을 배제하고, 회의 완료 후 녹음 파일(.mp3, .wav)을 업로드하여 100% 온전한 원본 분석을 시작합니다.
                  </p>
                </div>

                <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-[#F8FAFF] border border-[rgba(0,100,180,0.08)]">
                  <div className="w-16 h-16 rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center text-xl font-extrabold mb-6 shadow-sm">
                    02
                  </div>
                  <h3 className="text-lg font-bold text-[#0D1B2A] mb-3">LLM 문맥 및 보안 필터링</h3>
                  <p className="text-sm text-[#5A6F8A] leading-relaxed">
                    Whisper 엔진과 결합하여 화자를 정확히 분리하고, 사내 민감 정보나 기밀 고객 데이터는 AI 보안 마스킹 시스템을 통해 걸러냅니다.
                  </p>
                </div>

                <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-[#F8FAFF] border border-[rgba(0,100,180,0.08)]">
                  <div className="w-16 h-16 rounded-2xl bg-[#10B981]/10 text-[#10B981] flex items-center justify-center text-xl font-extrabold mb-6 shadow-sm">
                    03
                  </div>
                  <h3 className="text-lg font-bold text-[#0D1B2A] mb-3">Jira/Notion 원클릭 연동</h3>
                  <p className="text-sm text-[#5A6F8A] leading-relaxed">
                    사용자가 '승인(Approve)' 버튼을 누르는 즉시 Jira API로 전송되어 정식 업무 티켓으로 실시간 연동이 완료됩니다.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 2단계: 메인 대시보드 (인증 상태) — 조망/필터링/실행 3단 구조로 재구성 */}
      {isAuthenticated && (
        <div className="flex-1 w-full px-4 md:px-8 py-6 md:py-8">
          <div className="max-w-6xl mx-auto flex flex-col gap-8">

            {/* 상단 헤더 영역 — 개인화 인사 + 요약 패널 펼치기 토글 */}
            <div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold text-[#0D1B2A]">
                    안녕하세요, {firstName}님
                  </h1>
                  <p className="text-[#5A6F8A] mt-1">
                    오늘 처리할 내 액션 아이템이 <span className="font-bold text-[#0099CC]">{myPendingCount}개</span> 있어요
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSummaryExpanded((prev) => !prev)}
                  aria-expanded={isSummaryExpanded}
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0099CC] hover:text-[#0086b3] transition-colors cursor-pointer"
                >
                  {isSummaryExpanded ? "오늘의 요약 접기" : "오늘의 요약 보기"}
                  <LucideIcon
                    name="chevronDown"
                    size={15}
                    className={`transition-transform duration-300 ${isSummaryExpanded ? "rotate-180" : ""}`}
                  />
                </button>
              </div>
            </div>

            {/* 오늘의 최우선 업무 + AI 리마인드 — 하나의 통합 요약 패널, 기본 접힘. 테두리/배경 없이 메인 리스트 흐름을 방해하지 않음 */}
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                isSummaryExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-2">
                  {/* 오늘의 최우선 업무 */}
                  <section className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-[#EEF3FF] text-[#0099CC] flex items-center justify-center">
                        <LucideIcon name="target" size={14} />
                      </span>
                      <h2 className="text-base font-bold text-[#0D1B2A]">오늘의 최우선 업무</h2>
                      <span className="text-[11px] font-bold text-[#7C3AED] bg-[#7C3AED]/10 px-2 py-0.5 rounded-full">AI 산정</span>
                    </div>

                    {topPriorityItems.length === 0 ? (
                      <div className="flex-1 rounded-2xl border border-dashed border-[rgba(0,100,180,0.18)] bg-white p-8 text-center flex items-center justify-center">
                        <p className="text-sm text-[#5A6F8A]">오늘 처리할 우선 업무가 없어요. 잘 하고 계세요! 🎉</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {topPriorityItems.map((item, idx) => {
                          const dday = getDDayInfo(item.dueDate);
                          const pr = PRIORITY_EN[item.priority] || PRIORITY_EN["보통"];
                          return (
                            <div
                              key={item.id}
                              onClick={() => openEditModal(item)}
                              className="cursor-pointer rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-4 hover:border-[rgba(0,153,204,0.4)] hover:shadow-md transition-all"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-bold text-[#9AA7B8]">#{idx + 1} 우선</span>
                                <span
                                  className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: pr.bg, color: pr.text }}
                                >
                                  {pr.label}
                                </span>
                              </div>
                              <h3 className="text-sm font-bold text-[#0D1B2A] leading-snug mb-3 line-clamp-2">
                                {item.title}
                              </h3>
                              <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 text-[12px] text-[#5A6F8A] hover:text-[#0099CC] underline-offset-2 hover:underline"
                              >
                                <LucideIcon name="calendar" size={11} className="text-[#9AA7B8]" />
                                {MEETING_TITLES[item.projectKey]}
                              </button>
                              <div className="mt-3 flex justify-end">
                                <DDayBadge dday={dday} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* AI 리마인드 */}
                  <section className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-[#EEF3FF] text-[#0099CC] flex items-center justify-center">
                        <LucideIcon name="bell" size={14} />
                      </span>
                      <h2 className="text-base font-bold text-[#0D1B2A]">AI 리마인드</h2>
                      <span className="text-[11px] font-bold text-white bg-[#0099CC] px-2 py-0.5 rounded-full">
                        {activeReminderCount}건 확인 필요
                      </span>
                    </div>

                    <div className="flex flex-col gap-3">
                      {reminders.map((r) => (
                        <div
                          key={r.id}
                          className={`flex items-start sm:items-center justify-between gap-3 rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-4 transition-opacity ${
                            r.dismissed ? "opacity-45" : ""
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="shrink-0 w-7 h-7 rounded-full bg-[#F8FAFF] text-[#9AA7B8] flex items-center justify-center mt-0.5">
                              <LucideIcon name="bell" size={13} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm text-[#0D1B2A] leading-snug">
                                어제 회의에서 <strong className="font-bold">'{r.name}'</strong>님에게{" "}
                                <strong className="font-bold">'{r.task}'</strong>를 전달하기로 말씀하셨습니다.
                              </p>
                              <p className="mt-1.5 text-[11px] text-[#8A9AB0] flex items-center gap-1.5 flex-wrap">
                                <span className={`font-bold ${r.dismissed ? "text-[#9AA7B8]" : "text-[#B97309]"}`}>
                                  {r.deadlineLabel}
                                </span>
                                <span className="text-[#D7DEE8]">·</span>
                                <span>{MEETING_TITLES[r.projectKey]}</span>
                                <span className="text-[#D7DEE8]">·</span>
                                <span className="font-mono">{r.contextTime}</span>
                              </p>
                            </div>
                          </div>

                          {!r.dismissed && (
                            <button
                              type="button"
                              onClick={() => handleDismissReminder(r.id)}
                              className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0099CC] border border-[#0099CC]/40 hover:bg-[#0099CC] hover:text-white hover:border-[#0099CC] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              <LucideIcon name="check" size={12} />
                              준비 완료
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </div>

            {/* 전체 액션 아이템 */}
            <section className="flex flex-col gap-4">
              <h2 className="text-lg font-bold text-[#0D1B2A]">전체 액션 아이템</h2>

              {/* 검색/상태/프로젝트 필터 — ProjectList의 흰 카드 필터 패널과 동일한 구성 */}
              <div className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-4 sm:p-5 shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  <div className="lg:col-span-7 relative">
                    <LucideIcon name="search" size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9AA7B8]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="제목, 담당자, 프로젝트 검색"
                      className="w-full pl-10 pr-9 py-2.5 text-sm bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl focus:outline-none focus:border-[#0099CC] placeholder:text-[#9AA7B8]"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9AA7B8] hover:text-[#5A6F8A] transition-colors"
                      >
                        <LucideIcon name="x" size={14} />
                      </button>
                    )}
                  </div>

                  <div className="lg:col-span-5">
                    <div className="relative" ref={statusDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsStatusSortOpen((prev) => !prev)}
                        className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition flex items-center justify-between cursor-pointer ${
                          isStatusSortOpen
                            ? "bg-[#EEF3FF] border-[#0099CC]/40 shadow-[0_0_0_3px_rgba(0,153,204,0.12)] text-[#0D1B2A]"
                            : "bg-[#F8FAFF] border-[rgba(0,100,180,0.12)] text-[#0D1B2A] hover:border-[rgba(0,153,204,0.4)]"
                        }`}
                      >
                        <span className="font-medium">상태: {statusFilter}</span>
                        <LucideIcon
                          name="chevronDown"
                          size={14}
                          className={`text-[#5A6F8A] transition-transform ${isStatusSortOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {isStatusSortOpen && (
                        <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)]">
                          {STATUS_TABS.map((option) => {
                            const count = option === "전체"
                              ? actionItems.length
                              : actionItems.filter((i) => i.status === option).length;
                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => {
                                  setStatusFilter(option);
                                  setIsStatusSortOpen(false);
                                }}
                                className={`w-full px-3.5 py-2.5 text-sm text-left flex items-center justify-between transition-colors cursor-pointer ${
                                  statusFilter === option
                                    ? "bg-[#EEF3FF] text-[#0099CC] font-semibold"
                                    : "text-[#0D1B2A] hover:bg-[#F8FAFF]"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  {option !== "전체" && (
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_DOT[option] }}></span>
                                  )}
                                  {option}
                                </span>
                                <span className="text-xs text-[#9AA7B8]">{count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 프로젝트 필터 드롭다운 */}
                <div className="mt-4">
                  <div className="relative inline-block" ref={projectDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsProjectFilterOpen((prev) => !prev)}
                      className={`px-3.5 py-2 text-sm rounded-xl border transition flex items-center gap-2 font-semibold cursor-pointer ${
                        isProjectFilterOpen
                          ? "bg-[#EEF3FF] border-[#0099CC]/40 shadow-[0_0_0_3px_rgba(0,153,204,0.12)] text-[#0099CC]"
                          : "bg-[#F8FAFF] border-[rgba(0,100,180,0.12)] text-[#0D1B2A] hover:border-[rgba(0,153,204,0.4)]"
                      }`}
                    >
                      {projectFilter !== "전체" && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: PROJECTS[projectFilter].color }}
                        ></span>
                      )}
                      <span>{projectFilter === "전체" ? "프로젝트: 전체" : PROJECTS[projectFilter].name}</span>
                      <LucideIcon
                        name="chevronDown"
                        size={14}
                        className={`text-[#5A6F8A] transition-transform ${isProjectFilterOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isProjectFilterOpen && (
                      <div className="absolute left-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)]">
                        {projectFilterOptions.map((key) => {
                          const isActive = projectFilter === key;
                          const palette = key === "전체"
                            ? { color: "#0099CC" }
                            : PROJECTS[key];
                          const label = key === "전체" ? "전체" : PROJECTS[key].name;
                          const count = key === "전체"
                            ? actionItems.filter((i) => isAssignedToMe(i)).length
                            : actionItems.filter((i) => isAssignedToMe(i) && i.projectKey === key).length;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setProjectFilter(key);
                                setIsProjectFilterOpen(false);
                              }}
                              className={`w-full px-3.5 py-2.5 text-sm text-left flex items-center justify-between transition-colors cursor-pointer ${
                                isActive
                                  ? "bg-[#EEF3FF] text-[#0099CC] font-semibold"
                                  : "text-[#0D1B2A] hover:bg-[#F8FAFF]"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                {key !== "전체" && (
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: palette.color }}></span>
                                )}
                                {label}
                              </span>
                              <span className="text-xs text-[#9AA7B8]">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 빈 상태 — 정적 화면 (로딩 스피너 없음), 필터 활성 여부에 따라 보조 문구 분기 */}
              {groupedByProject.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[rgba(0,100,180,0.18)] bg-white p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#EEF3FF] flex items-center justify-center mb-4 mx-auto">
                    <LucideIcon name="inbox" size={22} className="text-[#0099CC]" />
                  </div>
                  <p className="text-[#0D1B2A] font-semibold">처리할 액션 아이템이 없어요</p>
                  <p className="text-sm text-[#5A6F8A] mt-1">
                    {isAnyFilterActive
                      ? "다른 필터를 선택해보세요."
                      : "새 회의록을 업로드하면 AI가 액션 아이템을 추출해 드려요."}
                  </p>
                </div>
              )}

              {groupedByProject.map(({ projectKey, items }) => {
                const project = PROJECTS[projectKey];
                return (
                  <section key={projectKey}>
                    {/* 그룹 헤딩 — ProjectList의 "● 카테고리명 N개" 패턴 그대로 차용 */}
                    <div className="mb-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: project.color }}></span>
                      <span className="text-sm font-bold text-[#0D1B2A]">{project.name}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ backgroundColor: project.bg, color: project.color }}
                      >
                        {items.length}개
                      </span>
                    </div>

                    <div className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white overflow-hidden">
                      {items.map((item, idx) => {
                        const dday = getDDayInfo(item.dueDate);
                        const isIntegrating = integratingId === item.id;
                        const isJustCompleted = justCompletedId === item.id;
                        const assigneeList = item.assignees && item.assignees.length > 0 ? item.assignees : [item.assignee];

                        return (
                          <div
                            key={item.id}
                            onClick={() => !isIntegrating && openEditModal(item)}
                            className={`row-settle group px-4 sm:px-5 py-[18px] flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 cursor-pointer hover:bg-[#F8FAFF] transition-colors duration-150 ${
                              idx !== items.length - 1 ? "border-b border-[rgba(0,100,180,0.08)]" : ""
                            } ${isIntegrating ? "opacity-50" : ""} ${isJustCompleted ? "complete-flash" : ""}`}
                          >
                            {/* 제목 + 메타 */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: STATUS_DOT[item.status] || "#94A3B8" }}
                                ></span>
                                <span className="text-[11px] font-semibold text-[#5A6F8A]">{item.status}</span>
                              </div>
                              <h4 className="text-sm sm:text-[15px] font-semibold text-[#0D1B2A] leading-snug group-hover:text-[#0099CC] transition-colors">
                                {item.title}
                              </h4>
                              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[11px] text-[#8A9AB0]">
                                <span>{item.meetingDate} 회의</span>
                                <span className="text-[#D7DEE8]">·</span>
                                <span className="font-mono">{item.contextTime} 발화</span>
                                <span className="text-[#D7DEE8]">·</span>
                                <span className="inline-flex items-center gap-1">
                                  <LucideIcon name={assigneeList.length > 1 ? "users" : "user"} size={11} className="text-[#9AA7B8]" />
                                  {formatAssignees(item.assignees, item.assignee)}
                                </span>
                              </div>
                            </div>

                            {/* 마감 정보 — 세로 통합: 상단 D-day(강조), 하단 마감일(보조). 같은 축에 우측 정렬 */}
                            <div className="flex flex-col items-end justify-center shrink-0 sm:w-[88px] py-1">
                              <span
                                className={`text-[14px] font-bold leading-[0.8] ${
                                  dday.overdue ? "text-[#EF4444]" : dday.urgent ? "text-[#F59E0B]" : "text-[#5A6F8A]"
                                }`}
                              >
                                {dday.label}
                              </span>
                              <span className="mt-1 text-[11px] font-light leading-[0.8] text-[#9AA7B8]">
                                {item.dueDate.slice(5)}
                              </span>
                            </div>

                            {/* 상태 배지 + 검증/연동 액션 (연동 완료는 액션 버튼 없이 Jira 확인 링크만, 검증 전은 버튼만 노출) */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 sm:w-[180px]">
                              {item.status !== "검증 전" && (
                                <span
                                  className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full border ${STATUS_BADGE_CLASS[item.status] || "border-gray-300 text-gray-500"}`}
                                >
                                  {item.status}
                                </span>
                              )}

                              {isIntegrating ? (
                                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0099CC]">
                                  <LucideIcon name="loader" size={13} className="spin-slow" />
                                  연동 중
                                </span>
                              ) : item.status === "연동 완료" ? (
                                <a
                                  href={item.jiraLink || "#"}
                                  onClick={(e) => e.stopPropagation()}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0099CC] hover:underline"
                                  title="Jira 연동 완료"
                                >
                                  <LucideIcon name="jira" size={13} className="text-[#0099CC]" />
                                  Jira 확인
                                </a>
                              ) : item.status === "검증 전" ? (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0099CC] border border-[#0099CC]/40 hover:bg-[#0099CC] hover:text-white hover:border-[#0099CC] hover:shadow-[0_4px_12px_rgba(0,153,204,0.25)] px-2.5 py-1.5 rounded-lg transition-all duration-150"
                                >
                                  <LucideIcon name="checkCircle" size={12} />
                                  검증하기
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => handleQuickApprove(e, item.id)}
                                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0099CC] border border-[#0099CC]/40 hover:bg-[#0099CC] hover:text-white hover:border-[#0099CC] hover:shadow-[0_4px_12px_rgba(0,153,204,0.25)] px-2.5 py-1.5 rounded-lg transition-all duration-150"
                                >
                                  <LucideIcon name="jira" size={12} />
                                  연동하기
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </section>
          </div>
        </div>
      )}

      {/* 3단계: 상세 편집 모달 (수정 / 검증 / 승인 / 삭제 통합 제어) */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-[#0D1B2A]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[88vh] border border-[rgba(0,100,180,0.12)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">

            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_BADGE_CLASS[selectedItem.status] || "border-gray-300 text-gray-500"}`}
                >
                  {selectedItem.status}
                </span>
                <span className="text-[11px] font-semibold text-[#9AA7B8] whitespace-nowrap">
                  우선순위 {selectedItem.priority}
                </span>
                <span className="text-sm font-bold text-[#0D1B2A] truncate">Action Item 상세</span>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-[#5A6F8A] hover:text-[#0D1B2A] transition-colors shrink-0 cursor-pointer"
              >
                <LucideIcon name="x" size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-[#0D1B2A] mb-1.5">제목</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-[rgba(0,100,180,0.12)] rounded-lg text-sm focus:border-[#0099CC] focus:ring-1 focus:ring-[#0099CC] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0D1B2A] mb-1.5">설명</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-[rgba(0,100,180,0.12)] rounded-lg text-sm focus:border-[#0099CC] focus:ring-1 focus:ring-[#0099CC] outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div onClick={openDueDatePicker} className="cursor-pointer">
                  <label className="block text-xs font-bold text-[#0D1B2A] mb-1.5">마감 기한</label>
                  <input
                    ref={dueDateInputRef}
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                    onClick={openDueDatePicker}
                    className="date-input-neutral w-full px-3 py-2 border border-[rgba(0,100,180,0.12)] rounded-lg text-sm focus:border-[#0099CC] focus:ring-1 focus:ring-[#0099CC] outline-none bg-white cursor-pointer"
                  />
                </div>
                <div className="relative" ref={assigneeDropdownRef}>
                  <label className="block text-xs font-bold text-[#0D1B2A] mb-1.5">담당자</label>
                  <button
                    type="button"
                    onClick={() => setIsAssigneeOpen((prev) => !prev)}
                    className={`w-full px-3 py-2 text-sm rounded-lg border transition flex items-center justify-between cursor-pointer ${
                      isAssigneeOpen
                        ? "bg-[#EEF3FF] border-[#0099CC]/40 shadow-[0_0_0_3px_rgba(0,153,204,0.12)] text-[#0D1B2A]"
                        : "bg-white border-[rgba(0,100,180,0.12)] text-[#0D1B2A] hover:border-[rgba(0,153,204,0.4)]"
                    }`}
                  >
                    <span className="font-medium">{editForm.assignee}</span>
                    <LucideIcon name="chevronDown" size={14} className={`text-[#5A6F8A] transition-transform ${isAssigneeOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isAssigneeOpen && (
                    <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)]">
                      {TEAM_MEMBERS.map((m) => {
                        const isSelected = editForm.assignee === m.name;
                        return (
                          <button
                            key={m.name}
                            type="button"
                            onClick={() => {
                              setEditForm({ ...editForm, assignee: m.name });
                              setIsAssigneeOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-sm text-left flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-[#EEF3FF] text-[#0099CC] font-semibold"
                                : "text-[#0D1B2A] hover:bg-[#F8FAFF]"
                            }`}
                          >
                            <span>{m.name} ({m.role})</span>
                            {isSelected && <LucideIcon name="check" size={14} className="text-[#0099CC]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-[#F8FAFF] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => openDeleteConfirm(selectedItem.id)}
                  className="text-xs font-bold text-[#EF4444] hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <LucideIcon name="trash" size={12} />
                  삭제
                </button>
              </div>

              <div className="flex items-center justify-end gap-3">
                {selectedItem.status === "검증 전" ? (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      className="px-3.5 py-2 text-xs font-semibold text-[#5A6F8A] hover:text-[#0D1B2A] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => handleVerify(selectedItem.id) || setSelectedItem(null)}
                      className="px-5 py-2.5 text-sm font-bold text-white bg-[#0099CC] hover:bg-[#0086b3] rounded-xl shadow-md shadow-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <LucideIcon name="checkCircle" size={14} className="text-white" />
                      검증하기
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      className="px-3.5 py-2 text-xs font-semibold text-[#5A6F8A] hover:text-[#0D1B2A] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => handleApprove(selectedItem.id)}
                      className="px-5 py-2.5 text-sm font-bold text-white bg-[linear-gradient(135deg,#10B981,#0D9488)] hover:brightness-105 rounded-xl shadow-md shadow-emerald-500/25 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <LucideIcon name="zap" size={14} className="text-white" />
                      승인 및 Jira 연동
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedItem && deleteTargetId != null && (
        <div className="fixed inset-0 z-[60] bg-[#0D1B2A]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white shadow-2xl p-5">
            <h4 className="text-base font-bold text-[#0D1B2A]">액션 아이템을 삭제할까요?</h4>
            <p className="text-sm text-[#5A6F8A] mt-2">이 작업은 되돌릴 수 없습니다.</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                className="px-3 py-2 text-sm font-semibold text-[#5A6F8A] hover:text-[#0D1B2A] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-3.5 py-2 text-sm font-bold text-white bg-[#EF4444] hover:bg-[#DC2626] rounded-lg transition-colors cursor-pointer"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 로그인용 가상 회원가입 및 데모체험 모달 */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-[#0D1B2A]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleLogin}
            className="bg-white rounded-2xl max-w-sm w-full border border-[rgba(0,100,180,0.12)] shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="text-center">
              <span className="text-sm font-extrabold text-[#0099CC]">TIKI WORKSPACE</span>
              <h3 className="text-xl font-bold text-[#0D1B2A] mt-1">네오테크 가상 B2B 채널 로그인</h3>
              <p className="text-xs text-[#5A6F8A] mt-1">별도의 회원가입 없이 바로 테스트해보실 수 있습니다.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#0D1B2A] font-semibold mb-1">사내 이메일 주소</label>
                <input
                  type="email"
                  required
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-[rgba(0,100,180,0.12)] rounded-lg text-sm focus:border-[#0099CC] focus:ring-1 focus:ring-[#0099CC] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-[#0D1B2A] font-semibold mb-1">비밀번호</label>
                <input
                  type="password"
                  required
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-[rgba(0,100,180,0.12)] rounded-lg text-sm focus:border-[#0099CC] focus:ring-1 focus:ring-[#0099CC] outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                className="flex-1 py-2 text-sm font-bold text-[#5A6F8A] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                닫기
              </button>
              <button
                type="submit"
                className="flex-1 py-2 text-sm font-bold text-white bg-[#0099CC] hover:bg-[#0086b3] rounded-lg transition-colors shadow-md shadow-cyan-500/10 inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LucideIcon name="zap" size={14} className="text-white" />
                입장 및 시연
              </button>
            </div>
          </form>
        </div>
      )}

      <ToastPopup show={toast.show} message={toast.message} type={toast.type} />

      {!isMobile && <Footer />}
      {isMobile && <MobileTab active={activeTab} onChange={setActiveTab} />}
    </div>
  );
}