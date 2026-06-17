import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MobileTab from '../components/MobileTab';

// Lucide 스타일의 커스텀 SVG 아이콘 사전 정의
const icons = {
  folder: [
    "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
  ],
  users: [
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M23 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75"
  ],
  arrowRight: [
    "M5 12h14",
    "M12 5l7 7-7 7"
  ],
  arrowLeft: [
    "M19 12H5",
    "M12 19l-7-7 7-7"
  ],
  check: [
    "M20 6L9 17l-5-5"
  ],
  chevronDown: [
    "M6 9l6 6 6-6"
  ],
  chevronUp: [
    "M18 15l-6-6-6 6"
  ],
  sparkles: [
    "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707-.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"
  ],
  info: [
    "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",
    "M12 16v-4",
    "M12 8h.01"
  ],
  plus: [
    "M12 5v14",
    "M5 12h14"
  ],
  trash: [
    "M3 6h18",
    "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
  ],
  loader: [
    "M12 2v4",
    "M12 18v4",
    "M4.93 4.93l2.83 2.83",
    "M16.24 16.24l2.83 2.83",
    "M2 12h4",
    "M18 12h4",
    "M4.93 19.07l2.83-2.83",
    "M16.24 7.76l2.83-2.83"
  ],
  mail: [
    "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z",
    "M22 6l-10 7L2 6"
  ],
  eye: [
    "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z",
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
  ]
};

