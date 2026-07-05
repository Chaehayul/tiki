import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import MobileTab from "../components/MobileTab";
import ToastPopup from "../components/toastpopup";
import { clearAuthSession, getProjectIntegrations, getUploadAnalysis, listProjectMeetings, listUploads } from "../api/apiClient";

/* ─── 데이터 ─────────────────────────────────────────── */
const TX = [
  { time: "00:00", ts: 0,   spk: "김지훈", txt: "안녕하세요, 오늘 Sprint 12 킥오프 회의 시작하겠습니다. AI 회의록 시스템 개발 현황 공유와 이번 스프린트 목표를 논의할 예정입니다." },
  { time: "00:47", ts: 47,  spk: "박소현", txt: "화자 분리 모델 쪽 진행 상황 먼저 공유할게요. 지난주에 Whisper 기반 STT와 PyAnnote를 연동하는 PoC를 완료했습니다." },
  { time: "01:32", ts: 92,  spk: "이민준", txt: "Jira API 연동 PoC는 저번 주 목요일에 완료했습니다. POST /issue 엔드포인트로 업무 발행까지 잘 되는 것 확인했어요." },
  { time: "02:15", ts: 135, spk: "최아로미", txt: "업로드 UI 드래그앤드롭 구현했고, 파일 유효성 검사(확장자/용량)도 프론트에서 처리하도록 했습니다. 사용자 피드백 수집이 다음 단계예요." },
  { time: "03:01", ts: 181, spk: "김지훈", txt: "STT 응답 속도가 현재 이슈인데, 평균 1분 오디오당 처리 시간이 8초 정도 나오고 있어요. 목표치 5초 대비 아직 최적화가 필요합니다." },
  { time: "04:10", ts: 250, spk: "박소현", txt: "화자 분리 정확도는 2명 기준 94%, 4명 이상에서 79%로 떨어지는 문제가 있어요. 추가 학습 데이터가 필요할 것 같습니다." },
  { time: "05:22", ts: 322, spk: "이민준", txt: "백엔드 task_id 폴링 방식은 현재 2초 간격으로 맞춰놨는데, 부하 테스트 결과 동시 요청 50개까지는 안정적이에요." },
  { time: "06:45", ts: 405, spk: "최아로미", txt: "프론트엔드에서 단계별 진행 상황 UI는 완성됐습니다. 업로드 → 전처리 → AI 요약 → 업무 연동 4단계로 사용자에게 명확하게 보여주고 있어요." },
  { time: "07:30", ts: 450, spk: "김지훈", txt: "배포 일정 이야기 해볼게요. 현재 계획은 6월 말인데, QA 기간을 1주 확보하려면 개발 완료를 6월 20일까지는 해야 합니다." },
  { time: "08:15", ts: 495, spk: "박소현", txt: "화자 분리 정확도 개선 작업이 변수입니다. 추가 데이터 수집에 최소 3일은 걸릴 것 같아서 일정이 빠듯할 수 있어요." },
  { time: "09:00", ts: 540, spk: "이민준", txt: "저는 일정 맞출 수 있을 것 같습니다. 다만 오류 핸들링 케이스가 아직 몇 가지 남아있는데, 이번 주 내로 처리할게요." },
  { time: "10:20", ts: 620, spk: "김지훈", txt: "그럼 6월 20일 개발 완료, 6월 21-27일 QA, 6월 28일 배포로 최종 일정을 확정하겠습니다. 다들 동의하시죠?" },
];

const SPK_COLOR = { "김지훈": "#0099CC", "박소현": "#7C3AED", "이민준": "#10B981", "최아로미": "#F59E0B" };

const SPK_ANON_LABEL = (() => {
  const map = {};
  let counter = 1;
  TX.forEach(({ spk }) => { if (!(spk in map)) map[spk] = `팀원${counter++}`; });
  return map;
})();

/* ─── 연동 서비스 데이터 ─────────────────────────────── */
const INITIAL_INTEGRATION_SERVICES = [
  {
    id: "jira",
    name: "Jira",
    iconBg: "#0099CC",
    iconLabel: "J",
    deepLinkBase: "https://your-org.atlassian.net/browse/",
    tickets: [
      { id: "TIKI-101", title: "Jira API 연동 PoC",       assignee: "이민준",  status: "done" },
      { id: "TIKI-98",  title: "STT 응답 스키마 정의",    assignee: "김지훈",  status: "done" },
      { id: "TIKI-95",  title: "업로드 UI 드래그앤드롭",  assignee: "최아로미", status: "done" },
      { id: "TIKI-103", title: "화자 분리 모델 테스트",   assignee: "박소현",  status: "progress" },
      { id: "TIKI-105", title: "QA 테스트 시나리오 작성", assignee: "전체",    status: "todo" },
    ],
  },
  {
    id: "notion",
    name: "Notion",
    iconBg: "#0D1B2A",
    iconLabel: "N",
    deepLinkBase: "https://notion.so/page/",
    tickets: [
      { id: "P-22", title: "Sprint 12 회의록 페이지", assignee: "김지훈", status: "done" },
      { id: "P-21", title: "기술 스펙 문서",          assignee: "박소현", status: "done" },
      { id: "P-20", title: "QA 체크리스트",           assignee: "정다은", status: "progress" },
      { id: "P-19", title: "UI 컴포넌트 가이드",      assignee: "한유진", status: "todo" },
      { id: "P-18", title: "배포 런북",               assignee: "이민준", status: "todo" },
    ],
  },
];

/* 발행 가능한 Action Items */
const ACTION_ITEMS_FOR_ISSUE = [
  { text: "STT 응답 속도 벤치마크 문서 작성",         assignee: "김지훈",  due: "6/18" },
  { text: "화자 분리 모델 정확도 테스트 결과 공유",   assignee: "박소현",  due: "6/20" },
  { text: "업로드 UI 사용자 테스트 세션 진행",        assignee: "최아로미", due: "6/25" },
  { text: "QA 테스트 시나리오 작성",                  assignee: "전체",    due: "미정" },
  { text: "Jira API 오류 핸들링 케이스 처리",         assignee: "이민준",  due: "6/17" },
];

const PARTICIPANTS = [
  { name: "김지훈",  color: "#0099CC", role: "PM" },
  { name: "박소현",  color: "#7C3AED", role: "ML Engineer" },
  { name: "이민준",  color: "#10B981", role: "Backend" },
  { name: "최아로미", color: "#F59E0B", role: "Frontend" },
  { name: "정다은",  color: "#EF4444", role: "QA" },
  { name: "한유진",  color: "#0EA5E9", role: "Designer" },
];

const SUMMARY_DATA = {
  keywords: [
    { text: "STT 파이프라인", type: "cyan" },
    { text: "화자 분리",     type: "cyan" },
    { text: "Jira 연동",    type: "purple" },
    { text: "프롬프트 튜닝", type: "purple" },
    { text: "배포 일정",    type: "green" },
    { text: "API 성능",     type: "yellow" },
  ],
  summary:
    "Sprint 12 킥오프에서는 AI 회의록 시스템의 핵심 구성요소인 STT 파이프라인, 화자 분리, Jira 연동의 진행 상황을 공유했습니다. STT API는 Whisper 기반으로 최종 확정되었으며, 배포 일정은 6월 28일로 조정되었습니다. 일부 성능 최적화와 화자 분리 정확도 개선이 남은 주요 과제로 확인됐습니다.",
  decisions: [
    "STT API는 Whisper 기반으로 최종 결정. 비용 대비 정확도 가장 높음.",
    "배포 6월 28일로 조정. 프론트 팀 QA 기간 1주(6/21–27) 확보.",
    "task_id 폴링 간격 2초 유지. 동시 요청 50개 기준 안정성 확인.",
  ],
  actions: [
    { text: "STT 응답 속도 벤치마크 문서 작성",       assignee: "김지훈",  due: "6/18", status: "todo" },
    { text: "화자 분리 모델 정확도 테스트 결과 공유", assignee: "박소현",  due: "6/20", status: "todo" },
    { text: "Jira API 연동 PoC 완료",                 assignee: "이민준",  due: "6/17", status: "done" },
    { text: "업로드 UI 사용자 테스트 세션 진행",      assignee: "최아로미", due: "6/25", status: "todo" },
  ],
  issues: [
    { level: "high",   text: "STT 처리 속도 8초 → 목표 5초 미달. 최적화 작업 필요." },
    { level: "medium", text: "화자 4명 이상 시 분리 정확도 79%로 저하. 추가 학습 데이터 수집 3일 소요 예상." },
    { level: "low",    text: "오류 핸들링 케이스 미처리 항목 존재. 이번 주 내 완료 예정." },
  ],
  next_agenda: [
    "STT 속도 최적화 결과 리뷰 (김지훈)",
    "화자 분리 정확도 개선 현황 공유 (박소현)",
    "6/20 개발 완료 기준 QA 시나리오 확정",
    "Sprint 12 데모 준비 및 역할 분담",
  ],
};

const SPEEDS = [1.0, 1.25, 1.5, 2.0, 0.75];
const MAX_TS = 4532;
const PAGE_SIZE = 10;
const PROJECTLIST_CHEVRON_COLOR = "#A0AFBF";
const PROJECT_OVERRIDE_STORAGE_KEY = "tiki_project_overrides";
const PROJECT_CATALOG_STORAGE_KEY = "tiki_project_catalog";

/* ─── 유틸 ───────────────────────────────────────────── */
function fmtTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtAuditTime(dateStr) {
  const raw = String(dateStr || "").trim();
  if (!raw) return "";

  const compactMatched = raw.match(/^(\d{2})-(\d{2})\s+\d{2}:\d{2}$/);
  if (compactMatched) {
    const now = new Date();
    const month = Number(compactMatched[1]);
    const day = Number(compactMatched[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${now.getFullYear()}년 ${month}월 ${day}일`;
    }
  }

  const isoMatched = raw.match(/^(\d{4})[-.](\d{1,2})[-.](\d{1,2})(?:\s+\d{1,2}:\d{2})?$/);
  if (isoMatched) {
    const year = Number(isoMatched[1]);
    const month = Number(isoMatched[2]);
    const day = Number(isoMatched[3]);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}년 ${month}월 ${day}일`;
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월 ${parsed.getDate()}일`;
  }

  return raw;
}

function isGeneratedAuditLog(log) {
  return /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(String(log?.time || "").trim());
}

function readProjectOverrides() {
  try {
    const raw = localStorage.getItem(PROJECT_OVERRIDE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readProjectCatalog() {
  try {
    const raw = localStorage.getItem(PROJECT_CATALOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getStoredUserName() {
  try {
    const user = JSON.parse(localStorage.getItem("tiki_user") || "null");
    return String(user?.name || user?.email || "").trim();
  } catch {
    return "";
  }
}

function normalizeMemberName(member) {
  if (typeof member === "string") return member.trim();
  if (!member || typeof member !== "object") return "";
  const inviteStatus = String(member.invite_status || member.inviteStatus || "").trim();
  if (inviteStatus && inviteStatus !== "accepted") return "";
  return String(member.name || member.email || "").trim();
}

function buildAcceptedProjectParticipants({ projectId = "", state = {} } = {}) {
  const names = new Set();
  const add = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized || ["미정", "미지정", "담당자", "담당자 미지정", "회의록", "전체"].includes(normalized)) return;
    names.add(normalized);
  };
  const addParticipants = (values) => {
    if (!Array.isArray(values)) return;
    values.forEach((value) => add(normalizeMemberName(value)));
  };

  const normalizedProjectId = String(projectId || state?.projectId || state?.project?.id || "").trim();
  const overrides = readProjectOverrides();
  const override = normalizedProjectId ? overrides[normalizedProjectId] : null;
  const catalogProject = readProjectCatalog().find((item) => String(item?.id || "") === normalizedProjectId);
  const projectSources = [state?.project, override, catalogProject].filter(Boolean);

  projectSources.forEach((project) => {
    add(project?.teamLead || project?.team_lead);
    addParticipants(project?.admins);
    addParticipants(project?.participants);
    addParticipants(project?.members);
  });

  if (names.size === 0) add(getStoredUserName());
  return [...names];
}

function buildProjectAssigneeOptions({ projectId = "", state = {}, participants = [], actions = [] } = {}) {
  const names = new Set();
  const add = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized || ["미정", "미지정", "담당자", "담당자 미지정", "회의록", "전체"].includes(normalized)) return;
    names.add(normalized);
  };
  const addMany = (values) => {
    if (!Array.isArray(values)) return;
    values.forEach((value) => add(normalizeMemberName(value)));
  };

  const normalizedProjectId = String(projectId || state?.projectId || state?.project?.id || "").trim();
  const overrides = readProjectOverrides();
  const override = normalizedProjectId ? overrides[normalizedProjectId] : null;
  const catalogProject = readProjectCatalog().find((item) => String(item?.id || "") === normalizedProjectId);
  const projectSources = [state?.project, override, catalogProject].filter(Boolean);

  buildAcceptedProjectParticipants({ projectId: normalizedProjectId, state }).forEach(add);
  addMany(participants);
  addMany(state?.projectParticipants);
  projectSources.forEach((project) => {
    add(project?.teamLead || project?.team_lead);
    addMany(project?.participants);
    addMany(project?.admins);
    addMany(project?.members);
  });
  add(getStoredUserName());

  return [...names];
}

function toAuditTimestamp(value) {
  const parsed = new Date(value || Date.now());
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function buildStoredIntegrationLogs({ projectId = "", sourceTitle = "" } = {}) {
  const overrides = readProjectOverrides();
  const normalizedProjectId = String(projectId || "").trim();
  const normalizedSource = String(sourceTitle || "").trim();
  const projects = normalizedProjectId
    ? [[normalizedProjectId, overrides[normalizedProjectId]]]
    : Object.entries(overrides);

  return projects.flatMap(([currentProjectId, projectOverride]) => {
    const items = Array.isArray(projectOverride?.myActionItems) ? projectOverride.myActionItems : [];
    return items
      .filter((item) => item?.integrationTool || item?.externalLink || item?.jiraLink || item?.integrationLinks)
      .filter((item) => {
        const projectMatches = !normalizedProjectId || String(item?.projectId || currentProjectId) === normalizedProjectId;
        const sourceMatches = !normalizedSource || String(item?.source || "").trim() === normalizedSource;
        return projectMatches && sourceMatches;
      })
      .flatMap((item, index) => {
        const links = item?.integrationLinks && typeof item.integrationLinks === "object" ? item.integrationLinks : {};
        const linkedSvcs = Object.entries(links)
          .filter(([, url]) => Boolean(url))
          .map(([svcId]) => String(svcId).toLowerCase())
          .filter((svcId) => svcId === "jira" || svcId === "notion");
        if (linkedSvcs.length === 0) {
          const rawTool = String(item?.integrationTool || item?.integrationProvider || item?.externalLink || item?.jiraLink || "").toLowerCase();
          linkedSvcs.push(rawTool.includes("notion") ? "notion" : "jira");
        }
        return linkedSvcs.map((svcId) => ({
          svcId,
          label: item?.title || item?.text || `대시보드 연동 업무 ${index + 1}`,
          time: toAuditTimestamp(item?.updatedAt || item?.updated_at),
          user: item?.assignee || "담당자",
          source: "dashboard",
        }));
      });
  });
}

function writeProjectOverrides(next) {
  try {
    localStorage.setItem(PROJECT_OVERRIDE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage write failures in local mock mode
  }
}

function buildExternalLink(svcId, title) {
  const text = String(title || "업무").slice(0, 40);
  if (svcId === "notion") return `https://www.notion.so/search?query=${encodeURIComponent(text)}`;
  const params = new URLSearchParams({ jql: `text ~ "${text}"` });
  return `https://jira.atlassian.com/issues/?${params.toString()}`;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateStr(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function parseDateStr(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
}

function buildCalendarGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];

  for (let i = 0; i < startOffset; i++) {
    const day = daysInPrevMonth - startOffset + 1 + i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    cells.push({ day, inMonth: false, dateStr: toDateStr(prevYear, prevMonth, day) });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, inMonth: true, dateStr: toDateStr(year, month, day) });
  }

  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ day: nextDay, inMonth: false, dateStr: toDateStr(nextYear, nextMonth, nextDay) });
    nextDay++;
  }

  return cells;
}

function parseDueToDateStr(due) {
  if (!due) return null;
  const raw = `${due}`.trim();

  const koreanMatched = raw.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
  if (koreanMatched) {
    const year = Number(koreanMatched[1]);
    const month = Number(koreanMatched[2]);
    const day = Number(koreanMatched[3]);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return toDateStr(year, month - 1, day);
    }
  }

  const legacyMatched = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (legacyMatched) {
    const month = Number(legacyMatched[1]);
    const day = Number(legacyMatched[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const now = new Date();
      return toDateStr(now.getFullYear(), month - 1, day);
    }
  }

  return null;
}

function formatDueFromDateStr(dateStr) {
  const parsed = parseDateStr(dateStr);
  if (!parsed) return null;
  return `${parsed.year}년 ${parsed.month + 1}월 ${parsed.day}일`;
}

