import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MobileTab from '../components/MobileTab';
import { createProject } from '../api/apiClient';

const icons = {
  folder: ["M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"],
  users: ["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2","M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z","M23 21v-2a4 4 0 0 0-3-3.87","M16 3.13a4 4 0 0 1 0 7.75"],
  user: ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2","M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"],
  lock: ["M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z","M7 11V7a5 5 0 0 1 10 0v4"],
  globe: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20","M2 12h20","M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
  arrowRight: ["M5 12h14","M12 5l7 7-7 7"],
  arrowLeft: ["M19 12H5","M12 19l-7-7 7-7"],
  check: ["M20 6L9 17l-5-5"],
  chevronDown: ["M6 9l6 6 6-6"],
  chevronUp: ["M18 15l-6-6-6 6"],
  sparkles: ["M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707-.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"],
  info: ["M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z","M12 16v-4","M12 8h.01"],
  plus: ["M12 5v14","M5 12h14"],
  trash: ["M3 6h18","M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"],
  loader: ["M12 2v4","M12 18v4","M4.93 4.93l2.83 2.83","M16.24 16.24l2.83 2.83","M2 12h4","M18 12h4","M4.93 19.07l2.83-2.83","M16.24 7.76l2.83-2.83"],
  mail: ["M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z","M22 6l-10 7L2 6"],
  eye: ["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z","M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
  clock: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20","M12 6v6l4 2"]
};

function LIcon({ name, size = 18, color = "currentColor", sw = 2, className = "" }) {
  const paths = icons[name];
  if (!paths) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={`inline-block shrink-0 ${className}`}>
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

export default function CreateProject() {
  const navigate = useNavigate();
  const templateDropdownRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState('home');

  const stateLabels = { IDLE: '대기 중', UPLOADING: '업로드 중', PROCESSING: 'AI 분석 중', COMPLETED: '분석 완료', FAILED: '오류 발생' };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(e.target)) setIsTemplateOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('members');
  const [copyTemplate, setCopyTemplate] = useState('none');
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [isInviting, setIsInviting] = useState(false);
  const [invitedMembers, setInvitedMembers] = useState([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildStepText, setBuildStepText] = useState('');
  const [buildSuccess, setBuildSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastIcon, setToastIcon] = useState('info');

  const triggerToast = (msg, icon = 'info') => {
    setToastMessage(msg);
    setToastIcon(icon);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const templateOptions = [
    { value: 'none', label: '새 프로젝트로 시작', description: '기본값', icon: 'sparkles' },
    { value: 'meeting-ai', label: '회의록 자동화 설정', description: 'Jira / Notion 규칙', icon: 'folder' },
    { value: 'design-system', label: '디자인 시스템 설정', description: '컴포넌트 규칙', icon: 'eye' },
    { value: 'strategy-planning', label: '기획 / 전략 설정', description: '로드맵 규칙', icon: 'mail' }
  ];

  const visibilityOptions = [
    { value: 'private', label: '개인', icon: 'lock' },
    { value: 'members', label: '구성원만', icon: 'user' },
    { value: 'org', label: '전체보기', icon: 'globe' },
  ];

  const visibilityLabelMap = { private: '개인', members: '구성원만', org: '전체보기' };
  const visibilityIconMap = { private: 'lock', members: 'user', org: 'globe' };
  const createdDateText = new Date().toISOString().slice(0, 10);

  const selectedTemplate = templateOptions.find((o) => o.value === copyTemplate) || templateOptions[0];

  const handleGoToNext = (e) => {
    e.preventDefault();
    if (!projectName.trim()) { triggerToast('프로젝트 이름을 입력해 주세요.', 'info'); return; }
    setStep(2);
  };

  const handleAddMember = () => {
    if (!email.trim() || !email.includes('@')) { triggerToast('올바른 형식의 이메일 주소를 입력해 주세요.', 'info'); return; }
    setIsInviting(true);
    setTimeout(() => {
      setInvitedMembers([...invitedMembers, { id: Date.now(), email: email.trim(), role: role === 'admin' ? '관리자' : '일반 멤버', status: '초대장 발송 완료' }]);
      setEmail('');
      setIsInviting(false);
      triggerToast('초대장이 메일로 성공적으로 발송되었습니다.', 'mail');
    }, 1200);
  };

  const handleRemoveMember = (id) => {
    setInvitedMembers(invitedMembers.filter(m => m.id !== id));
    triggerToast('초대가 취소되었습니다.', 'trash');
  };

  const startWorkspaceBuild = async (isSkipped = false) => {
    setIsBuilding(true);
    setBuildProgress(10);
    setBuildStepText('프로젝트 데이터 인프라 구축 중...');

    try {
      await new Promise((r) => setTimeout(r, 800));
      setBuildProgress(45);
      setBuildStepText('AI 가이드라인 및 규칙 컨벤션 프로토콜 바인딩 중...');

      await createProject({
        name: projectName.trim(),
        description: description.trim(),
        category: copyTemplate === 'design-system' ? '디자인' : copyTemplate === 'strategy-planning' ? '기획' : '일반',
        visibility,
        meetingTemplate: copyTemplate === 'none' ? 'basic' : copyTemplate,
        members: invitedMembers.map((member) => ({
          email: member.email,
          role: member.role === '관리자' ? 'admin' : 'member',
        })),
      });

      await new Promise((r) => setTimeout(r, 800));
      setBuildProgress(80);
      setBuildStepText(isSkipped || invitedMembers.length === 0 ? 'Jira 연동 모듈 파이프라인 구성 검증 중...' : `팀원 대상 초대 메일 일괄 인증 배포 발송 중 (${invitedMembers.length}명)...`);

      await new Promise((r) => setTimeout(r, 800));
      setBuildProgress(100);
      setBuildStepText('TIKI 업무 요약 자동화 프로젝트 생성 성공!');
      setBuildSuccess(true);
    } catch (err) {
      setIsBuilding(false);
      triggerToast(`프로젝트 생성 실패: ${err.message}`, 'info');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFF] font-sans text-[#0D1B2A] antialiased overflow-x-hidden pt-20 pb-20 md:pb-0 flex flex-col">
      <Header isMobile={isMobile} phase="IDLE" stateLabels={stateLabels} />

      <style>{`
        @import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css");
        .font-sans { font-family: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      {/* 빌드 오버레이 */}
      {isBuilding && (
        <div className="fixed inset-0 bg-[#0D1B2A]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border border-[rgba(0,100,180,0.12)] text-center animate-fadeIn">
            {!buildSuccess ? (
              <div className="space-y-6 py-4">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-t-[#0099CC] border-r-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-[#0099CC]">{buildProgress}%</div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-[#0D1B2A]">프로젝트를 생성하고 있습니다</h3>
                  <p className="text-sm text-[#5A6F8A] h-5 transition-all duration-300 font-medium">{buildStepText}</p>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-gradient-to-r from-[#0099CC] to-[#7C3AED] h-full transition-all duration-500 rounded-full" style={{ width: `${buildProgress}%` }} />
                </div>
              </div>
            ) : (
              <div className="space-y-6 py-4">
                <div className="w-16 h-16 bg-[#E6F4EA] rounded-full flex items-center justify-center mx-auto text-[#10B981]">
                  <LIcon name="check" size={32} sw={3} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-xl font-bold text-[#0D1B2A]">프로젝트 생성 완료!</h3>
                  <p className="text-sm text-[#5A6F8A] px-2">
                    <span className="font-semibold text-[#0099CC]">{projectName || 'TIKI 신규 프로젝트'}</span>가<br />성공적으로 목록에 추가되고 환경 설정이 완료되었습니다.
                  </p>
                </div>
                <div className="pt-2">
                  <button type="button" onClick={() => { setIsBuilding(false); setBuildSuccess(false); navigate('/project-list'); }} className="w-full bg-[#0099CC] hover:bg-[#0088BB] text-white py-3.5 px-6 rounded-xl font-bold transition shadow-md">
                    프로젝트 리스트 확인하기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0D1B2A] text-white text-xs sm:text-sm font-semibold py-3.5 px-5 rounded-2xl shadow-xl flex items-center space-x-2 border border-white/10 animate-fadeIn">
          <LIcon name={toastIcon} size={14} color="#ffffff" className="shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex-1 w-full px-4 py-8 sm:py-12 md:px-12">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ── 좌측: Live Preview ── */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-[rgba(0,100,180,0.12)] p-6 sm:p-8 space-y-6 shadow-sm sticky top-12 self-start hidden lg:block">
            <div className="flex items-center justify-between border-b border-[rgba(0,100,180,0.08)] pb-4">
              <div className="flex items-center space-x-2">
                <LIcon name="eye" className="text-[#0099CC]" size={18} />
                <span className="text-xs font-bold text-[#5A6F8A] uppercase tracking-wider">실시간 프로젝트 카드 미리보기</span>
              </div>
              <span className="text-[10px] bg-[#EEF3FF] text-[#0099CC] px-2.5 py-1 rounded-full font-bold">Live Preview</span>
            </div>

            {/* ── 카드 본문: ProjectList 카드와 동일한 구조 ── */}
            <div
              className="group w-full rounded-2xl border border-[rgba(0,100,180,0.10)] bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#0099CC]/30 hover:shadow-md flex flex-col"
            >
              <div className="mb-2 flex items-center">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F7FB] px-1.5 py-0.5 text-[10.5px] font-medium text-[#7A8FA6]">
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[#8FA0B3]">
                    <LIcon name={visibilityIconMap[visibility] || 'user'} size={10} />
                  </span>
                  {visibilityLabelMap[visibility] || '구성원만'}
                </span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-1 text-[15px] font-bold leading-snug text-[#0D1B2A] transition-colors group-hover:text-[#0099CC]">
                    {projectName.trim() ? projectName : '프로젝트 이름을 입력해 주세요'}
                  </h3>
                </div>
              </div>

              <p
                className="mt-2.5 overflow-hidden text-[13px] leading-[1.65] text-[#5A6F8A]"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {description.trim() ? description : '프로젝트 설명을 입력하면 여기에 2줄로 보여드려요.'}
              </p>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-[rgba(0,100,180,0.06)] pt-3">
                <div className="flex min-w-0 items-center gap-1.5 text-[#0D1B2A]/70">
                  <LIcon name="users" size={15} className="shrink-0" />
                  <span className="truncate text-xs">참여 {invitedMembers.length + 1}명</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-[#0D1B2A]/55">
                  <LIcon name="clock" size={14} className="shrink-0" />
                  <span className="text-xs">생성 {createdDateText}</span>
                </div>
              </div>
            </div>

            {/* 템플릿 복사 알림 */}
            {copyTemplate !== 'none' && (
              <div className="p-3.5 bg-[#F6F8FB] rounded-xl border border-[#CBD5E1]/60 flex items-start space-x-2 text-xs text-[#334155] animate-fadeIn">
                <LIcon name="sparkles" size={16} className="mt-0.5 shrink-0 text-[#64748B]" />
                <p className="leading-relaxed">
                  <strong>이전 프로젝트 설정 가져오기 예약됨</strong>: 선택하신 프로젝트의 회의록 학습 데이터와 초기 설정을 그대로 이어받습니다.
                </p>
              </div>
            )}
          </div>

          {/* ── 우측: 폼 ── */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-[rgba(0,100,180,0.12)] p-6 sm:p-10 shadow-sm">
            <div className="mb-8 pb-6 border-b border-[rgba(0,100,180,0.08)]">
              <div className="flex items-center space-x-2.5 mb-1.5">
                <div className="bg-[#EEF3FF] p-2 rounded-xl">
                  <LIcon name="folder" color="#0099CC" size={22} />
                </div>
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#0D1B2A]">새 프로젝트 생성</h1>
              </div>
              <p className="text-xs sm:text-sm text-[#5A6F8A] leading-relaxed">업무 회의록 요약과 자동 Jira 태스크 매핑에 필요한 초기 프로젝트를 셋업합니다.</p>
              <div className="flex items-center space-x-2.5 mt-5">
                <div className={`px-3 py-1 rounded-full text-xs font-bold transition ${step === 1 ? 'bg-[#EEF3FF] text-[#0099CC]' : 'bg-gray-50 text-[#5A6F8A]'}`}>
                  <span>1. 기본 정보 설정</span>
                </div>
                <LIcon name="arrowRight" size={10} className="text-gray-300" />
                <div className={`px-3 py-1 rounded-full text-xs font-bold transition ${step === 2 ? 'bg-[#EEF3FF] text-[#0099CC]' : 'bg-gray-50 text-[#5A6F8A]'}`}>
                  <span>2. 팀 구성원 초대</span>
                </div>
              </div>
            </div>

            {/* 1단계 */}
            {step === 1 && (
              <form onSubmit={handleGoToNext} className="space-y-6 animate-fadeIn">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-[#0D1B2A] mb-2">
                    프로젝트 이름 <span className="text-[#EF4444] ml-1">*</span>
                  </label>
                  <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="예: TIKI 모바일 앱 리뉴얼 프로젝트"
                    className="w-full px-4 py-3 bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl text-sm text-[#0D1B2A] focus:outline-none focus:border-[#0099CC] transition" required />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-[#0D1B2A] mb-2">
                    프로젝트 설명 <span className="text-[#5A6F8A] font-normal ml-1">(선택 사항)</span>
                  </label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="프로젝트의 주요 목표나 맥락을 간단히 작성하여 팀원들과 공유하세요." rows="3"
                    className="w-full px-4 py-3 bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl text-sm text-[#0D1B2A] focus:outline-none focus:border-[#0099CC] transition resize-none leading-relaxed" />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-[#0D1B2A] mb-2">프로젝트 공개 범위</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {visibilityOptions.map((option) => {
                      const selected = visibility === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setVisibility(option.value)}
                          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                            selected
                              ? 'border-[#0099CC] bg-[#EEF3FF] text-[#0099CC] shadow-[0_0_0_2px_rgba(0,153,204,0.10)]'
                              : 'border-[rgba(0,100,180,0.12)] bg-white text-[#5A6F8A] hover:border-[rgba(0,153,204,0.35)]'
                          }`}
                        >
                          <LIcon name={option.icon} size={13} />
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-[rgba(0,100,180,0.08)] bg-[#F8FAFF] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-[#7C3AED]">
                      <LIcon name="sparkles" size={18} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs sm:text-sm font-semibold text-[#0D1B2A]">이전 프로젝트 설정 가져오기</h4>
                      <p className="mt-1 text-[11px] sm:text-xs leading-relaxed text-[#5A6F8A]">
                        새로 시작하거나, 기존 프로젝트의 회의 컨벤션과 초기 설정을 이어받을 수 있습니다.
                      </p>
                      <div className="mt-3 relative" ref={templateDropdownRef}>
                        <button type="button" onClick={() => setIsTemplateOpen((prev) => !prev)}
                          className={`w-full px-3 py-2 bg-white border rounded-lg text-xs text-[#0D1B2A] transition flex items-center justify-between text-left ${isTemplateOpen ? 'border-[#0099CC] shadow-[0_0_0_3px_rgba(0,153,204,0.12)]' : 'border-[rgba(0,100,180,0.1)] hover:border-[rgba(0,100,180,0.22)]'}`}>
                          <span className="flex items-center gap-3 min-w-0">
                            <LIcon name={selectedTemplate.icon} size={13} className="text-[#5A6F8A] shrink-0" />
                            <span className="truncate">{selectedTemplate.label}</span>
                          </span>
                          <LIcon name="chevronDown" size={12} className={`text-[#5A6F8A] transition-transform duration-200 ${isTemplateOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isTemplateOpen && (
                          <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.12)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)]">
                            <div className="max-h-64 overflow-y-auto py-1.5">
                              {templateOptions.map((option) => {
                                const isSelected = copyTemplate === option.value;
                                return (
                                  <button key={option.value} type="button" onClick={() => { setCopyTemplate(option.value); setIsTemplateOpen(false); }}
                                    className={`w-full px-3.5 py-2.5 text-left text-sm flex items-center justify-between transition-colors ${isSelected ? 'bg-[#EEF3FF] text-[#0099CC] font-semibold' : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'}`}>
                                    <span className="flex items-center gap-3 min-w-0 pr-4">
                                      <LIcon name={option.icon} size={14} className={isSelected ? 'text-[#0099CC]' : 'text-[#5A6F8A]'} />
                                      <span className="truncate">{option.label}</span>
                                    </span>
                                    <span className="flex items-center gap-2 pl-3 border-l border-[rgba(0,100,180,0.08)]">
                                      <span className="text-[10px] font-medium text-[#5A6F8A] whitespace-nowrap">{option.description}</span>
                                      {isSelected && <LIcon name="check" size={14} className="text-[#0099CC]" />}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[rgba(0,100,180,0.12)] flex justify-end">
                  <button type="submit" className="w-full sm:w-auto bg-[#0099CC] hover:bg-[#0088BB] text-white py-3.5 px-6 rounded-xl font-semibold transition shadow-sm flex items-center justify-center space-x-1.5">
                    <span>다음 단계로 이동</span>
                    <LIcon name="arrowRight" size={14} />
                  </button>
                </div>
              </form>
            )}

            {/* 2단계 */}
            {step === 2 && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-[#0D1B2A] mb-2">초대할 구성원 이메일</label>
                  <div className="space-y-3">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="invite@team-tiki.com" disabled={isInviting}
                      className="w-full px-4 py-3 bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl text-sm focus:outline-none focus:border-[#0099CC] transition" />
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#F8FAFF] p-2 rounded-xl border border-[rgba(0,100,180,0.08)]">
                        <div className="grid flex-1 grid-cols-2 gap-2 rounded-lg border border-[rgba(0,100,180,0.05)] bg-white p-1 shadow-inner">
                          <button
                            type="button"
                            onClick={() => setRole('member')}
                            className={`flex min-h-[46px] items-center justify-center rounded-md px-3 py-2 text-xs font-bold transition-all ${
                              role === 'member'
                                ? 'bg-[#EEF3FF] text-[#0099CC] shadow-sm ring-1 ring-[#0099CC]/10'
                                : 'text-[#5A6F8A] hover:bg-gray-50'
                            }`}
                          >
                            일반 멤버 (Member)
                          </button>
                          <button
                            type="button"
                            onClick={() => setRole('admin')}
                            className={`flex min-h-[46px] items-center justify-center rounded-md px-3 py-2 text-xs font-bold transition-all ${
                              role === 'admin'
                                ? 'bg-[#F3E8FF] text-[#7C3AED] shadow-sm ring-1 ring-[#7C3AED]/10'
                                : 'text-[#5A6F8A] hover:bg-gray-50'
                            }`}
                          >
                            관리자 (Admin)
                          </button>
                        </div>
                      <button type="button" onClick={handleAddMember} disabled={isInviting}
                        className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shadow-sm whitespace-nowrap flex items-center justify-center space-x-2">
                        {isInviting ? (<><LIcon name="loader" size={14} className="animate-spin text-white" /><span>전송 처리 중...</span></>) : (<><LIcon name="mail" size={14} /><span>구성원 추가</span></>)}
                      </button>
                    </div>
                  </div>
                </div>

                {invitedMembers.length > 0 ? (
                  <div className="bg-[#F8FAFF] rounded-xl p-4 border border-[rgba(0,100,180,0.06)] animate-fadeIn">
                    <h4 className="text-xs font-bold text-[#5A6F8A] uppercase tracking-wider mb-3 flex items-center space-x-1">
                      <LIcon name="users" size={14} className="text-[#5A6F8A]" /><span>추가 예정 멤버 ({invitedMembers.length}명)</span>
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {invitedMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between bg-white px-3 py-2.5 rounded-lg border border-[rgba(0,100,180,0.08)] text-xs animate-fadeIn">
                          <div className="flex items-center space-x-2 truncate mr-4">
                            <div className="w-6 h-6 rounded-full bg-[#EEF3FF] flex items-center justify-center text-[10px] font-bold text-[#0099CC]">{member.email.charAt(0).toUpperCase()}</div>
                            <span className="font-medium text-[#0D1B2A] truncate max-w-[150px] sm:max-w-xs">{member.email}</span>
                          </div>
                          <div className="flex items-center space-x-3 shrink-0">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${member.role === '관리자' ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'bg-[#EEF3FF] text-[#0099CC]'}`}>{member.role}</span>
                            <span className="text-[#10B981] font-bold bg-[#E6F4EA] px-2 py-0.5 rounded text-[10px]">{member.status}</span>
                            <button type="button" onClick={() => handleRemoveMember(member.id)} className="text-[#EF4444] hover:bg-[#FCE8E6] p-1 rounded transition"><LIcon name="trash" size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#F8FAFF] border border-dashed border-[rgba(0,100,180,0.12)] rounded-xl p-6 text-center">
                    <LIcon name="users" className="text-[rgba(0,100,180,0.3)] mb-2" size={24} />
                    <p className="text-xs text-[#5A6F8A]">아직 리스트에 추가된 팀원이 없습니다.<br />팀원은 프로젝트 생성 후 상세 설정 대시보드에서도 추가가 가능합니다.</p>
                  </div>
                )}

                <div className="pt-6 border-t border-[rgba(0,100,180,0.12)] flex items-center justify-between space-x-3">
                  <button type="button" onClick={() => setStep(1)} className="px-4 py-3 border border-[rgba(0,100,180,0.12)] text-[#5A6F8A] text-xs sm:text-sm font-medium rounded-xl hover:bg-gray-50 transition flex items-center space-x-1">
                    <LIcon name="arrowLeft" size={14} /><span>기본 정보로</span>
                  </button>
                  <div className="flex items-center space-x-2">
                    <button type="button" onClick={() => startWorkspaceBuild(true)} className="px-3 py-3 text-xs sm:text-sm font-semibold text-[#5A6F8A] hover:text-[#0D1B2A] transition">건너뛰기(Skip)</button>
                    <button type="button" onClick={() => startWorkspaceBuild(false)} className="bg-[#0099CC] hover:bg-[#0088BB] text-white py-3 px-5 sm:px-6 rounded-xl text-xs sm:text-sm font-bold transition shadow-sm flex items-center space-x-1.5">
                      <LIcon name="check" size={14} /><span>프로젝트 생성 완료</span>
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
