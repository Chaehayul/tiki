import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MobileTab from '../components/MobileTab';

const icons = {
  save: ["M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z", "M17 21v-8H7v8", "M7 3v5h8"],
  checkCircle: ["M22 11.08V12a10 10 0 1 1-5.93-9.14", "M22 4L12 14.01l-3-3"],
  refreshCw: ["M23 4v6h-6", "M1 20v-6h6", "M3.51 9a9 9 0 0 1 14.85-3.36L23 10", "M1 14l4.64 4.36A9 9 0 0 0 20.49 15"],
  info: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 16v-4", "M12 8h.01"],
  zap: ["M13 2L3 14h9l-1 8 10-12h-9l1-8z"],
  alertTriangle: ["M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z", "M12 9v4", "M12 17h.01"],
  arrowLeft: ["M19 12H5", "M12 19l-7-7 7-7"],
  chevronDown: ["M6 9l6 6 6-6"],
  chevronRight: ["M9 18l6-6-6-6"],
  x: ["M18 6L6 18", "M6 6l12 12"],
  check: ["M20 6L9 17l-5-5"],
  users: ["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M23 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  userPlus: ["M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", "M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M20 8v6", "M23 11h-6"],
  sliders: ["M4 21v-7", "M4 10V3", "M12 21v-9", "M12 8V3", "M20 21v-5", "M20 12V3", "M1 14h6", "M9 8h6", "M17 16h6"],
  link2: ["M9 17H7A5 5 0 0 1 7 7h2", "M15 7h2a5 5 0 1 1 0 10h-2", "M8 12h8"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
  trash2: ["M3 6h18", "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6", "M10 11v6", "M14 11v6", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"],
  folder: ["M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"],
  plus: ["M12 5v14", "M5 12h14"],
};

function IIcon({ name, size = 16, className = "", color = "currentColor", sw = 2 }) {
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
      className={className}
    >
      {paths.map((d, idx) => (
        <path key={idx} d={d} />
      ))}
    </svg>
  );
}

const categoryMeta = {
  '개발': { color: '#EEF3FF', labelColor: '#0099CC' },
  '디자인': { color: '#F3E8FF', labelColor: '#7C3AED' },
  '기획': { color: '#E6F4EA', labelColor: '#10B981' },
  '마케팅': { color: '#FCE8E6', labelColor: '#EF4444' },
  '기타': { color: '#FEF7E0', labelColor: '#F59E0B' },
};

const avatarPalette = ['bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-indigo-500'];

const PROJECT_OVERRIDE_STORAGE_KEY = 'tiki_project_overrides';

const MEMBER_DIRECTORY = [
  { name: '정아름', email: 'areum.jung@tiki.ai', role: 'PM' },
  { name: '김민수', email: 'minsu.kim@tiki.ai', role: 'Backend' },
  { name: '송지영', email: 'jiyoung.song@tiki.ai', role: 'PM' },
  { name: '김소현', email: 'sohyun.kim@tiki.ai', role: 'ML Engineer' },
  { name: '채하율', email: 'hayul.chae@tiki.ai', role: 'Frontend' },
  { name: '박디자이너', email: 'designer.park@tiki.ai', role: 'Designer' },
  { name: '외부리서처A', email: 'researcher.a@external.com', role: 'QA' },
  { name: '정다은', email: 'daeun.jung@tiki.ai', role: 'QA' },
  { name: '한유진', email: 'yujin.han@tiki.ai', role: 'Designer' },
];

const TOAST_COLORS = {
  info: '#0099CC',
  ai: '#7C3AED',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

const TOAST_VARIANTS = {
  info: { background: '#0D1B2A', text: '#FFFFFF', icon: TOAST_COLORS.info, border: 'rgba(255,255,255,0.12)' },
  ai: { background: '#0D1B2A', text: '#FFFFFF', icon: TOAST_COLORS.ai, border: 'rgba(255,255,255,0.12)' },
  success: { background: '#0D1B2A', text: '#FFFFFF', icon: TOAST_COLORS.success, border: 'rgba(255,255,255,0.12)' },
  warning: { background: '#0D1B2A', text: '#FFFFFF', icon: TOAST_COLORS.warning, border: 'rgba(255,255,255,0.12)' },
  error: { background: '#0D1B2A', text: '#FFFFFF', icon: TOAST_COLORS.error, border: 'rgba(255,255,255,0.12)' },
};

const readProjectOverrides = () => {
  try {
    const raw = localStorage.getItem(PROJECT_OVERRIDE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
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

const avatarColor = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash += name.charCodeAt(i);
  return avatarPalette[hash % avatarPalette.length];
};

function StatusBadge({ status }) {
  const map = {
    connected: { label: '연결됨', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
    testing: { label: '테스트 중', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
    disconnected: { label: '연결 안됨', dot: 'bg-slate-400', text: 'text-slate-500', bg: 'bg-slate-100' },
  };
  const s = map[status] || map.disconnected;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${status === 'testing' ? 'animate-pulse' : ''}`} />
      {s.label}
    </span>
  );
}

const Configuration = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedProject = location.state?.project;

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState('settings');
  const [settingsTab, setSettingsTab] = useState('basic');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const categoryOptions = ['개발', '디자인', '기획', '마케팅', '기타'];

  const normalizeCategory = (category) => {
    if (!category) return '기획';
    if (category === '기타(직접입력)') return '기타';
    return categoryOptions.includes(category) ? category : '기타';
  };

  const getInitialCustomCategory = (category) => {
    if (!category) return '';
    if (categoryOptions.includes(category) || category === '기타(직접입력)') return '';
    return category;
  };

  const buildInitialState = (project) => ({
    projectName: project?.name || '',
    projectCategory: normalizeCategory(project?.category),
    projectCategoryCustom: getInitialCustomCategory(project?.category),
    participants: Array.isArray(project?.participants) ? project.participants : [],
    jiraDomain: '',
    jiraEmail: '',
    jiraToken: '',
    notionDbId: '',
    notionToken: '',
    dueDate: 'YYYY-MM-DD',
    autoAssign: '',
    filterChat: true,
    customRules: ''
  });

  const [formData, setFormData] = useState(() => buildInitialState(selectedProject));
  const [status, setStatus] = useState({ jira: 'disconnected', notion: 'disconnected' });
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const toastTimerRef = useRef(null);
  const [guideModal, setGuideModal] = useState(null);
  const [showGuideDetails, setShowGuideDetails] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [adminNames, setAdminNames] = useState([]);
  const currentToastVariant = TOAST_VARIANTS[toast.type] || TOAST_VARIANTS.info;

  const buildInitialAdminNames = (project, participants) => {
    const fromProject = Array.isArray(project?.admins)
      ? project.admins.filter((name) => participants.includes(name))
      : [];

    if (fromProject.length > 0) {
      return [...new Set(fromProject)];
    }

    if (project?.teamLead && participants.includes(project.teamLead)) {
      return [project.teamLead];
    }

    return participants[0] ? [participants[0]] : [];
  };

  useEffect(() => {
    setFormData(buildInitialState(selectedProject));
    setInviteQuery('');
    const initialParticipants = Array.isArray(selectedProject?.participants) ? selectedProject.participants : [];
    setAdminNames(buildInitialAdminNames(selectedProject, initialParticipants));
  }, [selectedProject]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const updateField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const jiraReady =
    formData.jiraDomain.trim() &&
    isValidEmail(formData.jiraEmail.trim()) &&
    formData.jiraToken.trim();
  const notionReady = formData.notionDbId.trim() && formData.notionToken.trim();

  const testConnection = (tool) => {
    const canTest = tool === 'jira' ? jiraReady : notionReady;
    if (!canTest) return;

    setStatus(prev => ({ ...prev, [tool]: 'testing' }));
    setTimeout(() => setStatus(prev => ({ ...prev, [tool]: 'connected' })), 1500);
  };

  const handleReset = () => {
    const resetState = buildInitialState(selectedProject);
    setFormData(resetState);
    setInviteQuery('');
    setAdminNames(buildInitialAdminNames(selectedProject, resetState.participants));
    setShowConfirmModal(false);
    showToast('설정이 초기화되었습니다.', 'success');
  };

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast({ message: '', type: 'info' }), 2200);
  };

  const matchedMembers = useMemo(() => {
    const q = inviteQuery.trim().toLowerCase();
    if (!q) return [];
    return MEMBER_DIRECTORY
      .filter((member) => (
        member.email.toLowerCase().includes(q)
        || member.name.toLowerCase().includes(q)
      ))
      .slice(0, 6);
  }, [inviteQuery]);

  const inviteMember = (member) => {
    if (!member) return;

    setFormData((prev) => {
      const exists = prev.participants.includes(member.name);
      if (exists) return prev;
      return { ...prev, participants: [...prev.participants, member.name] };
    });

    if (adminNames.length === 0) {
      setAdminNames([member.name]);
    }

    setInviteQuery('');
    showToast(`초대 메일 발송 완료: ${member.name} (${member.email})`, 'success');
  };

  const removeParticipant = (name) => {
    if (adminNames.includes(name)) return;
    setFormData((prev) => ({
      ...prev,
      participants: prev.participants.filter((item) => item !== name),
    }));
  };

  const toggleAdminRole = (memberName) => {
    if (!formData.participants.includes(memberName)) return;

    setAdminNames((prev) => {
      if (prev.includes(memberName)) {
        if (prev.length <= 1) return prev;
        return prev.filter((item) => item !== memberName);
      }
      return [...prev, memberName];
    });
  };

  const openGuideModal = (type) => {
    setGuideModal(type);
    setShowGuideDetails(false);
  };

  const handleSaveSettings = () => {
    if (!selectedProject?.id) {
      showToast('프로젝트 정보를 찾을 수 없어 저장할 수 없습니다.', 'error');
      return;
    }

    const participants = [...new Set(formData.participants.map((name) => name.trim()).filter(Boolean))];
    const resolvedAdmins = adminNames.filter((name) => participants.includes(name));
    if (resolvedAdmins.length === 0 && participants[0]) {
      resolvedAdmins.push(participants[0]);
    }

    const category = formData.projectCategory === '기타'
      ? (formData.projectCategoryCustom.trim() || '기타(직접입력)')
      : formData.projectCategory;

    const nextProject = {
      ...selectedProject,
      name: formData.projectName.trim() || selectedProject.name,
      category,
      participants,
      admins: resolvedAdmins,
      teamLead: resolvedAdmins[0] || selectedProject.teamLead || participants[0] || '담당자',
    };

    writeProjectOverride(selectedProject.id, nextProject);
    showToast('설정이 저장되었습니다.', 'success');
  };

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    if (selectedProject?.id) {
      navigate(`/project/${selectedProject.id}/meetings`, { state: { project: selectedProject } });
      return;
    }
    navigate('/project-list');
  };

  const previewPrompt = `[팀 컨벤션 시스템 프롬프트]\n- 기한 포맷: ${formData.dueDate}\n- 자동 배정: ${formData.autoAssign || '미설정'}\n- 잡담 필터링: ${formData.filterChat ? '활성화' : '불가'}\n- 규칙: ${formData.customRules || '없음'}`;

  const stateLabels = {
    IDLE: '대기 중',
    UPLOADING: '업로드 중',
    PROCESSING: 'AI 분석 중',
    COMPLETED: '분석 완료',
    FAILED: '오류 발생',
  };

  const settingsTabs = [
    { id: 'basic', title: '기본정보 수정', icon: 'sliders' },
    { id: 'members', title: '인원관리', icon: 'users' },
    { id: 'integration', title: '연동하기', icon: 'link2' },
  ];

  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100";
  const labelClass = "mb-1.5 block text-xs font-semibold text-slate-500";
  const cardClass = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7";

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden pt-20 pb-20 md:pb-0 font-sans text-slate-900 flex flex-col">
      <Header isMobile={isMobile} phase="IDLE" stateLabels={stateLabels} />

      <main className="flex-1 w-full px-4 md:px-8 py-6 md:py-8">
        <div className="max-w-6xl mx-auto w-full">

          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
          >
            <IIcon name="arrowLeft" size={15} /> 프로젝트 목록
          </button>

          <div className="mt-5 mb-7 md:mt-6 md:mb-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  프로젝트 설정{selectedProject?.name ? ` · ${selectedProject.name}` : ''}
                </h1>
                {selectedProject && (
                  <p className="mt-1.5 text-sm text-slate-500">현재 프로젝트 설정을 수정 중입니다.</p>
                )}
              </div>
            </div>

            {!selectedProject && (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-amber-800">프로젝트 정보 없이 열렸습니다. 프로젝트 목록 또는 프로젝트 상세에서 진입하면 해당 프로젝트를 수정할 수 있습니다.</p>
                <button
                  type="button"
                  onClick={() => navigate('/project-list')}
                  className="shrink-0 self-start rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600 sm:self-auto"
                >
                  프로젝트 목록으로 이동
                </button>
              </div>
            )}
          </div>

          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {settingsTabs.map((tab) => {
              const selected = settingsTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSettingsTab(tab.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    selected ? 'bg-sky-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <IIcon name={tab.icon} size={15} />
                  {tab.title}
                </button>
              );
            })}
          </div>

          <div className="mt-3 md:mt-4 lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
            <aside className="hidden lg:col-span-3 lg:block">
              <div className="sticky top-24 space-y-1">
                <p className="px-3.5 pb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">설정 메뉴</p>
                {settingsTabs.map((tab) => {
                  const selected = settingsTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSettingsTab(tab.id)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition-colors ${
                        selected ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-100/70'
                      }`}
                    >
                      <IIcon name={tab.icon} size={17} className={selected ? 'text-sky-600' : 'text-slate-400'} />
                      {tab.title}
                      {selected && <IIcon name="chevronRight" size={14} className="ml-auto text-sky-400" />}
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="lg:col-span-9 space-y-5">

              {settingsTab === 'basic' && (
                <div className={cardClass}>
                  <div className="border-b border-slate-100 pb-5">
                    <h2 className="text-lg font-bold text-slate-900">프로젝트 기본정보 수정</h2>
                    <p className="mt-1 text-sm text-slate-500">프로젝트 이름과 카테고리를 수정할 수 있습니다.</p>
                  </div>

                  <div className="mt-6 space-y-6">
                    <div>
                      <label className={labelClass}>프로젝트 이름</label>
                      <input
                        type="text"
                        value={formData.projectName}
                        placeholder="프로젝트 이름을 입력하세요"
                        className={inputClass}
                        onChange={(e) => updateField('projectName', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>프로젝트 카테고리 선택</label>
                      <div className="flex flex-wrap gap-2">
                        {categoryOptions.map((option) => {
                          const selected = formData.projectCategory === option;
                          const meta = categoryMeta[option];
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => {
                                updateField('projectCategory', option);
                                if (option !== '기타') {
                                  updateField('projectCategoryCustom', '');
                                }
                              }}
                              className="rounded-full border px-3 py-1.5 text-sm font-semibold transition-all hover:brightness-[0.99]"
                              style={selected
                                ? {
                                  backgroundColor: meta.color,
                                  color: meta.labelColor,
                                  borderColor: meta.labelColor,
                                  boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
                                }
                                : {
                                  backgroundColor: meta.color,
                                  color: meta.labelColor,
                                  borderColor: `${meta.labelColor}55`,
                                  opacity: 0.82,
                                }}
                            >
                              <span className="inline-flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.labelColor }} />
                                {option}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {formData.projectCategory === '기타' && (
                      <div>
                        <label className={labelClass}>기타 분야 직접 입력</label>
                        <input
                          type="text"
                          value={formData.projectCategoryCustom}
                          placeholder="예: 리서치, 운영혁신, 고객성공"
                          className={inputClass}
                          onChange={(e) => updateField('projectCategoryCustom', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {settingsTab === 'members' && (
                <div className={cardClass}>
                  <div className="border-b border-slate-100 pb-5">
                    <h2 className="text-lg font-bold text-slate-900">인원 관리</h2>
                    <p className="mt-1 text-sm text-slate-500">인원을 추가/삭제하고, 관리자 권한을 여러 명에게 부여할 수 있습니다.</p>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-2.5 rounded-xl bg-slate-50 px-4 py-3.5">
                    <span className="text-xs font-semibold text-slate-500">현재 관리자</span>
                    {adminNames.length === 0 ? (
                      <span className="text-xs font-medium text-slate-400">미지정</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {adminNames.map((name) => (
                          <span key={name} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-sky-700 shadow-sm">
                            <IIcon name="shield" size={11} />
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="text-xs text-slate-400">팀장은 기본 관리자이며, 여러 명에게 권한을 부여할 수 있습니다.</span>
                  </div>

                  <div className="mt-6">
                    <label className={labelClass}>참여 인원 초대 (이메일 검색)</label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative flex-1">
                        <IIcon name="userPlus" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="email"
                          value={inviteQuery}
                          placeholder="이메일 또는 이름 입력"
                          className={`${inputClass} pl-10`}
                          onChange={(e) => setInviteQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && matchedMembers.length > 0) {
                              e.preventDefault();
                              inviteMember(matchedMembers[0]);
                            }
                          }}
                        />
                        {inviteQuery.trim() && (
                          <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                            {matchedMembers.length === 0 ? (
                              <p className="px-3.5 py-3 text-xs text-slate-400">일치하는 사용자가 없습니다.</p>
                            ) : (
                              matchedMembers.map((member) => (
                                <button
                                  key={member.email}
                                  type="button"
                                  onClick={() => inviteMember(member)}
                                  className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3.5 py-2.5 text-left last:border-b-0 hover:bg-sky-50"
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 truncate">{member.name}</p>
                                    <p className="text-xs text-slate-400 truncate">{member.email}</p>
                                  </div>
                                  <span className="text-[11px] font-semibold text-sky-600 shrink-0">초대</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (matchedMembers.length > 0) inviteMember(matchedMembers[0]);
                        }}
                        disabled={matchedMembers.length === 0}
                        className={`shrink-0 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-colors ${
                          matchedMembers.length > 0
                            ? 'bg-sky-600 hover:bg-sky-700'
                            : 'bg-slate-300 cursor-not-allowed'
                        }`}
                      >
                        초대 발송
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">목록에서 사용자를 선택하면 초대 메일 발송 후 참여 인원에 이름으로 추가됩니다.</p>
                  </div>

                  <div className="mt-6">
                    <p className="mb-2 text-xs font-semibold text-slate-500">참여 인원 ({formData.participants.length})</p>

                    {formData.participants.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 px-4 py-10 text-center">
                        <IIcon name="users" size={22} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm text-slate-400">등록된 참여 인원이 없습니다.</p>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <div className="divide-y divide-slate-100">
                          {formData.participants.map((name) => {
                            const isAdmin = adminNames.includes(name);
                            return (
                              <div key={name} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(name)}`}>
                                    {name.slice(0, 1)}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-semibold text-slate-800">{name}</p>
                                    {isAdmin && <span className="text-[11px] font-bold text-sky-600">관리자</span>}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleAdminRole(name)}
                                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                      isAdmin
                                        ? 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    {isAdmin ? '권한해제' : '권한부여'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeParticipant(name)}
                                    disabled={isAdmin}
                                    title="삭제"
                                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                                      isAdmin ? 'cursor-not-allowed text-slate-200' : 'text-slate-400 hover:bg-red-50 hover:text-red-500'
                                    }`}
                                  >
                                    <IIcon name="trash2" size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <p className="mt-2 text-xs text-slate-400">관리자는 삭제할 수 없습니다. 관리자 해제 후 삭제하세요. 최소 1명 이상의 관리자는 유지됩니다.</p>
                  </div>
                </div>
              )}

              {settingsTab === 'integration' && (
                <div className="space-y-5">
                  <div className={cardClass}>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                      <h2 className="text-base font-bold text-slate-900">Jira 연동</h2>
                      <StatusBadge status={status.jira} />
                    </div>

                    <div className="mt-5 space-y-4">
                      <div>
                        <label className={labelClass}>Jira 도메인</label>
                        <input
                          type="text"
                          value={formData.jiraDomain}
                          placeholder="company.atlassian.net"
                          className={inputClass}
                          onChange={(e) => updateField('jiraDomain', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>관리자 이메일</label>
                        <input
                          type="email"
                          value={formData.jiraEmail}
                          placeholder="admin@company.com"
                          className={inputClass}
                          onChange={(e) => updateField('jiraEmail', e.target.value)}
                        />
                        {formData.jiraEmail.trim() && !isValidEmail(formData.jiraEmail.trim()) && (
                          <p className="mt-1.5 text-xs text-red-500">이메일 형식이 올바르지 않습니다.</p>
                        )}
                      </div>

                      <div>
                        <label className={labelClass}>API 토큰</label>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={formData.jiraToken}
                            placeholder="Jira API Token"
                            className={`${inputClass} flex-1`}
                            onChange={(e) => updateField('jiraToken', e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => openGuideModal('jira')}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-600"
                            aria-label="Jira API 토큰 발급 가이드"
                          >
                            <IIcon name="info" size={19} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => testConnection('jira')}
                      disabled={!jiraReady}
                      className={`mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                        jiraReady ? 'bg-sky-600 text-white hover:bg-sky-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      연결 테스트
                    </button>
                  </div>

                  <div className={cardClass}>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                      <h2 className="text-base font-bold text-slate-900">Notion 연동</h2>
                      <StatusBadge status={status.notion} />
                    </div>

                    <div className="mt-5 space-y-4">
                      <div>
                        <label className={labelClass}>데이터베이스 ID</label>
                        <input
                          type="text"
                          value={formData.notionDbId}
                          placeholder="32자리 데이터베이스 ID"
                          className={inputClass}
                          onChange={(e) => updateField('notionDbId', e.target.value)}
                        />
                        <p className="mt-1.5 text-xs text-slate-400">데이터베이스 URL 끝부분에서 ID를 확인할 수 있습니다.</p>
                      </div>

                      <div>
                        <label className={labelClass}>Integration Token</label>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={formData.notionToken}
                            placeholder="secret_..."
                            className={`${inputClass} flex-1`}
                            onChange={(e) => updateField('notionToken', e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => openGuideModal('notion')}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-600"
                            aria-label="Notion 통합 설정 가이드"
                          >
                            <IIcon name="info" size={19} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => testConnection('notion')}
                      disabled={!notionReady}
                      className={`mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                        notionReady ? 'bg-sky-600 text-white hover:bg-sky-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      연결 테스트
                    </button>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-sky-100 bg-sky-50/60 p-6 sm:p-7">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-sky-700">
                      <IIcon name="zap" size={16} /> 자동화 규칙 설명
                    </h3>
                    <p className="text-sm text-slate-600">
                      연동된 데이터를 바탕으로 회의 분석 결과를 이슈 등록 형식에 맞게 변환합니다. 마감일 포맷, 담당자 자동 배정, 커스텀 규칙이 적용됩니다.
                    </p>
                    <ul className="space-y-1.5 text-sm text-slate-600">
                      <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-sky-400" />기본 마감일 포맷: {formData.dueDate}</li>
                      <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-sky-400" />자동 배정 정책: {formData.autoAssign || '미설정(수동 배정)'}</li>
                      <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-sky-400" />잡담 필터링: {formData.filterChat ? '활성화' : '비활성화'}</li>
                    </ul>
                    <div className="rounded-xl border border-sky-100 bg-white p-4">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-sky-600">시스템 프롬프트 프리뷰</p>
                      <pre className="whitespace-pre-wrap text-sm text-slate-600">{previewPrompt}</pre>
                    </div>
                  </div>
                </div>
              )}

            </section>
          </div>
        </div>
      </main>

      <div className="fixed bottom-[4.6rem] right-4 z-40 max-w-[calc(100%-2rem)] md:bottom-6 md:right-6">
        <div className="mx-auto flex items-center justify-end gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-[0_14px_36px_-18px_rgba(15,23,42,0.25)] backdrop-blur-[8px]">
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={handleSaveSettings}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(14,165,233,0.7)] transition-all hover:brightness-105"
          >
            <IIcon name="save" size={17} /> 저장
          </button>
        </div>
      </div>

      {guideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {guideModal === 'jira' ? 'Jira API 토큰 발급 가이드' : 'Notion 통합 설정 가이드'}
              </h3>
              <button onClick={() => setGuideModal(null)} className="text-slate-400 hover:text-slate-700">
                <IIcon name="x" size={18} />
              </button>
            </div>

            {guideModal === 'jira' ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  공식 경로: https://id.atlassian.com/manage-profile/security/api-tokens
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-sky-600">발급 단계</p>
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
                    <li>API tokens 페이지에서 Create API token 클릭</li>
                    <li>토큰 이름 입력 후 Create</li>
                    <li>Copy를 눌러 토큰 저장 후 이 화면에 붙여넣기</li>
                  </ol>
                </div>

                {showGuideDetails && (
                  <>
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-sky-600">사전 준비</p>
                      <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                        <li>Jira 사이트 도메인 (예: company.atlassian.net)</li>
                        <li>Atlassian 관리자 또는 Jira 접근 권한 이메일</li>
                        <li>브라우저에서 2FA 또는 보안 인증 완료된 계정 세션</li>
                      </ul>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-2 text-xs font-semibold text-sky-600">연동 체크리스트</p>
                      <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                        <li>도메인에는 프로토콜 없이 company.atlassian.net만 입력</li>
                        <li>이메일은 Atlassian 계정 이메일과 동일해야 함</li>
                        <li>실패 시 새 API 토큰을 발급해 재시도</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  공식 경로: https://www.notion.so/my-integrations
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-sky-600">설정 단계</p>
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
                    <li>My integrations에서 New integration 생성</li>
                    <li>Internal Integration Token 복사</li>
                    <li>연동 대상 데이터베이스 페이지의 Connections에 통합 추가</li>
                    <li>데이터베이스 URL의 ID 입력 후 연결 테스트 실행</li>
                  </ol>
                </div>

                {showGuideDetails && (
                  <>
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-sky-600">사전 준비</p>
                      <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                        <li>연동할 Notion 데이터베이스 페이지 접근 권한</li>
                        <li>워크스페이스에서 통합 생성 권한</li>
                      </ul>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-2 text-xs font-semibold text-sky-600">자주 놓치는 항목</p>
                      <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                        <li>통합 생성 후 데이터베이스와 공유하지 않으면 조회 실패</li>
                        <li>Database ID에 쿼리 문자열 포함 시 실패 가능</li>
                        <li>Token 앞뒤 공백 포함 여부 확인</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
              <button
                onClick={() => setShowGuideDetails((prev) => !prev)}
                className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-semibold text-sky-600 transition-colors hover:bg-sky-50"
              >
                {showGuideDetails ? '간단히 보기' : '자세히 보기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-[rgba(0,100,180,0.12)] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3 text-red-500">
              <IIcon name="alertTriangle" size={24} />
              <h3 className="text-lg font-bold">설정 초기화</h3>
            </div>
            <p className="mb-6 text-sm text-slate-500">모든 설정값이 기본값으로 되돌아갑니다. 이 작업은 되돌릴 수 없습니다. 진행하시겠습니까?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConfirmModal(false)} className="rounded-lg px-4 py-2 text-slate-500 hover:bg-slate-100">취소</button>
              <button onClick={handleReset} className="rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600">초기화</button>
            </div>
          </div>
        </div>
      )}

      {toast.message && (
        <div
          className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-50 px-4 w-full sm:w-auto"
          style={{
            bottom: isMobile ? 'calc(env(safe-area-inset-bottom) + 9.5rem)' : '1.5rem',
          }}
        >
          <div
            className="relative text-xs sm:text-sm font-semibold py-3.5 px-5 rounded-2xl shadow-xl border flex items-center gap-2 w-full sm:w-auto sm:min-w-[260px]"
            style={{
              backgroundColor: currentToastVariant.background,
              color: currentToastVariant.text,
              borderColor: currentToastVariant.border,
            }}
          >
            {toast.type === 'success' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" fill={TOAST_COLORS.success} />
                <path d="M16.7 9.2 10.6 15.3 7.2 11.9" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <IIcon
                name={toast.type === 'error' ? 'x' : toast.type === 'warning' ? 'alertTriangle' : 'info'}
                size={16}
                color={currentToastVariant.icon}
              />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {!isMobile && <Footer />}
      {isMobile && <MobileTab active={activeTab} onChange={setActiveTab} />}
    </div>
  );
};

export default Configuration;