function normalizeDueLabel(due) {
  if (!due) return due;
  const dateStr = parseDueToDateStr(due);
  if (!dateStr) return due;
  return formatDueFromDateStr(dateStr);
}

function parseNextAgendaItem(rawItem) {
  const raw = `${rawItem || ""}`.trim();
  if (!raw) return { topic: "" };

  const withTrailingAssignee = raw.match(/^(.*)\(([^()]+)\)\s*$/);
  if (withTrailingAssignee) {
    return {
      topic: (withTrailingAssignee[1] || "").trim(),
    };
  }

  const withLeadingAssignee = raw.match(/^([^:]+)\s*:\s*(.+)$/);
  if (withLeadingAssignee) {
    return {
      topic: (withLeadingAssignee[2] || "").trim(),
    };
  }

  return { topic: raw };
}

function normalizeInlineAgendaDateLabel(text) {
  const raw = `${text || ""}`;
  if (!raw) return "";

  return raw.replace(/\b(\d{1,2})\/(\d{1,2})\b/g, (matched, month, day) => {
    const dateStr = parseDueToDateStr(`${month}/${day}`);
    return dateStr ? formatDueFromDateStr(dateStr) : matched;
  });
}

function normalizeFullDateLabel(text) {
  const normalized = normalizeInlineAgendaDateLabel(text);
  return normalized.replace(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, (matched, month, day, offset, input) => {
    const prefix = input.slice(Math.max(0, offset - 8), offset);
    if (/\d{4}년\s*$/.test(prefix)) return matched;
    const dateStr = parseDueToDateStr(`${month}/${day}`);
    return dateStr ? formatDueFromDateStr(dateStr) : matched;
  });
}

function normalizeMobileAgendaDateLabel(text) {
  return normalizeFullDateLabel(text);
}

function formatNextAgendaItem(item, useMobileFormat = false) {
  const topic = (item?.topic || "").trim();
  if (!topic) return "";
  return useMobileFormat ? normalizeMobileAgendaDateLabel(topic) : normalizeInlineAgendaDateLabel(topic);
}

