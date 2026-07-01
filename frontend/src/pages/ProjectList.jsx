import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MobileTab from '../components/MobileTab';
import { deleteProject, listProjects } from '../api/apiClient';

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
}

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

const PROJECT_LIST_VIEW_MODE_KEY = 'tiki_project_list_view_mode';

function loadProjectListViewMode() {
  try {
    const raw = localStorage.getItem(PROJECT_LIST_VIEW_MODE_KEY);
    return raw === 'list' ? 'list' : 'card';
  } catch {
    return 'card';
  }
}

function saveProjectListViewMode(mode) {
  try {
    localStorage.setItem(PROJECT_LIST_VIEW_MODE_KEY, mode === 'list' ? 'list' : 'card');
  } catch {
    // Ignore localStorage write failures and continue with in-memory state.
  }
}

function parseCurrentUser() {
  if (typeof window === 'undefined') return null;

  const candidateKeys = ['tiki_user', 'currentUser', 'user', 'authUser', 'sessionUser'];

  for (const key of candidateKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
      if (typeof parsed === 'string' && parsed.trim()) return { name: parsed.trim() };
    } catch {
      const raw = localStorage.getItem(key);
      if (raw && raw.trim()) return { name: raw.trim() };
      // Ignore malformed storage entries and try the next candidate.
    }
  }

  return null;
}

