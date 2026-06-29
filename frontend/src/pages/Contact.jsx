import { useState, useRef, useEffect, useCallback } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import MobileTab from "../components/MobileTab";

/* ─── TIKI 디자인 시스템 컬러 ──────────────────────────────
   bg #F8FAFF / surface #FFFFFF / surface2 #EEF3FF
   cyan #0099CC / purple #7C3AED / green #10B981
   yellow #F59E0B / red #EF4444
   text #0D1B2A / text-muted #5A6F8A
   border rgba(0,100,180,0.12) / border-active rgba(0,153,204,0.5)

   ※ tailwind.config.js 수정 없이 바로 동작하도록
   모든 색상은 Tailwind 임의값 문법 bg-[#xxxxxx] 로 직접 작성했습니다.
   (커스텀 토큰 이름 대신 hex/rgba를 그대로 클래스에 박아넣는 방식)
─────────────────────────────────────────────────────────── */

const CATEGORY_OPTIONS = [
  { value: "general", label: "일반 문의" },
  { value: "adoption", label: "도입 문의 (기업/팀)" },
  { value: "tech", label: "기술 지원 (업로드/요약 오류)" },
  { value: "integration", label: "연동 문의 (Jira / Notion)" },
  { value: "billing", label: "요금 / 결제" },
  { value: "press", label: "언론 / 홍보" },
  { value: "other", label: "기타" },
];

const FEATURES = [
  { label: "회의 업로드" },
  { label: "AI 요약" },
  { label: "작업 · 담당자 지정" },
  { label: "Jira · Notion 연동" },
];

/* ─── 애니메이션 keyframes (config 수정 불필요, style 태그로 직접 주입) ─── */
const GlobalStyle = () => (
  <style>{`
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
    @keyframes tiki-fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes tiki-shake  { 0%,100% { transform:translateX(0); } 20%,60% { transform:translateX(-5px); } 40%,80% { transform:translateX(5px); } }
    @keyframes tiki-pulse  { 0%,100% { opacity:1; } 50% { opacity:.4; } }
    @keyframes tiki-popIn  { from { opacity:0; transform:scale(.85); } to { opacity:1; transform:scale(1); } }
    .tiki-fade-up   { animation: tiki-fadeUp .4s ease both; }
    .tiki-fade-up-2 { animation: tiki-fadeUp .4s .08s ease both; }
    .tiki-pulse-dot { animation: tiki-pulse 2s ease-in-out infinite; }
    .tiki-shake     { animation: tiki-shake .35s ease; }
    .tiki-pop-in    { animation: tiki-popIn .3s cubic-bezier(.34,1.56,.64,1) both; }
    .font-pretendard { font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'system-ui',sans-serif; }
  `}</style>
);

/* ─── 아이콘 ─────────────────────────────────────────── */
const Icons = {
  Mail: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  Phone: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.61 5.61l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  Pin: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Upload: (p) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  File: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  Send: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  Check: (p) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Upload2: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  Sparkle: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  ),
  Check2: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="18" height="18" rx="3" /><path d="m8 12 3 3 5-6" />
    </svg>
  ),
  Sync: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  ),
};

/* ─── 서브 컴포넌트 ──────────────────────────────────── */
const RequiredDot = () => (
  <span className="ml-1 inline-block h-[5px] w-[5px] -translate-y-px rounded-full bg-[#0099CC] align-middle" />
);

const Label = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-[#0D1B2A]">
    {children}
  </label>
);

const ErrMsg = ({ msg }) =>
  msg ? <p className="mt-1.5 text-xs text-[#EF4444]">{msg}</p> : null;

