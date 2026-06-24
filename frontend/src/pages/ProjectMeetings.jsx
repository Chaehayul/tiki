import { useMemo, useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MobileTab from '../components/MobileTab';

const PROJECTS = [
	{
		id: 1,
		name: 'AI 회의록 자동화',
		description: '회의 녹음 파일 기반으로 AI가 요약하고 Jira 액션 아이템까지 자동 매핑하는 프로젝트입니다.',
		createdAt: '2026-06-01',
		status: '진행 중',
		teamLead: '정아름',
		participants: ['정아름', '김민수', '송지영', '김소현', '채하율'],
		myActionItems: [
			{ id: 'ai-1', text: 'STT 응답 속도 5초 이하로 최적화', due: '2026.06.18', assignee: '김민수', status: '검증 전', source: '주간 스프린트 회의' },
			{ id: 'ai-2', text: 'Jira 발행 규칙 QA 시나리오 검증', due: '2026.06.20', assignee: '정아름', status: '연동 완료', source: '요구사항 정제 미팅' },
			{ id: 'ai-3', text: '화자 분리 모델 재학습 데이터 정리', due: '2026.06.22', assignee: '김소현', status: '완료', source: '배포 리스크 점검' },
		],
		meetings: [
			{ id: 'm-101', date: '2026.06.16', title: '주간 스프린트 회의', status: '진행 중', type: '정기', tags: ['#개발', '#Jira연동'], participants: ['정아름', '김민수', '송지영'], summary: 'Sprint 12 목표를 정리하고 STT 성능 최적화 일정과 Jira 발행 기준을 확정했습니다.', actionItems: 6, jiraLinked: 2 },
			{ id: 'm-102', date: '2026.06.13', title: '요구사항 정제 미팅', status: '완료', type: '수시', tags: ['#기획', '#개발'], participants: ['정아름', '김소현', '채하율'], summary: '업로드 단계 UX 개선안과 회의록 자동 분류 태그 정책을 합의했습니다.', actionItems: 4, jiraLinked: 1 },
			{ id: 'm-103', date: '2026.06.11', title: '배포 리스크 점검', status: 'Jira 발행됨', type: '정기', tags: ['#개발', '#배포'], participants: ['정아름', '김민수'], summary: '배포 전 체크리스트와 장애 대응 절차를 재정의했습니다.', actionItems: 5, jiraLinked: 3 },
		],
	},
	{
		id: 2,
		name: '디자인 시스템 구축',
		description: '컴포넌트/토큰 규칙을 통일해 제품 전반의 UI 일관성과 협업 속도를 높이는 프로젝트입니다.',
		createdAt: '2026-05-27',
		status: '진행 중',
		teamLead: '박디자이너',
		participants: ['박디자이너', '정아름', '송지영'],
		myActionItems: [
			{ id: 'ds-1', text: '컴포넌트 토큰 문서 버전업', due: '2026.06.18', assignee: '박디자이너', status: '검증 전', source: '컴포넌트 토큰 정리' },
			{ id: 'ds-2', text: '버튼/폼 공통 스타일 QA', due: '2026.06.21', assignee: '송지영', status: '연동 완료', source: '컴포넌트 토큰 정리' },
		],
		meetings: [
			{ id: 'm-201', date: '2026.06.12', title: '컴포넌트 토큰 정리', status: '완료', type: '정기', tags: ['#디자인'], participants: ['박디자이너', '송지영'], summary: '컬러/타이포 토큰 네이밍 규칙을 통일하고 릴리즈 정책을 정했습니다.', actionItems: 3, jiraLinked: 1 },
		],
	},
	{
		id: 3,
		name: '사용자 인터뷰 분석',
		description: '인터뷰 VOC를 구조화해 핵심 인사이트를 도출하고 기능 우선순위 수립에 반영하는 프로젝트입니다.',
		createdAt: '2026-05-19',
		status: '보류',
		teamLead: '김소현',
		participants: ['김소현', '송지영', '채하율', '외부리서처A'],
		myActionItems: [{ id: 'ux-1', text: 'VOC 태깅 기준 재정의', due: '2026.06.24', assignee: '김소현', status: '검증 전', source: 'VOC 인사이트 공유' }],
		meetings: [
			{ id: 'm-301', date: '2026.06.05', title: '인터뷰 질문지 정합성 점검', status: '완료', type: '정기', tags: ['#리서치'], participants: ['김소현', '외부리서처A'], summary: '질문 플로우 중복 항목을 정리하고 인터뷰 기록 템플릿을 표준화했습니다.', actionItems: 2, jiraLinked: 0 },
			{ id: 'm-302', date: '2026.06.11', title: 'VOC 인사이트 공유', status: '진행 중', type: '수시', tags: ['#VOC', '#기획'], participants: ['김소현', '송지영', '채하율'], summary: '주요 페인포인트 3개를 도출해 우선순위 액션 아이템으로 등록했습니다.', actionItems: 4, jiraLinked: 1 },
		],
	},
	{
		id: 4,
		name: '분기별 기획안',
		description: '분기 로드맵과 핵심 과제를 정리하고 실행 우선순위를 확정하는 기획 프로젝트입니다.',
		createdAt: '2026-06-08',
		status: '완료',
		teamLead: '송지영',
		participants: ['송지영', '김소현', '정아름', '김민수'],
		myActionItems: [
			{ id: 'p-1', text: '분기 로드맵 공유안 확정', due: '2026.06.17', assignee: '송지영', status: '완료', source: 'Q3 로드맵 정리' },
			{ id: 'p-2', text: '기획 QA 체크리스트 배포', due: '2026.06.20', assignee: '김민수', status: '연동 완료', source: '백로그 우선순위 재조정' },
		],
		meetings: [
			{ id: 'm-401', date: '2026.06.15', title: 'Q3 로드맵 정리', status: '완료', type: '정기', tags: ['#기획', '#로드맵'], participants: ['송지영', '정아름', '김소현'], summary: 'Q3 목표와 주요 마일스톤을 확정했습니다.', actionItems: 5, jiraLinked: 2 },
			{ id: 'm-402', date: '2026.06.13', title: '백로그 우선순위 재조정', status: 'Jira 발행됨', type: '수시', tags: ['#기획', '#Jira연동'], participants: ['송지영', '김민수'], summary: '핵심 과제 우선순위를 업데이트하고 Jira 티켓을 재배치했습니다.', actionItems: 7, jiraLinked: 4 },
		],
	},
];

function statusBadgeClass(status) {
	if (status === '완료') return 'bg-[#E6F4EA] text-[#10B981]';
	if (status === '보류') return 'bg-[#FCE8E6] text-[#EF4444]';
	if (status === 'Jira 발행됨') return 'bg-[#EEF3FF] text-[#0099CC]';
	return 'bg-[#FEF7E0] text-[#F59E0B]';
}

// ✅ 액션 아이템 상태 뱃지 스타일 함수 추가
const ACTION_STATUS_ORDER = ['검토대기', '검토완료', '연동완료', '완료히스토리'];
const ACTION_STATUS_LABEL = {
	검토대기: '검토대기',
	검토완료: '검토완료',
	연동완료: '연동완료',
	완료히스토리: '완료히스토리',
};

function normalizeActionStatus(status) {
	const normalized = String(status || '').trim();
	if (normalized === '검증 전') return '검토대기';
	if (normalized === '완료') return '완료히스토리';
	if (normalized === '연동 완료') return '연동완료';
	if (ACTION_STATUS_ORDER.includes(normalized)) return normalized;
	return '검토대기';
}

function actionStatusStyle(status) {
	if (status === '완료히스토리') return { bg: '#E6F4EA', color: '#10B981', border: '#10B981' };
	if (status === '연동완료') return { bg: '#EEF3FF', color: '#0099CC', border: '#0099CC' };
	if (status === '검토완료') return { bg: '#F1F5F9', color: '#475569', border: '#94A3B8' };
	return { bg: '#FEF7E0', color: '#F59E0B', border: '#F59E0B' }; // 검토대기
}

function getActionStatusLabel(status) {
	return ACTION_STATUS_LABEL[normalizeActionStatus(status)] || '검토대기';
}

function getActionStatusBadgeLabel(status) {
	return normalizeActionStatus(status) === '완료히스토리' ? '완료' : getActionStatusLabel(status);
}

function toDateInputValue(value) {
	const raw = String(value || '').trim();
	if (!raw) return '';
	if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
	if (/^\d{4}\.\d{2}\.\d{2}$/.test(raw)) return raw.replace(/\./g, '-');
	return '';
}

function fromDateInputValue(value) {
	const raw = String(value || '').trim();
	if (!raw) return '-';
	if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.replace(/-/g, '.');
	return raw;
}

function getKSTTimestampLabel(date = new Date()) {
	const parts = new Intl.DateTimeFormat('ko-KR', {
		timeZone: 'Asia/Seoul',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	}).formatToParts(date);
	const get = (type) => parts.find((item) => item.type === type)?.value || '';
	return `${get('year')}.${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`;
}

function buildExternalLink(tool, title = '') {
	const query = String(title || '').trim();
	if (tool === 'Jira') {
		const params = new URLSearchParams({ jql: query ? `text ~ "${query}"` : 'order by created DESC' });
		return `https://jira.atlassian.com/issues/?${params.toString()}`;
	}
	if (tool === 'Notion') {
		const params = new URLSearchParams({ query: query || 'action item' });
		return `https://www.notion.so/search?${params.toString()}`;
	}
	return '';
}

const ROLE_MAP = {
	'정아름': 'PM', '김민수': 'Backend', '송지영': 'PM', '김소현': 'ML Engineer', '채하율': 'Frontend', '박디자이너': 'Designer', '외부리서처A': 'QA',
};

const PARTICIPANT_COLOR_MAP = {
	'정아름': '#0099CC', '김민수': '#10B981', '송지영': '#7C3AED', '김소현': '#F59E0B', '채하율': '#0EA5E9', '박디자이너': '#EF4444', '외부리서처A': '#5A6F8A',
};

const PROJECT_OVERRIDE_STORAGE_KEY = 'tiki_project_overrides';

const TOAST_COLORS = { info: '#0099CC', ai: '#7C3AED', success: '#10B981', warning: '#F59E0B', error: '#EF4444' };
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
	} catch { return {}; }
};

