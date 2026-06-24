import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MobileTab from '../components/MobileTab';

const iconPaths = {
  plus: ['M12 5v14', 'M5 12h14'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    'M22 21v-2a4 4 0 0 0-3-3.87',
  ],
  chevronDown: ['M6 9l6 6 6-6'],
  check: ['M20 6L9 17l-5-5'],
  moreVertical: ['M12 5h.01', 'M12 12h.01', 'M12 19h.01'],
  clock: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20', 'M12 6v6l4 2'],
  folder: ['M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'],
  search: ['M21 21l-4.35-4.35', 'M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0'],
};

// 프로젝트별 회의 요약 더미 텍스트
const PROJECT_SUMMARY = {
  1: 'AI 기반 회의록 자동 생성 파이프라인 설계 및 STT 모델 선정 검토 진행 중',
  2: '공통 컴포넌트 토큰 체계 정립 및 Figma 변수 연동 방안 논의 완료',
  3: '사용자 인터뷰 VOC 패턴 분석 후 핵심 페인포인트 3가지 도출 예정',
  4: 'Q3 신규 기능 로드맵 초안 작성 및 이해관계자 우선순위 합의 진행',
  5: '배치 작업 장애 원인 분석 완료, 자동화 아키텍처 개선안 리뷰 예정',
  6: '신규 유입 온보딩 시나리오 점검 및 단계별 이탈 원인 분석 중',
  7: '채널별 캠페인 퍼포먼스 데이터 취합 후 액션 아이템 우선순위 정렬',
  8: '사내 문서 템플릿 통합 기준 수립 및 부서별 적용 범위 협의 완료',
  9: '백로그 항목 재정리 및 스프린트 우선순위 기준 팀 내 정합성 확보',
  10: '핵심 KPI 후보군 정의 후 데이터 수집 가능 여부 검토 단계 진입',
  11: '온보딩 퍼널 단계별 이탈률 분석 및 가설 기반 개선안 도출 중',
};

