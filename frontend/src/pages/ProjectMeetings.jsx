import { useMemo, useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
		myActionItems: [{ id: 'ux-1', text: 'VOC 태깅 기준 재정의', due: '2026.06.24' }],
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

const PROJECT_OVERRIDE_STORAGE_KEY = 'tiki_project_overrides';

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

function normalizeProject(project) {
	if (!project) return null;
	const participants = Array.isArray(project.participants) ? project.participants : [];
	const meetings = Array.isArray(project.meetings)
		? project.meetings.map((meeting, idx) => ({
				id: meeting.id || `m-${project.id}-${idx + 1}`,
				date: meeting.date || '',
				title: meeting.title || '회의 제목 없음',
				status: meeting.status || '진행 중',
				type: meeting.type || '정기',
				tags: Array.isArray(meeting.tags) && meeting.tags.length > 0 ? meeting.tags : [`#${project.category || '회의'}`],
				participants: Array.isArray(meeting.participants) && meeting.participants.length > 0 ? meeting.participants : participants,
				summary: meeting.summary || '회의 요약이 아직 등록되지 않았습니다.',
				actionItems: typeof meeting.actionItems === 'number' ? meeting.actionItems : 0,
				jiraLinked: typeof meeting.jiraLinked === 'number' ? meeting.jiraLinked : 0,
			}))
		: [];
	return {
		id: project.id,
		name: project.name || '프로젝트',
		category: project.category || '기타',
		createdAt: project.createdAt || '',
		status: project.status || '진행 중',
		teamLead: project.teamLead || participants[0] || '담당자',
		participants,
		myActionItems: Array.isArray(project.myActionItems) ? project.myActionItems : [],
		meetings,
	};
}

export default function ProjectMeetings() {
	const navigate = useNavigate();
	const location = useLocation();
	const { projectId } = useParams();
	const createDropdownRef = useRef(null);
	const sortDropdownRef = useRef(null);
	const typeDropdownRef = useRef(null);
	const toastTimerRef = useRef(null);
	const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
	const [activeTab, setActiveTab] = useState('home');
	const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
	const [participantsModalMembers, setParticipantsModalMembers] = useState([]);
	const [participantsModalTitle, setParticipantsModalTitle] = useState('회의 참여자');
	const [deletedMeetingIds, setDeletedMeetingIds] = useState([]);
	const [pendingDeleteMeeting, setPendingDeleteMeeting] = useState(null);
	const [toast, setToast] = useState({ message: '', type: 'info' });
	const [projectSearch, setProjectSearch] = useState('');
	const [meetingSearch, setMeetingSearch] = useState('');
	const [sortOrder, setSortOrder] = useState('최신순');
	const [meetingType, setMeetingType] = useState('전체');
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isSortOpen, setIsSortOpen] = useState(false);
	const [isTypeOpen, setIsTypeOpen] = useState(false);

	useEffect(() => {
		const handleResize = () => setIsMobile(window.innerWidth < 768);
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	useEffect(() => {
		const handleOutsideClick = (e) => {
			if (createDropdownRef.current && !createDropdownRef.current.contains(e.target)) setIsCreateOpen(false);
			if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) setIsSortOpen(false);
			if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) setIsTypeOpen(false);
		};
		document.addEventListener('mousedown', handleOutsideClick);
		return () => document.removeEventListener('mousedown', handleOutsideClick);
	}, []);

	useEffect(() => () => {
		if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
	}, []);

	const stateLabels = {
		IDLE: '대기 중',
		UPLOADING: '업로드 중',
		PROCESSING: 'AI 분석 중',
		COMPLETED: '분석 완료',
		FAILED: '오류 발생',
	};

	const projectOverrides = useMemo(() => readProjectOverrides(), [location.key]);

	const project = useMemo(() => {
		const id = Number(projectId);
		const override = projectOverrides[String(id)] || null;
		const byId = PROJECTS.find((p) => p.id === id);
		if (byId) {
			return normalizeProject({
				...byId,
				...(override || {}),
				participants: Array.isArray(override?.participants) ? override.participants : byId.participants,
				admins: Array.isArray(override?.admins) ? override.admins : byId.admins,
			});
		}
		const stateProject = location.state?.project;
		if (stateProject && Number(stateProject.id) === id) {
			return normalizeProject({
				...stateProject,
				...(override || {}),
				participants: Array.isArray(override?.participants) ? override.participants : stateProject.participants,
				admins: Array.isArray(override?.admins) ? override.admins : stateProject.admins,
			});
		}
		if (override && Number(override.id) === id) return normalizeProject(override);
		return null;
	}, [projectId, location.state, projectOverrides]);

	const projectCandidates = useMemo(() => {
		const merged = PROJECTS.map((item) => {
			const override = projectOverrides[String(item.id)];
			if (!override) return item;
			return normalizeProject({
				...item,
				...override,
				participants: Array.isArray(override.participants) ? override.participants : item.participants,
				admins: Array.isArray(override.admins) ? override.admins : item.admins,
			});
		});

		if (!project) return merged;
		const exists = merged.some((p) => p.id === project.id);
		return exists ? merged : [project, ...merged];
	}, [project, projectOverrides]);

	const filteredProjects = useMemo(() => {
		const q = projectSearch.trim().toLowerCase();
		if (!q) return projectCandidates;
		return projectCandidates.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
	}, [projectSearch, projectCandidates]);

	const visibleMeetings = useMemo(() => {
		if (!project) return [];
		const q = meetingSearch.trim().toLowerCase();
		let result = project.meetings.filter((m) => {
			if (deletedMeetingIds.includes(m.id)) return false;
			const typeOk = meetingType === '전체' || m.type === meetingType;
			const searchOk = !q || m.title.toLowerCase().includes(q) || m.summary.toLowerCase().includes(q) || m.tags.join(' ').toLowerCase().includes(q);
			return typeOk && searchOk;
		});
		result = result.sort((a, b) => (sortOrder === '과거순' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
		return result;
	}, [project, meetingSearch, meetingType, sortOrder, deletedMeetingIds]);

	const stats = useMemo(() => {
		if (!project) return { totalMeetings: 0, totalActionItems: 0, totalJiraLinked: 0 };
		const totalMeetings = project.meetings.length;
		const totalActionItems = project.meetings.reduce((sum, m) => sum + m.actionItems, 0);
		const totalJiraLinked = project.meetings.reduce((sum, m) => sum + m.jiraLinked, 0);
		return { totalMeetings, totalActionItems, totalJiraLinked };
	}, [project]);

	if (!project) {
		return (
			<div className="min-h-screen bg-[#F8FAFF] overflow-x-hidden pt-20 pb-20 md:pb-0 flex flex-col">
				<Header isMobile={isMobile} phase="IDLE" stateLabels={stateLabels} />
				<main className="flex-1 w-full px-4 md:px-8 py-6 md:py-8">
					<div className="max-w-4xl mx-auto rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-8 text-center">
						<p className="text-lg font-bold text-[#0D1B2A]">프로젝트를 찾을 수 없습니다.</p>
						<p className="text-sm text-[#5A6F8A] mt-2">프로젝트 목록에서 다시 선택해 주세요.</p>
						<button type="button" onClick={() => navigate('/project-list')} className="mt-5 px-4 py-2 rounded-lg bg-[#0099CC] text-white text-sm font-semibold hover:bg-[#007EA7]">
							프로젝트 목록으로 이동
						</button>
					</div>
				</main>
				{!isMobile && <Footer />}
				{isMobile && <MobileTab active={activeTab} onChange={setActiveTab} />}
			</div>
		);
	}

	const visibleParticipants = project.participants.slice(0, 4);
	const hiddenParticipantsCount = Math.max(project.participants.length - visibleParticipants.length, 0);
	const adminNames = useMemo(() => {
		const participants = Array.isArray(project.participants) ? project.participants : [];
		const fromProject = Array.isArray(project.admins)
			? project.admins.filter((name) => participants.includes(name))
			: [];

		if (fromProject.length > 0) {
			return [...new Set(fromProject)];
		}

		if (project.teamLead && participants.includes(project.teamLead)) {
			return [project.teamLead];
		}

		return [];
	}, [project]);
	const showToast = (msg, type = 'info') => {
		setToast({ message: msg, type });
		if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
		toastTimerRef.current = setTimeout(() => setToast({ message: '', type: 'info' }), 2200);
	};
	const openParticipantsModal = (members = project.participants, title = '회의 참여자') => {
		const normalized = Array.isArray(members) && members.length > 0 ? members : project.participants;
		setParticipantsModalMembers(normalized);
		setParticipantsModalTitle(title);
		setIsParticipantsModalOpen(true);
	};
	const closeParticipantsModal = () => setIsParticipantsModalOpen(false);
	const handleEditMeeting = () => {
		showToast('수정 기능은 다음 단계에서 연결 예정입니다.', 'ai');
	};
	const handleDeleteMeeting = (meetingId) => {
		setPendingDeleteMeeting(meetingId);
	};
	const confirmDeleteMeeting = () => {
		if (!pendingDeleteMeeting) return;
		setDeletedMeetingIds((prev) => [...prev, pendingDeleteMeeting]);
		showToast('회의가 목록에서 삭제되었습니다.', 'success');
		setPendingDeleteMeeting(null);
	};
	const currentToastVariant = TOAST_VARIANTS[toast.type] || TOAST_VARIANTS.info;

	useEffect(() => {
		if (!isParticipantsModalOpen) return undefined;

		const handleEscClose = (e) => {
			if (e.key === 'Escape') {
				closeParticipantsModal();
			}
		};

		document.addEventListener('keydown', handleEscClose);
		return () => document.removeEventListener('keydown', handleEscClose);
	}, [isParticipantsModalOpen]);

	return (
		<div className="min-h-screen bg-[#F8FAFF] overflow-x-hidden pt-20 pb-20 md:pb-0 flex flex-col">
			<Header isMobile={isMobile} phase="IDLE" stateLabels={stateLabels} />
			<main className="flex-1 w-full px-4 md:px-8 py-6 md:py-8">
				<div className="max-w-7xl mx-auto">
					<div className="mb-4">
						<button type="button" onClick={() => navigate('/project-list')} className="text-sm text-[#5A6F8A] hover:text-[#0D1B2A]">← 프로젝트 목록</button>
					</div>
					<div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
						<aside className="hidden md:block xl:col-span-3">
							<section className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-4">
								<h3 className="text-sm font-bold text-[#0D1B2A] mb-3">프로젝트</h3>
								<input value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} placeholder="프로젝트 검색" className="w-full px-3 py-2 text-sm rounded-xl border border-[rgba(0,100,180,0.12)] bg-[#F8FAFF] focus:outline-none focus:border-[#0099CC]" />
								<div className="mt-3 space-y-2 max-h-[220px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
									{filteredProjects.map((item) => (
										<button key={item.id} type="button" onClick={() => navigate(`/project/${item.id}/meetings`, { state: { project: item } })} className={`w-full text-left px-3 py-2.5 rounded-xl border transition ${item.id === project.id ? 'bg-[#EEF3FF] border-[#0099CC]/35 text-[#0099CC] font-semibold' : 'bg-white border-[rgba(0,100,180,0.12)] text-[#0D1B2A] hover:bg-[#F8FAFF]'}`}>
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
										<div className="mt-3 flex items-center gap-2.5">
											<div className="flex -space-x-2 cursor-pointer" onClick={() => openParticipantsModal(project.participants, '프로젝트 참여자')}>
												{visibleParticipants.map((name) => (
													<span key={name} className="w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center border-2 border-white text-white" style={{ backgroundColor: PARTICIPANT_COLOR_MAP[name] || '#0099CC' }} title={name}>
														{name.slice(0, 1)}
													</span>
												))}
												{hiddenParticipantsCount > 0 && <span className="w-7 h-7 rounded-full bg-slate-400 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">+{hiddenParticipantsCount}</span>}
											</div>
											<button type="button" onClick={() => openParticipantsModal(project.participants, '프로젝트 참여자')} className="text-xs text-slate-400 hover:text-slate-600">
												{project.teamLead}님 외 {Math.max(project.participants.length - 1, 0)}명 참여
											</button>
										</div>
									</div>
									<button type="button" onClick={() => navigate('/configuration', { state: { project } })} className="shrink-0 w-10 h-10 rounded-xl border border-[rgba(0,100,180,0.12)] text-[#5A6F8A] hover:text-[#0099CC] hover:border-[#0099CC]/35 flex items-center justify-center" aria-label="프로젝트 설정 이동">
										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.82-.33 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.5 1Z" /></svg>
									</button>
								</div>
							</section>

							<section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
								<div className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-4"><h3 className="text-sm font-bold text-[#0D1B2A] mb-3">요약</h3><div className="grid grid-cols-3 gap-2"><div className="rounded-xl bg-[#F8FAFF] border border-[rgba(0,100,180,0.1)] p-3 text-center"><p className="text-[11px] text-[#5A6F8A]">총 회의</p><p className="text-lg font-bold text-[#0D1B2A]">{stats.totalMeetings}회</p></div><div className="rounded-xl bg-[#F8FAFF] border border-[rgba(0,100,180,0.1)] p-3 text-center"><p className="text-[11px] text-[#5A6F8A]">완료 Action</p><p className="text-lg font-bold text-[#0D1B2A]">{stats.totalActionItems}개</p></div><div className="rounded-xl bg-[#F8FAFF] border border-[rgba(0,100,180,0.1)] p-3 text-center"><p className="text-[11px] text-[#5A6F8A]">Jira 연동</p><p className="text-lg font-bold text-[#0D1B2A]">{stats.totalJiraLinked}개</p></div></div></div>
								<div className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-4"><h3 className="text-sm font-bold text-[#0D1B2A] mb-3">내 할 일</h3><div className="space-y-2">{project.myActionItems.slice(0, 5).map((item) => (<label key={item.id} className="flex items-start gap-2 rounded-xl border border-[rgba(0,100,180,0.1)] bg-[#F8FAFF] p-2.5"><input type="checkbox" className="mt-0.5" /><span className="flex-1 text-sm text-[#0D1B2A]">{item.text}</span><span className="text-[11px] text-[#5A6F8A]">{item.due}</span></label>))}</div></div>
							</section>

							<section className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-4">
								<div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
									<div className="lg:col-span-3 relative" ref={createDropdownRef}>
										<button type="button" onClick={() => setIsCreateOpen((prev) => !prev)} className={`w-full px-4 py-2.5 rounded-xl text-white font-semibold transition flex items-center justify-center ${isCreateOpen ? 'bg-[#007EA7]' : 'bg-[#0099CC] hover:bg-[#007EA7]'}`}>
											<span>+ 새 회의록</span>
										</button>
										{isCreateOpen && (
											<div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.16)] bg-white shadow-[0_12px_28px_rgba(0,100,180,0.18)]">
												<button type="button" onClick={() => { setIsCreateOpen(false); navigate('/meeting-create', { state: { projectId: project.id, projectName: project.name } }); }} className="w-full px-3.5 py-3 text-left hover:bg-[#EEF3FF]"><p className="text-sm font-semibold text-[#0D1B2A]">회의록 직접 작성</p><p className="text-xs text-[#5A6F8A] mt-0.5">템플릿에 바로 입력해서 회의록을 생성합니다.</p></button>
												<button type="button" onClick={() => { setIsCreateOpen(false); navigate('/upload', { state: { from: 'project-meetings', projectId: project.id, projectName: project.name } }); }} className="w-full px-3.5 py-3 text-left border-t border-[rgba(0,100,180,0.08)] hover:bg-[#EEF3FF]"><p className="text-sm font-semibold text-[#0D1B2A]">회의 파일 업로드</p><p className="text-xs text-[#5A6F8A] mt-0.5">녹음 파일을 올려 AI 회의록을 자동 생성합니다.</p></button>
											</div>
										)}
									</div>
									<input value={meetingSearch} onChange={(e) => setMeetingSearch(e.target.value)} placeholder="회의록 검색" className="lg:col-span-5 px-3.5 py-2.5 text-sm bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl focus:outline-none focus:border-[#0099CC]" />
									<div className="lg:col-span-2 relative" ref={sortDropdownRef}>
										<button type="button" onClick={() => setIsSortOpen((prev) => !prev)} className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition flex items-center justify-between ${isSortOpen ? 'bg-[#EEF3FF] border-[#0099CC]/40 shadow-[0_0_0_3px_rgba(0,153,204,0.12)] text-[#0D1B2A]' : 'bg-[#F8FAFF] border-[rgba(0,100,180,0.12)] text-[#0D1B2A] hover:border-[rgba(0,153,204,0.4)]'}`}><span className="font-medium">{sortOrder}</span><span className={`text-xs text-[#5A6F8A] transition-transform ${isSortOpen ? 'rotate-180' : ''}`}>▼</span></button>
										{isSortOpen && <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)]">{['최신순', '과거순'].map((option) => (<button key={option} type="button" onClick={() => { setSortOrder(option); setIsSortOpen(false); }} className={`w-full px-3.5 py-2.5 text-sm text-left flex items-center justify-between transition-colors ${sortOrder === option ? 'bg-[#EEF3FF] text-[#0099CC] font-semibold' : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'}`}><span>{option}</span>{sortOrder === option && <span className="text-[#0099CC]">✓</span>}</button>))}</div>}
									</div>
									<div className="lg:col-span-2 relative" ref={typeDropdownRef}>
										<button type="button" onClick={() => setIsTypeOpen((prev) => !prev)} className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition flex items-center justify-between ${isTypeOpen ? 'bg-[#EEF3FF] border-[#0099CC]/40 shadow-[0_0_0_3px_rgba(0,153,204,0.12)] text-[#0D1B2A]' : 'bg-[#F8FAFF] border-[rgba(0,100,180,0.12)] text-[#0D1B2A] hover:border-[rgba(0,153,204,0.4)]'}`}><span className="font-medium">{meetingType}</span><span className={`text-xs text-[#5A6F8A] transition-transform ${isTypeOpen ? 'rotate-180' : ''}`}>▼</span></button>
										{isTypeOpen && <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)]">{['전체', '정기', '수시'].map((option) => (<button key={option} type="button" onClick={() => { setMeetingType(option); setIsTypeOpen(false); }} className={`w-full px-3.5 py-2.5 text-sm text-left flex items-center justify-between transition-colors ${meetingType === option ? 'bg-[#EEF3FF] text-[#0099CC] font-semibold' : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'}`}><span>{option}</span>{meetingType === option && <span className="text-[#0099CC]">✓</span>}</button>))}</div>}
									</div>
								</div>
							</section>

							<section className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white overflow-hidden">
								{visibleMeetings.length === 0 ? (
									<div className="px-4 py-12 text-center"><p className="text-sm font-semibold text-[#0D1B2A]">아직 생성된 회의록이 없습니다.</p><p className="text-xs text-[#5A6F8A] mt-1">첫 회의록을 작성해보세요.</p><div className="mt-4 inline-flex gap-2"><button type="button" onClick={() => navigate('/meeting-create', { state: { projectId: project.id, projectName: project.name } })} className="px-4 py-2 rounded-lg bg-[#0099CC] text-white text-sm font-semibold hover:bg-[#007EA7]">회의록 직접 작성</button><button type="button" onClick={() => navigate('/upload', { state: { from: 'project-meetings', projectId: project.id, projectName: project.name } })} className="px-4 py-2 rounded-lg border border-[rgba(0,100,180,0.16)] text-[#5A6F8A] text-sm font-semibold hover:bg-[#F8FAFF]">회의 파일 업로드</button></div></div>
								) : (
									<>
										<div className="hidden md:grid grid-cols-12 px-4 py-3 text-xs font-bold text-[#5A6F8A] bg-[#F8FAFF] border-b border-[rgba(0,100,180,0.1)]"><div className="col-span-2">회의 날짜</div><div className="col-span-3">회의 제목</div><div className="col-span-2">상태</div><div className="col-span-3">주요 태그</div><div className="col-span-2 text-right">관리</div></div>
										<div className="hidden md:block">{visibleMeetings.map((meeting) => (<div key={meeting.id} className="grid grid-cols-12 px-4 py-3 items-center border-b border-[rgba(0,100,180,0.08)] last:border-b-0"><div className="col-span-2 text-sm text-[#5A6F8A]">{meeting.date}</div><button type="button" onClick={() => navigate('/meeting-detail')} className="col-span-3 text-left text-sm font-semibold text-[#0D1B2A] hover:text-[#0099CC]">{meeting.title}</button><div className="col-span-2"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(meeting.status)}`}>{meeting.status}</span></div><div className="col-span-3 flex flex-wrap gap-1">{meeting.tags.map((tag) => (<span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-[#EEF3FF] text-[#0099CC]">{tag}</span>))}</div><div className="col-span-2 flex justify-end gap-2"><button type="button" onClick={handleEditMeeting} className="text-xs text-[#5A6F8A] hover:text-[#0099CC]">수정</button><button type="button" onClick={() => handleDeleteMeeting(meeting.id)} className="text-xs text-[#5A6F8A] hover:text-[#EF4444]">삭제</button></div></div>))}</div>
										<div className="md:hidden divide-y divide-[rgba(0,100,180,0.08)]">{visibleMeetings.map((meeting) => (<article key={meeting.id} className="p-4 space-y-2.5"><div className="flex items-start justify-between gap-2"><span className="text-xs text-[#5A6F8A]">{meeting.date}</span><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(meeting.status)}`}>{meeting.status}</span></div><button type="button" onClick={() => navigate('/meeting-detail')} className="text-left text-sm font-semibold text-[#0D1B2A] leading-snug">{meeting.title}</button><div className="flex flex-wrap gap-1">{meeting.tags.map((tag) => (<span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-[#EEF3FF] text-[#0099CC]">{tag}</span>))}</div><div className="flex justify-end gap-3 pt-1"><button type="button" onClick={handleEditMeeting} className="text-xs text-[#5A6F8A] hover:text-[#0099CC]">수정</button><button type="button" onClick={() => handleDeleteMeeting(meeting.id)} className="text-xs text-[#5A6F8A] hover:text-[#EF4444]">삭제</button></div></article>))}</div>
									</>
								)}
							</section>
						</section>
					</div>
				</div>
			</main>
			{isParticipantsModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
					<div className="absolute inset-0 bg-[#0D1B2A]/40 backdrop-blur-[2px]" onClick={closeParticipantsModal} />
					<div className="relative w-full max-w-md rounded-3xl border border-[rgba(0,100,180,0.12)] bg-white shadow-2xl overflow-hidden" style={{ maxHeight: isMobile ? '72vh' : '80vh' }}>
						<div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
							<p className="text-sm font-bold text-slate-900">{participantsModalTitle}</p>
							<button type="button" onClick={closeParticipantsModal} className="text-slate-400 hover:text-slate-700" aria-label="참여자 팝업 닫기">✕</button>
						</div>
						<div className="px-5 py-4 overflow-y-auto">
							<p className="text-xs text-slate-400 mb-2">총 {participantsModalMembers.length}명 참여</p>
							<div className="space-y-2 pr-1">
								{participantsModalMembers.map((member) => (
									<div key={member} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200">
										<div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: PARTICIPANT_COLOR_MAP[member] || '#0099CC' }}>
											{member.slice(0, 1)}
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-1.5 min-w-0">
												<p className="text-sm font-semibold text-slate-900 truncate">{member}</p>
												{adminNames.includes(member) && (
													<span title="관리자 권한" className="inline-flex items-center text-sky-600 shrink-0">
														<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
													</span>
												)}
											</div>
											<p className="text-xs text-slate-400">{ROLE_MAP[member] || 'Team Member'}</p>
										</div>
										<span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-600">참여 중</span>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			)}
			{pendingDeleteMeeting && (
				<div className="fixed inset-0 z-[65] flex items-center justify-center p-4" aria-modal="true" role="dialog">
					<div className="absolute inset-0 bg-[#0D1B2A]/45" onClick={() => setPendingDeleteMeeting(null)} />
					<div className="relative w-full max-w-sm rounded-3xl border border-[rgba(0,100,180,0.12)] bg-white p-6 shadow-2xl">
						<p className="text-base font-bold text-slate-900">회의를 삭제할까요?</p>
						<p className="mt-2 text-sm text-slate-500">삭제하면 목록에서 사라집니다. 이 작업을 진행하시겠습니까?</p>
						<div className="mt-5 flex justify-end gap-2">
							<button type="button" onClick={() => setPendingDeleteMeeting(null)} className="px-3.5 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">취소</button>
							<button type="button" onClick={confirmDeleteMeeting} className="px-3.5 py-2 rounded-lg bg-[#EF4444] text-white text-sm font-semibold hover:bg-[#DC2626]">삭제</button>
						</div>
					</div>
				</div>
			)}
			{toast.message && (
				<div
					className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-[70] px-4 w-full sm:w-auto"
					style={{
						bottom: isMobile ? 'calc(env(safe-area-inset-bottom) + 5.75rem)' : '1.5rem',
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
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={currentToastVariant.icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							{toast.type === 'error' && <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>}
							{toast.type === 'warning' && <><path d="M10.29 3.86 1.82 18A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>}
							{toast.type === 'success' && (
								<>
									<circle cx="12" cy="12" r="10" fill={TOAST_COLORS.success} stroke="none" />
									<path d="M16.7 9.2 10.6 15.3 7.2 11.9" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
								</>
							)}
							{(toast.type === 'info' || toast.type === 'ai') && <><circle cx="12" cy="12" r="10" /><path d="M12 10v6" /><path d="M12 7h.01" /></>}
						</svg>
						{toast.message}
					</div>
				</div>
			)}
			{!isMobile && <Footer />}
			{isMobile && <MobileTab active={activeTab} onChange={setActiveTab} />}
		</div>
	);
}

