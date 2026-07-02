import { useState, useEffect, useRef, useMemo, forwardRef } from "react";
import { createPortal } from "react-dom";
import { Navigate } from "react-router-dom";
import { clearAuthSession, listProjectMeetings, listProjects, listProjectTickets } from "../api/apiClient";
import Header from "../components/Header";
import Footer from "../components/Footer";
import MobileTab from "../components/MobileTab";
import ToastPopup from "../components/toastpopup";

const PRIORITY_EN = {
  "높음": { label: "높음", bg: "#FCE8E6", text: "#EF4444" },
  "보통": { label: "보통", bg: "#EEF3FF", text: "#0099CC" },
  "낮음": { label: "낮음", bg: "#F1F4F8", text: "#5A6F8A" }
};

const STATUS_TABS = ["전체", "검토대기", "검토완료", "연동완료", "수행완료"];

const STATUS_DOT = {
  "검토대기": "#F59E0B",
  "검토완료": "#7C3AED",
  "수행완료": "#64748B",
  "연동완료": "#10B981"
};

const STATUS_BADGE_CLASS = {
  "검토대기": "border-[#F59E0B]/40 text-[#B97309]",
  "검토완료": "border-[#7C3AED]/40 text-[#7C3AED]",
  "수행완료": "border-[#94A3B8]/50 text-[#475569]",
  "연동완료": "border-[#10B981]/40 text-[#0E8F69]"
};

const STATUS_LABEL = {
  "검증 전": "검토대기",
  "진행중": "검토완료",
  "연동 완료": "연동완료",
  "완료": "수행완료",
  "완료히스토리": "수행완료"
};

function getStatusLabel(status) {
  return STATUS_LABEL[status] || status;
}

function getPanelStatusStyle(status) {
  if (status === "연동완료") return { bg: "#EEF3FF", color: "#0099CC", border: "#0099CC" };
  if (status === "수행완료") return { bg: "#F1F5F9", color: "#475569", border: "#94A3B8" };
  if (status === "검토완료") return { bg: "#F1F5F9", color: "#475569", border: "#94A3B8" };
  return { bg: "#FEF7E0", color: "#F59E0B", border: "#F59E0B" };
}

function getIntegrationLinks(item) {
  const links = item?.integrationLinks && typeof item.integrationLinks === "object" ? item.integrationLinks : {};
  const provider = String(item?.integrationProvider || item?.integrationTool || "").toLowerCase();
  const legacyLink = item?.jiraLink || item?.externalLink || "";
  return {
    jira: links.jira || (provider.includes("jira") ? legacyLink : item?.jiraLink || ""),
    notion: links.notion || (provider.includes("notion") ? legacyLink : ""),
  };
}

function getIntegrationEntries(item) {
  const links = getIntegrationLinks(item);
  return [
    { id: "jira", label: "Jira", url: links.jira, icon: "jira" },
    { id: "notion", label: "Notion", url: links.notion, icon: "arrowUpRight" },
  ].filter((entry) => Boolean(entry.url));
}

function hasExternalLink(item) {
  return getIntegrationEntries(item).length > 0;
}

function isActionDone(item) {
  return getStatusLabel(item?.status) === "수행완료";
}

function compactLegacyActionHistoryItems(items) {
  const byId = new Map();
  const histories = [];

  items.forEach((item) => {
    const snapshotOf = String(item?.snapshotOf || "").trim();
    const historySavedAt = String(item?.historySavedAt || "").trim();
    if (snapshotOf || historySavedAt) {
      histories.push({ ...item, snapshotOf });
      return;
    }

    const id = String(item?.id || "").trim();
    const key = id || `${item?.projectKey || item?.projectId || ""}-${item?.title || item?.text || ""}-${item?.assignee || ""}`;
    if (!byId.has(key)) byId.set(key, item);
  });

  histories.forEach((history) => {
    const key = String(history.snapshotOf || "").trim();
    const recoveredKey = key || `${history?.projectKey || history?.projectId || ""}-${history?.title || history?.text || ""}-${history?.assignee || ""}`;
    const base = byId.get(recoveredKey);
    const merged = {
      ...(base || history),
      id: recoveredKey || history.id,
      status: "수행완료",
      jiraLink: base?.jiraLink || history.jiraLink || history.externalLink || "",
      externalLink: base?.externalLink || history.externalLink || history.jiraLink || "",
      integrationProvider: base?.integrationProvider || history.integrationProvider || null,
      integrationTool: base?.integrationTool || history.integrationTool || null,
      integrationLinks: {
        ...(history.integrationLinks && typeof history.integrationLinks === "object" ? history.integrationLinks : {}),
        ...(base?.integrationLinks && typeof base.integrationLinks === "object" ? base.integrationLinks : {}),
      },
      snapshotOf: null,
      historySavedAt: null,
    };
    byId.set(recoveredKey || merged.id, merged);
  });

  return Array.from(byId.values());
}

const TOAST_ICON_RULE = {
  info: "#0099CC",
  ai: "#7C3AED",
  success: "#10B981"
};

const PROJECT_OVERRIDE_STORAGE_KEY = "tiki_project_overrides";
const MANUAL_MEETING_RECORDS_KEY = "tiki_manual_minutes_records";

const readJsonObject = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeJsonObject = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 대시보드 화면 상태는 이미 갱신되므로 저장 실패만 조용히 무시한다.
  }
};

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
    pencil: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m16.5 3.5 4 4L7 21l-4 1 1-4L16.5 3.5z" />
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
    ),
    notion: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
      </svg>
    )
  };

  return icons[name] || null;
}

function getDDayInfo(dueDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseDueDate(dueDateStr);
  if (!due) return { label: "미정", urgent: false, overdue: false, missing: true };
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: `D+${Math.abs(diffDays)}`, urgent: true, overdue: true };
  if (diffDays === 0) return { label: "D-DAY", urgent: true, overdue: false };
  if (diffDays <= 2) return { label: `D-${diffDays}`, urgent: true, overdue: false };
  return { label: `D-${diffDays}`, urgent: false, overdue: false };
}

function getTodayOrTomorrowLabel(dueDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseDueDate(dueDateStr);
  if (!due) return null;
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "오늘까지";
  if (diffDays === 1) return "내일까지";
  return null;
}

function parseDueDate(raw) {
  const value = String(raw || "").trim();
  if (!value || value === "-" || value === "미정") return null;

  const koreanMatch = value.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
  const fullDateMatch = value.replace(/[.]/g, "-").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const shortDateMatch = value.match(/^(\d{1,2})[/.](\d{1,2})$/);

  const [, year, month, day] = koreanMatch
    ? koreanMatch
    : fullDateMatch
      ? fullDateMatch
      : shortDateMatch
        ? [null, new Date().getFullYear(), shortDateMatch[1], shortDateMatch[2]]
        : [];
  if (!year || !month || !day) return null;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDueShort(raw) {
  const due = parseDueDate(raw);
  if (!due) return "미정";
  return `${String(due.getMonth() + 1).padStart(2, "0")}.${String(due.getDate()).padStart(2, "0")}`;
}

function compareDueDate(left, right) {
  const leftDate = parseDueDate(left?.dueDate);
  const rightDate = parseDueDate(right?.dueDate);
  if (!leftDate && !rightDate) return 0;
  if (!leftDate) return 1;
  if (!rightDate) return -1;
  return leftDate - rightDate;
}

function formatAssignees(assignees, fallbackName) {
  const list = assignees && assignees.length > 0 ? assignees : [fallbackName];
  return list.filter(Boolean).join(', ') || fallbackName || '';
}

function isAssignedToMe(item, aliases = []) {
  const normalizedAliases = aliases.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  if (normalizedAliases.length === 0) return false;
  const assignees = [
    item?.assignee,
    ...(Array.isArray(item?.assignees) ? item.assignees : []),
    item?.assigneeEmail,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  return assignees.some((value) => normalizedAliases.includes(value));
}

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
  return { year: y, month: m - 1, day: d };
}

function buildCalendarGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0(일) ~ 6(토)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];

  // 이전 달 채우기
  for (let i = 0; i < startOffset; i++) {
    const day = daysInPrevMonth - startOffset + 1 + i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    cells.push({ day, inMonth: false, dateStr: toDateStr(prevYear, prevMonth, day) });
  }

  // 이번 달
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, inMonth: true, dateStr: toDateStr(year, month, day) });
  }

  // 다음 달로 6주(42칸) 맞추기
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ day: nextDay, inMonth: false, dateStr: toDateStr(nextYear, nextMonth, nextDay) });
    nextDay++;
  }

  return cells;
}

