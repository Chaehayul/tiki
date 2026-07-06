import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import MobileTab from "../components/MobileTab";
import {
  changeCurrentUserPassword,
  clearAuthSession,
  deleteCurrentUser,
  getProject,
  getProjectIntegrations,
  getSubscription,
  listAuthSessions,
  listProjectMeetings,
  listProjects,
  listProjectTickets,
  logoutOtherAuthSessions,
  revokeAuthSession,
  subscribePlan,
  updateCurrentUser,
} from "../api/apiClient";
import { PLANS, yearlyDiscount } from "../data/subscriptionPlans";
import { DEPARTMENTS, POSITIONS } from "../data/profileOptions";

// ── Icons ──────────────────────────────────────────────────────────────────
const ICON_PATHS = {
  user: ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2","M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  lock: ["M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z","M7 11V7a5 5 0 0 1 10 0v4"],
  link: ["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71","M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","M7 10l5 5 5-5","M12 15V3"],
  monitor: ["M20 3H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z","M8 21h8","M12 17v4"],
  camera: ["M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 0 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z","M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  eye: ["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z","M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0"],
  eyeOff: ["M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94","M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19","M1 1l22 22"],
  check: ["M20 6L9 17l-5-5"],
  checkCircle: ["M22 11.08V12a10 10 0 1 1-5.93-9.14","M22 4L12 14.01l-3-3"],
  alertTriangle: ["M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z","M12 9v4","M12 17h.01"],
  x: ["M18 6L6 18","M6 6l12 12"],
  trash2: ["M3 6h18","M19 6l-1 14H6L5 6","M8 6V4h8v2","M10 11v6","M14 11v6"],
  logOut: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4","M16 17l5-5-5-5","M21 12H9"],
  shieldCheck: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z","M9 12l2 2 4-4"],
  chevronRight: ["M9 18l6-6-6-6"],
  chevronDown: ["M6 9l6 6 6-6"],
  smartphone: ["M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z","M12 18h.01"],
  globe: ["M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z","M2 12h20","M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
  upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","M17 8l-5-5-5 5","M12 3v12"],
  menu: ["M3 12h18","M3 6h18","M3 18h18"],
  linkOff: ["M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71","M5.17 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71","M1 1l22 22"],
  arrowLeft: ["M19 12H5","M12 19l-7-7 7-7"],
  briefcase: ["M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z","M16 7V5H8v2"],
  creditCard: ["M22 10V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4","M2 10h20","M6 14h2","M10 14h6","M4 18h16a2 2 0 0 0 2-2v-2H2v2a2 2 0 0 0 2 2z"],
  sparkles: ["M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z","M5 17l.8 2.2L8 20l-2.2.8L5 23l-.8-2.2L2 20l2.2-.8L5 17z","M19 15l.7 1.9L21.5 17.6l-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9z"],
  helpCircle: ["M9.09 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3","M12 17h.01","M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"],
  home: ["M3 9.5L12 3l9 6.5","M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10","M9 21v-6h6v6"],
  pencil: ["M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z","M15 5l4 4"],
  mail: ["M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z","M22 6l-10 7L2 6"],
};

function Icon({ name, size = 16, color = "currentColor", sw = 1.8 }) {
  const paths = ICON_PATHS[name];
  if (!paths) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      className="block shrink-0">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

const cn = (...c) => c.filter(Boolean).join(" ");

// ── Data ──────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "home",        label: "홈",             icon: "home" },
  { id: "profile",     label: "프로필",         icon: "user" },
  { id: "security",    label: "보안",           icon: "lock" },
  { id: "integrations",label: "연동",           icon: "link" },
  { id: "subscription",label: "구독권 관리",     icon: "creditCard" },
  { id: "sessions",    label: "세션 관리",       icon: "monitor" },
  { id: "data",        label: "데이터",          icon: "download" },
];

const ROLE_LABELS = {
  dev: "개발자",
  pm: "PM",
  design: "디자이너",
  other: "기타",
};

const DEVICES = [
  { id: 1, name: "Chrome · Windows 11", location: "Seoul, KR", lastActive: "현재 접속 중", icon: "monitor", current: true },
  { id: 2, name: "Safari · iPhone 15",  location: "Seoul, KR", lastActive: "1시간 전",     icon: "smartphone", current: false },
  { id: 3, name: "Chrome · macOS",      location: "Busan, KR", lastActive: "3일 전",       icon: "globe", current: false },
];


const PROFILE_ALIAS_STORAGE_KEY = "tiki_profile_identity_aliases";
const PLAN_TIER = { free: 0, pro: 1, team: 2 };

// ── Tiny helpers ──────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={cn(
      "fixed bottom-24 sm:bottom-6 left-1/2 z-[200] -translate-x-1/2 flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(0,0,0,.18)] backdrop-blur-sm",
      type === "success" ? "bg-[#10B981]" : "bg-[#EF4444]"
    )}>
      <Icon name={type === "success" ? "checkCircle" : "alertTriangle"} size={15} color="#fff" />
      {message}
    </div>
  );
}

function Modal({ title, body, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[380px] rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-6 shadow-[0_32px_80px_rgba(0,0,0,.2)]">
        <div className={cn("mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full",
          danger ? "bg-[rgba(239,68,68,.1)]" : "bg-[rgba(0,153,204,.1)]")}>
          <Icon name={danger ? "alertTriangle" : "shieldCheck"} size={20}
            color={danger ? "#EF4444" : "#0099CC"} />
        </div>
        <h3 className="mb-1.5 text-center text-[16px] font-bold text-[#0D1B2A]">{title}</h3>
        <p className="mb-6 text-center text-[13px] leading-[1.65] text-[#5A6F8A]">{body}</p>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 rounded-xl border border-[rgba(0,0,0,.1)] bg-[rgba(0,0,0,.04)] py-2.5 text-[13px] font-semibold text-[#5A6F8A]">
            취소
          </button>
          <button onClick={onConfirm}
            className={cn("flex-1 rounded-xl py-2.5 text-[13px] font-bold text-white",
              danger ? "bg-[#EF4444]" : "bg-[linear-gradient(135deg,#0099CC,#7C3AED)]")}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────
function Field({ label, hint, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-[13px] font-semibold text-[#0D1B2A]">{label}</label>}
      {children}
      {error && <p className="text-[12px] text-[#EF4444]">{error}</p>}
      {hint && !error && <p className="text-[12px] text-[#5A6F8A]">{hint}</p>}
    </div>
  );
}

function Input({ type = "text", value, onChange, placeholder, disabled, error, rightEl }) {
  return (
    <div className="relative">
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
        className={cn(
          "w-full rounded-xl border px-3.5 py-2.5 text-[13px] text-[#0D1B2A] outline-none transition-all placeholder:text-[#9BAABE]",
          disabled ? "cursor-not-allowed border-[rgba(0,100,180,.08)] bg-[#F8FAFF] text-[#9BAABE]"
            : error ? "border-[#EF4444]/40 bg-[#FFF5F5] focus:border-[#EF4444]/70 focus:ring-2 focus:ring-[#EF4444]/10"
            : "border-[rgba(0,100,180,.15)] bg-white focus:border-[rgba(0,153,204,.45)] focus:ring-2 focus:ring-[rgba(0,153,204,.08)]",
          rightEl ? "pr-10" : ""
        )} />
      {rightEl && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightEl}</div>}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────
function Select({ value, onChange, options, error, placeholder, autoOpen = false }) {
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

  useEffect(() => {
    if (autoOpen) {
      setOpen(true);
    }
  }, [autoOpen]);

  const handleSelect = (option) => {
    onChange({ target: { value: option } });
    setOpen(false);
  };

  const displayText = value || placeholder || "선택";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "w-full px-3.5 py-2.5 text-[13px] rounded-xl border transition flex items-center justify-between cursor-pointer",
          open
            ? "bg-[#EEF3FF] border-[#0099CC]/40 shadow-[0_0_0_3px_rgba(0,153,204,0.12)] text-[#0D1B2A]"
            : error
            ? "bg-[#FFF5F5] border-[#EF4444]/40 text-[#0D1B2A] hover:border-[#EF4444]/60"
            : "bg-white border-[rgba(0,100,180,.15)] text-[#0D1B2A] hover:border-[rgba(0,153,204,0.4)]"
        )}
      >
        <span className={cn("truncate", !value && "text-[#9BAABE]")}>{displayText}</span>
        <Icon
          name="chevronDown"
          size={14}
          color="#5A6F8A"
          sw={2}
          className={cn("transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute z-20 bottom-full mb-2 w-full overflow-hidden rounded-lg border border-[rgba(0,100,180,.14)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)]">
          {options.map((option) => {
            const isSelected = value === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleSelect(option)}
                className={cn(
                  "w-full px-3 py-2 text-[13px] text-left flex items-center justify-between transition-colors cursor-pointer",
                  isSelected
                    ? "bg-[#EEF3FF] text-[#0099CC] font-semibold"
                    : "text-[#0D1B2A] hover:bg-[#F8FAFF]"
                )}
              >
                <span>{option}</span>
                {isSelected && <Icon name="check" size={14} color="#0099CC" />}
              </button>
            );
          })}
        </div>
      )}

      <div className="sr-only" aria-hidden="true">
        {placeholder}
      </div>
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────
function Divider({ label }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-[rgba(0,100,180,.08)]" />
      {label && <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9BAABE]">{label}</span>}
      <div className="h-px flex-1 bg-[rgba(0,100,180,.08)]" />
    </div>
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────
function Badge({ label, variant = "default" }) {
  const styles = {
    default: "bg-[rgba(0,60,150,.06)] text-[#5A6F8A]",
    success: "bg-[rgba(16,185,129,.1)] text-[#10B981]",
    warning: "bg-[rgba(245,158,11,.1)] text-[#D97706]",
    error:   "bg-[rgba(239,68,68,.1)] text-[#EF4444]",
    cyan:    "bg-[rgba(0,153,204,.1)] text-[#0099CC]",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold", styles[variant])}>
      {label}
    </span>
  );
}

// ── Save Button ────────────────────────────────────────────────────────────
function SaveButton({ onClick, loading, label = "변경사항 저장" }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0099CC_0%,#0077AA_100%)] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_2px_12px_rgba(0,153,204,.25)] transition-all hover:shadow-[0_4px_18px_rgba(0,153,204,.35)] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0">
      {loading
        ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />처리 중...</>
        : <><Icon name="check" size={13} color="#fff" sw={2.5} />{label}</>
      }
    </button>
  );
}

// ── Password strength ──────────────────────────────────────────────────────
function PwStrengthBar({ password }) {
  if (!password) return null;
  let s = 0;
  if (password.length >= 8) s++;
  if (/[A-Z]/.test(password)) s++;
  if (/[0-9]/.test(password)) s++;
  if (/[@$!%*?&]/.test(password)) s++;
  const colors = ["", "#EF4444", "#F59E0B", "#0099CC", "#10B981"];
  const labels = ["", "취약", "보통", "강함", "매우 강함"];
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-1 flex-1 rounded-full overflow-hidden bg-[rgba(0,0,0,.06)]">
            <div className="h-full rounded-full transition-all duration-400"
              style={{ width: s >= i ? "100%" : "0%", background: colors[s] }} />
          </div>
        ))}
      </div>
      <p className="text-[11px] font-semibold" style={{ color: colors[s] }}>{labels[s]}</p>
    </div>
  );
}

