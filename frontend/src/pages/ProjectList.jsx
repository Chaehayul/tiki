import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MobileTab from '../components/MobileTab';

const iconPaths = {
  plus: ['M12 5v14', 'M5 12h14'],
  folderKanban: [
    'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
    'M8 13h8',
    'M8 17h5'
  ],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'
  ],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    'M22 21v-2a4 4 0 0 0-3-3.87'
  ],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  chevronRight: ['M9 18l6-6-6-6'],
  chevronDown: ['M6 9l6 6 6-6'],
  check: ['M20 6L9 17l-5-5'],
  moreVertical: ['M12 5h.01', 'M12 12h.01', 'M12 19h.01']
};

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

const ProjectList = () => {
  const navigate = useNavigate();
  const sortDropdownRef = useRef(null);
  const categoryRailRefs = useRef({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState('home');
  const [viewMode, setViewMode] = useState('card');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('전체');
  const [sortFilter, setSortFilter] = useState('최신순');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [openMenuProjectId, setOpenMenuProjectId] = useState(null);

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

  const stateLabels = {
    IDLE: '대기 중',
    UPLOADING: '업로드 중',
    PROCESSING: 'AI 분석 중',
    COMPLETED: '분석 완료',
    FAILED: '오류 발생'
  };

  // 테스트용 프로젝트 데이터
  const projects = [
    {
      id: 1,
      name: 'AI 회의록 자동화',
      category: '개발',
      color: 'bg-[#0099CC]',
      members: 5,
      createdAt: '2026-06-01',
      teamLead: '정아름',
      updatedAt: '2시간 전',
      participants: ['정아름', '김민수', '송지영', '김소현', '채하율'],
      meetings: [
        { id: 'm-101', title: '주간 스프린트 회의', date: '2026-06-10', round: '1회차' },
        { id: 'm-102', title: '요구사항 정제 미팅', date: '2026-06-13', round: '2회차' }
      ]
    },
    {
      id: 2,
      name: '디자인 시스템 구축',
      category: '디자인',
      color: 'bg-[#7C3AED]',
      members: 3,
      createdAt: '2026-05-27',
      teamLead: '박디자이너',
      updatedAt: '어제',
      participants: ['박디자이너', '정아름', '송지영'],
      meetings: [
        { id: 'm-201', title: '컴포넌트 토큰 정리', date: '2026-06-09', round: '1회차' }
      ]
    },
    {
      id: 3,
      name: '사용자 인터뷰 분석',
      category: '기타(직접입력)',
      color: 'bg-[#10B981]',
      members: 7,
      createdAt: '2026-05-19',
      teamLead: '김소현',
      updatedAt: '3일 전',
      participants: ['김소현', '송지영', '채하율', '외부리서처A'],
      meetings: [
        { id: 'm-301', title: '인터뷰 질문지 정합성 점검', date: '2026-06-05', round: '1회차' },
        { id: 'm-302', title: 'VOC 인사이트 공유', date: '2026-06-11', round: '2회차' },
        { id: 'm-303', title: '후속 액션 플래닝', date: '2026-06-14', round: '3회차' }
      ]
    },
    {
      id: 4,
      name: '분기별 기획안',
      category: '기획',
      color: 'bg-[#F59E0B]',
      members: 4,
      createdAt: '2026-06-08',
      teamLead: '송지영',
      updatedAt: '1시간 전',
      participants: ['송지영', '김소현', '정아름', '김민수'],
      meetings: [
        { id: 'm-401', title: 'Q3 로드맵 정리', date: '2026-06-15', round: '1회차' }
      ]
    },
    {
      id: 5,
      name: '운영 자동화 개선',
      category: '개발',
      color: 'bg-[#0099CC]',
      members: 6,
      createdAt: '2026-04-23',
      teamLead: '김민수',
      updatedAt: '5시간 전',
      participants: ['김민수', '채하율', '정아름'],
      meetings: [
        { id: 'm-501', title: '배치 작업 장애 복기', date: '2026-06-08', round: '1회차' },
        { id: 'm-502', title: '자동화 아키텍처 리뷰', date: '2026-06-12', round: '2회차' }
      ]
    },
    {
      id: 6,
      name: '온보딩 가이드 리뉴얼',
      category: '기획',
      color: 'bg-[#F59E0B]',
      members: 2,
      createdAt: '2026-05-03',
      teamLead: '김소현',
      updatedAt: '이번 주',
      participants: ['김소현', '박디자이너'],
      meetings: [
        { id: 'm-601', title: '신규 유입 시나리오 점검', date: '2026-06-07', round: '1회차' }
      ]
    },
    {
      id: 7,
      name: '캠페인 퍼널 분석',
      category: '마케팅',
      color: 'bg-[#EF4444]',
      members: 4,
      createdAt: '2026-05-15',
      teamLead: '마케터A',
      updatedAt: '어제',
      participants: ['마케터A', '김소현', '채하율'],
      meetings: [
        { id: 'm-701', title: '캠페인 성과 리뷰', date: '2026-06-10', round: '1회차' },
        { id: 'm-702', title: '채널별 액션 아이템', date: '2026-06-13', round: '2회차' }
      ]
    },
    {
      id: 8,
      name: '문서 표준화 태스크',
      category: '기타(직접입력)',
      color: 'bg-[#5A6F8A]',
      members: 3,
      createdAt: '2026-04-30',
      teamLead: '송지영',
      updatedAt: '3일 전',
      participants: ['송지영', '정아름', '김소현'],
      meetings: [
        { id: 'm-801', title: '문서 템플릿 통합', date: '2026-06-06', round: '1회차' }
      ]
    },
    {
      id: 9,
      name: '신규 기능 우선순위 정렬',
      category: '기획',
      color: 'bg-[#F59E0B]',
      members: 5,
      createdAt: '2026-05-21',
      teamLead: '정아름',
      updatedAt: '어제',
      participants: ['정아름', '김소현', '송지영', '김민수', '채하율'],
      meetings: [
        { id: 'm-901', title: '우선순위 기준 정합', date: '2026-06-11', round: '1회차' },
        { id: 'm-902', title: '백로그 재정리', date: '2026-06-14', round: '2회차' }
      ]
    },
    {
      id: 10,
      name: '프로덕트 KPI 재정의',
      category: '기획',
      color: 'bg-[#F59E0B]',
      members: 4,
      createdAt: '2026-05-12',
      teamLead: '김소현',
      updatedAt: '3일 전',
      participants: ['김소현', '정아름', '박디자이너', '송지영'],
      meetings: [
        { id: 'm-1001', title: '핵심 KPI 후보 정의', date: '2026-06-09', round: '1회차' }
      ]
    },
    {
      id: 11,
      name: '온보딩 퍼널 개선안',
      category: '기획',
      color: 'bg-[#F59E0B]',
      members: 6,
      createdAt: '2026-05-30',
      teamLead: '송지영',
      updatedAt: '이번 주',
      participants: ['송지영', '김소현', '정아름', '김민수', '채하율', '박디자이너'],
      meetings: [
        { id: 'm-1101', title: '퍼널 단계별 이탈 분석', date: '2026-06-08', round: '1회차' },
        { id: 'm-1102', title: '가설 기반 개선안 리뷰', date: '2026-06-12', round: '2회차' }
      ]
    }
  ];

  const categories = ['전체', '개발', '디자인', '기획', '마케팅', '기타(직접입력)'];
  const sortOptions = ['최신순', '이름순', '인원 많은순'];
  const categoryPalette = {
    '전체': { bg: '#EEF3FF', text: '#0099CC', border: 'rgba(0,153,204,0.32)', accent: '#0099CC' },
    '개발': { bg: '#EEF3FF', text: '#0099CC', border: 'rgba(0,153,204,0.32)', accent: '#0099CC' },
    '디자인': { bg: '#F3E8FF', text: '#7C3AED', border: 'rgba(124,58,237,0.3)', accent: '#7C3AED' },
    '기획': { bg: '#E6F4EA', text: '#10B981', border: 'rgba(16,185,129,0.3)', accent: '#10B981' },
    '마케팅': { bg: '#FCE8E6', text: '#EF4444', border: 'rgba(239,68,68,0.3)', accent: '#EF4444' },
    '기타': { bg: '#EEF2F7', text: '#5A6F8A', border: 'rgba(90,111,138,0.28)', accent: '#5A6F8A' },
    '기타(직접입력)': { bg: '#FEF7E0', text: '#F59E0B', border: 'rgba(245,158,11,0.32)', accent: '#F59E0B' }
  };

  const getCategoryPalette = (category) => categoryPalette[category] || categoryPalette['기타(직접입력)'];

  const getTimeRank = (value) => {
    const order = {
      '1시간 전': 6,
      '2시간 전': 5,
      '5시간 전': 4,
      '어제': 3,
      '3일 전': 2,
      '이번 주': 1,
    };
    return order[value] || 0;
  };

  const filteredProjects = projects
    .filter((project) => {
      const matchesCategory = categoryFilter === '전체' || project.category === categoryFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        q.length === 0 ||
        project.name.toLowerCase().includes(q) ||
        project.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      if (sortFilter === '이름순') {
        return a.name.localeCompare(b.name, 'ko');
      }
      if (sortFilter === '인원 많은순') {
        return b.members - a.members;
      }
      return getTimeRank(b.updatedAt) - getTimeRank(a.updatedAt);
    });

  const groupedProjects = filteredProjects.reduce((acc, project) => {
    if (!acc[project.category]) acc[project.category] = [];
    acc[project.category].push(project);
    return acc;
  }, {});

  const groupedEntries = Object.entries(groupedProjects);

  const scrollCategoryRail = (categoryName, direction) => {
    const rail = categoryRailRefs.current[categoryName];
    if (!rail) return;

    const amount = Math.max(220, Math.floor(rail.clientWidth * 0.75));
    rail.scrollBy({
      left: direction === 'right' ? amount : -amount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFF] overflow-x-hidden pt-20 pb-20 md:pb-0 flex flex-col">
      <Header isMobile={isMobile} phase="IDLE" stateLabels={stateLabels} />

      <main className="flex-1 w-full px-4 md:px-8 py-6 md:py-8">
        <div className="max-w-6xl mx-auto">
          {/* 상단 헤더 영역 */}
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#0D1B2A]">내 프로젝트</h1>
              <p className="text-[#5A6F8A] mt-1">진행 중인 프로젝트를 한눈에 관리하세요.</p>
            </div>
            <button
              onClick={() => navigate('/create-project')}
              className="flex items-center gap-2 bg-[#0099CC] hover:bg-[#007EA7] text-white px-5 py-2.5 rounded-xl transition-all shadow-sm"
            >
              <PIcon name="plus" size={20} />
              <span>새 프로젝트 생성</span>
            </button>
          </div>

          {/* 검색/필터/보기 전환 */}
          <div className="mb-6 rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-4 sm:p-5 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-5">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="프로젝트명 또는 카테고리 검색"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl focus:outline-none focus:border-[#0099CC]"
                />
              </div>

              <div className="lg:col-span-3">
                <div className="relative" ref={sortDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsSortOpen((prev) => !prev)}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition flex items-center justify-between ${
                      isSortOpen
                        ? 'bg-[#EEF3FF] border-[#0099CC]/40 shadow-[0_0_0_3px_rgba(0,153,204,0.12)] text-[#0D1B2A]'
                        : 'bg-[#F8FAFF] border-[rgba(0,100,180,0.12)] text-[#0D1B2A] hover:border-[rgba(0,153,204,0.4)]'
                    }`}
                  >
                    <span className="font-medium">정렬: {sortFilter}</span>
                    <PIcon
                      name="chevronDown"
                      size={14}
                      className={`text-[#5A6F8A] transition-transform ${isSortOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isSortOpen && (
                    <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)]">
                      {sortOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setSortFilter(option);
                            setIsSortOpen(false);
                          }}
                          className={`w-full px-3.5 py-2.5 text-sm text-left flex items-center justify-between transition-colors ${
                            sortFilter === option
                              ? 'bg-[#EEF3FF] text-[#0099CC] font-semibold'
                              : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'
                          }`}
                        >
                          <span>{option}</span>
                          {sortFilter === option && <PIcon name="check" size={14} className="text-[#0099CC]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('card')}
                  className={`flex-1 py-2.5 text-sm rounded-xl border transition ${
                    viewMode === 'card'
                      ? 'bg-[#EEF3FF] text-[#0099CC] border-[#0099CC]/30 font-semibold'
                      : 'bg-white text-[#5A6F8A] border-[rgba(0,100,180,0.12)]'
                  }`}
                >
                  카드형
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`flex-1 py-2.5 text-sm rounded-xl border transition ${
                    viewMode === 'list'
                      ? 'bg-[#EEF3FF] text-[#0099CC] border-[#0099CC]/30 font-semibold'
                      : 'bg-white text-[#5A6F8A] border-[rgba(0,100,180,0.12)]'
                  }`}
                >
                  리스트형
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((category) => (
                (() => {
                  const palette = getCategoryPalette(category);
                  const isActive = categoryFilter === category;
                  return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition font-semibold ${isActive ? '' : 'opacity-80 hover:opacity-100'}`}
                  style={{
                    backgroundColor: palette.bg,
                    color: palette.text,
                    borderColor: palette.border,
                    boxShadow: isActive ? `0 0 0 2px ${palette.border}` : 'none'
                  }}
                >
                  {category}
                </button>
                  );
                })()
              ))}
            </div>
          </div>

          {groupedEntries.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[rgba(0,100,180,0.18)] bg-white p-10 text-center">
              <p className="text-[#0D1B2A] font-semibold">검색 결과가 없습니다.</p>
              <p className="text-sm text-[#5A6F8A] mt-1">검색어나 필터를 변경해 보세요.</p>
            </div>
          )}

          {groupedEntries.length > 0 && groupedEntries.map(([categoryName, items]) => (
            <section key={categoryName} className="mb-8 last:mb-0">
              {(() => {
                const groupPalette = getCategoryPalette(categoryName);
                return (
              <div className="mb-3 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: groupPalette.accent }}></span>
                <span className="text-sm font-bold text-[#0D1B2A]">{categoryName}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: groupPalette.bg, color: groupPalette.text }}>
                  {items.length}개
                </span>
              </div>
                );
              })()}

              {viewMode === 'card' ? (
                <div className="space-y-2">
                  <div className="hidden md:flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => scrollCategoryRail(categoryName, 'left')}
                      className="w-8 h-8 rounded-full border border-[rgba(0,100,180,0.14)] bg-white text-[#5A6F8A] hover:text-[#0099CC] hover:border-[#0099CC]/35 flex items-center justify-center"
                      aria-label={`${categoryName} 왼쪽으로 이동`}
                    >
                      <PIcon name="chevronRight" size={14} className="rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollCategoryRail(categoryName, 'right')}
                      className="w-8 h-8 rounded-full border border-[rgba(0,100,180,0.14)] bg-white text-[#5A6F8A] hover:text-[#0099CC] hover:border-[#0099CC]/35 flex items-center justify-center"
                      aria-label={`${categoryName} 오른쪽으로 이동`}
                    >
                      <PIcon name="chevronRight" size={14} />
                    </button>
                  </div>

                  <div
                    ref={(el) => { categoryRailRefs.current[categoryName] = el; }}
                    className="flex gap-4 overflow-x-auto md:overflow-x-hidden pb-2 px-1 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {items.map((project) => (
                      (() => {
                        const palette = getCategoryPalette(project.category);
                        return (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/project/${project.id}/meetings`)}
                      className="snap-start shrink-0 w-[250px] sm:w-[264px] bg-[#FFFFFF] p-4 rounded-xl border border-[rgba(0,100,180,0.12)] shadow-sm hover:shadow-md hover:border-[#0099CC] transition-all duration-300 group cursor-pointer"
                    >
                      <div className="relative flex items-start justify-between mb-2" data-project-menu-root="true">
                        <p className="text-[11px] text-[#8A9AB0]">생성일 {project.createdAt}</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuProjectId((prev) => (prev === project.id ? null : project.id));
                          }}
                          className="text-[#5A6F8A] opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:text-[#0099CC]"
                        >
                          <PIcon name="moreVertical" size={18} />
                        </button>

                        {openMenuProjectId === project.id && (
                          <div className="absolute right-0 top-full mt-1 w-32 rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_24px_rgba(0,100,180,0.14)] overflow-hidden z-30">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuProjectId(null);
                                navigate('/configuration');
                              }}
                              className="w-full px-3 py-2.5 text-left text-sm text-[#0D1B2A] hover:bg-[#EEF3FF]"
                            >
                              설정 페이지
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuProjectId(null);
                                navigate(`/project/${project.id}/meetings`);
                              }}
                              className="w-full px-3 py-2.5 text-left text-sm text-[#0D1B2A] hover:bg-[#EEF3FF]"
                            >
                              회의 목록
                            </button>
                          </div>
                        )}
                      </div>

                      <h3 className="text-base font-semibold mb-2 text-[#0D1B2A] leading-snug">
                        {project.name}
                      </h3>

                      <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: palette.bg, color: palette.text }}>
                        {project.category}
                      </span>

                      <div className="mt-4 pt-3 border-t border-[rgba(0,100,180,0.12)] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-sm text-[#5A6F8A]">
                          <PIcon name="users" size={16} />
                          <span className="text-xs sm:text-sm">{project.teamLead}님 외 {Math.max(project.members - 1, 0)}명</span>
                        </div>
                        <div className="text-xs text-[#5A6F8A]">{project.updatedAt}</div>
                      </div>
                    </div>
                        );
                      })()
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white overflow-hidden">
                  {items.map((project, idx) => (
                    (() => {
                      const palette = getCategoryPalette(project.category);
                      return (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/project/${project.id}/meetings`)}
                      className={`px-4 sm:px-5 py-3.5 flex items-start justify-between gap-4 cursor-pointer hover:bg-[#F8FAFF] ${idx !== items.length - 1 ? 'border-b border-[rgba(0,100,180,0.08)]' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] text-[#8A9AB0]">생성일 {project.createdAt}</p>
                          <span
                            className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: palette.bg, color: palette.text }}
                          >
                            {project.category}
                          </span>
                        </div>
                        <h4 className="text-sm sm:text-base font-semibold text-[#0D1B2A] mt-1 truncate">{project.name}</h4>

                        <div className="mt-2 flex items-center gap-1.5 text-[#5A6F8A]">
                          <PIcon name="users" size={15} />
                          <span className="text-xs sm:text-sm">{project.teamLead}님 외 {Math.max(project.members - 1, 0)}명</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5 text-[#5A6F8A] pt-0.5">
                        <span className="text-xs">{project.updatedAt}</span>
                        <span className="hidden sm:inline text-xs font-semibold text-[#0099CC]">열기</span>
                        <PIcon name="chevronRight" size={14} />
                      </div>
                    </div>
                      );
                    })()
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </main>

      {!isMobile && <Footer />}
      {isMobile && <MobileTab active={activeTab} onChange={setActiveTab} />}
    </div>
  );
};

export default ProjectList;