const writeProjectOverrides = (next) => {
	try {
		localStorage.setItem(PROJECT_OVERRIDE_STORAGE_KEY, JSON.stringify(next));
	} catch {
		// ignore storage write failures in local mock mode
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
			tags: Array.isArray(meeting.tags) && meeting.tags.length > 0 ? meeting.tags : ['#회의'],
			participants: Array.isArray(meeting.participants) && meeting.participants.length > 0 ? meeting.participants : participants,
			summary: meeting.summary || '회의 요약이 아직 등록되지 않았습니다.',
			actionItems: typeof meeting.actionItems === 'number' ? meeting.actionItems : 0,
			jiraLinked: typeof meeting.jiraLinked === 'number' ? meeting.jiraLinked : 0,
		}))
		: [];
	return {
		id: project.id,
		name: project.name || '프로젝트',
		description: project.description || '',
		createdAt: project.createdAt || '',
		status: project.status || '진행 중',
		teamLead: project.teamLead || participants[0] || '담당자',
		participants,
		myActionItems: Array.isArray(project.myActionItems) ? project.myActionItems : [],
		meetings,
	};
}

function SettingsIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.82-.33 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.5 1Z" />
		</svg>
	);
}

function MoreVerticalIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
			<circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
			<circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
		</svg>
	);
}

function ChevronDownIcon({ className = '' }) {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
			<path d="M6 9l6 6 6-6" />
		</svg>
	);
}