// ── Greeting helper ─────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return "늦은 시간까지 고생 많으세요";
  if (h < 12) return "좋은 아침이에요";
  if (h < 18) return "오늘도 좋은 하루 보내고 계신가요";
  return "오늘 하루도 고생 많으셨어요";
}

function formatPlanFeatureLabel(label) {
  if (!label) return "";

  const meetingMatch = label.match(/^월\s*(\d+)회\s*회의 분석$/);
  if (meetingMatch) return `회의 분석: 월 ${meetingMatch[1]}회`;

  const recordingMatch = label.match(/^음성 녹음\s*(.+)$/);
  if (recordingMatch) {
    return recordingMatch[1] === "무제한"
      ? "음성 녹음: 무제한"
      : `음성 녹음: 최대 ${recordingMatch[1]}`;
  }

  if (label === "기본 STT 전사") return "STT 전사: 기본 품질";
  if (label.includes("고급 STT 전사")) return "STT 전사: 고급 품질";
  if (label === "무제한 회의 분석") return "회의 분석: 무제한";

  return label;
}

function PlanFeatureList({ features, tone = "cyan" }) {
  const toneClass = tone === "neutral"
    ? "border-[rgba(0,100,180,.1)] bg-white"
    : "border-[rgba(0,153,204,.16)] bg-[rgba(0,153,204,.04)]";

  return (
    <div className={cn("mt-2.5 rounded-xl border p-2.5", toneClass)}>
      <div className="space-y-1.5">
        {features.map((feature) => (
          <div
            key={`feature-row-${feature.label}`}
            className="flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-2"
          >
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(0,153,204,.12)]">
              <Icon name="check" size={11} color="#0099CC" sw={2.5} />
            </span>
            <span className="text-[12px] font-semibold text-[#0D1B2A]">
              {formatPlanFeatureLabel(feature.label)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sections
// ═══════════════════════════════════════════════════════════════════════════

// ── Home (마이페이지 홈 대시보드) ───────────────────────────────────────────
function StatBlock({ value, label, accent }) {
  return (
    <div className="text-center">
      <p className={cn("text-[26px] font-black tracking-[-1px]", accent ? "text-[#0099CC]" : "text-[#0D1B2A]")}>{value}</p>
      <p className="mt-0.5 text-[12px] text-[#5A6F8A]">{label}</p>
    </div>
  );
}

function UsageBar({ label, value, max, unit = "" }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-[#5A6F8A]">{label}</span>
        <span className="font-bold text-[#0D1B2A]">{value}{unit} / {max}{unit}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(0,100,180,.08)]">
        <div className="h-full rounded-full bg-[linear-gradient(135deg,#0099CC,#7C3AED)] transition-all"
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const PROJECT_OVERRIDE_STORAGE_KEY = "tiki_project_overrides";
const MANUAL_MEETING_RECORDS_KEY = "tiki_manual_minutes_records";
const PROJECT_CATALOG_STORAGE_KEY = "tiki_project_catalog";

const STATUS_LABELS = {
  synced: "연동완료",
  ready: "검토완료",
  done: "수행완료",
  completed: "수행완료",
  "검증 전": "검토대기",
  "진행중": "검토완료",
  "연동 완료": "연동완료",
  "완료": "수행완료",
  "완료히스토리": "수행완료",
};

const readJsonObject = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const readJsonArray = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeJsonValue = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 로컬 저장 실패 시 현재 화면 갱신은 계속 진행한다.
  }
};

function migrateLocalProfileReferences(previousAliases = [], nextName = "", nextEmail = "") {
  const normalizedAliases = new Set(
    previousAliases.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
  );
  if (normalizedAliases.size === 0 || !nextName.trim()) return;

  const isMine = (value) => normalizedAliases.has(String(value || "").trim().toLowerCase());
  const migrateAction = (item) => {
    const assignee = isMine(item?.assignee) ? nextName : item?.assignee;
    const assigneeEmail = isMine(item?.assigneeEmail || item?.assignee_email) ? nextEmail : (item?.assigneeEmail || item?.assignee_email);
    const assignees = Array.isArray(item?.assignees)
      ? item.assignees.map((value) => isMine(value) ? nextName : value)
      : item?.assignee && isMine(item.assignee) ? [nextName] : item?.assignees;
    return {
      ...item,
      assignee,
      assigneeEmail,
      assignees,
    };
  };

  const overrides = readJsonObject(PROJECT_OVERRIDE_STORAGE_KEY);
  let touchedOverrides = false;
  const nextOverrides = Object.fromEntries(Object.entries(overrides).map(([projectId, override]) => {
    if (!override || typeof override !== "object") return [projectId, override];
    let touchedProject = false;
    const myActionItems = Array.isArray(override.myActionItems)
      ? override.myActionItems.map((item) => {
        const migrated = migrateAction(item);
        if (JSON.stringify(migrated) !== JSON.stringify(item)) touchedProject = true;
        return migrated;
      })
      : override.myActionItems;
    if (touchedProject) touchedOverrides = true;
    return [projectId, { ...override, myActionItems }];
  }));
  if (touchedOverrides) writeJsonValue(PROJECT_OVERRIDE_STORAGE_KEY, nextOverrides);

  const manualRecords = readJsonObject(MANUAL_MEETING_RECORDS_KEY);
  let touchedManual = false;
  const nextManualRecords = Object.fromEntries(Object.entries(manualRecords).map(([recordId, record]) => {
    if (!record || typeof record !== "object" || !Array.isArray(record.actions)) return [recordId, record];
    let touchedRecord = false;
    const actions = record.actions.map((item) => {
      const migrated = migrateAction(item);
      if (JSON.stringify(migrated) !== JSON.stringify(item)) touchedRecord = true;
      return migrated;
    });
    if (touchedRecord) touchedManual = true;
    return [recordId, { ...record, actions }];
  }));
  if (touchedManual) writeJsonValue(MANUAL_MEETING_RECORDS_KEY, nextManualRecords);
}

function isTemporaryProject(project) {
  return String(project?.name || "").toLowerCase().includes("codex invitation check");
}

function normalizeStatus(status) {
  const raw = String(status || "").trim();
  return STATUS_LABELS[raw] || raw || "검토대기";
}

function parseFlexibleDate(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "-" || raw === "미정") return null;
  const normalized = raw.replace(/[.]/g, "-");
  const iso = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const korean = raw.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  const short = raw.match(/^(\d{1,2})[./-](\d{1,2})$/);
  const [, year, month, day] = iso
    ? iso
    : korean
      ? korean
      : short
        ? [null, new Date().getFullYear(), short[1], short[2]]
        : [];
  if (!year || !month || !day) return null;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function getMeetingDate(meeting) {
  return parseFlexibleDate(
    meeting?.date ||
    meeting?.rawDate ||
    meeting?.created_at ||
    meeting?.createdAt ||
    meeting?.updated_at ||
    meeting?.updatedAt
  );
}

function formatMeetingDateLabel(meeting) {
  const date = getMeetingDate(meeting);
  if (!date) return "날짜 없음";
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function normalizeKeyText(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getDateKey(value) {
  const date = parseFlexibleDate(value);
  if (!date) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getMeetingDateKey(meeting) {
  return getDateKey(
    meeting?.date ||
    meeting?.rawDate ||
    meeting?.created_at ||
    meeting?.createdAt ||
    meeting?.updated_at ||
    meeting?.updatedAt
  );
}

function getMeetingDedupeKey(meeting) {
  const projectKey = normalizeKeyText(meeting?.projectId || meeting?.project_id || meeting?.projectName || meeting?.project_name);
  const titleKey = normalizeKeyText(meeting?.title || "회의 제목 없음");
  const dateKey = getMeetingDateKey(meeting);
  return `${projectKey}::${titleKey}::${dateKey}`;
}

function getActionDedupeKey(item) {
  const projectKey = normalizeKeyText(item?.projectId || item?.projectName);
  const titleKey = normalizeKeyText(getActionTitle(item));
  const assigneeKey = normalizeKeyText(item?.assignee || (Array.isArray(item?.assignees) ? item.assignees.join(",") : ""));
  // Deliberately excludes "source" (meeting title): once a task is synced to
  // Jira/Notion it also exists as a separate Ticket row (see Ticket creation
  // in backend/app/workers/tasks.py), and ProjectTicketItem has no field
  // linking back to its originating meeting — so a ticket-derived entry's
  // source is always empty and never matches the real meeting-derived entry's
  // source, silently double-counting the same task in "이번 달 활동"/dashboard
  // totals. Project + title + assignee alone is specific enough to identify
  // the same real task without that mismatch.
  return `${projectKey}::${titleKey}::${assigneeKey}`;
}

function mergePreferRicher(prev, next) {
  const prevActionCount = Array.isArray(prev?.action_items) ? prev.action_items.length : Number(prev?.actionItems || 0);
  const nextActionCount = Array.isArray(next?.action_items) ? next.action_items.length : Number(next?.actionItems || 0);
  const base = nextActionCount >= prevActionCount ? { ...prev, ...next } : { ...next, ...prev };
  return {
    ...base,
    date: base.date || prev?.date || next?.date || "",
    rawDate: base.rawDate || prev?.rawDate || next?.rawDate || "",
    created_at: base.created_at || prev?.created_at || next?.created_at || "",
    createdAt: base.createdAt || prev?.createdAt || next?.createdAt || "",
    action_items: Array.isArray(base.action_items)
      ? base.action_items
      : Array.isArray(prev?.action_items)
        ? prev.action_items
        : Array.isArray(next?.action_items)
          ? next.action_items
          : [],
  };
}

function isSameMonth(date, target = new Date()) {
  if (!date) return false;
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth();
}

function getActionTitle(item) {
  return String(item?.title || item?.text || item?.label || "").trim();
}

function isActionDone(item) {
  return normalizeStatus(item?.status) === "수행완료";
}

function getActionStatusRank(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "수행완료") return 4;
  if (normalized === "연동완료") return 3;
  if (normalized === "검토완료") return 2;
  if (normalized === "검토대기") return 1;
  return 0;
}

function getIntegrationKind(item) {
  const links = item?.integrationLinks && typeof item.integrationLinks === "object" ? item.integrationLinks : {};
  const provider = String(item?.integrationProvider || item?.integrationTool || "").toLowerCase();
  const link = String(item?.externalLink || item?.jiraLink || "").toLowerCase();
  const status = normalizeStatus(item?.status);
  const syncProviders = Array.isArray(item?.external_syncs)
    ? item.external_syncs.map((sync) => String(sync?.provider || "").toLowerCase())
    : [];
  const jiraLink = String(links.jira || "").toLowerCase();
  const notionLink = String(links.notion || "").toLowerCase();
  if (notionLink || jiraLink.includes("notion") || provider.includes("notion") || link.includes("notion") || syncProviders.includes("notion")) return "notion";
  if ((jiraLink && !jiraLink.includes("notion")) || provider.includes("jira") || link.includes("jira") || syncProviders.includes("jira")) return "jira";
  if (status === "연동완료") return "jira";
  return "";
}

function getIntegrationKinds(item) {
  const links = item?.integrationLinks && typeof item.integrationLinks === "object" ? item.integrationLinks : {};
  const kinds = new Set();
  const jiraLink = String(links.jira || "").toLowerCase();
  const notionLink = String(links.notion || "").toLowerCase();
  if (jiraLink && !jiraLink.includes("notion")) kinds.add("jira");
  if (notionLink || jiraLink.includes("notion")) kinds.add("notion");
  const singleKind = getIntegrationKind(item);
  if (singleKind) kinds.add(singleKind);
  return Array.from(kinds);
}

function mergeActionItem(prev, next) {
  const prevRank = getActionStatusRank(prev?.status);
  const nextRank = getActionStatusRank(next?.status);
  const preferred = nextRank >= prevRank ? { ...prev, ...next } : { ...next, ...prev };
  const prevIntegration = getIntegrationKind(prev);
  const nextIntegration = getIntegrationKind(next);
  const integrationSource = nextIntegration ? next : prevIntegration ? prev : preferred;
  return {
    ...preferred,
    status: nextRank >= prevRank ? normalizeStatus(next?.status) : normalizeStatus(prev?.status),
    integrationTool: integrationSource?.integrationTool || integrationSource?.integrationProvider || preferred.integrationTool || preferred.integrationProvider || null,
    integrationProvider: integrationSource?.integrationProvider || preferred.integrationProvider || null,
    integrationLinks: {
      ...(prev?.integrationLinks && typeof prev.integrationLinks === "object" ? prev.integrationLinks : {}),
      ...(next?.integrationLinks && typeof next.integrationLinks === "object" ? next.integrationLinks : {}),
      ...(integrationSource?.integrationTool === "Jira" || integrationSource?.integrationProvider === "jira" ? { jira: integrationSource?.externalLink || integrationSource?.jiraLink || "" } : {}),
      ...(integrationSource?.integrationTool === "Notion" || integrationSource?.integrationProvider === "notion" ? { notion: integrationSource?.externalLink || integrationSource?.jiraLink || "" } : {}),
    },
    externalLink: integrationSource?.externalLink || integrationSource?.jiraLink || preferred.externalLink || preferred.jiraLink || "",
    jiraLink: integrationSource?.jiraLink || integrationSource?.externalLink || preferred.jiraLink || preferred.externalLink || "",
    external_syncs: Array.isArray(integrationSource?.external_syncs) && integrationSource.external_syncs.length > 0
      ? integrationSource.external_syncs
      : Array.isArray(preferred.external_syncs) ? preferred.external_syncs : [],
    checked: Boolean(prev?.checked || next?.checked || preferred.checked),
  };
}

function formatDueLabel(value) {
  const date = parseFlexibleDate(value);
  if (!date) return "마감일 없음";
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function isAssignedToCurrentUser(item, aliases = []) {
  const normalizedAliases = aliases.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  if (normalizedAliases.length === 0) return false;
  const assignees = [
    item?.assignee,
    item?.assigneeEmail,
    ...(Array.isArray(item?.assignees) ? item.assignees : []),
  ].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  return assignees.some((value) => normalizedAliases.includes(value));
}

function isMeetingForCurrentUser(meeting, relatedActions = [], aliases = []) {
  const normalizedAliases = aliases.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  if (normalizedAliases.length === 0) return true;
  const participants = [
    ...(Array.isArray(meeting?.participants) ? meeting.participants : []),
    ...(Array.isArray(meeting?.attendees) ? meeting.attendees : []),
    meeting?.owner,
    meeting?.createdBy,
    meeting?.created_by,
  ].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  if (participants.some((value) => normalizedAliases.includes(value))) return true;
  return relatedActions.some((item) => isAssignedToCurrentUser(item, aliases));
}

function dedupeByKey(items, makeKey) {
  const map = new Map();
  items.forEach((item, index) => {
    const key = makeKey(item, index);
    if (!map.has(key)) {
      map.set(key, item);
      return;
    }
    map.set(key, mergeActionItem(map.get(key), item));
  });
  return Array.from(map.values());
}

function HomeSection({ goTo, name, email, department, aliases = [] }) {
  const navigate = useNavigate();
  const aliasKey = aliases.join("|");
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeStats, setHomeStats] = useState({
    meetingsThisMonth: 0,
    doneActionItems: 0,
    totalActionItems: 0,
    // Counts of *projects* connected to each provider — not a tally of individual
    // task links, which could keep counting a task's leftover link after the
    // project itself was disconnected.
    integrationCounts: { jira: 0, notion: 0 },
    integratedProjectCount: 0,
    totalProjectCount: 0,
    recentMeetings: [],
    pendingActions: [],
  });

  useEffect(() => {
    let cancelled = false;
    const userAliases = [...new Set([name, email, ...aliases].map((value) => String(value || "").trim()).filter(Boolean))];

    const mapMeetingActionItem = (item, project, meeting, index) => ({
      id: item?.id || `${meeting?.id || meeting?.title || "meeting"}-action-${index + 1}`,
      title: getActionTitle(item) || "해야 할 일",
      text: getActionTitle(item) || "해야 할 일",
      assignee: item?.assignee || "",
      assignees: Array.isArray(item?.assignees) && item.assignees.length > 0
        ? item.assignees
        : item?.assignee ? [item.assignee] : [],
      assigneeEmail: item?.assigneeEmail || item?.assignee_email || "",
      status: normalizeStatus(item?.status || (item?.checked ? "수행완료" : "검토대기")),
      checked: Boolean(item?.checked),
      projectId: String(project?.id || item?.projectId || item?.project_id || ""),
      projectName: project?.name || item?.projectName || item?.project_name || "",
      meetingId: String(meeting?.id || item?.meetingId || item?.meeting_id || ""),
      source: item?.source || meeting?.title || "",
      dueDate: item?.dueDate || item?.due || item?.due_at || "",
      jiraLink: item?.jiraLink || item?.externalLink || "",
      externalLink: item?.externalLink || item?.jiraLink || "",
      integrationTool: item?.integrationTool || item?.integration_tool || null,
      integrationProvider: item?.integrationProvider || item?.integration_provider || null,
      integrationLinks: item?.integrationLinks || item?.integration_links || {},
      external_syncs: item?.external_syncs || [],
      updatedAt: item?.updatedAt || item?.updated_at || meeting?.updated_at || meeting?.created_at || "",
    });

    const mapTicketItem = (ticket, project) => {
      const sync = Array.isArray(ticket?.external_syncs)
        ? ticket.external_syncs.find((item) => item?.provider === "jira" || item?.provider === "notion")
        : null;
      return {
        id: ticket?.id,
        title: ticket?.title || ticket?.text || "해야 할 일",
        text: ticket?.text || ticket?.title || "해야 할 일",
        assignee: ticket?.assignee || "",
        assignees: ticket?.assignee ? [ticket.assignee] : [],
        assigneeEmail: ticket?.assignee_email || ticket?.assigneeEmail || "",
        status: normalizeStatus(ticket?.status),
        projectId: String(project?.id || ticket?.project_id || ""),
        projectName: project?.name || "",
        source: ticket?.source || "",
        dueDate: ticket?.due_at || ticket?.dueDate || ticket?.due || "",
        jiraLink: sync?.provider === "jira" ? sync.external_url : "",
        externalLink: sync?.external_url || ticket?.externalLink || ticket?.jiraLink || "",
        integrationProvider: sync?.provider || ticket?.integrationProvider || null,
        integrationTool: sync?.provider === "jira" ? "Jira" : sync?.provider === "notion" ? "Notion" : ticket?.integrationTool || null,
        integrationLinks: ticket?.integrationLinks || ticket?.integration_links || {},
        external_syncs: ticket?.external_syncs || [],
        updatedAt: ticket?.updated_at || ticket?.created_at || "",
      };
    };

    const loadHomeStats = async () => {
      setHomeLoading(true);
      try {
        const apiProjects = localStorage.getItem("tiki_access_token")
          ? await listProjects().catch(() => [])
          : [];
        const apiProjectList = Array.isArray(apiProjects) ? apiProjects : [];
        const localProjects = apiProjectList.length > 0 ? [] : readJsonArray(PROJECT_CATALOG_STORAGE_KEY);
        const projectMap = new Map();
        [...localProjects, ...apiProjectList]
          .filter((project) => project?.id && !isTemporaryProject(project))
          .forEach((project) => projectMap.set(String(project.id), project));
        const projects = Array.from(projectMap.values());

        const hasSession = Boolean(localStorage.getItem("tiki_access_token"));
        const results = await Promise.all(
          projects.map((project) =>
            Promise.all([
              hasSession ? getProject(project.id).catch(() => null) : null,
              hasSession ? listProjectTickets(project.id).catch(() => []) : [],
              hasSession ? listProjectMeetings(project.id).catch(() => []) : [],
              hasSession ? getProjectIntegrations(project.id).catch(() => null) : null,
            ]).then(([projectDetail, tickets, meetings, integrations]) => ({
              project: projectDetail || project,
              tickets: Array.isArray(tickets) ? tickets : [],
              meetings: Array.isArray(meetings) ? meetings : [],
              jiraConnected: Boolean(integrations?.jira?.connected),
              notionConnected: Boolean(integrations?.notion?.connected),
            }))
          )
        );

        const overrides = readJsonObject(PROJECT_OVERRIDE_STORAGE_KEY);
        const manualRecords = readJsonObject(MANUAL_MEETING_RECORDS_KEY);
        const currentMonth = new Date();

        const meetings = [];
        const actionItems = [];

        results.forEach(({ project, tickets, meetings: apiMeetings }) => {
          const projectId = String(project.id);
          const override = overrides[projectId] && typeof overrides[projectId] === "object" ? overrides[projectId] : {};
          const detailMeetings = Array.isArray(project.meetings) ? project.meetings : [];
          const overrideMeetings = Array.isArray(override.meetings) ? override.meetings : [];
          const overrideActions = Array.isArray(override.myActionItems) ? override.myActionItems : [];
          const projectMeetings = [...detailMeetings, ...apiMeetings, ...overrideMeetings]
            .filter(Boolean)
            .map((meeting, index) => ({
              ...meeting,
              id: String(meeting?.id || `${projectId}-meeting-${index + 1}`),
              title: meeting?.title || "회의 제목 없음",
              projectId,
              projectName: project.name || meeting?.projectName || "",
            }));

          projectMeetings.forEach((meeting) => {
            meetings.push(meeting);
            (Array.isArray(meeting.action_items) ? meeting.action_items : []).forEach((item, index) => {
              actionItems.push(mapMeetingActionItem(item, project, meeting, index));
            });
          });

          overrideActions.forEach((item, index) => {
            actionItems.push(mapMeetingActionItem(item, project, { id: item?.meetingId || item?.source, title: item?.source || "직접 작성 회의록" }, index));
          });

          tickets.forEach((ticket) => {
            actionItems.push(mapTicketItem(ticket, project));
          });
        });

        Object.values(manualRecords).forEach((record) => {
          const project = projectMap.get(String(record?.projectId || ""));
          if (!project || !Array.isArray(record?.actions)) return;
          const meeting = {
            id: String(record?.id || ""),
            title: record?.title || "직접 작성 회의록",
            date: record?.date || record?.rawDate || record?.createdAt || "",
            createdAt: record?.createdAt || "",
            projectId: String(record?.projectId || ""),
            projectName: record?.projectName || project.name || "",
            action_items: record.actions,
            detailType: "manual",
            detailRecordId: String(record?.id || ""),
          };
          meetings.push(meeting);
          record.actions.forEach((item, index) => {
            actionItems.push(mapMeetingActionItem(item, project, meeting, index));
          });
        });

        const meetingMap = new Map();
        meetings.forEach((meeting) => {
          const key = getMeetingDedupeKey(meeting);
          if (!key.replace(/:/g, "")) return;
          if (!meetingMap.has(key)) {
            meetingMap.set(key, meeting);
            return;
          }
          meetingMap.set(key, mergePreferRicher(meetingMap.get(key), meeting));
        });
        const uniqueMeetings = Array.from(meetingMap.values());
        const uniqueActions = dedupeByKey(
          actionItems.filter((item) => getActionTitle(item)),
          (item) => getActionDedupeKey(item)
        );
        const assignedActions = uniqueActions.filter((item) => isAssignedToCurrentUser(item, userAliases));
        const scopedActions = userAliases.length > 0 ? assignedActions : uniqueActions;
        const pendingActions = scopedActions
          .filter((item) => !isActionDone(item))
          .sort((left, right) => {
            const leftDate = parseFlexibleDate(left?.dueDate);
            const rightDate = parseFlexibleDate(right?.dueDate);
            if (!leftDate && !rightDate) return 0;
            if (!leftDate) return 1;
            if (!rightDate) return -1;
            return leftDate - rightDate;
          })
          .slice(0, 3)
          .map((item) => ({
            id: item.id || getActionDedupeKey(item),
            title: getActionTitle(item) || "해야 할 일",
            projectName: item.projectName || "프로젝트",
            dueLabel: formatDueLabel(item.dueDate),
            status: normalizeStatus(item.status),
          }));
        // Count *projects* connected to each provider (real, current status from
        // getProjectIntegrations) rather than individual task links — a task can
        // keep a leftover link after its project disconnects, which would make a
        // per-task tally wrong/stale.
        const integrationCounts = results.reduce(
          (counts, { jiraConnected, notionConnected }) => {
            if (jiraConnected) counts.jira += 1;
            if (notionConnected) counts.notion += 1;
            return counts;
          },
          { jira: 0, notion: 0 }
        );
        const integratedProjectCount = results.filter(
          ({ jiraConnected, notionConnected }) => jiraConnected || notionConnected
        ).length;

        const enrichedMeetings = uniqueMeetings.map((meeting) => {
          const meetingTitle = String(meeting?.title || "").trim();
          const meetingId = String(meeting?.id || "").trim();
          const relatedActions = uniqueActions.filter((item) => {
            const sameMeetingId = meetingId && String(item?.meetingId || "") === meetingId;
            const sameSource = meetingTitle && String(item?.source || "").trim() === meetingTitle;
            const sameProject = String(item?.projectId || "") === String(meeting?.projectId || "");
            return sameProject && (sameMeetingId || sameSource);
          });
          return { meeting, meetingTitle, meetingId, relatedActions };
        });
        const userMeetings = enrichedMeetings.filter(({ meeting, relatedActions }) =>
          isMeetingForCurrentUser(meeting, relatedActions, userAliases)
        );

        const recentMeetings = userMeetings
          .map((meeting) => {
            const inlineActions = Array.isArray(meeting.meeting?.action_items) ? meeting.meeting.action_items : [];
            const relatedActions = meeting.relatedActions;
            const displayActions = relatedActions.length > 0 ? relatedActions : inlineActions;
            const meetingDate = getMeetingDate(meeting.meeting);
            return {
              id: meeting.meetingId || `${meeting.meeting?.projectId || ""}-${meeting.meetingTitle}`,
              title: meeting.meetingTitle || "회의 제목 없음",
              date: formatMeetingDateLabel(meeting.meeting),
              dateValue: meetingDate ? meetingDate.getTime() : 0,
              actionItems: displayActions.length,
              done: displayActions.filter((item) => isActionDone(item)).length,
              projectId: String(meeting.meeting?.projectId || ""),
              projectName: meeting.meeting?.projectName || "",
              meetingId: meeting.meetingId,
              detailType: meeting.meeting?.detailType === "manual" ? "manual" : "uploaded",
              detailRecordId: meeting.meeting?.detailRecordId || "",
              rawMeeting: meeting.meeting,
            };
          })
          .sort((a, b) => b.dateValue - a.dateValue)
          .slice(0, 3);

        if (!cancelled) {
          setHomeStats({
            meetingsThisMonth: userMeetings.filter(({ meeting }) => isSameMonth(getMeetingDate(meeting), currentMonth)).length,
            doneActionItems: scopedActions.filter((item) => isActionDone(item)).length,
            totalActionItems: scopedActions.length,
            integrationCounts,
            integratedProjectCount,
            totalProjectCount: projects.length,
            recentMeetings,
            pendingActions,
          });
        }
      } catch {
        if (!cancelled) {
          setHomeStats({
            meetingsThisMonth: 0,
            doneActionItems: 0,
            totalActionItems: 0,
            integrationCounts: { jira: 0, notion: 0 },
            integratedProjectCount: 0,
            totalProjectCount: 0,
            recentMeetings: [],
            pendingActions: [],
          });
        }
      } finally {
        if (!cancelled) setHomeLoading(false);
      }
    };

    loadHomeStats();
    return () => {
      cancelled = true;
    };
  }, [name, email, aliasKey]);

  return (
    <div className="space-y-7">
      {/* 인사말 */}
      <div>
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#0099CC]">
          <Icon name="sparkles" size={13} color="#0099CC" />
          {getGreeting()}
        </p>
        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.4px] text-[#0D1B2A]">
          {name}<span className="text-[#5A6F8A] font-bold">님,</span> 오늘의 TIKI 현황입니다
        </h1>
      </div>

      {/* 이번 달 활동 요약 - 메인 스트립 */}
      <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-[linear-gradient(135deg,rgba(0,153,204,.06),rgba(124,58,237,.05))] p-5 sm:p-6">
        <p className="mb-4 text-[12px] font-bold text-[#5A6F8A]">이번 달 활동</p>
        <div className="grid grid-cols-3 gap-4">
          <StatBlock value={homeLoading ? "..." : `${homeStats.meetingsThisMonth}건`} label="이번 달 회의" />
          <StatBlock value={homeLoading ? "..." : `${homeStats.doneActionItems}/${homeStats.totalActionItems}`} label="내 업무 처리" accent />
          <StatBlock
            value={homeLoading ? "..." : `${homeStats.integratedProjectCount}/${homeStats.totalProjectCount}`}
            label="연동 완료 프로젝트"
          />
        </div>
      </div>

      <div className="space-y-5">
          <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#0D1B2A]">최근 회의</h3>
              <span className="text-[12px] text-[#9BAABE]">최근 3건</span>
            </div>
            <div className="space-y-1">
              {homeLoading && (
                <div className="rounded-xl bg-[rgba(0,100,180,.04)] px-4 py-5 text-center text-[12px] font-semibold text-[#9BAABE]">
                  실제 회의 데이터를 불러오는 중입니다.
                </div>
              )}
              {!homeLoading && homeStats.recentMeetings.length === 0 && (
                <div className="rounded-xl bg-[rgba(0,100,180,.04)] px-4 py-5 text-center text-[12px] font-semibold text-[#9BAABE]">
                  최근 회의가 없습니다.
                </div>
              )}
              {!homeLoading && homeStats.recentMeetings.map((m, i) => (
                <button
                  key={m.id || i}
                  type="button"
                  onClick={() => {
                    if (!m.projectId) return;
                    const isManual = m.detailType === "manual";
                    navigate(isManual ? "/meeting-manual-detail" : "/meeting-detail", {
                      state: isManual
                        ? {
                            recordId: m.detailRecordId || m.meetingId,
                            meetingId: m.meetingId,
                            meeting: m.rawMeeting,
                            projectId: m.projectId,
                            projectName: m.projectName,
                          }
                        : {
                            meetingId: m.meetingId,
                            meeting: m.rawMeeting,
                            projectId: m.projectId,
                            projectName: m.projectName,
                          },
                    });
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-[rgba(0,100,180,.03)]",
                    i !== homeStats.recentMeetings.length - 1 && "border-b border-[rgba(0,100,180,.07)]"
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,153,204,.08)]">
                    <Icon name="checkCircle" size={15} color={m.actionItems > 0 && m.done === m.actionItems ? "#10B981" : "#0099CC"} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#0D1B2A]">{m.title}</p>
                    <p className="mt-0.5 text-[11px] text-[#9BAABE]">{m.date} · 해야 할일 {m.done}/{m.actionItems} 완료</p>
                  </div>
                  <Icon name="chevronRight" size={14} color="#9BAABE" />
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#0D1B2A]">내가 해야 할 일</h3>
              <Link to="/dashboard" className="text-[11px] font-bold text-[#0099CC]">
                전체 보기
              </Link>
            </div>
            <div className="space-y-1">
              {homeLoading && (
                <div className="rounded-xl bg-[rgba(0,100,180,.04)] px-4 py-5 text-center text-[12px] font-semibold text-[#9BAABE]">
                  내 업무 데이터를 불러오는 중입니다.
                </div>
              )}
              {!homeLoading && homeStats.pendingActions.length === 0 && (
                <div className="rounded-xl bg-[rgba(0,100,180,.04)] px-4 py-5 text-center text-[12px] font-semibold text-[#9BAABE]">
                  지금 남은 내 업무가 없습니다.
                </div>
              )}
              {!homeLoading && homeStats.pendingActions.map((item, index) => (
                <div
                  key={item.id || index}
                  className={cn(
                    "flex items-center gap-3 py-3",
                    index !== homeStats.pendingActions.length - 1 && "border-b border-[rgba(0,100,180,.07)]"
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(245,158,11,.1)]">
                    <Icon name="alertTriangle" size={15} color="#F59E0B" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#0D1B2A]">{item.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-[#9BAABE]">
                      {item.projectName} · {item.status} · {item.dueLabel}
                    </p>
                  </div>
                  <Icon name="chevronRight" size={14} color="#9BAABE" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0099CC,#7C3AED)] text-[16px] font-black text-white select-none">
                  {(name || "사")[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-[#0D1B2A]">{name}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#9BAABE]">
                    <Icon name="mail" size={11} color="#9BAABE" />
                    <span className="truncate">{email}</span>
                  </div>
                </div>
              </div>

              <div className="my-3.5 h-px bg-[rgba(0,100,180,.07)]" />

              <div className="flex items-center gap-1.5 min-w-0">
                <Icon name="briefcase" size={12} color="#5A6F8A" />
                <span className="truncate text-[14px] font-semibold text-[#5A6F8A]">
                  {department || "부서 미설정"}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-[#0D1B2A]">연동 현황</h3>
                <button
                  type="button"
                  onClick={() => goTo("integrations")}
                  className="text-[11px] font-bold text-[#0099CC]"
                >
                  관리
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: "jira", label: "Jira", count: homeStats.integrationCounts.jira, color: "#0052CC" },
                  { id: "notion", label: "Notion", count: homeStats.integrationCounts.notion, color: "#111827" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goTo("integrations")}
                    className="rounded-xl border border-[rgba(0,100,180,.1)] bg-[#FAFCFF] p-3 text-left transition hover:border-[rgba(0,153,204,.35)]"
                  >
                    <span
                      className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-black text-white"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.label[0]}
                    </span>
                    <p className="text-[12px] font-bold text-[#0D1B2A]">{item.label}</p>
                    <p className="mt-0.5 text-[13px] font-black text-[#0099CC]">
                      {homeLoading ? "..." : `${item.count}개 프로젝트`}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="sm:hidden rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,153,204,.08)]">
                <Icon name="helpCircle" size={15} color="#0099CC" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[14px] font-bold text-[#0D1B2A]">고객센터 문의하기</h3>
                <p className="mt-1 text-[12px] leading-[1.6] text-[#5A6F8A]">이용 중 불편한 점이나 개선 의견을 보내주세요.</p>
                <Link
                  to="/contact"
                  state={{ mobileTab: "mypage" }}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-[linear-gradient(135deg,#0099CC,#0077AA)] px-3 py-1.5 text-[11.5px] font-bold text-white"
                >
                  <Icon name="helpCircle" size={12} color="#fff" />
                  고객센터로 이동
                </Link>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}

function ProfileSection({ showToast, initialName, initialEmail, initialDepartment, initialPosition }) {
  const fileRef = useRef(null);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [avatar, setAvatar] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const initialIsCustom = !!initialDepartment && !DEPARTMENTS.includes(initialDepartment);
  const [deptSelect, setDeptSelect] = useState(initialIsCustom ? "직접 입력" : (initialDepartment || ""));
  const [deptCustom, setDeptCustom] = useState(initialIsCustom ? initialDepartment : "");

  const initialPositionIsCustom = !!initialPosition && !POSITIONS.includes(initialPosition);
  const [positionSelect, setPositionSelect] = useState(initialPositionIsCustom ? "직접 입력" : (initialPosition || ""));
  const [positionCustom, setPositionCustom] = useState(initialPositionIsCustom ? initialPosition : "");

  const isCustomDept = deptSelect === "직접 입력";
  const resolvedDepartment = isCustomDept ? deptCustom.trim() : deptSelect;

  const isCustomPosition = positionSelect === "직접 입력";
  const resolvedPosition = isCustomPosition ? positionCustom.trim() : positionSelect;

  useEffect(() => {
    setName(initialName);
    setEmail(initialEmail);
    const nextIsCustom = !!initialDepartment && !DEPARTMENTS.includes(initialDepartment);
    setDeptSelect(nextIsCustom ? "직접 입력" : (initialDepartment || ""));
    setDeptCustom(nextIsCustom ? initialDepartment : "");
    const nextPositionIsCustom = !!initialPosition && !POSITIONS.includes(initialPosition);
    setPositionSelect(nextPositionIsCustom ? "직접 입력" : (initialPosition || ""));
    setPositionCustom(nextPositionIsCustom ? initialPosition : "");
    setErrors({});
  }, [initialName, initialEmail, initialDepartment, initialPosition]);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg","image/png"].includes(f.type)) { showToast("JPG, PNG 파일만 가능합니다.", "error"); return; }
    if (f.size > 5*1024*1024) { showToast("5MB 이하 이미지만 업로드할 수 있습니다.", "error"); return; }
    setAvatar(URL.createObjectURL(f));
  };

  const save = async () => {
    const nextErrors = {};
    const nextName = name.trim();
    const nextEmail = email.trim().toLowerCase();
    const nextDepartment = resolvedDepartment.trim();
    const nextPosition = resolvedPosition.trim();

    if (!nextName) nextErrors.name = "이름을 입력해 주세요.";
    if (!nextEmail) nextErrors.email = "이메일을 입력해 주세요.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) nextErrors.email = "올바른 이메일 형식이 아닙니다.";
    if (!deptSelect) nextErrors.department = "부서를 선택해 주세요.";
    if (isCustomDept && !nextDepartment) nextErrors.department = "부서명을 입력해 주세요.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showToast("프로필 정보를 확인해 주세요.", "error");
      return;
    }

    setSaving(true);
    try {
      let serverUser = null;
      if (localStorage.getItem("tiki_access_token")) {
        serverUser = await updateCurrentUser({
          name: nextName,
          email: nextEmail,
          role: nextDepartment,
          position: nextPosition,
        });
      }

      const prevUser = JSON.parse(localStorage.getItem("tiki_user") || "{}");
      const aliases = [
        ...readJsonArray(PROFILE_ALIAS_STORAGE_KEY),
        ...(Array.isArray(prevUser.aliases) ? prevUser.aliases : []),
        prevUser.name,
        prevUser.email,
        nextName,
        nextEmail,
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      const uniqueAliases = [...new Set(aliases)];
      migrateLocalProfileReferences(uniqueAliases, serverUser?.name || nextName, serverUser?.email || nextEmail);
      const nextUser = {
        ...prevUser,
        ...(serverUser || {}),
        id: prevUser.id || serverUser?.id,
        accountId: prevUser.accountId || prevUser.id || serverUser?.id || prevUser.email,
        name: serverUser?.name || nextName,
        email: serverUser?.email || nextEmail,
        role: serverUser?.role ?? nextDepartment,
        department: nextDepartment,
        position: serverUser?.position ?? nextPosition,
        aliases: uniqueAliases,
      };
      localStorage.setItem("tiki_user", JSON.stringify(nextUser));
      localStorage.setItem(PROFILE_ALIAS_STORAGE_KEY, JSON.stringify(uniqueAliases));
      window.dispatchEvent(new Event("tiki-auth-changed"));
      showToast("프로필이 저장됐습니다.");
    } catch (error) {
      showToast(error?.status === 409 ? "이미 사용 중인 이메일입니다." : (error?.message || "프로필 저장에 실패했습니다."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[18px] font-bold tracking-[-0.3px] text-[#0D1B2A]">프로필</h2>
        <p className="mt-1 text-[13px] text-[#5A6F8A]">서비스에서 표시될 내 정보를 관리합니다.</p>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative">
          <div className="h-[80px] w-[80px] overflow-hidden rounded-2xl border-2 border-[rgba(0,153,204,.2)] bg-[linear-gradient(135deg,rgba(0,153,204,.15),rgba(124,58,237,.15))] shadow-[0_4px_16px_rgba(0,0,0,.08)]">
            {avatar
              ? <img src={avatar} className="h-full w-full object-cover" alt="avatar" />
              : <div className="flex h-full w-full items-center justify-center text-[32px] font-black text-[#0099CC] select-none">{(name || "사")[0]}</div>
            }
          </div>
          <button onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#0099CC] shadow-[0_2px_8px_rgba(0,153,204,.4)] transition-transform hover:scale-110">
            <Icon name="camera" size={13} color="#fff" sw={2} />
          </button>
          <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={handleFile} />
        </div>
        <div className="space-y-1.5">
          <p className="text-[14px] font-bold text-[#0D1B2A]">{name || "이름 없음"}</p>
          <p className="text-[12px] text-[#5A6F8A]">{email}</p>
          <div className="flex gap-2 pt-0.5">
            <button onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-[rgba(0,100,180,.15)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#5A6F8A] transition-colors hover:border-[rgba(0,153,204,.4)] hover:text-[#0099CC]">
              이미지 변경
            </button>
            {avatar && (
              <button onClick={() => setAvatar(null)}
                className="rounded-lg border border-[rgba(239,68,68,.2)] bg-[rgba(239,68,68,.05)] px-3 py-1.5 text-[12px] font-semibold text-[#EF4444]">
                삭제
              </button>
            )}
          </div>
          <p className="text-[11px] text-[#9BAABE]">JPG, PNG · 최대 5MB</p>
        </div>
      </div>

      <Divider />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="이름 (닉네임)" error={errors.name}>
          <Input
            value={name}
            onChange={e => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: "" })); }}
            placeholder="이름 입력"
            error={!!errors.name}
          />
        </Field>
        <Field label="이메일" hint="이메일을 변경해도 기존 프로젝트와 회의록은 계정 ID 기준으로 유지됩니다." error={errors.email}>
          <Input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: "" })); }}
            placeholder="이메일 입력"
            error={!!errors.email}
          />
        </Field>

        <Field label="부서" error={errors.department}>
          <div className="space-y-2">
            <Select
              value={deptSelect}
              onChange={e => { setDeptSelect(e.target.value); setErrors((prev) => ({ ...prev, department: "" })); }}
              options={DEPARTMENTS}
              placeholder="부서 선택"
              error={errors.department}
            />
            {isCustomDept && (
              <Input
                value={deptCustom}
                onChange={e => { setDeptCustom(e.target.value); setErrors((prev) => ({ ...prev, department: "" })); }}
                placeholder="부서명을 입력하세요"
                error={!!errors.department}
              />
            )}
          </div>
        </Field>

        <Field label="포지션">
          <div className="space-y-2">
            <Select
              value={positionSelect}
              onChange={e => setPositionSelect(e.target.value)}
              options={POSITIONS}
              placeholder="포지션 선택"
            />
            {isCustomPosition && (
              <Input
                value={positionCustom}
                onChange={e => setPositionCustom(e.target.value)}
                placeholder="포지션을 입력하세요"
              />
            )}
          </div>
        </Field>
      </div>

      <div className="flex justify-end pt-2">
        <SaveButton onClick={save} loading={saving} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function SecuritySection({ showToast, setModal }) {
  const [cur, setCur] = useState("");
  const [nw, setNw]   = useState("");
  const [cf, setCf]   = useState("");
  const [show, setShow] = useState({ cur: false, nw: false, cf: false });
  const [errs, setErrs] = useState({});
  const [saving, setSaving] = useState(false);

  const toggle = (k) => setShow(p => ({ ...p, [k]: !p[k] }));

  const eyeBtn = (k) => (
    <button onClick={() => toggle(k)} className="text-[#9BAABE] transition-colors hover:text-[#0099CC]">
      <Icon name={show[k] ? "eyeOff" : "eye"} size={15} color="currentColor" />
    </button>
  );

  const save = async () => {
    const e = {};
    if (!cur) e.cur = "현재 비밀번호를 입력해 주세요.";
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(nw))
      e.nw = "8자 이상, 영문·숫자·특수문자(@$!%*?&)를 모두 포함해야 합니다.";
    if (cur && nw && cur === nw) e.nw = "새 비밀번호는 현재 비밀번호와 달라야 합니다.";
    if (nw !== cf) e.cf = "새 비밀번호가 일치하지 않습니다.";
    setErrs(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await changeCurrentUserPassword({ currentPassword: cur, newPassword: nw });
      setCur("");
      setNw("");
      setCf("");
      setErrs({});
      showToast("비밀번호가 변경됐습니다.");
    } catch (error) {
      const message =
        error?.detail === "Current password is incorrect" ||
        error?.message === "Current password is incorrect"
          ? "현재 비밀번호가 올바르지 않습니다."
          : error?.detail === "New password must be different from current password" ||
            error?.message === "New password must be different from current password"
          ? "새 비밀번호는 현재 비밀번호와 달라야 합니다."
          : error?.message || "비밀번호 변경에 실패했습니다.";
      setErrs((prev) => ({ ...prev, form: message }));
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[18px] font-bold tracking-[-0.3px] text-[#0D1B2A]">보안</h2>
        <p className="mt-1 text-[13px] text-[#5A6F8A]">계정 보호를 위해 현재 비밀번호 확인 후 새 비밀번호로 변경할 수 있습니다.</p>
      </div>

      {/* PW change */}
      <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-[#FAFCFF] p-5 space-y-4">
        <Field label="현재 비밀번호" error={errs.cur}>
          <Input type={show.cur ? "text" : "password"} value={cur}
            onChange={e => setCur(e.target.value)} placeholder="현재 비밀번호" error={errs.cur} rightEl={eyeBtn("cur")} />
        </Field>
        <Field label="새 비밀번호" error={errs.nw}
          hint={!errs.nw ? "8자 이상, 영문·숫자·특수문자 조합" : undefined}>
          <Input type={show.nw ? "text" : "password"} value={nw}
            onChange={e => setNw(e.target.value)} placeholder="새 비밀번호" error={errs.nw} rightEl={eyeBtn("nw")} />
        </Field>
        {nw && <PwStrengthBar password={nw} />}
        <Field label="새 비밀번호 확인" error={errs.cf}>
          <Input type={show.cf ? "text" : "password"} value={cf}
            onChange={e => setCf(e.target.value)} placeholder="새 비밀번호 재입력" error={errs.cf} rightEl={eyeBtn("cf")} />
        </Field>
        {errs.form && <p className="text-[12px] font-semibold text-[#EF4444]">{errs.form}</p>}
        <div className="pt-1">
          <SaveButton onClick={save} loading={saving} label="비밀번호 변경" />
        </div>
      </div>

      <Divider label="위험 영역" />

      {/* Delete account */}
      <div className="rounded-2xl border border-[rgba(239,68,68,.2)] bg-[rgba(239,68,68,.03)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-bold text-[#0D1B2A]">계정 탈퇴</p>
            <p className="mt-1 text-[12px] leading-[1.6] text-[#5A6F8A]">
              탈퇴하면 이 계정으로 다시 로그인할 수 없습니다.<br />
              프로젝트 기록에는 탈퇴한 사용자로 표시됩니다.
            </p>
          </div>
          <button onClick={() => setModal("delete")}
            className="shrink-0 rounded-xl border border-[rgba(239,68,68,.3)] bg-white px-4 py-2 text-[13px] font-bold text-[#EF4444] transition-all hover:bg-[rgba(239,68,68,.06)]">
            탈퇴하기
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountDeleteModal({ onCancel, onDeleted, showToast }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const confirmDelete = async () => {
    if (!password) {
      setError("비밀번호를 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await deleteCurrentUser({ password });
      onDeleted();
    } catch (err) {
      const message =
        err?.detail === "Password is incorrect" || err?.message === "Password is incorrect"
          ? "비밀번호가 올바르지 않습니다."
          : err?.message || "계정 탈퇴에 실패했습니다.";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[420px] rounded-2xl border border-[rgba(239,68,68,.16)] bg-white p-6 shadow-[0_32px_80px_rgba(0,0,0,.2)]">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(239,68,68,.1)]">
          <Icon name="alertTriangle" size={20} color="#EF4444" />
        </div>
        <h3 className="mb-1.5 text-center text-[16px] font-bold text-[#0D1B2A]">정말 탈퇴하시겠습니까?</h3>
        <p className="mb-5 text-center text-[13px] leading-[1.65] text-[#5A6F8A]">
          비밀번호 확인 후 계정이 비활성화됩니다. 이후 이 이메일로 다시 로그인할 수 없습니다.
        </p>
        <Field label="현재 비밀번호" error={error}>
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="현재 비밀번호"
            error={error}
            rightEl={
              <button
                onClick={() => setShowPassword((value) => !value)}
                className="text-[#9BAABE] transition-colors hover:text-[#0099CC]"
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} size={15} color="currentColor" />
              </button>
            }
          />
        </Field>
        <div className="mt-6 flex gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-[rgba(0,0,0,.1)] bg-[rgba(0,0,0,.04)] py-2.5 text-[13px] font-semibold text-[#5A6F8A] disabled:opacity-60"
          >
            취소
          </button>
          <button
            onClick={confirmDelete}
            disabled={loading}
            className="flex-1 rounded-xl bg-[#EF4444] py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
          >
            {loading ? "처리 중..." : "탈퇴하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function IntegrationsSection({ showToast }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        if (!localStorage.getItem("tiki_access_token")) {
          if (!cancelled) setRows([]);
          return;
        }
        const apiProjects = await listProjects().catch(() => []);
        const projects = (Array.isArray(apiProjects) ? apiProjects : []).filter(
          (project) => project?.id && !isTemporaryProject(project)
        );
        const results = await Promise.all(
          projects.map((project) =>
            getProjectIntegrations(project.id)
              .then((integrations) => ({
                id: project.id,
                name: project.name || "이름 없는 프로젝트",
                createdAt: project.created_at || "",
                jiraConnected: Boolean(integrations?.jira?.connected),
                notionConnected: Boolean(integrations?.notion?.connected),
              }))
              .catch(() => ({
                id: project.id,
                name: project.name || "이름 없는 프로젝트",
                createdAt: project.created_at || "",
                jiraConnected: false,
                notionConnected: false,
              }))
          )
        );
        results.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        if (!cancelled) setRows(results);
      } catch (error) {
        if (!cancelled) {
          setRows([]);
          showToast(error?.message || "연동 현황을 불러오지 못했습니다.", "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const goToProjectIntegration = (projectId) => {
    navigate(`/configuration?projectId=${projectId}&tab=integration`);
  };

  const visibleRows = rows.filter((row) =>
    row.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[18px] font-bold tracking-[-0.3px] text-[#0D1B2A]">외부 툴 연동</h2>
        <p className="mt-1 text-[13px] text-[#5A6F8A]">
          Jira/Notion 연동은 프로젝트 단위로 이루어집니다. 아래에서 프로젝트별 연동 상태를 확인하고, 프로젝트를 선택하면 실제 연동/해제가 가능한 설정 화면으로 이동합니다.
        </p>
      </div>

      {!loading && rows.length > 0 && (
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="프로젝트 이름으로 검색"
          className="w-full max-w-sm rounded-xl border border-[rgba(0,100,180,.15)] bg-white px-4 py-2.5 text-[13px] text-[#0D1B2A] placeholder:text-[#9BAABE] focus:outline-none focus:ring-2 focus:ring-[rgba(0,100,180,.2)]"
        />
      )}

      {loading ? (
        <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-8 text-center text-[13px] text-[#9BAABE]">
          연동 현황을 불러오는 중입니다.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-8 text-center text-[13px] text-[#9BAABE]">
          참여 중인 프로젝트가 없습니다.
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-8 text-center text-[13px] text-[#9BAABE]">
          검색 결과가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleRows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => goToProjectIntegration(row.id)}
              className="flex w-full items-center gap-4 rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-4 text-left transition-shadow hover:shadow-[0_4px_16px_rgba(0,60,150,.07)]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold text-[#0D1B2A]">{row.name}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  label={`Jira ${row.jiraConnected ? "연동됨" : "미연동"}`}
                  variant={row.jiraConnected ? "success" : "default"}
                />
                <Badge
                  label={`Notion ${row.notionConnected ? "연동됨" : "미연동"}`}
                  variant={row.notionConnected ? "success" : "default"}
                />
              </div>
              <Icon name="chevronRight" size={14} color="#9BAABE" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function SessionsSection({ showToast }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);

  const loadSessions = useCallback(() => {
    if (!localStorage.getItem("tiki_access_token")) {
      setDevices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    listAuthSessions()
      .then((sessions) => setDevices(Array.isArray(sessions) ? sessions : []))
      .catch((error) => {
        setDevices([]);
        showToast(error?.message || "세션 목록을 불러오지 못했습니다.", "error");
      })
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const logoutDevice = async (id) => {
    setActionId(id);
    try {
      await revokeAuthSession(id);
      setDevices((prev) => prev.filter((session) => session.id !== id));
      showToast("해당 기기에서 로그아웃됐습니다.");
    } catch (error) {
      showToast(error?.message || "해당 기기 로그아웃에 실패했습니다.", "error");
    } finally {
      setActionId(null);
    }
  };

  const logoutOthers = async () => {
    setActionId("all");
    try {
      await logoutOtherAuthSessions();
      setDevices((prev) => prev.filter((session) => session.is_current));
      showToast("다른 모든 기기에서 로그아웃됐습니다.");
    } catch (error) {
      showToast(error?.message || "다른 기기 로그아웃에 실패했습니다.", "error");
    } finally {
      setActionId(null);
    }
  };

  const ICON_MAP = { Windows: "monitor", macOS: "monitor", Linux: "monitor", iOS: "smartphone", Android: "smartphone" };
  const formatSessionDate = (value) => {
    if (!value) return "접속 기록 없음";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "접속 기록 없음";
    return date.toLocaleString("ko-KR", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const otherSessionsCount = devices.filter((session) => !session.is_current).length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[18px] font-bold tracking-[-0.3px] text-[#0D1B2A]">세션 관리</h2>
        <p className="mt-1 text-[13px] text-[#5A6F8A]">실제로 로그인된 기기를 확인하고, 사용하지 않는 기기를 로그아웃할 수 있습니다.</p>
      </div>

      <div className="space-y-2.5">
        {loading && (
          <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-[#FAFCFF] p-5 text-center text-[13px] font-semibold text-[#5A6F8A]">
            세션을 불러오는 중입니다...
          </div>
        )}
        {!loading && devices.length === 0 && (
          <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-[#FAFCFF] p-5 text-center text-[13px] font-semibold text-[#5A6F8A]">
            활성화된 로그인 세션이 없습니다. 다시 로그인해 주세요.
          </div>
        )}
        {!loading && devices.map(d => (
          <div key={d.id}
            className={cn(
              "flex items-center gap-4 rounded-2xl border p-4 transition-all",
              d.is_current
                ? "border-[rgba(0,153,204,.25)] bg-[rgba(0,153,204,.04)]"
                : "border-[rgba(0,100,180,.1)] bg-white hover:shadow-[0_2px_12px_rgba(0,60,150,.06)]"
            )}>
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
              d.is_current ? "border-[rgba(0,153,204,.2)] bg-[rgba(0,153,204,.08)]" : "border-[rgba(0,100,180,.1)] bg-[#F8FAFF]"
            )}>
              <Icon name={ICON_MAP[d.os] || "globe"} size={17} color={d.is_current ? "#0099CC" : "#5A6F8A"} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold text-[#0D1B2A]">{d.device_name}</span>
                {d.is_current && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(16,185,129,.1)] px-2 py-0.5 text-[10px] font-bold text-[#10B981]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#10B981]" />
                    현재 기기
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[12px] text-[#5A6F8A]">
                {d.ip_address || "IP 확인 중"} · 마지막 활동 {formatSessionDate(d.last_seen_at || d.created_at)}
              </p>
            </div>
            {!d.is_current && (
              <button onClick={() => logoutDevice(d.id)} disabled={actionId === d.id}
                className="shrink-0 flex items-center gap-1.5 rounded-xl border border-[rgba(239,68,68,.2)] bg-[rgba(239,68,68,.05)] px-3.5 py-2 text-[12px] font-bold text-[#EF4444] transition-all hover:bg-[rgba(239,68,68,.1)]">
                <Icon name="logOut" size={13} color="#EF4444" />
                {actionId === d.id ? "처리 중" : "로그아웃"}
              </button>
            )}
          </div>
        ))}
      </div>

      {otherSessionsCount > 0 && (
        <div className="pt-2">
          <button onClick={logoutOthers} disabled={actionId === "all"}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[rgba(239,68,68,.2)] bg-[rgba(239,68,68,.04)] py-3 text-[13px] font-bold text-[#EF4444] transition-all hover:bg-[rgba(239,68,68,.08)] disabled:opacity-60">
            <Icon name="logOut" size={14} color="#EF4444" />
            {actionId === "all" ? "처리 중..." : "다른 모든 기기에서 로그아웃"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function DataSection({ showToast }) {
  const [loading, setLoading] = useState(null);

  const exportData = (fmt) => {
    setLoading(fmt);
    setTimeout(() => {
      setLoading(null);
      showToast(`${fmt} 형식으로 내보내기가 시작됐습니다.`);
    }, 1200);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[18px] font-bold tracking-[-0.3px] text-[#0D1B2A]">내 데이터</h2>
        <p className="mt-1 text-[13px] text-[#5A6F8A]">내 데이터를 백업하거나 내보낼 수 있습니다.</p>
      </div>

      <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-[#FAFCFF] p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(0,100,180,.12)] bg-white">
            <Icon name="download" size={16} color="#0099CC" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#0D1B2A]">데이터 내보내기</p>
            <p className="text-[12px] text-[#5A6F8A]">회의록, 티켓 내역 등 모든 데이터를 파일로 저장합니다.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {["CSV", "JSON"].map(fmt => (
            <button key={fmt} onClick={() => exportData(fmt)} disabled={!!loading}
              className="inline-flex items-center gap-2 rounded-xl border border-[rgba(0,100,180,.15)] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#0D1B2A] shadow-[0_1px_4px_rgba(0,60,150,.06)] transition-all hover:border-[rgba(0,153,204,.4)] hover:text-[#0099CC] disabled:opacity-60">
              {loading === fmt
                ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0099CC]/30 border-t-[#0099CC]" />
                : <Icon name="download" size={14} color="currentColor" />
              }
              {fmt}로 내보내기
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "회의 수",    value: "47건" },
          { label: "Jira 티켓", value: "132개" },
          { label: "총 용량",   value: "2.3 GB" },
        ].map(s => (
          <div key={s.label}
            className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-4 text-center">
            <p className="text-[20px] font-black tracking-[-1px] text-[#0D1B2A]">{s.value}</p>
            <p className="mt-0.5 text-[12px] text-[#5A6F8A]">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function SubscriptionSection({ showToast, isMobile }) {
  const navigate = useNavigate();
  const [planLoading, setPlanLoading] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const cachedPlanId = (() => {
    try {
      const raw = localStorage.getItem("tiki_user");
      return raw ? (JSON.parse(raw).planId ?? "free") : "free";
    } catch {
      return "free";
    }
  })();
  const cachedBilling = (() => {
    try {
      const raw = localStorage.getItem("tiki_user");
      return raw ? (JSON.parse(raw).billing ?? "monthly") : "monthly";
    } catch {
      return "monthly";
    }
  })();

  const syncLocalSubscription = (sub) => {
    try {
      const raw = localStorage.getItem("tiki_user");
      const user = raw ? JSON.parse(raw) : {};
      localStorage.setItem("tiki_user", JSON.stringify({
        ...user,
        isSubscribed: sub.plan_id !== "free",
        planId: sub.plan_id || "free",
        billing: sub.billing || "monthly",
        nextBillingAt: sub.next_billing_at || null,
        currentPeriodStartedAt: sub.current_period_started_at || sub.updated_at || null,
        currentPeriodEndsAt: sub.current_period_ends_at || sub.next_billing_at || null,
      }));
      window.dispatchEvent(new Event("tiki-auth-changed"));
    } catch {
      // 서버 구독 정보가 원본이므로 로컬 캐시 저장 실패는 무시한다.
    }
  };

  useEffect(() => {
    if (!localStorage.getItem("tiki_access_token")) return;

    let cancelled = false;
    setPlanLoading(true);
    getSubscription()
      .then((sub) => {
        if (cancelled) return;
        setSubscription(sub);
        syncLocalSubscription(sub);
      })
      .catch(() => {
        // Keep locally cached plan info when API lookup fails.
      })
      .finally(() => {
        if (!cancelled) setPlanLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const currentPlanId = subscription?.plan_id || cachedPlanId;
  const currentBilling = subscription?.billing || cachedBilling;
  const currentPlan = PLANS.find((p) => p.id === currentPlanId) || PLANS[0];
  const currentPrice = currentPlan.price[currentBilling] || 0;
  const billingLabel = currentBilling === "yearly" ? "연간" : "월간";
  const priceLabel =
    currentPrice === 0
      ? "무료"
      : currentBilling === "yearly"
      ? `${currentPrice.toLocaleString("ko-KR")}원/월 · 연간 결제`
      : `${currentPrice.toLocaleString("ko-KR")}원/월`;
  const startedAt = subscription?.current_period_started_at || subscription?.updated_at;
  const endsAt = subscription?.current_period_ends_at || subscription?.next_billing_at;
  const formatSubDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  };

  const topFeatures = [
    currentPlan.features.find((f) => f.label.includes("회의 분석")),
    currentPlan.features.find((f) => f.label.includes("음성 녹음")),
    currentPlan.features.find((f) => f.label.includes("팀원 초대")),
    currentPlan.features.find((f) => f.label.includes("해야 할 일")),
  ].filter(Boolean);
  const includedFeatures = currentPlan.features.filter((feature) => feature.included);
  const goSubscription = () => navigate("/subscription", { state: { mobileTab: "mypage" } });

  const [changingPlanId, setChangingPlanId] = useState(null);

  // Upgrades need a real charge, so send those through the actual Toss
  // checkout flow. A downgrade (including cancelling back to Free) removes
  // access rather than adding it, so it doesn't need payment — apply it here
  // directly instead of bouncing to /subscription, which itself used to just
  // refuse downgrades and point back to this page (a dead end for the user).
  const handleChangePlan = async (plan) => {
    if (plan.id === currentPlanId) return;
    const isUpgrade = (PLAN_TIER[plan.id] ?? 0) > (PLAN_TIER[currentPlanId] ?? 0);
    if (isUpgrade) {
      navigate("/subscription/checkout", { state: { plan, billing: currentBilling } });
      return;
    }

    const confirmed = window.confirm(
      plan.id === "free"
        ? `구독을 해지하고 무료 플랜으로 전환할까요? 유료 기능(${currentPlan.name} 플랜 전용 기능 포함)을 더 이상 사용할 수 없습니다.`
        : `${currentPlan.name}에서 ${plan.name} 플랜으로 변경할까요? 다운그레이드는 즉시 적용되며, 상위 플랜 전용 기능을 더 이상 사용할 수 없습니다.`
    );
    if (!confirmed) return;

    setChangingPlanId(plan.id);
    try {
      const sub = await subscribePlan({ planId: plan.id, billing: currentBilling });
      setSubscription(sub);
      syncLocalSubscription(sub);
      showToast(plan.id === "free" ? "구독이 해지되었습니다." : "플랜이 변경되었습니다.");
    } catch (error) {
      showToast(error?.message || "플랜 변경에 실패했습니다.", "error");
    } finally {
      setChangingPlanId(null);
    }
  };

  const handleCancelSubscription = () => handleChangePlan(PLANS.find((p) => p.id === "free"));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[18px] font-bold tracking-[-0.3px] text-[#0D1B2A]">구독권 관리</h2>
        <button
          onClick={goSubscription}
          className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0099CC,#7C3AED)] px-4 py-2 text-[12px] font-bold text-white shadow-[0_8px_18px_rgba(0,153,204,.18)]"
        >
          플랜 업그레이드
        </button>
      </div>

      <div className="rounded-2xl border border-[rgba(0,100,180,.12)] bg-[linear-gradient(135deg,rgba(0,153,204,.08),rgba(124,58,237,.07))] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge label="이용 중" variant="cyan" />
              <p className="text-[18px] font-black text-[#0D1B2A]">TIKI {currentPlan.name}</p>
              {planLoading && <span className="text-[11px] text-[#5A6F8A]">동기화 중...</span>}
            </div>
            <p className="text-[13px] text-[#4A5D78]">{billingLabel} 플랜 · {priceLabel}</p>
            <div className="mt-3 grid gap-2 text-[12px] text-[#4A5D78] sm:grid-cols-2">
              <div className="rounded-xl bg-white/70 px-3 py-2">
                <span className="block text-[11px] font-semibold text-[#8A9AB0]">사용 시작일</span>
                <strong className="text-[#0D1B2A]">{formatSubDate(startedAt) || "가입일 기준 이용 중"}</strong>
              </div>
              <div className="rounded-xl bg-white/70 px-3 py-2">
                <span className="block text-[11px] font-semibold text-[#8A9AB0]">{currentPlanId === "free" ? "사용 기간" : "다음 결제일"}</span>
                <strong className="text-[#0D1B2A]">{currentPlanId === "free" ? "제한 없이 이용 가능" : formatSubDate(endsAt) || "결제일 확인 중"}</strong>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/70 p-3 sm:w-[240px]">
            <p className="text-[12px] font-bold text-[#0D1B2A]">현재 플랜 핵심 제공 항목</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {topFeatures.slice(0, 4).map((feature) => (
                <span
                  key={feature.label}
                  className="inline-flex items-center rounded-full bg-[rgba(0,153,204,.08)] px-2.5 py-1 text-[11px] font-semibold text-[#0099CC]"
                >
                  {formatPlanFeatureLabel(feature.label)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const selected = plan.id === currentPlanId;
          const planPrice = plan.price[currentBilling] || 0;
          const discount = yearlyDiscount(plan);
          const isUpgrade = (PLAN_TIER[plan.id] ?? 0) > (PLAN_TIER[currentPlanId] ?? 0);

          return (
            <div
              key={plan.id}
              className={cn(
                "rounded-2xl border p-4 transition-colors",
                selected
                  ? "border-[rgba(0,153,204,.35)] bg-[rgba(0,153,204,.06)]"
                  : "border-[rgba(0,100,180,.1)] bg-white"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-bold text-[#0D1B2A]">TIKI {plan.name}</p>
                {selected && <Badge label="이용 중" variant="cyan" />}
              </div>
              <p className="mt-1 text-[12px] text-[#5A6F8A]">
                {planPrice === 0 ? "무료" : `${planPrice.toLocaleString("ko-KR")}원/월`}
              </p>
              {currentBilling === "yearly" && discount > 0 && (
                <p className="mt-0.5 text-[11px] font-semibold text-[#0099CC]">연간 결제 {discount}% 할인</p>
              )}
              <p className="mt-2 text-[11px] text-[#5A6F8A]">{plan.tagline}</p>
              <button
                type="button"
                onClick={() => handleChangePlan(plan)}
                disabled={selected || changingPlanId !== null}
                className={cn(
                  "mt-3 w-full rounded-xl px-3 py-2 text-[12px] font-bold transition-colors disabled:opacity-60",
                  selected
                    ? "cursor-default bg-[rgba(0,153,204,.08)] text-[#0099CC]"
                    : isUpgrade
                    ? "bg-[#0099CC] text-white hover:bg-[#0088BB]"
                    : "border border-[rgba(0,100,180,.12)] bg-white text-[#5A6F8A] hover:bg-[rgba(0,60,150,.04)]"
                )}
              >
                {selected
                  ? "현재 이용 중"
                  : changingPlanId === plan.id
                    ? "변경 중..."
                    : isUpgrade
                      ? "업그레이드"
                      : "플랜 변경"}
              </button>
            </div>
          );
        })}
      </div>

      {currentPlanId !== "free" && (
        <div className="rounded-2xl border border-[rgba(239,68,68,.15)] bg-[rgba(239,68,68,.03)] p-4 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-bold text-[#0D1B2A]">구독 해지</p>
            <p className="mt-0.5 text-[12px] text-[#5A6F8A]">해지하면 즉시 무료 플랜으로 전환되고, 유료 기능 이용이 중단됩니다.</p>
          </div>
          <button
            type="button"
            onClick={handleCancelSubscription}
            disabled={changingPlanId !== null}
            className="mt-3 w-full rounded-xl border border-[rgba(239,68,68,.3)] px-4 py-2 text-[12px] font-bold text-[#EF4444] transition-colors hover:bg-[rgba(239,68,68,.06)] disabled:opacity-60 sm:mt-0 sm:w-auto"
          >
            {changingPlanId === "free" ? "해지 중..." : "구독 해지하기"}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-4">
        <p className="text-[12px] font-semibold text-[#5A6F8A]">현재 플랜 전체 제공 항목</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {includedFeatures.map((feature) => (
            <div
              key={`current-feature-${feature.label}`}
              className="flex items-center gap-2 rounded-xl border border-[rgba(0,153,204,.12)] bg-[rgba(0,153,204,.04)] px-3 py-2 text-[12px] font-semibold text-[#0D1B2A]"
            >
              <Icon name="checkCircle" size={14} color="#0099CC" />
              {formatPlanFeatureLabel(feature.label)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Root
// ═══════════════════════════════════════════════════════════════════════════
export default function MyPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("home");
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [activeBottomTab, setActiveBottomTab] = useState("mypage");
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem("tiki_access_token")));
  const [sessionUser, setSessionUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("tiki_user") || "null");
    } catch {
      return null;
    }
  });

  const stateLabels = {
    IDLE: "대기",
    UPLOADING: "업로드 중",
    PROCESSING: "처리 중",
    COMPLETED: "완료",
    FAILED: "실패",
  };

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

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
    const prevHtmlGutter = document.documentElement.style.scrollbarGutter;
    const prevBodyOverflowY = document.body.style.overflowY;

    // Keep layout width stable even when page height changes between tabs.
    document.documentElement.style.scrollbarGutter = "stable";
    document.body.style.overflowY = "scroll";

    return () => {
      document.documentElement.style.scrollbarGutter = prevHtmlGutter;
      document.body.style.overflowY = prevBodyOverflowY;
    };
  }, []);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);

  const handleLogout = useCallback(() => {
    sessionStorage.setItem("tiki_flash_toast", "로그아웃 되었습니다.");
    clearAuthSession();
    navigate("/onboarding", { replace: true });
  }, [navigate]);

  const handleAccountDeleted = useCallback(() => {
    localStorage.removeItem(PROFILE_ALIAS_STORAGE_KEY);
    sessionStorage.setItem("tiki_flash_toast", "계정 탈퇴가 완료되었습니다.");
    clearAuthSession();
    navigate("/onboarding", { replace: true });
  }, [navigate]);

  const handleModal = (type) => setModal(type);
  const closeModal = () => setModal(null);

  const confirmModal = () => {
    if (modal === "logout-all") showToast("다른 기기에서 모두 로그아웃됐습니다.");
    closeModal();
  };

  const modalConfig = {
    "logout-all": {
      title: "다른 기기에서 로그아웃",
      body: "현재 기기를 제외한 모든 기기에서 로그아웃됩니다. 계속하시겠습니까?",
      confirmLabel: "로그아웃", danger: true,
    },
  };

  const activeNav = NAV_ITEMS.find(n => n.id === activeTab);
  const profileName = sessionUser?.name || "사용자";
  const profileEmail = sessionUser?.email || "";
  const profileAliases = [
    ...(Array.isArray(sessionUser?.aliases) ? sessionUser.aliases : []),
    ...readJsonArray(PROFILE_ALIAS_STORAGE_KEY),
  ];
  const profileDepartment =
    sessionUser?.department ||
    sessionUser?.dept ||
    sessionUser?.team ||
    ROLE_LABELS[sessionUser?.role] ||
    sessionUser?.role ||
    "";
  const profilePosition = sessionUser?.position || "";

  return (
    <div className="relative min-h-screen bg-white text-[#0D1B2A] [font-family:'Pretendard']">
      <Header
        isMobile={isMobile}
        isLoggedIn={isAuthenticated}
        phase="IDLE"
        stateLabels={stateLabels}
        user={{ name: profileName, email: profileEmail }}
        onLogout={handleLogout}
        hideMobileMenu={true}
      />

      <div className="relative z-[1] mx-auto max-w-[960px] px-4 pt-24 pb-28 sm:px-6 sm:pb-16">

        <div className="flex gap-0 sm:gap-8">

          {/* ── Sidebar ── */}
          <aside className="hidden w-[188px] shrink-0 sm:block">

            <nav className="space-y-0.5">
              {NAV_ITEMS.map(item => {
                const active = activeTab === item.id;
                return (
                  <button key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold transition-all text-left",
                      active
                        ? "bg-[rgba(0,153,204,.1)] text-[#0099CC]"
                        : "text-[#5A6F8A] hover:bg-[rgba(0,60,150,.05)] hover:text-[#0D1B2A]"
                    )}>
                    <Icon name={item.icon} size={15} color={active ? "#0099CC" : "currentColor"} sw={active ? 2 : 1.8} />
                    {item.label}
                    {active && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[#0099CC]" />}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* ── Content ── */}
          <main className="min-w-0 flex-1 pt-2 sm:pt-0">
            {activeTab !== "home" && (
              <div className="mb-4 flex items-center gap-2 sm:hidden">
                <span
                  onClick={() => setActiveTab("home")}
                  className="cursor-pointer text-[12px] font-semibold text-[#9BAABE] transition-colors hover:text-[#0099CC]"
                >
                  홈
                </span>
                <Icon name="chevronRight" size={12} color="#9BAABE" />
                <span className="text-[12px] font-semibold text-[#0D1B2A]">{activeNav?.label}</span>
              </div>
            )}

            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 sm:hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {NAV_ITEMS.map(item => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                      active
                        ? "border-[rgba(0,153,204,.35)] bg-[rgba(0,153,204,.1)] text-[#0099CC]"
                        : "border-[rgba(0,100,180,.12)] bg-white text-[#5A6F8A]"
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
              {/* 모바일 전용 로그아웃: 메뉴 리스트와 같은 칩 형태, 위험 액션이라 붉은 톤으로 구분 */}
              <div className="ml-1 shrink-0 self-stretch w-px bg-[rgba(0,100,180,.12)]" />
              <button
                onClick={handleLogout}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[rgba(239,68,68,.25)] bg-[rgba(239,68,68,.05)] px-3 py-1.5 text-[12px] font-semibold text-[#EF4444] transition-colors"
              >
                <Icon name="logOut" size={12} color="#EF4444" sw={2} />
                로그아웃
              </button>
            </div>

            <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-5 shadow-[0_2px_16px_rgba(0,60,150,.05)] sm:p-7">
              {activeTab === "home"          && <HomeSection goTo={setActiveTab} name={profileName} email={profileEmail} department={profileDepartment} aliases={profileAliases} />}
              {activeTab === "profile"      && <ProfileSection showToast={showToast} initialName={profileName} initialEmail={profileEmail} initialDepartment={profileDepartment} initialPosition={profilePosition} />}
              {activeTab === "security"     && <SecuritySection showToast={showToast} setModal={handleModal} />}
              {activeTab === "integrations" && <IntegrationsSection showToast={showToast} />}
              {activeTab === "subscription" && <SubscriptionSection showToast={showToast} isMobile={isMobile} />}
              {activeTab === "sessions"     && <SessionsSection showToast={showToast} setModal={handleModal} />}
              {activeTab === "data"         && <DataSection showToast={showToast} />}
            </div>
          </main>
        </div>
      </div>

      {/* Modal */}
      {modal === "delete" && (
        <AccountDeleteModal
          onCancel={closeModal}
          onDeleted={handleAccountDeleted}
          showToast={showToast}
        />
      )}
      {modal && modalConfig[modal] && (
        <Modal {...modalConfig[modal]} onConfirm={confirmModal} onCancel={closeModal} />
      )}

      {!isMobile && <Footer />}
      {isMobile && <MobileTab active={activeBottomTab} onChange={setActiveBottomTab} />}

      {/* Toast */}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