function ProjectCard({ project, onOpen, onOpenConfig, onDelete, menuKey, setMenuKey, menuScope, menuDirectionByKey, setMenuDirectionByKey }) {
  const summary = project.description || '최근 회의 내용을 요약하고 있어요.';
  const currentMenuKey = `${menuScope}-${project.id}`;
  const menuDirection = menuDirectionByKey[currentMenuKey] || 'down';

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
                const rect = e.currentTarget.getBoundingClientRect();
                const shouldOpenUp = window.innerHeight - rect.bottom < 140;
                setMenuDirectionByKey((prev) => ({ ...prev, [currentMenuKey]: shouldOpenUp ? 'up' : 'down' }));
                setMenuKey((prev) => (prev === currentMenuKey ? null : currentMenuKey));
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[#B0BFCC] transition-all hover:bg-[#F1F4F8] hover:text-[#5A6F8A]"
              aria-label="프로젝트 메뉴"
            >
              <PIcon name="moreVertical" size={14} />
            </button>
            {menuKey === currentMenuKey && (
              <div className={`absolute right-0 z-30 w-36 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.13)] ${menuDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMenuKey(null); onOpenConfig(project); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-[#0D1B2A] transition-colors hover:bg-[#F5F7FB]"
                >
                  설정
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMenuKey(null); onDelete(project); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-[#0D1B2A] transition-colors hover:bg-[#F5F7FB]"
                >
                  삭제
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

function ProjectListItem({ project, onOpen, onOpenConfig, onDelete, menuKey, setMenuKey, menuScope, menuDirectionByKey, setMenuDirectionByKey }) {
  const summary = project.description || '최근 회의 내용을 요약하고 있어요.';
  const currentMenuKey = `${menuScope}-${project.id}`;
  const menuDirection = menuDirectionByKey[currentMenuKey] || 'down';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(project)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(project); }}
      className="w-full bg-white px-4 py-4 text-left transition hover:bg-[#F8FAFF] first:rounded-t-2xl last:rounded-b-2xl"
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
                  const rect = e.currentTarget.getBoundingClientRect();
                  const shouldOpenUp = window.innerHeight - rect.bottom < 140;
                  setMenuDirectionByKey((prev) => ({ ...prev, [currentMenuKey]: shouldOpenUp ? 'up' : 'down' }));
                  setMenuKey((prev) => (prev === currentMenuKey ? null : currentMenuKey));
                }}
                className="-mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[#B0BFCC] transition-all hover:bg-[#F1F4F8] hover:text-[#5A6F8A]"
                aria-label="프로젝트 메뉴"
              >
                <PIcon name="moreVertical" size={14} />
              </button>
              {menuKey === currentMenuKey && (
                <div className="absolute right-full top-1/2 z-30 mr-1 w-28 -translate-y-1/2 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.13)]">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMenuKey(null); onOpenConfig(project); }}
                    className="w-full px-3.5 py-2.5 text-left text-sm text-[#0D1B2A] transition-colors hover:bg-[#F5F7FB]"
                  >
                    설정
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMenuKey(null); onDelete(project); }}
                    className="w-full px-3.5 py-2.5 text-left text-sm text-[#0D1B2A] transition-colors hover:bg-[#F5F7FB]"
                  >
                    삭제
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
              const rect = e.currentTarget.getBoundingClientRect();
              const shouldOpenUp = window.innerHeight - rect.bottom < 140;
              setMenuDirectionByKey((prev) => ({ ...prev, [currentMenuKey]: shouldOpenUp ? 'up' : 'down' }));
              setMenuKey((prev) => (prev === currentMenuKey ? null : currentMenuKey));
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[#B0BFCC] transition-all hover:bg-[#F1F4F8] hover:text-[#5A6F8A]"
            aria-label="프로젝트 메뉴"
          >
            <PIcon name="moreVertical" size={14} />
          </button>
          {menuKey === currentMenuKey && (
            <div className="absolute right-full top-1/2 z-30 mr-1 w-28 -translate-y-1/2 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.13)]">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuKey(null); onOpenConfig(project); }}
                className="w-full px-3.5 py-2.5 text-left text-sm text-[#0D1B2A] transition-colors hover:bg-[#F5F7FB]"
              >
                설정
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuKey(null); onDelete(project); }}
                className="w-full px-3.5 py-2.5 text-left text-sm text-[#0D1B2A] transition-colors hover:bg-[#F5F7FB]"
              >
                삭제
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
  const [viewMode, setViewMode] = useState(() => loadProjectListViewMode());
  const [openMenuKey, setOpenMenuKey] = useState(null);
  const [menuDirectionByKey, setMenuDirectionByKey] = useState({});
  const [pendingDeleteProject, setPendingDeleteProject] = useState(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchedProjects, setHasFetchedProjects] = useState(false);
  const currentUser = useMemo(() => parseCurrentUser(), []);
  const [activityByProjectId, setActivityByProjectId] = useState(() => loadUserProjectActivity(currentUser));
  const [projects, setProjects] = useState([]);
  const [deletedProjectIds, setDeletedProjectIds] = useState([]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const fetchProjects = useCallback(() => {
    return listProjects()
      .then((data) => {
        const mapped = (Array.isArray(data) ? data : []).map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          description: p.description,
          createdAt: p.created_at ? String(p.created_at).slice(0, 10) : '',
          members: p.member_count,
          teamLead: p.team_lead,
          updatedAt: toRelativeTime(p.updated_at),
          _updatedAt: p.updated_at,
        }));

        setProjects(mapped);
      })
      .catch(() => {
        // Keep existing data to avoid UI flicker when a refetch fails momentarily.
        setProjects((prev) => prev);
      })
      .finally(() => {
        setHasFetchedProjects(true);
      });
  }, []);

  useEffect(() => {
    setActivityByProjectId(loadUserProjectActivity(currentUser));
  }, [currentUser]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    const handleRefetch = () => {
      fetchProjects();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchProjects();
    };

    window.addEventListener('focus', handleRefetch);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleRefetch);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchProjects]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    saveProjectListViewMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) setIsSortOpen(false);
      if (!e.target.closest('[data-project-menu-root="true"]')) setOpenMenuKey(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const sourceProjects = hasFetchedProjects ? projects : [];

  const participatedProjects = useMemo(() => {
    if (deletedProjectIds.length === 0) return sourceProjects;
    return sourceProjects.filter((project) => !deletedProjectIds.includes(String(project.id)));
  }, [deletedProjectIds, sourceProjects]);

  const searchedProjects = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return participatedProjects;
    return participatedProjects.filter((project) =>
      String(project.name || '').toLowerCase().includes(keyword) ||
      String(project.teamLead || '').toLowerCase().includes(keyword)
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

  const requestDeleteProject = useCallback((project) => {
    setPendingDeleteProject(project);
  }, []);

  const confirmDeleteProject = useCallback(async () => {
    if (!pendingDeleteProject) return;
    const deleteId = String(pendingDeleteProject.id);
    setDeletedProjectIds((prev) => (prev.includes(deleteId) ? prev : [...prev, deleteId]));
    setProjects((prev) => prev.filter((project) => String(project.id) !== deleteId));
    setOpenMenuKey(null);
    setPendingDeleteProject(null);
    try {
      await deleteProject(deleteId);
    } catch {
      setDeletedProjectIds((prev) => prev.filter((id) => id !== deleteId));
      fetchProjects();
    }
  }, [fetchProjects, pendingDeleteProject]);

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
                    onDelete={requestDeleteProject}
                    menuKey={openMenuKey}
                    setMenuKey={setOpenMenuKey}
                    menuScope="recent"
                    menuDirectionByKey={menuDirectionByKey}
                    setMenuDirectionByKey={setMenuDirectionByKey}
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
                        onDelete={requestDeleteProject}
                        menuKey={openMenuKey}
                        setMenuKey={setOpenMenuKey}
                        menuScope="all"
                        menuDirectionByKey={menuDirectionByKey}
                        setMenuDirectionByKey={setMenuDirectionByKey}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[rgba(0,0,0,0.07)] bg-white overflow-visible divide-y divide-[rgba(0,0,0,0.06)]">
                    {paginatedProjects.map((project) => (
                      <ProjectListItem
                        key={project.id}
                        project={project}
                        onOpen={openProjectMeetings}
                        onOpenConfig={openProjectConfig}
                        onDelete={requestDeleteProject}
                        menuKey={openMenuKey}
                        setMenuKey={setOpenMenuKey}
                        menuScope="list"
                        menuDirectionByKey={menuDirectionByKey}
                        setMenuDirectionByKey={setMenuDirectionByKey}
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

      {pendingDeleteProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
          <div className="absolute inset-0 bg-[#0D1B2A]/40" onClick={() => setPendingDeleteProject(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-6 shadow-2xl">
            <p className="text-base font-bold text-[#0D1B2A]">프로젝트를 삭제할까요?</p>
            <p className="mt-2 text-sm text-[#5A6F8A]">
              <span className="font-semibold text-[#0D1B2A]">{pendingDeleteProject.name}</span> 프로젝트를 삭제하면
              되돌릴 수 없습니다. 정말 삭제하시겠습니까?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteProject(null)}
                className="rounded-lg border border-[rgba(0,0,0,0.12)] px-3.5 py-2 text-sm text-[#5A6F8A] hover:bg-[#F8FAFF]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDeleteProject}
                className="rounded-lg bg-[#EF4444] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#DC2626]"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {!isMobile && <Footer />}
      {isMobile && <MobileTab active={activeTab} onChange={setActiveTab} />}
    </div>
  );
}