function LIcon({ name, size = 18, color = "currentColor", sw = 2, className = "" }) {
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
      className={`inline-block shrink-0 ${className}`}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export default function CreateProject() {
  const navigate = useNavigate();
  const categoryDropdownRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState('home');

  const stateLabels = {
    IDLE: '대기 중',
    UPLOADING: '업로드 중',
    PROCESSING: 'AI 분석 중',
    COMPLETED: '분석 완료',
    FAILED: '오류 발생'
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target)) {
        setIsCategoryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // 스텝 상태 (1: 기본 정보 설정, 2: 팀원 초대)
  const [step, setStep] = useState(1);

  // 1단계: 기본 정보 설정 상태
  const [projectName, setProjectName] = useState('');
  const [category, setCategory] = useState('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('#EEF3FF'); // 선택된 프로젝트 상징색

  // 템플릿/컨벤션 복사 옵션
  const [copyTemplate, setCopyTemplate] = useState('none');

  // 고급 설정 아코디언 상태
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [jiraIntegration, setJiraIntegration] = useState(false);
  const [aiCustomRule, setAiCustomRule] = useState('');

  // 2단계: 팀원 초대 상태
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member'); // admin, member
  const [isInviting, setIsInviting] = useState(false);
  const [invitedMembers, setInvitedMembers] = useState([]);

  // 최종 프로젝트 빌드 가상 오버레이 모달 상태들
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildStepText, setBuildStepText] = useState('');
  const [buildSuccess, setBuildSuccess] = useState(false);

  // 토스트 메시지 알림 관리
  const [toastMessage, setToastMessage] = useState('');

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  // 분야별 파스텔 톤 기본 매칭 색상 데이터
  const categoryConfig = {
    '개발': { color: '#EEF3FF', labelColor: '#0099CC', name: '개발 (Development)' },
    '디자인': { color: '#F3E8FF', labelColor: '#7C3AED', name: '디자인 (Design)' },
    '기획': { color: '#E6F4EA', labelColor: '#10B981', name: '기획 (Planning)' },
    '마케팅': { color: '#FCE8E6', labelColor: '#EF4444', name: '마케팅 (Marketing)' },
    '기타': { color: '#FEF7E0', labelColor: '#F59E0B', name: '기타 직접 입력' }
  };

  // 파스텔 톤 6종 프로젝트 상징색 리스트
  const colorTags = [
    { hex: '#EEF3FF', name: '소프트 블루', labelColor: '#0099CC' },
    { hex: '#E6F4EA', name: '민트 그린', labelColor: '#10B981' },
    { hex: '#FCE8E6', name: '블러썸 핑크', labelColor: '#EF4444' },
    { hex: '#FEF7E0', name: '파스텔 옐로우', labelColor: '#F59E0B' },
    { hex: '#F3E8FF', name: '라벤더 퍼플', labelColor: '#7C3AED' },
    { hex: '#E2F7FC', name: '클리어 시안', labelColor: '#00A3C4' },
  ];

  // 카테고리 변경 시 해당 도메인에 지정된 파스텔 상징색으로 자동 연동
  const handleCategoryChange = (val) => {
    setCategory(val);
    setIsCategoryOpen(false);
    if (categoryConfig[val]) {
      setSelectedColor(categoryConfig[val].color);
    }
  };

  // 1단계 -> 2단계 벨리데이션 체크
  const handleGoToNext = (e) => {
    e.preventDefault();
    if (!projectName.trim()) {
      triggerToast('⚠️ 프로젝트 이름을 입력해 주세요.');
      return;
    }
    if (!category) {
      triggerToast('⚠️ 카테고리를 선택해 주세요.');
      return;
    }
    setStep(2);
  };

  // 실시간 팀원 초대 발송 핸들러
  const handleAddMember = () => {
    if (!email.trim() || !email.includes('@')) {
      triggerToast('⚠️ 올바른 형식의 이메일 주소를 입력해 주세요.');
      return;
    }

    setIsInviting(true);

    setTimeout(() => {
      const newMember = {
        id: Date.now(),
        email: email.trim(),
        role: role === 'admin' ? '관리자' : '일반 멤버',
        status: '초대장 발송 완료'
      };
      setInvitedMembers([...invitedMembers, newMember]);
      setEmail('');
      setIsInviting(false);
      triggerToast('📩 초대장이 메일로 성공적으로 발송되었습니다.');
    }, 1200);
  };

  // 초대 리스트 제거 핸들러
  const handleRemoveMember = (id) => {
    setInvitedMembers(invitedMembers.filter(m => m.id !== id));
    triggerToast('🗑️ 초대가 취소되었습니다.');
  };

  // 최종 프로젝트 마이크로 빌드 로딩 시나리오 (건너뛰기 또는 생성 완료 시 적용)
  const startWorkspaceBuild = (isSkipped = false) => {
    setIsBuilding(true);
    setBuildProgress(10);
    setBuildStepText('프로젝트 데이터 인프라 구축 중...');

    // 1단계
    setTimeout(() => {
      setBuildProgress(45);
      setBuildStepText('AI 가이드라인 및 규칙 컨벤션 프로토콜 바인딩 중...');
    }, 800);

    // 2단계
    setTimeout(() => {
      setBuildProgress(80);
      if (isSkipped || invitedMembers.length === 0) {
        setBuildStepText('Jira 연동 모듈 파이프라인 구성 검증 중...');
      } else {
        setBuildStepText(`팀원 대상 초대 메일 일괄 인증 배포 발송 중 (${invitedMembers.length}명)...`);
      }
    }, 1600);

    // 3단계 완료
    setTimeout(() => {
      setBuildProgress(100);
      setBuildStepText('TIKI 업무 요약 자동화 프로젝트 생성 성공!');
      setBuildSuccess(true);
    }, 2400);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFF] font-sans text-[#0D1B2A] antialiased overflow-x-hidden pt-20 pb-20 md:pb-0 flex flex-col">
      <Header isMobile={isMobile} phase="IDLE" stateLabels={stateLabels} />

      {/* Pretendard 폰트 패밀리 임베딩 스타일 강제 인젝션 */}
      <style>{`
        @import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css");
        .font-sans {
          font-family: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* 가상 빌드 진행률 오버레이 모달 레이어 */}
      {isBuilding && (
        <div className="fixed inset-0 bg-[#0D1B2A]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-[rgba(0,100,180,0.12)] text-center animate-fadeIn">
            {!buildSuccess ? (
              <div className="space-y-6 py-4">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-t-[#0099CC] border-r-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-[#0099CC]">
                    {buildProgress}%
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-[#0D1B2A]">프로젝트를 생성하고 있습니다</h3>
                  <p className="text-sm text-[#5A6F8A] h-5 transition-all duration-300 font-medium">
                    {buildStepText}
                  </p>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-[#0099CC] to-[#7C3AED] h-full transition-all duration-500 rounded-full"
                    style={{ width: `${buildProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6 py-4">
                <div className="w-16 h-16 bg-[#E6F4EA] rounded-full flex items-center justify-center mx-auto text-[#10B981] scale-110 transition-transform duration-500">
                  <LIcon name="check" size={32} sw={3} />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl font-bold text-[#0D1B2A]">프로젝트 생성 완료!</h3>
                  <p className="text-sm text-[#5A6F8A] px-2">
                    <span className="font-semibold text-[#0099CC]">{projectName || 'TIKI 신규 프로젝트'}</span>가<br />
                    성공적으로 목록에 추가되고 환경 설정이 완료되었습니다.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsBuilding(false);
                      setBuildSuccess(false);
                      alert('새 프로젝트가 리스트에 성공적으로 반영되었습니다!\n프로젝트 목록(ProjectList) 화면으로 이동합니다.');
                      navigate('/project-list');
                    }}
                    className="w-full bg-[#0099CC] hover:bg-[#0088BB] text-white py-3.5 px-6 rounded-xl font-bold transition shadow-md shadow-[#0099CC]/15"
                  >
                    프로젝트 리스트 확인하기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 커스텀 토스트 알림창 */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0D1B2A] text-white text-xs sm:text-sm font-semibold py-3.5 px-5 rounded-2xl shadow-xl flex items-center space-x-2 border border-white/10 animate-fadeIn">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 전체 분할 스플릿 레이아웃 컨테이너 */}
      <div className="flex-1 w-full px-4 py-8 sm:py-12 md:px-12">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ============================== [좌측 영역] 실시간 라이브 대시보드 카드 프리뷰 ============================== */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-[rgba(0,100,180,0.12)] p-6 sm:p-8 space-y-6 shadow-sm sticky top-12 self-start hidden lg:block">
          <div className="flex items-center justify-between border-b border-[rgba(0,100,180,0.08)] pb-4">
            <div className="flex items-center space-x-2">
              <LIcon name="eye" className="text-[#0099CC]" size={18} />
              <span className="text-xs font-bold text-[#5A6F8A] uppercase tracking-wider">실시간 프로젝트 카드 미리보기</span>
            </div>
            <span className="text-[10px] bg-[#EEF3FF] text-[#0099CC] px-2.5 py-1 rounded-full font-bold">Live Preview</span>
          </div>

          {/* 실시간으로 조립되는 프로젝트 컴포넌트 카드 */}
          <div className="relative bg-[#F8FAFF] rounded-2xl border border-[rgba(0,100,180,0.08)] p-6 overflow-hidden min-h-[220px] flex flex-col justify-between transition-all duration-300">
            {/* 상징색 상단 탑 바 */}
            <div 
              className="absolute top-0 left-0 right-0 h-2.5 transition-colors duration-300"
              style={{ backgroundColor: selectedColor }}
            />

            <div>
              {/* 카테고리 태그 */}
              <div className="mb-4">
                {category ? (
                  <span 
                    style={{ 
                      backgroundColor: selectedColor, 
                      color: colorTags.find(c => c.hex === selectedColor)?.labelColor || '#0099CC' 
                    }}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-white/40 shadow-sm transition-all duration-300"
                  >
                    {category === '기타' ? (customCategory || '기타') : category}
                  </span>
                ) : (
                  <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-400 border border-dashed border-gray-200">
                    카테고리 선택 대기 중
                  </span>
                )}
              </div>

              {/* 프로젝트 명 */}
              <h3 className="text-lg font-bold text-[#0D1B2A] line-clamp-2 leading-snug transition-all">
                {projectName.trim() ? projectName : '프로젝트 이름을 입력해 주세요'}
              </h3>

              {/* 설명 */}
              <p className="text-xs text-[#5A6F8A] line-clamp-3 mt-2 leading-relaxed">
                {description.trim() ? description : '여기에 프로젝트의 목적 및 간략한 가이드라인이 표시됩니다.'}
              </p>
            </div>

            {/* 하단 팀원 현황 */}
            <div className="pt-4 border-t border-[rgba(0,100,180,0.05)] mt-4 flex items-center justify-between text-xs text-[#5A6F8A]">
              <div className="flex items-center space-x-1.5">
                <LIcon name="users" size={14} className="text-[#5A6F8A]" />
                <span>참여 팀원: <strong className="text-[#0D1B2A] font-semibold">{invitedMembers.length + 1}명</strong></span>
              </div>
              <span className="text-[10px] text-[#0099CC] font-bold">생성 즉시 셋업</span>
            </div>
          </div>

          {/* AI 컨벤션 복사 예정 알림 */}
          {copyTemplate !== 'none' && (
            <div className="p-3.5 bg-[#F3E8FF]/40 rounded-xl border border-[#7C3AED]/10 flex items-start space-x-2 text-xs text-[#7C3AED] animate-fadeIn">
              <LIcon name="sparkles" size={16} className="mt-0.5 shrink-0" />
              <p className="leading-relaxed">
                <strong>템플릿 복제 예약됨</strong>: 선택하신 이전 프로젝트의 회의록 학습 데이터 및 AI 컨벤션 설정이 그대로 옮겨집니다.
              </p>
            </div>
          )}
        </div>

        {/* ============================== [우측 영역] 프로젝트 생성 프로세스 카드 ============================== */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[rgba(0,100,180,0.12)] p-6 sm:p-10 shadow-sm">
          
          {/* 모바일 최적화 탑 인디케이터 배너 */}
          <div className="mb-8 pb-6 border-b border-[rgba(0,100,180,0.08)]">
            <div className="flex items-center space-x-2.5 mb-1.5">
              <div className="bg-[#EEF3FF] p-2 rounded-xl">
                <LIcon name="folder" color="#0099CC" size={22} />
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#0D1B2A]">
                새 프로젝트 생성
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#5A6F8A] leading-relaxed">
              업무 회의록 요약과 자동 Jira 태스크 매핑에 필요한 초기 프로젝트를 셋업합니다.
            </p>

            {/* 스텝 지시 배지 */}
            <div className="flex items-center space-x-2.5 mt-5">
              <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold transition ${
                step === 1 ? 'bg-[#EEF3FF] text-[#0099CC]' : 'bg-gray-50 text-[#5A6F8A]'
              }`}>
                <span>1. 기본 정보 설정</span>
              </div>
              <LIcon name="arrowRight" size={10} className="text-gray-300" />
              <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold transition ${
                step === 2 ? 'bg-[#EEF3FF] text-[#0099CC]' : 'bg-gray-50 text-[#5A6F8A]'
              }`}>
                <span>2. 팀 구성원 초대</span>
              </div>
            </div>
          </div>

          {/* ============================== 1단계: 기본 설정 폼 ============================== */}
          {step === 1 && (
            <form onSubmit={handleGoToNext} className="space-y-6 animate-fadeIn">
              {/* 프로젝트 이름 */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-[#0D1B2A] mb-2 flex items-center">
                  프로젝트 이름 <span className="text-[#EF4444] ml-1">*</span>
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="예: TIKI 모바일 앱 리뉴얼 프로젝트"
                  className="w-full px-4 py-3 bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl text-sm text-[#0D1B2A] focus:outline-none focus:border-[#0099CC] transition"
                  required
                />
              </div>

              {/* 카테고리 선택 커스텀 드롭다운 */}
              <div className="relative" ref={categoryDropdownRef}>
                <label className="block text-xs sm:text-sm font-semibold text-[#0D1B2A] mb-2">
                  카테고리 선택 <span className="text-[#EF4444] ml-1">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryOpen((prev) => !prev)}
                  className={`w-full px-4 py-3.5 bg-[#F8FAFF] border rounded-xl text-sm transition flex items-center justify-between text-left ${
                    isCategoryOpen
                      ? 'border-[#0099CC] shadow-[0_0_0_3px_rgba(0,153,204,0.12)]'
                      : 'border-[rgba(0,100,180,0.12)] hover:border-[rgba(0,100,180,0.22)]'
                  }`}
                  aria-expanded={isCategoryOpen}
                  aria-haspopup="listbox"
                >
                  <span className={category ? 'text-[#0D1B2A] font-medium' : 'text-[#5A6F8A]'}>
                    {category ? categoryConfig[category]?.name || category : '분야를 선택해 주세요'}
                  </span>
                  <LIcon
                    name="chevronDown"
                    size={14}
                    className={`text-[#5A6F8A] transition-transform duration-200 ${isCategoryOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isCategoryOpen && (
                  <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.12)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)]">
                    <div className="max-h-64 overflow-y-auto py-1.5">
                      {[
                        { value: '개발', label: '개발 (Development)' },
                        { value: '디자인', label: '디자인 (Design)' },
                        { value: '기획', label: '기획 (Planning)' },
                        { value: '마케팅', label: '마케팅 (Marketing)' },
                        { value: '기타', label: '기타 (직접 입력)' }
                      ].map((option) => {
                        const isSelected = category === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => handleCategoryChange(option.value)}
                            className={`w-full px-3.5 py-2.5 text-left text-sm flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-[#EEF3FF] text-[#0099CC] font-semibold'
                                : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'
                            }`}
                          >
                            <span className="truncate">{option.label}</span>
                            {isSelected && <LIcon name="check" size={14} className="text-[#0099CC]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* '기타' 카테고리 직접 입력 */}
              {category === '기타' && (
                <div className="bg-[#EEF3FF] p-4 rounded-xl border border-[rgba(0,153,204,0.15)] animate-fadeIn">
                  <label className="block text-xs font-bold text-[#0099CC] mb-1.5 uppercase">카테고리 분야 직접 입력</label>
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="예: 사업개발지원"
                    className="w-full px-3 py-2.5 bg-white border border-[rgba(0,100,180,0.12)] rounded-lg text-sm focus:outline-none focus:border-[#0099CC]"
                    required={category === '기타'}
                  />
                </div>
              )}

              {/* [개선된 UX] 프로젝트 상징색 그리드 배치 및 카테고리 색상 동기화 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs sm:text-sm font-semibold text-[#0D1B2A]">
                    프로젝트 상징색 (대시보드 태그 색상)
                  </label>
                  {/* 카테고리 변경 시 우측에 분야별 매칭 파스텔 배지 즉시 연동 (이모티콘 대체 가이드) */}
                  {category && categoryConfig[category] && (
                    <span 
                      style={{ 
                        backgroundColor: categoryConfig[category].color,
                        color: categoryConfig[category].labelColor,
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-[rgba(0,100,180,0.06)] animate-fadeIn flex items-center space-x-1"
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: categoryConfig[category].labelColor }} />
                      <span>{category} 전용색 추천</span>
                    </span>
                  )}
                </div>

                {/* 6종 상징색 그리드 단추 패널 */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {colorTags.map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setSelectedColor(color.hex)}
                      style={{ backgroundColor: color.hex }}
                      className={`h-11 rounded-xl border transition-all flex items-center justify-center relative ${
                        selectedColor === color.hex
                          ? 'border-[#0099CC] ring-2 ring-[rgba(0,153,204,0.18)] scale-105 shadow-sm'
                          : 'border-[rgba(0,100,180,0.12)] hover:border-gray-300'
                      }`}
                      title={color.name}
                    >
                      {selectedColor === color.hex && (
                        <div className="absolute inset-0 bg-black/5 rounded-xl flex items-center justify-center">
                          <LIcon name="check" size={14} color={color.labelColor} sw={3.5} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[#5A6F8A] mt-1.5">선택하신 상징색은 대시보드 메인 리스트 카드 식별 색상으로 지정됩니다.</p>
              </div>

              {/* 설명 입력란 */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-[#0D1B2A] mb-2 flex items-center">
                  프로젝트 설명 <span className="text-[#5A6F8A] font-normal ml-1">(선택 사항)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="프로젝트의 주요 목표나 맥락을 간단히 작성하여 팀원들과 공유하세요."
                  rows="3"
                  className="w-full px-4 py-3 bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl text-sm text-[#0D1B2A] focus:outline-none focus:border-[#0099CC] transition resize-none leading-relaxed"
                />
              </div>

              {/* 템플릿/컨벤션 복사 기능 */}
              <div className="bg-[#F8FAFF] rounded-xl border border-[rgba(0,100,180,0.06)] p-4">
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5 text-[#7C3AED]">
                    <LIcon name="sparkles" size={18} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs sm:text-sm font-semibold text-[#0D1B2A]">
                      이전 템플릿 및 설정 복사하기
                    </h4>
                    <p className="text-[11px] sm:text-xs text-[#5A6F8A] mt-1 leading-relaxed">
                      사내에 이미 구축해둔 AI 요약 컨벤션이나 Notion 매핑 규칙 설정을 그대로 적용합니다.
                    </p>
                    <div className="mt-3 relative">
                      <select
                        value={copyTemplate}
                        onChange={(e) => setCopyTemplate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[rgba(0,100,180,0.1)] rounded-lg text-xs text-[#0D1B2A] focus:outline-none cursor-pointer appearance-none"
                      >
                        <option value="none">새 환경으로 새로 시작하기 (복사 없음)</option>
                        <option value="p1">📂 TIKI 개발 파이프라인 컨벤션 복사</option>
                        <option value="p2">📂 신규 모바일 디자인 가이드 컨벤션 복사</option>
                        <option value="p3">📂 마케팅 기획 연동 및 AI 분석 규칙 복사</option>
                      </select>
                      <div className="absolute top-1/2 right-3 transform -translate-y-1/2 pointer-events-none text-[#5A6F8A]">
                        <LIcon name="chevronDown" size={12} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 고급 설정 아코디언 */}
              <div className="border border-[rgba(0,100,180,0.12)] rounded-xl overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-[#EEF3FF] transition text-left"
                >
                  <div className="flex items-center space-x-2">
                    <LIcon name="info" className="text-[#0099CC]" size={16} />
                    <span className="text-xs sm:text-sm font-semibold text-[#0D1B2A]">고급 설정 (Jira 연동 설정 미리 지정)</span>
                  </div>
                  <LIcon name={isAdvancedOpen ? "chevronUp" : "chevronDown"} size={14} className="text-[#5A6F8A]" />
                </button>

                {isAdvancedOpen && (
                  <div className="p-4 border-t border-[rgba(0,100,180,0.08)] space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between p-2.5 bg-[#F8FAFF] rounded-lg">
                      <div className="flex-1 pr-4">
                        <span className="block text-xs font-bold text-[#0D1B2A]">생성 즉시 Jira 연동 활성화</span>
                        <span className="text-[10px] text-[#5A6F8A]">협업에 연결할 Jira API 커넥션 모듈을 활성화 상태로 출발합니다.</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={jiraIntegration}
                          onChange={(e) => setJiraIntegration(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0099CC]"></div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#0D1B2A] mb-1.5">
                        AI 추출 컨벤션 강제 룰 지정
                      </label>
                      <input
                        type="text"
                        value={aiCustomRule}
                        onChange={(e) => setAiCustomRule(e.target.value)}
                        placeholder="예: 마감일을 지정하지 않을 시 3영업일 안으로 자동 매핑"
                        className="w-full px-3 py-2.5 bg-[#F8FAFF] border border-[rgba(0,100,180,0.1)] rounded-lg text-xs text-[#0D1B2A] focus:outline-none focus:border-[#0099CC]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 하단 제어 */}
              <div className="pt-4 border-t border-[rgba(0,100,180,0.12)] flex justify-end">
                <button
                  type="submit"
                  className="w-full sm:w-auto bg-[#0099CC] hover:bg-[#0088BB] text-white py-3.5 px-6 rounded-xl font-semibold transition shadow-sm flex items-center justify-center space-x-1.5"
                >
                  <span>다음 단계로 이동</span>
                  <LIcon name="arrowRight" size={14} />
                </button>
              </div>
            </form>
          )}

          {/* ============================== 2단계: 팀원 초대 (선택) ============================== */}
          {step === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-[#0D1B2A] mb-2 flex items-center">
                  초대할 구성원 이메일
                </label>
                
                <div className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="invite@team-tiki.com"
                    className="w-full px-4 py-3 bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl text-sm focus:outline-none focus:border-[#0099CC] transition"
                    disabled={isInviting}
                  />

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#F8FAFF] p-2 rounded-xl border border-[rgba(0,100,180,0.08)]">
                    
                    <div className="flex bg-white rounded-lg p-1 border border-[rgba(0,100,180,0.05)] shadow-inner">
                      <button
                        type="button"
                        onClick={() => setRole('member')}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-xs font-bold transition-all ${
                          role === 'member'
                            ? 'bg-[#EEF3FF] text-[#0099CC] shadow-sm'
                            : 'text-[#5A6F8A] hover:bg-gray-50'
                        }`}
                      >
                        일반 멤버 (Member)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('admin')}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-xs font-bold transition-all ${
                          role === 'admin'
                            ? 'bg-[#7C3AED]/10 text-[#7C3AED] shadow-sm'
                            : 'text-[#5A6F8A] hover:bg-gray-50'
                        }`}
                      >
                        관리자 (Admin)
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddMember}
                      disabled={isInviting}
                      className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shadow-sm whitespace-nowrap flex items-center justify-center space-x-2"
                    >
                      {isInviting ? (
                        <>
                          <LIcon name="loader" size={14} className="animate-spin text-white" />
                          <span>전송 처리 중...</span>
                        </>
                      ) : (
                        <>
                          <LIcon name="mail" size={14} />
                          <span>구성원 추가</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* 팀원 대기 리스트 */}
              {invitedMembers.length > 0 ? (
                <div className="bg-[#F8FAFF] rounded-xl p-4 border border-[rgba(0,100,180,0.06)] animate-fadeIn">
                  <h4 className="text-xs font-bold text-[#5A6F8A] uppercase tracking-wider mb-3 flex items-center space-x-1">
                    <LIcon name="users" size={14} className="text-[#5A6F8A]" />
                    <span>추가 예정 멤버 ({invitedMembers.length}명)</span>
                  </h4>
                  
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {invitedMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between bg-white px-3 py-2.5 rounded-lg border border-[rgba(0,100,180,0.08)] text-xs animate-fadeIn"
                      >
                        <div className="flex items-center space-x-2 truncate mr-4">
                          <div className="w-6 h-6 rounded-full bg-[#EEF3FF] flex items-center justify-center text-[10px] font-bold text-[#0099CC]">
                            {member.email.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-[#0D1B2A] truncate max-w-[150px] sm:max-w-xs">
                            {member.email}
                          </span>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                            member.role === '관리자' ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'bg-[#EEF3FF] text-[#0099CC]'
                          }`}>
                            {member.role}
                          </span>
                          <span className="text-[#10B981] font-bold bg-[#E6F4EA] px-2 py-0.5 rounded text-[10px]">
                            {member.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.id)}
                            className="text-[#EF4444] hover:bg-[#FCE8E6] p-1 rounded transition"
                            title="취소"
                          >
                            <LIcon name="trash" size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-[#F8FAFF] border border-dashed border-[rgba(0,100,180,0.12)] rounded-xl p-6 text-center">
                  <LIcon name="users" className="text-[rgba(0,100,180,0.3)] mb-2" size={24} />
                  <p className="text-xs text-[#5A6F8A]">
                    아직 리스트에 추가된 팀원이 없습니다.<br />팀원은 프로젝트 생성 후 상세 설정 대시보드에서도 추가가 가능합니다.
                  </p>
                </div>
              )}

              {/* 하단 제어 */}
              <div className="pt-6 border-t border-[rgba(0,100,180,0.12)] flex items-center justify-between space-x-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-3 border border-[rgba(0,100,180,0.12)] text-[#5A6F8A] text-xs sm:text-sm font-medium rounded-xl hover:bg-gray-50 transition flex items-center space-x-1"
                >
                  <LIcon name="arrowLeft" size={14} />
                  <span>기본 정보로</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => startWorkspaceBuild(true)}
                    className="px-3 py-3 text-xs sm:text-sm font-semibold text-[#5A6F8A] hover:text-[#0D1B2A] transition"
                  >
                    건너뛰기(Skip)
                  </button>

                  <button
                    type="button"
                    onClick={() => startWorkspaceBuild(false)}
                    className="bg-[#0099CC] hover:bg-[#0088BB] text-white py-3 px-5 sm:px-6 rounded-xl text-xs sm:text-sm font-bold transition shadow-sm flex items-center space-x-1.5"
                  >
                    <LIcon name="check" size={14} />
                    <span>프로젝트 생성 완료</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
        </div>
      </div>

      {!isMobile && <Footer />}
      {isMobile && <MobileTab active={activeTab} onChange={setActiveTab} />}
    </div>
  );
}