function DueDateCalendar({ value, onSelect, onClose, placement = "bottom" }) {
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const parsedValue = parseDateStr(value) || parseDateStr(todayStr);
  const [viewYear, setViewYear] = useState(parsedValue.year);
  const [viewMonth, setViewMonth] = useState(parsedValue.month);

  useEffect(() => {
    const parsed = parseDateStr(value);
    if (!parsed) return;
    setViewYear(parsed.year);
    setViewMonth(parsed.month);
  }, [value]);

  const cells = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const isTop = placement === "top";

  return (
    <div
      className={`absolute z-20 left-0 w-[280px] max-w-[88vw] box-border overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)] p-3.5 ${isTop ? "bottom-full mb-2" : "top-full mt-2"}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2.5">
        <button
          type="button"
          onClick={() => {
            if (viewMonth === 0) {
              setViewMonth(11);
              setViewYear((y) => y - 1);
            } else {
              setViewMonth((m) => m - 1);
            }
          }}
          className="p-1.5 rounded-lg text-[#5A6F8A] hover:bg-[#F1F4F8] hover:text-[#0D1B2A] transition-colors cursor-pointer"
          aria-label="이전 달"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-sm font-bold text-[#0D1B2A]">{viewYear}년 {viewMonth + 1}월</span>
        <button
          type="button"
          onClick={() => {
            if (viewMonth === 11) {
              setViewMonth(0);
              setViewYear((y) => y + 1);
            } else {
              setViewMonth((m) => m + 1);
            }
          }}
          className="p-1.5 rounded-lg text-[#5A6F8A] hover:bg-[#F1F4F8] hover:text-[#0D1B2A] transition-colors cursor-pointer"
          aria-label="다음 달"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1.5 w-full">
        {WEEKDAY_LABELS.map((label, idx) => (
          <div
            key={label}
            className={`text-center text-[11px] font-semibold py-1 ${
              idx === 0 ? "text-[#EF4444]" : idx === 6 ? "text-[#0099CC]" : "text-[#9AA7B8]"
            }`}
          >
            {label}
          </div>
        ))}

        {cells.map((cell, idx) => {
          const isSelected = cell.dateStr === value;
          const isToday = cell.dateStr === todayStr;
          const weekdayIdx = idx % 7;
          return (
            <button
              key={`${cell.dateStr}-${idx}`}
              type="button"
              onClick={() => {
                onSelect(cell.dateStr);
                onClose();
              }}
              className={`aspect-square w-full flex items-center justify-center text-[13px] rounded-lg transition-colors cursor-pointer ${
                isSelected
                  ? "bg-[#0099CC] text-white font-bold"
                  : !cell.inMonth
                  ? "text-[#C7D1DC] hover:bg-[#F8FAFF]"
                  : isToday
                  ? "text-[#0099CC] font-bold border border-[#0099CC]/40 hover:bg-[#EEF3FF]"
                  : weekdayIdx === 0
                  ? "text-[#EF4444] hover:bg-[#F8FAFF]"
                  : weekdayIdx === 6
                  ? "text-[#0099CC] hover:bg-[#F8FAFF]"
                  : "text-[#0D1B2A] hover:bg-[#F8FAFF]"
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LucideIcon({ name, size = 14, color = "currentColor", strokeWidth = 2, className = "" }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
  };

  switch (name) {
    case "x":
      return <svg {...common}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>;
    case "check":
      return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>;
    case "check-circle":
      return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M9 12.5 11 14.5 15.5 10" /></svg>;
    case "circle":
      return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
    case "arrow-up":
      return <svg {...common}><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></svg>;
    case "alert-triangle":
      return <svg {...common}><path d="M10.29 3.86 1.82 18A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
    case "alert-circle":
      return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>;
    case "info":
      return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M12 10v6" /><path d="M12 7h.01" /></svg>;
    case "clipboard-list":
      return <svg {...common}><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 11h.01" /><path d="M13 11h3" /><path d="M9 16h.01" /><path d="M13 16h3" /></svg>;
    case "rows-3":
      return <svg {...common}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>;
    case "chevron-down":
      return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
    case "star":
      return <svg {...common}><path d="m12 3.5 2.8 5.67 6.25.9-4.52 4.41 1.07 6.22L12 17.76 6.4 20.7l1.07-6.22L2.95 10.07l6.25-.9L12 3.5Z" /></svg>;
    case "star-filled":
      return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={1.5} className={className}><path d="m12 3.5 2.8 5.67 6.25.9-4.52 4.41 1.07 6.22L12 17.76 6.4 20.7l1.07-6.22L2.95 10.07l6.25-.9L12 3.5Z" /></svg>;
    case "square-check":
      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 12.5 10.8 15 16 9.5" /></svg>;
    case "pencil":
      return <svg {...common}><path d="m16.5 3.5 4 4L8 20l-4 1 1-4 11.5-13.5Z" /></svg>;
    case "play":
      return <svg {...common}><path d="m8 6 10 6-10 6V6Z" fill={color} stroke="none" /></svg>;
    case "pause":
      return <svg {...common}><path d="M9 6v12" /><path d="M15 6v12" /></svg>;
    default:
      return null;
  }
}

/* ─── 배지 헬퍼 ──────────────────────────────────────── */
const KW_BADGE = "bg-slate-50 text-slate-600 border border-slate-200";

const ISSUE_CFG = {
  high:   { bg: "bg-red-50",    border: "border-red-200",    icon: "alert-triangle", badge: "bg-red-100 text-red-500",     label: "높음" },
  medium: { bg: "bg-amber-50",  border: "border-amber-200",  icon: "alert-circle",   badge: "bg-amber-100 text-amber-600", label: "보통" },
  low:    { bg: "bg-slate-50",  border: "border-slate-200",  icon: "info",           badge: "bg-slate-100 text-slate-500", label: "낮음" },
};

const ISSUE_LEVEL_TO_LABEL = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const ISSUE_LABEL_TO_LEVEL = {
  높음: "high",
  보통: "medium",
  낮음: "low",
};

const SVC_ISSUE_BTN = {
  jira:   "linear-gradient(135deg,#10B981,#059669)",
  notion: "linear-gradient(135deg,#0D1B2A,#374151)",
};

const SVC_ACCENT = {
  jira:   "#0099CC",
  notion: "#374151",
};

/* ─── Spinner ────────────────────────────────────────── */
function Spinner({ size = 14, color = "#fff" }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: "tiki-spin 0.75s linear infinite", flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" stroke={color} strokeOpacity="0.25" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <style>{`@keyframes tiki-spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

/* ─── 접기/펼치기 섹션 헤더 (AI 요약 내 공통 사용) ───── */
function CollapsibleSectionHeader({ label, collapsed, onToggle, badge }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-2 mb-3 cursor-pointer group"
      aria-expanded={!collapsed}
    >
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">
        {label}
      </span>
      <span className="flex items-center gap-2">
        {badge}
        <span
          className="flex-shrink-0 transition-transform"
          style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <LucideIcon name="chevron-down" size={13} color={PROJECTLIST_CHEVRON_COLOR} strokeWidth={2} />
        </span>
      </span>
    </button>
  );
}

/* ─── 의제 달성률 카드 ──────────────────────────────── */
function AgendaCompletionSection({ actions, onToggleAction }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const total = actions.length;
  const done = actions.filter((action) => action.status === "done").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const achieved = total > 0 && done === total;
  const gaugeColor = achieved ? "#10B981" : "#0099CC";
  const size = 136;
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const remaining = total - done;

  return (
    <section
      className="rounded-2xl bg-white px-5 py-5 md:px-7 md:py-6 overflow-hidden relative"
      style={{ border: "1px solid rgba(0,100,180,0.12)" }}
    >
      <div className="relative flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: gaugeColor }}>
            AGENDA PROGRESS
          </p>
          <p className="text-base md:text-lg font-bold text-slate-900">
            이번 회의, 할 일을 다 끝냈을까?
          </p>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="text-[11px] font-semibold px-3 py-1 rounded-full flex items-center justify-center text-center gap-[2px]"
            style={{
              color: achieved ? "#10B981" : "#0099CC",
              background: achieved ? "rgba(16,185,129,0.12)" : "rgba(0,153,204,0.1)",
            }}
          >
            {achieved && <LucideIcon name="check-circle" size={8} color="#10B981" />}
            {achieved ? "목표 달성" : `${remaining}건 남음`}
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="h-7 px-1 flex items-center justify-center cursor-pointer"
            style={{
              color: achieved ? "#10B981" : "#0099CC",
              background: "transparent",
            }}
            aria-label="의제 진행 접기/펼치기"
          >
            <LucideIcon name="chevron-down" size={12} color={PROJECTLIST_CHEVRON_COLOR} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* "다" 글자 위치에 맞춘 들여쓰기. 도넛↔구분선, 구분선↔액션리스트
          간격을 동일하게 SECTION_GAP(md:gap-10)으로 통일. */}
      {!isCollapsed && (
      <div className="relative flex flex-col md:flex-row md:items-center gap-5 md:gap-30 md:ml-24">
        {/* 좌측 — 도넛 게이지 */}
        <div className="flex items-center gap-5 md:gap-0 md:flex-col md:items-center flex-shrink-0">
          <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              <circle
                cx={size / 2} cy={size / 2} r={radius}
                fill="none" stroke="rgba(0,100,180,0.08)" strokeWidth={stroke}
              />
              <circle
                cx={size / 2} cy={size / 2} r={radius}
                fill="none" stroke={gaugeColor} strokeWidth={stroke}
                strokeDasharray={circumference} strokeDashoffset={offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-extrabold leading-none" style={{ color: gaugeColor }}>{pct}<span className="text-base font-bold">%</span></p>
              <p className="text-[11px] font-semibold text-slate-400 mt-1.5">{done}/{total} 완료</p>
            </div>
          </div>

        </div>

        {/* 구분선 (데스크탑) — 좌우 형제와의 거리는 부모의 gap-10이 동일하게 처리 */}
        <div className="hidden md:block w-px h-32 bg-slate-100 flex-shrink-0" />

        {/* 우측 — 해야 할일 카드 리스트 */}
        <div className="min-w-0 w-full md:max-w-2xl">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-semibold text-slate-400">해야 할 일 상세</p>
            <p className="text-xs text-slate-300">{done}/{total}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {actions.map((action, idx) => {
              const isDone = action.status === "done";
              return (
                <button
                  key={`${action.text}-${idx}`}
                  type="button"
                  onClick={() => onToggleAction(idx)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all hover:-translate-y-0.5 cursor-pointer"
                  style={{
                    borderColor: isDone ? "rgba(16,185,129,0.3)" : "rgba(0,100,180,0.1)",
                    background: isDone ? "rgba(16,185,129,0.06)" : "#fff",
                  }}
                >
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-colors"
                    style={{
                      background: isDone ? "#10B981" : "rgba(0,100,180,0.08)",
                    }}
                  >
                    {isDone ? (
                      <LucideIcon name="check" size={11} color="#fff" />
                    ) : null}
                  </span>
                  <span
                    className={`text-sm font-medium flex-1 min-w-0 truncate ${isDone ? "text-emerald-700 line-through" : "text-slate-700"}`}
                  >
                    {action.text}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      {normalizeDueLabel(action.due) || "미정"}
                    </span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        color: isDone ? "#10B981" : "#5A6F8A",
                        background: isDone ? "rgba(16,185,129,0.1)" : "rgba(90,111,138,0.08)",
                      }}
                    >
                      {action.assignee}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      )}
    </section>
  );
}

/* ─── Modal Wrapper ──────────────────────────────────── */
function Modal({ open, onClose, title, children, footer, maxWidth = 448, bodyOverflowY = "auto", bodyHeight }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center p-4"
      style={{ alignItems: "center", paddingBottom: "76px" }}
    >
      <div
        className="absolute inset-0"
        style={{ backdropFilter: "blur(8px)", background: "rgba(13,27,42,0.4)" }}
        onClick={onClose}
      />
      <div className="relative self-center w-full rounded-2xl bg-white border border-[rgba(0,100,180,0.12)] shadow-[0_18px_50px_rgba(13,27,42,0.22)]" style={{ maxWidth }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,100,180,0.08)]">
          <h3 className="text-base font-bold text-[#0D1B2A]">{title}</h3>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8FAFF] text-[#5A6F8A] flex items-center justify-center">
            <LucideIcon name="x" size={16} />
          </button>
        </div>
        <div className="px-5 py-4" style={{ overflowY: bodyOverflowY, height: bodyHeight }}>{children}</div>
        {footer && <div className="px-5 py-4 border-t border-[rgba(0,100,180,0.08)] flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

function CustomDropdown({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  hasError = false,
  triggerStyle,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(prev => !prev)}
        className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-between gap-2"
        style={{
          borderColor: hasError ? "rgba(239,68,68,0.4)" : "rgba(0,100,180,0.12)",
          background: "#F8FAFF",
          color: value ? "#0D1B2A" : "#9CA3AF",
          fontFamily: "inherit",
          ...(triggerStyle || {}),
        }}
      >
        <span className="truncate">{value || placeholder}</span>
        <span
          className="flex-shrink-0"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transformOrigin: "50% 50%", transition: "transform 0.2s ease" }}
        >
          <LucideIcon name="chevron-down" size={14} color={PROJECTLIST_CHEVRON_COLOR} strokeWidth={2} />
        </span>
      </button>

      {open && !disabled && (
        <div
          className="absolute z-20 bottom-full mb-1 w-full rounded-lg border overflow-hidden max-h-52 overflow-y-auto"
          style={{ borderColor: "rgba(0,100,180,0.12)", background: "#fff", boxShadow: "0 8px 24px rgba(13,27,42,0.12)" }}
        >
          {options.map(option => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                option === value
                  ? "bg-cyan-50 text-cyan-700"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── 연동 서비스 뱃지 (실시간 카운트 반영) ─────────── */
function IntegrationBadge({ svc, onClick, issuedCount }) {
  const done = Math.max(issuedCount ?? 0, 0);
  const hasIssued = done > 0;

  return (
    <button
      onClick={() => onClick(svc)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all hover:scale-105 active:scale-95 cursor-pointer"
      style={{
        background: hasIssued ? "rgba(16,185,129,0.06)" : "rgba(90,111,138,0.06)",
        borderColor: hasIssued ? "rgba(16,185,129,0.35)" : "rgba(0,100,180,0.12)",
      }}
    >
      <span
        className="w-4 h-4 rounded flex items-center justify-center text-white font-bold flex-shrink-0"
        style={{ background: svc.iconBg, fontSize: 9 }}
      >
        {svc.iconLabel}
      </span>
      <span className="text-xs font-semibold text-slate-500">{svc.name}</span>
      <span className="text-xs font-bold" style={{ color: hasIssued ? "#10B981" : "#5A6F8A" }}>
        {hasIssued ? `${done}건 연동` : "연동 전"}
      </span>
      {hasIssued && (
        <span className="text-emerald-500"><LucideIcon name="check" size={12} /></span>
      )}
    </button>
  );
}

/* ─── 서비스 상세 모달 (Deep Link 포함) ─────────────── */
function ServiceDetailModal({ open, onClose, svc, auditLog }) {
  if (!svc) return null;

  const totalTickets = svc.tickets.length;
  const done = Math.min(
    auditLog.filter((log) => log.svcId === svc.id && isGeneratedAuditLog(log)).length,
    totalTickets
  );
  const pct = totalTickets > 0 ? Math.round((done / totalTickets) * 100) : 0;
  const statusLabel = { done: "완료", progress: "진행 중", todo: "대기" };
  const statusCls = {
    done:     "bg-emerald-100 text-emerald-700",
    progress: "bg-amber-100 text-amber-700",
    todo:     "bg-slate-100 text-slate-500",
  };

  const svcLogs = auditLog.filter(l => l.svcId === svc.id);
  const hasIssued = svcLogs.length > 0;
  const normalizeText = (value) => String(value || "").trim().toLowerCase();
  const issuedTicketTitles = new Set(svcLogs.map((log) => normalizeText(log.label)).filter(Boolean));
  const displayTickets = [
    ...svc.tickets.map((ticket) => {
      const isIssued = issuedTicketTitles.has(normalizeText(ticket.title)) || issuedTicketTitles.has(normalizeText(`${ticket.id} · ${ticket.title}`));
      return isIssued ? { ...ticket, status: "done" } : ticket;
    }),
    ...svcLogs
      .filter((log) => !svc.tickets.some((ticket) => normalizeText(ticket.title) === normalizeText(log.label)))
      .map((log, idx) => ({
        id: `${svc.id.toUpperCase()}-${idx + 1}`,
        title: log.label,
        assignee: log.user || "담당자",
        status: "done",
      })),
  ];

  const handleTicketClick = (ticket) => {
    const url = `${svc.deepLinkBase}${ticket.id}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Modal open={open} onClose={onClose} title={`${svc.name} 연동 현황`}>
      <div className="mb-4">
        <div className="flex justify-between mb-1.5">
          <span className="text-xs text-slate-400">실제 발행 이력</span>
          <span className="text-xs font-bold text-slate-900">{hasIssued ? `${svcLogs.length}건 연동` : "연동 전"}</span>
        </div>
      </div>

      {!hasIssued ? (
        <div className="rounded-xl p-4 mb-4 border border-slate-200 bg-slate-50">
          <p className="text-sm font-semibold text-slate-700">아직 {svc.name}로 보낸 업무가 없습니다.</p>
          <p className="text-xs text-slate-400 mt-1">업무 보내기를 실행하면 이곳에 실제 발행 이력이 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
        {displayTickets.map(t => (
          <button
            key={t.id}
            onClick={() => handleTicketClick(t)}
            className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-sm cursor-pointer group ${
              t.status === "done" ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className="flex-shrink-0">
              {t.status === "done" ? (
                <LucideIcon name="check-circle" size={14} color="#10B981" />
              ) : t.status === "progress" ? (
                <Spinner size={14} color="#F59E0B" />
              ) : (
                <LucideIcon name="circle" size={14} color="#94A3B8" />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                <span style={{ color: SVC_ACCENT[svc.id] }}>{t.id}</span>
                <span className="text-slate-400 mx-1">·</span>
                {t.title}
              </p>
              <p className="text-xs text-slate-400">{t.assignee}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusCls[t.status]}`}>
                {statusLabel[t.status]}
              </span>
              <svg
                width="11" height="11" viewBox="0 0 12 12" fill="none"
                className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0"
              >
                <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7M7.5 1H11m0 0v3.5M11 1 5.5 6.5"
                  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>
        ))}
        </div>
      )}

      {svcLogs.length > 0 && (
        <div
          className="rounded-xl p-3 space-y-1.5"
          style={{ background: "rgba(0,153,204,0.04)", border: "1px solid rgba(0,153,204,0.12)" }}
        >
          <p className="text-xs font-semibold text-slate-400 mb-2">발행 이력</p>
          {svcLogs.slice(0, 3).map((log, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-emerald-500 flex-shrink-0"><LucideIcon name="arrow-up" size={12} /></span>
              <span className="text-slate-600 flex-1 truncate">{log.label}</span>
              <span className="text-slate-400 flex-shrink-0">{log.time}</span>
              <span className="text-slate-400 flex-shrink-0">{log.user}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ─── 개별 업무 행 ───────────────────────────────────── */
function IndividualTicketRow({ item, index, assigneeOptions = [] }) {
  const [title, setTitle] = useState(item.text);
  const [assignee, setAssignee] = useState(item.assignee);
  const [due, setDue] = useState(normalizeDueLabel(item.due) || item.due || "미정");
  const [isDueCalendarOpen, setIsDueCalendarOpen] = useState(false);
  const duePickerRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (duePickerRef.current && !duePickerRef.current.contains(event.target)) {
        setIsDueCalendarOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const today = new Date();
  const fallbackDateStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDateStr = parseDueToDateStr(due) || fallbackDateStr;

  return (
    <div
      className="rounded-xl border p-3 space-y-2.5"
      style={{ borderColor: "rgba(0,100,180,0.12)", background: "rgba(248,250,255,0.8)" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#0099CC,#7C3AED)", fontSize: 10 }}
        >
          {index + 1}
        </span>
        <p className="text-xs font-semibold text-slate-500 truncate flex-1">{item.text}</p>
        <span className="text-xs text-slate-400 flex-shrink-0">{due}</span>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-400 block mb-1">업무 제목</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none transition-colors"
          style={{ borderColor: "rgba(0,100,180,0.12)", background: "#fff", color: "#0D1B2A", fontFamily: "inherit" }}
          onFocus={e => (e.target.style.borderColor = "rgba(0,153,204,0.5)")}
          onBlur={e => (e.target.style.borderColor = "rgba(0,100,180,0.12)")}
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-400 block mb-1">담당자</label>
        <CustomDropdown
          value={assignee}
          onChange={setAssignee}
          options={assigneeOptions}
          placeholder="담당자 선택"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-400 block mb-1">마감일</label>
        <div ref={duePickerRef} className="relative" data-due-picker-root>
          <button
            type="button"
            onClick={() => setIsDueCalendarOpen((prev) => !prev)}
            className="w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none transition-colors text-left flex items-center justify-between gap-2 cursor-pointer"
            style={{ borderColor: "rgba(0,100,180,0.12)", background: "#fff", color: "#0D1B2A", fontFamily: "inherit" }}
          >
            <span className={`${due && due !== "미정" ? "text-slate-700" : "text-slate-400"}`}>{due || "마감일"}</span>
            <LucideIcon name="chevron-down" size={12} color={PROJECTLIST_CHEVRON_COLOR} strokeWidth={2} />
          </button>
          {isDueCalendarOpen && (
            <DueDateCalendar
              value={dueDateStr}
              placement="top"
              onSelect={(dateStr) => {
                setDue(formatDueFromDateStr(dateStr) || "미정");
              }}
              onClose={() => setIsDueCalendarOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 2단계 발행 모달 (로딩 스피너 + 에러 핸들링 포함) ─ */
function IssueModal({ open, onClose, onIssued, services, isMobile, assigneeOptions = [] }) {
  const [step, setStep] = useState(1);
  const [selectedSvc, setSelectedSvc] = useState(null);
  const [checkedItems, setCheckedItems] = useState(new Set());
  const [issueMode, setIssueMode] = useState("merged");
  const [desc, setDesc] = useState("회의에서 논의된 항목입니다. 내용을 확인하고 처리해주세요.");
  const [priority, setPriority] = useState("보통");
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [mergedDue, setMergedDue] = useState("미정");
  const [isMergedDueCalendarOpen, setIsMergedDueCalendarOpen] = useState(false);
  const mergedDuePickerRef = useRef(null);

  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState(null);

  const isMultiple = checkedItems.size > 1;
  const canIssue = issueMode !== "merged" || assignee.trim().length > 0;

  const getDueLabel = useCallback((idx) => {
    const baseDue = ACTION_ITEMS_FOR_ISSUE[idx]?.due;
    return normalizeDueLabel(baseDue) || baseDue || "미정";
  }, []);
  const issuedIssueKeySet = useMemo(() => {
    if (!selectedSvc) return new Set();
    if (selectedSvc === "both") return new Set();
    const svc = services.find((item) => item.id === selectedSvc);
    return new Set(
      (svc?.tickets || [])
        .filter((ticket) => ticket.status === "done")
        .map((ticket) => String(ticket.title || "").trim().toLowerCase())
        .filter(Boolean)
    );
  }, [selectedSvc, services]);
  const isIssueItemIssued = useCallback(
    (item) => issuedIssueKeySet.has(String(item?.text || item?.title || "").trim().toLowerCase()),
    [issuedIssueKeySet]
  );

  const reset = () => {
    setStep(1);
    setSelectedSvc(null);
    setCheckedItems(new Set());
    setIssueMode("merged");
    setDesc("회의에서 논의된 항목입니다. 내용을 확인하고 처리해주세요.");
    setPriority("보통");
    setTitle("");
    setAssignee("");
    setMergedDue("미정");
    setIsMergedDueCalendarOpen(false);
    setIssuing(false);
    setIssueError(null);
  };

  useEffect(() => {
    const handleOutside = (event) => {
      if (mergedDuePickerRef.current && !mergedDuePickerRef.current.contains(event.target)) {
        setIsMergedDueCalendarOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    if (step !== 2 || issueMode !== "merged") {
      setIsMergedDueCalendarOpen(false);
    }
  }, [step, issueMode]);

  const handleClose = () => { reset(); onClose(); };

  const toggleItem = (idx) => {
    if (!selectedSvc || isIssueItemIssued(ACTION_ITEMS_FOR_ISSUE[idx])) return;
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const selectableItemIndexes = useMemo(
    () => ACTION_ITEMS_FOR_ISSUE.map((item, idx) => (isIssueItemIssued(item) ? null : idx)).filter((idx) => idx !== null),
    [isIssueItemIssued]
  );
  const allItemsSelected = selectableItemIndexes.length > 0 && checkedItems.size === selectableItemIndexes.length;

  const toggleAllItems = () => {
    if (selectableItemIndexes.length === 0) return;
    setCheckedItems((prev) => {
      if (prev.size === selectableItemIndexes.length) return new Set();
      return new Set(selectableItemIndexes);
    });
  };

  useEffect(() => {
    if (!selectedSvc) return;
    setCheckedItems((prev) => {
      const next = new Set([...prev].filter((idx) => !isIssueItemIssued(ACTION_ITEMS_FOR_ISSUE[idx])));
      return next.size === prev.size ? prev : next;
    });
  }, [isIssueItemIssued, selectedSvc]);

  const goStep2 = () => {
    if (!selectedSvc || checkedItems.size === 0) return;
    const items = [...checkedItems].map((i) => ({
      ...ACTION_ITEMS_FOR_ISSUE[i],
      due: getDueLabel(i),
    }));
    const autoTitle = items.length === 1
      ? items[0].text
      : `${items[0].text} 외 ${items.length - 1}건`;
    const dueCandidates = items
      .map((item) => `${item.due || ""}`.trim())
      .filter((value) => value && value !== "미정");

    const datedCandidates = dueCandidates
      .map((value) => {
        const dateStr = parseDueToDateStr(value);
        if (!dateStr) return null;
        return {
          dateStr,
          label: formatDueFromDateStr(dateStr) || value,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    const defaultMergedDue = datedCandidates.length > 0
      ? datedCandidates[0].label
      : (dueCandidates[0] || "미정");

    setTitle(autoTitle);
    setAssignee(items.length === 1 && items[0].assignee && items[0].assignee !== "미정" ? items[0].assignee : assigneeOptions[0] || "");
    setMergedDue(defaultMergedDue);
    setIssueError(null);
    setStep(2);
  };

  const handleIssue = async () => {
    if (issuing) return;
    if (!canIssue) return;
    setIssuing(true);
    setIssueError(null);

    await new Promise(r => setTimeout(r, 1800));

    const simulateError = false;
    if (simulateError) {
      setIssueError({
        type: "auth",
        message: "API 키가 만료되었습니다. 연동 설정을 확인해주세요.",
      });
      setIssuing(false);
      return;
    }

    const targetSvcIds = selectedSvc === "both"
      ? ["jira", "notion"]
      : [selectedSvc === "notion" ? "notion" : "jira"];
    const svcNames = targetSvcIds.map((svcId) => services.find((s) => s.id === svcId)?.name || svcId);
    const buildIssuedItems = (svcId) => {
      const baseItems = issueMode === "merged"
        ? [{ label: title, user: assignee || "미지정", due: mergedDue }]
        : selectedItemsList.map((item) => ({
          label: item.text,
          user: item.assignee || "미지정",
          due: item.due || "미정",
        }));
      return baseItems.map((item) => ({ ...item, svcId }));
    };
    const issuedPayload = targetSvcIds.flatMap((svcId) => buildIssuedItems(svcId));
    if (issueMode === "merged") {
      onIssued(svcNames, issuedPayload);
    } else {
      onIssued(svcNames, issuedPayload);
    }
    setIssuing(false);
    handleClose();
  };

  const canNext = selectedSvc && checkedItems.size > 0;
  const selectedSvcObj = selectedSvc === "both"
    ? { id: "both", name: "Jira + Notion", iconBg: "#7C3AED", iconLabel: "J+N" }
    : services.find(s => s.id === selectedSvc);
  const selectedSvcIds = selectedSvc === "both"
    ? ["jira", "notion"]
    : selectedSvc ? [selectedSvc] : [];
  const toggleSvc = (svcId) => {
    setSelectedSvc((prev) => {
      const current = prev === "both" ? ["jira", "notion"] : prev ? [prev] : [];
      const next = current.includes(svcId)
        ? current.filter((id) => id !== svcId)
        : [...current, svcId];
      if (next.length === 2) return "both";
      return next[0] || null;
    });
  };
  const selectedItemsList = [...checkedItems].map((i) => ({
    ...ACTION_ITEMS_FOR_ISSUE[i],
    due: getDueLabel(i),
  }));
  const today = new Date();
  const fallbackDateStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const mergedDueDateStr = parseDueToDateStr(mergedDue) || fallbackDateStr;

  return (
    <Modal
      open={open}
      onClose={issuing ? undefined : handleClose}
      title="업무 보내기"
      maxWidth={500}
      bodyOverflowY="auto"
      bodyHeight={isMobile ? "56vh" : "460px"}
      footer={
        step === 1 ? (
          <>
            <button onClick={handleClose} className="text-sm font-semibold px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer">
              취소
            </button>
            <button
              onClick={goStep2}
              disabled={!canNext}
              className="text-sm font-bold px-5 py-2 rounded-xl text-white transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 cursor-pointer"
              style={{ background: "linear-gradient(135deg,#0099CC,#7C3AED)" }}
            >
              다음 →
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => { setStep(1); setIssueError(null); }}
              disabled={issuing}
              className="text-sm font-semibold px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              ← 이전
            </button>
            <button
              onClick={handleIssue}
              disabled={issuing || !canIssue}
              className="text-sm font-bold px-5 py-2 rounded-xl text-white transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
              style={{ background: selectedSvc === "both" ? "linear-gradient(135deg,#0099CC,#7C3AED)" : selectedSvc ? SVC_ISSUE_BTN[selectedSvc] : "#10B981", minWidth: 130 }}
            >
              {issuing ? (
                <>
                  <Spinner size={13} color="#fff" />
                  <span>연동 중...</span>
                </>
              ) : (
                `${selectedSvcObj?.name} 에 생성`
              )}
            </button>
          </>
        )
      }
    >
      {step === 1 && (
        <div
          className="mb-5 rounded-xl px-3 py-2.5"
          style={{ background: "rgba(0,153,204,0.05)", border: "1px solid rgba(0,153,204,0.14)" }}
        >
          <p className="text-xs font-semibold text-slate-600 leading-relaxed">
            회의에서 추출된 업무를 Jira 또는 Notion에 등록할 수 있습니다.
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2.5">어디에 등록할까요?</p>
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
            >
              {[
                ...services,
              ].map(svc => {
                const isSelected = selectedSvcIds.includes(svc.id);
                return (
                  <button
                    key={svc.id}
                    onClick={() => toggleSvc(svc.id)}
                    className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl border transition-all hover:-translate-y-0.5 cursor-pointer"
                    style={{
                      borderColor: isSelected ? "#0099CC" : "rgba(0,100,180,0.12)",
                      background: isSelected
                        ? "rgba(0,153,204,0.06)"
                        : "#fff",
                    }}
                  >
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ background: svc.iconBg }}
                    >
                      {svc.iconLabel}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">{svc.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                보낼 업무 선택
                {checkedItems.size > 0 && (
                  <span className="ml-2 text-cyan-500 normal-case">({checkedItems.size}개 선택됨)</span>
                )}
              </p>
              {ACTION_ITEMS_FOR_ISSUE.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllItems}
                  className="shrink-0 rounded-lg border border-[rgba(0,100,180,0.12)] px-2.5 py-1 text-[11px] font-bold text-[#0099CC] transition hover:bg-[#EEF3FF]"
                >
                  {allItemsSelected ? "전체 해제" : "전체 선택"}
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {ACTION_ITEMS_FOR_ISSUE.map((item, idx) => {
                const checked = checkedItems.has(idx);
                const alreadyIssued = selectedSvc && isIssueItemIssued(item);
                const canSelectItem = Boolean(selectedSvc) && !alreadyIssued;
                return (
                  <div
                    key={idx}
                    onClick={() => toggleItem(idx)}
                    className="flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all"
                    style={{
                      borderColor: alreadyIssued ? "rgba(16,185,129,0.28)" : checked ? "rgba(16,185,129,0.35)" : "rgba(0,100,180,0.12)",
                      background: alreadyIssued ? "#F3FBF7" : checked ? "#F0FDF9" : "#fff",
                      cursor: canSelectItem ? "pointer" : "not-allowed",
                      opacity: !selectedSvc ? 0.6 : 1,
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-all border"
                      style={{
                        background: alreadyIssued || checked ? "#10B981" : "transparent",
                        borderColor: alreadyIssued || checked ? "#10B981" : "rgba(0,100,180,0.2)",
                      }}
                    >
                      {(alreadyIssued || checked) && <LucideIcon name="check" size={10} color="#fff" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm text-slate-800 leading-snug truncate">{item.text}</p>
                        {alreadyIssued && (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            이미 연동됨
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{item.assignee || "미정"} · {getDueLabel(idx)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">

          {issueError && (
            <div
              className="rounded-xl p-3.5 flex items-start gap-3"
              style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <span className="text-red-500 flex-shrink-0 mt-0.5"><LucideIcon name="alert-triangle" size={16} /></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-600 mb-1">연동 오류가 발생했습니다</p>
                <p className="text-xs text-slate-500 leading-relaxed mb-2.5">{issueError.message}</p>
                <button
                  onClick={() => window.open("/settings/integrations", "_blank")}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-all hover:-translate-y-0.5 cursor-pointer"
                  style={{ background: "linear-gradient(135deg,#EF4444,#DC2626)" }}
                >
                  설정으로 이동 →
                </button>
              </div>
            </div>
          )}

          <div
            className="flex rounded-xl p-1 gap-1"
            style={{ background: "rgba(0,100,180,0.06)", border: "1px solid rgba(0,100,180,0.10)" }}
          >
            <button
              onClick={() => setIssueMode("merged")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
              style={{
                background: issueMode === "merged" ? "#fff" : "transparent",
                color: issueMode === "merged" ? "#0099CC" : "#5A6F8A",
                boxShadow: issueMode === "merged" ? "0 1px 4px rgba(0,100,180,0.12)" : "none",
              }}
            >
              <LucideIcon name="clipboard-list" size={13} />
              하나의 업무로 등록
            </button>
            <button
              onClick={() => setIssueMode("individual")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
              style={{
                background: issueMode === "individual" ? "#fff" : "transparent",
                color: issueMode === "individual" ? "#7C3AED" : "#5A6F8A",
                boxShadow: issueMode === "individual" ? "0 1px 4px rgba(0,100,180,0.12)" : "none",
              }}
            >
              <LucideIcon name="rows-3" size={13} />
              각각 등록
              {checkedItems.size > 1 && (
                <span
                  className="ml-1 px-1.5 py-0.5 rounded-full text-white font-bold"
                  style={{ background: "#7C3AED", fontSize: 9 }}
                >
                  {checkedItems.size}
                </span>
              )}
            </button>
          </div>

          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(0,153,204,0.05)", border: "1px solid rgba(0,153,204,0.18)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-5 h-5 rounded flex items-center justify-center text-white font-bold flex-shrink-0"
                style={{ background: selectedSvcObj?.iconBg, fontSize: 9 }}
              >
                {selectedSvcObj?.iconLabel}
              </span>
              <span className="text-xs font-bold" style={{ color: "#0099CC" }}>
                {selectedSvcObj?.name} 생성 예정 · {checkedItems.size}건
                {issueMode === "individual" && (
                  <span className="ml-1.5 text-purple-500">→ {checkedItems.size}개 업무</span>
                )}
              </span>
            </div>
            <div className="space-y-1">
              {selectedItemsList.map((item, i) => (
                <p key={i} className="text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="text-cyan-400">·</span>
                  {item.text}
                  <span className="text-slate-400">({item.assignee || "미정"})</span>
                </p>
              ))}
            </div>
          </div>

          {issueMode === "merged" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">업무 제목</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={issuing}
                  className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none transition-colors disabled:opacity-50"
                  style={{ borderColor: "rgba(0,100,180,0.12)", background: "#F8FAFF", color: "#0D1B2A", fontFamily: "inherit" }}
                  onFocus={e => (e.target.style.borderColor = "rgba(0,153,204,0.5)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(0,100,180,0.12)")}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">설명</label>
                <textarea
                  rows={2}
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  disabled={issuing}
                  className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none resize-none transition-colors disabled:opacity-50"
                  style={{ borderColor: "rgba(0,100,180,0.12)", background: "#F8FAFF", color: "#0D1B2A", fontFamily: "inherit" }}
                  onFocus={e => (e.target.style.borderColor = "rgba(0,153,204,0.5)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(0,100,180,0.12)")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5">담당자</label>
                  <CustomDropdown
                    value={assignee}
                    onChange={setAssignee}
                    options={assigneeOptions}
                    placeholder="담당자 선택"
                    disabled={issuing}
                    hasError={isMultiple && !assignee}
                  />
                  {isMultiple && (
                    <p className="text-xs mt-1" style={{ color: "#EF4444" }}>
                      * 통합 발행 시 대표 담당자를 선택해주세요.
                    </p>
                  )}
                </div>
                <div className="min-w-0">
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5">우선순위</label>
                  <CustomDropdown
                    value={priority}
                    onChange={setPriority}
                    options={["높음", "보통", "낮음"]}
                    placeholder="우선순위 선택"
                    disabled={issuing}
                  />
                </div>
                <div className="min-w-0 col-span-2">
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5">마감일</label>
                  <div ref={mergedDuePickerRef} className="relative" data-due-picker-root>
                    <button
                      type="button"
                      onClick={() => !issuing && setIsMergedDueCalendarOpen((prev) => !prev)}
                      disabled={issuing}
                      className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none transition-colors disabled:opacity-50 text-left flex items-center justify-between gap-2 cursor-pointer"
                      style={{ borderColor: "rgba(0,100,180,0.12)", background: "#F8FAFF", color: "#0D1B2A", fontFamily: "inherit" }}
                    >
                      <span className={`${mergedDue && mergedDue !== "미정" ? "text-slate-700" : "text-slate-400"}`}>{mergedDue || "마감일"}</span>
                      <LucideIcon name="chevron-down" size={12} color={PROJECTLIST_CHEVRON_COLOR} strokeWidth={2} />
                    </button>
                    {isMergedDueCalendarOpen && !issuing && (
                      <DueDateCalendar
                        value={mergedDueDateStr}
                        placement="top"
                        onSelect={(dateStr) => {
                          setMergedDue(formatDueFromDateStr(dateStr) || "미정");
                        }}
                        onClose={() => setIsMergedDueCalendarOpen(false)}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {issueMode === "individual" && (
            <div className="space-y-2.5 overflow-visible pr-0.5">
              <p className="text-xs text-slate-400 leading-relaxed">
                각 항목의 제목과 담당자를 확인하세요. 수정 후 한 번에 발행됩니다.
              </p>
              {selectedItemsList.map((item, i) => (
                <IndividualTicketRow key={i} item={item} index={i} assigneeOptions={assigneeOptions} />
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ─── Regen Modal ────────────────────────────────────── */
function RegenModal({ open, onClose, onRegen }) {
  const [focus, setFocus] = useState("");
  const [prompt, setPrompt] = useState("");
  const [len, setLen] = useState("보통");
  const [showDirectInput, setShowDirectInput] = useState(false);
  const promptRef = useRef(null);
  const FOCUSES = [
    { label: "회의 요약",  val: "회의 전체 요약 위주" },
    { label: "주요 결정",    val: "의사결정 사항 위주" },
    { label: "해야 할 일", val: "해야 할 일과 담당자 위주" },
    { label: "이슈/리스크",  val: "기술적 제약 사항 위주" },
  ];
  const LENS = ["간결", "보통", "상세"];

  useEffect(() => {
    if (showDirectInput && promptRef.current) {
      promptRef.current.focus();
    }
  }, [showDirectInput]);

  useEffect(() => {
    if (!open) {
      setShowDirectInput(false);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI 요약 다시 생성"
      maxWidth={512}
      footer={
        <>
          <button onClick={onClose} className="text-sm font-semibold px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100">
            취소
          </button>
          <button
            onClick={() => {
              onRegen({ focus, prompt, len });
              onClose();
            }}
            className="text-sm font-bold px-5 py-2 rounded-xl text-white hover:-translate-y-0.5 transition-all"
            style={{ background: "linear-gradient(135deg,#7C3AED,#0099CC)" }}
          >
            생성 시작
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-slate-400 leading-relaxed">빠른 선택이나 직접 지시 중 하나를 사용하세요.</p>
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-2.5">무엇을 중심으로 요약할까요?</p>
          <div className="flex flex-wrap gap-2">
            {FOCUSES.map(f => (
              <button
                key={f.val}
                type="button"
                onClick={() => { setFocus(f.val); setPrompt(f.val); setShowDirectInput(false); }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  !showDirectInput && focus === f.val ? "bg-purple-50 text-purple-600 border-purple-300" : "text-slate-400 border-slate-200 hover:border-slate-300"
                }`}
              >
                {f.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setFocus("");
                setPrompt("");
                setShowDirectInput(true);
              }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                showDirectInput ? "bg-cyan-50 text-cyan-600 border-cyan-300" : "text-slate-400 border-slate-200 hover:border-slate-300"
              }`}
            >
              직접 입력
            </button>
          </div>
        </div>
        {showDirectInput && (
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-2">직접 지시</p>
          <div className="relative">
            {!prompt && (
              <p className="pointer-events-none absolute left-4 top-3 text-sm text-slate-300">직접 원하는 방향을 입력하세요.</p>
            )}
            <textarea
              ref={promptRef}
              rows={6}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={`
- 주요 결정과 해야 할 일 중심으로 5줄 이내로 요약해줘
- 회의 결과와 다음에 할 일을 위주로 정리해줘
- 각 이슈에 대한 대응 방향이 보이게 써줘
- 다음 회의 안건까지 포함해서 회의 내용을 정리해줘
- 해야 할 일을 자세히 정리해줘`}
              className={`w-full text-sm rounded-xl px-4 outline-none resize-none placeholder:text-[13px] placeholder:text-slate-300 border border-slate-200 focus:border-cyan-400 bg-slate-50 transition-colors ${prompt ? "py-3" : "pt-9 pb-3"}`}
              style={{ fontFamily: "inherit" }}
            />
          </div>
        </div>
        )}
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-2">요약 길이</p>
          <div className="flex gap-2">
            {LENS.map(l => (
              <button
                key={l}
                onClick={() => setLen(l)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                  len === l ? "bg-cyan-50 text-cyan-600 border-cyan-300" : "text-slate-400 border-slate-200 hover:border-slate-300"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Transcript Card ────────────────────────────────── */
function TxCard({ item, isActive, isBookmarked, isCollapsed, onSeek, onToggleBm }) {
  const col = SPK_COLOR[item.spk] || "#5A6F8A";
  const anonLabel = SPK_ANON_LABEL[item.spk] || item.spk;
  const anonInitial = anonLabel.replace("팀원", "");

  return (
    <div
      className={`group border rounded-2xl transition-all duration-200 ${
        isActive ? "border-cyan-400 bg-blue-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => onSeek(item.ts)}>
        <span className={`text-xs font-semibold w-10 flex-shrink-0 ${isActive ? "text-cyan-500" : "text-slate-400"}`}>
          {item.time}
        </span>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: col }}
        >
          {anonInitial}
        </div>
        <p className="text-xs font-semibold flex-1 min-w-0" style={{ color: col }}>{anonLabel}</p>

        <button
          onClick={e => { e.stopPropagation(); onToggleBm(item.idx); }}
          className={`flex-shrink-0 p-1.5 rounded-lg text-base leading-none transition-opacity ${
            isBookmarked ? "opacity-100 text-amber-400" : "opacity-0 group-hover:opacity-100 text-slate-300 hover:text-amber-400"
          }`}
        >
          {isBookmarked ? <LucideIcon name="star-filled" size={14} /> : <LucideIcon name="star" size={14} />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="px-4 pb-3 pl-[3.75rem]">
          <p className="text-sm text-slate-800 leading-relaxed">{item.txt}</p>
        </div>
      )}
    </div>
  );
}

/* ─── EditableDecision ───────────────────────────────── */
function EditableDecision({ text, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(text);
  return (
    <div className="group p-2.5 rounded-lg hover:bg-blue-50 transition-colors">
      {editing ? (
        <div>
          <textarea
            value={val}
            onChange={e => setVal(e.target.value)}
            rows={2}
            className="w-full border border-cyan-400 rounded-lg px-3 py-2 text-sm outline-none resize-none bg-white"
            style={{ fontFamily: "inherit" }}
          />
          <div className="flex gap-1.5 mt-1.5">
            <button
              onClick={() => {
                const normalized = normalizeFullDateLabel(val);
                setVal(normalized);
                onSave(normalized);
                setEditing(false);
              }}
              className="text-xs font-bold px-2.5 py-1 rounded text-white bg-cyan-500"
            >
              저장
            </button>
            <button
              onClick={() => { setVal(text); setEditing(false); }}
              className="text-xs text-slate-400 px-2.5 py-1 rounded hover:bg-slate-100"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <p className="text-sm text-slate-800 leading-relaxed flex-1">{val}</p>
        </div>
      )}
    </div>
  );
}

/* ─── ActionItem ─────────────────────────────────────── */
function ActionItem({ item, checked, onToggle }) {
  return (
    <div
      className={`group flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${
        checked ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200"
      }`}
      onClick={onToggle}
    >
      <input
        type="checkbox"
        checked={checked}
        onClick={e => e.stopPropagation()}
        onChange={onToggle}
        className={`mt-0.5 flex-shrink-0 ${checked ? "accent-emerald-500" : "accent-cyan-500"}`}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${checked ? "line-through text-slate-400" : "text-slate-800"}`}>
          {item.text}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {item.assignee || "미정"}{checked ? " · 완료" : item.due ? ` · ${normalizeDueLabel(item.due) || item.due}` : ""}
        </p>
      </div>
      {checked && (
        <span className="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-100 text-emerald-600">완료</span>
      )}
    </div>
  );
}

/* ─── 편집 모드 공용 인풋 ─────────────────────────────── */
function EditField({ label, hint, action, children }) {
  return (
    <div>
      {(label || action) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <p className="text-xs font-semibold text-slate-500">{label}</p>}
          {action}
        </div>
      )}
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

const EDIT_INPUT_CLS =
  "w-full text-sm rounded-lg px-3 py-2.5 outline-none border border-slate-200 bg-white transition-colors placeholder:text-slate-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100";

function EditAddButton({ onClick, label = "항목 추가" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-dashed border-slate-300 text-slate-500 hover:border-cyan-300 hover:text-cyan-600 hover:bg-cyan-50/60 transition-colors cursor-pointer"
    >
      <span className="text-sm leading-none">+</span>
      {label}
    </button>
  );
}

function EditRemoveButton({ onClick, label = "삭제" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
    >
      <LucideIcon name="x" size={14} />
    </button>
  );
}

function EditEmptyRow({ children }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 py-3 px-3 text-center text-xs text-slate-400">
      {children}
    </div>
  );
}

function EditSaveButton({ onClick, label = "저장" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg text-white transition-all hover:-translate-y-0.5 cursor-pointer"
      style={{ background: "linear-gradient(135deg,#0099CC,#7C3AED)", boxShadow: "0 4px 12px rgba(0,100,180,0.18)" }}
    >
      <LucideIcon name="check" size={11} color="#fff" />
      {label}
    </button>
  );
}

/* ─── Divider ────────────────────────────────────────── */
function Divider({ label }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-px bg-slate-100" />
      <span className="text-xs font-semibold text-slate-400">{label}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

/* ─── AI Summary Panel ───────────────────────────────── */
function SummaryPanel({ summaryData, onOpenRegen, onSaveSummaryEdit, transcriptVisible, onToggleTranscript, transcriptEnabled, isMobile, summaryCollapsed, onToggleSummary, actions, onToggleAction }) {
  const [decisions, setDecisions] = useState((summaryData.decisions || []).map((item) => normalizeFullDateLabel(item)));
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [keywordsText, setKeywordsText] = useState("");
  const [summaryText, setSummaryText] = useState("");
  const [decisionsDraft, setDecisionsDraft] = useState([]);
  const [actionsDraft, setActionsDraft] = useState([]);
  const [issuesDraft, setIssuesDraft] = useState([]);
  const [nextAgendaDraft, setNextAgendaDraft] = useState([]);
  const [openDuePickerIdx, setOpenDuePickerIdx] = useState(null);

  // 4개 서브 섹션(주요 결정/해야 할 일/이슈&리스크/다음 회의 안건) 개별 접기 상태
  const [collapsedSections, setCollapsedSections] = useState({
    decisions: false,
    actions: false,
    issues: false,
    nextAgenda: false,
  });

  const toggleSection = useCallback((key) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const resetEditDraft = useCallback(() => {
    setKeywordsText((summaryData.keywords || []).map((k) => k.text).join(", "));
    setSummaryText(summaryData.summary || "");
    setDecisionsDraft((summaryData.decisions || []).map((item) => normalizeFullDateLabel(item)));
    setActionsDraft((summaryData.actions || []).map((a) => ({
      ...a,
      due: normalizeDueLabel(a.due),
    })));
    setIssuesDraft((summaryData.issues || []).map((i) => ({ ...i })));
    setNextAgendaDraft(
      (summaryData.next_agenda || []).map((item) => {
        const parsed = parseNextAgendaItem(item);
        return { ...parsed, topic: normalizeFullDateLabel(parsed.topic) };
      })
    );
  }, [summaryData]);

  const buildKeywordItems = useCallback(() => {
    return keywordsText
      .split(/,|\n/)
      .map((v) => v.trim())
      .filter(Boolean)
      .map((text) => ({ text, type: "cyan" }));
  }, [keywordsText]);

  const buildDecisions = useCallback(() => {
    return decisionsDraft
      .map((v) => normalizeFullDateLabel(v || "").trim())
      .filter(Boolean);
  }, [decisionsDraft]);

  const buildActions = useCallback(() => {
    return actionsDraft
      .map((a) => ({
        text: (a.text || "").trim(),
        assignee: (a.assignee || "").trim(),
        due: !a.due || `${a.due}`.trim() === "" || `${a.due}`.trim() === "미정" ? null : `${a.due}`.trim(),
        status: a.status === "done" ? "done" : "todo",
      }))
      .filter((a) => a.text);
  }, [actionsDraft]);

  const buildIssues = useCallback(() => {
    return issuesDraft
      .map((i) => ({
        level: i.level === "high" || i.level === "medium" || i.level === "low" ? i.level : "medium",
        text: (i.text || "").trim(),
      }))
      .filter((i) => i.text);
  }, [issuesDraft]);

  const buildNextAgenda = useCallback(() => {
    return nextAgendaDraft
      .map((v) => formatNextAgendaItem(v, true))
      .filter(Boolean);
  }, [nextAgendaDraft]);

  const persistSummary = useCallback((nextFields) => {
    onSaveSummaryEdit?.({
      ...summaryData,
      ...nextFields,
    });
  }, [onSaveSummaryEdit, summaryData]);

  const handleSaveSection = useCallback((sectionKey) => {
    switch (sectionKey) {
      case "overview":
        persistSummary({
          keywords: buildKeywordItems(),
          summary: summaryText,
        });
        return;
      case "decisions":
        persistSummary({ decisions: buildDecisions() });
        return;
      case "actions":
        persistSummary({ actions: buildActions() });
        return;
      case "issues":
        persistSummary({ issues: buildIssues() });
        return;
      case "nextAgenda":
        persistSummary({ next_agenda: buildNextAgenda() });
        return;
      default:
        return;
    }
  }, [buildActions, buildDecisions, buildIssues, buildKeywordItems, buildNextAgenda, persistSummary, summaryText]);

  const handleInlineDone = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleInlineCancel = useCallback(() => {
    resetEditDraft();
    setIsEditing(false);
  }, [resetEditDraft]);

  useEffect(() => {
    setDecisions((summaryData.decisions || []).map((item) => normalizeFullDateLabel(item)));
  }, [summaryData.decisions]);

  useEffect(() => {
    if (!isEditing) {
      resetEditDraft();
    }
  }, [isEditing, resetEditDraft]);

  useEffect(() => {
    if (openDuePickerIdx === null) return;

    const handleOutsideClick = (event) => {
      if (event.target instanceof Element && event.target.closest("[data-due-picker-root]")) return;
      setOpenDuePickerIdx(null);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openDuePickerIdx]);

  const doneActionsCount = actions.filter((a) => a.status === "done").length;

  return (
    <div className={`bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col ${transcriptVisible ? "h-full" : "h-auto"}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
        <span className="text-sm font-bold text-slate-900">AI 요약</span>
        <div className="flex items-center gap-2 relative">
          {!isMobile && transcriptEnabled && (
            <button
              onClick={onToggleTranscript}
              className={`flex items-center gap-1 text-[5px] font-medium px-1.5 py-0.5 rounded-md border transition-all cursor-pointer leading-none ${
                transcriptVisible
                  ? "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                  : "bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-100"
              }`}
            >
              <svg
                width="9" height="9" viewBox="0 0 14 14" fill="none"
                style={{ transform: transcriptVisible ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.3s ease" }}
              >
                <path d="M9 2H12M9 5H12M9 8H12M2 11H12M2 2H6V8H2V2Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline text-[14px] leading-none">{transcriptVisible ? "스크립트 접기" : "스크립트 펼치기"}</span>
            </button>
          )}
          <div className="relative" data-more-menu-root>
            <button
              onClick={() => setIsMoreOpen(v => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#5A6F8A] hover:text-[#0D1B2A] hover:bg-[#F8FAFF] transition"
              aria-label="요약 메뉴"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="2.75" r="1.1" fill="currentColor" />
              <circle cx="7" cy="7" r="1.1" fill="currentColor" />
              <circle cx="7" cy="11.25" r="1.1" fill="currentColor" />
              </svg>
            </button>
            {isMoreOpen && (
              <div className="absolute right-full mr-1 top-0 z-40 w-28 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_24px_rgba(0,100,180,0.14)]">
                <button
                  onClick={() => {
                    setIsMoreOpen(false);
                    onOpenRegen?.();
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-sm text-[#0D1B2A] hover:bg-[#EEF3FF]"
                >
                  다시 생성
                </button>
                <button
                  onClick={() => {
                    setIsMoreOpen(false);
                    resetEditDraft();
                    setIsEditing(true);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-sm text-[#0D1B2A] hover:bg-[#EEF3FF]"
                >
                  수정
                </button>
              </div>
            )}
          </div>
          {isMobile && (
            <button
              onClick={onToggleSummary}
              className="h-8 w-8 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors flex items-center justify-center"
            >
              <span style={{ transform: summaryCollapsed ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>
                <LucideIcon name="chevron-down" size={14} color={PROJECTLIST_CHEVRON_COLOR} strokeWidth={2} />
              </span>
            </button>
          )}
        </div>
      </div>

      {(!isMobile || !summaryCollapsed) && (
        <div
          className={`px-5 py-5 space-y-6 ${transcriptVisible ? "overflow-y-auto flex-1" : "overflow-visible"}`}
        >
          {isEditing ? (
            <>
              {/* 편집 모드 헤더 */}
              <div
                className="mb-3 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap border"
                style={{
                  background: "linear-gradient(180deg, rgba(0,153,204,0.07), rgba(124,58,237,0.05))",
                  borderColor: "rgba(0,100,180,0.12)",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#0099CC,#7C3AED)" }}
                  >
                    <LucideIcon name="pencil" size={13} color="#fff" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900 leading-tight">AI 요약 수정 중</p>
                    <p className="text-[11px] text-slate-400 leading-tight">저장하면 바로 반영돼요</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleInlineCancel}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleInlineDone}
                    className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg text-white transition-all hover:-translate-y-0.5 cursor-pointer"
                    style={{ background: "linear-gradient(135deg,#0099CC,#7C3AED)", boxShadow: "0 4px 12px rgba(0,100,180,0.18)" }}
                  >
                    <LucideIcon name="check" size={12} color="#fff" />
                    수정 완료
                  </button>
                </div>
              </div>

              {/* 핵심 키워드 + 전체 요약 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-800">핵심 키워드 / 전체 요약</p>
                  <EditSaveButton onClick={() => handleSaveSection("overview")} />
                </div>
                <EditField label="핵심 키워드" hint="쉼표(,)로 구분해서 입력하세요">
                  <input
                    value={keywordsText}
                    onChange={(e) => setKeywordsText(e.target.value)}
                    placeholder="예: STT 파이프라인, 화자 분리, 배포 일정"
                    className={EDIT_INPUT_CLS}
                    style={{ fontFamily: "inherit" }}
                  />
                  {keywordsText.trim() && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {keywordsText.split(/,|\n/).map((v) => v.trim()).filter(Boolean).map((k, i) => (
                        <span key={`${k}-${i}`} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${KW_BADGE}`}>
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </EditField>

                <EditField label="전체 요약">
                  <textarea
                    rows={4}
                    value={summaryText}
                    onChange={(e) => setSummaryText(e.target.value)}
                    placeholder="회의 내용을 한눈에 알 수 있도록 정리해주세요"
                    className={`${EDIT_INPUT_CLS} resize-none leading-relaxed`}
                    style={{ fontFamily: "inherit" }}
                  />
                </EditField>
              </div>

              <Divider label="협업" />

              {/* 주요 결정 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800">주요 결정</p>
                    <span className="text-xs font-semibold text-slate-400">{decisionsDraft.length}건</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <EditAddButton onClick={() => setDecisionsDraft((prev) => [...prev, ""])} />
                    <EditSaveButton onClick={() => handleSaveSection("decisions")} />
                  </div>
                </div>
                <div className="space-y-2">
                  {decisionsDraft.length === 0 && <EditEmptyRow>아직 추가된 결정 사항이 없어요</EditEmptyRow>}
                  {decisionsDraft.map((item, idx) => (
                    <div key={`decision-edit-${idx}`} className="flex items-start sm:items-center gap-2">
                      <span
                        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold mt-2 sm:mt-0"
                        style={{ background: "rgba(0,153,204,0.5)" }}
                      >
                        {idx + 1}
                      </span>
                      <input
                        value={item}
                        onChange={(e) =>
                          setDecisionsDraft((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                        }
                        onBlur={(e) =>
                          setDecisionsDraft((prev) => prev.map((v, i) => (i === idx ? normalizeFullDateLabel(e.target.value) : v)))
                        }
                        className={EDIT_INPUT_CLS}
                        style={{ fontFamily: "inherit" }}
                        placeholder={`주요 결정 ${idx + 1}`}
                      />
                      <EditRemoveButton onClick={() => setDecisionsDraft((prev) => prev.filter((_, i) => i !== idx))} />
                    </div>
                  ))}
                </div>
              </div>

              {/* 해야 할 일 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800">해야 할 일</p>
                    <span className="text-xs font-semibold text-slate-400">{actionsDraft.length}건</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <EditAddButton onClick={() => setActionsDraft((prev) => [...prev, { text: "", assignee: "", due: null, status: "todo" }])} />
                    <EditSaveButton onClick={() => handleSaveSection("actions")} />
                  </div>
                </div>
                <div className="space-y-2.5">
                  {actionsDraft.length === 0 && <EditEmptyRow>아직 추가된 할 일이 없어요</EditEmptyRow>}
                  {actionsDraft.map((item, idx) => {
                    const isDone = item.status === "done";
                    return (
                      <div
                        key={`action-edit-${idx}`}
                        className="rounded-xl border p-3 space-y-2.5 transition-colors"
                        style={{
                          borderColor: isDone ? "rgba(16,185,129,0.3)" : "rgba(0,100,180,0.12)",
                          background: isDone ? "rgba(16,185,129,0.05)" : "#F8FAFF",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            value={item.text || ""}
                            onChange={(e) =>
                              setActionsDraft((prev) => prev.map((v, i) => (i === idx ? { ...v, text: e.target.value } : v)))
                            }
                            className={`${EDIT_INPUT_CLS} bg-white font-medium`}
                            style={{ fontFamily: "inherit" }}
                            placeholder="할 일 내용"
                          />
                          <EditRemoveButton onClick={() => setActionsDraft((prev) => prev.filter((_, i) => i !== idx))} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            value={item.assignee || ""}
                            onChange={(e) =>
                              setActionsDraft((prev) => prev.map((v, i) => (i === idx ? { ...v, assignee: e.target.value } : v)))
                            }
                            className={`${EDIT_INPUT_CLS} bg-white text-xs py-2`}
                            style={{ fontFamily: "inherit" }}
                            placeholder="담당자"
                          />
                          <div className="relative" data-due-picker-root>
                            <button
                              type="button"
                              onClick={() => setOpenDuePickerIdx((prev) => (prev === idx ? null : idx))}
                              className={`${EDIT_INPUT_CLS} bg-white text-xs py-2 text-left flex items-center justify-between gap-2 cursor-pointer`}
                              style={{ fontFamily: "inherit" }}
                            >
                              <span className={`${item.due ? "text-slate-700" : "text-slate-400"}`}>{item.due || "마감일"}</span>
                              <LucideIcon name="chevron-down" size={12} color={PROJECTLIST_CHEVRON_COLOR} strokeWidth={2} />
                            </button>
                            {openDuePickerIdx === idx && (
                              <DueDateCalendar
                                value={parseDueToDateStr(item.due) || toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())}
                                onSelect={(dateStr) => {
                                  setActionsDraft((prev) => prev.map((v, i) => (i === idx ? { ...v, due: formatDueFromDateStr(dateStr) } : v)));
                                }}
                                onClose={() => setOpenDuePickerIdx(null)}
                              />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setActionsDraft((prev) => prev.map((v, i) => (i === idx ? { ...v, status: isDone ? "todo" : "done" } : v)))
                            }
                            className="h-8 px-2.5 flex items-center justify-center text-[10px] font-semibold rounded-md border transition-colors cursor-pointer whitespace-nowrap sm:justify-self-end"
                            style={{
                              borderColor: isDone ? "rgba(16,185,129,0.4)" : "rgba(0,100,180,0.15)",
                              color: isDone ? "#10B981" : "#5A6F8A",
                              background: isDone ? "rgba(16,185,129,0.1)" : "#fff",
                            }}
                          >
                            {isDone ? "완료" : "진행 중"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Divider label="인사이트" />

              {/* 이슈/리스크 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800">이슈 &amp; 리스크</p>
                    <span className="text-xs font-semibold text-slate-400">{issuesDraft.length}건</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <EditAddButton onClick={() => setIssuesDraft((prev) => [...prev, { level: "medium", text: "" }])} />
                    <EditSaveButton onClick={() => handleSaveSection("issues")} />
                  </div>
                </div>
                <div className="space-y-2">
                  {issuesDraft.length === 0 && <EditEmptyRow>아직 등록된 이슈가 없어요</EditEmptyRow>}
                  {issuesDraft.map((item, idx) => {
                    const levelStyles =
                      (item.level || "medium") === "high"
                        ? { background: "#FEF2F2", borderColor: "#FECACA", color: "#EF4444" }
                        : (item.level || "medium") === "low"
                        ? { background: "#F8FAFC", borderColor: "#E2E8F0", color: "#64748B" }
                        : { background: "#FFFBEB", borderColor: "#FDE68A", color: "#D97706" };
                    return (
                      <div key={`issue-edit-${idx}`} className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="w-full sm:w-[92px] flex-shrink-0">
                          <CustomDropdown
                            value={ISSUE_LEVEL_TO_LABEL[item.level || "medium"] || "보통"}
                            onChange={(label) =>
                              setIssuesDraft((prev) =>
                                prev.map((v, i) => (i === idx ? { ...v, level: ISSUE_LABEL_TO_LEVEL[label] || "medium" } : v))
                              )
                            }
                            options={["높음", "보통", "낮음"]}
                            placeholder="보통"
                            triggerStyle={levelStyles}
                          />
                        </div>
                        <input
                          value={item.text || ""}
                          onChange={(e) =>
                            setIssuesDraft((prev) => prev.map((v, i) => (i === idx ? { ...v, text: e.target.value } : v)))
                          }
                          className={EDIT_INPUT_CLS}
                          style={{ fontFamily: "inherit" }}
                          placeholder="이슈/리스크 내용"
                        />
                        <div className="self-end sm:self-auto">
                          <EditRemoveButton onClick={() => setIssuesDraft((prev) => prev.filter((_, i) => i !== idx))} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 다음 회의 안건 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800">다음 회의 안건</p>
                    <span className="text-xs font-semibold text-slate-400">{nextAgendaDraft.length}건</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <EditAddButton onClick={() => setNextAgendaDraft((prev) => [...prev, { topic: "" }])} />
                    <EditSaveButton onClick={() => handleSaveSection("nextAgenda")} />
                  </div>
                </div>
                <div className="space-y-2">
                  {nextAgendaDraft.length === 0 && <EditEmptyRow>다음 회의 안건을 추가해보세요</EditEmptyRow>}
                  {nextAgendaDraft.map((item, idx) => (
                    <div key={`agenda-edit-${idx}`} className="flex items-start gap-2">
                      <span
                        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold bg-cyan-500 mt-2"
                      >
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <input
                          value={item.topic || ""}
                          onChange={(e) =>
                            setNextAgendaDraft((prev) => prev.map((v, i) => (i === idx ? { ...v, topic: e.target.value } : v)))
                          }
                          onBlur={(e) =>
                            setNextAgendaDraft((prev) => prev.map((v, i) => (i === idx ? { ...v, topic: normalizeFullDateLabel(e.target.value) } : v)))
                          }
                          className={`${EDIT_INPUT_CLS} bg-white`}
                          style={{ fontFamily: "inherit" }}
                          placeholder={`다음 회의 안건 ${idx + 1}`}
                        />
                      </div>
                      <div className="self-center">
                        <EditRemoveButton onClick={() => setNextAgendaDraft((prev) => prev.filter((_, i) => i !== idx))} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl p-4 space-y-3 bg-blue-50 border border-blue-100">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">핵심 키워드</p>
                  <div className="flex flex-wrap gap-1.5">
                    {summaryData.keywords.map(k => (
                      <span key={k.text} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${KW_BADGE}`}>
                        {k.text}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="border-t border-blue-100 pt-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">전체 요약</p>
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">{summaryData.summary}</p>
                </div>
              </div>

              <Divider label="협업" />

              {/* 주요 결정 */}
              <div>
                <CollapsibleSectionHeader
                  label="주요 결정"
                  collapsed={collapsedSections.decisions}
                  onToggle={() => toggleSection("decisions")}
                  badge={
                    <span className="text-xs text-slate-300">{decisions.length}건</span>
                  }
                />
                <div
                  style={{
                    maxHeight: collapsedSections.decisions ? 0 : 2000,
                    overflow: "hidden",
                    transition: "max-height 0.25s ease",
                  }}
                >
                  <div className="space-y-1">
                    {decisions.map((d, i) => (
                      <EditableDecision
                        key={i}
                        text={d}
                        onSave={v => setDecisions(prev => prev.map((x, j) => (j === i ? v : x)))}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* 해야 할 일 */}
              <div>
                <CollapsibleSectionHeader
                  label="해야 할 일"
                  collapsed={collapsedSections.actions}
                  onToggle={() => toggleSection("actions")}
                  badge={
                    <span className="text-xs text-slate-300">{doneActionsCount}/{actions.length}</span>
                  }
                />
                <div
                  style={{
                    maxHeight: collapsedSections.actions ? 0 : 2000,
                    overflow: "hidden",
                    transition: "max-height 0.25s ease",
                  }}
                >
                  <div className="space-y-2">
                    {actions.map((a, i) => (
                      <ActionItem
                        key={i}
                        item={a}
                        checked={a.status === "done"}
                        onToggle={() => onToggleAction(i)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <Divider label="인사이트" />

              {/* 이슈 & 리스크 */}
              <div>
                <CollapsibleSectionHeader
                  label="이슈 & 리스크"
                  collapsed={collapsedSections.issues}
                  onToggle={() => toggleSection("issues")}
                  badge={
                    <span className="text-xs text-slate-300">{summaryData.issues.length}건</span>
                  }
                />
                <div
                  style={{
                    maxHeight: collapsedSections.issues ? 0 : 2000,
                    overflow: "hidden",
                    transition: "max-height 0.25s ease",
                  }}
                >
                  <div className="space-y-2">
                    {summaryData.issues.map((iss, i) => {
                      const c = ISSUE_CFG[iss.level];
                      return (
                        <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${c.bg} ${c.border}`}>
                          <span className="flex-shrink-0 mt-0.5">
                            <LucideIcon
                              name={c.icon}
                              size={16}
                              color={iss.level === "high" ? "#EF4444" : iss.level === "medium" ? "#F59E0B" : "#64748B"}
                            />
                          </span>
                          <p className="flex-1 text-sm text-slate-800 leading-relaxed">{iss.text}</p>
                          <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded ${c.badge}`}>{c.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 다음 회의 안건 */}
              <div>
                <CollapsibleSectionHeader
                  label="다음 회의 안건"
                  collapsed={collapsedSections.nextAgenda}
                  onToggle={() => toggleSection("nextAgenda")}
                  badge={
                    <span className="text-xs text-slate-300">{summaryData.next_agenda.length}건</span>
                  }
                />
                <div
                  style={{
                    maxHeight: collapsedSections.nextAgenda ? 0 : 2000,
                    overflow: "hidden",
                    transition: "max-height 0.25s ease",
                  }}
                >
                  <div className="rounded-xl p-3 space-y-2 bg-cyan-50/60 border border-cyan-100">
                    {summaryData.next_agenda.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span
                          className="flex-shrink-0 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center text-white mt-0.5 bg-cyan-500"
                          style={{ fontSize: 10 }}
                        >
                          {i + 1}
                        </span>
                        <p className="text-sm text-slate-800 leading-relaxed">{isMobile ? normalizeMobileAgendaDateLabel(item) : normalizeInlineAgendaDateLabel(item)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryEditModal({ open, onClose, summaryData, onSave }) {
  const [keywordsText, setKeywordsText] = useState("");
  const [summaryText, setSummaryText] = useState("");
  const [decisionsText, setDecisionsText] = useState("");
  const [actionsText, setActionsText] = useState("");
  const [issuesText, setIssuesText] = useState("");
  const [nextAgendaText, setNextAgendaText] = useState("");

  useEffect(() => {
    if (!open) return;

    setKeywordsText((summaryData.keywords || []).map((k) => k.text).join(", "));
    setSummaryText(summaryData.summary || "");
    setDecisionsText((summaryData.decisions || []).join("\n"));
    setActionsText(
      (summaryData.actions || [])
        .map((a) => `${a.text} | ${a.assignee || ""} | ${a.due || "미정"} | ${a.status || "todo"}`)
        .join("\n")
    );
    setIssuesText(
      (summaryData.issues || [])
        .map((i) => `${i.level}: ${i.text}`)
        .join("\n")
    );
    setNextAgendaText((summaryData.next_agenda || []).join("\n"));
  }, [open, summaryData]);

  const handleSave = () => {
    const keywordItems = keywordsText
      .split(/,|\n/)
      .map((v) => v.trim())
      .filter(Boolean)
      .map((text) => ({ text, type: "cyan" }));

    const decisions = decisionsText
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);

    const actions = actionsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [textPart, assigneePart, duePart, statusPart] = line.split("|").map((v) => v.trim());
        const normalizedStatus =
          statusPart === "done" || statusPart === "완료" ? "done" : "todo";

        return {
          text: textPart || "",
          assignee: assigneePart || "",
          due: !duePart || duePart === "미정" ? null : duePart,
          status: normalizedStatus,
        };
      })
      .filter((a) => a.text);

    const issues = issuesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(":");
        const first = (parts[0] || "").trim().toLowerCase();
        const text = (parts.slice(1).join(":") || line).trim();
        const level = first === "high" || first === "medium" || first === "low" ? first : "medium";
        return { level, text };
      })
      .filter((i) => i.text);

    const next_agenda = nextAgendaText
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);

    onSave({
      ...summaryData,
      keywords: keywordItems,
      summary: summaryText,
      decisions,
      actions,
      issues,
      next_agenda,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI 요약 전체 수정"
      maxWidth={680}
      footer={
        <>
          <button onClick={onClose} className="text-sm font-semibold px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100">
            취소
          </button>
          <button
            onClick={handleSave}
            className="text-sm font-bold px-5 py-2 rounded-xl text-white hover:-translate-y-0.5 transition-all"
            style={{ background: "linear-gradient(135deg,#0099CC,#7C3AED)" }}
          >
            저장
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-1.5">핵심 키워드 (쉼표로 구분)</p>
          <input
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            className="w-full text-sm rounded-xl px-4 py-2.5 outline-none border border-slate-200 focus:border-cyan-400 bg-slate-50 transition-colors"
            style={{ fontFamily: "inherit" }}
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 mb-1.5">전체 요약</p>
          <textarea
            rows={4}
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
            className="w-full text-sm rounded-xl px-4 py-3 outline-none resize-none border border-slate-200 focus:border-cyan-400 bg-slate-50 transition-colors"
            style={{ fontFamily: "inherit" }}
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 mb-1.5">주요 결정 (줄바꿈 구분)</p>
          <textarea
            rows={4}
            value={decisionsText}
            onChange={(e) => setDecisionsText(e.target.value)}
            className="w-full text-sm rounded-xl px-4 py-3 outline-none resize-none border border-slate-200 focus:border-cyan-400 bg-slate-50 transition-colors"
            style={{ fontFamily: "inherit" }}
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 mb-1.5">해야 할 일 (한 줄당: 내용 | 담당자 | 마감일 | 상태(todo/done))</p>
          <textarea
            rows={5}
            value={actionsText}
            onChange={(e) => setActionsText(e.target.value)}
            className="w-full text-sm rounded-xl px-4 py-3 outline-none resize-none border border-slate-200 focus:border-cyan-400 bg-slate-50 transition-colors"
            style={{ fontFamily: "inherit" }}
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 mb-1.5">이슈/리스크 (한 줄당: high|medium|low: 내용)</p>
          <textarea
            rows={4}
            value={issuesText}
            onChange={(e) => setIssuesText(e.target.value)}
            className="w-full text-sm rounded-xl px-4 py-3 outline-none resize-none border border-slate-200 focus:border-cyan-400 bg-slate-50 transition-colors"
            style={{ fontFamily: "inherit" }}
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 mb-1.5">다음 회의 안건 (줄바꿈 구분)</p>
          <textarea
            rows={4}
            value={nextAgendaText}
            onChange={(e) => setNextAgendaText(e.target.value)}
            className="w-full text-sm rounded-xl px-4 py-3 outline-none resize-none border border-slate-200 focus:border-cyan-400 bg-slate-50 transition-colors"
            style={{ fontFamily: "inherit" }}
          />
        </div>
      </div>
    </Modal>
  );
}

/* ─── Audio Player ───────────────────────────────────── */
function AudioPlayer({ curTime, playing, spdIdx, onSeek, onTogglePlay, onCycleSpeed, bottomOffset = 0 }) {
  const pct = (curTime / MAX_TS) * 100;
  return (
    <div
      className="fixed left-0 right-0 z-30 px-4 md:px-8 py-3 bg-white/95 backdrop-blur-md border-t border-slate-100"
      style={{ bottom: bottomOffset }}
    >
      <div className="max-w-screen-xl mx-auto flex items-center gap-3 md:gap-4">
        <button
          onClick={onTogglePlay}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0 hover:scale-105 active:scale-95 transition-transform"
          style={{ background: "linear-gradient(135deg,#0099CC,#7C3AED)" }}
        >
          {playing ? <LucideIcon name="pause" size={14} color="#fff" /> : <LucideIcon name="play" size={14} color="#fff" />}
        </button>
        <span className="text-xs font-semibold text-slate-400 flex-shrink-0 hidden sm:block">
          {fmtTime(curTime)} / <span className="text-slate-300">1:15:32</span>
        </span>
        <div className="flex-1 relative h-3 flex items-center">
          <div className="absolute inset-y-0 flex items-center w-full">
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: "linear-gradient(90deg,#0099CC,#7C3AED)" }}
              />
            </div>
          </div>
          <input
            type="range" min={0} max={MAX_TS} value={curTime}
            onChange={e => onSeek(parseInt(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-3"
          />
        </div>
        <button
          onClick={onCycleSpeed}
          className="text-xs font-bold py-1 rounded-lg flex-shrink-0 text-center bg-cyan-50 text-cyan-600 w-12"
        >
          {SPEEDS[spdIdx]}×
        </button>
        <div className="hidden md:block text-right flex-shrink-0">
          <p className="text-xs font-semibold text-slate-800">sprint12_kickoff.m4a</p>
          <p className="text-xs text-slate-400">234.7 MB</p>
        </div>
      </div>
    </div>
  );
}

/* ─── 연동 컨트롤 타워 ───────────────────────────────── */
// Replaces the old IntegrationControlTower's fake "업무 보내기"/simulated issue
// count with the same real, project-level connection status already shown on
// Dashboard.jsx/ProjectMeetings.jsx — sync itself is automatic (see
// external_integration_service.sync_connected_meeting_resources), so there is
// nothing to manually "send" here anymore.
function RealIntegrationStatus({ connectedProviders, onManage }) {
  const jiraConnected = Boolean(connectedProviders?.jira);
  const notionConnected = Boolean(connectedProviders?.notion);
  return (
    <div
      className="lg:w-auto flex-shrink-0 rounded-2xl px-4 py-4 flex flex-wrap items-center gap-3"
      style={{ border: "1px solid rgba(0,100,180,0.12)", background: "rgba(0,153,204,0.03)" }}
    >
      <p className="text-xs font-semibold text-slate-400">연동 현황</p>
      <span
        className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
        style={{
          background: jiraConnected ? "rgba(16,185,129,0.1)" : "rgba(90,111,138,0.08)",
          color: jiraConnected ? "#10B981" : "#5A6F8A",
        }}
      >
        Jira {jiraConnected ? "연동됨" : "미연동"}
      </span>
      <span
        className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
        style={{
          background: notionConnected ? "rgba(16,185,129,0.1)" : "rgba(90,111,138,0.08)",
          color: notionConnected ? "#10B981" : "#5A6F8A",
        }}
      >
        Notion {notionConnected ? "연동됨" : "미연동"}
      </span>
      {!(jiraConnected && notionConnected) && (
        <button
          type="button"
          onClick={onManage}
          className="text-xs font-bold text-[#0099CC] hover:underline cursor-pointer"
        >
          프로젝트 설정에서 연동하기
        </button>
      )}
    </div>
  );
}

function IntegrationControlTower({ services, auditLog, onBadgeClick, onIssueOpen, isMobile }) {
  const generatedLogs = auditLog.filter(isGeneratedAuditLog);
  const generatedCountByService = generatedLogs.reduce((acc, log) => {
    if (!log?.svcId) return acc;
    acc[log.svcId] = (acc[log.svcId] || 0) + 1;
    return acc;
  }, {});
  const totalDone = generatedLogs.length;
  const latestGeneratedLog = generatedLogs[generatedLogs.length - 1] || null;
  const hasGenerated = Boolean(latestGeneratedLog);

  return (
    <div
      className="lg:w-auto flex-shrink-0 rounded-2xl px-4 py-4"
      style={{ border: "1px solid rgba(0,100,180,0.12)", background: "rgba(0,153,204,0.03)" }}
    >
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-slate-400">연동 서비스 현황</p>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              background: hasGenerated ? "rgba(16,185,129,0.1)" : "rgba(90,111,138,0.08)",
              color: hasGenerated ? "#10B981" : "#5A6F8A",
            }}
          >
            {hasGenerated ? `${totalDone}건 연동 완료` : "연동 전"}
          </span>
        </div>

        {!isMobile && latestGeneratedLog && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: "#10B981" }}
            />
            <span className="text-xs text-slate-400">
              최근 생성일:&nbsp;
              <span className="font-semibold text-slate-600">{fmtAuditTime(latestGeneratedLog.time)}</span>
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {services.map(svc => (
          <IntegrationBadge
            key={svc.id}
            svc={svc}
            onClick={onBadgeClick}
            issuedCount={generatedCountByService[svc.id] || 0}
          />
        ))}

        <div className="hidden sm:block w-px h-5 bg-slate-200 mx-1" />

        <IssueButton onClick={onIssueOpen} />
      </div>

      {isMobile && latestGeneratedLog && (
        <p className="text-xs text-slate-400 mt-2.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          최근 생성일: <span className="font-semibold text-slate-600">{fmtAuditTime(latestGeneratedLog.time)}</span>
        </p>
      )}
    </div>
  );
}

function IssueButton({ onClick, issuingGlobal = false }) {
  return (
    <button
      onClick={onClick}
      disabled={issuingGlobal}
      className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-white text-xs font-bold transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 cursor-pointer"
      style={{
        background: "linear-gradient(135deg,#0099CC,#7C3AED)",
        borderRadius: "10px",
        minWidth: 100,
      }}
    >
      {issuingGlobal ? (
        <>
          <Spinner size={12} color="#fff" />
          <span>연동 중...</span>
        </>
      ) : (
        <>
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
          업무 보내기
        </>
      )}
    </button>
  );
}

/* ─── Main App ───────────────────────────────────────── */
export default function TikiSprint12() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [curTime, setCurTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [spdIdx, setSpdIdx] = useState(0);
  const [bookmarks, setBookmarks] = useState(new Set());
  const [collapsedSet, setCollapsedSet] = useState(new Set());
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [bmFilter, setBmFilter] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const [services, setServices] = useState(INITIAL_INTEGRATION_SERVICES);
  const [auditLog, setAuditLog] = useState([]);

  const [connectedProviders, setConnectedProviders] = useState({ jira: false, notion: false });
  useEffect(() => {
    const projectId = location?.state?.projectId || searchParams.get("projectId");
    if (!projectId) return;
    getProjectIntegrations(projectId)
      .then((result) => setConnectedProviders({
        jira: Boolean(result?.jira?.connected),
        notion: Boolean(result?.notion?.connected),
      }))
      .catch(() => setConnectedProviders({ jira: false, notion: false }));
  }, [location?.state, searchParams]);
  const mergedAuditLog = useMemo(() => {
    const state = location?.state || {};
    const storedLogs = buildStoredIntegrationLogs({
      projectId: state.projectId,
      sourceTitle: state.meeting?.title || state.title || "",
    });
    const seen = new Set();
    return [...auditLog, ...storedLogs].filter((log) => {
      const key = `${log.svcId}|${log.label}|${log.user || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [auditLog, location?.state]);
  const [summaryActions, setSummaryActions] = useState(() =>
    SUMMARY_DATA.actions.map((action) => ({ ...action }))
  );
  const [summaryData, setSummaryData] = useState(() => ({
    ...SUMMARY_DATA,
    keywords: SUMMARY_DATA.keywords.map((k) => ({ ...k })),
    decisions: [...SUMMARY_DATA.decisions],
    actions: SUMMARY_DATA.actions.map((a) => ({ ...a })),
    issues: SUMMARY_DATA.issues.map((i) => ({ ...i })),
    next_agenda: [...SUMMARY_DATA.next_agenda],
  }));

  // Real per-meeting data. Falls back to the placeholder TX/SUMMARY_DATA above
  // (used previously for every meeting regardless of what was actually uploaded)
  // until the matching upload's AI analysis loads.
  const [txSource, setTxSource] = useState(TX);
  const [meetingHeader, setMeetingHeader] = useState(null);
  const [realDataStatus, setRealDataStatus] = useState("idle"); // idle | loading | loaded | missing
  // Set when both Groq and OpenAI failed and the backend fell back to a
  // rule-based heuristic summary (see LangChainAnalysisService.summarize_and_extract_tickets) —
  // the content is a best-effort stand-in, not a real AI analysis, so it needs review.
  const [analysisDegraded, setAnalysisDegraded] = useState(false);
  // Whether the underlying source actually had audio (real speaker/timestamp
  // dialogue) vs. a document/direct-write meeting with no such thing. Defaults
  // to true only until the real fetch below resolves and overrides it — see
  // `transcriptEnabled` further down, which used to guess this from
  // navigation-state hints that are never actually populated on a normal
  // click-through, silently defaulting to "audio" for every meeting.
  const [sourceIsAudio, setSourceIsAudio] = useState(true);

  useEffect(() => {
    const state = location?.state || {};
    // location.state only survives an in-app navigation (clicking through from
    // the meeting list) — a refresh, direct URL visit, or reopened bookmark
    // loses it entirely, which used to fall back straight to the placeholder
    // content with no way to recover. Fall back to the URL's query params
    // instead, and mirror state into the URL below so a refresh keeps working.
    const meetingId = state.meetingId || searchParams.get("meetingId");
    const projectId = state.projectId || searchParams.get("projectId");
    if (!meetingId || !projectId) {
      setRealDataStatus("missing");
      return undefined;
    }
    if (state.meetingId && state.projectId && (searchParams.get("meetingId") !== state.meetingId || searchParams.get("projectId") !== state.projectId)) {
      const next = new URLSearchParams(searchParams);
      next.set("meetingId", state.meetingId);
      next.set("projectId", state.projectId);
      setSearchParams(next, { replace: true });
    }

    let cancelled = false;
    setRealDataStatus("loading");

    const normalizeAction = (item) => ({
      text: String(item?.text || item?.title || item?.description || "").trim(),
      assignee: item?.assignee || "미정",
      due: item?.due || item?.due_at || "",
      status: item?.status === "완료" || item?.status === "done" ? "done" : "todo",
    });

    (async () => {
      try {
        const uploads = await listUploads({ project_id: projectId });
        const match = (Array.isArray(uploads) ? uploads : []).find(
          (file) => String(file?.meeting_id || "") === String(meetingId)
        );

        if (!match) {
          // Not every meeting comes from a file upload — one created via
          // "회의록 직접 작성" has real summary/action_items straight on the
          // Meeting record but no uploaded_file/analysis_result to look up here.
          // Fall back to the meeting itself instead of declaring it "missing".
          const meetings = await listProjectMeetings(projectId).catch(() => []);
          const meeting = (Array.isArray(meetings) ? meetings : []).find(
            (m) => String(m?.id || "") === String(meetingId)
          );
          if (!meeting) {
            if (!cancelled) setRealDataStatus("missing");
            return;
          }
          if (cancelled) return;
          // No file was ever uploaded/transcribed for this meeting, so there is
          // no real transcript — clear the placeholder script rather than show
          // fake dialogue alongside the real summary/action items above.
          setTxSource([]);
          setSourceIsAudio(false);

          const rawItems = Array.isArray(meeting.action_items) ? meeting.action_items : [];
          // "회의록 직접 작성" stores the structured summary (keywords/decisions/
          // issues/next agenda) in a hidden __tiki_meeting_meta marker item
          // inside action_items, not as separate Meeting columns — pull it out
          // here rather than showing it as a blank to-do row.
          const metaItem = rawItems.find((item) => item?.__tiki_meta || item?.type === "__tiki_meeting_meta");
          const visibleItems = rawItems.filter((item) => !(item?.__tiki_meta || item?.type === "__tiki_meeting_meta"));
          const metaData = metaItem?.data || {};
          const priorityToLevel = { 높음: "high", 보통: "medium", 낮음: "low" };

          setSummaryData((prev) => ({
            ...prev,
            summary: metaData.summary || meeting.summary || prev.summary,
            keywords: Array.isArray(metaData.keywords) && metaData.keywords.length
              ? metaData.keywords.map((kw) => ({ text: kw, type: "cyan" }))
              // Older manually-written meetings (before the meta marker existed)
              // never got a keywords list, but the meeting's own tags are
              // effectively the same thing — use those instead of showing blank.
              : Array.isArray(meeting.tags) && meeting.tags.length
                ? meeting.tags.map((tag) => ({ text: String(tag || "").replace(/^#/, ""), type: "cyan" })).filter((k) => k.text)
                : [],
            decisions: Array.isArray(metaData.decisions) && metaData.decisions.length
              ? metaData.decisions.map((d) => (typeof d === "string" ? d : d?.text || "")).filter(Boolean)
              : [],
            issues: Array.isArray(metaData.issues) && metaData.issues.length
              ? metaData.issues.map((i) => ({ level: priorityToLevel[i?.priority] || "medium", text: i?.text || "" })).filter((i) => i.text)
              : [],
            next_agenda: typeof metaData.nextAgenda === "string" && metaData.nextAgenda.trim()
              ? metaData.nextAgenda.split("\n").map((line) => line.replace(/^-\s*/, "").trim()).filter(Boolean)
              : [],
          }));
          if (visibleItems.length > 0) {
            setSummaryActions(visibleItems.map(normalizeAction));
          }
          setMeetingHeader({ title: meeting.title || "", date: meeting.date || "" });
          setAnalysisDegraded(false);
          setRealDataStatus("loaded");
          return;
        }

        const analysis = await getUploadAnalysis(match.id);
        if (cancelled || !analysis) return;

        // Document uploads (docx/hwp/txt/pdf) go through the same pipeline as
        // audio and get synthetic "script" rows built by splitting sentences —
        // fabricated speaker labels and timestamps with no real dialogue behind
        // them. Only actually-transcribed audio (extraction_method "whisper")
        // should render as a speaker/timestamp script.
        const isAudio = analysis.extraction_method === "whisper";
        setSourceIsAudio(isAudio);
        if (isAudio && Array.isArray(analysis.tx) && analysis.tx.length > 0) {
          setTxSource(analysis.tx);
        } else {
          setTxSource([]);
        }
        setSummaryData((prev) => ({
          ...prev,
          summary: analysis.summary || prev.summary,
          keywords: Array.isArray(analysis.keywords) && analysis.keywords.length ? analysis.keywords : prev.keywords,
          decisions: Array.isArray(analysis.decisions) && analysis.decisions.length ? analysis.decisions : prev.decisions,
          issues: Array.isArray(analysis.issues) && analysis.issues.length ? analysis.issues : prev.issues,
          next_agenda: Array.isArray(analysis.next_agenda) && analysis.next_agenda.length ? analysis.next_agenda : prev.next_agenda,
        }));
        if (Array.isArray(analysis.action_items) && analysis.action_items.length > 0) {
          setSummaryActions(analysis.action_items.map(normalizeAction));
        }
        setMeetingHeader({
          title: analysis.meeting_title || state.meeting?.title || "",
          date: state.meeting?.date || "",
        });
        if (!cancelled) setAnalysisDegraded(analysis?.extra_data?.analysis_provider === "heuristic");
        if (!cancelled) setRealDataStatus("loaded");
      } catch {
        if (!cancelled) setRealDataStatus("missing");
      } finally {
        if (!cancelled) setTranscriptLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location?.state]);
  const issueAssigneeOptions = useMemo(() => {
    const state = location?.state || {};
    return buildProjectAssigneeOptions({
      projectId: state.projectId,
      state,
      participants: state.meeting?.participants,
      actions: Array.isArray(state.actions) ? state.actions : [],
    });
  }, [location?.state]);

  const [modal, setModal] = useState(null);
  const [detailSvc, setDetailSvc] = useState(null);
  const [issueOpen, setIssueOpen] = useState(false);

  const [transcriptVisible, setTranscriptVisible] = useState(true);
  const [transcriptLoading, setTranscriptLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("reports");
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem("tiki_access_token")));
  const [sessionUser, setSessionUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("tiki_user") || "null");
    } catch {
      return null;
    }
  });
  const timerRef = useRef(null);
  const isAnyModalOpen = Boolean(modal || detailSvc || issueOpen);

  const uploadKind = useMemo(() => {
    const state = location?.state || {};
    const params = new URLSearchParams(location?.search || "");

    const getExt = (value) => {
      const raw = String(value || "").trim().toLowerCase();
      if (!raw.includes(".")) return "";
      return raw.split(".").pop();
    };

    const audioExt = ["mp3", "wav", "m4a", "aac", "ogg", "flac", "webm"];
    const textExt = ["txt", "md", "doc", "docx", "pdf", "rtf", "hwp", "hwpx"];

    const directCandidates = [
      state.uploadKind,
      state.uploadType,
      state.fileKind,
      state.fileType,
      state.sourceType,
      params.get("uploadKind"),
      params.get("uploadType"),
      params.get("fileKind"),
      params.get("fileType"),
      params.get("sourceType"),
    ]
      .map((v) => String(v || "").trim().toLowerCase())
      .filter(Boolean);

    const hasAudioDirect = directCandidates.some((v) => ["audio", "voice", "speech"].includes(v));
    if (hasAudioDirect) return "audio";

    const hasTextDirect = directCandidates.some((v) => ["text", "transcript", "document", "doc", "file"].includes(v));
    if (hasTextDirect) return "text";

    const mimeCandidates = [
      state.mimeType,
      state.contentType,
      state.fileMime,
      params.get("mimeType"),
      params.get("contentType"),
      params.get("fileMime"),
    ]
      .map((v) => String(v || "").trim().toLowerCase())
      .filter(Boolean);

    if (mimeCandidates.some((v) => v.startsWith("audio/"))) return "audio";
    if (mimeCandidates.some((v) => v.startsWith("text/") || v.includes("pdf") || v.includes("word") || v.includes("document"))) return "text";

    const fileNameCandidates = [
      state.fileName,
      state.uploadedFileName,
      state.sourceFileName,
      params.get("fileName"),
      params.get("uploadedFileName"),
      params.get("sourceFileName"),
    ]
      .map((v) => String(v || "").trim().toLowerCase())
      .filter(Boolean);

    const stateFileLists = [state.files, state.uploadedFiles, state.sourceFiles]
      .filter(Array.isArray)
      .flat()
      .map((f) => {
        if (!f) return "";
        if (typeof f === "string") return f;
        return f.name || f.fileName || "";
      })
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());

    for (const fileName of [...fileNameCandidates, ...stateFileLists]) {
      const ext = getExt(fileName);
      if (audioExt.includes(ext)) return "audio";
      if (textExt.includes(ext)) return "text";
    }

    return "audio";
  }, [location?.search, location?.state]);

  const transcriptEnabled = sourceIsAudio;
  const transcriptVisibleResolved = transcriptEnabled && transcriptVisible;

  const stateLabels = {
    IDLE: "대기",
    UPLOADING: "업로드 중",
    PROCESSING: "처리 중",
    COMPLETED: "완료",
    FAILED: "실패",
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!transcriptEnabled) {
      setTranscriptVisible(false);
      setTranscriptLoading(false);
      return;
    }

    setTranscriptLoading(true);
    const timer = setTimeout(() => setTranscriptLoading(false), 1800);
    return () => clearTimeout(timer);
  }, [transcriptEnabled]);

  useEffect(() => {
    const syncAuthSession = () => {
      setIsAuthenticated(Boolean(localStorage.getItem("tiki_access_token")));
      try {
        setSessionUser(JSON.parse(localStorage.getItem("tiki_user") || "null"));
      } catch {
        setSessionUser(null);
      }
    };
    window.addEventListener("storage", syncAuthSession);
    window.addEventListener("tiki-auth-changed", syncAuthSession);

    return () => {
      window.removeEventListener("storage", syncAuthSession);
      window.removeEventListener("tiki-auth-changed", syncAuthSession);
    };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (isAnyModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = previousOverflow || "";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAnyModalOpen]);

  const showToast = useCallback((message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type }), 2200);
  }, []);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setCurTime(t => {
          const next = t + SPEEDS[spdIdx];
          if (next >= MAX_TS) { setPlaying(false); return MAX_TS; }
          return next;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [playing, spdIdx]);

  const seekTo = useCallback((ts) => {
    setCurTime(ts);
    if (!playing) setPlaying(true);
  }, [playing]);

  const toggleBm = useCallback((idx) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }, []);

  const toggleAllCollapse = useCallback(() => {
    if (allCollapsed) {
      setCollapsedSet(new Set());
      setAllCollapsed(false);
    } else {
      setCollapsedSet(new Set(txSource.map((_, i) => i)));
      setAllCollapsed(true);
    }
  }, [allCollapsed, txSource]);

  const handleIssued = useCallback((svcName, issuedItems = []) => {
    const svcIds = Array.isArray(svcName)
      ? svcName.map((name) => INITIAL_INTEGRATION_SERVICES.find(s => s.name === name)?.id || String(name).toLowerCase()).filter((id) => id === "jira" || id === "notion")
      : [INITIAL_INTEGRATION_SERVICES.find(s => s.name === svcName)?.id || "jira"];
    const logs = (Array.isArray(issuedItems) ? issuedItems : [{ label: issuedItems }])
      .map((item) => ({
        svcId: String(item?.svcId || svcIds[0] || "jira").toLowerCase(),
        label: String(item?.label || item || "연동 업무").trim(),
        user: String(item?.user || "담당자").trim() || "담당자",
        due: String(item?.due || "").trim(),
      }))
      .filter((item) => item.label);

    setServices(prev =>
      prev.map(svc => {
        if (!svcIds.includes(svc.id)) return svc;
        let updatedCount = logs.filter((item) => item.svcId === svc.id).length;
        const tickets = svc.tickets.map(t => {
          if (updatedCount > 0 && t.status === "todo") {
            updatedCount -= 1;
            return { ...t, status: "done" };
          }
          return t;
        });
        return { ...svc, tickets };
      })
    );

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    setAuditLog(prev => [...prev, ...logs.map((item) => ({ svcId: item.svcId, label: item.label, time: timeStr, user: item.user }))]);

    const state = location?.state || {};
    const projectId = String(state.projectId || "").trim();
    const sourceTitle = String(state.meeting?.title || state.title || "").trim();
    if (projectId && sourceTitle && logs.length > 0) {
      const overrides = readProjectOverrides();
      const prevProject = overrides[projectId] && typeof overrides[projectId] === "object" ? overrides[projectId] : {};
      const prevItems = Array.isArray(prevProject.myActionItems) ? prevProject.myActionItems : [];
      const nextItems = [...prevItems];
      logs.forEach((item, index) => {
        const svcId = item.svcId === "notion" ? "notion" : "jira";
        const id = `${sourceTitle}-action-${item.label}-${index}`;
        const existingIndex = nextItems.findIndex((existing) => String(existing?.id || "") === id);
        const existing = existingIndex >= 0 ? nextItems[existingIndex] : {};
        const existingLinks = existing?.integrationLinks && typeof existing.integrationLinks === "object" ? existing.integrationLinks : {};
        const externalLink = buildExternalLink(svcId, item.label);
        const persisted = {
          ...existing,
          id,
          text: item.label,
          title: item.label,
          description: summaryData.summary || "",
          due: item.due,
          dueDate: item.due,
          assignee: item.user,
          assignees: [item.user].filter(Boolean),
          status: "연동완료",
          source: sourceTitle,
          projectId,
          projectName: state.projectName || state.project?.name || "",
          integrationTool: svcId === "notion" ? "Notion" : "Jira",
          integrationLinks: {
            ...existingLinks,
            [svcId]: externalLink,
          },
          externalLink,
          updatedAt: new Date().toISOString(),
        };
        if (existingIndex >= 0) nextItems[existingIndex] = { ...nextItems[existingIndex], ...persisted };
        else nextItems.unshift(persisted);
      });
      overrides[projectId] = { ...prevProject, myActionItems: nextItems };
      writeProjectOverrides(overrides);
    }

    showToast(svcIds.length > 1 ? "Jira와 Notion에 연동되었습니다." : svcIds[0] === "jira" ? "Jira에 연동되었습니다." : "Notion에 연동되었습니다.");
  }, [location?.state, showToast, summaryData.summary]);

  const txData = txSource
    .map((d, i) => ({ ...d, idx: i }))
    .filter(d =>
      (!bmFilter || bookmarks.has(d.idx)) &&
      (!searchQ || String(d.txt || "").includes(searchQ) || String(d.spk || "").includes(searchQ))
    );
  const visibleTx = txData;
  const visible = visibleTx.slice(0, shownCount);
  const remaining = visibleTx.length - shownCount;

  const activeIdx = txSource.reduce((acc, item, i) => {
    const nxt = i + 1 < txSource.length ? txSource[i + 1].ts : 99999;
    if (curTime >= item.ts && curTime < nxt) return i;
    return acc;
  }, -1);

  const acceptedParticipants = useMemo(() => {
    const state = location?.state || {};
    return buildAcceptedProjectParticipants({ projectId: state.projectId, state });
  }, [location?.state]);
  const visibleParticipants = acceptedParticipants.slice(0, 4);
  const hiddenCount = Math.max(acceptedParticipants.length - visibleParticipants.length, 0);

  const handleBadgeClick = useCallback((svc) => {
    const latest = services.find(s => s.id === svc.id) || svc;
    setDetailSvc(latest);
  }, [services]);

  const handleToggleAction = useCallback((index) => {
    setSummaryActions((prev) =>
      prev.map((action, i) => {
        if (i !== index) return action;
        return {
          ...action,
          status: action.status === "done" ? "todo" : "done",
        };
      })
    );

    setSummaryData((prev) => ({
      ...prev,
      actions: prev.actions.map((action, i) => {
        if (i !== index) return action;
        return {
          ...action,
          status: action.status === "done" ? "todo" : "done",
        };
      }),
    }));
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{
        background: "#F8FAFF",
        fontFamily: '"Pretendard Variable","Pretendard",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        color: "#0D1B2A",
      }}
    >
      <Header
        isMobile={isMobile}
        isLoggedIn={isAuthenticated}
        phase="IDLE"
        stateLabels={stateLabels}
        user={sessionUser}
        onLogout={() => {
          clearAuthSession();
          showToast("로그아웃 되었습니다.");
        }}
      />

      <div className="px-4 md:px-8 lg:px-12 pt-24 pb-0 max-w-screen-xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div className="flex-1 min-w-0">
              {realDataStatus === "missing" && (
                <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700">
                  이 회의의 분석 데이터를 찾을 수 없어 예시 데이터를 표시하고 있습니다.
                </div>
              )}
              {realDataStatus === "loaded" && analysisDegraded && (
                <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700">
                  AI 분석이 일시적으로 실패해 간이 자동 요약으로 대체되었습니다. 내용을 꼭 검토해 주세요.
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-400">{meetingHeader?.date || "2026.06.14"}</span>
              </div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-snug mb-4">
                {meetingHeader?.title || "Sprint 12 킥오프 — AI 회의록 시스템 개발 현황 공유"}
              </h1>
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-2">
                  {visibleParticipants.map((name, idx) => (
                    <div
                      key={`${name}-${idx}`}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white"
                      style={{ background: PARTICIPANTS[idx % PARTICIPANTS.length]?.color || "#0099CC" }}
                      title={name}
                    >
                      {name[0] || "?"}
                    </div>
                  ))}
                  {hiddenCount > 0 && (
                    <button
                      onClick={() => setModal("participants")}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white bg-slate-400 hover:bg-slate-500 transition-colors"
                    >
                      +{hiddenCount}
                    </button>
                  )}
                </div>
                <span className="text-xs text-slate-400">총 {acceptedParticipants.length}명 참여</span>
              </div>
            </div>

            <RealIntegrationStatus
              connectedProviders={connectedProviders}
              onManage={() => {
                const projectId = location?.state?.projectId || searchParams.get("projectId");
                navigate(`/configuration?projectId=${projectId}&tab=integration`);
              }}
            />
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 lg:px-12 pt-4 max-w-screen-xl mx-auto">
        <AgendaCompletionSection actions={summaryActions} onToggleAction={handleToggleAction} />
      </div>

      <div
        className={`px-4 md:px-8 lg:px-12 py-5 max-w-screen-xl mx-auto ${isMobile ? "pb-[230px]" : "pb-32"}`}
      >
        <div
          className="flex flex-col gap-5 md:flex-row transition-all duration-300"
          style={{ alignItems: isMobile ? "stretch" : "flex-start" }}
        >
          <div
            className="flex-shrink-0 transition-all duration-300"
            style={{
              width: isMobile ? "100%" : transcriptVisibleResolved ? "clamp(420px, 60%, 820px)" : "100%",
              transition: "width 0.35s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <SummaryPanel
              summaryData={summaryData}
              isMobile={isMobile}
              summaryCollapsed={summaryCollapsed}
              onToggleSummary={() => setSummaryCollapsed(prev => !prev)}
              transcriptVisible={transcriptVisibleResolved}
              transcriptEnabled={transcriptEnabled}
              onToggleTranscript={() => {
                if (!transcriptEnabled) return;
                setTranscriptVisible(v => !v);
              }}
              onOpenRegen={() => setModal("regen")}
              onSaveSummaryEdit={(nextData) => {
                setSummaryData(nextData);
                setSummaryActions(nextData.actions.map((a) => ({ ...a })));
                showToast("AI 요약 내용이 수정되었습니다.");
              }}
              actions={summaryActions}
              onToggleAction={handleToggleAction}
            />
          </div>

          {transcriptEnabled && (isMobile || transcriptVisibleResolved) && (
            <div
              className={`flex-1 min-w-0 ${isMobile ? "" : "overflow-hidden"}`}
              style={{
                maxWidth: isMobile ? "100%" : transcriptVisibleResolved ? "100%" : "0px",
                opacity: isMobile ? 1 : transcriptVisibleResolved ? 1 : 0,
                transition: isMobile ? "none" : "max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease",
                pointerEvents: isMobile ? "auto" : transcriptVisibleResolved ? "auto" : "none",
              }}
            >
              {transcriptLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white min-h-[320px] flex flex-col items-center justify-center gap-2.5">
                  <Spinner size={18} color="#0099CC" />
                  <p className="text-sm font-semibold text-slate-500">스크립트 불러오는 중...</p>
                </div>
              ) : (
                <>
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 bg-white border border-slate-200">
                      전체 <span className="font-bold text-slate-900">12</span>
                    </div>
                    <button
                      onClick={() => { setBmFilter(f => !f); setShownCount(PAGE_SIZE); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                        bmFilter ? "bg-amber-50 text-amber-500 border-amber-200" : "bg-white text-slate-400 border-slate-200 hover:bg-blue-50"
                      }`}
                    >
                      <LucideIcon name={bmFilter ? "star-filled" : "star"} size={13} /> <span className="hidden sm:inline text-xs">북마크</span>
                    </button>
                    <button
                      onClick={toggleAllCollapse}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors bg-white text-slate-400 border-slate-200 hover:bg-blue-50 cursor-pointer"
                    >
                      <span style={{ transform: allCollapsed ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                        <LucideIcon name="chevron-down" size={13} color={PROJECTLIST_CHEVRON_COLOR} strokeWidth={2} />
                      </span>
                      <span className="hidden sm:inline text-xs">{allCollapsed ? "전체 펼치기" : "전체 접기"}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="스크립트 검색…"
                    value={searchQ}
                    onChange={e => { setSearchQ(e.target.value.trim()); setShownCount(PAGE_SIZE); }}
                    className="px-3 py-1.5 text-sm rounded-lg bg-white border border-slate-200 focus:border-cyan-400 outline-none w-44 md:w-56 placeholder:text-slate-300 transition-colors"
                    style={{ fontFamily: "inherit" }}
                  />
                </div>

                <div className="space-y-2">
                  {visible.map(item => (
                    <TxCard
                      key={item.idx}
                      item={item}
                      isActive={activeIdx === item.idx}
                      isBookmarked={bookmarks.has(item.idx)}
                      isCollapsed={collapsedSet.has(item.idx)}
                      onSeek={seekTo}
                      onToggleBm={toggleBm}
                    />
                  ))}
                  {remaining > 0 && (
                    <button
                      onClick={() => setShownCount(c => c + PAGE_SIZE)}
                      className="w-full py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-700 bg-white border border-slate-200 hover:-translate-y-0.5 hover:shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>대화 {remaining}개 더 보기</span>
                      <LucideIcon name="chevron-down" size={13} color={PROJECTLIST_CHEVRON_COLOR} strokeWidth={2} />
                    </button>
                  )}
                </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {txSource.length > 0 && (
        <AudioPlayer
          curTime={curTime}
          playing={playing}
          spdIdx={spdIdx}
          onSeek={v => setCurTime(v)}
          onTogglePlay={() => setPlaying(p => !p)}
          onCycleSpeed={() => setSpdIdx(i => (i + 1) % SPEEDS.length)}
          bottomOffset={isMobile ? "calc(74px + env(safe-area-inset-bottom, 0px))" : 0}
        />
      )}

      {isMobile && <MobileTab active={activeTab} onChange={setActiveTab} />}

      <ServiceDetailModal
        open={!!detailSvc}
        onClose={() => setDetailSvc(null)}
        svc={detailSvc}
        auditLog={mergedAuditLog}
      />

      <IssueModal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        onIssued={handleIssued}
        services={services}
        isMobile={isMobile}
        assigneeOptions={issueAssigneeOptions}
      />

      <Modal open={modal === "participants"} onClose={() => setModal(null)} title="회의 참여자">
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {acceptedParticipants.map((name, idx) => (
            <div key={`${name}-${idx}`} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: PARTICIPANTS[idx % PARTICIPANTS.length]?.color || "#0099CC" }}
              >
                {name[0] || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{name}</p>
                <p className="text-xs text-slate-400">프로젝트 참여자</p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-600">참여 중</span>
            </div>
          ))}
        </div>
      </Modal>

      <RegenModal
        open={modal === "regen"}
        onClose={() => setModal(null)}
        onRegen={({ focus, prompt, len }) => {
          setSummaryData((prev) => {
            const selectedFocus = (focus || "").trim();
            const userPrompt = (prompt || "").trim();
            const selectedLen = len || "보통";

            const baseSummary = (prev.summary || "").trim();
            const splitSentences = (text) =>
              text
                .split(/(?<=[.!?])\s+/)
                .map((s) => s.trim())
                .filter(Boolean);

            const focusSummaryMap = {
              "회의 전체 요약 위주":
                "회의 전반의 진행 흐름과 핵심 결정, 후속 실행 항목을 함께 정리했습니다. 결정 사항과 리스크를 균형 있게 반영해 전체 맥락을 파악할 수 있도록 구성했습니다.",
              "기술적 제약 사항 위주":
                "이번 회의는 STT 처리 속도와 화자 분리 정확도 이슈를 중심으로 정리했습니다. 성능 목표 달성을 위해 최적화 우선순위와 추가 데이터 확보 필요성을 확인했습니다.",
              "해야 할 일과 담당자 위주":
                "이번 회의의 핵심은 실행 항목 정렬이었습니다. 담당자와 마감일을 기준으로 우선순위를 재확인하고, 지연 가능 항목을 선제적으로 관리하기로 했습니다.",
              "일정 및 마일스톤 위주":
                "개발 완료, QA, 배포 마일스톤을 중심으로 일정을 재점검했습니다. 현재 변수는 정확도 개선 작업이며, 일정 리스크를 줄이기 위한 선행 점검이 필요합니다.",
              "의사결정 사항 위주":
                "회의에서는 STT 기술 스택, 폴링 정책, 배포 일정과 같은 핵심 의사결정을 확정했습니다. 후속 작업은 확정된 기준에 맞춰 실행 단계로 이어지도록 정리했습니다.",
            };

            const focusKeywordMap = {
              "회의 전체 요약 위주": ["전체 맥락", "핵심 결정", "실행 항목"],
              "기술적 제약 사항 위주": ["성능 최적화", "정확도 개선", "기술 리스크"],
              "해야 할 일과 담당자 위주": ["실행 계획", "담당자", "마감 관리"],
              "일정 및 마일스톤 위주": ["마일스톤", "일정 관리", "배포 계획"],
              "의사결정 사항 위주": ["핵심 결정", "정책 확정", "우선순위"],
            };

            const focusSentences = splitSentences(focusSummaryMap[selectedFocus] || "");
            const baseSentences = splitSentences(baseSummary);
            const todoActions = (prev.actions || []).filter((a) => a.status !== "done");
            const doneActions = (prev.actions || []).filter((a) => a.status === "done");
            const topDecision = (prev.decisions || [])[0] || "핵심 의사결정 기준을 확정했습니다.";
            const topRisk = (prev.issues || [])[0]?.text || "핵심 리스크를 점검했습니다.";
            const firstAction = todoActions[0]?.text || "후속 실행 항목을 우선순위로 정리했습니다.";
            const secondAction = todoActions[1]?.text || doneActions[0]?.text || "담당자 기준으로 실행 계획을 조정했습니다.";

            const seed = [
              focusSentences[0],
              focusSentences[1],
              baseSentences[0],
              baseSentences[1],
            ].filter(Boolean);

            const contextLines = [...baseSentences, ...focusSentences].filter(Boolean);

            const conciseLines = [
              seed[0] || topDecision || "회의 핵심 내용을 압축해 정리했습니다.",
              userPrompt
                ? `핵심 실행 항목: ${firstAction}`
                : `핵심 실행 항목: ${firstAction}`,
            ];

            const normalLines = [
              contextLines[0] || "회의 배경과 현재 상황을 중심으로 정리했습니다.",
              contextLines[1] || "주요 논의 흐름을 중심으로 맥락을 정리했습니다.",
              `주요 결정: ${topDecision}`,
              `다음 실행: ${firstAction}`,
            ];

            const detailedLines = [
              ...contextLines.slice(0, 4),
              `주요 결정: ${topDecision}`,
              `실행 계획: ${firstAction} / ${secondAction}`,
              `리스크 점검: ${topRisk}`,
            ];

            const selectedLines =
              selectedLen === "간결"
                ? conciseLines.slice(0, 2)
                : selectedLen === "상세"
                ? detailedLines.slice(0, 7)
                : normalLines.slice(0, 4);

            let generated = selectedLines.join("\n").trim();
            if (!generated) {
              generated = "회의 핵심 내용을 다시 정리했습니다.";
            }

            const focusAnchorMap = {
              "회의 전체 요약 위주": "회의 요약",
              "기술적 제약 사항 위주": "기술 이슈",
              "해야 할 일과 담당자 위주": "해야 할 일",
              "일정 및 마일스톤 위주": "일정/마일스톤",
              "의사결정 사항 위주": "의사결정",
            };
            const focusKeywords = focusKeywordMap[selectedFocus] || [];
            const focusAnchor = focusAnchorMap[selectedFocus] || "일반 요약";

            const contentKeywordPairs = [
              { pattern: /STT|음성|처리 속도/i, keyword: "STT" },
              { pattern: /화자 분리|정확도/i, keyword: "화자 분리" },
              { pattern: /Jira|업무|티켓/i, keyword: "Jira" },
              { pattern: /QA|테스트/i, keyword: "QA" },
              { pattern: /배포|릴리스/i, keyword: "배포" },
              { pattern: /일정|마일스톤/i, keyword: "일정" },
              { pattern: /의사결정|결정/i, keyword: "의사결정" },
              { pattern: /리스크|위험/i, keyword: "리스크" },
              { pattern: /실행 계획|액션|Action/i, keyword: "실행 계획" },
            ];

            const contentKeywords = contentKeywordPairs
              .filter((item) => item.pattern.test(generated))
              .map((item) => item.keyword);

            const promptKeywords = userPrompt
              ? userPrompt
                  .replace(/[.,!?]/g, " ")
                  .split(/\s+/)
                  .map((w) => w.trim())
                  .filter((w) => w.length >= 2)
                  .slice(0, 2)
              : [];

            const nextKeywords = [
              { text: focusAnchor, type: "cyan" },
              ...focusKeywords.map((text) => ({ text, type: "cyan" })),
              ...contentKeywords.map((text) => ({ text, type: "cyan" })),
              ...promptKeywords.map((text) => ({ text, type: "cyan" })),
              ...(userPrompt ? [{ text: "요청 반영", type: "cyan" }] : []),
            ]
              .filter((item, idx, arr) => arr.findIndex((v) => v.text === item.text) === idx)
              .slice(0, 6);

            return {
              ...prev,
              summary: generated,
              keywords: nextKeywords,
            };
          });
          showToast("다시 생성한 설정이 AI 요약에 반영되었습니다.");
        }}
      />

      {!isMobile && <Footer />}

      <ToastPopup show={toast.show} message={toast.message} type={toast.type} />
    </div>
  );
}
