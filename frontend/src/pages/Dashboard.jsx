import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { clearAuthSession } from "../api/apiClient";
import Header from "../components/Header";
import Footer from "../components/Footer";
import MobileTab from "../components/MobileTab";

// 가상의 팀원 목록 (스타트업 '네오테크' 시나리오 반영)
const TEAM_MEMBERS = [
  { name: "정아름", role: "프론트엔드 리드", avatar: "user" },
  { name: "김민수", role: "백엔드 리드", avatar: "user" },
  { name: "송지영", role: "PM & 아키텍트", avatar: "user" },
  { name: "김소현", role: "서비스 기획", avatar: "user" },
  { name: "채하율", role: "데이터 엔지니어", avatar: "user" },
  { name: "박디자이너", role: "UI/UX 디자이너", avatar: "user" }
];

// 가상의 회의록 타임라인 텍스트 및 오디오 앵커 링크 정보
const TRANSCRIPT_MOCK = [
  { time: "01:15", speaker: "김소현", text: "이번 스프린트에서는 TIKI 브랜드 전용 컬러 팔레트를 프론트엔드에 완전히 정착시켜야 해요. 특히 메인 테두리는 투명도가 들어간 rgba(0,100,180,0.12) 스펙을 준수해 주세요." },
  { time: "03:12", speaker: "정아름", text: "네, 알겠습니다. TIKI 컬러 팔레트 프론트엔드 환경에 CSS 변수 정의 및 테마 반영 작업은 제가 맡을게요. 다음 주 화요일까지 완성해서 올리겠습니다." },
  { time: "07:45", speaker: "송지영", text: "좋습니다. 백엔드 세션 처리도 이슈가 있어요. 로그인 만료 세션 예외 처리 및 토큰 리프레시 로직 보완은 김민수님이 작업하시는 게 맞겠죠?" },
  { time: "11:45", speaker: "김민수", text: "네, 그 부분은 제가 API 규격에 맞춰 세션 리프레시 토큰 흐름을 재설계하고 Jira 티켓 연동까지 끝내 놓겠습니다." },
  { time: "21:10", speaker: "채하율", text: "대시보드 UI MVP 디자인 최종 시안을 어제 전달받았는데, Figma에 새로 반영된 기획안 컴포넌트들을 업로드해 주실 분이 필요해요." },
  { time: "24:02", speaker: "박디자이너", text: "그건 디자인팀에서 마이그레이션이 끝나는 대로 피그마에 최종 업로드하고 슬랙으로 개발팀 전체에 알리겠습니다." }
];

// AI가 분석한 액션 아이템 초기 데이터 (기획서에 언급된 티켓 규격 반영)
const INITIAL_ACTION_ITEMS = [
  {
    id: 1,
    title: "[TIKI 서비스] 컬러 팔레트 프론트엔드 환경에 CSS 변수 정의 및 테마 반영 작업",
    priority: "보통",
    assignee: "정아름",
    avatar: "user",
    status: "검증 전", // 검증 전, 연동 완료, 수정됨
    dueDate: "2026-06-23",
    description: "회의록 03분 12초 영역 기인. 메인 배경(#F8FAFF), 서피스(#FFFFFF), 주요 액션(#0099CC) 및 테두리 변수를 Tailwind 설정 혹은 전역 CSS에 반영하여 디자인 컴포넌트 전체의 일관성을 확보할 것.",
    contextTime: "03:12",
    aiOriginalTitle: "[TIKI] 컬러팔레트 구현하기",
    aiOriginalAssignee: "정아름",
    aiOriginalDueDate: "2026-06-18",
    jiraLink: ""
  },
  {
    id: 2,
    title: "로그인 만료 세션 예외 처리 및 토큰 리프레시 로직 보완",
    priority: "낮음",
    assignee: "김소현",
    avatar: "user",
    status: "연동 완료",
    dueDate: "2026-06-30",
    description: "회의록 11분 45초 영역 기인. 사용자가 장시간 자리를 비우거나 브라우저를 종료했을 때 세션 만료가 뜨지 않는 버그 방지. Redis 연동 세션 스펙을 검토하고 자동 갱신 API 연동 수행.",
    contextTime: "11:45",
    aiOriginalTitle: "로그인 세션 에러 고치기",
    aiOriginalAssignee: "김소현",
    aiOriginalDueDate: "2026-06-25",
    jiraLink: "https://jira.atlassian.com/browse/TIKI-102"
  },
  {
    id: 3,
    title: "대시보드 UI MVP 디자인 최종 시안 Figma 업로드 및 검토 요청",
    priority: "낮음",
    assignee: "채하율",
    avatar: "user",
    status: "연동 완료",
    dueDate: "2026-06-16",
    description: "회의록 24분 02초 영역 기인. 시제품 자재 및 컴포넌트 단위 디자인 가이드 Figma 업로드 완료 후 Jira 연계 에픽 생성.",
    contextTime: "24:02",
    aiOriginalTitle: "피그마 올리기",
    aiOriginalAssignee: "채하율",
    aiOriginalDueDate: "2026-06-16",
    jiraLink: "https://jira.atlassian.com/browse/TIKI-104"
  }
];

