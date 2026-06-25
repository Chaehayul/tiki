import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MobileTab from '../components/MobileTab';
import { listProjects } from '../api/apiClient';

const iconPaths = {
  plus: ['M12 5v14', 'M5 12h14'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  chevronDown: ['M6 9l6 6 6-6'],
  check: ['M20 6L9 17l-5-5'],
  moreVertical: ['M12 5h.01', 'M12 12h.01', 'M12 19h.01'],
  clock: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20', 'M12 6v6l4 2'],
  folder: ['M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'],
  search: ['M21 21l-4.35-4.35', 'M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0'],
  lock: ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  link2: ['M9 17H7A5 5 0 0 1 7 7h2', 'M15 7h2a5 5 0 1 1 0 10h-2', 'M8 12h8'],
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
  users2: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M23 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
    'M16 3.13a4 4 0 0 1 0 7.75',
    'M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  ],
  eye: ['M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6'],
  globe: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
};

const VISIBILITY_OPTIONS = ['개인', '구성원만', '전체보기'];
const VISIBILITY_META = {
  '개인':    { icon: 'lock',   label: '개인' },
  '구성원만': { icon: 'user', label: '구성원만' },
  '전체보기': { icon: 'globe',  label: '전체보기' },
};

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
  { id: 1,  name: 'AI 회의록 자동화',        category: '개발',   visibility: '구성원만', members: 5, createdAt: '2026-06-01', teamLead: '정아름',    updatedAt: '2시간 전',  participants: ['정아름', '김민수', '송지영', '김소현', '채하율'], meetings: [{ id: 'm-101', title: '주간 스프린트 회의',   date: '2026-06-10', round: '1회차' }, { id: 'm-102', title: '요구사항 정제 미팅',     date: '2026-06-13', round: '2회차' }] },
  { id: 2,  name: '디자인 시스템 구축',       category: '디자인', visibility: '전체보기', members: 3, createdAt: '2026-05-27', teamLead: '박디자이너', updatedAt: '어제',      participants: ['박디자이너', '정아름', '송지영'], meetings: [{ id: 'm-201', title: '컴포넌트 토큰 정리',   date: '2026-06-09', round: '1회차' }] },
  { id: 3,  name: '사용자 인터뷰 분석',       category: '기타',   visibility: '개인',    members: 7, createdAt: '2026-05-19', teamLead: '김소현',    updatedAt: '3일 전',   participants: ['김소현', '송지영', '채하율', '외부리서처A'], meetings: [{ id: 'm-301', title: '인터뷰 질문지 점검', date: '2026-06-05', round: '1회차' }, { id: 'm-302', title: 'VOC 인사이트 공유',      date: '2026-06-11', round: '2회차' }, { id: 'm-303', title: '후속 액션 플래닝',       date: '2026-06-14', round: '3회차' }] },
  { id: 4,  name: '분기별 기획안',            category: '기획',   visibility: '구성원만', members: 4, createdAt: '2026-06-08', teamLead: '송지영',    updatedAt: '1시간 전', participants: ['송지영', '김소현', '정아름', '김민수'], meetings: [{ id: 'm-401', title: 'Q3 로드맵 정리',       date: '2026-06-15', round: '1회차' }] },
  { id: 5,  name: '운영 자동화 개선',         category: '개발',   visibility: '전체보기', members: 6, createdAt: '2026-04-23', teamLead: '김민수',    updatedAt: '5시간 전', participants: ['김민수', '채하율', '정아름'], meetings: [{ id: 'm-501', title: '배치 작업 장애 복기', date: '2026-06-08', round: '1회차' }, { id: 'm-502', title: '자동화 아키텍처 리뷰',   date: '2026-06-12', round: '2회차' }] },
  { id: 6,  name: '온보딩 가이드 리뉴얼',     category: '기획',   visibility: '구성원만', members: 2, createdAt: '2026-05-03', teamLead: '김소현',    updatedAt: '이번 주',  participants: ['김소현', '박디자이너'], meetings: [{ id: 'm-601', title: '신규 유입 시나리오 점검', date: '2026-06-07', round: '1회차' }] },
  { id: 7,  name: '캠페인 퍼널 분석',         category: '마케팅', visibility: '개인',    members: 4, createdAt: '2026-05-15', teamLead: '마케터A',   updatedAt: '어제',     participants: ['마케터A', '김소현', '채하율'], meetings: [{ id: 'm-701', title: '캠페인 성과 리뷰',    date: '2026-06-10', round: '1회차' }, { id: 'm-702', title: '채널별 액션 아이템',    date: '2026-06-13', round: '2회차' }] },
  { id: 8,  name: '문서 표준화 태스크',       category: '기타',   visibility: '전체보기', members: 3, createdAt: '2026-04-30', teamLead: '송지영',    updatedAt: '3일 전',   participants: ['송지영', '정아름', '김소현'], meetings: [{ id: 'm-801', title: '문서 템플릿 통합',    date: '2026-06-06', round: '1회차' }] },
  { id: 9,  name: '신규 기능 우선순위 정렬',  category: '기획',   visibility: '구성원만', members: 5, createdAt: '2026-05-21', teamLead: '정아름',    updatedAt: '어제',     participants: ['정아름', '김소현', '송지영', '김민수', '채하율'], meetings: [{ id: 'm-901', title: '우선순위 기준 정합',  date: '2026-06-11', round: '1회차' }, { id: 'm-902', title: '백로그 재정리',          date: '2026-06-14', round: '2회차' }] },
  { id: 10, name: '프로덕트 KPI 재정의',      category: '기획',   visibility: '개인',    members: 4, createdAt: '2026-05-12', teamLead: '김소현',    updatedAt: '3일 전',   participants: ['김소현', '정아름', '박디자이너', '송지영'], meetings: [{ id: 'm-1001', title: '핵심 KPI 후보 정의', date: '2026-06-09', round: '1회차' }] },
  { id: 11, name: '온보딩 퍼널 개선안',       category: '기획',   visibility: '전체보기', members: 6, createdAt: '2026-05-30', teamLead: '송지영',    updatedAt: '이번 주',  participants: ['송지영', '김소현', '정아름', '김민수', '채하율', '박디자이너'], meetings: [{ id: 'm-1101', title: '퍼널 단계별 이탈 분석', date: '2026-06-08', round: '1회차' }, { id: 'm-1102', title: '가설 기반 개선안 리뷰',  date: '2026-06-12', round: '2회차' }] },
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

function VisibilityBadge({ visibility }) {
  const meta = VISIBILITY_META[visibility] || VISIBILITY_META['구성원만'];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F7FB] px-1.5 py-0.5 text-[10.5px] font-medium text-[#7A8FA6]">
      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[#8FA0B3]">
        <PIcon name={meta.icon} size={10} />
      </span>
      {meta.label}
    </span>
  );
}

function getTimeRank(value) {
  const order = { '1시간 전': 6, '2시간 전': 5, '5시간 전': 4, 어제: 3, '3일 전': 2, '이번 주': 1 };
  return order[value] || 0;
function toRelativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 60) return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return `${Math.floor(days / 7)}주 전`;
}


