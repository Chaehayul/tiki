import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import MobileTab from "../components/MobileTab";

const icons = {
  fileAudio: ["M17.5 22h.5a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3", "M14 2v4a2 2 0 0 0 2 2h4", "M9 17v-5", "M12 17v-3", "M15 17v-1"],
  cpu: ["M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0", "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"],
  uploadCloud: ["M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242", "M12 12v9", "M8 17l4-5 4 5"],
  folderOpen: ["M6 14l1.5-9 5.5 0 2 4 4 0 1.5 5z", "M2 14l1.5-9h15l1.5 9z"],
  music: ["M9 18V5l12-2v13", "M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
  x: ["M18 6L6 18", "M6 6l12 12"],
  alertTriangle: ["M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z", "M12 9v4", "M12 17h.01"],
  zap: ["M13 2L3 14h9l-1 8 10-12h-9l1-8z"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  box: ["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z", "M3.27 6.96L12 12.01l8.73-5.05", "M12 22.08V12"],
  checkCircle: ["M22 11.08V12a10 10 0 1 1-5.93-9.14", "M22 4L12 14.01l-3-3"],
  check: ["M20 6L9 17l-5-5"],
  lock: ["M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z", "M7 11V7a5 5 0 0 1 10 0v4"],
  clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"],
  mic: ["M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z", "M19 10v2a7 7 0 0 1-14 0v-2", "M12 19v4", "M8 23h8"],
  refreshCw: ["M23 4v6h-6", "M1 20v-6h6", "M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"],
  square: ["M3 3h18v18H3z"],
  loader: ["M12 2v4", "M12 18v4", "M4.93 4.93l2.83 2.83", "M16.24 16.24l2.83 2.83", "M2 12h4", "M18 12h4", "M4.93 19.07l2.83-2.83", "M16.24 7.76l2.83-2.83"],
  alertCircle: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 8v4", "M12 16h.01"],
  fileText: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M16 13H8", "M16 17H8", "M10 9H8"],
  home: ["M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 22V12h6v10"],
  barChart: ["M12 20V10", "M18 20V4", "M6 20v-4"],
  settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"],
  helpCircle: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", "M12 17h.01"],
  twitter: ["M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"],
  github: ["M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"],
  mail: ["M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z", "M22 6l-10 7L2 6"],
  shieldCheck: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", "M9 12l2 2 4-4"],
  globe: ["M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z", "M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
  arrowRight: ["M5 12h14", "M12 5l7 7-7 7"],
  chevronDown: ["M6 9l6 6 6-6"],
};

const cn = (...classes) => classes.filter(Boolean).join(" ");

function IIcon({ name, size = 16, color = "currentColor", sw = 2, style }) {
  const paths = icons[name];
  if (!paths) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="block shrink-0"
      style={style}
    >
      {paths.map((d, index) => (
        <path key={index} d={d} />
      ))}
    </svg>
  );
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function useAnimatedNumber(target, duration = 400) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef();
  const previousRef = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const from = previousRef.current;

    const step = (timestamp) => {
      const progress = Math.min((timestamp - start) / duration, 1);
      setDisplay(Math.round(from + (target - from) * progress));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
      else previousRef.current = target;
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return display;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return mobile;
}

const PROJECT_OVERRIDE_STORAGE_KEY = "tiki_project_overrides";

const ACTION_ITEM_TEMPLATES = [
  { text: "핵심 의사결정 사항 정리 및 공유", dueDays: 2 },
  { text: "후속 해야 할일 우선순위 확정", dueDays: 4 },
  { text: "Jira 연동 결과 검증", dueDays: 6 },
];

const readProjectOverrides = () => {
  try {
    const raw = localStorage.getItem(PROJECT_OVERRIDE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeProjectOverride = (projectId, projectData) => {
  if (!projectId) return;
  const next = readProjectOverrides();
  next[String(projectId)] = projectData;
  localStorage.setItem(PROJECT_OVERRIDE_STORAGE_KEY, JSON.stringify(next));
};

const getTodayYMD = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const createMeetingTitle = ({ projectName, preferredTitle }) => {
  const normalizedPreferred = String(preferredTitle || "").trim();
  if (normalizedPreferred) return normalizedPreferred;
  return `${projectName || "프로젝트"} 회의`;
};

const PROJECTS = [
  { id: 1, name: "AI 회의록 자동화" },
  { id: 2, name: "디자인 시스템 구축" },
  { id: 3, name: "사용자 인터뷰 분석" },
  { id: 4, name: "분기별 기획안" },
];

const STEPS = [
  { label: "파일 업로드 중...", pct: 25, duration: 1800, icon: "uploadCloud", sub: "서버로 파일을 전송하고 있습니다..." },
  { label: "화자 분리 처리 중...", pct: 55, duration: 2500, icon: "users", sub: "STT 변환 및 화자 diarization 진행 중..." },
  { label: "AI 요약 및 연동 항목 추출 중...", pct: 80, duration: 3000, icon: "box", sub: "LLM이 핵심 항목을 분석하고 있습니다..." },
  { label: "Jira 연동 완료!", pct: 100, duration: 1200, icon: "checkCircle", sub: "추출된 해야 할일을 Jira에 연동했습니다." },
];

const DOT_FRAMES = ["", ".", "..", "..."];

function AnimatedDots() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setFrame((value) => (value + 1) % DOT_FRAMES.length), 450);
    return () => clearInterval(timer);
  }, []);

  return <span aria-hidden="true">{DOT_FRAMES[frame]}</span>;
}

function StepConnector({ done }) {
  return (
    <div
      className={cn(
        "absolute left-[17px] top-[46px] bottom-0 z-0 w-[2px] transition-colors duration-300",
        done ? "bg-[linear-gradient(180deg,#0099CC,rgba(0,153,204,.15))]" : "bg-[rgba(0,100,180,.12)]",
      )}
    />
  );
}

function StepItem({ step, status, isLast }) {
  const badgeLabel = status === "done" ? "완료" : status === "active" ? "처리 중" : "대기";
  const badgeIcon = status === "done" ? "check" : status === "active" ? "loader" : null;
  const nodeIcon = status === "done" ? "check" : step.icon;
  const nodeColor = status === "waiting" ? "#5A6F8A" : "#0099CC";

  return (
    <div className="relative flex items-start gap-4 py-[14px]">
      {!isLast && <StepConnector done={status === "done"} />}
      <div
        className={cn(
          "z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
          status === "waiting" ? "border-[rgba(0,100,180,.12)] bg-white text-[#5A6F8A]" : "border-[#0099CC] bg-[rgba(0,153,204,.08)] text-[#0099CC]",
          status === "active" && "animate-nodeGlow",
        )}
      >
        <IIcon name={nodeIcon} size={16} color={nodeColor} />
      </div>
      <div className="flex-1 pt-1.5">
        <div className={cn("text-sm font-semibold transition-colors duration-300", status === "waiting" ? "text-[#5A6F8A]" : "text-[#0D1B2A]")}>
          {status === "done" ? step.label.replace("중...", "완료!") : status === "active" ? step.label : "대기 중"}
        </div>
        <div className={cn("mt-0.5 text-xs text-[#5A6F8A] transition-opacity duration-300", status !== "waiting" ? "opacity-100" : "opacity-0")}>
          {step.sub}
        </div>
      </div>
      <span
        className={cn(
          "mt-[7px] inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.5px]",
          status === "waiting"
            ? "bg-[rgba(0,0,0,.05)] text-[#5A6F8A]"
            : status === "active"
            ? "bg-[rgba(0,153,204,.1)] text-[#0099CC]"
            : "bg-[rgba(16,185,129,.1)] text-[#10B981]",
        )}
      >
        {badgeIcon && <IIcon name={badgeIcon} size={11} color="currentColor" />}
        {badgeLabel}
      </span>
    </div>
  );
}

export default function TikiApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const projectIdFromState = Number(location.state?.projectId);
  const preselectedProject = Number.isFinite(projectIdFromState)
    ? PROJECTS.find((project) => project.id === projectIdFromState)
      || {
        id: projectIdFromState,
        name: String(location.state?.projectName || `프로젝트 ${projectIdFromState}`),
      }
    : null;

  const [activeTab, setActiveTab] = useState("home");
  const [phase, setPhase] = useState("IDLE");
  const [files, setFiles] = useState([]);
  const [hover, setHover] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState("— KB/s");
  const [uploadRemain, setUploadRemain] = useState("잠시만 기다려주세요");
  const [stepIdx, setStepIdx] = useState(-1);
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [elapsedTime, setElapsedTime] = useState("—");
  const [error, setError] = useState({ title: "", msg: "", cancelStyle: false });
  const [dragFromIndex, setDragFromIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // 프로젝트 선택 상태
  const [selectedProject, setSelectedProject] = useState(preselectedProject);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  const uploadNum = useAnimatedNumber(Math.round(uploadPct));
  const progressNum = useAnimatedNumber(Math.round(progressPct));

  const fileInputRef = useRef(null);
  const analyzingRef = useRef(false);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const dropdownRef = useRef(null);
  const dragPreviewRef = useRef(null);

  const totalSize = files.reduce((sum, currentFile) => sum + currentFile.size, 0);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProjectDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (phase === "UPLOADING") {
      startTimeRef.current = performance.now();
    }
  }, [phase]);

  useEffect(() => () => {
    if (dragPreviewRef.current) {
      dragPreviewRef.current.remove();
      dragPreviewRef.current = null;
    }
  }, []);

  const clearDragPreview = () => {
    if (dragPreviewRef.current) {
      dragPreviewRef.current.remove();
      dragPreviewRef.current = null;
    }
  };

  const handleFiles = (selectedFiles) => {
    const allowed = ["mp3", "wav", "m4a", "aac", "ogg", "flac", "txt"];
    const acceptedFiles = [];
    let skippedCount = 0;
    let skippedMessage = "";

    Array.from(selectedFiles).forEach((selectedFile) => {
      const extension = selectedFile.name.split(".").pop().toLowerCase();
      if (!allowed.includes(extension)) {
        skippedCount += 1;
        skippedMessage ||= `허용되는 형식: MP3, WAV, M4A, AAC, OGG, FLAC, TXT (${extension.toUpperCase()})`;
        return;
      }
      if (selectedFile.size > 1024 * 1024 * 1024) {
        skippedCount += 1;
        skippedMessage ||= `선택한 파일: ${formatBytes(selectedFile.size)}`;
        return;
      }
      acceptedFiles.push(selectedFile);
    });

    if (acceptedFiles.length === 0) {
      setError({
        title: skippedCount > 0 ? "추가할 수 없는 파일입니다" : "파일을 찾을 수 없습니다",
        msg: skippedMessage || "지원되는 오디오 파일을 선택해 주세요.",
        cancelStyle: false,
      });
      return;
    }

    setFiles((currentFiles) => [...currentFiles, ...acceptedFiles]);
    setPhase("IDLE");
    setError(
      skippedCount > 0
        ? { title: `${skippedCount}개 파일은 건너뛰었습니다`, msg: skippedMessage, cancelStyle: false }
        : { title: "", msg: "", cancelStyle: false },
    );
  };

  const removeFile = (indexToRemove) => {
    setFiles((currentFiles) => currentFiles.filter((_, index) => index !== indexToRemove));
    setError({ title: "", msg: "", cancelStyle: false });
  };

  const reorderFiles = (fromIndex, toIndex) => {
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;
    setFiles((currentFiles) => {
      const reordered = [...currentFiles];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      return reordered;
    });
  };

  const handleFileDragOver = (event, overIndex) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    setDragOverIndex(overIndex);
  };

  const handleFileDragEnter = (overIndex) => {
    if (dragFromIndex === null || dragFromIndex === overIndex) return;

    // 드래그한 항목이 다른 행에 진입하는 즉시 재정렬
    setFiles((currentFiles) => {
      const reordered = [...currentFiles];
      const [moved] = reordered.splice(dragFromIndex, 1);
      reordered.splice(overIndex, 0, moved);
      return reordered;
    });

    setDragFromIndex(overIndex);
    setDragOverIndex(overIndex);
  };

  const clearFiles = () => {
    setFiles([]);
    setPhase("IDLE");
    setError({ title: "", msg: "", cancelStyle: false });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const persistUploadResultToProject = () => {
    if (!selectedProject?.id) return;

    const now = new Date();
    const meetingTitle = createMeetingTitle({
      projectName: selectedProject.name,
      preferredTitle: location.state?.meetingTitle,
    });
    const meetingId = `m-${Date.now()}`;
    const current = readProjectOverrides()[String(selectedProject.id)] || {};
    const existingMeetings = Array.isArray(current.meetings) ? current.meetings : [];
    const existingActionItems = Array.isArray(current.myActionItems) ? current.myActionItems : [];

    const meetingRecord = {
      id: meetingId,
      date: getTodayYMD(now),
      title: meetingTitle,
      status: "완료",
      type: "수시",
      tags: ["#업로드", "#AI분석"],
      participants: Array.isArray(current.participants) ? current.participants : [],
      summary: `${meetingTitle}에서 추출된 핵심 내용을 기반으로 해야 할일을 생성했습니다.`,
      actionItems: ACTION_ITEM_TEMPLATES.length,
      jiraLinked: ACTION_ITEM_TEMPLATES.length,
    };

    const generatedActionItems = ACTION_ITEM_TEMPLATES.map((template, index) => {
      const dueDate = getTodayYMD(addDays(now, template.dueDays));
      return {
        id: `ai-${Date.now()}-${index + 1}`,
        text: template.text,
        due: dueDate,
        assignee: current.teamLead || "담당자 미지정",
        status: "검증 전",
        source: meetingTitle,
        meeting: { id: meetingId, title: meetingTitle },
      };
    });

    writeProjectOverride(selectedProject.id, {
      ...current,
      id: selectedProject.id,
      name: selectedProject.name,
      meetings: [meetingRecord, ...existingMeetings],
      myActionItems: [...generatedActionItems, ...existingActionItems],
    });
  };

  const startUpload = () => {
    if (files.length === 0 || !selectedProject) return;
    analyzingRef.current = true;
    setPhase("UPLOADING");
    setUploadPct(0);
    setError({ title: "", msg: "", cancelStyle: false });

    let pct = 0;
    const speeds = ["128 KB/s", "256 KB/s", "512 KB/s", "1.2 MB/s"];
    const interval = setInterval(() => {
      pct = Math.min(pct + Math.random() * 12 + 4, 100);
      setUploadPct(pct);
      setUploadSpeed(speeds[Math.floor(pct / 25)] || speeds[speeds.length - 1]);
      const remaining = Math.max(0, Math.round((100 - pct) / 15));
      setUploadRemain(remaining > 0 ? `약 ${remaining}초 남음` : "마무리 중...");
      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(startProcessing, 400);
      }
    }, 180);
    timerRef.current = interval;
  };

  const startProcessing = () => {
    if (!analyzingRef.current) return;
    setPhase("PROCESSING");
    setStepIdx(-1);
    setProgressPct(0);
    setProgressLabel("AI 분석 준비 중...");
    runStep(0);
  };

  const finish = () => {
    setProgressPct(100);
    setProgressLabel("모든 처리 완료!");
    analyzingRef.current = false;
    persistUploadResultToProject();
    const elapsed = performance.now() - startTimeRef.current;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    setElapsedTime(minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`);
    setTimeout(() => setPhase("COMPLETED"), 600);
  };

  const runStep = (index) => {
    if (!analyzingRef.current) return;
    if (index >= STEPS.length) {
      finish();
      return;
    }
    setStepIdx(index);
    setProgressPct(STEPS[index].pct);
    setProgressLabel(STEPS[index].label);
    setTimeout(() => runStep(index + 1), STEPS[index].duration);
  };

  const cancel = () => {
    analyzingRef.current = false;
    clearInterval(timerRef.current);
    setPhase("FAILED");
    setError({ title: "분석이 취소됐습니다", msg: "파일을 다시 선택하거나 분석을 다시 시작하세요.", cancelStyle: true });
  };

  const resetAll = () => {
    analyzingRef.current = false;
    clearInterval(timerRef.current);
    setFiles([]);
    setPhase("IDLE");
    setUploadPct(0);
    setStepIdx(-1);
    setProgressPct(0);
    setProgressLabel("");
    setError({ title: "", msg: "", cancelStyle: false });
    setSelectedProject(null);
    setProjectDropdownOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const stateLabels = {
    IDLE: "대기 중",
    UPLOADING: "업로드 중",
    PROCESSING: "AI 분석 중",
    COMPLETED: "분석 완료",
    FAILED: "오류 발생",
  };

  const stepStatus = (index) => {
    if (stepIdx === -1) return "waiting";
    if (index < stepIdx) return "done";
    if (index === stepIdx) return "active";
    return "waiting";
  };

  const canAnalyze = files.length > 0 && !!selectedProject;
  const moveToMeetingResult = () => {
    const firstFile = files[0];
    const firstFileName = String(firstFile?.name || "");
    const ext = firstFileName.includes(".") ? firstFileName.split(".").pop().toLowerCase() : "";
    const audioExt = ["mp3", "wav", "m4a", "aac", "ogg", "flac", "webm"];
    const textExt = ["txt", "md", "doc", "docx", "pdf", "rtf", "hwp", "hwpx"];

    const uploadKind = audioExt.includes(ext) ? "audio" : textExt.includes(ext) ? "text" : "audio";

    navigate("/meeting-detail", {
      state: {
        uploadKind,
        fileName: firstFileName,
      },
    });
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F8FAFF] text-[#0D1B2A] [font-family:'Pretendard',-apple-system,sans-serif]">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(0,100,180,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,100,180,.05)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <Header isMobile={isMobile} phase={phase} stateLabels={stateLabels} />
      <div className={isMobile ? "h-[62px]" : "h-[76px]"} />

      <section className={cn("relative z-[1] text-center", isMobile ? "px-5 pb-6 pt-9" : "px-12 pb-12 pt-16")}>
        <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-[rgba(124,58,237,.3)] bg-[rgba(124,58,237,.08)] px-3 py-[5px] text-[11px] font-semibold uppercase tracking-[0.5px] text-[#7C3AED] sm:text-xs">
          <IIcon name="cpu" size={13} color="#7C3AED" />
          AI-Powered · STT + LLM + Jira 자동화
        </div>
        <h1 className={cn("mb-3.5 font-bold leading-[1.1] tracking-[-1.5px]", isMobile ? "text-[26px]" : "text-[clamp(28px,5vw,60px)]")}>
          회의 파일을 올리면<br />
          <em className="not-italic bg-[linear-gradient(90deg,#0099CC,#7C3AED)] bg-clip-text text-transparent">완성되는 자동 회의록</em>
        </h1>
        <p className={cn("mx-auto mb-8 max-w-[42rem] text-balance leading-[1.45] text-[#5A6F8A] sm:leading-8", isMobile ? "text-[14px]" : "text-[17px]")}>
          <span className="block">회의 파일을 업로드하면 화자 분리, AI 요약, Jira 연동까지</span>
          <span className="block">회의가 끝나는 순간 모든 게 정리됩니다.</span>
        </p>
      </section>

      <main className={cn("relative z-[1] mx-auto max-w-[720px]", isMobile ? "px-3 pb-[132px]" : "px-6 pb-20")}>

        {/* ── 프로젝트 선택 ── */}
        {phase !== "PROCESSING" && phase !== "COMPLETED" && (
          <div className="mb-4 rounded-[14px] border border-[rgba(0,100,180,.12)] bg-white px-5 py-4 shadow-[0_2px_12px_rgba(0,60,150,.05)]">
            <div className="mb-2.5 flex items-center gap-2">
              <IIcon name="box" size={14} color="#0099CC" />
              <span className="text-sm font-semibold text-[#0D1B2A]">프로젝트</span>
              <span className="ml-0.5 rounded-full bg-[rgba(239,68,68,.1)] px-2 py-0.5 text-[10px] font-bold text-[#DC2626]">
                필수
              </span>
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                className={cn(
                  "flex w-full items-center justify-between rounded-[10px] border px-4 py-3 text-sm transition-all duration-200",
                  selectedProject
                    ? "border-[#0099CC] bg-[rgba(0,153,204,.05)] text-[#0D1B2A]"
                    : "border-[rgba(0,100,180,.15)] bg-[rgba(0,60,150,.03)] text-[#5A6F8A] hover:border-[rgba(0,100,180,.3)] hover:bg-[rgba(0,60,150,.05)]",
                )}
                onClick={() => setProjectDropdownOpen((prev) => !prev)}
              >
                {selectedProject ? (
                  <span className="flex items-center gap-2.5">
                    <span className="font-medium text-[#0D1B2A]">{selectedProject.name}</span>
                  </span>
                ) : (
                  <span>프로젝트를 선택하세요</span>
                )}
                <IIcon
                  name="chevronDown"
                  size={16}
                  color={selectedProject ? "#0099CC" : "#5A6F8A"}
                  style={{ transform: projectDropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}
                />
              </button>

              {projectDropdownOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-[12px] border border-[rgba(0,100,180,.12)] bg-white shadow-[0_8px_32px_rgba(0,60,150,.12)]">
                  {PROJECTS.map((project) => {
                    const isSelected = selectedProject?.id === project.id;
                    return (
                      <button
                        key={project.id}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors",
                          isSelected
                            ? "bg-[rgba(0,153,204,.06)]"
                            : "hover:bg-[rgba(0,60,150,.04)]",
                        )}
                        onClick={() => {
                          setSelectedProject(project);
                          setProjectDropdownOpen(false);
                        }}
                      >
                        <span className={cn("flex-1 text-left", isSelected ? "font-semibold text-[#0D1B2A]" : "text-[#0D1B2A]")}>
                          {project.name}
                        </span>
                        {isSelected && <IIcon name="check" size={14} color="#0099CC" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 프로젝트 미선택 안내 */}
            {!selectedProject && (
              <p className="mt-2 text-[12px] text-[#5A6F8A]">
                Jira 연동할 프로젝트를 먼저 선택해야 분석을 시작할 수 있습니다.
              </p>
            )}
          </div>
        )}

        {/* ── 파일 드롭존 ── */}
        {phase !== "PROCESSING" && phase !== "COMPLETED" && (
          <div
            className={cn(
              "relative text-center transition-all duration-300",
              isMobile ? "rounded-[14px] px-4 py-7" : "rounded-[20px] px-10 py-14",
              hover ? "translate-y-[-2px] border-2 border-solid border-[#0099CC] bg-[#EEF3FF] shadow-[0_0_40px_rgba(0,153,204,.18),0_20px_60px_rgba(0,0,0,.08)]" : "border-2 border-dashed border-[rgba(0,100,180,.12)] bg-white shadow-[0_2px_16px_rgba(0,60,150,.06)]",
              phase === "UPLOADING" ? "pointer-events-none opacity-50" : "cursor-pointer",
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setHover(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setHover(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setHover(false);
              if (event.dataTransfer.files.length) handleFiles(event.dataTransfer.files);
            }}
            onClick={() => {
              if (phase === "IDLE") fileInputRef.current?.click();
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          >
            <div
              className={cn(
                "mx-auto mb-5 flex items-center justify-center border border-[rgba(0,100,180,.12)] bg-[linear-gradient(135deg,rgba(0,153,204,.08),rgba(124,58,237,.08))] transition-transform duration-300",
                isMobile ? "h-14 w-14 rounded-[14px]" : "h-[72px] w-[72px] rounded-[20px]",
                hover ? "scale-[1.08] rotate-[-3deg]" : "",
              )}
            >
              <IIcon name="uploadCloud" size={isMobile ? 28 : 36} color="#0099CC" sw={1.5} />
            </div>
            <div className={cn("mb-2 font-semibold tracking-[-0.3px]", isMobile ? "text-base" : "text-[20px]")}>회의 파일을 여기에 드래그하세요</div>
            <div className="mb-5 text-[14px] leading-[1.5] text-[#5A6F8A]">
              또는 <span className="font-semibold text-[#0099CC]">파일 선택</span>을 눌러 탐색하세요<br />최대 파일 크기: 1GB
            </div>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border-0 bg-[linear-gradient(135deg,#0099CC,#006FA3)] px-[22px] py-[10px] text-sm font-bold text-white"
              onClick={(event) => {
                event.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <IIcon name="folderOpen" size={15} color="#fff" />
              파일 선택
            </button>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {[".MP3", ".WAV", ".M4A", ".AAC", ".OGG", ".FLAC", ".TXT", ".HWP", ".DOCX", ".PDF"].map((format) => (
                <span
                  key={format}
                  className={cn(
                    "rounded border border-[rgba(0,60,150,.1)] bg-[rgba(0,60,150,.05)] px-[10px] py-[3px] font-semibold tracking-[0.5px] text-[#5A6F8A]",
                    isMobile ? "text-[11px]" : "text-xs",
                  )}
                >
                  {format}
                </span>
              ))}
            </div>
            <div className="mt-2.5 text-xs text-[#5A6F8A]">최대 업로드 용량 1GB</div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,.txt"
              className="hidden"
              onChange={(event) => {
                if (event.target.files.length) handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
        )}

        {/* ── 파일 목록 ── */}
        {files.length > 0 && (phase === "IDLE" || phase === "FAILED") && (
          <div className="mt-4 rounded-[14px] border border-[rgba(0,100,180,.12)] bg-white px-5 py-4 shadow-[0_2px_12px_rgba(0,60,150,.05)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{files.length}개 파일이 선택됐어요</div>
                <div className="mt-0.5 text-xs text-[#5A6F8A]">총 용량 {formatBytes(totalSize)}</div>
                <div className="mt-1 text-[11px] text-[#0099CC]">파일을 드래그해 순서를 바꾸면 위쪽부터 차례대로 분석됩니다.</div>
              </div>
              <button
                className="rounded-[7px] border border-[rgba(0,0,0,.08)] bg-[rgba(0,0,0,.03)] px-3 py-1.5 text-xs font-semibold text-[#5A6F8A]"
                onClick={clearFiles}
              >
                전체 삭제
              </button>
            </div>
            <div
              className="grid gap-3"
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragFromIndex(null);
                setDragOverIndex(null);
                clearDragPreview();
              }}
            >
              {files.map((selectedFile, index) => (
                <div
                  key={`${selectedFile.name}-${selectedFile.size}-${index}`}
                  draggable
                  onDragStart={(event) => {
                    const preview = event.currentTarget.cloneNode(true);
                    const { width } = event.currentTarget.getBoundingClientRect();
                    preview.style.width = `${Math.ceil(width)}px`;
                    preview.style.position = "fixed";
                    preview.style.top = "-9999px";
                    preview.style.left = "-9999px";
                    preview.style.margin = "0";
                    preview.style.opacity = "1";
                    preview.style.pointerEvents = "none";
                    preview.style.zIndex = "9999";
                    preview.style.transform = "none";
                    preview.style.boxShadow = "0 12px 28px rgba(0, 60, 150, 0.24)";
                    document.body.appendChild(preview);
                    dragPreviewRef.current = preview;

                    setDragFromIndex(index);
                    setDragOverIndex(index);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(index));
                    event.dataTransfer.setDragImage(preview, 28, 20);
                  }}
                  onDragEnter={() => handleFileDragEnter(index)}
                  onDragOver={(event) => handleFileDragOver(event, index)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragFromIndex(null);
                    setDragOverIndex(null);
                    clearDragPreview();
                  }}
                  onDragEnd={() => {
                    setDragFromIndex(null);
                    setDragOverIndex(null);
                    clearDragPreview();
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-[12px] border border-[rgba(0,100,180,.08)] bg-[rgba(0,60,150,.03)] px-3 py-3 cursor-grab active:cursor-grabbing transition-all duration-150",
                    dragFromIndex === index && "scale-[1.01] opacity-100 shadow-[0_8px_24px_rgba(0,60,150,.18)] ring-2 ring-[rgba(0,153,204,.25)]",
                    dragOverIndex === index && dragFromIndex !== index && "border-[#0099CC] bg-[#EEF3FF]"
                  )}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(0,100,180,.12)] bg-[linear-gradient(135deg,rgba(0,153,204,.08),rgba(124,58,237,.08))]">
                    <IIcon name="music" size={20} color="#0099CC" sw={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{selectedFile.name}</div>
                    <div className="mt-0.5 text-xs text-[#5A6F8A]">{formatBytes(selectedFile.size)}</div>
                  </div>
                  <button className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-[rgba(239,68,68,.2)] bg-[rgba(239,68,68,.08)]" onClick={() => removeFile(index)}>
                    <IIcon name="x" size={14} color="#EF4444" sw={2.5} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 업로드 진행 ── */}
        {phase === "UPLOADING" && (
          <div className="mt-4 rounded-[14px] border border-[rgba(245,158,11,.25)] bg-white px-6 py-5">
            <div className="mb-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-[#B45309]">
                <IIcon name="uploadCloud" size={16} color="#B45309" />
                {files.length > 1 ? `${files.length}개 파일 전송 중...` : "서버로 전송 중..."}
              </div>
              <div className="text-[22px] font-bold text-[#B45309]">{uploadNum}%</div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[rgba(245,158,11,.12)]">
              <div className="relative h-full overflow-hidden rounded-full bg-[linear-gradient(90deg,#F59E0B,#D97706)] transition-[width] duration-300" style={{ width: `${uploadPct}%` }}>
                <div className="absolute inset-0 animate-uploadShine bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent)]" />
              </div>
            </div>
            <div className="mt-2 flex justify-between text-xs text-[#5A6F8A]">
              <span>{uploadSpeed}</span>
              <span>{uploadRemain}</span>
            </div>
          </div>
        )}

        {/* ── 에러 메시지 ── */}
        {error.title && (
          <div
            className={cn(
              "mt-4 flex items-start gap-3 rounded-xl border px-5 py-4",
              error.cancelStyle ? "border-[rgba(245,158,11,.25)] bg-[rgba(245,158,11,.06)]" : "border-[rgba(239,68,68,.2)] bg-[rgba(239,68,68,.06)]",
            )}
          >
            <IIcon name="alertTriangle" size={18} color={error.cancelStyle ? "#D97706" : "#EF4444"} />
            <div className="flex-1">
              <div className={cn("mb-0.5 text-sm font-bold", error.cancelStyle ? "text-[#D97706]" : "text-[#DC2626]")}>{error.title}</div>
              <div className="text-[13px] leading-[1.4] text-[#5A6F8A]">{error.msg}</div>
            </div>
            <button
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-[7px] border px-[14px] py-1.5 text-[13px] font-semibold",
                error.cancelStyle ? "border-[rgba(245,158,11,.3)] bg-[rgba(245,158,11,.08)] text-[#D97706]" : "border-[rgba(239,68,68,.25)] bg-[rgba(239,68,68,.1)] text-[#DC2626]",
              )}
              onClick={() => {
                setError({ title: "", msg: "", cancelStyle: false });
                if (selectedProject) startUpload();
              }}
            >
              <IIcon name="refreshCw" size={13} color="currentColor" />
              재시도
            </button>
          </div>
        )}

        {/* ── AI 분석 시작 버튼 ── */}
        {files.length > 0 && phase === "IDLE" && (
          <div className="mt-4">
            {/* 프로젝트 미선택 시 안내 배너 */}
            {!selectedProject && (
              <div className="mb-2 flex items-center gap-2 rounded-[10px] border border-[rgba(245,158,11,.25)] bg-[rgba(245,158,11,.06)] px-4 py-2.5">
                <IIcon name="alertTriangle" size={14} color="#D97706" />
                <span className="text-[13px] text-[#D97706]">
                  위에서 Jira 프로젝트를 선택해야 분석을 시작할 수 있습니다.
                </span>
              </div>
            )}
            <button
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl border-0 px-4 py-4 text-base font-bold text-white transition-all duration-200",
                canAnalyze
                  ? "bg-[linear-gradient(135deg,#0099CC_0%,#7C3AED_100%)] shadow-[0_4px_24px_rgba(0,153,204,.2)] hover:shadow-[0_6px_28px_rgba(0,153,204,.3)] hover:translate-y-[-1px] cursor-pointer"
                  : "bg-[#C5CDD9] cursor-not-allowed shadow-none",
              )}
              onClick={canAnalyze ? startUpload : undefined}
              disabled={!canAnalyze}
            >
              <IIcon name="zap" size={18} color="#fff" />
              {!selectedProject
                ? "프로젝트를 먼저 선택해주세요"
                : files.length > 1
                ? `${files.length}개 파일 · ${selectedProject.name} 분석 시작`
                : `${selectedProject.name} 분석 시작`}
            </button>
          </div>
        )}

        {/* ── 처리 중 ── */}
        {phase === "PROCESSING" && (
          <div className="mt-4 rounded-[20px] border border-[rgba(0,100,180,.12)] bg-white px-4 py-5 shadow-[0_2px_16px_rgba(0,60,150,.06)] sm:px-8 sm:py-8">
            <div className={cn("mb-2 flex items-start justify-between gap-2.5", isMobile ? "flex-wrap" : "flex-nowrap")}>
              <div className="flex flex-col gap-2.5">
                {selectedProject && (
                  <div className="inline-flex items-center gap-1.5">
                    <span className="text-[12px] text-[#5A6F8A]">{selectedProject.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <div className="flex items-end gap-[1px] shrink-0">
                    {["T", "I", "K", "I"].map((ch, index) => (
                      <span
                        key={ch}
                        className="inline-block text-[20px] font-bold leading-none tracking-[-0.5px] text-[#0099CC] animate-tikiBounce drop-shadow-[0_1px_0_rgba(255,255,255,.45)]"
                        style={{ animationDelay: `${index * 0.15}s` }}
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                  <div className="whitespace-nowrap text-[13px] font-medium text-[#5A6F8A]">
                    가 분석 중<AnimatedDots />
                  </div>
                </div>
              </div>
              <button className="inline-flex items-center gap-1.5 rounded-[7px] border border-[rgba(0,0,0,.1)] bg-[rgba(0,0,0,.04)] px-[14px] py-1.5 text-xs font-semibold text-[#5A6F8A]" onClick={cancel}>
                <IIcon name="square" size={11} color="currentColor" />
                분석 취소
              </button>
            </div>

            <div className="mb-7">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[13px] text-[#5A6F8A]">{progressLabel}</span>
                <span className="text-[24px] font-bold tracking-[-1px] text-[#0099CC]">{progressNum}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(0,60,150,.08)]">
                <div className="relative h-full rounded-full bg-[linear-gradient(90deg,#0099CC,#7C3AED)] transition-[width] duration-300" style={{ width: `${progressPct}%` }}>
                  <div className="absolute right-0 top-[-2px] h-2.5 w-2.5 rounded-full bg-[#0099CC] shadow-[0_0_8px_#0099CC]" />
                </div>
              </div>
            </div>

            <div className="flex flex-col">
              {STEPS.map((step, index) => (
                <StepItem key={index} step={step} status={stepStatus(index)} isLast={index === STEPS.length - 1} />
              ))}
            </div>
          </div>
        )}

        {/* ── 완료 ── */}
        {phase === "COMPLETED" && (
          <div className="mt-4 rounded-[20px] border border-[rgba(16,185,129,.2)] bg-white px-4 py-7 text-center shadow-[0_2px_16px_rgba(0,60,150,.06)] sm:px-10 sm:py-10">
            <div className="mx-auto mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[rgba(16,185,129,.2)] bg-[rgba(16,185,129,.1)] animate-successBounce">
              <IIcon name="checkCircle" size={36} color="#10B981" sw={1.8} />
            </div>
            <div className="mb-2 text-[22px] font-bold tracking-[-0.3px]">분석이 완료됐습니다!</div>
            <div className="mb-1 text-sm text-[#5A6F8A]">회의록이 생성되고 Jira 연동이 자동으로 완료됐습니다.</div>

            <div className="mb-6 inline-flex flex-wrap justify-center gap-4 rounded-[10px] border border-[rgba(16,185,129,.15)] bg-[rgba(16,185,129,.06)] px-5 py-[10px]">
              {[
                { icon: "clock", text: "처리 시간", val: elapsedTime },
                { icon: "mic", text: "화자", val: "3명 감지" },
                { icon: "checkCircle", text: "Jira 연동", val: "3건 완료" },
              ].map(({ icon, text, val }) => (
                <div key={text} className="inline-flex items-center gap-1 text-[13px] text-[#5A6F8A]">
                  <IIcon name={icon} size={13} color="#10B981" />
                  {text} <strong className="font-bold text-[#10B981]">{val}</strong>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-2.5">
              <button
                className="inline-flex items-center gap-1.5 rounded-[9px] border-0 bg-[linear-gradient(135deg,#10B981,#0D9488)] px-[22px] py-[11px] text-sm font-bold text-white"
                onClick={moveToMeetingResult}
              >
                <IIcon name="fileText" size={15} color="#fff" />
                회의록 보기
              </button>
              <button className="inline-flex items-center gap-1.5 rounded-[9px] border border-[rgba(0,0,0,.1)] bg-[rgba(0,0,0,.04)] px-[22px] py-[11px] text-sm font-semibold text-[#5A6F8A]" onClick={resetAll}>
                <IIcon name="uploadCloud" size={15} color="currentColor" />
                새 파일 업로드
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { icon: "lock", text: "종단간 암호화 처리" },
            { icon: "clock", text: "평균 처리 시간 2~5분" },
            { icon: "mic", text: "최대 8명 화자 분리 지원" },
          ].map(({ icon, text }) => (
            <div
              key={text}
              className={cn(
                "flex items-center gap-1.5 rounded-[6px] border border-[rgba(0,60,150,.08)] bg-[rgba(0,60,150,.04)] px-3 py-1.5 text-[#5A6F8A]",
                isMobile ? "text-[11px]" : "text-xs",
              )}
            >
              <IIcon name={icon} size={13} color="#0099CC" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </main>

      {!isMobile && <Footer />}
      {isMobile && <MobileTab active={activeTab} onChange={setActiveTab} />}
    </div>
  );
}