const PROJECTS = [
  { id: 1, name: 'AI 회의록 자동화', category: '개발', members: 5, createdAt: '2026-06-01', teamLead: '정아름', updatedAt: '2시간 전', participants: ['정아름', '김민수', '송지영', '김소현', '채하율'], meetings: [{ id: 'm-101', title: '주간 스프린트 회의', date: '2026-06-10', round: '1회차' }, { id: 'm-102', title: '요구사항 정제 미팅', date: '2026-06-13', round: '2회차' }] },
  { id: 2, name: '디자인 시스템 구축', category: '디자인', members: 3, createdAt: '2026-05-27', teamLead: '박디자이너', updatedAt: '어제', participants: ['박디자이너', '정아름', '송지영'], meetings: [{ id: 'm-201', title: '컴포넌트 토큰 정리', date: '2026-06-09', round: '1회차' }] },
  { id: 3, name: '사용자 인터뷰 분석', category: '기타', members: 7, createdAt: '2026-05-19', teamLead: '김소현', updatedAt: '3일 전', participants: ['김소현', '송지영', '채하율', '외부리서처A'], meetings: [{ id: 'm-301', title: '인터뷰 질문지 점검', date: '2026-06-05', round: '1회차' }, { id: 'm-302', title: 'VOC 인사이트 공유', date: '2026-06-11', round: '2회차' }, { id: 'm-303', title: '후속 액션 플래닝', date: '2026-06-14', round: '3회차' }] },
  { id: 4, name: '분기별 기획안', category: '기획', members: 4, createdAt: '2026-06-08', teamLead: '송지영', updatedAt: '1시간 전', participants: ['송지영', '김소현', '정아름', '김민수'], meetings: [{ id: 'm-401', title: 'Q3 로드맵 정리', date: '2026-06-15', round: '1회차' }] },
  { id: 5, name: '운영 자동화 개선', category: '개발', members: 6, createdAt: '2026-04-23', teamLead: '김민수', updatedAt: '5시간 전', participants: ['김민수', '채하율', '정아름'], meetings: [{ id: 'm-501', title: '배치 작업 장애 복기', date: '2026-06-08', round: '1회차' }, { id: 'm-502', title: '자동화 아키텍처 리뷰', date: '2026-06-12', round: '2회차' }] },
  { id: 6, name: '온보딩 가이드 리뉴얼', category: '기획', members: 2, createdAt: '2026-05-03', teamLead: '김소현', updatedAt: '이번 주', participants: ['김소현', '박디자이너'], meetings: [{ id: 'm-601', title: '신규 유입 시나리오 점검', date: '2026-06-07', round: '1회차' }] },
  { id: 7, name: '캠페인 퍼널 분석', category: '마케팅', members: 4, createdAt: '2026-05-15', teamLead: '마케터A', updatedAt: '어제', participants: ['마케터A', '김소현', '채하율'], meetings: [{ id: 'm-701', title: '캠페인 성과 리뷰', date: '2026-06-10', round: '1회차' }, { id: 'm-702', title: '채널별 액션 아이템', date: '2026-06-13', round: '2회차' }] },
  { id: 8, name: '문서 표준화 태스크', category: '기타', members: 3, createdAt: '2026-04-30', teamLead: '송지영', updatedAt: '3일 전', participants: ['송지영', '정아름', '김소현'], meetings: [{ id: 'm-801', title: '문서 템플릿 통합', date: '2026-06-06', round: '1회차' }] },
  { id: 9, name: '신규 기능 우선순위 정렬', category: '기획', members: 5, createdAt: '2026-05-21', teamLead: '정아름', updatedAt: '어제', participants: ['정아름', '김소현', '송지영', '김민수', '채하율'], meetings: [{ id: 'm-901', title: '우선순위 기준 정합', date: '2026-06-11', round: '1회차' }, { id: 'm-902', title: '백로그 재정리', date: '2026-06-14', round: '2회차' }] },
  { id: 10, name: '프로덕트 KPI 재정의', category: '기획', members: 4, createdAt: '2026-05-12', teamLead: '김소현', updatedAt: '3일 전', participants: ['김소현', '정아름', '박디자이너', '송지영'], meetings: [{ id: 'm-1001', title: '핵심 KPI 후보 정의', date: '2026-06-09', round: '1회차' }] },
  { id: 11, name: '온보딩 퍼널 개선안', category: '기획', members: 6, createdAt: '2026-05-30', teamLead: '송지영', updatedAt: '이번 주', participants: ['송지영', '김소현', '정아름', '김민수', '채하율', '박디자이너'], meetings: [{ id: 'm-1101', title: '퍼널 단계별 이탈 분석', date: '2026-06-08', round: '1회차' }, { id: 'm-1102', title: '가설 기반 개선안 리뷰', date: '2026-06-12', round: '2회차' }] },
];

const stateLabels = {
  IDLE: '대기 중',
  UPLOADING: '업로드 중',
  PROCESSING: 'AI 분석 중',
  COMPLETED: '분석 완료',
  FAILED: '오류 발생',
};

const SORT_OPTIONS = ['최신순', '이름순', '인원 많은순'];