function CheckIcon({ className = '' }) {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
			<path d="M20 6L9 17l-5-5" />
		</svg>
	);
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
	const [activePageTab, setActivePageTab] = useState('meetings');
	const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
	const [participantsModalMembers, setParticipantsModalMembers] = useState([]);
	const [participantsModalTitle, setParticipantsModalTitle] = useState('회의 참여자');
	const [deletedMeetingIds, setDeletedMeetingIds] = useState([]);
	const [pendingDeleteMeeting, setPendingDeleteMeeting] = useState(null);
	const [pendingDeleteActionItemId, setPendingDeleteActionItemId] = useState(null);
	const [toast, setToast] = useState({ message: '', type: 'info' });
	const [projectSearch, setProjectSearch] = useState('');
	const [meetingSearch, setMeetingSearch] = useState('');
	const [sortOrder, setSortOrder] = useState('최신순');
	const [meetingType, setMeetingType] = useState('전체');
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isSortOpen, setIsSortOpen] = useState(false);
	const [isTypeOpen, setIsTypeOpen] = useState(false);
	const [actionAssigneeFilter, setActionAssigneeFilter] = useState('전체');
	const [actionStatusFilter, setActionStatusFilter] = useState('전체');
	const [actionSourceFilter, setActionSourceFilter] = useState('전체');
	const [openActionFilter, setOpenActionFilter] = useState(null);
	const [actionItems, setActionItems] = useState([]);
	const [isActionDrawerOpen, setIsActionDrawerOpen] = useState(false);
	const [activeActionItemId, setActiveActionItemId] = useState(null);
	const [actionDraft, setActionDraft] = useState(null);
	const [pendingIntegrationTarget, setPendingIntegrationTarget] = useState('');
	const [isDrawerAssigneeOpen, setIsDrawerAssigneeOpen] = useState(false);
	const [openMoreMenuId, setOpenMoreMenuId] = useState(null);
	const [openActionMoreMenuId, setOpenActionMoreMenuId] = useState(null);
	const actionAssigneeFilterRef = useRef(null);
	const actionStatusFilterRef = useRef(null);
	const actionSourceFilterRef = useRef(null);
	const drawerAssigneeRef = useRef(null);
	const actionDescriptionRef = useRef(null);

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
			const clickedActionFilter =
				(actionAssigneeFilterRef.current && actionAssigneeFilterRef.current.contains(e.target))
				|| (actionStatusFilterRef.current && actionStatusFilterRef.current.contains(e.target))
				|| (actionSourceFilterRef.current && actionSourceFilterRef.current.contains(e.target));
			if (!clickedActionFilter) setOpenActionFilter(null);
			if (!e.target.closest('[data-more-menu-root]')) setOpenMoreMenuId(null);
			if (!e.target.closest('[data-action-more-menu-root]')) setOpenActionMoreMenuId(null);
			if (!e.target.closest('[data-drawer-assignee-root]')) setIsDrawerAssigneeOpen(false);
		};
		document.addEventListener('mousedown', handleOutsideClick);
		return () => document.removeEventListener('mousedown', handleOutsideClick);
	}, []);

	useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

	const stateLabels = { IDLE: '대기 중', UPLOADING: '업로드 중', PROCESSING: 'AI 분석 중', COMPLETED: '분석 완료', FAILED: '오류 발생' };

	const projectOverrides = useMemo(() => readProjectOverrides(), [location.key]);

	const project = useMemo(() => {
		const id = Number(projectId);
		const override = projectOverrides[String(id)] || null;
		const byId = PROJECTS.find((p) => p.id === id);
		if (byId) {
			return normalizeProject({ ...byId, ...(override || {}), participants: Array.isArray(override?.participants) ? override.participants : byId.participants, admins: Array.isArray(override?.admins) ? override.admins : byId.admins });
		}
		const stateProject = location.state?.project;
		if (stateProject && Number(stateProject.id) === id) {
			return normalizeProject({ ...stateProject, ...(override || {}), participants: Array.isArray(override?.participants) ? override.participants : stateProject.participants, admins: Array.isArray(override?.admins) ? override.admins : stateProject.admins });
		}
		if (override && Number(override.id) === id) return normalizeProject(override);
		return null;
	}, [projectId, location.state, projectOverrides]);

	const projectCandidates = useMemo(() => {
		const merged = PROJECTS.map((item) => {
			const override = projectOverrides[String(item.id)];
			if (!override) return item;
			return normalizeProject({ ...item, ...override, participants: Array.isArray(override.participants) ? override.participants : item.participants, admins: Array.isArray(override.admins) ? override.admins : item.admins });
		});
		if (!project) return merged;
		const exists = merged.some((p) => p.id === project.id);
		return exists ? merged : [project, ...merged];
	}, [project, projectOverrides]);

	const filteredProjects = useMemo(() => {
		const q = projectSearch.trim().toLowerCase();
		if (!q) return projectCandidates;
		return projectCandidates.filter((p) => p.name.toLowerCase().includes(q));
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
		return result.sort((a, b) => (sortOrder === '과거순' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
	}, [project, meetingSearch, meetingType, sortOrder, deletedMeetingIds]);

	useEffect(() => {
		if (!project) {
			setActionItems([]);
			return;
		}
		const fallbackMeetingTitle = project.meetings.find((meeting) => String(meeting.title || '').trim())?.title || project.name || '회의 제목 없음';
		setActionItems(
			(project.myActionItems || []).map((item) => ({
				id: item.id,
				text: item.text,
				description: item.description || '',
				due: item.due || '-',
				assignee: (String(item.assignee || '').trim() && String(item.assignee || '').trim() !== '담당자 미지정') ? item.assignee : (project.teamLead || '담당자 미지정'),
				status: normalizeActionStatus(item.status),
				source: String(item.source || '').trim() || String(item.meeting?.title || '').trim() || fallbackMeetingTitle,
				integrationTool: item.integrationTool || null,
				externalLink: item.externalLink || '',
				updatedAt: item.updatedAt || getKSTTimestampLabel(),
				meeting: null,
			}))
		);
	}, [project]);

	const allActionItems = actionItems;

	const actionAssigneeOptions = useMemo(() => {
		const participants = Array.isArray(project?.participants) ? project.participants : [];
		return ['전체', ...new Set([...participants, ...allActionItems.map((item) => item.assignee)].filter(Boolean))];
	}, [project, allActionItems]);
	const actionStatusOptions = useMemo(() => {
		const statusSet = new Set(ACTION_STATUS_ORDER);
		allActionItems.forEach((item) => statusSet.add(normalizeActionStatus(item.status)));
		return ['전체', ...statusSet];
	}, [allActionItems]);
	const actionSourceOptions = useMemo(() => ['전체', ...new Set(allActionItems.map((item) => item.source))], [allActionItems]);

	const filteredActionItems = useMemo(() => {
		return allActionItems.filter((item) => {
			const assigneeOk = actionAssigneeFilter === '전체' || item.assignee === actionAssigneeFilter;
			const statusOk = actionStatusFilter === '전체' || item.status === actionStatusFilter;
			const sourceOk = actionSourceFilter === '전체' || item.source === actionSourceFilter;
			return assigneeOk && statusOk && sourceOk;
		});
	}, [allActionItems, actionAssigneeFilter, actionStatusFilter, actionSourceFilter]);

	const actionDashboardStats = useMemo(() => {
		return {
			reviewPending: allActionItems.filter((item) => item.status === '검토대기').length,
			reviewDone: allActionItems.filter((item) => item.status === '검토완료').length,
			linked: allActionItems.filter((item) => item.status === '연동완료').length,
			history: allActionItems.filter((item) => item.status === '완료히스토리').length,
		};
	}, [allActionItems]);

	const activeActionItem = useMemo(() => {
		if (!activeActionItemId) return null;
		return allActionItems.find((item) => item.id === activeActionItemId) || null;
	}, [allActionItems, activeActionItemId]);

	const drawerAssigneeOptions = useMemo(() => {
		if (!project) return [];
		const fallbackParticipants = Array.isArray(project.participants) ? project.participants : [];
		if (!actionDraft) return fallbackParticipants;
		const source = String(actionDraft.source || '').trim();
		const meeting = (project.meetings || []).find((item) => item.title === source);
		const fromMeeting = Array.isArray(meeting?.participants) ? meeting.participants : [];
		return [...new Set([...(fromMeeting.length > 0 ? fromMeeting : fallbackParticipants), actionDraft.assignee].filter(Boolean))];
	}, [project, actionDraft]);

	if (!project) {
		return (
			<div className="min-h-screen bg-[#F8FAFF] overflow-x-hidden pt-20 pb-20 md:pb-0 flex flex-col">
				<Header isMobile={isMobile} phase="IDLE" stateLabels={stateLabels} />
				<main className="flex-1 w-full px-4 md:px-8 py-6 md:py-8">
					<div className="max-w-4xl mx-auto rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-8 text-center">
						<p className="text-lg font-bold text-[#0D1B2A]">프로젝트를 찾을 수 없습니다.</p>
						<p className="text-sm text-[#5A6F8A] mt-2">프로젝트 목록에서 다시 선택해 주세요.</p>
						<button type="button" onClick={() => navigate('/project-list')} className="mt-5 px-4 py-2 rounded-lg bg-[#0099CC] text-white text-sm font-semibold hover:bg-[#007EA7]">프로젝트 목록으로 이동</button>
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
		const fromProject = Array.isArray(project.admins) ? project.admins.filter((name) => participants.includes(name)) : [];
		if (fromProject.length > 0) return [...new Set(fromProject)];
		if (project.teamLead && participants.includes(project.teamLead)) return [project.teamLead];
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
	const handleEditMeeting = () => { showToast('수정 기능은 다음 단계에서 연결 예정입니다.', 'ai'); };
	const handleDeleteMeeting = (meetingId) => { setPendingDeleteMeeting(meetingId); };
	const persistProjectActionItems = (nextItems) => {
		const id = String(project?.id || '');
		if (!id) return;
		const nextOverrides = readProjectOverrides();
		const prev = nextOverrides[id] && typeof nextOverrides[id] === 'object' ? nextOverrides[id] : {};
		nextOverrides[id] = { ...prev, myActionItems: nextItems };
		writeProjectOverrides(nextOverrides);
	};

	const openActionDrawer = (item) => {
		setActiveActionItemId(item.id);
		setActionDraft({
			id: item.id,
			text: item.text,
			description: item.description || '',
			due: item.due || '-',
			assignee: item.assignee || project.teamLead || '담당자 미지정',
			status: normalizeActionStatus(item.status),
			source: item.source || '-',
			integrationTool: item.integrationTool || null,
			externalLink: item.externalLink || '',
			updatedAt: item.updatedAt || getKSTTimestampLabel(),
		});
		setPendingIntegrationTarget('');
		setIsDrawerAssigneeOpen(false);
		setOpenActionMoreMenuId(null);
		setIsActionDrawerOpen(true);
	};

	const closeActionDrawer = () => {
		setIsActionDrawerOpen(false);
		setActiveActionItemId(null);
		setActionDraft(null);
		setPendingIntegrationTarget('');
		setIsDrawerAssigneeOpen(false);
	};

	const saveActionDraft = ({ nextStatus = null, integrationTool = null, closeAfterSave = false } = {}) => {
		if (!actionDraft) return false;
		const nextText = String(actionDraft.text || '').trim();
		if (!nextText) {
			showToast('액션 아이템 제목을 입력해 주세요.', 'warning');
			return false;
		}
		const normalizedStatus = nextStatus ? normalizeActionStatus(nextStatus) : normalizeActionStatus(actionDraft.status);
		const now = getKSTTimestampLabel();
		const resolvedExternalLink = integrationTool
			? buildExternalLink(integrationTool, nextText)
			: (actionDraft.externalLink || '');
		const nextItems = allActionItems.map((item) => {
			if (item.id !== actionDraft.id) return item;
			return {
				...item,
				text: nextText,
				description: actionDraft.description || '',
				due: actionDraft.due || '-',
				assignee: actionDraft.assignee || project.teamLead || '담당자 미지정',
				status: normalizedStatus,
				source: actionDraft.source || item.source || '-',
				integrationTool: integrationTool || actionDraft.integrationTool || item.integrationTool || null,
				externalLink: resolvedExternalLink,
				updatedAt: now,
			};
		});
		setActionItems(nextItems);
		persistProjectActionItems(nextItems);
		setActionDraft((prev) => {
			if (!prev) return prev;
			return {
				...prev,
				status: normalizedStatus,
				integrationTool: integrationTool || prev.integrationTool || null,
				externalLink: resolvedExternalLink,
				updatedAt: now,
			};
		});
		if (closeAfterSave) closeActionDrawer();
		return true;
	};

	const removeActionItem = (itemId) => {
		const nextItems = allActionItems.filter((item) => item.id !== itemId);
		setActionItems(nextItems);
		persistProjectActionItems(nextItems);
		if (activeActionItemId === itemId) closeActionDrawer();
		setOpenActionMoreMenuId(null);
		showToast('액션 아이템이 삭제되었습니다.', 'success');
	};
	const requestDeleteActionItem = (itemId) => {
		setPendingDeleteActionItemId(itemId);
		setOpenActionMoreMenuId(null);
	};
	const confirmDeleteActionItem = () => {
		if (!pendingDeleteActionItemId) return;
		removeActionItem(pendingDeleteActionItemId);
		setPendingDeleteActionItemId(null);
	};
	const confirmDeleteMeeting = () => {
		if (!pendingDeleteMeeting) return;
		setDeletedMeetingIds((prev) => [...prev, pendingDeleteMeeting]);
		showToast('회의가 목록에서 삭제되었습니다.', 'success');
		setPendingDeleteMeeting(null);
	};
	const currentToastVariant = TOAST_VARIANTS[toast.type] || TOAST_VARIANTS.info;
	const projectDescriptionText = project.description?.trim() || '';

	// ✅ 수정된 그리드 컬럼 비율 — 각 컬럼이 컨텐츠에 맞게 배분
	const actionTableGridStyle = {
		gridTemplateColumns: '36px minmax(220px, 2.4fr) minmax(120px, 1fr) minmax(112px, 1fr) minmax(150px, 1.4fr) minmax(96px, 0.9fr) minmax(96px, 0.9fr)',
	};

	const actionCompactFilterButtonClass = (isOpen) => `w-full px-3 py-2.5 rounded-2xl border transition flex items-start justify-between gap-3 min-h-[48px] ${
		isOpen
			? 'bg-[#EEF3FF] border-[#0099CC]/45 shadow-[0_0_0_3px_rgba(0,153,204,0.12)] text-[#0D1B2A]'
			: 'bg-white border-[rgba(0,100,180,0.12)] text-[#0D1B2A] hover:border-[rgba(0,153,204,0.4)] hover:bg-[#F8FAFF]'
	}`;

	useEffect(() => {
		if (!isParticipantsModalOpen) return undefined;
		const handleEscClose = (e) => { if (e.key === 'Escape') closeParticipantsModal(); };
		document.addEventListener('keydown', handleEscClose);
		return () => document.removeEventListener('keydown', handleEscClose);
	}, [isParticipantsModalOpen]);

	useEffect(() => {
		if (!isActionDrawerOpen) return undefined;
		const handleEscClose = (e) => { if (e.key === 'Escape') closeActionDrawer(); };
		document.addEventListener('keydown', handleEscClose);
		return () => document.removeEventListener('keydown', handleEscClose);
	}, [isActionDrawerOpen]);

	useEffect(() => {
		document.body.style.overflow = isActionDrawerOpen ? 'hidden' : '';
		return () => {
			document.body.style.overflow = '';
		};
	}, [isActionDrawerOpen]);

	useEffect(() => {
		if (!isActionDrawerOpen || !actionDescriptionRef.current) return;
		const textarea = actionDescriptionRef.current;
		const minHeight = 128;
		const maxHeight = 320;
		textarea.style.height = 'auto';
		const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
		textarea.style.height = `${nextHeight}px`;
		textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
	}, [isActionDrawerOpen, actionDraft?.description]);

	return (
		<div className="min-h-screen bg-[#F8FAFF] overflow-x-hidden pt-20 pb-20 md:pb-0 flex flex-col">
			<Header isMobile={isMobile} phase="IDLE" stateLabels={stateLabels} />
			<main className="flex-1 w-full px-4 md:px-8 py-6 md:py-8">
				<div className="max-w-7xl mx-auto">
					<div className="mb-4">
						<button type="button" onClick={() => navigate('/project-list')} className="text-sm text-[#5A6F8A] hover:text-[#0D1B2A]">← 프로젝트 목록</button>
					</div>

					<div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
						{/* 사이드바 */}
						<aside className="hidden md:block xl:col-span-3">
							<section className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-4">
								<h3 className="text-sm font-bold text-[#0D1B2A] mb-3">프로젝트</h3>
								<div className="relative">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A9AB0] pointer-events-none" aria-hidden="true">
										<circle cx="11" cy="11" r="7" />
										<path d="m21 21-4.3-4.3" />
									</svg>
									<input value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} placeholder="프로젝트 검색" className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[rgba(0,100,180,0.12)] bg-[#F8FAFF] focus:outline-none focus:border-[#0099CC]" />
								</div>
								<div className="mt-3 space-y-2 max-h-[220px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
									{filteredProjects.map((item) => (
										<button key={item.id} type="button" onClick={() => navigate(`/project/${item.id}/meetings`, { state: { project: item } })} className={`w-full text-left px-3 py-2.5 rounded-xl border transition ${item.id === project.id ? 'bg-[#EEF3FF] border-[#0099CC]/35 text-[#0099CC] font-semibold' : 'bg-white border-[rgba(0,100,180,0.12)] text-[#0D1B2A] hover:bg-[#F8FAFF]'}`}>
											<p className="text-sm truncate">{item.name}</p>
										</button>
									))}
								</div>
							</section>
						</aside>

						{/* 메인 콘텐츠 */}
						<section className="xl:col-span-9 space-y-4">

							{/* 프로젝트 헤더 */}
							<section className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-5">
								<div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
									<div className="flex-1 min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<span className="text-xs text-[#8A9AB0]">생성일 {project.createdAt}</span>
										</div>
										<div className="mt-1 flex flex-wrap items-center gap-2">
											<h1 className="text-2xl font-bold text-[#0D1B2A]">{project.name}</h1>
											<span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusBadgeClass(project.status)}`}>{project.status}</span>
										</div>
										{projectDescriptionText && (
											<p className="text-sm text-[#5A6F8A] mt-2 leading-relaxed">{projectDescriptionText}</p>
										)}
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
									<button
										type="button"
										onClick={() => navigate('/configuration', { state: { project } })}
										className="shrink-0 w-10 h-10 rounded-xl border border-[rgba(0,100,180,0.12)] text-[#5A6F8A] hover:text-[#0099CC] hover:border-[#0099CC]/35 flex items-center justify-center transition"
										aria-label="프로젝트 설정"
									>
										<SettingsIcon />
									</button>
								</div>
							</section>

							{/* 탭 네비게이션 */}
							<div className="flex items-center gap-1 bg-white rounded-2xl border border-[rgba(0,100,180,0.12)] p-1.5">
								<button
									type="button"
									onClick={() => setActivePageTab('meetings')}
									className={`flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition ${activePageTab === 'meetings' ? 'bg-[#EEF3FF] text-[#0099CC] shadow-sm' : 'text-[#5A6F8A] hover:text-[#0D1B2A]'}`}
								>
									회의 기록
								</button>
								<button
									type="button"
									onClick={() => setActivePageTab('actions')}
									className={`flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition ${activePageTab === 'actions' ? 'bg-[#EEF3FF] text-[#0099CC] shadow-sm' : 'text-[#5A6F8A] hover:text-[#0D1B2A]'}`}
								>
									액션 아이템
									{allActionItems.length > 0 && (
										<span className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full font-bold ${activePageTab === 'actions' ? 'bg-[#0099CC] text-white' : 'bg-[#F0F2F5] text-[#5A6F8A]'}`}>
											{allActionItems.length}
										</span>
									)}
								</button>
							</div>

							{/* 회의 기록 탭 */}
							{activePageTab === 'meetings' && (
								<>
									<section className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-4">
										<div className="space-y-2.5 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
											<input
												value={meetingSearch}
												onChange={(e) => setMeetingSearch(e.target.value)}
												placeholder="회의록 검색"
												className="w-full sm:flex-1 sm:min-w-[220px] px-3.5 py-2.5 text-sm bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl focus:outline-none focus:border-[#0099CC]"
											/>
											<div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2 sm:shrink-0">
												<div className="relative" ref={sortDropdownRef}>
													<button type="button" onClick={() => { setIsSortOpen((prev) => !prev); setIsTypeOpen(false); }} className={`w-full sm:w-auto px-3.5 py-2.5 text-sm rounded-xl border transition flex items-center justify-between gap-1.5 ${isSortOpen ? 'bg-[#EEF3FF] border-[#0099CC]/40 shadow-[0_0_0_3px_rgba(0,153,204,0.12)] text-[#0D1B2A]' : 'bg-[#F8FAFF] border-[rgba(0,100,180,0.12)] text-[#0D1B2A] hover:border-[rgba(0,153,204,0.4)]'}`}>
														<span className="font-medium">{sortOrder}</span>
														<ChevronDownIcon className={`text-[#5A6F8A] transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
													</button>
													{isSortOpen && (
														<div className="absolute left-0 z-20 mt-2 w-32 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)]">
															{['최신순', '과거순'].map((option) => (
																<button key={option} type="button" onClick={() => { setSortOrder(option); setIsSortOpen(false); }} className={`w-full px-3.5 py-2.5 text-sm text-left flex items-center justify-between transition-colors ${sortOrder === option ? 'bg-[#EEF3FF] text-[#0099CC] font-semibold' : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'}`}>
																	<span>{option}</span>
																	{sortOrder === option && <CheckIcon className="text-[#0099CC]" />}
																</button>
															))}
														</div>
													)}
												</div>
												<div className="relative" ref={typeDropdownRef}>
													<button type="button" onClick={() => { setIsTypeOpen((prev) => !prev); setIsSortOpen(false); }} className={`w-full sm:w-auto px-3.5 py-2.5 text-sm rounded-xl border transition flex items-center justify-between gap-1.5 ${isTypeOpen ? 'bg-[#EEF3FF] border-[#0099CC]/40 shadow-[0_0_0_3px_rgba(0,153,204,0.12)] text-[#0D1B2A]' : 'bg-[#F8FAFF] border-[rgba(0,100,180,0.12)] text-[#0D1B2A] hover:border-[rgba(0,153,204,0.4)]'}`}>
														<span className="font-medium">{meetingType}</span>
														<ChevronDownIcon className={`text-[#5A6F8A] transition-transform ${isTypeOpen ? 'rotate-180' : ''}`} />
													</button>
													{isTypeOpen && (
														<div className="absolute left-0 z-20 mt-2 w-32 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)]">
															{['전체', '정기', '수시'].map((option) => (
																<button key={option} type="button" onClick={() => { setMeetingType(option); setIsTypeOpen(false); }} className={`w-full px-3.5 py-2.5 text-sm text-left flex items-center justify-between transition-colors ${meetingType === option ? 'bg-[#EEF3FF] text-[#0099CC] font-semibold' : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'}`}>
																	<span>{option}</span>
																	{meetingType === option && <CheckIcon className="text-[#0099CC]" />}
																</button>
															))}
														</div>
													)}
												</div>
												<div className="relative col-span-2 sm:col-auto shrink-0" ref={createDropdownRef}>
													<button type="button" onClick={() => setIsCreateOpen((prev) => !prev)} className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition ${isCreateOpen ? 'bg-[#007EA7]' : 'bg-[#0099CC] hover:bg-[#007EA7]'}`}>
														<span>+ 새 회의록</span>
														<ChevronDownIcon className={`transition-transform ${isCreateOpen ? 'rotate-180' : ''}`} />
													</button>
													{isCreateOpen && (
														<div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.16)] bg-white shadow-[0_12px_28px_rgba(0,100,180,0.18)]">
															<button type="button" onClick={() => { setIsCreateOpen(false); navigate('/meeting-create', { state: { projectId: project.id, projectName: project.name } }); }} className="w-full px-3.5 py-3 text-left hover:bg-[#EEF3FF]">
																<p className="text-sm font-semibold text-[#0D1B2A]">회의록 직접 작성</p>
																<p className="text-xs text-[#5A6F8A] mt-0.5">템플릿에 바로 입력해서 회의록을 생성합니다.</p>
															</button>
															<button type="button" onClick={() => { setIsCreateOpen(false); navigate('/upload', { state: { from: 'project-meetings', projectId: project.id, projectName: project.name } }); }} className="w-full px-3.5 py-3 text-left border-t border-[rgba(0,100,180,0.08)] hover:bg-[#EEF3FF]">
																<p className="text-sm font-semibold text-[#0D1B2A]">회의 파일 업로드</p>
																<p className="text-xs text-[#5A6F8A] mt-0.5">녹음 파일을 올려 AI 회의록을 자동 생성합니다.</p>
															</button>
														</div>
													)}
												</div>
											</div>
										</div>
									</section>

									{/* 회의 리스트 */}
									<section className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white overflow-visible">
										{visibleMeetings.length === 0 ? (
											<div className="px-4 py-12 text-center">
												<p className="text-sm font-semibold text-[#0D1B2A]">아직 생성된 회의록이 없습니다.</p>
												<p className="text-xs text-[#5A6F8A] mt-1">첫 회의록을 작성해보세요.</p>
												<div className="mt-4 inline-flex gap-2">
													<button type="button" onClick={() => navigate('/meeting-create', { state: { projectId: project.id, projectName: project.name } })} className="px-4 py-2 rounded-lg bg-[#0099CC] text-white text-sm font-semibold hover:bg-[#007EA7]">회의록 직접 작성</button>
													<button type="button" onClick={() => navigate('/upload', { state: { from: 'project-meetings', projectId: project.id, projectName: project.name } })} className="px-4 py-2 rounded-lg border border-[rgba(0,100,180,0.16)] text-[#5A6F8A] text-sm font-semibold hover:bg-[#F8FAFF]">회의 파일 업로드</button>
												</div>
											</div>
										) : (
											<>
												<div className="hidden md:grid grid-cols-12 px-4 py-3 text-xs font-bold text-[#5A6F8A] bg-[#F8FAFF] border-b border-[rgba(0,100,180,0.1)]">
													<div className="col-span-2">회의 날짜</div>
													<div className="col-span-3">회의 제목</div>
													<div className="col-span-2">상태</div>
													<div className="col-span-4">주요 태그</div>
													<div className="col-span-1" />
												</div>
												<div className="hidden md:block">
													{visibleMeetings.map((meeting) => (
														<div key={meeting.id} className="grid grid-cols-12 px-4 py-3 items-center border-b border-[rgba(0,100,180,0.08)] last:border-b-0">
															<div className="col-span-2 text-sm text-[#5A6F8A]">{meeting.date}</div>
															<button type="button" onClick={() => navigate('/meeting-detail')} className="col-span-3 text-left text-sm font-semibold text-[#0D1B2A] hover:text-[#0099CC]">{meeting.title}</button>
															<div className="col-span-2">
																<span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(meeting.status)}`}>{meeting.status}</span>
															</div>
															<div className="col-span-4 flex flex-wrap gap-1">
																{meeting.tags.map((tag) => (<span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-[#EEF3FF] text-[#0099CC]">{tag}</span>))}
															</div>
															<div className="col-span-1 flex justify-end" data-more-menu-root>
																<div className="relative">
																	<button
																		type="button"
																		onClick={() => setOpenMoreMenuId((prev) => (prev === meeting.id ? null : meeting.id))}
																		className="w-8 h-8 flex items-center justify-center rounded-lg text-[#5A6F8A] hover:text-[#0D1B2A] hover:bg-[#F8FAFF] transition"
																		aria-label="더 보기"
																	>
																		<MoreVerticalIcon />
																	</button>
																	{openMoreMenuId === meeting.id && (
																		<div className="absolute right-full mr-1 top-0 z-40 w-28 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_24px_rgba(0,100,180,0.14)]">
																			<button type="button" onClick={() => { setOpenMoreMenuId(null); handleEditMeeting(); }} className="w-full px-3.5 py-2.5 text-left text-sm text-[#0D1B2A] hover:bg-[#EEF3FF]">수정</button>
																			<button type="button" onClick={() => { setOpenMoreMenuId(null); handleDeleteMeeting(meeting.id); }} className="w-full px-3.5 py-2.5 text-left text-sm text-[#EF4444] hover:bg-[#FCE8E6]">삭제</button>
																		</div>
																	)}
																</div>
															</div>
														</div>
													))}
												</div>

												{/* 모바일 카드 */}
												<div className="md:hidden divide-y divide-[rgba(0,100,180,0.08)]">
													{visibleMeetings.map((meeting) => (
														<article key={meeting.id} className="p-4 space-y-2.5">
															<div className="flex items-start justify-between gap-2">
																<span className="text-xs text-[#5A6F8A]">{meeting.date}</span>
																<div className="flex items-center gap-2">
																	<span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(meeting.status)}`}>{meeting.status}</span>
																	<div className="relative" data-more-menu-root>
																		<button type="button" onClick={() => setOpenMoreMenuId((prev) => (prev === meeting.id ? null : meeting.id))} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5A6F8A] hover:bg-[#F8FAFF] transition">
																			<MoreVerticalIcon />
																		</button>
																		{openMoreMenuId === meeting.id && (
																			<div className="absolute right-full mr-1 top-0 z-40 w-28 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_24px_rgba(0,100,180,0.14)]">
																				<button type="button" onClick={() => { setOpenMoreMenuId(null); handleEditMeeting(); }} className="w-full px-3.5 py-2.5 text-left text-sm text-[#0D1B2A] hover:bg-[#EEF3FF]">수정</button>
																				<button type="button" onClick={() => { setOpenMoreMenuId(null); handleDeleteMeeting(meeting.id); }} className="w-full px-3.5 py-2.5 text-left text-sm text-[#EF4444] hover:bg-[#FCE8E6]">삭제</button>
																			</div>
																		)}
																	</div>
																</div>
															</div>
															<button type="button" onClick={() => navigate('/meeting-detail')} className="text-left text-sm font-semibold text-[#0D1B2A] leading-snug">{meeting.title}</button>
															<div className="flex flex-wrap gap-1">
																{meeting.tags.map((tag) => (<span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-[#EEF3FF] text-[#0099CC]">{tag}</span>))}
															</div>
														</article>
													))}
												</div>
											</>
										)}
									</section>
								</>
							)}

							{/* 액션 아이템 탭 */}
							{activePageTab === 'actions' && (
								<section className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white overflow-visible">

									{/* 필터 영역 */}
									<div className="px-4 py-3.5 border-b border-[rgba(0,100,180,0.08)] bg-[#F8FAFF] rounded-t-2xl">
										<div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
											<div className="relative" ref={actionAssigneeFilterRef}>
												<button
													type="button"
													onClick={() => setOpenActionFilter((prev) => (prev === 'assignee' ? null : 'assignee'))}
													className={actionCompactFilterButtonClass(openActionFilter === 'assignee')}
												>
													<span className="flex min-w-0 flex-col items-start gap-0.5">
														<span className="text-[11px] font-semibold leading-none text-[#5A6F8A]">담당자</span>
														<span className="truncate text-sm font-semibold leading-tight">{actionAssigneeFilter}</span>
													</span>
													<ChevronDownIcon className={`shrink-0 text-[#5A6F8A] transition-transform ${openActionFilter === 'assignee' ? 'rotate-180' : ''}`} />
												</button>
												{openActionFilter === 'assignee' && (
													<div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_12px_30px_rgba(0,100,180,0.16)]">
														<div className="max-h-64 overflow-auto py-1">
															{actionAssigneeOptions.map((option) => (
																<button key={option} type="button" onClick={() => { setActionAssigneeFilter(option); setOpenActionFilter(null); }} className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${actionAssigneeFilter === option ? 'bg-[#EEF3FF] text-[#0099CC] font-semibold' : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'}`}>
																	<span>{option}</span>
																	{actionAssigneeFilter === option && <CheckIcon className="text-[#0099CC]" />}
																</button>
															))}
														</div>
													</div>
												)}
											</div>
											<div className="relative" ref={actionStatusFilterRef}>
												<button
													type="button"
													onClick={() => setOpenActionFilter((prev) => (prev === 'status' ? null : 'status'))}
													className={actionCompactFilterButtonClass(openActionFilter === 'status')}
												>
													<span className="flex min-w-0 flex-col items-start gap-0.5">
														<span className="text-[11px] font-semibold leading-none text-[#5A6F8A]">상태</span>
														<span className="truncate text-sm font-semibold leading-tight">{actionStatusFilter}</span>
													</span>
													<ChevronDownIcon className={`shrink-0 text-[#5A6F8A] transition-transform ${openActionFilter === 'status' ? 'rotate-180' : ''}`} />
												</button>
												{openActionFilter === 'status' && (
													<div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_12px_30px_rgba(0,100,180,0.16)]">
														<div className="max-h-64 overflow-auto py-1">
															{actionStatusOptions.map((option) => (
																<button key={option} type="button" onClick={() => { setActionStatusFilter(option); setOpenActionFilter(null); }} className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${actionStatusFilter === option ? 'bg-[#EEF3FF] text-[#0099CC] font-semibold' : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'}`}>
																	<span>{option === '전체' ? option : getActionStatusLabel(option)}</span>
																	{actionStatusFilter === option && <CheckIcon className="text-[#0099CC]" />}
																</button>
															))}
														</div>
													</div>
												)}
											</div>
											<div className="relative" ref={actionSourceFilterRef}>
												<button
													type="button"
													onClick={() => setOpenActionFilter((prev) => (prev === 'source' ? null : 'source'))}
													className={actionCompactFilterButtonClass(openActionFilter === 'source')}
												>
													<span className="flex min-w-0 flex-col items-start gap-0.5">
														<span className="text-[11px] font-semibold leading-none text-[#5A6F8A]">회의록 출처</span>
														<span className="truncate text-sm font-semibold leading-tight">{actionSourceFilter}</span>
													</span>
													<ChevronDownIcon className={`shrink-0 text-[#5A6F8A] transition-transform ${openActionFilter === 'source' ? 'rotate-180' : ''}`} />
												</button>
												{openActionFilter === 'source' && (
													<div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_12px_30px_rgba(0,100,180,0.16)]">
														<div className="max-h-64 overflow-auto py-1">
															{actionSourceOptions.map((option) => (
																<button key={option} type="button" onClick={() => { setActionSourceFilter(option); setOpenActionFilter(null); }} className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${actionSourceFilter === option ? 'bg-[#EEF3FF] text-[#0099CC] font-semibold' : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'}`}>
																	<span>{option}</span>
																	{actionSourceFilter === option && <CheckIcon className="text-[#0099CC]" />}
																</button>
															))}
														</div>
													</div>
												)}
											</div>
										</div>
									</div>

									{/* 상태 통계 */}
									<div className="px-4 py-3.5 border-b border-[rgba(0,100,180,0.08)] bg-white">
										<div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
											<div className="rounded-xl border border-[rgba(0,100,180,0.1)] bg-[#F8FAFF] p-3">
												<p className="text-[11px] text-[#5A6F8A]">검토대기</p>
												<p className="text-lg font-bold text-[#F59E0B]">{actionDashboardStats.reviewPending}</p>
											</div>
											<div className="rounded-xl border border-[rgba(0,100,180,0.1)] bg-[#F8FAFF] p-3">
												<p className="text-[11px] text-[#5A6F8A]">검토완료</p>
												<p className="text-lg font-bold text-[#0D1B2A]">{actionDashboardStats.reviewDone}</p>
											</div>
											<div className="rounded-xl border border-[rgba(0,100,180,0.1)] bg-[#F8FAFF] p-3">
												<p className="text-[11px] text-[#5A6F8A]">연동완료</p>
												<p className="text-lg font-bold text-[#0099CC]">{actionDashboardStats.linked}</p>
											</div>
											<div className="rounded-xl border border-[rgba(0,100,180,0.1)] bg-[#F8FAFF] p-3">
												<p className="text-[11px] text-[#5A6F8A]">완료히스토리</p>
												<p className="text-lg font-bold text-[#10B981]">{actionDashboardStats.history}</p>
											</div>
										</div>
									</div>

									{filteredActionItems.length === 0 ? (
										<div className="px-4 py-12 text-center">
											<p className="text-sm font-semibold text-[#0D1B2A]">조건에 맞는 해야 할 일이 없습니다.</p>
											<p className="text-xs text-[#5A6F8A] mt-1">필터를 초기화하거나 다른 조건을 선택해 보세요.</p>
										</div>
									) : (
										<>
											{/* ✅ PC 테이블 헤더 — gridTemplateColumns 수정 */}
											<div
												className="hidden md:grid items-center px-4 py-3 bg-[#F8FAFF] border-b border-[rgba(0,100,180,0.1)] text-[12px] font-semibold text-[#5A6F8A] text-left"
												style={actionTableGridStyle}
											>
												<div />
												<div>해야 할 일</div>
												<div>담당자</div>
												<div>상태</div>
												<div>회의록 출처</div>
												<div>마감일</div>
												<div />
											</div>

											{/* ✅ PC 테이블 행 */}
											<div className="hidden md:block divide-y divide-[rgba(0,100,180,0.08)]">
												{filteredActionItems.map((item) => {
													const statusStyle = actionStatusStyle(item.status);
													const isFinalDone = normalizeActionStatus(item.status) === '완료히스토리';
													return (
														<div key={item.id} className="grid items-center px-4 py-3 cursor-pointer hover:bg-[#F8FAFF] transition-colors" style={actionTableGridStyle} onClick={() => openActionDrawer(item)}>
															{/* 체크박스 */}
															<div className="flex items-center justify-start">
																<input type="checkbox" checked={isFinalDone} readOnly disabled={isFinalDone} className={`w-4 h-4 ${isFinalDone ? 'accent-[#94A3B8] cursor-not-allowed opacity-70' : 'accent-[#0099CC]'}`} onClick={(e) => e.stopPropagation()} />
															</div>

															{/* 액션 아이템 텍스트 */}
															<div className="flex items-center min-h-[44px] pr-0.5">
																<span className="text-sm font-medium text-[#0D1B2A] leading-snug line-clamp-2">{item.text}</span>
															</div>

															{/* 담당자 */}
															<div className="flex items-center min-h-[44px]">
																<span className="text-sm text-[#0D1B2A]">{item.assignee}</span>
															</div>

															{/* 상태 배지 (수동 변경 금지) */}
															<div className="flex items-center">
																<span
																	className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold border"
																	style={{ backgroundColor: statusStyle.bg, color: statusStyle.color, borderColor: `${statusStyle.border}40` }}
																>
																	{getActionStatusBadgeLabel(item.status)}
																</span>
															</div>

															{/* ✅ 회의록 출처 */}
															<div className="flex items-center min-h-[44px] pr-1">
																<span className="text-sm text-[#5A6F8A] truncate" title={item.source}>{item.source}</span>
															</div>

															{/* 마감일 */}
															<div className="flex items-center min-h-[44px]">
																<span className="text-sm text-[#0D1B2A]">{item.due}</span>
															</div>

															{/* 관리 메뉴 */}
															<div className="flex items-center justify-end" data-action-more-menu-root>
																<div className="relative">
																	<button
																		type="button"
																		onClick={(e) => { e.stopPropagation(); setOpenActionMoreMenuId((prev) => (prev === item.id ? null : item.id)); }}
																		className="w-8 h-8 flex items-center justify-center rounded-lg text-[#5A6F8A] hover:text-[#0D1B2A] hover:bg-[#F8FAFF] transition"
																		aria-label="액션 아이템 더 보기"
																	>
																		<MoreVerticalIcon />
																	</button>
																	{openActionMoreMenuId === item.id && (
																		<div className="absolute right-full mr-1 top-0 z-40 w-28 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_24px_rgba(0,100,180,0.14)]">
																			<button type="button" onClick={(e) => { e.stopPropagation(); requestDeleteActionItem(item.id); }} className="w-full px-3.5 py-2.5 text-left text-sm text-[#EF4444] hover:bg-[#FCE8E6]">삭제</button>
																		</div>
																	)}
																</div>
															</div>
														</div>
													);
												})}
											</div>

											{/* 모바일 카드 */}
											<div className="md:hidden divide-y divide-[rgba(0,100,180,0.08)]">
												{filteredActionItems.map((item) => {
													const statusStyle = actionStatusStyle(item.status);
													const isFinalDone = normalizeActionStatus(item.status) === '완료히스토리';
													return (
														<article key={item.id} className="px-4 py-4 space-y-2.5 cursor-pointer hover:bg-[#F8FAFF] transition-colors" onClick={() => openActionDrawer(item)}>
															{/* 상단: 체크박스 + 텍스트 + 수정/삭제 */}
															<div className="flex items-start gap-3">
																<input type="checkbox" checked={isFinalDone} readOnly disabled={isFinalDone} className={`w-4 h-4 mt-0.5 shrink-0 ${isFinalDone ? 'accent-[#94A3B8] cursor-not-allowed opacity-70' : 'accent-[#0099CC]'}`} onClick={(e) => e.stopPropagation()} />
																<div className="flex-1 min-w-0">
																	<p className="text-sm font-semibold text-[#0D1B2A] leading-snug">{item.text}</p>
																</div>
																{/* 모바일 관리 메뉴 */}
																<div className="relative shrink-0" data-action-more-menu-root>
																	<button
																		type="button"
																		onClick={(e) => { e.stopPropagation(); setOpenActionMoreMenuId((prev) => (prev === item.id ? null : item.id)); }}
																		className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5A6F8A] hover:bg-[#F8FAFF] transition"
																		aria-label="액션 아이템 더 보기"
																	>
																		<MoreVerticalIcon />
																	</button>
																	{openActionMoreMenuId === item.id && (
																		<div className="absolute right-full mr-1 top-0 z-40 w-28 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_24px_rgba(0,100,180,0.14)]">
																			<button type="button" onClick={(e) => { e.stopPropagation(); requestDeleteActionItem(item.id); }} className="w-full px-3.5 py-2.5 text-left text-sm text-[#EF4444] hover:bg-[#FCE8E6]">삭제</button>
																		</div>
																	)}
																</div>
															</div>

															{/* 하단: 담당자 · 마감일 + 상태 */}
															<div className="flex items-center justify-between pl-7 gap-2">
																<div className="flex items-center gap-2 min-w-0 flex-1 text-xs text-[#5A6F8A]">
																	<span className="font-medium text-[#0D1B2A] truncate max-w-[110px]">{item.assignee}</span>
																	<span className="text-[#CBD5E1]">·</span>
																	<span className="shrink-0">{item.due}</span>
																</div>
																{/* 상태 배지 (수동 변경 금지) */}
																<div className="shrink-0">
																	<span
																		className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold border"
																		style={{ backgroundColor: statusStyle.bg, color: statusStyle.color, borderColor: `${statusStyle.border}40` }}
																	>
																		{getActionStatusBadgeLabel(item.status)}
																	</span>
																</div>
															</div>
														</article>
													);
												})}
											</div>
										</>
									)}
								</section>
							)}

						</section>
					</div>
				</div>
			</main>

			{isActionDrawerOpen && actionDraft && (
				<div className="fixed inset-0 z-[72]" aria-modal="true" role="dialog">
					<div className="absolute inset-0 bg-[#0D1B2A]/45" onClick={closeActionDrawer} />
					<aside className="absolute inset-y-0 right-0 w-full sm:w-[520px] bg-white border-l border-[rgba(0,100,180,0.14)] shadow-2xl flex flex-col">
						<div className="px-4 sm:px-5 py-4 border-b border-[rgba(0,100,180,0.1)] flex items-center justify-between gap-3">
							{(() => {
								const statusStyle = actionStatusStyle(actionDraft.status);
								return (
									<span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border" style={{ backgroundColor: statusStyle.bg, color: statusStyle.color, borderColor: `${statusStyle.border}40` }}>
										{getActionStatusBadgeLabel(actionDraft.status)}
									</span>
								);
							})()}
							<button type="button" onClick={closeActionDrawer} className="w-8 h-8 rounded-lg text-[#5A6F8A] hover:bg-[#F8FAFF] hover:text-[#0D1B2A]" aria-label="드로어 닫기">✕</button>
						</div>

						<div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
							<div className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-[#F8FAFF] p-3.5">
								<div className="flex flex-wrap items-center gap-2 mb-2">
									<span className="px-2 py-0.5 rounded-full bg-[#EEF3FF] text-[#0099CC] text-xs font-semibold">#{project.name}</span>
									<span className="px-2 py-0.5 rounded-full bg-white border border-[rgba(0,100,180,0.12)] text-[#5A6F8A] text-xs">출처: {actionDraft.source || '-'}</span>
								</div>
								<p className="text-xs text-[#5A6F8A]">타임스탬프: {actionDraft.updatedAt || getKSTTimestampLabel()}</p>
							</div>

							<div className="space-y-1.5">
								<label className="text-xs font-semibold text-[#5A6F8A]">제목</label>
								<input
									type="text"
									value={actionDraft.text}
									onChange={(e) => setActionDraft((prev) => ({ ...prev, text: e.target.value }))}
									className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[rgba(0,100,180,0.14)] bg-white focus:outline-none focus:border-[#0099CC]"
									placeholder="액션 아이템 제목"
								/>
							</div>

							<div className="space-y-1.5">
								<label className="text-xs font-semibold text-[#5A6F8A]">설명</label>
								<textarea
									ref={actionDescriptionRef}
									value={actionDraft.description || ''}
									onChange={(e) => setActionDraft((prev) => ({ ...prev, description: e.target.value }))}
									rows={5}
									className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[rgba(0,100,180,0.14)] bg-white resize-none focus:outline-none focus:border-[#0099CC]"
									placeholder="세부 설명을 입력하세요"
								/>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div className="space-y-1.5">
									<label className="text-xs font-semibold text-[#5A6F8A]">마감 기한</label>
									<input
										type="date"
										value={toDateInputValue(actionDraft.due)}
										onChange={(e) => setActionDraft((prev) => ({ ...prev, due: fromDateInputValue(e.target.value) }))}
										className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[rgba(0,100,180,0.14)] bg-white focus:outline-none focus:border-[#0099CC]"
									/>
								</div>
								<div className="space-y-1.5 relative" ref={drawerAssigneeRef} data-drawer-assignee-root>
									<label className="text-xs font-semibold text-[#5A6F8A]">담당자</label>
									<button
										type="button"
										onClick={() => setIsDrawerAssigneeOpen((prev) => !prev)}
										className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition flex items-center justify-between gap-2 ${isDrawerAssigneeOpen ? 'bg-[#EEF3FF] border-[#0099CC]/40 shadow-[0_0_0_3px_rgba(0,153,204,0.12)] text-[#0D1B2A]' : 'bg-white border-[rgba(0,100,180,0.14)] text-[#0D1B2A] hover:border-[rgba(0,153,204,0.4)]'}`}
									>
										<span className="truncate text-left">{actionDraft.assignee || '담당자 선택'}</span>
										<ChevronDownIcon className={`shrink-0 text-[#5A6F8A] transition-transform ${isDrawerAssigneeOpen ? 'rotate-180' : ''}`} />
									</button>
									{isDrawerAssigneeOpen && (
										<div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_12px_30px_rgba(0,100,180,0.16)]">
											<div className="max-h-64 overflow-auto py-1">
												{drawerAssigneeOptions.map((member) => (
													<button
														key={member}
														type="button"
														onClick={() => {
															setActionDraft((prev) => ({ ...prev, assignee: member }));
															setIsDrawerAssigneeOpen(false);
														}}
														className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${actionDraft.assignee === member ? 'bg-[#EEF3FF] text-[#0099CC] font-semibold' : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'}`}
													>
														<span>{member}</span>
														{actionDraft.assignee === member && <CheckIcon className="text-[#0099CC]" />}
													</button>
												))}
											</div>
										</div>
									)}
								</div>
							</div>

							{normalizeActionStatus(actionDraft.status) === '연동완료' && (
								<div className="rounded-2xl border border-[rgba(0,153,204,0.28)] bg-[#EEF8FF] px-3.5 py-3">
									<p className="text-sm font-semibold text-[#0D1B2A]">연동완료 | 외부 툴 링크 바로가기</p>
									{actionDraft.externalLink ? (
										<a href={actionDraft.externalLink} target="_blank" rel="noreferrer" className="text-xs text-[#0099CC] underline mt-1 inline-block">{actionDraft.externalLink}</a>
									) : (
										<p className="text-xs text-[#5A6F8A] mt-1">연동 링크가 아직 없습니다.</p>
									)}
								</div>
							)}

							{normalizeActionStatus(actionDraft.status) === '완료히스토리' && (
								<div className="rounded-2xl border border-[rgba(16,185,129,0.28)] bg-[#F3FBF7] px-3.5 py-3">
									<p className="text-sm font-semibold text-[#0D1B2A]">완료 히스토리 상태입니다.</p>
									<p className="text-xs text-[#5A6F8A] mt-1">내부 기록으로 보관 중이며 필요 시 변경 사항만 저장할 수 있습니다.</p>
								</div>
							)}
						</div>

						<div className="border-t border-[rgba(0,100,180,0.1)] px-4 sm:px-5 py-4 space-y-2.5 bg-white">
							{normalizeActionStatus(actionDraft.status) === '검토대기' && (
								<button
									type="button"
									onClick={() => {
										const ok = saveActionDraft({ nextStatus: '검토완료', closeAfterSave: true });
										if (ok) showToast('확인 완료 처리되어 검토 완료로 전환되었습니다.', 'success');
									}}
									className="w-full px-4 py-2.5 rounded-xl bg-[#0D1B2A] text-white text-sm font-semibold hover:opacity-95 transition"
								>
									완료
								</button>
							)}

							{normalizeActionStatus(actionDraft.status) === '검토완료' && (
								<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
									<button
										type="button"
										disabled={pendingIntegrationTarget === 'Jira'}
										onClick={() => {
											setPendingIntegrationTarget('Jira');
											const ok = saveActionDraft({ nextStatus: '연동완료', integrationTool: 'Jira', closeAfterSave: true });
											setPendingIntegrationTarget('');
											if (ok) showToast('Jira 연동이 완료되어 연동 완료로 전환되었습니다.', 'success');
										}}
										className="w-full px-3 py-2.5 rounded-xl bg-[#0052CC] text-white text-sm font-semibold hover:bg-[#0047B3] transition disabled:opacity-70"
									>
										Jira연동하기
									</button>
									<button
										type="button"
										disabled={pendingIntegrationTarget === 'Notion'}
										onClick={() => {
											setPendingIntegrationTarget('Notion');
											const ok = saveActionDraft({ nextStatus: '연동완료', integrationTool: 'Notion', closeAfterSave: true });
											setPendingIntegrationTarget('');
											if (ok) showToast('Notion 연동이 완료되어 연동 완료로 전환되었습니다.', 'success');
										}}
										className="w-full px-3 py-2.5 rounded-xl bg-[#111827] text-white text-sm font-semibold hover:bg-black transition disabled:opacity-70"
									>
										Notion연동하기
									</button>
									<button
										type="button"
										onClick={() => {
											const ok = saveActionDraft({ nextStatus: '완료히스토리', closeAfterSave: true });
											if (ok) showToast('완료 히스토리에 저장되었습니다.', 'success');
										}}
										className="w-full px-3 py-2.5 rounded-xl border border-[rgba(0,100,180,0.2)] text-[#0D1B2A] text-sm font-semibold hover:bg-[#F8FAFF] transition"
									>
											완료히스토리저장
									</button>
								</div>
							)}

							{normalizeActionStatus(actionDraft.status) === '연동완료' && (
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
									<button
										type="button"
										onClick={() => {
											const ok = saveActionDraft({ closeAfterSave: true });
											if (ok) showToast('변경 사항이 저장되었습니다.', 'success');
										}}
										className="w-full px-4 py-2.5 rounded-xl bg-[#0D1B2A] text-white text-sm font-semibold hover:opacity-95 transition"
									>
											변경사항저장
									</button>
									<button
										type="button"
										onClick={() => {
											const ok = saveActionDraft({ nextStatus: '완료히스토리', closeAfterSave: true });
											if (ok) showToast('연동 완료 항목을 완료 히스토리로 저장했습니다.', 'success');
										}}
										className="w-full px-4 py-2.5 rounded-xl border border-[rgba(0,100,180,0.2)] text-[#0D1B2A] text-sm font-semibold hover:bg-[#F8FAFF] transition"
									>
											완료히스토리저장
									</button>
								</div>
							)}

							{normalizeActionStatus(actionDraft.status) === '완료히스토리' && (
								<button
									type="button"
									onClick={() => {
										const ok = saveActionDraft({ closeAfterSave: true });
										if (ok) showToast('변경 사항이 저장되었습니다.', 'success');
									}}
									className="w-full px-4 py-2.5 rounded-xl bg-[#0D1B2A] text-white text-sm font-semibold hover:opacity-95 transition"
								>
									변경사항저장
								</button>
							)}

							<button type="button" onClick={() => requestDeleteActionItem(actionDraft.id)} className="w-full px-4 py-2.5 rounded-xl border border-[#EF4444]/30 text-[#EF4444] text-sm font-semibold hover:bg-[#FCE8E6] transition">삭제</button>
						</div>
					</aside>
				</div>
			)}

			{/* 참여자 모달 */}
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

			{/* 삭제 확인 모달 */}
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

			{/* 액션아이템 삭제 확인 모달 */}
			{pendingDeleteActionItemId && (
				<div className="fixed inset-0 z-[74] flex items-center justify-center p-4" aria-modal="true" role="dialog">
					<div className="absolute inset-0 bg-[#0D1B2A]/45" onClick={() => setPendingDeleteActionItemId(null)} />
					<div className="relative w-full max-w-sm rounded-3xl border border-[rgba(0,100,180,0.12)] bg-white p-6 shadow-2xl">
						<p className="text-base font-bold text-slate-900">액션 아이템을 삭제할까요?</p>
						<p className="mt-2 text-sm text-slate-500">정말 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.</p>
						<div className="mt-5 flex justify-end gap-2">
							<button type="button" onClick={() => setPendingDeleteActionItemId(null)} className="px-3.5 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">취소</button>
							<button type="button" onClick={confirmDeleteActionItem} className="px-3.5 py-2 rounded-lg bg-[#EF4444] text-white text-sm font-semibold hover:bg-[#DC2626]">삭제</button>
						</div>
					</div>
				</div>
			)}

			{/* 토스트 */}
			{toast.message && (
				<div className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-[70] px-4 w-full sm:w-auto" style={{ bottom: isMobile ? 'calc(env(safe-area-inset-bottom) + 5.75rem)' : '1.5rem' }}>
					<div className="relative text-xs sm:text-sm font-semibold py-3.5 px-5 rounded-2xl shadow-xl border flex items-center gap-2 w-full sm:w-auto sm:min-w-[260px]" style={{ backgroundColor: currentToastVariant.background, color: currentToastVariant.text, borderColor: currentToastVariant.border }}>
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={currentToastVariant.icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							{toast.type === 'error' && <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>}
							{toast.type === 'warning' && <><path d="M10.29 3.86 1.82 18A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>}
							{toast.type === 'success' && (<><circle cx="12" cy="12" r="10" fill={TOAST_COLORS.success} stroke="none" /><path d="M16.7 9.2 10.6 15.3 7.2 11.9" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></>)}
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