const UpwardDropdown = ({ value, onChange, options, placeholder, hasError = false, shaking = false }) => {
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

  const selectedLabel = options.find((o) => o.value === value)?.label || placeholder;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full text-sm px-3 py-2.5 rounded-lg border outline-none transition-colors cursor-pointer flex items-center justify-between gap-2 ${shaking ? "tiki-shake" : ""}`}
        style={{
          borderColor: hasError ? "rgba(239,68,68,0.4)" : "rgba(0,100,180,0.12)",
          background: "#F8FAFF",
          color: value ? "#0D1B2A" : "#9CA3AF",
          fontFamily: "inherit",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedLabel}</span>
        <span
          className="h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-[#A0AFBF]"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transformOrigin: "50% 50%", transition: "transform 0.2s ease" }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-20 bottom-full mb-1 w-full rounded-lg border overflow-hidden max-h-52 overflow-y-auto"
          style={{ borderColor: "rgba(0,100,180,0.12)", background: "#fff", boxShadow: "0 8px 24px rgba(13,27,42,0.12)" }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                option.value === value ? "bg-cyan-50 text-cyan-700" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── 기능 strip ─────────────────────────────────────── */
const FeatureStrip = () => {
  const icons = [Icons.Upload2, Icons.Sparkle, Icons.Check2, Icons.Sync];
  return (
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      {FEATURES.map((f, i) => {
        const Icon = icons[i];
        return (
          <span
            key={f.label}
            className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(0,100,180,0.12)] bg-white px-3 py-1.5 text-xs font-semibold text-[#5A6F8A]"
          >
            <Icon /> {f.label}
          </span>
        );
      })}
    </div>
  );
};

/* ─── 파일 행 ────────────────────────────────────────── */
const FileRow = ({ file }) => (
  <div className="flex items-center gap-2 rounded-lg border border-[rgba(0,100,180,0.12)] bg-[#EEF3FF] px-3 py-2 text-sm">
    <Icons.File />
    <span className="flex-1 truncate text-[#0D1B2A]">{file.name}</span>
    <span className="text-[#5A6F8A]">{(file.size / 1024).toFixed(0)}KB</span>
  </div>
);

/* ─── 사이드 정보 패널 ───────────────────────────────── */
const InfoPanel = () => (
  <div className="tiki-fade-up-2 h-fit rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-6 lg:p-7">
    <p className="mb-[18px] text-[15px] font-bold text-[#0D1B2A]">문의 안내</p>

    <div className="flex flex-col gap-3.5">
      <div className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-[#5A6F8A]">
        <Icons.Mail className="mt-0.5 shrink-0" />
        <span>
          <strong className="text-[#0D1B2A]">support@website.kr</strong>
          <br />평일 09:00–18:00 답변
        </span>
      </div>
      <div className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-[#5A6F8A]">
        <Icons.Phone className="mt-0.5 shrink-0" />
        <span>
          <strong className="text-[#0D1B2A]">02-1234-5678</strong>
          <br />평일 10:00–17:00
        </span>
      </div>
      <div className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-[#5A6F8A]">
        <Icons.Pin className="mt-0.5 shrink-0" />
        <span>
          <strong className="text-[#0D1B2A]">서울특별시 강남구</strong>
          <br />테헤란로 123, 10층
        </span>
      </div>
    </div>

    <div className="my-5 h-px bg-[rgba(0,100,180,0.12)]" />

    <div className="mb-3.5 flex items-center gap-2.5">
      <span className="tiki-pulse-dot h-2 w-2 shrink-0 rounded-full bg-[#10B981]" />
      <p className="m-0 text-[13px] text-[#5A6F8A]">
        평균 응답 시간 <strong className="text-[#10B981]">4시간 이내</strong>
      </p>
    </div>

    <div className="rounded-xl bg-[#EEF3FF] p-4">
      <p className="mb-1 text-[13.5px] font-semibold text-[#0D1B2A]">자주 묻는 질문</p>
      <p className="mb-2.5 text-[12.5px] leading-relaxed text-[#5A6F8A]">
        회의 업로드, AI 요약, 지라·노션 연동 관련 FAQ를 먼저 확인해보세요.
      </p>
      <a href="#" className="text-[12.5px] font-bold text-[#0099CC] no-underline hover:underline">
        FAQ 바로가기 →
      </a>
    </div>
  </div>
);

/* ─── 제출 완료 안내 ─────────────────────────────────── */
const SuccessNotice = ({ email, onReset }) => (
  <div className="tiki-fade-up flex flex-col items-center px-6 py-12 text-center">
    <div className="tiki-pop-in mb-[18px] flex h-[50px] w-[50px] items-center justify-center rounded-full bg-[#10B981] text-white">
      <Icons.Check />
    </div>
    <h2 className="mb-2 text-[19px] font-bold text-[#0D1B2A]">문의가 접수되었습니다</h2>
    <p className="mb-5 max-w-[340px] text-sm leading-relaxed text-[#5A6F8A]">
      입력하신 <strong className="text-[#0D1B2A]">{email}</strong> 으로 평균 4시간 이내에 답변드릴게요.
    </p>
    <button
      onClick={onReset}
      className="rounded-lg border border-[rgba(0,100,180,0.12)] px-5 py-2.5 text-[13.5px] font-semibold text-[#0D1B2A] transition-colors hover:bg-[#EEF3FF]"
    >
      새 문의 작성하기
    </button>
  </div>
);

/* ─── 메인 컴포넌트 ──────────────────────────────────── */
export default function ContactPage() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const [activeTab, setActiveTab] = useState("home");
  const [files, setFiles] = useState([]);
  const [charLen, setCharLen] = useState(0);
  const [errors, setErrors] = useState({});
  const [shaking, setShaking] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef(null);

  const initialForm = { name: "", email: "", phone: "", category: "", subject: "", message: "", privacy: false };
  const [form, setForm] = useState(initialForm);

  const stateLabels = { IDLE: "대기", UPLOADING: "업로드 중", PROCESSING: "처리 중", COMPLETED: "완료", FAILED: "실패" };

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
    if (errors[name]) setErrors((er) => ({ ...er, [name]: null }));
  };

  const handlePhone = (e) => {
    let v = e.target.value.replace(/[^0-9]/g, "");
    if (v.length <= 3) v = v;
    else if (v.length <= 7) v = v.slice(0, 3) + "-" + v.slice(3);
    else if (v.length <= 11) v = v.slice(0, 3) + "-" + v.slice(3, 7) + "-" + v.slice(7);
    else v = v.slice(0, 3) + "-" + v.slice(3, 7) + "-" + v.slice(7, 11);
    setForm((f) => ({ ...f, phone: v }));
  };

  const handleCategorySelect = (value) => {
    setForm((f) => ({ ...f, category: value }));
    if (errors.category) setErrors((er) => ({ ...er, category: null }));
  };

  const triggerShake = useCallback((fields) => {
    const next = {};
    fields.forEach((f) => { next[f] = true; });
    setShaking(next);
    setTimeout(() => setShaking({}), 400);
  }, []);

  const validate = () => {
    const errs = {};
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.name.trim()) errs.name = "이름을 입력해주세요.";
    if (!emailRe.test(form.email)) errs.email = "올바른 이메일을 입력해주세요.";
    if (!form.category) errs.category = "문의 유형을 선택해주세요.";
    if (!form.subject.trim()) errs.subject = "제목을 입력해주세요.";
    if (form.message.trim().length < 10) errs.message = "내용을 10자 이상 입력해주세요.";
    if (!form.privacy) errs.privacy = "개인정보 처리방침에 동의해주세요.";
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      triggerShake(Object.keys(errs).filter((k) => k !== "category" && k !== "privacy"));
      return;
    }
    setSubmitted(true);
  };

  const handleReset = () => {
    setForm(initialForm);
    setFiles([]);
    setCharLen(0);
    setErrors({});
    setSubmitted(false);
  };

  /* 공통 input/select/textarea 클래스 — 모든 색상은 임의값 hex로 직접 지정 */
  const fieldBase =
    "w-full rounded-[10px] border bg-white px-3.5 py-3 font-pretendard text-[14.5px] text-[#0D1B2A] outline-none transition-colors placeholder:text-[#5A6F8A]/70";
  const fieldClass = (name) =>
    `${fieldBase} ${
      errors[name]
        ? "border-[#EF4444]"
        : "border-[rgba(0,100,180,0.12)] hover:border-[rgba(0,153,204,0.5)] focus:border-[#0099CC] focus:ring-2 focus:ring-[#0099CC]/20"
    } ${shaking[name] ? "tiki-shake" : ""}`;

  return (
    <>
      <GlobalStyle />
      <Header isMobile={isMobile} phase="IDLE" stateLabels={stateLabels} />

      {/* ── 히어로 ── */}
      <section className="tiki-fade-up bg-[#F8FAFF] pb-11 pt-[108px] text-center font-pretendard">
        <div className="mx-auto max-w-[620px] px-4">
          <span className="mb-4 inline-block rounded-full bg-[#0099CC]/10 px-3 py-1 text-xs font-semibold text-[#0099CC]">
            Contact
          </span>
          <h1 className="mb-3.5 text-[28px] font-bold leading-snug tracking-tight text-[#0D1B2A] sm:text-[32px] md:text-[38px]">
            무엇이든 편하게 물어보세요
          </h1>
          <p className="m-0 text-base leading-loose text-[#5A6F8A]">
            회의 업로드부터 AI 요약, 작업 생성, 지라·노션 연동까지 —
            <br className="hidden sm:block" />
            궁금한 점을 남겨주시면 영업일 기준 1–2일 내에 답변드립니다.
          </p>
          <FeatureStrip />
        </div>
      </section>

      {/* ── 본문 ── */}
      <main
        className={`mx-auto max-w-[1080px] bg-[#F8FAFF] px-4 font-pretendard sm:px-6 ${
          isMobile ? "pb-[168px]" : "pb-20"
        }`}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
          <InfoPanel />

          {/* ── 폼 카드 ── */}
          <div
            className={`tiki-fade-up-2 rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white ${
              submitted ? "p-0" : "p-5 sm:p-8"
            }`}
          >
            {submitted ? (
              <SuccessNotice email={form.email} onReset={handleReset} />
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="name">
                      이름<RequiredDot />
                    </Label>
                    <input
                      id="name" name="name" type="text" placeholder="홍길동" autoComplete="name"
                      value={form.name} onChange={handleChange} className={fieldClass("name")}
                    />
                    <ErrMsg msg={errors.name} />
                  </div>
                  <div>
                    <Label htmlFor="email">
                      이메일<RequiredDot />
                    </Label>
                    <input
                      id="email" name="email" type="email" placeholder="hello@example.com" autoComplete="email"
                      value={form.email} onChange={handleChange} className={fieldClass("email")}
                    />
                    <ErrMsg msg={errors.email} />
                  </div>
                </div>

                <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="phone">
                      연락처 <span className="text-xs font-normal text-[#5A6F8A]/70">(선택)</span>
                    </Label>
                    <input
                      id="phone" name="phone" type="tel" placeholder="010-0000-0000" autoComplete="tel"
                      value={form.phone} onChange={handlePhone}
                      className={`${fieldBase} border-[rgba(0,100,180,0.12)] hover:border-[rgba(0,153,204,0.5)] focus:border-[#0099CC] focus:ring-2 focus:ring-[#0099CC]/20`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">
                      문의 유형<RequiredDot />
                    </Label>
                    <UpwardDropdown
                      value={form.category}
                      onChange={handleCategorySelect}
                      options={CATEGORY_OPTIONS}
                      placeholder="유형을 선택해주세요"
                      hasError={Boolean(errors.category)}
                      shaking={Boolean(shaking.category)}
                    />
                    <ErrMsg msg={errors.category} />
                  </div>
                </div>

                <div className="mb-5">
                  <Label htmlFor="subject">
                    제목<RequiredDot />
                  </Label>
                  <input
                    id="subject" name="subject" type="text" placeholder="문의 제목을 간략히 입력해주세요"
                    value={form.subject} onChange={handleChange} className={fieldClass("subject")}
                  />
                  <ErrMsg msg={errors.subject} />
                </div>

                <div className="mb-5">
                  <Label htmlFor="message">
                    문의 내용<RequiredDot />
                  </Label>
                  <textarea
                    id="message" name="message"
                    placeholder="회의 업로드, AI 요약 결과, 작업·담당자 지정, 지라·노션 연동 등 문의하실 내용을 자세히 작성해주세요."
                    maxLength={1000} value={form.message}
                    onChange={(e) => { handleChange(e); setCharLen(e.target.value.length); }}
                    className={`${fieldClass("message")} min-h-[140px] resize-none leading-relaxed`}
                  />
                  <p className={`mt-1 text-right text-xs ${charLen > 900 ? "text-[#EF4444]" : "text-[#5A6F8A]/70"}`}>
                    {charLen} / 1000
                  </p>
                  <ErrMsg msg={errors.message} />
                </div>

                <div className="mb-6">
                  <Label>
                    파일 첨부 <span className="text-xs font-normal text-[#5A6F8A]/70">(선택, 최대 10MB)</span>
                  </Label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="cursor-pointer rounded-xl border-[1.5px] border-dashed border-[rgba(0,153,204,0.5)] bg-[#EEF3FF] p-5 text-center transition-colors hover:border-[#0099CC] hover:bg-[#0099CC]/10"
                  >
                    <input
                      ref={fileRef} type="file" hidden multiple
                      accept="image/*,.pdf,.doc,.docx,audio/*,video/*"
                      onChange={(e) => setFiles(Array.from(e.target.files))}
                    />
                    <div className="mb-2 flex justify-center text-[#0099CC]">
                      <Icons.Upload />
                    </div>
                    <p className="m-0 text-sm font-medium text-[#5A6F8A]">
                      회의 파일, 오류 화면 캡처 등을 끌어다 놓거나 클릭하여 업로드
                    </p>
                    <p className="mt-1 text-xs text-[#5A6F8A]/70">PNG, JPG, PDF, DOC, MP3, MP4 지원</p>
                  </div>
                  {files.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {files.map((f, i) => <FileRow key={i} file={f} />)}
                    </div>
                  )}
                </div>

                <div className="mb-2 flex items-start gap-3 rounded-xl bg-[#EEF3FF] p-4">
                  <input
                    type="checkbox" id="privacy" name="privacy" checked={form.privacy} onChange={handleChange}
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[#0099CC]"
                  />
                  <label htmlFor="privacy" className="cursor-pointer text-sm leading-relaxed text-[#5A6F8A]">
                    <a href="#" className="font-semibold text-[#0099CC] underline underline-offset-2">
                      개인정보 처리방침
                    </a>
                    에 동의합니다. 수집된 정보는 문의 처리 목적으로만 사용되며 1년 후 파기됩니다.
                  </label>
                </div>
                <ErrMsg msg={errors.privacy} />

                <div className="mt-6 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="m-0 text-xs text-[#5A6F8A]/70">
                    <RequiredDot /> 는 필수 입력 항목입니다.
                  </p>
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#0099CC] px-7 py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.97] sm:w-auto"
                  >
                    <Icons.Send /> 문의 보내기
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      {!isMobile && <Footer />}
      {isMobile && <MobileTab active={activeTab} onChange={setActiveTab} />}
    </>
  );
}