function PIcon({ name, size = 18, className = '' }) {
  const paths = iconPaths[name];
  if (!paths) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

function getTimeRank(value) {
  const order = { '1시간 전': 6, '2시간 전': 5, '5시간 전': 4, 어제: 3, '3일 전': 2, '이번 주': 1 };
  return order[value] || 0;
}

function parseCurrentUser() {
  try {
    const raw = localStorage.getItem('tiki_user');
    if (!raw) return { name: '', email: '' };
    const user = JSON.parse(raw);
    return {
      name: typeof user?.name === 'string' ? user.name.trim() : '',
      email: typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '',
    };
  } catch {
    return { name: '', email: '' };
  }
}

function ProjectCard({ project, onOpen, onOpenConfig, openMenuProjectId, setOpenMenuProjectId }) {
  const summary = PROJECT_SUMMARY[project.id] || '최근 회의 내용을 요약하고 있어요.';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(project)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(project); }}
      className="group flex w-full cursor-pointer flex-col rounded-2xl border border-[rgba(0,0,0,0.07)] bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(0,153,204,0.25)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.09)]"
    >
      <div className="flex flex-1 flex-col p-4">

        {/* 상단: 프로젝트 이름 + ⋮ 메뉴 한 줄 */}
        <div className="mb-2.5 flex items-start justify-between gap-2" data-project-menu-root="true">
          <h3 className="flex-1 text-[13.5px] font-bold leading-[1.5] text-[#0D1B2A] line-clamp-1">
            {project.name}
          </h3>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuProjectId((prev) => (prev === project.id ? null : project.id));
              }}
              className="-mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[#B0BFCC] transition-all hover:bg-[#F1F4F8] hover:text-[#5A6F8A]"
              aria-label="프로젝트 메뉴"
            >
              <PIcon name="moreVertical" size={14} />
            </button>

            {openMenuProjectId === project.id && (
              <div className="absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.13)]">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setOpenMenuProjectId(null); onOpenConfig(project); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-[#0D1B2A] transition-colors hover:bg-[#F5F7FB]"
                >
                  설정 페이지
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setOpenMenuProjectId(null); onOpen(project); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-[#0D1B2A] transition-colors hover:bg-[#F5F7FB]"
                >
                  회의 목록
                </button>
              </div>
            )}
          </div>
        </div>
        {/* 회의 요약 1줄 */}
        <p className="flex-1 text-[12px] leading-[1.6] text-[#7A8FA6] line-clamp-1">
          {summary}
        </p>

        {/* 하단: 참여 인원 + 업데이트 시간 */}
        <div className="mt-3 flex items-center justify-between border-t border-[rgba(0,0,0,0.05)] pt-3 text-[11.5px] text-[#A0AFBF]">
          <span className="flex items-center gap-1">
            <PIcon name="users" size={12} />
            <span>{project.members}명</span>
          </span>
          <span className="flex items-center gap-1">
            <PIcon name="clock" size={12} />
            <span>{project.updatedAt}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[rgba(0,0,0,0.07)] bg-white shadow-sm">
      <div className="p-4">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-[#F1F4F8]" />
          <div className="h-5 w-5 animate-pulse rounded-full bg-[#F1F4F8]" />
        </div>
        <div className="mb-1.5 h-3 w-1/2 animate-pulse rounded bg-[#F1F4F8]" />
        <div className="h-3 w-full animate-pulse rounded bg-[#F1F4F8]" />
        <div className="mt-1 h-3 w-4/5 animate-pulse rounded bg-[#F1F4F8]" />
        <div className="mt-3 flex items-center justify-between border-t border-[rgba(0,0,0,0.05)] pt-3">
          <div className="h-3 w-14 animate-pulse rounded bg-[#F1F4F8]" />
          <div className="h-3 w-12 animate-pulse rounded bg-[#F1F4F8]" />
        </div>
      </div>
    </div>
  );
}

function ProjectListItem({ project, onOpen }) {
  const summary = PROJECT_SUMMARY[project.id] || '최근 회의 내용을 요약하고 있어요.';
  return (
    <button
      type="button"
      onClick={() => onOpen(project)}
      className="flex w-full items-start gap-3 rounded-xl border border-[rgba(0,0,0,0.07)] bg-white px-4 py-3.5 text-left transition hover:bg-[#F8FAFF] hover:border-[rgba(0,153,204,0.2)]"
    >
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[#0D1B2A]">
          {project.name}
        </h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-[#7A8FA6]">{summary}</p>
        <div className="mt-1 flex items-center gap-1 text-xs text-[#A0AFBF]">
          <PIcon name="users" size={11} />
          <span>{project.members}명</span>
        </div>
      </div>
      <span className="flex shrink-0 items-center gap-1 pt-0.5 text-xs text-[#A0AFBF]">
        <PIcon name="clock" size={11} />
        {project.updatedAt}
      </span>
    </button>
  );
}

export default function ProjectList() {
  const navigate = useNavigate();
  const sortDropdownRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState('projects');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortFilter, setSortFilter] = useState('최신순');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState('card');
  const [openMenuProjectId, setOpenMenuProjectId] = useState(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser] = useState(() => parseCurrentUser());

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) setIsSortOpen(false);
      if (!e.target.closest('[data-project-menu-root="true"]')) setOpenMenuProjectId(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const participatedProjects = useMemo(() => {
    const userName = currentUser.name.toLowerCase();
    const userEmail = currentUser.email;
    if (!userName && !userEmail) return PROJECTS;
    return PROJECTS.filter((project) => {
      const names = Array.isArray(project.participants) ? project.participants : [];
      return names.some((p) => {
        const n = String(p).trim().toLowerCase();
        return n === userName || n === userEmail;
      });
    });
  }, [currentUser]);

  const searchedProjects = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return participatedProjects;
    return participatedProjects.filter((project) =>
      project.name.toLowerCase().includes(keyword) ||
      project.teamLead.toLowerCase().includes(keyword)
    );
  }, [participatedProjects, searchQuery]);

  const sortedProjects = useMemo(() => {
    const copied = [...searchedProjects];
    if (sortFilter === '이름순') return copied.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    if (sortFilter === '인원 많은순') return copied.sort((a, b) => b.members - a.members);
    return copied.sort((a, b) => getTimeRank(b.updatedAt) - getTimeRank(a.updatedAt));
  }, [searchedProjects, sortFilter]);

  const recentProjects = useMemo(() => sortedProjects.slice(0, 4), [sortedProjects]);

  const itemsPerPage = isMobile ? 4 : 8;

  const pageCount = useMemo(() => Math.max(1, Math.ceil(sortedProjects.length / itemsPerPage)), [itemsPerPage, sortedProjects.length]);

  useEffect(() => { setPage(1); }, [searchQuery, sortFilter]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  useEffect(() => {
    setIsLoading(true);
    const t = window.setTimeout(() => setIsLoading(false), 360);
    return () => window.clearTimeout(t);
  }, [itemsPerPage, page, searchQuery, sortFilter]);

  const paginatedProjects = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return sortedProjects.slice(start, start + itemsPerPage);
  }, [itemsPerPage, page, sortedProjects]);

  const visiblePages = useMemo(() => {
    const max = 5;
    if (pageCount <= max) return Array.from({ length: pageCount }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(page - 2, pageCount - max + 1));
    return Array.from({ length: max }, (_, i) => start + i);
  }, [page, pageCount]);

  const openProjectMeetings = useCallback((project) => navigate(`/project/${project.id}/meetings`, { state: { project } }), [navigate]);
  const openProjectConfig = useCallback((project) => navigate('/configuration', { state: { project } }), [navigate]);
  const handlePageChange = useCallback((n) => { setPage(n); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[#F5F7FB] pb-20 pt-20 md:pb-0">
      <Header isMobile={isMobile} phase="IDLE" stateLabels={stateLabels} />

      <main className="flex-1 px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto max-w-7xl">

          {/* ── 페이지 헤더 ── */}
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0D1B2A]">내 프로젝트</h1>
              <p className="mt-2 text-sm text-[#5A6F8A]">내가 참여 중인 프로젝트를 모아 보여드려요.</p>
            </div>
            {/* 모바일: 전체 너비 가운데 / PC: 우측 자동 */}
            <button
              type="button"
              onClick={() => navigate('/create-project')}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0099CC] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#007EA7] active:scale-[0.98] sm:w-auto"
            >
              <PIcon name="plus" size={17} />
              새 프로젝트 생성
            </button>
          </div>

          {/* ── 최근 작업 ── */}
          <section className="mb-12">
            <div className="mb-6 flex items-baseline gap-2">
              <h2 className="text-lg font-bold text-[#0D1B2A]">최근 작업</h2>
              <span className="text-xs text-[#A0AFBF]">최대 4개</span>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {[0, 1, 2, 3].map((k) => <ProjectCardSkeleton key={k} />)}
              </div>
            ) : recentProjects.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {recentProjects.map((project) => (
                  <ProjectCard
                    key={`recent-${project.id}`}
                    project={project}
                    onOpen={openProjectMeetings}
                    onOpenConfig={openProjectConfig}
                    openMenuProjectId={openMenuProjectId}
                    setOpenMenuProjectId={setOpenMenuProjectId}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[rgba(0,100,180,0.18)] bg-white p-8 text-center text-sm text-[#5A6F8A]">
                최근 작업한 프로젝트가 없습니다.
              </div>
            )}
          </section>

          {/* ── 구분선 ── */}
          <div className="mb-8 border-t border-[rgba(0,0,0,0.06)]" />

          {/* ── 전체 프로젝트 헤더 ── */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-bold text-[#0D1B2A]">전체 프로젝트</h2>
              <span className="text-xs text-[#A0AFBF]">{sortedProjects.length}개</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* 검색창 */}
              <div className="relative w-full sm:w-72 lg:w-80">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#B0BFCC]">
                  <PIcon name="search" size={14} />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="프로젝트 이름 검색"
                  className="w-full rounded-xl border border-[rgba(0,0,0,0.09)] bg-white py-2 pl-8 pr-3 text-sm text-[#0D1B2A] placeholder-[#B0BFCC] transition focus:border-[#0099CC] focus:outline-none focus:ring-2 focus:ring-[rgba(0,153,204,0.12)]"
                />
              </div>

              {/* 정렬 드롭다운 */}
              <div className="relative w-full sm:w-[132px]" ref={sortDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsSortOpen((prev) => !prev)}
                  className={`flex w-full items-center justify-between gap-1.5 rounded-xl border py-2 pl-3 pr-2.5 text-sm transition ${
                    isSortOpen
                      ? 'border-[#0099CC]/40 bg-white shadow-[0_0_0_3px_rgba(0,153,204,0.10)]'
                      : 'border-[rgba(0,0,0,0.09)] bg-white text-[#0D1B2A] hover:border-[rgba(0,153,204,0.35)]'
                  }`}
                >
                  <span className="truncate font-medium text-[#0D1B2A]">{sortFilter}</span>
                  <PIcon name="chevronDown" size={13} className={`shrink-0 text-[#A0AFBF] transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
                </button>

                {isSortOpen && (
                  <div className="absolute left-0 right-0 z-20 mt-1.5 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => { setSortFilter(option); setIsSortOpen(false); }}
                        className={`flex w-full items-center justify-between px-3.5 py-2.5 text-sm transition-colors ${
                          sortFilter === option ? 'bg-[#F5F7FB] font-semibold text-[#0099CC]' : 'text-[#0D1B2A] hover:bg-[#F5F7FB]'
                        }`}
                      >
                        <span>{option}</span>
                        {sortFilter === option && <PIcon name="check" size={13} className="text-[#0099CC]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 뷰 토글 */}
              <div className="inline-flex shrink-0 items-center rounded-xl border border-[rgba(0,0,0,0.09)] bg-white p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('card')}
                  aria-label="카드형 보기"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                    viewMode === 'card' ? 'bg-[#0099CC] text-white shadow-sm' : 'text-[#B0BFCC] hover:text-[#5A6F8A]'
                  }`}
                >
                  <PIcon name="grid" size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  aria-label="리스트형 보기"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                    viewMode === 'list' ? 'bg-[#0099CC] text-white shadow-sm' : 'text-[#B0BFCC] hover:text-[#5A6F8A]'
                  }`}
                >
                  <PIcon name="list" size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* ── 전체 프로젝트 목록 ── */}
          <section>
            {isLoading ? (
              viewMode === 'card' ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: itemsPerPage }).map((_, i) => <ProjectCardSkeleton key={i} />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {Array.from({ length: itemsPerPage }).map((_, i) => <ProjectCardSkeleton key={i} />)}
                </div>
              )
            ) : paginatedProjects.length > 0 ? (
              <>
                {viewMode === 'card' ? (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                    {paginatedProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onOpen={openProjectMeetings}
                        onOpenConfig={openProjectConfig}
                        openMenuProjectId={openMenuProjectId}
                        setOpenMenuProjectId={setOpenMenuProjectId}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paginatedProjects.map((project) => (
                      <ProjectListItem key={project.id} project={project} onOpen={openProjectMeetings} />
                    ))}
                  </div>
                )}

                {pageCount > 1 && (
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
                    {visiblePages.map((number) => (
                      <button
                        key={number}
                        type="button"
                        onClick={() => handlePageChange(number)}
                        className={`h-9 min-w-[36px] rounded-lg px-3 text-sm font-semibold transition ${
                          page === number
                            ? 'bg-[#0099CC] text-white shadow-sm'
                            : 'border border-[rgba(0,0,0,0.09)] bg-white text-[#5A6F8A] hover:border-[#0099CC]/40 hover:text-[#0099CC]'
                        }`}
                        aria-current={page === number ? 'page' : undefined}
                      >
                        {number}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-[rgba(0,100,180,0.18)] bg-white p-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F4F8] text-[#A0AFBF]">
                  <PIcon name="folder" size={22} />
                </div>
                <p className="font-semibold text-[#0D1B2A]">검색 결과가 없습니다.</p>
                <p className="mt-1 text-sm text-[#5A6F8A]">다른 프로젝트 이름으로 다시 검색해 보세요.</p>
              </div>
            )}
          </section>
        </div>
      </main>

      {!isMobile && <Footer />}
      {isMobile && <MobileTab active={activeTab} onChange={setActiveTab} />}
    </div>
  );
}