function getUserActivityStorageKey(user) {
  const identity = user?.email || user?.name || 'anonymous';
  return `tiki_project_activity_${identity}`;
}

function loadUserProjectActivity(user) {
  try {
    const raw = localStorage.getItem(getUserActivityStorageKey(user));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveUserProjectActivity(user, map) {
  try {
    localStorage.setItem(getUserActivityStorageKey(user), JSON.stringify(map));
  } catch {
    // Ignore localStorage write failures and continue with in-memory state.
  }
}

function ProjectCard({ project, onOpen, onOpenConfig, menuKey, setMenuKey, menuScope }) {
  const summary = PROJECT_SUMMARY[project.id] || '최근 회의 내용을 요약하고 있어요.';
  const currentMenuKey = `${menuScope}-${project.id}`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(project)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(project); }}
      className="group flex w-full cursor-pointer flex-col rounded-2xl border border-[rgba(0,0,0,0.07)] bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(0,153,204,0.25)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.09)]"
    >
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center justify-between gap-2" data-project-menu-root="true">
          <VisibilityBadge visibility={project.visibility} />
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuKey((prev) => (prev === currentMenuKey ? null : currentMenuKey));
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[#B0BFCC] transition-all hover:bg-[#F1F4F8] hover:text-[#5A6F8A]"
              aria-label="프로젝트 메뉴"
            >
              <PIcon name="moreVertical" size={14} />
            </button>
            {menuKey === currentMenuKey && (
              <div className="absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.13)]">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMenuKey(null); onOpenConfig(project); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-[#0D1B2A] transition-colors hover:bg-[#F5F7FB]"
                >
                  설정 페이지
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMenuKey(null); onOpen(project); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-[#0D1B2A] transition-colors hover:bg-[#F5F7FB]"
                >
                  회의 목록
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="mb-2.5">
          <h3 className="flex-1 text-[13.5px] font-bold leading-[1.5] text-[#0D1B2A] line-clamp-1">
            {project.name}
          </h3>
        </div>
        <p className="flex-1 text-[12px] leading-[1.6] text-[#7A8FA6] line-clamp-1">
          {summary}
        </p>
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
        <div className="mb-2 h-5 w-16 animate-pulse rounded-md bg-[#F1F4F8]" />
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-[#F1F4F8]" />
          <div className="h-5 w-5 animate-pulse rounded-full bg-[#F1F4F8]" />
        </div>
        <div className="mb-1.5 h-3 w-1/2 animate-pulse rounded bg-[#F1F4F8]" />
        <div className="h-3 w-full animate-pulse rounded bg-[#F1F4F8]" />
        <div className="mt-3 flex items-center justify-between border-t border-[rgba(0,0,0,0.05)] pt-3">
          <div className="h-3 w-14 animate-pulse rounded bg-[#F1F4F8]" />
          <div className="h-3 w-12 animate-pulse rounded bg-[#F1F4F8]" />
        </div>
      </div>
    </div>
  );
}

function ProjectListItem({ project, onOpen, onOpenConfig, menuKey, setMenuKey, menuScope }) {
  const summary = PROJECT_SUMMARY[project.id] || '최근 회의 내용을 요약하고 있어요.';
  const currentMenuKey = `${menuScope}-${project.id}`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(project)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(project); }}
      className="w-full bg-white px-4 py-4 text-left transition hover:bg-[#F8FAFF]"
      data-project-menu-root="true"
    >
      <div className="flex items-start justify-between gap-3 md:grid md:grid-cols-[minmax(0,1.8fr)_120px_120px_120px_56px] md:items-center md:gap-x-4">
        <div className="min-w-0 flex-1 pr-1 md:pr-6">
          <div className="flex items-start justify-between gap-2 md:block">
            <h3 className="line-clamp-1 text-sm font-semibold leading-snug text-[#0D1B2A]">
              {project.name}
            </h3>
            <div className="relative shrink-0 md:hidden" data-project-menu-root="true">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuKey((prev) => (prev === currentMenuKey ? null : currentMenuKey));
                }}
                className="-mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[#B0BFCC] transition-all hover:bg-[#F1F4F8] hover:text-[#5A6F8A]"
                aria-label="프로젝트 메뉴"
              >
                <PIcon name="moreVertical" size={14} />
              </button>
              {menuKey === currentMenuKey && (
                <div className="absolute right-0 top-full z-30 mt-1 w-28 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.13)]">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMenuKey(null); onOpenConfig(project); }}
                    className="w-full px-3.5 py-2.5 text-left text-sm text-[#0D1B2A] transition-colors hover:bg-[#F5F7FB]"
                  >
                    설정 페이지
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMenuKey(null); onOpen(project); }}
                    className="w-full px-3.5 py-2.5 text-left text-sm text-[#0D1B2A] transition-colors hover:bg-[#F5F7FB]"
                  >
                    회의 목록
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-[#7A8FA6]">{summary}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-[#A0AFBF] md:hidden">
            <VisibilityBadge visibility={project.visibility} />
            <span className="flex items-center gap-1">
              <PIcon name="users" size={11} />
              {project.members}명
            </span>
            <span className="flex items-center gap-1">
              <PIcon name="clock" size={11} />
              {project.updatedAt}
            </span>
          </div>
        </div>

        <div className="hidden h-full items-center justify-center md:flex">
          <VisibilityBadge visibility={project.visibility} />
        </div>

        <div className="hidden h-full items-center justify-center gap-1 text-xs text-[#A0AFBF] md:flex">
          <PIcon name="users" size={11} />
          <span>{project.members}명</span>
        </div>

        <div className="hidden h-full items-center justify-center gap-1 text-xs text-[#A0AFBF] md:flex">
          <span className="flex items-center gap-1">
            <PIcon name="clock" size={11} />
            {project.updatedAt}
          </span>
        </div>

        <div className="relative hidden h-full items-center justify-end md:flex" data-project-menu-root="true">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuKey((prev) => (prev === currentMenuKey ? null : currentMenuKey));
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[#B0BFCC] transition-all hover:bg-[#F1F4F8] hover:text-[#5A6F8A]"
            aria-label="프로젝트 메뉴"
          >
            <PIcon name="moreVertical" size={14} />
          </button>
          {menuKey === currentMenuKey && (
            <div className="absolute right-0 top-full z-30 mt-1 w-28 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.13)]">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuKey(null); onOpenConfig(project); }}
                className="w-full px-3.5 py-2.5 text-left text-sm text-[#0D1B2A] transition-colors hover:bg-[#F5F7FB]"
              >
                설정 페이지
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuKey(null); onOpen(project); }}
                className="w-full px-3.5 py-2.5 text-left text-sm text-[#0D1B2A] transition-colors hover:bg-[#F5F7FB]"
              >
                회의 목록
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
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
  const [openMenuKey, setOpenMenuKey] = useState(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser] = useState(() => parseCurrentUser());
  const [activityByProjectId, setActivityByProjectId] = useState(() => loadUserProjectActivity(parseCurrentUser()));
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    setActivityByProjectId(loadUserProjectActivity(currentUser));
  }, [currentUser]);

  useEffect(() => {
    listProjects()
      .then((data) =>
        setProjects(
          data.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            description: p.description,
            members: p.member_count,
            teamLead: p.team_lead,
            updatedAt: toRelativeTime(p.updated_at),
            _updatedAt: p.updated_at,
          }))
        )
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) setIsSortOpen(false);
      if (!e.target.closest('[data-project-menu-root="true"]')) setOpenMenuKey(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const participatedProjects = projects;

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
    return copied.sort((a, b) => new Date(b._updatedAt) - new Date(a._updatedAt));
  }, [searchedProjects, sortFilter]);

  const recentProjects = useMemo(() => {
    const copy = [...participatedProjects];
    copy.sort((a, b) => {
      const aActivity = Date.parse(activityByProjectId[a.id] || '');
      const bActivity = Date.parse(activityByProjectId[b.id] || '');
      const aScore = Number.isNaN(aActivity) ? 0 : aActivity;
      const bScore = Number.isNaN(bActivity) ? 0 : bActivity;
      if (aScore !== bScore) return bScore - aScore;
      return getTimeRank(b.updatedAt) - getTimeRank(a.updatedAt);
    });
    return copy.slice(0, 4);
  }, [activityByProjectId, participatedProjects]);

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

  const markProjectActivity = useCallback((projectId) => {
    setActivityByProjectId((prev) => {
      const next = { ...prev, [projectId]: new Date().toISOString() };
      saveUserProjectActivity(currentUser, next);
      return next;
    });
  }, [currentUser]);

  const openProjectMeetings = useCallback((project) => {
    markProjectActivity(project.id);
    navigate(`/project/${project.id}/meetings`, { state: { project } });
  }, [markProjectActivity, navigate]);

  const openProjectConfig = useCallback((project) => {
    markProjectActivity(project.id);
    navigate('/configuration', { state: { project } });
  }, [markProjectActivity, navigate]);
  const handlePageChange = useCallback((n) => { setPage(n); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  const listContainerClass = '';

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
                    menuKey={openMenuKey}
                    setMenuKey={setOpenMenuKey}
                    menuScope="recent"
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
          <div className={`mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${listContainerClass}`}>
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-bold text-[#0D1B2A]">전체 프로젝트</h2>
              <span className="text-xs text-[#A0AFBF]">{sortedProjects.length}개</span>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-2">
              {/* 검색창 */}
              <div className="relative col-span-2 w-full sm:col-span-1 sm:w-72 lg:w-80">
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
              <div className="relative col-span-1 w-full sm:w-[132px]" ref={sortDropdownRef}>
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
              <div className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-[rgba(0,0,0,0.09)] bg-white p-1 sm:h-auto sm:w-auto sm:justify-start">
                <button
                  type="button"
                  onClick={() => setViewMode('card')}
                  aria-label="카드형 보기"
                  className={`flex h-8 w-1/2 items-center justify-center rounded-lg transition sm:w-8 ${
                    viewMode === 'card' ? 'bg-[#0099CC] text-white shadow-sm' : 'text-[#B0BFCC] hover:text-[#5A6F8A]'
                  }`}
                >
                  <PIcon name="grid" size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  aria-label="리스트형 보기"
                  className={`flex h-8 w-1/2 items-center justify-center rounded-lg transition sm:w-8 ${
                    viewMode === 'list' ? 'bg-[#0099CC] text-white shadow-sm' : 'text-[#B0BFCC] hover:text-[#5A6F8A]'
                  }`}
                >
                  <PIcon name="list" size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* ── 전체 프로젝트 목록 ── */}
          <section className={listContainerClass}>
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
                        menuKey={openMenuKey}
                        setMenuKey={setOpenMenuKey}
                        menuScope="all"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[rgba(0,0,0,0.07)] bg-white overflow-hidden divide-y divide-[rgba(0,0,0,0.06)]">
                    {paginatedProjects.map((project) => (
                      <ProjectListItem
                        key={project.id}
                        project={project}
                        onOpen={openProjectMeetings}
                        onOpenConfig={openProjectConfig}
                        menuKey={openMenuKey}
                        setMenuKey={setOpenMenuKey}
                        menuScope="list"
                      />
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