const CustomDatePicker = forwardRef(function CustomDatePicker({ value, onSelect, onClose, anchorRef, panelRef }, forwardedRef) {
  const todayStr = "2026-06-18";
  const parsedValue = parseDateStr(value) || parseDateStr(todayStr);
  const [viewYear, setViewYear] = useState(parsedValue.year);
  const [viewMonth, setViewMonth] = useState(parsedValue.month);
  const [coords, setCoords] = useState(null);
  const calendarRef = useRef(null);

  // 부모(App)가 outside-click 판정에 쓸 수 있도록 내부 DOM 노드를 그대로 노출
  useEffect(() => {
    if (!forwardedRef) return;
    if (typeof forwardedRef === "function") {
      forwardedRef(calendarRef.current);
    } else {
      forwardedRef.current = calendarRef.current;
    }
  });

  // 실제 렌더링된 캘린더 높이를 측정해서, 뷰포트 안에 완전히 들어오는 좌표를 직접 계산
  useEffect(() => {
    const anchorEl = anchorRef?.current;
    const calendarEl = calendarRef.current;
    if (!anchorEl || !calendarEl) return;

    let rafId = null;
    let cancelled = false;

    const computePosition = () => {
      if (cancelled) return;
      const anchorRect = anchorEl.getBoundingClientRect();
      // PC(넓은 뷰포트)에서 캘린더가 첫 페인트 시점에 측정되면
      // offsetHeight/Width가 0으로 잡혀 좌표가 화면 밖으로 계산되는 문제가 있었음.
      // 측정값이 비정상(0)이면 합리적인 기본값으로 폴백한다.
      const measuredHeight = calendarEl.offsetHeight;
      const measuredWidth = calendarEl.offsetWidth;
      const calendarHeight = measuredHeight > 0 ? measuredHeight : 320;
      const calendarWidth = measuredWidth > 0 ? measuredWidth : 280;
      const margin = 8;
      // 패널 헤더(상단 고정바) 및 화면 가장자리와 부딫히지 않도록 여유 마진
      const topBound = 72;
      const bottomBound = window.innerHeight - 16;

      const spaceBelow = bottomBound - anchorRect.bottom;
      const spaceAbove = anchorRect.top - topBound;

      let top;
      if (spaceAbove >= calendarHeight + margin) {
        // 위에 충분한 공간 → 위로 펼침 (기본 선호)
        top = anchorRect.top - calendarHeight - margin;
      } else if (spaceBelow >= calendarHeight + margin) {
        // 위가 부족하면 아래로 펼침
        top = anchorRect.bottom + margin;
      } else {
        // 둘 다 부족하면 더 넓은 쪽에 붙이고 허용 범위 안으로 클램프
        top = spaceBelow >= spaceAbove
          ? anchorRect.bottom + margin
          : anchorRect.top - calendarHeight - margin;
        top = Math.max(topBound, Math.min(top, bottomBound - calendarHeight));
      }

      // top/left가 유효하지 않은 숫자로 계산되는 경우 방지 (NaN/Infinity 가드)
      if (!Number.isFinite(top)) {
        top = Math.max(topBound, anchorRect.bottom + margin);
      }

      let left = anchorRect.left + anchorRect.width / 2 - calendarWidth / 2;
      if (!Number.isFinite(left)) {
        left = anchorRect.left;
      }
      // 캘린더는 createPortal로 body에 렌더링되지만,
      // 시각적으로는 "사이드 패널 안의 요소"여야 하므로
      // panelRef가 있으면 화면 전체가 아니라 패널의 좌우 경계 안으로 클램프한다.
      // (패널 안의 버튼은 패널 왼쪽 절반에 있을 수 있어, 화면 기준 클램프만으로는
      //  캘린더 일부가 패널 바깥, 즉 배경 오버레이 위로 삐져나오는 문제가 있었음)
      const panelEl = panelRef?.current;
      if (panelEl) {
        const panelRect = panelEl.getBoundingClientRect();
        const minLeft = panelRect.left + 8;
        const maxLeft = panelRect.right - calendarWidth - 8;
        left = maxLeft >= minLeft
          ? Math.max(minLeft, Math.min(left, maxLeft))
          : panelRect.left + (panelRect.width - calendarWidth) / 2;
      } else {
        left = Math.max(8, Math.min(left, window.innerWidth - calendarWidth - 8));
      }

      setCoords({ top, left });
    };

    // 첫 프레임에는 calendarEl의 실제 크기가 0일 수 있으므로,
    // 레이아웃이 확정된 다음 프레임에서 다시 한 번 측정해 보정한다.
    computePosition();
    rafId = requestAnimationFrame(() => {
      computePosition();
    });

    window.addEventListener("resize", computePosition);
    window.addEventListener("scroll", computePosition, true);
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", computePosition);
      window.removeEventListener("scroll", computePosition, true);
    };
  }, [anchorRef, panelRef, viewYear, viewMonth]);

  const cells = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const goPrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // position: fixed인 자식이라도 부모(사이드 패널)에 transform/overflow-hidden이 걸려 있으면
  // 그 부모가 새로운 containing block이 되어 좌표가 패널 내부 기준으로 잘못 해석되고,
  // 결국 패널의 overflow-hidden에 가려 보이지 않는 문제가 있었다.
  // createPortal로 document.body에 직접 렌더링하면 이 문제를 완전히 피할 수 있다.
  return createPortal(
    <div
      ref={calendarRef}
      className="fixed z-[300] w-[280px] max-w-[88vw] box-border overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)] p-3.5"
      style={{
        top: coords ? `${coords.top}px` : "-9999px",
        left: coords ? `${coords.left}px` : "-9999px",
        visibility: coords ? "visible" : "hidden"
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2.5">
        <button
          type="button"
          onClick={goPrevMonth}
          className="p-1.5 rounded-lg text-[#5A6F8A] hover:bg-[#F1F4F8] hover:text-[#0D1B2A] transition-colors cursor-pointer"
          aria-label="이전 달"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-sm font-bold text-[#0D1B2A]">
          {viewYear}년 {viewMonth + 1}월
        </span>
        <button
          type="button"
          onClick={goNextMonth}
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
    </div>,
    document.body
  );
});

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

const PANEL_FIELD_LABEL_CLASS = "text-xs font-bold text-[#0D1B2A]";

export default function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem("tiki_access_token")));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("tiki_user") || "null");
    } catch {
      return null;
    }
  });
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
  const [projects, setProjects] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState("전체");
  const [projectFilter, setProjectFilter] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [isProjectFilterOpen, setIsProjectFilterOpen] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  // ─── 사이드 패널 상태 ───────────────────────────────────────────────────────
  const [selectedItem, setSelectedItem] = useState(null);
  const [panelView, setPanelView] = useState("detail"); // "detail" | "integrate"
  // ───────────────────────────────────────────────────────────────────────────

  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [isDueDateOpen, setIsDueDateOpen] = useState(false);
  const [isStatusSortOpen, setIsStatusSortOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [integratingId, setIntegratingId] = useState(null);
  const [selectedIntegrationTools, setSelectedIntegrationTools] = useState([]);
  const [justCompletedId, setJustCompletedId] = useState(null);
  const [isPanelEditable, setIsPanelEditable] = useState(false);

  const dueDateDropdownRef = useRef(null);
  const dueDateButtonRef = useRef(null);
  const datePickerRef = useRef(null);
  const assigneeDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);
  const projectDropdownRef = useRef(null);
  const panelRef = useRef(null);

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPhase, setUploadPhase] = useState("IDLE");
  const [uploadProgress, setUploadProgress] = useState(0);

  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    assignee: ""
  });

  const buildPersistedActionItem = (item, patch = {}) => {
    const next = { ...item, ...patch };
    const links = getIntegrationLinks(next);
    const firstLink = links.jira || links.notion || "";
    return {
      id: next.id,
      text: next.text || next.title || "해야 할 일",
      title: next.title || next.text || "해야 할 일",
      description: next.description || "",
      due: next.due || next.dueDate || "",
      dueDate: next.dueDate || next.due || "",
      assignee: next.assignee || "",
      assignees: Array.isArray(next.assignees) && next.assignees.length > 0
        ? next.assignees
        : next.assignee ? [next.assignee] : [],
      status: next.status || "검토대기",
      source: next.source || "",
      projectId: next.projectKey ? String(next.projectKey) : "",
      projectName: next.projectName || "",
      integrationTool: next.integrationProvider || next.integrationTool || null,
      integrationLinks: links,
      externalLink: firstLink,
      jiraLink: links.jira || firstLink,
      updatedAt: new Date().toISOString(),
    };
  };

  const persistActionItemUpdate = (item, patch = {}) => {
    const projectId = String(item?.projectKey || item?.projectId || "");
    if (!projectId || !item?.id) return;

    const persistedItem = buildPersistedActionItem(item, patch);
    const overrides = readJsonObject(PROJECT_OVERRIDE_STORAGE_KEY);
    const prevProject = overrides[projectId] && typeof overrides[projectId] === "object" ? overrides[projectId] : {};
    const prevItems = Array.isArray(prevProject.myActionItems) ? prevProject.myActionItems : [];
    let found = false;
    const nextItems = prevItems.map((existing) => {
      if (String(existing?.id || "") !== String(item.id)) return existing;
      found = true;
      return { ...existing, ...persistedItem };
    });
    if (!found) nextItems.unshift(persistedItem);
    overrides[projectId] = { ...prevProject, myActionItems: nextItems };
    writeJsonObject(PROJECT_OVERRIDE_STORAGE_KEY, overrides);

    const manualMatch = String(item.id).match(/^(.+)-action-(\d+)$/);
    if (manualMatch) {
      const [, recordId, indexText] = manualMatch;
      const index = Number(indexText) - 1;
      const manualRecords = readJsonObject(MANUAL_MEETING_RECORDS_KEY);
      const record = manualRecords[recordId];
      if (record && Array.isArray(record.actions) && record.actions[index]) {
        const nextStatus = persistedItem.status;
        const nextActions = record.actions.map((action, idx) => (
          idx === index
            ? {
                ...action,
                text: persistedItem.text,
                assignee: persistedItem.assignee,
                dueDate: persistedItem.dueDate,
                status: nextStatus,
                checked: ["수행완료", "연동완료"].includes(nextStatus) ? true : Boolean(action.checked),
              }
            : action
        ));
        manualRecords[recordId] = { ...record, actions: nextActions };
        writeJsonObject(MANUAL_MEETING_RECORDS_KEY, manualRecords);
      }
    }
  };

  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  const userAliases = useMemo(
    () => [user?.name, user?.email].map((value) => String(value || "").trim()).filter(Boolean),
    [user?.name, user?.email]
  );

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

  // 패널 외부 클릭 시 닫기 (오버레이 클릭)
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      closePanel();
    }
  };

  // ESC 키로 패널 닫기
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && selectedItem) closePanel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedItem]);

  useEffect(() => {
    if (!isAssigneeOpen && !isDueDateOpen && !isStatusSortOpen && !isProjectFilterOpen) return;
    const handleOutsideClick = (e) => {
      // 캘린더는 createPortal로 document.body에 렌더링되므로
      // dueDateDropdownRef(버튼을 감싼 div) 안에 포함되지 않는다.
      // 캘린더 내부 클릭도 "안쪽 클릭"으로 인정하기 위해 datePickerRef를 함께 확인한다.
      if (
        isDueDateOpen &&
        dueDateDropdownRef.current &&
        !dueDateDropdownRef.current.contains(e.target) &&
        !(datePickerRef.current && datePickerRef.current.contains(e.target))
      ) {
        setIsDueDateOpen(false);
      }
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
  }, [isAssigneeOpen, isDueDateOpen, isStatusSortOpen, isProjectFilterOpen]);

  const mapTicketStatus = (s) => {
    if (s === 'synced') return '연동완료';
    if (s === 'ready') return '검토완료';
    return '검토대기';
  };

  const mapTicketPriority = (p) => {
    if (p === 'high' || p === 'urgent') return '높음';
    if (p === 'low') return '낮음';
    return '보통';
  };

  const mapMeetingActionItem = (item, project, meeting, index) => ({
    id: item.id || `${meeting.id || meeting.title}-action-${index + 1}`,
    title: item.title || item.text || "해야 할 일",
    text: item.text || item.title || "해야 할 일",
    description: item.description || meeting.summary || "",
    priority: item.priority || "보통",
    projectKey: project.id,
    projectName: project.name,
    projectColor: project.color || "#0099CC",
    assignee: item.assignee || "",
    assignees: Array.isArray(item.assignees) && item.assignees.length > 0
      ? item.assignees
      : item.assignee ? [item.assignee] : [],
    avatar: "user",
    status: getStatusLabel(item.status || "검토대기"),
    dueDate: item.dueDate || item.due || "",
    meetingDate: meeting.date || meeting.created_at?.slice?.(0, 10) || "",
    contextTime: item.contextTime || "",
    jiraLink: item.externalLink || item.jiraLink || "",
    externalLink: item.externalLink || item.jiraLink || "",
    integrationLinks: item.integrationLinks && typeof item.integrationLinks === "object" ? item.integrationLinks : {},
    integrationTool: item.integrationTool || null,
    integrationProvider: item.integrationProvider || null,
    snapshotOf: item.snapshotOf || null,
    historySavedAt: item.historySavedAt || null,
    source: item.source || meeting.title || "",
  });

  const readLocalManualActionItems = (projectList) => {
    const projectMap = new Map(projectList.map((project) => [String(project.id), project]));
    const overrides = readJsonObject(PROJECT_OVERRIDE_STORAGE_KEY);
    const manualRecords = readJsonObject(MANUAL_MEETING_RECORDS_KEY);

    const overrideItems = Object.entries(overrides).flatMap(([projectId, override]) => {
      const project = projectMap.get(String(projectId));
      if (!project || !Array.isArray(override?.myActionItems)) return [];
      return override.myActionItems.map((item, index) =>
        mapMeetingActionItem(item, project, { id: `local-${projectId}`, title: item.source || "직접 작성 회의록" }, index)
      );
    });

    const manualItems = Object.values(manualRecords).flatMap((record) => {
      const project = projectMap.get(String(record?.projectId || ""));
      if (!project || !Array.isArray(record?.actions)) return [];
      return record.actions.map((item, index) =>
        mapMeetingActionItem(
          {
            ...item,
            id: `${record.id || "manual"}-action-${index + 1}`,
            title: item.text,
            description: item.description,
            status: item.status || (item.checked ? "수행완료" : "검토대기"),
            source: record.title,
            projectId: record.projectId,
            projectName: record.projectName,
          },
          project,
          record,
          index
        )
      );
    });

    return [...overrideItems, ...manualItems];
  };

  useEffect(() => {
    if (!user || userAliases.length === 0) {
      setActionItems([]);
      return;
    }

    listProjects()
      .then((projectList) => {
        const rawProjects = Array.isArray(projectList) ? projectList : [];
        setProjects(rawProjects);
        return Promise.all(
          rawProjects.map((p) =>
            Promise.all([
              listProjectTickets(p.id).catch(() => []),
              listProjectMeetings(p.id).catch(() => []),
            ]).then(([tickets, meetings]) => ({
              project: p,
              tickets: Array.isArray(tickets) ? tickets : [],
              meetings: Array.isArray(meetings) ? meetings : [],
            }))
              .catch(() => ({ project: p, tickets: [], meetings: [] }))
          )
        ).then((results) => ({ rawProjects, results }));
      })
      .then(({ rawProjects, results }) => {
        const myItems = results.flatMap(({ project, tickets }) =>
          tickets
            .map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description || '',
              priority: mapTicketPriority(t.priority),
              projectKey: project.id,
              projectName: project.name,
              projectColor: project.color || '#0099CC',
              assignee: t.assignee || '',
              assignees: t.assignee ? [t.assignee] : [],
              avatar: 'user',
              status: mapTicketStatus(t.status),
              dueDate: t.due_at ? t.due_at.slice(0, 10) : '',
              meetingDate: t.created_at ? t.created_at.slice(0, 10) : '',
              contextTime: '',
              jiraLink: t.external_syncs?.find((s) => s.provider === 'jira')?.external_url || '',
              externalLink: t.external_syncs?.find((s) => s.provider === 'jira')?.external_url || t.external_syncs?.find((s) => s.provider === 'notion')?.external_url || '',
              integrationLinks: {
                jira: t.external_syncs?.find((s) => s.provider === 'jira')?.external_url || '',
                notion: t.external_syncs?.find((s) => s.provider === 'notion')?.external_url || '',
              },
            }))
        );
        const meetingItems = results.flatMap(({ project, meetings }) =>
          meetings.flatMap((meeting) =>
            (Array.isArray(meeting.action_items) ? meeting.action_items : [])
              .map((item, index) => mapMeetingActionItem(item, project, meeting, index))
          )
        );
        const localItems = readLocalManualActionItems(rawProjects);
        // 로컬 저장분은 대시보드/프로젝트 상세에서 사용자가 바꾼 최신 상태다.
        // 같은 id의 서버 원본 회의 업무보다 먼저 병합해야 새로고침 후에도 상태가 되돌아가지 않는다.
        const merged = compactLegacyActionHistoryItems([...localItems, ...myItems, ...meetingItems])
          .filter((item) => isAssignedToMe(item, userAliases));
        const dedupedMap = new Map();
        merged.forEach((item) => {
          const key = String(item.id || `${item.projectKey}-${item.title}-${item.assignee}`);
          const prev = dedupedMap.get(key);
          if (!prev) {
            dedupedMap.set(key, item);
            return;
          }
          dedupedMap.set(key, {
            ...item,
            ...prev,
            dueDate: prev.dueDate || item.dueDate || item.due || "",
            due: prev.due || item.due || item.dueDate || "",
            meetingDate: prev.meetingDate || item.meetingDate || "",
            integrationLinks: {
              ...(item.integrationLinks && typeof item.integrationLinks === "object" ? item.integrationLinks : {}),
              ...(prev.integrationLinks && typeof prev.integrationLinks === "object" ? prev.integrationLinks : {}),
            },
          });
        });
        setActionItems(Array.from(dedupedMap.values()));
      })
      .catch(() => {});
  }, [user, userAliases]);

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    triggerToast("로그아웃 되었습니다.", "info");
  };

  // ─── 패널 열기 / 닫기 ──────────────────────────────────────────────────────
  const openPanel = (item) => {
    setSelectedItem(item);
    setPanelView("detail");
    setSelectedIntegrationTools([]);
    setIsPanelEditable(false);
    setIsAssigneeOpen(false);
    setIsDueDateOpen(false);
    setEditForm({
      title: item.title,
      description: item.description,
      dueDate: item.dueDate,
      assignee: item.assignee
    });
  };

  const closePanel = () => {
    setSelectedItem(null);
    setPanelView("detail");
    setSelectedIntegrationTools([]);
    setIsPanelEditable(false);
    setDeleteConfirmOpen(false);
    setIsAssigneeOpen(false);
    setIsDueDateOpen(false);
  };

  const handleTogglePanelEdit = () => {
    setIsPanelEditable((prev) => {
      const next = !prev;
      if (!next) {
        setIsAssigneeOpen(false);
        setIsDueDateOpen(false);
      }
      return next;
    });
  };
  // ───────────────────────────────────────────────────────────────────────────

  const handleSaveEdit = () => {
    const shouldComplete = selectedItem?.status === "검토완료";
    const updatedItem = {
      ...selectedItem,
      ...editForm,
      status: shouldComplete ? "수행완료" : "검토완료"
    };
    setActionItems(prev => prev.map(item => {
      if (item.id === selectedItem.id) {
        return { ...item, ...editForm, status: updatedItem.status };
      }
      return item;
    }));
    persistActionItemUpdate(selectedItem, updatedItem);
    closePanel();
    triggerToast(
      shouldComplete
        ? "수행 완료 처리되었습니다."
        : "해야 할 일이 성공적으로 수정(사용자 변경)되었습니다.",
      "success"
    );
  };

  const handleMarkDone = (itemId) => {
    const targetItem = actionItems.find((item) => item.id === itemId) || selectedItem;
    if (!targetItem) return;
    const updatedItem = { ...targetItem, status: "수행완료" };
    setActionItems(prev => prev.map(item => (
      item.id === itemId ? { ...item, status: "수행완료" } : item
    )));
    setSelectedItem(prev => prev?.id === itemId ? { ...prev, status: "수행완료" } : prev);
    persistActionItemUpdate(targetItem, updatedItem);
    closePanel();
    triggerToast("수행 완료 처리되었습니다.", "success");
  };

  const handleVerify = (itemId) => {
    const targetItem = actionItems.find((item) => item.id === itemId) || selectedItem;
    if (targetItem) persistActionItemUpdate(targetItem, { status: "검토완료" });
    setActionItems(prev => prev.map(item => (
      item.id === itemId ? { ...item, status: "검토완료" } : item
    )));
    // 패널 내 selectedItem도 동기화
    setSelectedItem(prev => prev?.id === itemId ? { ...prev, status: "검토완료" } : prev);
    triggerToast("해야 할 일이 검증되어 검토 완료 상태로 전환되었습니다.", "success");
  };

  const handleQuickVerify = (e, itemId) => {
    e.stopPropagation();
    handleVerify(itemId);
  };

  const handleApprove = (itemId, providers = "jira") => {
    const requestedProviders = (Array.isArray(providers) ? providers : [providers])
      .map((provider) => String(provider || "").toLowerCase())
      .filter((provider) => provider === "jira" || provider === "notion");
    if (requestedProviders.length === 0) return;
    setIntegratingId(itemId);
    setTimeout(() => {
      const targetItem = actionItems.find((item) => item.id === itemId) || selectedItem;
      const previousLinks = getIntegrationLinks(targetItem);
      const nextLinks = { ...previousLinks };
      requestedProviders.forEach((provider) => {
        if (nextLinks[provider]) return;
        const randomTicketNum = Math.floor(Math.random() * 800) + 100;
        nextLinks[provider] = provider === "notion"
          ? `https://www.notion.so/NEO-${randomTicketNum}`
          : `https://jira.atlassian.com/browse/NEO-${randomTicketNum}`;
      });
      const primaryProvider = requestedProviders[requestedProviders.length - 1] || "jira";
      const primaryLink = nextLinks[primaryProvider] || nextLinks.jira || nextLinks.notion || "";
      const updatedItem = {
        status: targetItem?.status === "수행완료" ? "수행완료" : "연동완료",
        integrationLinks: nextLinks,
        externalLink: primaryLink,
        jiraLink: nextLinks.jira || primaryLink,
        integrationProvider: primaryProvider,
        integrationTool: primaryProvider === "notion" ? "Notion" : "Jira",
      };
      if (targetItem) persistActionItemUpdate(targetItem, updatedItem);

      setActionItems(prev => prev.map(item => {
        if (item.id === itemId) return { ...item, ...updatedItem };
        return item;
      }));
      setSelectedItem(prev => prev?.id === itemId ? { ...prev, ...updatedItem } : prev);
      setIntegratingId(null);
      setPanelView("detail");
      setSelectedIntegrationTools([]);
      setJustCompletedId(itemId);
      setTimeout(() => setJustCompletedId(null), 1200);
      const linkedNames = requestedProviders.map((provider) => provider === "notion" ? "Notion" : "Jira").join(", ");
      triggerToast(`${linkedNames} 연동이 완료되었습니다!`, "ai");
    }, 700);
  };

  const handleQuickApprove = (e, itemId) => {
    e.stopPropagation();
    handleApprove(itemId);
  };

  const handleDelete = () => {
    if (!selectedItem) return;
    const id = selectedItem.id;
    setActionItems(prev => prev.filter(item => item.id !== id));
    closePanel();
    triggerToast("해야 할 일이 삭제되었습니다.", "warning");
  };

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
          projectKey: projects[0]?.id || '',
          projectName: projects[0]?.name || '',
          projectColor: projects[0]?.color || '#0099CC',
          assignee: user?.name || '나',
          assignees: [user?.name || '나'],
          avatar: "user",
          status: "검토대기",
          dueDate: "2026-06-25",
          meetingDate: "2026-06-18",
          description: "새로 업로드한 오디오에서 RAG를 기반으로 도메인 전문 용어(Figma, Celery, React)를 식별 및 마스킹한 뒤 추출해 낸 태스크입니다.",
          contextTime: "01:15",
          jiraLink: ""
        };
        setActionItems(prev => [newAction, ...prev]);
        setUploadPhase("COMPLETED");
        triggerToast("AI 분석 및 해야 할 일 추출이 완료되어 목록에 추가되었습니다!", "ai");
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

  const isAnyFilterActive = statusFilter !== "전체" || projectFilter !== "전체" || searchQuery.trim() !== "";

  const filteredItems = useMemo(() => {
    const byAssignee = actionItems.filter((item) => isAssignedToMe(item, userAliases));
    const byStatus = statusFilter === "전체" ? byAssignee : byAssignee.filter((item) => item.status === statusFilter);
    const byProject = projectFilter === "전체" ? byStatus : byStatus.filter((item) => item.projectKey === projectFilter);
    const query = searchQuery.trim().toLowerCase();
    if (!query) return byProject;
    return byProject.filter((item) => {
      const haystack = [item.title, item.assignee, ...(item.assignees || []), item.projectName || ""].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [actionItems, statusFilter, projectFilter, searchQuery, userAliases]);

  const groupedByProject = useMemo(() => {
    const groups = {};
    filteredItems.forEach((item) => {
      if (!groups[item.projectKey]) groups[item.projectKey] = [];
      groups[item.projectKey].push(item);
    });
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        const aDone = isActionDone(a) ? 1 : 0;
        const bDone = isActionDone(b) ? 1 : 0;
        return aDone - bDone;
      });
    });
    return Object.keys(groups)
      .filter((key) => groups[key] && groups[key].length > 0)
      .map((key) => ({ projectKey: key, items: groups[key] }));
  }, [filteredItems]);

  const firstName = user?.name || "사용자";
  const myTotalActionCount = actionItems.filter((item) => isAssignedToMe(item, userAliases) && !isActionDone(item)).length;

  const myActiveItems = useMemo(() => {
    const priorityWeight = { "높음": 3, "보통": 2, "낮음": 1 };
    return actionItems
      .filter((item) => isAssignedToMe(item, userAliases) && !isActionDone(item))
      .sort((a, b) => {
        const weightDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        if (weightDiff !== 0) return weightDiff;
        return compareDueDate(a, b);
      });
  }, [actionItems, userAliases]);

  const topPriorityItems = myActiveItems.slice(0, 2);

  const todayPriorityItems = useMemo(() => {
    const priorityWeight = { "높음": 3, "보통": 2, "낮음": 1 };
    return actionItems
      .filter((item) => {
        if (!isAssignedToMe(item, userAliases) || isActionDone(item)) return false;
        return getTodayOrTomorrowLabel(item.dueDate) !== null;
      })
      .sort((a, b) => {
        const weightDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        if (weightDiff !== 0) return weightDiff;
        return compareDueDate(a, b);
      });
  }, [actionItems, userAliases]);

  const getProjectMeta = (projectKey) => {
    const p = projects.find((proj) => proj.id === projectKey);
    return { name: p?.name || '', color: p?.color || '#0099CC' };
  };

  const projectFilterOptions = ["전체", ...projects.map((p) => p.id)];

  const isPanelOpen = Boolean(selectedItem);
  const isIntegratingSelected = selectedItem && integratingId === selectedItem.id;
  const mobilePanelBottomOffset = "0px";

  if (!isAuthenticated) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFF] text-[#0D1B2A] antialiased pt-20 pb-20 md:pb-0">
      <style>
        {`
          @keyframes rowSettle { 0% { opacity: 0; transform: translateY(-6px); } 100% { opacity: 1; transform: translateY(0); } }
          .row-settle { animation: rowSettle 0.35s ease-out; }
          @keyframes spinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .spin-slow { animation: spinSlow 0.9s linear infinite; }
          @keyframes completeFlash { 0% { background-color: rgba(16,185,129,0.14); } 100% { background-color: rgba(16,185,129,0); } }
          .complete-flash { animation: completeFlash 1.1s ease-out; }

          /* 사이드 패널 슬라이드 애니메이션 (PC) */
          @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
          @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
          .panel-enter { animation: slideInRight 0.28s cubic-bezier(0.32, 0.72, 0, 1) forwards; }

          /* 바텀시트 슬라이드 애니메이션 (모바일) */
          @keyframes slideInUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          @keyframes slideOutDown { from { transform: translateY(0); opacity: 1; } to { transform: translateY(100%); opacity: 0; } }
          .sheet-enter { animation: slideInUp 0.28s cubic-bezier(0.32, 0.72, 0, 1) forwards; }

          /* 패널 내부 뷰 전환 슬라이드 */
          @keyframes slideInFromRight { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
          @keyframes slideInFromLeft { from { transform: translateX(-24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
          .view-enter-right { animation: slideInFromRight 0.22s ease-out forwards; }
          .view-enter-left { animation: slideInFromLeft 0.22s ease-out forwards; }

          /* 배경 페이드 */
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          .overlay-enter { animation: fadeIn 0.2s ease-out forwards; }
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

      {/* ── 대시보드 (인증) ─────────────────────────────────────────────────── */}
      {isAuthenticated && (
        <div className="flex-1 w-full px-4 md:px-8 py-6 md:py-8">
          <div className="max-w-6xl mx-auto flex flex-col gap-8">

            {/* 상단 헤더 */}
            <div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold text-[#0D1B2A]">안녕하세요, {firstName}님</h1>
                  <p className="text-[#5A6F8A] mt-1">
                    전체 해야 할 일이 <span className="font-bold text-[#0099CC]">{myTotalActionCount}개</span> 있어요
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSummaryExpanded((prev) => !prev)}
                  aria-expanded={isSummaryExpanded}
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0099CC] hover:text-[#0086b3] transition-colors cursor-pointer"
                >
                  {isSummaryExpanded ? "오늘의 요약 접기" : "오늘의 요약 보기"}
                  <LucideIcon name="chevronDown" size={15} className={`transition-transform duration-300 ${isSummaryExpanded ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>

            {/* 요약 패널 */}
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                isSummaryExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-2">
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
                        <p className="text-sm text-[#5A6F8A] inline-flex items-center gap-1.5">
                          <span>오늘 처리할 우선 업무가 없어요. 잘 하고 계세요!</span>
                          <LucideIcon name="sparkles" size={14} className="text-[#7C3AED]" />
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {topPriorityItems.map((item, idx) => {
                          const dday = getDDayInfo(item.dueDate);
                          const pr = PRIORITY_EN[item.priority] || PRIORITY_EN["보통"];
                          return (
                            <div
                              key={item.id}
                              onClick={() => openPanel(item)}
                              className="cursor-pointer rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-4 hover:border-[rgba(0,153,204,0.4)] hover:shadow-md transition-all"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-bold text-[#9AA7B8]">#{idx + 1} 우선</span>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: pr.bg, color: pr.text }}>{pr.label}</span>
                              </div>
                              <h3 className="text-sm font-bold text-[#0D1B2A] leading-snug mb-3 line-clamp-2">{item.title}</h3>
                              <div className="mt-3 flex justify-end">
                                <DDayBadge dday={dday} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="flex flex-col gap-3 rounded-2xl border-2 border-[#7C3AED]/25 bg-gradient-to-br from-[#7C3AED]/[0.06] via-white to-white p-4 sm:p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-[#7C3AED]/15 text-[#7C3AED] flex items-center justify-center">
                        <LucideIcon name="zap" size={14} />
                      </span>
                      <h2 className="text-base font-bold text-[#0D1B2A]">오늘 처리할 업무</h2>
                      <span className="text-[11px] font-bold text-white bg-[#7C3AED] px-2 py-0.5 rounded-full">{todayPriorityItems.length}건</span>
                    </div>

                    {todayPriorityItems.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#7C3AED]/25 bg-white/70 p-6 text-center">
                        <p className="text-sm text-[#5A6F8A]">오늘·내일 마감인 업무가 없어요. 여유롭게 진행하세요.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {todayPriorityItems.map((item) => {
                          const dueLabel = getTodayOrTomorrowLabel(item.dueDate);
                          const pr = PRIORITY_EN[item.priority] || PRIORITY_EN["보통"];
                          const isIntegrating = integratingId === item.id;
                          return (
                            <div
                              key={item.id}
                              className={`flex items-start sm:items-center justify-between gap-3 rounded-xl border border-[#7C3AED]/20 bg-white p-4 transition-opacity ${isIntegrating ? "opacity-50" : ""}`}
                            >
                              <div className="min-w-0">
                                <h3 className="text-sm font-bold text-[#0D1B2A] leading-snug">{item.title}</h3>
                                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${dueLabel === "오늘까지" ? "bg-[#FCE8E6] text-[#EF4444]" : "bg-[#FEF3E2] text-[#B97309]"}`}>{dueLabel}</span>
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: pr.bg, color: pr.text }}>{pr.label}</span>
                                </div>
                                <p className="mt-1.5 text-[11px] text-[#8A9AB0] flex items-center gap-1.5 flex-wrap">
                                  <LucideIcon name="calendar" size={10} className="text-[#9AA7B8]" />
                                  <span>출처: {item.projectName || item.projectKey}</span>
                                  <span className="text-[#D7DEE8]">·</span>
                                  <span>{item.contextTime}</span>
                                </p>
                              </div>
                              {isIntegrating ? (
                                <span className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#7C3AED]">
                                  <LucideIcon name="loader" size={13} className="spin-slow" />처리 중
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => handleQuickApprove(e, item.id)}
                                  className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                >
                                  <LucideIcon name="check" size={12} />완료
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>

            {/* 전체 해야 할 일 */}
            <section className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-bold text-[#0D1B2A]">전체 해야 할 일</h2>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="relative w-full sm:w-72 lg:w-80">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#B0BFCC]">
                      <LucideIcon name="search" size={14} />
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="제목, 담당자, 프로젝트 검색"
                      className="w-full rounded-xl border border-[rgba(0,0,0,0.09)] bg-white py-2 pl-8 pr-9 text-sm text-[#0D1B2A] placeholder-[#B0BFCC] transition focus:border-[#0099CC] focus:outline-none focus:ring-2 focus:ring-[rgba(0,153,204,0.12)]"
                    />
                    {searchQuery && (
                      <button type="button" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B0BFCC] hover:text-[#5A6F8A] transition-colors">
                        <LucideIcon name="x" size={14} />
                      </button>
                    )}
                  </div>

                  <div className="relative w-full sm:w-[132px]" ref={statusDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsStatusSortOpen((prev) => !prev)}
                      className={`flex w-full items-center justify-between gap-1.5 rounded-xl border py-2 pl-3 pr-2.5 text-sm transition ${isStatusSortOpen ? "border-[#0099CC]/40 bg-white shadow-[0_0_0_3px_rgba(0,153,204,0.10)]" : "border-[rgba(0,0,0,0.09)] bg-white text-[#0D1B2A] hover:border-[rgba(0,153,204,0.35)]"}`}
                    >
                      <span className="truncate font-medium text-[#0D1B2A]">{statusFilter === "전체" ? "전체" : getStatusLabel(statusFilter)}</span>
                      <LucideIcon name="chevronDown" size={13} className={`shrink-0 text-[#A0AFBF] transition-transform ${isStatusSortOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isStatusSortOpen && (
                      <div className="absolute left-0 right-0 z-20 mt-1.5 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
                        {STATUS_TABS.map((option) => {
                          const count = option === "전체" ? actionItems.length : actionItems.filter((i) => i.status === option).length;
                          return (
                            <button key={option} type="button" onClick={() => { setStatusFilter(option); setIsStatusSortOpen(false); }}
                              className={`flex w-full items-center justify-between px-3.5 py-2.5 text-sm transition-colors ${statusFilter === option ? "bg-[#F5F7FB] font-semibold text-[#0099CC]" : "text-[#0D1B2A] hover:bg-[#F5F7FB]"}`}
                            >
                              <span className="flex items-center gap-2">
                                {option !== "전체" && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_DOT[option] }}></span>}
                                {option === "전체" ? "전체" : getStatusLabel(option)}
                              </span>
                              <span className="text-xs text-[#9AA7B8]">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="relative w-full sm:w-[190px]" ref={projectDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsProjectFilterOpen((prev) => !prev)}
                      className={`flex w-full items-center justify-between gap-1.5 rounded-xl border py-2 pl-3 pr-2.5 text-sm transition ${isProjectFilterOpen ? "border-[#0099CC]/40 bg-white shadow-[0_0_0_3px_rgba(0,153,204,0.10)]" : "border-[rgba(0,0,0,0.09)] bg-white text-[#0D1B2A] hover:border-[rgba(0,153,204,0.35)]"}`}
                    >
                      <span className="inline-flex items-center gap-2 min-w-0">
                        {projectFilter !== "전체" && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getProjectMeta(projectFilter).color }}></span>}
                        <span className="truncate font-medium text-[#0D1B2A]">{projectFilter === "전체" ? "프로젝트: 전체" : getProjectMeta(projectFilter).name}</span>
                      </span>
                      <LucideIcon name="chevronDown" size={13} className={`shrink-0 text-[#A0AFBF] transition-transform ${isProjectFilterOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isProjectFilterOpen && (
                      <div className="absolute left-0 right-0 z-20 mt-1.5 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
                        {projectFilterOptions.map((key) => {
                          const isActive = projectFilter === key;
                          const palette = key === "전체" ? { color: "#0099CC" } : getProjectMeta(key);
                          const label = key === "전체" ? "전체" : getProjectMeta(key).name;
                          const count = key === "전체"
                            ? actionItems.filter((i) => isAssignedToMe(i, userAliases)).length
                            : actionItems.filter((i) => isAssignedToMe(i, userAliases) && i.projectKey === key).length;
                          return (
                            <button key={key} type="button" onClick={() => { setProjectFilter(key); setIsProjectFilterOpen(false); }}
                              className={`flex w-full items-center justify-between px-3.5 py-2.5 text-sm transition-colors ${isActive ? "bg-[#F5F7FB] font-semibold text-[#0099CC]" : "text-[#0D1B2A] hover:bg-[#F5F7FB]"}`}
                            >
                              <span className="flex items-center gap-2">
                                {key !== "전체" && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: palette.color }}></span>}
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

              {groupedByProject.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[rgba(0,100,180,0.18)] bg-white p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#EEF3FF] flex items-center justify-center mb-4 mx-auto">
                    <LucideIcon name="inbox" size={22} className="text-[#0099CC]" />
                  </div>
                  <p className="text-[#0D1B2A] font-semibold">처리할 해야 할 일이 없어요</p>
                  <p className="text-sm text-[#5A6F8A] mt-1">
                    {isAnyFilterActive ? "다른 필터를 선택해보세요." : "새 회의록을 업로드하면 AI가 해야 할 일을 추출해 드려요."}
                  </p>
                </div>
              )}

              {groupedByProject.map(({ projectKey, items }) => {
                const projectMeta = getProjectMeta(projectKey);
                return (
                  <section key={projectKey}>
                    <div className="mb-3 flex items-center gap-2">
                      {projectMeta.name && <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8] shadow-[0_0_0_4px_rgba(56,189,248,0.14)]"></span>}
                      {projectMeta.name && <span className="text-sm font-bold text-[#0D1B2A]">{projectMeta.name}</span>}
                      {projectMeta.name && (
                        <span className="rounded-full border border-[#7DD3FC]/70 bg-[#E0F2FE] px-2.5 py-0.5 text-xs font-bold text-[#0284C7]">{items.length}개</span>
                      )}
                    </div>

                    <div className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white overflow-hidden">
                      {items.map((item, idx) => {
                        const dday = getDDayInfo(item.dueDate);
                        const isIntegrating = integratingId === item.id;
                        const isJustCompleted = justCompletedId === item.id;
                        const assigneeList = item.assignees && item.assignees.length > 0 ? item.assignees : [item.assignee];
                        const isSelected = selectedItem?.id === item.id;

                        return (
                          <div
                            key={item.id}
                            onClick={() => !isIntegrating && openPanel(item)}
                            className={`row-settle group px-4 sm:px-5 py-[18px] flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 cursor-pointer transition-colors duration-150 ${
                              idx !== items.length - 1 ? "border-b border-[rgba(0,100,180,0.08)]" : ""
                            } ${isIntegrating ? "opacity-50" : ""} ${isJustCompleted ? "complete-flash" : ""} ${
                              isSelected ? "bg-[#EEF3FF]" : "hover:bg-[#F8FAFF]"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_DOT[item.status] || "#94A3B8" }}></span>
                                <span className="text-[11px] font-medium text-[#6B7280]">{getStatusLabel(item.status)}</span>
                              </div>
                              {item.projectName && (
                                <div className="mb-1 inline-flex items-center gap-1.5">
                                  <span className="text-[12px] font-normal text-[#9CA3AF]">프로젝트명: {item.projectName}</span>
                                </div>
                              )}
                              <h4 className={`text-[15px] font-bold leading-snug transition-colors ${isSelected ? "text-[#0099CC]" : "text-[#111827]"}`}>
                                {item.title}
                              </h4>
                              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[11px] text-[#8A9AB0]">
                                <span>{item.meetingDate} 회의</span>
                                <span className="text-[#D7DEE8]">·</span>
                                <span className="inline-flex items-center gap-1">
                                  <LucideIcon name={assigneeList.length > 1 ? "users" : "user"} size={11} className="text-[#9AA7B8]" />
                                  {formatAssignees(item.assignees, item.assignee)}
                                </span>
                              </div>
                            </div>

                            <div className="hidden sm:flex flex-col items-end justify-center shrink-0 sm:w-[88px] py-1">
                              {dday.missing ? (
                                <span className="text-[12px] font-semibold leading-none text-[#9AA7B8]">마감일 없음</span>
                              ) : (
                                <>
                                  <span className={`text-[14px] font-bold leading-[0.8] ${dday.overdue ? "text-[#EF4444]" : dday.urgent ? "text-[#F59E0B]" : "text-[#5A6F8A]"}`}>{dday.label}</span>
                                  <span className="mt-1 text-[11px] font-light leading-[0.8] text-[#9AA7B8]">{formatDueShort(item.dueDate)}</span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 sm:w-[180px]">
                              {item.status !== "검토대기" && (
                                <span className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full border ${STATUS_BADGE_CLASS[item.status] || "border-gray-300 text-gray-500"}`}>
                                  {getStatusLabel(item.status)}
                                </span>
                              )}

                              {isIntegrating ? (
                                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0099CC]">
                                  <LucideIcon name="loader" size={13} className="spin-slow" />연동 중
                                </span>
                              ) : item.status === "연동완료" ? (
                                (() => {
                                  const entry = getIntegrationEntries(item)[0];
                                  const isNotion = entry?.id === "notion";
                                  return (
                                    <a href={entry?.url || "#"} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0099CC] hover:underline"
                                    >
                                      <LucideIcon name={isNotion ? "arrowUpRight" : "jira"} size={13} className="text-[#0099CC]" />
                                      {isNotion ? "Notion 확인" : "Jira 확인"}
                                    </a>
                                  );
                                })()
                              ) : item.status === "검토대기" ? (
                                <button type="button" onClick={(e) => { e.stopPropagation(); openPanel(item); }}
                                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0099CC] border border-[#0099CC]/40 hover:bg-[#0099CC] hover:text-white hover:border-[#0099CC] hover:shadow-[0_4px_12px_rgba(0,153,204,0.25)] px-2.5 py-1.5 rounded-lg transition-all duration-150"
                                >
                                  <LucideIcon name="checkCircle" size={12} />검토하기
                                </button>
                              ) : item.status === "수행완료" ? (
                                hasExternalLink(item) ? (
                                  (() => {
                                    const entry = getIntegrationEntries(item)[0];
                                    return (
                                      <a href={entry?.url || "#"} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0099CC] hover:underline"
                                      >
                                        <LucideIcon name={entry?.id === "notion" ? "arrowUpRight" : "jira"} size={13} className="text-[#0099CC]" />
                                        {entry?.label || "외부 툴"} 확인
                                      </a>
                                    );
                                  })()
                                ) : (
                                  <button type="button" onClick={(e) => { e.stopPropagation(); openPanel(item); setPanelView("integrate"); }}
                                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0099CC] border border-[#0099CC]/40 hover:bg-[#0099CC] hover:text-white hover:border-[#0099CC] hover:shadow-[0_4px_12px_rgba(0,153,204,0.25)] px-2.5 py-1.5 rounded-lg transition-all duration-150"
                                  >
                                    <LucideIcon name="jira" size={12} />연동하기
                                  </button>
                                )
                              ) : (
                                <button type="button" onClick={(e) => { e.stopPropagation(); openPanel(item); }}
                                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0099CC] border border-[#0099CC]/40 hover:bg-[#0099CC] hover:text-white hover:border-[#0099CC] hover:shadow-[0_4px_12px_rgba(0,153,204,0.25)] px-2.5 py-1.5 rounded-lg transition-all duration-150"
                                >
                                  <LucideIcon name="jira" size={12} />연동하기
                                </button>
                              )}

                              <div className="sm:hidden inline-flex flex-col items-end justify-center py-0.5">
                                {dday.missing ? (
                                  <span className="text-[11px] font-semibold leading-none text-[#9AA7B8]">마감일 없음</span>
                                ) : (
                                  <>
                                    <span className={`text-[13px] font-bold leading-[0.9] ${dday.overdue ? "text-[#EF4444]" : dday.urgent ? "text-[#F59E0B]" : "text-[#5A6F8A]"}`}>{dday.label}</span>
                                    <span className="mt-1 text-[10px] font-light leading-[0.9] text-[#9AA7B8]">{formatDueShort(item.dueDate)}</span>
                                  </>
                                )}
                              </div>
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

      {/* ══════════════════════════════════════════════════════════════════════
          PC: 우측 사이드 패널 / 모바일: 하단 바텀시트.
          panelView: "detail" | "integrate"
      ══════════════════════════════════════════════════════════════════════ */}
      {isPanelOpen && (
        <div
          className={`overlay-enter fixed inset-0 z-[200] flex ${isMobile ? "items-end" : "justify-end"}`}
          style={{
            backgroundColor: "rgba(13,27,42,0.35)",
            backdropFilter: "blur(2px)",
            bottom: isMobile ? mobilePanelBottomOffset : "0px"
          }}
          onClick={handleOverlayClick}
        >
          <div
            ref={panelRef}
            className={
              isMobile
                ? "sheet-enter relative flex flex-col bg-white w-full max-h-[85vh] rounded-t-2xl shadow-2xl overflow-hidden"
                : "panel-enter relative flex flex-col bg-white h-full w-full max-w-[520px] border-l border-[rgba(0,100,180,0.14)] shadow-2xl overflow-hidden"
            }
            onClick={(e) => e.stopPropagation()}
          >
            {isMobile && (
              <div className="shrink-0 pt-2.5 pb-1 flex justify-center">
                <span className="w-9 h-1.5 rounded-full bg-[#E2E8F0]"></span>
              </div>
            )}
            {/* ── 패널 헤더 ─────────────────────────────────────────────────── */}
            <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-[rgba(0,100,180,0.1)]">
              <div className="flex items-center gap-2 min-w-0">
                {panelView === "integrate" ? (
                  <button
                    type="button"
                    onClick={() => setPanelView("detail")}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#5A6F8A] hover:text-[#0D1B2A] transition-colors cursor-pointer -ml-1 px-1"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    뒤로
                  </button>
                ) : (
                  (() => {
                    const panelStatusStyle = getPanelStatusStyle(selectedItem.status);
                    return (
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap"
                        style={{
                          backgroundColor: panelStatusStyle.bg,
                          color: panelStatusStyle.color,
                          borderColor: `${panelStatusStyle.border}40`
                        }}
                      >
                        {getStatusLabel(selectedItem.status)}
                      </span>
                    );
                  })()
                )}
              </div>

              <div className="flex items-center gap-2">
                {panelView === "detail" && (
                  <button
                    type="button"
                    onClick={handleTogglePanelEdit}
                    className={`w-8 h-8 rounded-lg border transition-colors cursor-pointer inline-flex items-center justify-center ${
                      isPanelEditable
                        ? "bg-[#EEF3FF] text-[#0099CC] border-[#0099CC]/40 hover:bg-[#E3EEFF]"
                        : "bg-white text-[#5A6F8A] border-[rgba(0,0,0,0.1)] hover:text-[#0D1B2A] hover:bg-[#F8FAFF]"
                    }`}
                    aria-label={isPanelEditable ? "수정 잠금" : "수정하기"}
                    title={isPanelEditable ? "수정 잠금" : "수정하기"}
                  >
                    <LucideIcon name="pencil" size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={closePanel}
                  className="w-8 h-8 rounded-lg text-[#5A6F8A] hover:bg-[#F8FAFF] hover:text-[#0D1B2A] transition-colors cursor-pointer"
                  aria-label="패널 닫기"
                >
                  <LucideIcon name="x" size={17} />
                </button>
              </div>
            </div>

            {/* ── 패널 바디 ─────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">

              {/* ▸ 상세 뷰 */}
              {panelView === "detail" && (
                <div className="view-enter-left px-4 sm:px-5 py-4 space-y-4">
                  {/* 프로젝트 + 출처 배지 */}
                  <div className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-[#F8FAFF] p-3.5">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {selectedItem.projectName && (
                        <span
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#EEF3FF] text-[#0099CC]"
                        >
                          #{selectedItem.projectName}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#5A6F8A] bg-white border border-[rgba(0,100,180,0.12)] px-2.5 py-1 rounded-full">
                        출처: {selectedItem.projectName || '회의록'}
                      </span>
                    </div>
                    <p className="text-xs text-[#5A6F8A]">타임스탬프: {selectedItem.meetingDate} {selectedItem.contextTime}</p>
                  </div>

                  {/* 제목 */}
                  <div className="space-y-1.5">
                    <label className={`block ${PANEL_FIELD_LABEL_CLASS}`}>제목</label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      readOnly={!isPanelEditable}
                      className={`w-full px-3.5 py-2.5 border border-[rgba(0,100,180,0.14)] rounded-xl text-sm focus:border-[#0099CC] focus:outline-none ${
                        isPanelEditable ? "bg-white" : "bg-[#F8FAFF] text-[#5A6F8A]"
                      }`}
                    />
                  </div>

                  {/* 설명 */}
                  <div className="space-y-1.5">
                    <label className={`block ${PANEL_FIELD_LABEL_CLASS}`}>설명</label>
                    <textarea
                      rows={4}
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      readOnly={!isPanelEditable}
                      className={`w-full px-3.5 py-2.5 border border-[rgba(0,100,180,0.14)] rounded-xl text-sm focus:border-[#0099CC] focus:outline-none resize-none ${
                        isPanelEditable ? "bg-white" : "bg-[#F8FAFF] text-[#5A6F8A]"
                      }`}
                    />
                  </div>

                  {/* 마감 + 담당자 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative space-y-1.5" ref={dueDateDropdownRef}>
                      <label className={`block ${PANEL_FIELD_LABEL_CLASS}`}>마감 기한</label>
                      <button
                        ref={dueDateButtonRef}
                        type="button"
                        onClick={() => {
                          if (!isPanelEditable) return;
                          setIsAssigneeOpen(false);
                          setIsDueDateOpen((prev) => !prev);
                        }}
                        className={`flex w-full items-center justify-between gap-1.5 rounded-xl border py-2 pl-3 pr-2.5 text-sm transition ${
                          isDueDateOpen
                            ? "border-[#0099CC]/40 bg-white shadow-[0_0_0_3px_rgba(0,153,204,0.10)]"
                            : isPanelEditable
                            ? "border-[rgba(0,0,0,0.09)] bg-white text-[#0D1B2A] hover:border-[rgba(0,153,204,0.35)] cursor-pointer"
                            : "border-[rgba(0,0,0,0.09)] bg-[#F8FAFF] text-[#5A6F8A] cursor-not-allowed"
                        }`}
                        aria-disabled={!isPanelEditable}
                      >
                        <span className={`truncate ${editForm.dueDate ? "text-[#0D1B2A]" : "text-[#9AA7B8]"}`}>{editForm.dueDate || "날짜 선택"}</span>
                        <LucideIcon name="calendar" size={13} className="shrink-0 text-[#A0AFBF]" />
                      </button>
                      {isDueDateOpen && (
                        <CustomDatePicker
                          ref={datePickerRef}
                          value={editForm.dueDate}
                          onSelect={(dateStr) => setEditForm({ ...editForm, dueDate: dateStr })}
                          onClose={() => setIsDueDateOpen(false)}
                          anchorRef={dueDateButtonRef}
                          panelRef={panelRef}
                        />
                      )}
                    </div>

                    <div className="relative space-y-1.5" ref={assigneeDropdownRef}>
                      <label className={`block ${PANEL_FIELD_LABEL_CLASS}`}>담당자</label>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isPanelEditable) return;
                          setIsAssigneeOpen((prev) => !prev);
                        }}
                        className={`flex w-full items-center justify-between gap-1.5 rounded-xl border py-2 pl-3 pr-2.5 text-sm transition ${
                          isAssigneeOpen
                            ? "border-[#0099CC]/40 bg-white shadow-[0_0_0_3px_rgba(0,153,204,0.10)]"
                            : isPanelEditable
                            ? "border-[rgba(0,0,0,0.09)] bg-white text-[#0D1B2A] hover:border-[rgba(0,153,204,0.35)] cursor-pointer"
                            : "border-[rgba(0,0,0,0.09)] bg-[#F8FAFF] text-[#5A6F8A] cursor-not-allowed"
                        }`}
                        aria-disabled={!isPanelEditable}
                      >
                        <span className="truncate text-[#0D1B2A]">{editForm.assignee}</span>
                        <LucideIcon name="chevronDown" size={13} className={`shrink-0 text-[#A0AFBF] transition-transform ${isAssigneeOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isAssigneeOpen && (
                        <div className="absolute left-0 right-0 z-20 bottom-full mb-1.5 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
                          {(() => {
                            const currentProject = projects.find((p) => p.id === selectedItem?.projectKey);
                            const memberNames = Array.isArray(currentProject?.members)
                              ? currentProject.members.map((m) => m?.name || m?.email || '').filter(Boolean)
                              : [];
                            const ownerName = currentProject?.owner?.name || currentProject?.team_lead || '';
                            const allNames = [...new Set([ownerName, ...memberNames].filter(Boolean))];
                            return allNames.length > 0 ? allNames.map((name) => {
                              const isSelected = editForm.assignee === name;
                              return (
                                <button key={name} type="button"
                                  onClick={() => { setEditForm({ ...editForm, assignee: name }); setIsAssigneeOpen(false); }}
                                  className={`flex w-full items-center justify-between px-3.5 py-2.5 text-sm transition-colors cursor-pointer ${isSelected ? "bg-[#F5F7FB] font-semibold text-[#0099CC]" : "text-[#0D1B2A] hover:bg-[#F5F7FB]"}`}
                                >
                                  <span>{name}</span>
                                  {isSelected && <LucideIcon name="check" size={13} className="text-[#0099CC]" />}
                                </button>
                              );
                            }) : (
                              <div className="px-3.5 py-2.5 text-sm text-[#9AA7B8]">멤버 없음</div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 외부 툴 링크 카드 */}
                  {hasExternalLink(selectedItem) && (
                    <div className="space-y-2">
                      {getIntegrationEntries(selectedItem).map((entry) => (
                        <div key={entry.id} className="rounded-2xl border border-[rgba(0,153,204,0.28)] bg-[#EEF8FF] px-3.5 py-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0 w-7 h-7 rounded-lg bg-[#EEF3FF] text-[#0099CC] flex items-center justify-center">
                              <LucideIcon name="checkCircle" size={15} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[12px] font-bold text-[#0D1B2A]">{entry.label} 링크 바로가기</p>
                              <p className="text-[11px] text-[#5A6F8A] truncate">{entry.url}</p>
                            </div>
                          </div>
                          <a
                            href={entry.url}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-[#0099CC] hover:underline"
                          >
                            {entry.label} 확인
                            <LucideIcon name="arrowUpRight" size={12} />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ▸ 연동 도구 선택 뷰 */}
              {panelView === "integrate" && (
                <div className="view-enter-right px-4 sm:px-5 py-4 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-[#0D1B2A]">연동 도구 선택</h3>
                    <p className="text-sm text-[#5A6F8A] mt-1">이 해야 할 일을 어떤 툴로 내보낼까요?</p>
                  </div>

                  {isIntegratingSelected ? (
                    <div className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-[#F8FAFF] p-8 flex flex-col items-center justify-center gap-3">
                      <LucideIcon name="loader" size={28} className="spin-slow text-[#0099CC]" />
                      <p className="text-sm font-semibold text-[#5A6F8A]">연동 중입니다…</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {[
                        {
                          id: "jira",
                          icon: "jira",
                          title: "Jira로 연동",
                          desc: "Jira API를 통해 이슈 티켓을 자동 생성합니다.",
                          tone: "#0099CC",
                          bg: "#EEF3FF",
                        },
                        {
                          id: "notion",
                          icon: "notion",
                          title: "Notion으로 연동",
                          desc: "Notion 페이지에 태스크로 자동 추가합니다.",
                          tone: "#7C3AED",
                          bg: "#F6F0FF",
                        },
                      ].map((tool) => {
                        const alreadyLinked = Boolean(getIntegrationLinks(selectedItem)[tool.id]);
                        const selected = selectedIntegrationTools.includes(tool.id);
                        return (
                          <button
                            key={tool.id}
                            type="button"
                            disabled={alreadyLinked}
                            onClick={() => {
                              if (alreadyLinked) return;
                              setSelectedIntegrationTools((prev) =>
                                prev.includes(tool.id) ? prev.filter((id) => id !== tool.id) : [...prev, tool.id]
                              );
                            }}
                            className="group w-full flex items-center gap-4 p-4 rounded-2xl border-2 bg-white transition-all text-left disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
                            style={{
                              borderColor: alreadyLinked || selected ? tool.tone : "rgba(0,100,180,0.12)",
                              background: alreadyLinked || selected ? tool.bg : "#fff",
                            }}
                          >
                            <span className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-colors" style={{ background: tool.bg, color: tool.tone }}>
                              <LucideIcon name={tool.icon} size={tool.id === "jira" ? 24 : 22} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-[#0D1B2A]">{tool.title}</p>
                              <p className="text-[12px] text-[#5A6F8A] mt-0.5">{alreadyLinked ? "이미 연동 완료된 도구입니다." : tool.desc}</p>
                            </div>
                            <span className="shrink-0 w-6 h-6 rounded-full border flex items-center justify-center" style={{ borderColor: alreadyLinked || selected ? tool.tone : "#C0CFDC", background: alreadyLinked || selected ? tool.tone : "#fff" }}>
                              {(alreadyLinked || selected) && <LucideIcon name="check" size={13} className="text-white" />}
                            </span>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        disabled={selectedIntegrationTools.length === 0}
                        onClick={() => handleApprove(selectedItem.id, selectedIntegrationTools)}
                        className="mt-1 w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ background: "linear-gradient(135deg,#0099CC,#7C3AED)" }}
                      >
                        선택한 도구로 연동
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── 패널 푸터 ─────────────────────────────────────────────────── */}
            {panelView === "detail" && (
              <div className="shrink-0 px-5 py-4 border-t border-gray-100 bg-[#F8FAFF] flex items-center justify-between gap-3">
                {/* 삭제 확인 인라인 — 별도 모달 없이 푸터 영역에서 처리 */}
                {deleteConfirmOpen ? (
                  <div className="flex items-center gap-2 w-full">
                    <p className="text-[13px] text-[#EF4444] font-semibold flex-1">정말 삭제할까요?</p>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmOpen(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-[#5A6F8A] hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-[#EF4444] hover:bg-[#DC2626] rounded-lg transition-colors cursor-pointer"
                    >
                      삭제
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmOpen(true)}
                      className="px-3.5 py-2 text-xs font-semibold text-[#EF4444] hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <LucideIcon name="trash" size={12} />
                      삭제
                    </button>

                    <div className="flex items-center gap-2">
                      {selectedItem.status === "검토대기" && (
                        <button
                          type="button"
                          onClick={() => {
                            handleVerify(selectedItem.id);
                            closePanel();
                          }}
                          className="px-5 py-2.5 text-sm font-bold text-white bg-[#0099CC] hover:bg-[#0086b3] rounded-xl shadow-md shadow-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <LucideIcon name="checkCircle" size={14} />
                          검토완료
                        </button>
                      )}
                      {selectedItem.status === "검토완료" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleMarkDone(selectedItem.id)}
                            className="px-5 py-2.5 text-sm font-bold text-[#7C3AED] bg-white border border-[#7C3AED]/60 hover:bg-[#F6F0FF] rounded-xl shadow-sm transition-all cursor-pointer"
                          >
                            수행완료
                          </button>
                          <button
                            type="button"
                            onClick={() => setPanelView("integrate")}
                            className="px-5 py-2.5 text-sm font-bold text-white bg-[linear-gradient(135deg,#10B981,#0D9488)] hover:brightness-105 rounded-xl shadow-md shadow-emerald-500/25 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <LucideIcon name="zap" size={14} className="text-white" />
                            연동하기
                          </button>
                        </>
                      )}
                      {selectedItem.status === "연동완료" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleMarkDone(selectedItem.id)}
                            className="px-5 py-2.5 text-sm font-bold text-[#7C3AED] bg-white border border-[#7C3AED]/60 hover:bg-[#F6F0FF] rounded-xl shadow-sm transition-all cursor-pointer"
                          >
                            수행완료
                          </button>
                          {getIntegrationEntries(selectedItem).length < 2 && (
                            <button
                              type="button"
                              onClick={() => setPanelView("integrate")}
                              className="px-5 py-2.5 text-sm font-bold text-white bg-[linear-gradient(135deg,#10B981,#0D9488)] hover:brightness-105 rounded-xl shadow-md shadow-emerald-500/25 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <LucideIcon name="zap" size={14} className="text-white" />
                              추가 연동
                            </button>
                          )}
                        </>
                      )}
                      {selectedItem.status === "수행완료" && getIntegrationEntries(selectedItem).length < 2 && (
                        <button
                          type="button"
                          onClick={() => setPanelView("integrate")}
                          className="px-5 py-2.5 text-sm font-bold text-white bg-[linear-gradient(135deg,#10B981,#0D9488)] hover:brightness-105 rounded-xl shadow-md shadow-emerald-500/25 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <LucideIcon name="zap" size={14} className="text-white" />
                          {hasExternalLink(selectedItem) ? "추가 연동" : "연동하기"}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <ToastPopup show={toast.show} message={toast.message} type={toast.type} />
      {!isMobile && <Footer />}
      {isMobile && !isPanelOpen && <MobileTab active={activeTab} onChange={setActiveTab} />}
    </div>
  );
}
