import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MobileTab from '../components/MobileTab';

const PROJECTS = [
  {
    id: 1,
    name: 'AI 회의록 자동화',
    category: '개발',
    createdAt: '2026-06-01',
    status: '진행 중',
    teamLead: '정아름',
    participants: ['정아름', '김민수', '송지영', '김소현', '채하율'],
    myActionItems: [
      { id: 'ai-1', text: 'STT 응답 속도 5초 이하로 최적화', due: '2026.06.18' },
      { id: 'ai-2', text: 'Jira 발행 규칙 QA 시나리오 검증', due: '2026.06.20' },
      { id: 'ai-3', text: '화자 분리 모델 재학습 데이터 정리', due: '2026.06.22' },
    ],
    meetings: [
      {
        id: 'm-101',
        date: '2026.06.16',
        title: '주간 스프린트 회의',
        status: '진행 중',
        type: '정기',
        tags: ['#개발', '#Jira연동'],
        participants: ['정아름', '김민수', '송지영'],
        summary: 'Sprint 12 목표를 정리하고 STT 성능 최적화 일정과 Jira 발행 기준을 확정했습니다.',
        actionItems: 6,
        jiraLinked: 2,
      },
      {
        id: 'm-102',
        date: '2026.06.13',
        title: '요구사항 정제 미팅',
        status: '완료',
        type: '수시',
        tags: ['#기획', '#개발'],
        participants: ['정아름', '김소현', '채하율'],
        summary: '업로드 단계 UX 개선안과 회의록 자동 분류 태그 정책을 합의했습니다.',
        actionItems: 4,
        jiraLinked: 1,
      },
      {
        id: 'm-103',
        date: '2026.06.11',
        title: '배포 리스크 점검',
        status: 'Jira 발행됨',
        type: '정기',
        tags: ['#개발', '#배포'],
        participants: ['정아름', '김민수'],
        summary: '배포 전 체크리스트와 장애 대응 절차를 재정의했습니다.',
        actionItems: 5,
        jiraLinked: 3,
      },
    ],
  },
  {
    id: 2,
    name: '디자인 시스템 구축',
    category: '디자인',
    createdAt: '2026-05-27',
    status: '진행 중',
    teamLead: '박디자이너',
    participants: ['박디자이너', '정아름', '송지영'],
    myActionItems: [
      { id: 'ds-1', text: '컴포넌트 토큰 문서 버전업', due: '2026.06.18' },
      { id: 'ds-2', text: '버튼/폼 공통 스타일 QA', due: '2026.06.21' },
    ],
    meetings: [
      {
        id: 'm-201',
        date: '2026.06.12',
        title: '컴포넌트 토큰 정리',
        status: '완료',
        type: '정기',
        tags: ['#디자인'],
        participants: ['박디자이너', '송지영'],
        summary: '컬러/타이포 토큰 네이밍 규칙을 통일하고 릴리즈 정책을 정했습니다.',
        actionItems: 3,
        jiraLinked: 1,
      },
    ],
  },
  {
    id: 3,
    name: '사용자 인터뷰 분석',
    category: '기타(직접입력)',
    createdAt: '2026-05-19',
    status: '보류',
    teamLead: '김소현',
    participants: ['김소현', '송지영', '채하율', '외부리서처A'],
    myActionItems: [
      { id: 'ux-1', text: 'VOC 태깅 기준 재정의', due: '2026.06.24' },
    ],
    meetings: [
      {
        id: 'm-301',
        date: '2026.06.05',
        title: '인터뷰 질문지 정합성 점검',
        status: '완료',
        type: '정기',
        tags: ['#리서치'],
        participants: ['김소현', '외부리서처A'],
        summary: '질문 플로우 중복 항목을 정리하고 인터뷰 기록 템플릿을 표준화했습니다.',
        actionItems: 2,
        jiraLinked: 0,
      },
      {
        id: 'm-302',
        date: '2026.06.11',
        title: 'VOC 인사이트 공유',
        status: '진행 중',
        type: '수시',
        tags: ['#VOC', '#기획'],
        participants: ['김소현', '송지영', '채하율'],
        summary: '주요 페인포인트 3개를 도출해 우선순위 액션 아이템으로 등록했습니다.',
        actionItems: 4,
        jiraLinked: 1,
      },
    ],
  },
  {
    id: 4,
    name: '분기별 기획안',
    category: '기획',
    createdAt: '2026-06-08',
    status: '완료',
    teamLead: '송지영',
    participants: ['송지영', '김소현', '정아름', '김민수'],
    myActionItems: [
      { id: 'p-1', text: '분기 로드맵 공유안 확정', due: '2026.06.17' },
      { id: 'p-2', text: '기획 QA 체크리스트 배포', due: '2026.06.20' },
    ],
    meetings: [
      {
        id: 'm-401',
        date: '2026.06.15',
        title: 'Q3 로드맵 정리',
        status: '완료',
        type: '정기',
        tags: ['#기획', '#로드맵'],
        participants: ['송지영', '정아름', '김소현'],
        summary: 'Q3 목표와 주요 마일스톤을 확정했습니다.',
        actionItems: 5,
        jiraLinked: 2,
      },
      {
        id: 'm-402',
        date: '2026.06.13',
        title: '백로그 우선순위 재조정',
        status: 'Jira 발행됨',
        type: '수시',
        tags: ['#기획', '#Jira연동'],
        participants: ['송지영', '김민수'],
        summary: '핵심 과제 우선순위를 업데이트하고 Jira 티켓을 재배치했습니다.',
        actionItems: 7,
        jiraLinked: 4,
      },
    ],
  },
];

