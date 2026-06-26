import { useState, useRef, useEffect, useCallback } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import MobileTab from "../components/MobileTab";
import { clearAuthSession } from "../api/apiClient";

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

const DEPARTMENTS = [
  "마케터",
  "PM",
  "디자이너",
  "기타",
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

const INTEGRATIONS = [
  { id: "jira",   name: "Jira",   desc: "TIKI 앱 개발 외 3개 프로젝트 연동",  connected: true,  color: "#0052CC", initial: "J" },
  { id: "notion", name: "Notion", desc: "아직 연동되지 않았습니다",             connected: false, color: "#111827", initial: "N" },
];

// ── Tiny helpers ──────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={cn(
      "fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(0,0,0,.18)] backdrop-blur-sm",
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

const RECENT_MEETINGS = [
  { id: 1, title: "TIKI 앱 개발 - 스프린트 12 리뷰", date: "6월 24일", actionItems: 5, done: 3 },
  { id: 2, title: "Q3 로드맵 정렬 회의",              date: "6월 22일", actionItems: 3, done: 3 },
  { id: 3, title: "디자인 시스템 토큰 점검",           date: "6월 19일", actionItems: 4, done: 1 },
];

function HomeSection({ goTo, name, email, department }) {
  const totalActionItems = RECENT_MEETINGS.reduce((s, m) => s + m.actionItems, 0);
  const doneActionItems = RECENT_MEETINGS.reduce((s, m) => s + m.done, 0);

  return (
    <div className="space-y-7">
      {/* 인사말 */}
      <div>
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#0099CC]">
          <Icon name="sparkles" size={13} color="#0099CC" />
          {getGreeting()}
        </p>
        <h1 className="mt-1 text-[22px] font-extrabold tracking-[-0.4px] text-[#0D1B2A]">
          {name}<span className="text-[#5A6F8A] font-bold">님,</span> 오늘의 TIKI 현황입니다
        </h1>
      </div>

      {/* 이번 달 활동 요약 - 메인 스트립 */}
      <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-[linear-gradient(135deg,rgba(0,153,204,.06),rgba(124,58,237,.05))] p-5 sm:p-6">
        <p className="mb-4 text-[12px] font-bold text-[#5A6F8A]">이번 달 활동</p>
        <div className="grid grid-cols-3 gap-4">
          <StatBlock value="47건" label="총 회의" />
          <StatBlock value={`${doneActionItems}/${totalActionItems}`} label="처리현황" accent />
          <StatBlock value="132개" label="Jira 티켓 생성" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* 좌측: 프로필(계정) + 구독권 */}
        <div className="space-y-5">
          {/* 계정 카드: 아바타·이름을 한 줄에, 이메일·부서를 보조 메타로 한 줄에 정리 */}
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

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Icon name="briefcase" size={12} color="#5A6F8A" />
                <span className="truncate text-[14px] font-semibold text-[#5A6F8A]">
                  {department || "부서 미설정"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-[14px] font-black text-[#0D1B2A]">TIKI Pro</p>
                <Badge label="이용중" variant="cyan" />
              </div>
              <button onClick={() => goTo("subscription")}
                className="text-[11px] font-semibold text-[#5A6F8A] hover:text-[#0099CC]">관리</button>
            </div>
            <div className="space-y-2.5">
              <UsageBar label="월간 업로드" value={42} max={100} unit="건" />
              <UsageBar label="저장 용량" value={2.3} max={10} unit="GB" />
            </div>
          </div>
        </div>

        {/* 우측: 최근 회의 */}
        <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-[#0D1B2A]">최근 회의</h3>
            <span className="text-[12px] text-[#9BAABE]">최근 3건</span>
          </div>
          <div className="space-y-1">
            {RECENT_MEETINGS.map((m, i) => (
              <div key={m.id}
                className={cn(
                  "flex items-center gap-3 py-3",
                  i !== RECENT_MEETINGS.length - 1 && "border-b border-[rgba(0,100,180,.07)]"
                )}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,153,204,.08)]">
                  <Icon name="checkCircle" size={15} color={m.done === m.actionItems ? "#10B981" : "#0099CC"} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[#0D1B2A]">{m.title}</p>
                  <p className="mt-0.5 text-[11px] text-[#9BAABE]">{m.date} · 액션 아이템 {m.done}/{m.actionItems} 완료</p>
                </div>
                <Icon name="chevronRight" size={14} color="#9BAABE" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSection({ showToast, initialName, initialEmail, initialDepartment }) {
  const fileRef = useRef(null);
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState("AI 기반 회의 자동화를 연구합니다.");
  const [avatar, setAvatar] = useState(null);
  const [saving, setSaving] = useState(false);

  // 부서: 가입 시 선택한 값을 그대로 표시. "변경" 버튼을 눌러야 수정 모드로 전환됨.
  const initialIsCustom = !!initialDepartment && !DEPARTMENTS.includes(initialDepartment);
  const [department, setDepartment] = useState(initialDepartment || "");
  const [isEditingDept, setIsEditingDept] = useState(false);
  const [deptSelect, setDeptSelect] = useState(initialIsCustom ? "직접 입력" : (initialDepartment || ""));
  const [deptCustom, setDeptCustom] = useState(initialIsCustom ? initialDepartment : "");
  const [deptError, setDeptError] = useState("");

  const isCustomDept = deptSelect === "직접 입력";

  const startEditDept = () => {
    // 수정 모드 진입 시, 현재 확정된 부서값으로 select를 다시 맞춰줌
    const curIsCustom = !!department && !DEPARTMENTS.includes(department);
    setDeptSelect(curIsCustom ? "직접 입력" : department);
    setDeptCustom(curIsCustom ? department : "");
    setDeptError("");
    setIsEditingDept(true);
  };

  const cancelEditDept = () => {
    setDeptError("");
    setIsEditingDept(false);
  };

  const confirmDept = () => {
    if (!deptSelect) { setDeptError("부서를 선택해 주세요."); return; }
    if (isCustomDept && !deptCustom.trim()) { setDeptError("부서명을 입력해 주세요."); return; }
    setDepartment(isCustomDept ? deptCustom.trim() : deptSelect);
    setDeptError("");
    setIsEditingDept(false);
    showToast("부서가 변경됐습니다.");
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg","image/png"].includes(f.type)) { showToast("JPG, PNG 파일만 가능합니다.", "error"); return; }
    if (f.size > 5*1024*1024) { showToast("5MB 이하 이미지만 업로드할 수 있습니다.", "error"); return; }
    setAvatar(URL.createObjectURL(f));
  };

  const save = () => {
    if (!name.trim()) { showToast("이름을 입력해 주세요.", "error"); return; }
    setSaving(true);
    setTimeout(() => { setSaving(false); showToast("프로필이 저장됐습니다."); }, 900);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[18px] font-bold tracking-[-0.3px] text-[#0D1B2A]">프로필</h2>
        <p className="mt-1 text-[13px] text-[#5A6F8A]">서비스에서 표시될 내 정보를 관리합니다.</p>
      </div>

      {/* Avatar block */}
      <div className="flex items-center gap-5">
        <div className="relative">
          <div className="h-[80px] w-[80px] overflow-hidden rounded-2xl border-2 border-[rgba(0,153,204,.2)] bg-[linear-gradient(135deg,rgba(0,153,204,.15),rgba(124,58,237,.15))] shadow-[0_4px_16px_rgba(0,0,0,.08)]">
            {avatar
              ? <img src={avatar} className="h-full w-full object-cover" alt="avatar" />
              : <div className="flex h-full w-full items-center justify-center text-[32px] font-black text-[#0099CC] select-none">{name[0]}</div>
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
          <p className="text-[12px] text-[#5A6F8A]">{initialEmail}</p>
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

      {/* Fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="이름 (닉네임)">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="이름 입력" />
        </Field>
        <Field label="이메일" hint="이메일은 로그인 ID로, 변경할 수 없습니다.">
          <Input value={initialEmail} disabled />
        </Field>

        <Field label="부서">
          {!isEditingDept ? (
            <div className="flex items-center justify-between rounded-xl border border-[rgba(0,100,180,.15)] bg-[#F8FAFF] px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <Icon name="briefcase" size={14} color="#5A6F8A" />
                <span className="text-[13px] font-semibold text-[#0D1B2A]">
                  {department || "부서 미설정"}
                </span>
              </div>
              <button onClick={startEditDept}
                className="shrink-0 rounded-lg border border-[rgba(0,100,180,.15)] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#5A6F8A] transition-colors hover:border-[rgba(0,153,204,.4)] hover:text-[#0099CC]">
                변경
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Select
                value={deptSelect}
                onChange={e => { setDeptSelect(e.target.value); setDeptError(""); }}
                options={DEPARTMENTS}
                placeholder="부서 선택"
                error={deptError}
                autoOpen={isEditingDept}
              />
              {isCustomDept && (
                <Input
                  value={deptCustom}
                  onChange={e => { setDeptCustom(e.target.value); setDeptError(""); }}
                  placeholder="부서명을 입력하세요"
                  error={!!deptError}
                />
              )}
              {deptError && <p className="text-[12px] text-[#EF4444]">{deptError}</p>}
              <div className="flex gap-2">
                <button onClick={confirmDept}
                  className="rounded-lg bg-[linear-gradient(135deg,#0099CC,#0077AA)] px-3 py-1.5 text-[12px] font-bold text-white">
                  확인
                </button>
                <button onClick={cancelEditDept}
                  className="rounded-lg border border-[rgba(0,0,0,.1)] bg-[rgba(0,0,0,.04)] px-3 py-1.5 text-[12px] font-semibold text-[#5A6F8A]">
                  취소
                </button>
              </div>
            </div>
          )}
        </Field>

        <Field label="한 줄 소개" className="sm:col-span-2">
          <Input value={bio} onChange={e => setBio(e.target.value)} placeholder="간단한 소개를 입력하세요" />
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

  const save = () => {
    const e = {};
    if (!cur) e.cur = "현재 비밀번호를 입력해 주세요.";
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(nw))
      e.nw = "8자 이상, 영문·숫자·특수문자(@$!%*?&)를 모두 포함해야 합니다.";
    if (nw !== cf) e.cf = "새 비밀번호가 일치하지 않습니다.";
    setErrs(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false); setCur(""); setNw(""); setCf("");
      showToast("비밀번호가 변경됐습니다.");
    }, 1000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[18px] font-bold tracking-[-0.3px] text-[#0D1B2A]">보안</h2>
        <p className="mt-1 text-[13px] text-[#5A6F8A]">계정 보호를 위해 주기적으로 비밀번호를 변경하세요.</p>
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
              탈퇴 시 모든 프로젝트, 회의록, 연동 데이터가<br />
              영구 삭제되며 복구할 수 없습니다.
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

// ─────────────────────────────────────────────────────────────────────────
function IntegrationsSection({ showToast }) {
  const [items, setItems] = useState(INTEGRATIONS);

  const toggle = (id) => {
    setItems(p => p.map(i => i.id === id ? { ...i, connected: !i.connected } : i));
    const item = items.find(i => i.id === id);
    showToast(item.connected ? `${item.name} 연동이 해제됐습니다.` : `${item.name}과 연동됐습니다.`);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[18px] font-bold tracking-[-0.3px] text-[#0D1B2A]">외부 툴 연동</h2>
        <p className="mt-1 text-[13px] text-[#5A6F8A]">TIKI와 연동된 외부 서비스를 한눈에 확인하고 관리하세요.</p>
      </div>

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id}
            className="flex items-center gap-4 rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-4 transition-shadow hover:shadow-[0_4px_16px_rgba(0,60,150,.07)]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[14px] font-black text-white"
              style={{ background: item.color }}>
              {item.initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold text-[#0D1B2A]">{item.name}</span>
                <Badge label={item.connected ? "연동됨" : "미연동"} variant={item.connected ? "success" : "default"} />
              </div>
              <p className="mt-0.5 truncate text-[12px] text-[#5A6F8A]">{item.desc}</p>
            </div>
            <button
              onClick={() => toggle(item.id)}
              className={cn(
                "shrink-0 rounded-xl px-4 py-2 text-[12px] font-bold transition-all",
                item.connected
                  ? "border border-[rgba(0,0,0,.1)] bg-[rgba(0,0,0,.04)] text-[#5A6F8A] hover:border-[rgba(239,68,68,.3)] hover:bg-[rgba(239,68,68,.06)] hover:text-[#EF4444]"
                  : "bg-[linear-gradient(135deg,#0099CC,#0077AA)] text-white shadow-[0_2px_8px_rgba(0,153,204,.25)] hover:shadow-[0_4px_14px_rgba(0,153,204,.35)]"
              )}>
              {item.connected ? "연동 해제" : "연동하기"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function SessionsSection({ showToast, setModal }) {
  const [devices, setDevices] = useState(DEVICES);

  const logoutDevice = (id) => {
    setDevices(p => p.filter(d => d.id !== id));
    showToast("해당 기기에서 로그아웃됐습니다.");
  };

  const ICON_MAP = { monitor: "monitor", smartphone: "smartphone", globe: "globe" };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[18px] font-bold tracking-[-0.3px] text-[#0D1B2A]">세션 관리</h2>
        <p className="mt-1 text-[13px] text-[#5A6F8A]">현재 로그인된 기기를 확인하고 관리하세요.</p>
      </div>

      <div className="space-y-2.5">
        {devices.map(d => (
          <div key={d.id}
            className={cn(
              "flex items-center gap-4 rounded-2xl border p-4 transition-all",
              d.current
                ? "border-[rgba(0,153,204,.25)] bg-[rgba(0,153,204,.04)]"
                : "border-[rgba(0,100,180,.1)] bg-white hover:shadow-[0_2px_12px_rgba(0,60,150,.06)]"
            )}>
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
              d.current ? "border-[rgba(0,153,204,.2)] bg-[rgba(0,153,204,.08)]" : "border-[rgba(0,100,180,.1)] bg-[#F8FAFF]"
            )}>
              <Icon name={ICON_MAP[d.icon]} size={17} color={d.current ? "#0099CC" : "#5A6F8A"} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold text-[#0D1B2A]">{d.name}</span>
                {d.current && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(16,185,129,.1)] px-2 py-0.5 text-[10px] font-bold text-[#10B981]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#10B981]" />
                    현재 기기
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[12px] text-[#5A6F8A]">{d.location} · {d.lastActive}</p>
            </div>
            {!d.current && (
              <button onClick={() => logoutDevice(d.id)}
                className="shrink-0 flex items-center gap-1.5 rounded-xl border border-[rgba(239,68,68,.2)] bg-[rgba(239,68,68,.05)] px-3.5 py-2 text-[12px] font-bold text-[#EF4444] transition-all hover:bg-[rgba(239,68,68,.1)]">
                <Icon name="logOut" size={13} color="#EF4444" />
                로그아웃
              </button>
            )}
          </div>
        ))}
      </div>

      {devices.filter(d => !d.current).length > 0 && (
        <div className="pt-2">
          <button onClick={() => setModal("logout-all")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[rgba(239,68,68,.2)] bg-[rgba(239,68,68,.04)] py-3 text-[13px] font-bold text-[#EF4444] transition-all hover:bg-[rgba(239,68,68,.08)]">
            <Icon name="logOut" size={14} color="#EF4444" />
            다른 모든 기기에서 로그아웃
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
function SubscriptionSection({ showToast }) {
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = () => {
    setUpgrading(true);
    setTimeout(() => {
      setUpgrading(false);
      showToast("구독권 업그레이드 신청이 접수됐습니다.");
    }, 900);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[18px] font-bold tracking-[-0.3px] text-[#0D1B2A]">구독권 관리</h2>
        <p className="mt-1 text-[13px] text-[#5A6F8A]">현재 이용 중인 플랜과 결제 정보를 확인합니다.</p>
      </div>

      <div className="rounded-2xl border border-[rgba(0,100,180,.12)] bg-[linear-gradient(135deg,rgba(0,153,204,.08),rgba(124,58,237,.07))] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge label="현재 플랜" variant="cyan" />
              <p className="text-[16px] font-black text-[#0D1B2A]">TIKI Pro</p>
            </div>
            <p className="text-[13px] text-[#4A5D78]">월 29,000원 · 다음 결제일 2026-07-01</p>
          </div>
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={upgrading}
            className="shrink-0 rounded-xl bg-[linear-gradient(135deg,#0099CC,#0077AA)] px-4 py-2 text-[12px] font-bold text-white shadow-[0_2px_10px_rgba(0,153,204,.25)] disabled:opacity-60"
          >
            {upgrading ? "처리 중..." : "업그레이드"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-4">
          <p className="text-[12px] text-[#5A6F8A]">월간 업로드</p>
          <p className="mt-1 text-[18px] font-black text-[#0D1B2A]">42 / 100</p>
        </div>
        <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-4">
          <p className="text-[12px] text-[#5A6F8A]">저장 용량</p>
          <p className="mt-1 text-[18px] font-black text-[#0D1B2A]">2.3GB / 10GB</p>
        </div>
        <div className="rounded-2xl border border-[rgba(0,100,180,.1)] bg-white p-4">
          <p className="text-[12px] text-[#5A6F8A]">팀 좌석 수</p>
          <p className="mt-1 text-[18px] font-black text-[#0D1B2A]">8 / 10</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Root
// ═══════════════════════════════════════════════════════════════════════════
export default function MyPage() {
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
    clearAuthSession();
    showToast("로그아웃 되었습니다.");
  }, [showToast]);

  const handleModal = (type) => setModal(type);
  const closeModal = () => setModal(null);

  const confirmModal = () => {
    if (modal === "delete") showToast("계정이 삭제됐습니다.", "error");
    if (modal === "logout-all") showToast("다른 기기에서 모두 로그아웃됐습니다.");
    closeModal();
  };

  const modalConfig = {
    "delete": {
      title: "정말 탈퇴하시겠습니까?",
      body: "탈퇴 시 보유 중인 모든 프로젝트, 회의록, Jira 연동 데이터가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.",
      confirmLabel: "탈퇴하기", danger: true,
    },
    "logout-all": {
      title: "다른 기기에서 로그아웃",
      body: "현재 기기를 제외한 모든 기기에서 로그아웃됩니다. 계속하시겠습니까?",
      confirmLabel: "로그아웃", danger: true,
    },
  };

  const activeNav = NAV_ITEMS.find(n => n.id === activeTab);
  const profileName = sessionUser?.name || "사용자";
  const profileEmail = sessionUser?.email || "";
  const profileDepartment =
    sessionUser?.department ||
    sessionUser?.dept ||
    sessionUser?.team ||
    ROLE_LABELS[sessionUser?.role] ||
    sessionUser?.role ||
    "";

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
              {activeTab === "home"          && <HomeSection goTo={setActiveTab} name={profileName} email={profileEmail} department={profileDepartment} />}
              {activeTab === "profile"      && <ProfileSection showToast={showToast} initialName={profileName} initialEmail={profileEmail} initialDepartment={profileDepartment} />}
              {activeTab === "security"     && <SecuritySection showToast={showToast} setModal={handleModal} />}
              {activeTab === "integrations" && <IntegrationsSection showToast={showToast} />}
              {activeTab === "subscription" && <SubscriptionSection showToast={showToast} />}
              {activeTab === "sessions"     && <SessionsSection showToast={showToast} setModal={handleModal} />}
              {activeTab === "data"         && <DataSection showToast={showToast} />}
            </div>
          </main>
        </div>
      </div>

      {/* Modal */}
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