// Lucide 아이콘 모사 컴포넌트 (종속성 에러 방지를 위해 인라인 SVG로 엄밀한 설계)
function LucideIcon({ name, size = 16, className = "" }) {
  const icons = {
    user: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
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
    alertCircle: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
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
    link: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
    logOut: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    ),
    shield: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    lock: (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    )
  };

  return icons[name] || null;
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
  const [selectedItem, setSelectedItem] = useState(null); // 모달 상세 보기 아이템
  const [isDiffMode, setIsDiffMode] = useState(true); // Diff View 스위치

  // 대화록 타임라인 하이라이트용 상태 (Context Link 클릭 시 시각적 반응 극대화)
  const [highlightedTime, setHighlightedTime] = useState("");
  const timelineRef = useRef(null);

  // 업로드 시뮬레이션 관련 상태
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPhase, setUploadPhase] = useState("IDLE"); // IDLE, UPLOADING, PROCESSING, COMPLETED
  const [uploadProgress, setUploadProgress] = useState(0);

  // 모달 입력 제어
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    assignee: ""
  });

  // 토스트 메시지 상태
  const [toast, setToast] = useState({ show: false, message: "" });

  const triggerToast = (msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };

  // 로그인 모드 진입
  const handleLogin = (e) => {
    e.preventDefault();
    const demoUser = { name: "TIKI Demo", email: loginForm.email };
    localStorage.setItem("tiki_access_token", "demo-dashboard-token");
    localStorage.setItem("tiki_user", JSON.stringify(demoUser));
    setUser(demoUser);
    setIsAuthenticated(true);
    setShowLoginModal(false);
    triggerToast("🔓 네오테크 가상 B2B 도메인으로 로그인되었습니다.");
  };

  const handleLogout = () => {
    clearAuthSession();
    setUser(null);
    setIsAuthenticated(false);
    triggerToast("로그아웃 되었습니다. 랜딩 페이지로 이동합니다.");
  };

  // 컨텍스트 링크 클릭시 타임라인 스크롤 & 애니메이션 효과 (움직임 효과는 배제함)
  const scrollToContext = (timeStr) => {
    // 03:12 포맷 또는 03분 12초 포맷에 유연하게 대응
    const normalizedTime = timeStr.includes("분") ? timeStr.replace("분 ", ":").replace("초", "") : timeStr;
    const targetElementId = `transcript-${normalizedTime}`;

    setHighlightedTime(normalizedTime);
    triggerToast(`⏱️ 회의록 원본 인용 링크 [${normalizedTime}] 대화 구간을 활성화합니다.`);
    
    const element = document.getElementById(targetElementId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // 티켓 상세 편집창 진입 시 폼 세팅
  const openEditModal = (item) => {
    setSelectedItem(item);
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
        return {
          ...item,
          ...editForm,
          status: "수정됨"
        };
      }
      return item;
    }));
    setSelectedItem(null);
    triggerToast("✍️ 액션 아이템이 성공적으로 수정(사용자 변경)되었습니다.");
  };

  // B. 승인 (Approve) 기능
  const handleApprove = (itemId) => {
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
    setSelectedItem(null);
    triggerToast("🚀 Jira API를 호출하여 티켓 생성이 승인 완료되었습니다!");
  };

  // C. 삭제 (Delete) 기능
  const handleDelete = (itemId, excludeFromAi) => {
    if (window.confirm("정말로 이 액션 아이템을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) {
      setActionItems(prev => prev.filter(item => item.id !== itemId));
      setSelectedItem(null);
      if (excludeFromAi) {
        triggerToast("🗑️ 삭제 완료! 해당 데이터는 할루시네이션 개선을 위한 AI 피드백 모델에서 영구 제외됩니다.");
      } else {
        triggerToast("🗑️ 액션 아이템이 삭제되었습니다.");
      }
    }
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
        // 새로운 가상 Action Item 추가 시뮬레이션
        const newAction = {
          id: Date.now(),
          title: `[보안 마스킹 가동] 신규 업로드된 ${uploadFile?.name || "회의록"} 기반 자동 태스크`,
          priority: "높음",
          assignee: "정아름",
          avatar: "user",
          status: "검증 전",
          dueDate: "2026-06-25",
          description: "새로 업로드한 오디오에서 RAG를 기반으로 도메인 전문 용어(Figma, Celery, React)를 식별 및 마스킹한 뒤 추출해 낸 태스크입니다.",
          contextTime: "01:15",
          aiOriginalTitle: "[새파일] 회의록 신규 태스크",
          aiOriginalAssignee: "정아름",
          aiOriginalDueDate: "2026-06-20",
          jiraLink: ""
        };
        setActionItems(prev => [newAction, ...prev]);
        setUploadPhase("COMPLETED");
        triggerToast("✅ AI 분석 및 액션 아이템 추출이 완료되어 목록에 추가되었습니다!");
      }, 2500);
    }
    return () => {
      clearInterval(interval);
      clearTimeout(interval);
    };
  }, [uploadPhase, uploadFile?.name]);

  const resetUpload = () => {
    setUploadFile(null);
    setUploadPhase("IDLE");
    setUploadProgress(0);
  };

  const uploadStateLabels = {
    IDLE: "대기 중",
    UPLOADING: "업로드 중",
    PROCESSING: "AI 분석 중",
    COMPLETED: "분석 완료",
    FAILED: "오류 발생"
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFF] text-[#0D1B2A] font-sans antialiased pt-20 pb-20 md:pb-0">
      <Header
        isMobile={isMobile}
        isLoggedIn={isAuthenticated}
        user={user}
        onLogout={handleLogout}
        phase={uploadPhase}
        stateLabels={uploadStateLabels}
      />

      {/* 🔹 1단계: 랜딩 페이지 (비인증 상태) */}
      {!isAuthenticated && (
        <div className="flex-1 flex flex-col">
          {/* Hero Section */}
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

              {/* 가상 대시보드 엿보기 일러스트 (움직임 효과 제거 완료) */}
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                  {INITIAL_ACTION_ITEMS.slice(0, 3).map((item) => (
                    <div key={item.id} className="border border-[rgba(0,100,180,0.12)] rounded-xl p-4 bg-[#F8FAFF]">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F59E0B]/20 text-[#0D1B2A] font-bold">{item.status}</span>
                        <span className="text-xs text-[#EF4444] font-bold">우선순위: {item.priority}</span>
                      </div>
                      <h4 className="text-sm font-bold text-[#0D1B2A] line-clamp-1">{item.title}</h4>
                      <p className="text-xs text-[#5A6F8A] mt-2 line-clamp-2">{item.description}</p>
                      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-[#5A6F8A]">
                        <span className="flex items-center gap-1">
                          <LucideIcon name="user" size={10} />
                          {item.assignee}
                        </span>
                        <span className="text-[#0099CC] flex items-center gap-1">
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

          {/* How It Works Section */}
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
                {/* 1단계 */}
                <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-[#F8FAFF] border border-[rgba(0,100,180,0.08)]">
                  <div className="w-16 h-16 rounded-2xl bg-[#EEF3FF] text-[#0099CC] flex items-center justify-center text-xl font-extrabold mb-6 shadow-sm">
                    01
                  </div>
                  <h3 className="text-lg font-bold text-[#0D1B2A] mb-3">회의록 사후 업로드</h3>
                  <p className="text-sm text-[#5A6F8A] leading-relaxed">
                    실시간 스트리밍의 불안정성을 배제하고, 회의 완료 후 녹음 파일(.mp3, .wav)을 업로드하여 100% 온전한 원본 분석을 시작합니다.
                  </p>
                </div>

                {/* 2단계 */}
                <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-[#F8FAFF] border border-[rgba(0,100,180,0.08)]">
                  <div className="w-16 h-16 rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center text-xl font-extrabold mb-6 shadow-sm">
                    02
                  </div>
                  <h3 className="text-lg font-bold text-[#0D1B2A] mb-3">LLM 문맥 및 보안 필터링</h3>
                  <p className="text-sm text-[#5A6F8A] leading-relaxed">
                    Whisper 엔진과 결합하여 화자를 정확히 분리하고, 사내 민감 정보나 기밀 고객 데이터는 AI 보안 마스킹 시스템을 통해 걸러냅니다.
                  </p>
                </div>

                {/* 3단계 */}
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

      {/* 🔹 2단계: 메인 협업 대시보드 (인증 상태) */}
      {isAuthenticated && (
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
          
          {/* 대시보드 메인 인트로 및 요약 */}
          <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white border border-[rgba(0,100,180,0.12)] rounded-2xl shadow-sm">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
                <span className="text-xs font-bold text-[#10B981] uppercase tracking-wide">네오테크 클라우드 프라이빗 도메인 활성화됨</span>
              </div>
              <h2 className="text-2xl font-bold text-[#0D1B2A]">
                회의록 분석 및 워크플로우 제어 대시보드
              </h2>
              <p className="text-sm text-[#5A6F8A] mt-1">
                AI가 추출한 Action Item입니다. 상세 내용 검증 후 Jira 보드로 승인/전송하세요.
              </p>
            </div>
            
            {/* 사후 업로드 간이 트리거 */}
            <div className="shrink-0 flex items-center gap-3">
              {uploadPhase === "IDLE" ? (
                <label className="px-4 py-2.5 bg-gradient-to-r from-[#0099CC] to-[#7C3AED] text-white text-sm font-bold rounded-xl shadow-md cursor-pointer transition-colors">
                  📁 새 회의 오디오 파일 업로드
                  <input
                    type="file"
                    accept=".mp3,.wav,.m4a"
                    className="hidden"
                    onChange={handleFileUploadSimulate}
                  />
                </label>
              ) : (
                <div className="flex items-center gap-3 bg-[#EEF3FF] border border-[#0099CC]/30 px-4 py-2 rounded-xl">
                  {uploadPhase === "UPLOADING" && (
                    <div className="flex items-center gap-2 text-xs font-bold text-[#0099CC]">
                      <svg className="animate-spin h-4 w-4 text-[#0099CC]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      업로드 중 ({uploadProgress}%)
                    </div>
                  )}
                  {uploadPhase === "PROCESSING" && (
                    <div className="flex items-center gap-2 text-xs font-bold text-[#7C3AED]">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7C3AED]"></span>
                      </span>
                      AI 요약 및 마스킹 중...
                    </div>
                  )}
                  {uploadPhase === "COMPLETED" && (
                    <button onClick={resetUpload} className="text-xs font-bold text-[#10B981] hover:underline">
                      성공! 목록 새로고침 (클릭하여 닫기)
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* 2단 메인 레이아웃 (좌측: 회의 대화록 원본 인용 / 우측: 티켓 카드 그리드 목록) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* 좌측: 회의 대화록 원본 인용 패널 */}
            <div className="lg:col-span-4 bg-white border border-[rgba(0,100,180,0.12)] rounded-2xl shadow-sm p-5 h-[580px] flex flex-col">
              <div className="border-b border-gray-100 pb-4 mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#0D1B2A] flex items-center gap-2">
                    <LucideIcon name="sparkles" size={16} className="text-[#0099CC]" />
                    회의 대화록 원본 인용 (Context)
                  </h3>
                  <span className="text-[11px] px-2 py-0.5 bg-[#EEF3FF] text-[#0099CC] rounded-full font-semibold">
                    화자 식별 완료
                  </span>
                </div>
                <p className="text-xs text-[#5A6F8A] mt-1">
                  티켓의 타임스탬프를 클릭하면 해당 대화 시점 위치로 스크롤과 강조 효과가 제공됩니다.
                </p>
              </div>

              {/* 스크롤 가능한 스크립트 영역 */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none" ref={timelineRef}>
                {TRANSCRIPT_MOCK.map((item) => {
                  const isHighlighted = highlightedTime === item.time;
                  return (
                    <div
                      key={item.time}
                      id={`transcript-${item.time}`}
                      // 움직임 유발 CSS 제거 (scale, translate 제거하여 단순 색상 반전만 사용)
                      className={`p-3 rounded-xl border transition-colors duration-300 ${
                        isHighlighted
                          ? "bg-[#EEF3FF] border-[#0099CC] shadow-sm"
                          : "bg-white border-transparent hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#0D1B2A] flex items-center gap-1">
                          <LucideIcon name="user" size={12} className="text-[#5A6F8A]" />
                          {item.speaker}
                        </span>
                        <button
                          onClick={() => setHighlightedTime(item.time)}
                          className="text-[11px] font-mono text-[#0099CC] hover:underline flex items-center gap-1"
                        >
                          <LucideIcon name="clock" size={10} />
                          {item.time}
                        </button>
                      </div>
                      <p className="text-xs text-[#5A6F8A] leading-relaxed">
                        {item.text}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-[#5A6F8A] text-center bg-gray-50 rounded-lg p-2 flex items-center justify-center gap-1.5">
                <LucideIcon name="lock" size={12} className="text-[#10B981]" />
                사내 민감 정보 가명처리 완료 및 데이터 휘발성 정책 작동 중
              </div>
            </div>

            {/* 우측: 카드 리스트 (요약 뷰) 필수 항목 */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* 리스트 필터 및 카운터 */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#5A6F8A]">
                  AI가 감지한 미결 Action Item <span className="text-[#0099CC]">{actionItems.length}</span>건
                </span>
                <span className="text-xs text-[#5A6F8A]">Jira 클라우드 상호연동 활성 상태</span>
              </div>

              {/* 카드 그리드 (움직이는 Hover 모션 완전 차단) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {actionItems.map((item) => {
                  // 우선순위 뱃지 테마 매핑
                  const priorityStyles = {
                    "높음": "border-[#EF4444] text-[#EF4444] bg-red-50",
                    "보통": "border-[#0099CC] text-[#0099CC] bg-cyan-50",
                    "낮음": "border-[#5A6F8A] text-[#5A6F8A] bg-gray-50"
                  };

                  // 상태 뱃지 매핑
                  const statusStyles = {
                    "검증 전": "bg-[#F59E0B] text-white",
                    "연동 완료": "bg-[#10B981] text-white",
                    "수정됨": "bg-[#7C3AED] text-white"
                  };

                  return (
                    <div
                      key={item.id}
                      onClick={() => openEditModal(item)}
                      // hover:-translate, hover:scale 등을 완전히 제거하여 레이아웃 흔들림이 없도록 고정
                      className="group relative flex flex-col justify-between p-5 bg-white border border-[rgba(0,100,180,0.12)] hover:border-[#0099CC]/40 hover:bg-[#EEF3FF]/30 rounded-2xl shadow-sm transition-colors duration-200 cursor-pointer"
                    >
                      {/* 카드 헤더 (우선순위 & 상태 뱃지) */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full ${statusStyles[item.status] || "bg-gray-400"}`}>
                          {item.status}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-lg border ${priorityStyles[item.priority]}`}>
                          우선순위: {item.priority}
                        </span>
                      </div>

                      {/* 티켓 제목 */}
                      <h4 className="text-base font-bold text-[#0D1B2A] line-clamp-2 leading-snug group-hover:text-[#0099CC] transition-colors">
                        {item.title}
                      </h4>

                      {/* 본문 약식 요약 */}
                      <p className="text-xs text-[#5A6F8A] line-clamp-2 mt-2 leading-relaxed">
                        {item.description}
                      </p>

                      {/* 하단 메타 정보 (담당자 프로필 & 컨텍스트 링크) */}
                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-[#5A6F8A]">
                        <div className="flex items-center gap-1.5 font-semibold text-[#0D1B2A]">
                          <LucideIcon name="user" size={14} className="text-[#5A6F8A]" />
                          <span>{item.assignee}</span>
                        </div>
                        
                        {/* 회의록 원본 인용 (Context Link) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // 모달 오픈 방지
                            scrollToContext(item.contextTime);
                          }}
                          className="flex items-center gap-1 text-[#0099CC] hover:underline font-bold"
                        >
                          <LucideIcon name="clock" size={12} />
                          ⏱️ {item.contextTime} 인용
                        </button>
                      </div>

                      {/* Jira 연동 상태일 경우 즉시 링크 표시 */}
                      {item.status === "연동 완료" && item.jiraLink && (
                        <div className="absolute top-2 right-2 flex items-center">
                          <a
                            href={item.jiraLink}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()} // 카드 클릭 방지
                            className="bg-[#10B981] hover:bg-[#0d9488] text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1 transition-colors"
                          >
                            Jira 확인 <LucideIcon name="link" size={10} />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}

                {actionItems.length === 0 && (
                  <div className="col-span-2 text-center py-16 bg-white border border-dashed border-[rgba(0,100,180,0.12)] rounded-2xl">
                    <span className="text-3xl">🎉</span>
                    <h5 className="font-bold text-[#0D1B2A] mt-2">오늘 처리할 액션 아이템 완료!</h5>
                    <p className="text-xs text-[#5A6F8A] mt-1">새 회의 파일을 업로드하여 태스크를 추출하세요.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 🔹 3단계: 상세 편집 모달 (수정 / 승인 / 삭제 통합 제어) */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-[#0D1B2A]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-[rgba(0,100,180,0.12)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* 모달 헤더 */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#0099CC]/10 to-[#7C3AED]/10 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase px-2 py-0.5 bg-[#7C3AED] text-white rounded">
                  {selectedItem.status}
                </span>
                <span className="text-sm font-bold text-[#5A6F8A]">Action Item 상세 검증</span>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-[#5A6F8A] hover:text-[#0D1B2A] text-lg font-bold transition-colors"
              >
                <LucideIcon name="chevronRight" size={18} className="transform rotate-90" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              
              {/* 디테일 UX: 비교 모드 (Diff View) */}
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-[#0D1B2A] flex items-center gap-1.5">
                  <LucideIcon name="sparkles" size={14} className="text-[#0099CC]" />
                  AI 초안 대조 시스템 (Diff View)
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDiffMode}
                    onChange={(e) => setIsDiffMode(e.target.checked)}
                    className="rounded border-[rgba(0,100,180,0.12)] text-[#0099CC] focus:ring-[#0099CC]"
                  />
                  <span className="text-xs text-[#5A6F8A]">비교 모드 활성화</span>
                </label>
              </div>

              {isDiffMode && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-[#F8FAFF] border border-[rgba(0,100,180,0.08)] rounded-xl text-xs">
                  <div className="space-y-1 border-r border-gray-200 pr-2">
                    <span className="font-extrabold text-[#F59E0B] flex items-center gap-1">
                      <LucideIcon name="sparkles" size={11} />
                      AI 초안 요약
                    </span>
                    <div className="text-[#5A6F8A] font-mono leading-relaxed truncate">
                      <strong>제목:</strong> {selectedItem.aiOriginalTitle}
                    </div>
                    <div className="text-[#5A6F8A] font-mono">
                      <strong>담당자:</strong> {selectedItem.aiOriginalAssignee}
                    </div>
                    <div className="text-[#5A6F8A] font-mono">
                      <strong>기한:</strong> {selectedItem.aiOriginalDueDate}
                    </div>
                  </div>
                  <div className="space-y-1 pl-1">
                    <span className="font-extrabold text-[#7C3AED] flex items-center gap-1">
                      <LucideIcon name="user" size={11} />
                      내가 변경한 최종본
                    </span>
                    <div className="text-[#0D1B2A] font-mono leading-relaxed truncate">
                      <strong>제목:</strong> {editForm.title}
                    </div>
                    <div className="text-[#0D1B2A] font-mono">
                      <strong>담당자:</strong> {editForm.assignee}
                    </div>
                    <div className="text-[#0D1B2A] font-mono">
                      <strong>기한:</strong> {editForm.dueDate}
                    </div>
                  </div>
                </div>
              )}

              {/* 편집 폼 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0D1B2A] mb-1">
                    티켓 제목 직접 수정
                  </label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-[rgba(0,100,180,0.12)] rounded-lg text-sm focus:border-[#0099CC] focus:ring-1 focus:ring-[#0099CC] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0D1B2A] mb-1">
                    상세 태스크 내용 설명
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-[rgba(0,100,180,0.12)] rounded-lg text-sm focus:border-[#0099CC] focus:ring-1 focus:ring-[#0099CC] outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0D1B2A] mb-1">
                      마감 기한 달력 UI
                    </label>
                    <input
                      type="date"
                      value={editForm.dueDate}
                      onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                      className="w-full px-3 py-2 border border-[rgba(0,100,180,0.12)] rounded-lg text-sm focus:border-[#0099CC] focus:ring-1 focus:ring-[#0099CC] outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0D1B2A] mb-1">
                      담당자 재할당 드롭다운
                    </label>
                    <select
                      value={editForm.assignee}
                      onChange={(e) => setEditForm({ ...editForm, assignee: e.target.value })}
                      className="w-full px-3 py-2 border border-[rgba(0,100,180,0.12)] bg-white rounded-lg text-sm focus:border-[#0099CC] focus:ring-1 focus:ring-[#0099CC] outline-none"
                    >
                      {TEAM_MEMBERS.map(m => (
                        <option key={m.name} value={m.name}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 하단 제어 영역 및 학습 데이터 피드백 체크 */}
              <div className="border-t border-gray-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                
                {/* C. 삭제하기 & AI 피드백 밸브 */}
                <div className="flex flex-col gap-1.5 text-left">
                  <button
                    onClick={() => handleDelete(selectedItem.id, document.getElementById("ai-exclude-chk")?.checked)}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-[#EF4444] hover:bg-[#dc2626] rounded-lg transition-colors self-start flex items-center gap-1.5"
                  >
                    <LucideIcon name="trash" size={12} />
                    이 태스크 삭제 (Delete)
                  </button>
                  <label className="flex items-center gap-1.5 text-[11px] text-[#5A6F8A] cursor-pointer">
                    <input type="checkbox" id="ai-exclude-chk" className="rounded text-[#EF4444] focus:ring-[#EF4444]" />
                    <span>학습 데이터 제외 (피드백 데이터 활용)</span>
                  </label>
                </div>

                {/* 수정 사항 임시 세이브 & Jira API 승인 전송 */}
                <div className="flex items-center justify-end gap-2.5">
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 text-xs font-bold text-[#7C3AED] hover:bg-[#7C3AED]/5 border border-[#7C3AED] rounded-lg transition-colors"
                  >
                    수정 내용 저장
                  </button>
                  <button
                    onClick={() => handleApprove(selectedItem.id)}
                    className="px-5 py-2 text-xs font-bold text-white bg-[#10B981] hover:bg-[#0d9488] rounded-lg shadow-md shadow-emerald-500/15 transition-colors flex items-center gap-1"
                  >
                    승인 및 Jira 연동 🚀
                  </button>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

      {/* 🔹 로그인용 가상 회원가입 및 데모체험 모달 */}
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
                className="flex-1 py-2 text-sm font-bold text-[#5A6F8A] hover:bg-gray-100 rounded-lg transition-colors"
              >
                닫기
              </button>
              <button
                type="submit"
                className="flex-1 py-2 text-sm font-bold text-white bg-[#0099CC] hover:bg-[#0086b3] rounded-lg transition-colors shadow-md shadow-cyan-500/10"
              >
                입장 및 시연 ⚡
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 🔹 토스트 알림 컴포넌트 */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#0D1B2A] text-white px-5 py-3.5 rounded-xl shadow-2xl border border-gray-800 animate-in slide-in-from-bottom-4 duration-300">
          <LucideIcon name="checkCircle" size={16} className="text-[#10B981]" />
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {!isMobile && <Footer />}
      {isMobile && <MobileTab active={activeTab} onChange={setActiveTab} />}
    </div>
  );
}