function statusBadgeClass(status) {
  if (status === '완료') return 'bg-[#E6F4EA] text-[#10B981]';
  if (status === '보류') return 'bg-[#FCE8E6] text-[#EF4444]';
  if (status === 'Jira 발행됨') return 'bg-[#EEF3FF] text-[#0099CC]';
  return 'bg-[#FEF7E0] text-[#F59E0B]';
}

const ROLE_MAP = {
  '정아름': 'PM',
  '김민수': 'Backend',
  '송지영': 'PM',
  '김소현': 'ML Engineer',
  '채하율': 'Frontend',
  '박디자이너': 'Designer',
  '외부리서처A': 'QA',
};

const PARTICIPANT_COLOR_MAP = {
  '정아름': '#0099CC',
  '김민수': '#10B981',
  '송지영': '#7C3AED',
  '김소현': '#F59E0B',
  '채하율': '#0EA5E9',
  '박디자이너': '#EF4444',
  '외부리서처A': '#5A6F8A',
};

export default function ProjectMeetings() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const sortDropdownRef = useRef(null);
  const typeDropdownRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState('home');
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [meetingSearch, setMeetingSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('최신순');
  const [meetingType, setMeetingType] = useState('전체');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) setIsSortOpen(false);
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) setIsTypeOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const stateLabels = {
    IDLE: '대기 중',
    UPLOADING: '업로드 중',
    PROCESSING: 'AI 분석 중',
    COMPLETED: '분석 완료',
    FAILED: '오류 발생',
  };

  const project = useMemo(() => {
    const id = Number(projectId);
    return PROJECTS.find((p) => p.id === id) || PROJECTS[0];
  }, [projectId]);

  useEffect(() => {
    setIsParticipantsOpen(false);
  }, [projectId]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return PROJECTS;
    return PROJECTS.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [projectSearch]);

  const visibleMeetings = useMemo(() => {
    const q = meetingSearch.trim().toLowerCase();

    let result = project.meetings.filter((m) => {
      const typeOk = meetingType === '전체' || m.type === meetingType;
      const searchOk =
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.summary.toLowerCase().includes(q) ||
        m.tags.join(' ').toLowerCase().includes(q);
      return typeOk && searchOk;
    });

    result = result.sort((a, b) => {
      if (sortOrder === '과거순') return a.date.localeCompare(b.date);
      return b.date.localeCompare(a.date);
    });

    return result;
  }, [project, meetingSearch, meetingType, sortOrder]);

  const stats = useMemo(() => {
    const totalMeetings = project.meetings.length;
    const totalActionItems = project.meetings.reduce((sum, m) => sum + m.actionItems, 0);
    const totalJiraLinked = project.meetings.reduce((sum, m) => sum + m.jiraLinked, 0);
    return { totalMeetings, totalActionItems, totalJiraLinked };
  }, [project]);

  const visibleParticipants = project.participants.slice(0, 4);
  const hiddenParticipantsCount = Math.max(project.participants.length - visibleParticipants.length, 0);

  return (
    <div className="min-h-screen bg-[#F8FAFF] overflow-x-hidden pt-20 pb-20 md:pb-0 flex flex-col">
      <Header isMobile={isMobile} phase="IDLE" stateLabels={stateLabels} />

      <main className="flex-1 w-full px-4 md:px-8 py-6 md:py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <button
              type="button"
              onClick={() => navigate('/project-list')}
              className="text-sm text-[#5A6F8A] hover:text-[#0D1B2A]"
            >
              ← 프로젝트 목록
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <aside className="xl:col-span-3 space-y-4">
              <section className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-4">
                <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">프로젝트</h3>
                <input
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="프로젝트 검색"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[rgba(0,100,180,0.12)] bg-[#F8FAFF] focus:outline-none focus:border-[#0099CC]"
                />
                <div
                  className="mt-3 space-y-2 max-h-[220px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {filteredProjects.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(`/project/${item.id}/meetings`)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition ${
                        item.id === project.id
                          ? 'bg-[#EEF3FF] border-[#0099CC]/35 text-[#0099CC] font-semibold'
                          : 'bg-white border-[rgba(0,100,180,0.12)] text-[#0D1B2A] hover:bg-[#F8FAFF]'
                      }`}
                    >
                      <p className="text-sm truncate">{item.name}</p>
                      <p className="text-[11px] mt-0.5 text-[#5A6F8A]">{item.category}</p>
                    </button>
                  ))}
                </div>
              </section>
            </aside>

            <section className="xl:col-span-9 space-y-4">
              <section className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold text-[#0D1B2A]">{project.name}</h1>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusBadgeClass(project.status)}`}>{project.status}</span>
                    </div>
                    <p className="text-sm text-[#5A6F8A] mt-1">생성일 {project.createdAt}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {visibleParticipants.map((name) => (
                          <span
                            key={name}
                            className="w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center border-2 border-white text-white"
                            style={{ backgroundColor: PARTICIPANT_COLOR_MAP[name] || '#0099CC' }}
                            title={name}
                          >
                            {name.slice(0, 1)}
                          </span>
                        ))}
                        {hiddenParticipantsCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setIsParticipantsOpen((prev) => !prev)}
                            className="w-7 h-7 rounded-full bg-slate-400 hover:bg-slate-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white transition-colors"
                          >
                            +{hiddenParticipantsCount}
                          </button>
                        )}
                      </div>

                      <span className="text-xs text-[#5A6F8A]">{project.teamLead}님 외 {Math.max(project.participants.length - 1, 0)}명</span>
                    </div>

                    {isParticipantsOpen && (
                      <div className="mt-3 rounded-xl border border-[rgba(0,100,180,0.12)] bg-[#F8FAFF] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-[#0D1B2A]">회의 참여자</p>
                          <span className="text-xs text-[#5A6F8A]">총 {project.participants.length}명 참여</span>
                        </div>
                        <div className="mt-2 space-y-2">
                          {project.participants.map((member) => (
                            <div
                              key={member}
                              className="flex items-center justify-between rounded-lg bg-white border border-[rgba(0,100,180,0.12)] px-2.5 py-2"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className="w-7 h-7 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: PARTICIPANT_COLOR_MAP[member] || '#0099CC' }}
                                >
                                  {member.slice(0, 1)}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm text-[#0D1B2A] truncate">{member}</p>
                                  <p className="text-xs text-[#5A6F8A]">{ROLE_MAP[member] || 'Team Member'}</p>
                                </div>
                              </div>
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-600">참여 중</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate('/configuration')}
                    className="shrink-0 w-10 h-10 rounded-xl border border-[rgba(0,100,180,0.12)] text-[#5A6F8A] hover:text-[#0099CC] hover:border-[#0099CC]/35 flex items-center justify-center"
                    aria-label="프로젝트 설정 이동"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.82-.33 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.5 1Z" />
                    </svg>
                  </button>
                </div>
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-4">
                  <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">요약</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-[#F8FAFF] border border-[rgba(0,100,180,0.1)] p-3 text-center">
                      <p className="text-[11px] text-[#5A6F8A]">총 회의</p>
                      <p className="text-lg font-bold text-[#0D1B2A]">{stats.totalMeetings}회</p>
                    </div>
                    <div className="rounded-xl bg-[#F8FAFF] border border-[rgba(0,100,180,0.1)] p-3 text-center">
                      <p className="text-[11px] text-[#5A6F8A]">완료 Action</p>
                      <p className="text-lg font-bold text-[#0D1B2A]">{stats.totalActionItems}개</p>
                    </div>
                    <div className="rounded-xl bg-[#F8FAFF] border border-[rgba(0,100,180,0.1)] p-3 text-center">
                      <p className="text-[11px] text-[#5A6F8A]">Jira 연동</p>
                      <p className="text-lg font-bold text-[#0D1B2A]">{stats.totalJiraLinked}개</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-4">
                  <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">내 할 일</h3>
                  <div className="space-y-2">
                    {project.myActionItems.slice(0, 5).map((item) => (
                      <label key={item.id} className="flex items-start gap-2 rounded-xl border border-[rgba(0,100,180,0.1)] bg-[#F8FAFF] p-2.5">
                        <input type="checkbox" className="mt-0.5" />
                        <span className="flex-1 text-sm text-[#0D1B2A]">{item.text}</span>
                        <span className="text-[11px] text-[#5A6F8A]">{item.due}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  <button className="lg:col-span-3 px-4 py-2.5 rounded-xl bg-[#0099CC] text-white font-semibold hover:bg-[#007EA7]">
                    + 새 회의록
                  </button>
                  <input
                    value={meetingSearch}
                    onChange={(e) => setMeetingSearch(e.target.value)}
                    placeholder="회의록 검색"
                    className="lg:col-span-5 px-3.5 py-2.5 text-sm bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl focus:outline-none focus:border-[#0099CC]"
                  />

                  <div className="lg:col-span-2 relative" ref={sortDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsSortOpen((prev) => !prev)}
                      className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition flex items-center justify-between ${
                        isSortOpen
                          ? 'bg-[#EEF3FF] border-[#0099CC]/40 shadow-[0_0_0_3px_rgba(0,153,204,0.12)] text-[#0D1B2A]'
                          : 'bg-[#F8FAFF] border-[rgba(0,100,180,0.12)] text-[#0D1B2A] hover:border-[rgba(0,153,204,0.4)]'
                      }`}
                    >
                      <span className="font-medium">{sortOrder}</span>
                      <span className={`text-xs text-[#5A6F8A] transition-transform ${isSortOpen ? 'rotate-180' : ''}`}>▼</span>
                    </button>

                    {isSortOpen && (
                      <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)]">
                        {['최신순', '과거순'].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setSortOrder(option);
                              setIsSortOpen(false);
                            }}
                            className={`w-full px-3.5 py-2.5 text-sm text-left flex items-center justify-between transition-colors ${
                              sortOrder === option
                                ? 'bg-[#EEF3FF] text-[#0099CC] font-semibold'
                                : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'
                            }`}
                          >
                            <span>{option}</span>
                            {sortOrder === option && <span className="text-[#0099CC]">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-2 relative" ref={typeDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsTypeOpen((prev) => !prev)}
                      className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition flex items-center justify-between ${
                        isTypeOpen
                          ? 'bg-[#EEF3FF] border-[#0099CC]/40 shadow-[0_0_0_3px_rgba(0,153,204,0.12)] text-[#0D1B2A]'
                          : 'bg-[#F8FAFF] border-[rgba(0,100,180,0.12)] text-[#0D1B2A] hover:border-[rgba(0,153,204,0.4)]'
                      }`}
                    >
                      <span className="font-medium">{meetingType}</span>
                      <span className={`text-xs text-[#5A6F8A] transition-transform ${isTypeOpen ? 'rotate-180' : ''}`}>▼</span>
                    </button>

                    {isTypeOpen && (
                      <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)]">
                        {['전체', '정기', '수시'].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setMeetingType(option);
                              setIsTypeOpen(false);
                            }}
                            className={`w-full px-3.5 py-2.5 text-sm text-left flex items-center justify-between transition-colors ${
                              meetingType === option
                                ? 'bg-[#EEF3FF] text-[#0099CC] font-semibold'
                                : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'
                            }`}
                          >
                            <span>{option}</span>
                            {meetingType === option && <span className="text-[#0099CC]">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white overflow-hidden">
                {visibleMeetings.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <p className="text-sm font-semibold text-[#0D1B2A]">아직 생성된 회의록이 없습니다.</p>
                    <p className="text-xs text-[#5A6F8A] mt-1">첫 회의록을 작성해보세요.</p>
                    <button className="mt-4 px-4 py-2 rounded-lg bg-[#0099CC] text-white text-sm font-semibold hover:bg-[#007EA7]">
                      + 새 회의록 작성
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="hidden md:grid grid-cols-12 px-4 py-3 text-xs font-bold text-[#5A6F8A] bg-[#F8FAFF] border-b border-[rgba(0,100,180,0.1)]">
                      <div className="col-span-2">회의 날짜</div>
                      <div className="col-span-3">회의 제목</div>
                      <div className="col-span-2">상태</div>
                      <div className="col-span-3">주요 태그</div>
                      <div className="col-span-2 text-right">관리</div>
                    </div>

                    <div className="hidden md:block">
                      {visibleMeetings.map((meeting) => (
                        <div key={meeting.id} className="grid grid-cols-12 px-4 py-3 items-center border-b border-[rgba(0,100,180,0.08)] last:border-b-0">
                          <div className="col-span-2 text-sm text-[#5A6F8A]">{meeting.date}</div>
                          <button
                            type="button"
                            onClick={() => navigate('/meeting-detail')}
                            className="col-span-3 text-left text-sm font-semibold text-[#0D1B2A] hover:text-[#0099CC]"
                          >
                            {meeting.title}
                          </button>
                          <div className="col-span-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(meeting.status)}`}>
                              {meeting.status}
                            </span>
                          </div>
                          <div className="col-span-3 flex flex-wrap gap-1">
                            {meeting.tags.map((tag) => (
                              <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-[#EEF3FF] text-[#0099CC]">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="col-span-2 flex justify-end gap-2">
                            <button className="text-xs text-[#5A6F8A] hover:text-[#0099CC]">수정</button>
                            <button className="text-xs text-[#5A6F8A] hover:text-[#EF4444]">삭제</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="md:hidden divide-y divide-[rgba(0,100,180,0.08)]">
                      {visibleMeetings.map((meeting) => (
                        <article key={meeting.id} className="p-4 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs text-[#5A6F8A]">{meeting.date}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(meeting.status)}`}>
                              {meeting.status}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => navigate('/meeting-detail')}
                            className="text-left text-sm font-semibold text-[#0D1B2A] leading-snug"
                          >
                            {meeting.title}
                          </button>

                          <div className="flex flex-wrap gap-1">
                            {meeting.tags.map((tag) => (
                              <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-[#EEF3FF] text-[#0099CC]">
                                {tag}
                              </span>
                            ))}
                          </div>

                          <div className="flex justify-end gap-3 pt-1">
                            <button className="text-xs text-[#5A6F8A] hover:text-[#0099CC]">수정</button>
                            <button className="text-xs text-[#5A6F8A] hover:text-[#EF4444]">삭제</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </section>
            </section>
          </div>
        </div>
      </main>

      {!isMobile && <Footer />}
      {isMobile && <MobileTab active={activeTab} onChange={setActiveTab} />}
    </div>
  );
}
