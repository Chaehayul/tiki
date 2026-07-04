import { useMemo, useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MobileTab from '../components/MobileTab';
import { deleteProjectMeeting, getProject, listProjectMeetings, listProjects, sendMeetingTasks, updateProjectMeeting } from '../api/apiClient';

const isTikiMeetingMetaItem = (item) =>
    Boolean(item && typeof item === 'object' && (item.__tiki_meta || item.type === '__tiki_meeting_meta'));

function statusBadgeClass(status) {
    if (status === '완료') return 'bg-[#E6F4EA] text-[#10B981]';
    if (status === '보류') return 'bg-[#FCE8E6] text-[#EF4444]';
    if (status === 'Jira 발행됨') return 'bg-[#EEF3FF] text-[#0099CC]';
    if (status === '연동완료') return 'bg-[#EEF3FF] text-[#0099CC]';
    if (status === '수행완료') return 'bg-[#F1F5F9] text-[#475569]';
    if (status === '검토완료') return 'bg-[#F1F5F9] text-[#475569]';
    return 'bg-[#FEF7E0] text-[#F59E0B]';
}

// ✅ 해야 할일 상태 뱃지 스타일 함수 추가
const ACTION_STATUS_ORDER = ['검토대기', '검토완료', '연동완료', '수행완료'];
const ACTION_STATUS_LABEL = {
    검토대기: '검토대기',
    검토완료: '검토완료',
    수행완료: '수행완료',
    연동완료: '연동완료',
};

function normalizeActionStatus(status) {
    const normalized = String(status || '').trim();
    if (normalized === '검증 전') return '검토대기';
    if (normalized === '완료' || normalized === '완료히스토리') return '수행완료';
    if (normalized === '연동 완료') return '연동완료';
    if (ACTION_STATUS_ORDER.includes(normalized)) return normalized;
    return '검토대기';
}

function actionStatusStyle(status) {
    const normalized = normalizeActionStatus(status);
    if (normalized === '연동완료') return { bg: '#EEF3FF', color: '#0099CC', border: '#0099CC' };
    if (normalized === '수행완료') return { bg: '#E6F4EA', color: '#10B981', border: '#10B981' };
    if (normalized === '검토완료') return { bg: '#F1F5F9', color: '#475569', border: '#94A3B8' };
    return { bg: '#FEF7E0', color: '#F59E0B', border: '#F59E0B' }; // 검토대기
}

function getActionStatusLabel(status) {
    return ACTION_STATUS_LABEL[normalizeActionStatus(status)] || '검토대기';
}

function getActionStatusBadgeLabel(status) {
    return getActionStatusLabel(status);
}

function isActionCompleteStatus(status) {
    return normalizeActionStatus(status) === '수행완료';
}

function compactLegacyActionHistoryItems(items) {
    const byId = new Map();
    const histories = [];

    items.forEach((item) => {
        const snapshotOf = String(item?.snapshotOf || '').trim();
        const historySavedAt = String(item?.historySavedAt || '').trim();
        if (snapshotOf || historySavedAt) {
            histories.push({ ...item, snapshotOf });
            return;
        }

        const id = String(item?.id || '').trim();
        const key = id || `${item?.text || item?.title || ''}::${item?.source || ''}::${item?.due || item?.dueDate || ''}`;
        if (!byId.has(key)) byId.set(key, item);
    });

    histories.forEach((history) => {
        const key = String(history.snapshotOf || '').trim();
        const recoveredKey = key || `${history?.text || history?.title || ''}::${history?.source || ''}::${history?.due || history?.dueDate || ''}`;
        const base = byId.get(recoveredKey);
        const merged = {
            ...(base || history),
            id: recoveredKey || history.id,
            status: '수행완료',
            integrationTool: base?.integrationTool || history.integrationTool || null,
            externalLink: base?.externalLink || history.externalLink || '',
            snapshotOf: null,
            historySavedAt: null,
        };
        byId.set(recoveredKey || merged.id, merged);
    });

    return Array.from(byId.values());
}

function getActionIntegrationLinks(item) {
    const links = item?.integrationLinks && typeof item.integrationLinks === 'object' ? item.integrationLinks : {};
    const legacyTool = String(item?.integrationTool || '').toLowerCase();
    const legacyLink = item?.externalLink || '';
    const isNotionUrl = (value) => String(value || '').toLowerCase().includes('notion');
    const isJiraUrl = (value) => String(value || '').toLowerCase().includes('jira');
    const structuredJira = links.jira && !isNotionUrl(links.jira) ? links.jira : '';
    const structuredNotion = links.notion || (links.jira && isNotionUrl(links.jira) ? links.jira : '');
    return {
        jira: structuredJira || (legacyTool === 'jira' && isJiraUrl(legacyLink) ? legacyLink : ''),
        notion: structuredNotion || (legacyTool === 'notion' ? legacyLink : ''),
    };
}

function hasActionIntegration(item) {
    const links = getActionIntegrationLinks(item);
    return Boolean(links.jira || links.notion || item?.externalLink || item?.integrationTool);
}

function hasActionIntegrationTool(item, tool) {
    const links = getActionIntegrationLinks(item);
    return Boolean(links[String(tool || '').toLowerCase()]);
}

function getActionIntegrationEntries(item) {
    const links = getActionIntegrationLinks(item);
    return [
        links.jira ? { id: 'jira', label: 'Jira', link: links.jira } : null,
        links.notion ? { id: 'notion', label: 'Notion', link: links.notion } : null,
    ].filter(Boolean);
}

function getMeetingDisplayStatus(meeting, actionItems) {
    const title = String(meeting?.title || '').trim();
    const meetingId = String(meeting?.id || '').trim();
    const relatedActions = actionItems.filter((item) => {
        const source = String(item?.source || '').trim();
        return (title && source === title) || (meetingId && String(item?.meetingId || '') === meetingId);
    });

    if (relatedActions.length === 0) {
        const raw = String(meeting?.status || '').trim();
        if (raw === '완료') return '진행 중';
        return raw || '진행 중';
    }

    const statuses = relatedActions.map((item) => normalizeActionStatus(item.status));
    if (statuses.every((status) => isActionCompleteStatus(status))) return '완료';
    if (statuses.some((status) => status === '검토완료' || isActionCompleteStatus(status))) return '진행 중';
    return '검토대기';
}

function toDateInputValue(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{4}\.\d{2}\.\d{2}$/.test(raw)) return raw.replace(/\./g, '-');
    const koreanDate = raw.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
    if (koreanDate) {
        const year = koreanDate[1];
        const month = pad2(Number(koreanDate[2]));
        const day = pad2(Number(koreanDate[3]));
        return `${year}-${month}-${day}`;
    }
    return '';
}

function fromDateInputValue(value) {
    const raw = String(value || '').trim();
    if (!raw) return '-';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return raw;
}

function formatDueDateDisplay(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === '-') return '-';
    const koreanDate = raw.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
    if (koreanDate) {
        return `${Number(koreanDate[1])}년 ${Number(koreanDate[2])}월 ${Number(koreanDate[3])}일`;
    }

    const directDate = raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:$|T)/);
    if (directDate) {
        return `${Number(directDate[1])}년 ${Number(directDate[2])}월 ${Number(directDate[3])}일`;
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월 ${parsed.getDate()}일`;
    }

    return raw;
}

function toDateLabel(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === '-') return '';
    const directDate = raw.match(/^(\d{4})[-./](\d{2})[-./](\d{2})/);
    if (directDate) {
        return `${directDate[1]}-${directDate[2]}-${directDate[3]}`;
    }
    const isoDate = raw.match(/^(\d{4}-\d{2}-\d{2})T/);
    if (isoDate) {
        return isoDate[1];
    }
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
    정아름: 'PM',
    김민수: 'Backend',
    송지영: 'PM',
    김소현: 'ML Engineer',
    채하율: 'Frontend',
    박디자이너: 'Designer',
    외부리서처A: 'QA',
};

const PARTICIPANT_COLOR_MAP = {
    정아름: '#0099CC',
    김민수: '#10B981',
    송지영: '#7C3AED',
    김소현: '#F59E0B',
    채하율: '#0EA5E9',
    박디자이너: '#EF4444',
    외부리서처A: '#5A6F8A',
};

const PROJECT_OVERRIDE_STORAGE_KEY = 'tiki_project_overrides';
const PROJECT_CATALOG_STORAGE_KEY = 'tiki_project_catalog';
const DELETED_PROJECT_IDS_KEY = 'tiki_deleted_project_ids';
const MANUAL_MEETING_RECORDS_KEY = 'tiki_manual_minutes_records';
const isTemporaryCodexProject = (project) => String(project?.name || '').toLowerCase().includes('codex invitation check');

const TOAST_COLORS = { info: '#0099CC', ai: '#7C3AED', success: '#10B981', warning: '#F59E0B', error: '#EF4444' };
const TOAST_VARIANTS = {
    info: { background: '#0D1B2A', text: '#FFFFFF', icon: TOAST_COLORS.info, border: 'rgba(255,255,255,0.12)' },
    ai: { background: '#0D1B2A', text: '#FFFFFF', icon: TOAST_COLORS.ai, border: 'rgba(255,255,255,0.12)' },
    success: { background: '#0D1B2A', text: '#FFFFFF', icon: TOAST_COLORS.success, border: 'rgba(255,255,255,0.12)' },
    warning: { background: '#0D1B2A', text: '#FFFFFF', icon: TOAST_COLORS.warning, border: 'rgba(255,255,255,0.12)' },
    error: { background: '#0D1B2A', text: '#FFFFFF', icon: TOAST_COLORS.error, border: 'rgba(255,255,255,0.12)' },
};

function normalizeProjectId(value) {
    return String(value ?? '').trim();
}

function isSameProjectId(left, right) {
    return normalizeProjectId(left) === normalizeProjectId(right);
}

function normalizeProjectVisibility(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'private' || raw === '개인') return 'private';
    if (raw === 'org' || raw === 'public' || raw === '전체보기') return 'org';
    if (raw === 'members' || raw === '구성원만') return 'members';
    return 'members';
}

function getProjectVisibilityMeta(value) {
    const normalized = normalizeProjectVisibility(value);
    if (normalized === 'private') return { label: '개인', icon: 'lock' };
    if (normalized === 'org') return { label: '전체보기', icon: 'globe' };
    return { label: '구성원만', icon: 'user' };
}

function normalizeProjectStatus(project) {
    const raw = String(project?.status || project?.projectStatus || '').trim();
    const hasCompletionFlag = Boolean(project?.completed_at || project?.completedAt || project?.isCompleted);
    if (hasCompletionFlag && (raw === '완료' || raw === 'completed')) return '완료';
    if (raw === '보류' || raw === 'paused') return '보류';
    if (raw === 'Jira 발행됨') return raw;
    return '진행 중';
}

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

const writeProjectOverrides = (next) => {
    try {
        localStorage.setItem(PROJECT_OVERRIDE_STORAGE_KEY, JSON.stringify(next));
    } catch {
        // ignore storage write failures in local mock mode
    }
};

const readManualMeetingRecords = () => {
    try {
        const raw = localStorage.getItem(MANUAL_MEETING_RECORDS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const normalizeStorageDate = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '-';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.replace(/-/g, '.');
    if (/^\d{4}\.\d{2}\.\d{2}$/.test(raw)) return raw;
    return raw;
};

const readProjectCatalog = () => {
    try {
        const raw = localStorage.getItem(PROJECT_CATALOG_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        const projects = Array.isArray(parsed) ? parsed : [];
        const cleaned = projects.filter((project) => !isTemporaryCodexProject(project));
        if (cleaned.length !== projects.length) {
            localStorage.setItem(PROJECT_CATALOG_STORAGE_KEY, JSON.stringify(cleaned));
        }
        return cleaned;
    } catch {
        return [];
    }
};

const writeProjectCatalog = (next) => {
    try {
        const cleaned = Array.isArray(next) ? next.filter((project) => !isTemporaryCodexProject(project)) : [];
        localStorage.setItem(PROJECT_CATALOG_STORAGE_KEY, JSON.stringify(cleaned));
    } catch {
        // ignore storage write failures in local mock mode
    }
};

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
        }
    }
    return null;
}

function getDeletedProjectStorageKey(user) {
    const identity = user?.email || user?.name || 'anonymous';
    return `${DELETED_PROJECT_IDS_KEY}_${identity}`;
}

function loadDeletedProjectIds(user) {
    try {
        const raw = localStorage.getItem(getDeletedProjectStorageKey(user));
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map((id) => String(id)).filter(Boolean) : [];
    } catch {
        return [];
    }
}

function normalizeProject(project) {
    if (!project) return null;
    const createdAt =
        toDateLabel(project.createdAt) ||
        toDateLabel(project.created_at) ||
        toDateLabel(project.createdDate) ||
        toDateLabel(project.created_date) ||
        toDateLabel(project.createdOn) ||
        toDateLabel(project.created_on) ||
        '';

    const teamLead = String(project.teamLead || project.team_lead || '').trim();
    const memberNames = Array.isArray(project.members)
        ? project.members
              .filter((member) => {
                  if (typeof member === 'string') return true;
                  const inviteStatus = String(member?.invite_status || member?.inviteStatus || '').trim();
                  return !inviteStatus || inviteStatus === 'accepted';
              })
              .map((member) => {
                  if (typeof member === 'string') return member;
                  return member?.name || member?.email || '';
              })
              .filter(Boolean)
        : [];
    const storedParticipants = Array.isArray(project.members)
        ? []
        : Array.isArray(project.participants)
          ? project.participants.filter(Boolean)
          : [];
    const participants = [
        ...new Set([
            teamLead,
            ...storedParticipants,
            ...memberNames,
        ].filter(Boolean)),
    ];
    const admins = Array.isArray(project.admins)
        ? [...new Set(project.admins.filter((name) => participants.includes(name)))]
        : [];
    if (admins.length === 0 && participants[0]) {
        const fallbackAdmin = teamLead && participants.includes(teamLead) ? teamLead : participants[0];
        admins.push(fallbackAdmin);
    }
    const meetings = Array.isArray(project.meetings)
        ? project.meetings.map((meeting, idx) => ({
              id: meeting.id || `m-${project.id}-${idx + 1}`,
              date: meeting.date || '',
              title: meeting.title || '회의 제목 없음',
              status: meeting.status || '진행 중',
              type: meeting.type || '정기',
              detailType: meeting.detailType || 'uploaded',
              detailRecordId: meeting.detailRecordId || '',
              tags: Array.isArray(meeting.tags) && meeting.tags.length > 0 ? meeting.tags : ['#회의'],
              participants: Array.isArray(meeting.participants) ? meeting.participants.filter(Boolean) : [],
              summary: meeting.summary || '회의 요약이 아직 등록되지 않았습니다.',
              actionItems: typeof meeting.actionItems === 'number' ? meeting.actionItems : 0,
              action_items: (Array.isArray(meeting.action_items) ? meeting.action_items : Array.isArray(meeting.actionItemsList) ? meeting.actionItemsList : []).filter((item) => !isTikiMeetingMetaItem(item)),
              actionItemsList: (Array.isArray(meeting.actionItemsList) ? meeting.actionItemsList : Array.isArray(meeting.action_items) ? meeting.action_items : []).filter((item) => !isTikiMeetingMetaItem(item)),
              jiraLinked: typeof meeting.jiraLinked === 'number' ? meeting.jiraLinked : 0,
          }))
        : [];
    return {
        id: project.id,
        name: project.name || '프로젝트',
        description: project.description || '',
        createdAt,
        visibility: normalizeProjectVisibility(project.visibility || project.projectVisibility),
        status: normalizeProjectStatus(project),
        teamLead: teamLead || participants[0] || '담당자',
        participants,
        admins,
        myActionItems: Array.isArray(project.myActionItems) ? project.myActionItems : [],
        meetings,
    };
}

function SettingsIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.82-.33 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
    );
}

function MoreVerticalIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
            <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
        </svg>
    );
}

function ChevronDownIcon({ className = '' }) {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M6 9l6 6 6-6" />
        </svg>
    );
}

function CalendarIcon({ className = '' }) {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    );
}

function CheckIcon({ className = '' }) {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M20 6L9 17l-5-5" />
        </svg>
    );
}

function TrashIcon({ className = '' }) {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
    );
}

function CheckCircleIcon({ className = '' }) {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    );
}

function ZapIcon({ className = '' }) {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    );
}

function ArrowUpRightIcon({ className = '' }) {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
        </svg>
    );
}

function PencilIcon({ className = '' }) {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="m16.5 3.5 4 4L8 20l-4 1 1-4 11.5-13.5Z" />
        </svg>
    );
}

function VisibilityIcon({ type = 'members', className = '' }) {
    if (type === 'lock') {
        return (
            <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <rect x="3" y="11" width="18" height="10" rx="2" ry="2" />
                <path d="M7 11V8a5 5 0 0 1 10 0v3" />
            </svg>
        );
    }

    if (type === 'globe') {
        return (
            <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
        );
    }

    if (type === 'user') {
        return (
            <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
            </svg>
        );
    }

    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    );
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function pad2(n) {
    return String(n).padStart(2, '0');
}

function toDateStr(year, month, day) {
    return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function parseDateStr(dateStr) {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    return { year: y, month: m - 1, day: d };
}

function buildCalendarGrid(year, month) {
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const cells = [];

    for (let i = 0; i < startOffset; i += 1) {
        const day = daysInPrevMonth - startOffset + 1 + i;
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        cells.push({ day, inMonth: false, dateStr: toDateStr(prevYear, prevMonth, day) });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        cells.push({ day, inMonth: true, dateStr: toDateStr(year, month, day) });
    }

    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    let nextDay = 1;
    while (cells.length < 42) {
        cells.push({ day: nextDay, inMonth: false, dateStr: toDateStr(nextYear, nextMonth, nextDay) });
        nextDay += 1;
    }

    return cells;
}

function CustomDatePicker({ value, onSelect, onClose }) {
    const today = new Date();
    const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
    const parsedValue = parseDateStr(value) || parseDateStr(todayStr);
    const [viewYear, setViewYear] = useState(parsedValue.year);
    const [viewMonth, setViewMonth] = useState(parsedValue.month);

    const cells = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);

    const goPrevMonth = (e) => {
        e.stopPropagation();
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear((y) => y - 1);
        } else {
            setViewMonth((m) => m - 1);
        }
    };

    const goNextMonth = (e) => {
        e.stopPropagation();
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear((y) => y + 1);
        } else {
            setViewMonth((m) => m + 1);
        }
    };

    return (
        <div
            className="absolute z-[300] bottom-full mb-2 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 w-[280px] max-w-[88vw] box-border overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)] p-3.5"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between mb-2.5">
                <button
                    type="button"
                    onClick={goPrevMonth}
                    className="p-1.5 rounded-lg text-[#5A6F8A] hover:bg-[#F1F4F8] hover:text-[#0D1B2A] transition-colors"
                    aria-label="이전 달"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <span className="text-sm font-bold text-[#0D1B2A]">
                    {viewYear}년 {viewMonth + 1}월
                </span>
                <button
                    type="button"
                    onClick={goNextMonth}
                    className="p-1.5 rounded-lg text-[#5A6F8A] hover:bg-[#F1F4F8] hover:text-[#0D1B2A] transition-colors"
                    aria-label="다음 달"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>
            </div>

            <div className="grid grid-cols-7 gap-y-1.5 w-full">
                {WEEKDAY_LABELS.map((label, idx) => (
                    <div
                        key={label}
                        className={`text-center text-[11px] font-semibold py-1 ${idx === 0 ? 'text-[#EF4444]' : idx === 6 ? 'text-[#0099CC]' : 'text-[#9AA7B8]'}`}
                    >
                        {label}
                    </div>
                ))}
                {cells.map((cell, idx) => {
                    const isSelected = cell.dateStr === value;
                    const isToday = cell.dateStr === todayStr;
                    const weekdayIdx = idx % 7;
                    return (
                        <button
                            key={`${cell.dateStr}-${idx}`}
                            type="button"
                            onClick={() => {
                                onSelect(cell.dateStr);
                                onClose();
                            }}
                            className={`aspect-square w-full flex items-center justify-center text-[13px] rounded-lg transition-colors ${
                                isSelected
                                    ? 'bg-[#0099CC] text-white font-bold'
                                    : !cell.inMonth
                                      ? 'text-[#C7D1DC] hover:bg-[#F8FAFF]'
                                      : isToday
                                        ? 'text-[#0099CC] font-bold border border-[#0099CC]/40 hover:bg-[#EEF3FF]'
                                        : weekdayIdx === 0
                                          ? 'text-[#EF4444] hover:bg-[#F8FAFF]'
                                          : weekdayIdx === 6
                                            ? 'text-[#0099CC] hover:bg-[#F8FAFF]'
                                            : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'
                            }`}
                        >
                            {cell.day}
                        </button>
                    );
                })}
            </div>
        </div>
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
    const [meetings, setMeetings] = useState([]);
    const [pendingEditMeetingId, setPendingEditMeetingId] = useState(null);
    const [editMeetingTitle, setEditMeetingTitle] = useState('');
    const [editMeetingTagsDraft, setEditMeetingTagsDraft] = useState([]);
    const [editMeetingTagInput, setEditMeetingTagInput] = useState('');
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
    const [actionDrawerView, setActionDrawerView] = useState('detail');
    const [activeActionItemId, setActiveActionItemId] = useState(null);
    const [actionDraft, setActionDraft] = useState(null);
    const [isActionEditMode, setIsActionEditMode] = useState(false);
    const currentUser = useMemo(() => parseCurrentUser(), [location.key]);
    const deletedProjectIds = useMemo(() => loadDeletedProjectIds(currentUser), [currentUser, location.key]);
    const isDeletedProject = useMemo(
        () => (id) => deletedProjectIds.includes(String(id || '').trim()),
        [deletedProjectIds]
    );
    const [projectCatalog, setProjectCatalog] = useState(() => readProjectCatalog());
    const [pendingIntegrationTarget, setPendingIntegrationTarget] = useState('');
    const [selectedIntegrationTools, setSelectedIntegrationTools] = useState([]);
    const [isDueDateOpen, setIsDueDateOpen] = useState(false);
    const [isDrawerAssigneeOpen, setIsDrawerAssigneeOpen] = useState(false);
    const [openMoreMenuId, setOpenMoreMenuId] = useState(null);
    const [openActionMoreMenuId, setOpenActionMoreMenuId] = useState(null);
    const actionAssigneeFilterRef = useRef(null);
    const actionStatusFilterRef = useRef(null);
    const actionSourceFilterRef = useRef(null);
    const dueDateDropdownRef = useRef(null);
    const drawerAssigneeRef = useRef(null);
    const actionDescriptionRef = useRef(null);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

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
                (actionAssigneeFilterRef.current && actionAssigneeFilterRef.current.contains(e.target)) ||
                (actionStatusFilterRef.current && actionStatusFilterRef.current.contains(e.target)) ||
                (actionSourceFilterRef.current && actionSourceFilterRef.current.contains(e.target));
            if (!clickedActionFilter) setOpenActionFilter(null);
            if (!e.target.closest('[data-more-menu-root]')) setOpenMoreMenuId(null);
            if (!e.target.closest('[data-action-more-menu-root]')) setOpenActionMoreMenuId(null);
            if (isDueDateOpen && dueDateDropdownRef.current && !dueDateDropdownRef.current.contains(e.target))
                setIsDueDateOpen(false);
            if (!e.target.closest('[data-drawer-assignee-root]')) setIsDrawerAssigneeOpen(false);
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [isDueDateOpen]);

    useEffect(
        () => () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        },
        []
    );

    const stateLabels = {
        IDLE: '대기 중',
        UPLOADING: '업로드 중',
        PROCESSING: 'AI 분석 중',
        COMPLETED: '분석 완료',
        FAILED: '오류 발생',
    };

    const projectOverrides = useMemo(() => readProjectOverrides(), [location.key]);

    useEffect(() => {
        listProjects()
            .then((data) => {
                const mapped = (Array.isArray(data) ? data : [])
                    .filter((p) => !isDeletedProject(p?.id))
                    .map((p) =>
                    normalizeProject({
                        id: p.id,
                        name: p.name,
                        description: p.description,
                        createdAt: p.created_at ? String(p.created_at) : '',
                        teamLead: p.team_lead || (p.owner?.name),
                        members: Array.isArray(p.members) ? p.members : [],
                    })
                );

                // Replace catalog with API data, discarding any old mock entries (integer IDs).
                // Real (UUID) entries are fully trusted from the fresh API response — an entry
                // that no longer comes back from listProjects() no longer exists, so it must not
                // be retained here even if it was cached from an earlier visit.
                const isUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));
                setProjectCatalog((prev) => {
                    const base = (Array.isArray(prev) ? prev : []).filter((p) => !isUUID(p?.id));
                    const next = [...base, ...mapped];
                    writeProjectCatalog(next);
                    return next;
                });
            })
            .catch(() => {
                // API failures leave the current local navigation state intact.
            });
    }, [isDeletedProject]);

    useEffect(() => {
        const id = normalizeProjectId(projectId);
        if (!id) return;
        getProject(id)
            .then((data) => {
                const normalized = normalizeProject({
                    ...data,
                    createdAt: data?.created_at ? String(data.created_at) : data?.createdAt,
                    teamLead: data?.team_lead,
                    members: Array.isArray(data?.members) ? data.members : [],
                    meetings: Array.isArray(data?.meetings) ? data.meetings : [],
                });
                if (!normalized?.id || isDeletedProject(normalized.id)) return;
                setProjectCatalog((prev) => {
                    const base = (Array.isArray(prev) ? prev : []).filter((item) => !isDeletedProject(item?.id));
                    const idx = base.findIndex((item) => isSameProjectId(item?.id, normalized.id));
                    const next = idx >= 0 ? [...base] : [...base, normalized];
                    if (idx >= 0) next[idx] = { ...base[idx], ...normalized };
                    writeProjectCatalog(next);
                    return next;
                });
            })
            .catch(() => {
                // Keep route state/local records if the project cannot be fetched.
            });
    }, [projectId, isDeletedProject]);

    const project = useMemo(() => {
        const id = normalizeProjectId(projectId);
        if (!id) return null;
        if (isDeletedProject(id)) return null;
        const override = projectOverrides[id] || null;
        const mergeWithOverride = (baseProject) => {
            const safeOverride = { ...(override || {}) };
            if (typeof safeOverride.createdAt === 'string' && safeOverride.createdAt.trim() === '-') {
                delete safeOverride.createdAt;
            }

            return normalizeProject({
                ...baseProject,
                ...safeOverride,
                participants: Array.isArray(override?.participants)
                    ? override.participants
                    : baseProject?.participants,
                admins: Array.isArray(override?.admins) ? override.admins : baseProject?.admins,
            });
        };

        const byCatalog = projectCatalog.find((p) => isSameProjectId(p?.id, id));
        if (byCatalog) {
            return mergeWithOverride(byCatalog);
        }

        const stateProject = location.state?.project;
        if (stateProject && isSameProjectId(stateProject.id, id)) {
            return mergeWithOverride(stateProject);
        }
        if (override && isSameProjectId(override.id, id)) return normalizeProject(override);
        return null;
    }, [projectId, location.state, projectCatalog, projectOverrides, isDeletedProject]);

    useEffect(() => {
        const id = normalizeProjectId(projectId);
        if (id && isDeletedProject(id)) {
            navigate('/project-list', { replace: true });
        }
    }, [projectId, isDeletedProject, navigate]);

    useEffect(() => {
        const fromState = location.state?.project;
        if (!fromState?.id) return;
        if (isDeletedProject(fromState.id)) return;

        const normalized = normalizeProject(fromState);
        if (!normalized?.id) return;

        setProjectCatalog((prev) => {
            const base = (Array.isArray(prev) ? prev : []).filter((item) => !isDeletedProject(item?.id));
            const idx = base.findIndex((item) => isSameProjectId(item?.id, normalized.id));

            if (idx >= 0) {
                const existing = normalizeProject(base[idx]);
                if (JSON.stringify(existing) === JSON.stringify(normalized)) return prev;
                const next = [...base];
                next[idx] = { ...base[idx], ...normalized };
                writeProjectCatalog(next);
                return next;
            }

            const next = [...base, normalized];
            writeProjectCatalog(next);
            return next;
        });
    }, [location.key, location.state, isDeletedProject]);

    const projectCandidates = useMemo(() => {
        const source = [...projectCatalog].filter((item) => !isDeletedProject(item?.id));
        const deduped = [];
        source.forEach((item) => {
            if (!item?.id) return;
            if (deduped.some((existing) => isSameProjectId(existing.id, item.id))) return;
            deduped.push(item);
        });

        const merged = deduped.map((item) => {
            const override = projectOverrides[String(item.id)];
            if (!override) return item;
            return normalizeProject({
                ...item,
                ...override,
                participants: Array.isArray(override.participants) ? override.participants : item.participants,
                admins: Array.isArray(override.admins) ? override.admins : item.admins,
            });
        });
        if (!project || isDeletedProject(project.id)) return merged;
        const exists = merged.some((p) => isSameProjectId(p.id, project.id));
        return exists ? merged : [project, ...merged];
    }, [project, projectCatalog, projectOverrides, isDeletedProject]);

    const filteredProjects = useMemo(() => {
        const q = projectSearch.trim().toLowerCase();
        if (!q) return projectCandidates;
        return projectCandidates.filter((p) => p.name.toLowerCase().includes(q));
    }, [projectSearch, projectCandidates]);

    const visibleMeetings = useMemo(() => {
        if (!project) return [];
        const q = meetingSearch.trim().toLowerCase();
        let result = meetings.filter((m) => {
            if (deletedMeetingIds.includes(m.id)) return false;
            const typeOk = meetingType === '전체' || m.type === meetingType;
            const searchOk =
                !q ||
                m.title.toLowerCase().includes(q) ||
                m.summary.toLowerCase().includes(q) ||
                m.tags.join(' ').toLowerCase().includes(q);
            return typeOk && searchOk;
        });
        return result.sort((a, b) =>
            sortOrder === '과거순' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
        );
    }, [project, meetings, meetingSearch, meetingType, sortOrder, deletedMeetingIds]);

    useEffect(() => {
        setMeetings(Array.isArray(project?.meetings) ? project.meetings : []);
    }, [project]);

    useEffect(() => {
        if (!project) {
            setActionItems([]);
            return;
        }

        const manualRecords = readManualMeetingRecords();
        const serverMeetings = Array.isArray(project.meetings) ? project.meetings : [];
        const serverMeetingIds = new Set(serverMeetings.map((meeting) => String(meeting?.id || '')).filter(Boolean));
        const serverMeetingTitles = new Set(serverMeetings.map((meeting) => String(meeting?.title || '').trim()).filter(Boolean));
        const serverMeetingHasActions = (record) => {
            const linkedMeetingId = String(record?.serverMeetingId || record?.meetingId || '').trim();
            const title = String(record?.title || '').trim();
            const matchedMeeting = serverMeetings.find((meeting) => {
                const meetingId = String(meeting?.id || '').trim();
                const meetingTitle = String(meeting?.title || '').trim();
                return (linkedMeetingId && meetingId === linkedMeetingId) || (title && meetingTitle === title);
            });
            if (!matchedMeeting) return false;
            const actions = Array.isArray(matchedMeeting?.action_items)
                ? matchedMeeting.action_items
                : Array.isArray(matchedMeeting?.actionItemsList)
                  ? matchedMeeting.actionItemsList
                  : [];
            return actions.filter((action) => !isTikiMeetingMetaItem(action)).length > 0;
        };
        const projectManualRecords = Object.values(manualRecords)
            .filter((record) => String(record?.projectId || '') === String(project.id || ''));
        const findLocalManualAction = (meeting, action, index) => {
            const meetingId = String(meeting?.id || '').trim();
            const meetingTitle = String(meeting?.title || '').trim();
            const actionId = String(action?.id || '').trim();
            const actionText = String(action?.text || action?.title || '').trim();
            const matchedRecord = projectManualRecords.find((record) => {
                const linkedMeetingId = String(record?.serverMeetingId || record?.meetingId || '').trim();
                const title = String(record?.title || '').trim();
                return (linkedMeetingId && linkedMeetingId === meetingId) || (title && title === meetingTitle);
            });
            if (!matchedRecord || !Array.isArray(matchedRecord.actions)) return null;
            return matchedRecord.actions.find((localAction, localIndex) => {
                const localId = String(localAction?.id || `${matchedRecord.id}-action-${localIndex + 1}`);
                const localText = String(localAction?.text || localAction?.title || '').trim();
                return (actionId && localId === actionId) || (actionText && localText === actionText) || localIndex === index;
            }) || null;
        };
        const serverActionItems = serverMeetings.flatMap((meeting) => {
            const actions = Array.isArray(meeting?.action_items) ? meeting.action_items : Array.isArray(meeting?.actionItemsList) ? meeting.actionItemsList : [];
            return actions
                .filter((action) => !isTikiMeetingMetaItem(action))
                .map((action, index) => {
                    const localAction = findLocalManualAction(meeting, action, index);
                    const localDone = localAction?.checked || normalizeActionStatus(localAction?.status) === '수행완료';
                    const status = localDone
                        ? '수행완료'
                        : action?.status ? normalizeActionStatus(action.status) : action?.checked ? '수행완료' : '검토대기';
                    return {
                        id: action?.id || `${meeting.id}-action-${index + 1}`,
                        text: action?.text || action?.title || '',
                        description: action?.description || meeting?.summary || '',
                        due: normalizeStorageDate(action?.due || action?.dueDate || action?.due_at),
                        assignee: action?.assignee || project.teamLead || '담당자 미지정',
                        status,
                        source: String(action?.source || meeting?.title || '').trim() || project.name || '회의 제목 없음',
                        integrationTool: action?.integrationTool || action?.integrationProvider || null,
                        integrationLinks: getActionIntegrationLinks(action),
                        externalLink: action?.externalLink || '',
                        snapshotOf: action?.snapshotOf || null,
                        historySavedAt: action?.historySavedAt || null,
                        updatedAt: action?.updatedAt || getKSTTimestampLabel(),
                        meeting,
                    };
                });
        });
        const manualActionItems = Object.values(manualRecords)
            .filter((record) => String(record?.projectId || '') === String(project.id || ''))
            .filter((record) => {
                const linkedMeetingId = String(record?.serverMeetingId || record?.meetingId || '').trim();
                const title = String(record?.title || '').trim();
                const hasServerMeeting = (linkedMeetingId && serverMeetingIds.has(linkedMeetingId)) || (title && serverMeetingTitles.has(title));
                return !hasServerMeeting || !serverMeetingHasActions(record);
            })
            .flatMap((record) => {
                const actions = Array.isArray(record?.actions) ? record.actions : [];
                return actions.map((action, index) => ({
                    id: `${record.id}-action-${index + 1}`,
                    text: action?.text || '',
                    description: record?.summary || '',
                    due: normalizeStorageDate(action?.dueDate),
                    assignee: action?.assignee || project.teamLead || '담당자 미지정',
                    status: action?.status ? normalizeActionStatus(action.status) : action?.checked ? '수행완료' : '검토대기',
                    source: String(record?.title || '').trim() || project.name || '회의 제목 없음',
                    integrationTool: null,
                    externalLink: '',
                    snapshotOf: null,
                    historySavedAt: null,
                    updatedAt: record?.createdAt || getKSTTimestampLabel(),
                    meeting: null,
                }));
            });

        const mergedActionItems = compactLegacyActionHistoryItems([...serverActionItems, ...manualActionItems]).filter((item) => {
            return String(item?.text || '').trim().length > 0;
        });
        const dedupedActionItems = [];
        const seen = new Set();
        mergedActionItems.forEach((item) => {
            const id = String(item?.id || '').trim();
            const dedupeKey = id || `${item?.text || ''}::${item?.source || ''}::${item?.due || ''}`;
            if (seen.has(dedupeKey)) return;
            seen.add(dedupeKey);
            dedupedActionItems.push(item);
        });

        const fallbackMeetingTitle =
            project.meetings.find((meeting) => String(meeting.title || '').trim())?.title ||
            project.name ||
            '회의 제목 없음';
        setActionItems(
            dedupedActionItems.map((item) => ({
                id: item.id,
                text: item.text,
                description: item.description || '',
                due: item.due || '-',
                assignee:
                    String(item.assignee || '').trim() && String(item.assignee || '').trim() !== '담당자 미지정'
                        ? item.assignee
                        : project.teamLead || '담당자 미지정',
                status: normalizeActionStatus(item.status),
                source:
                    String(item.source || '').trim() ||
                    String(item.meeting?.title || '').trim() ||
                    fallbackMeetingTitle,
                integrationTool: item.integrationTool || null,
                integrationLinks: getActionIntegrationLinks(item),
                externalLink: item.externalLink || '',
                snapshotOf: item.snapshotOf || null,
                historySavedAt: item.historySavedAt || null,
                updatedAt: item.updatedAt || getKSTTimestampLabel(),
                meeting: null,
            }))
        );
    }, [project]);

    const allActionItems = actionItems;
    const computedProjectStatus = useMemo(() => {
        if (!project) return '진행 중';
        if (allActionItems.length > 0 && allActionItems.every((item) => isActionCompleteStatus(item.status))) {
            return '완료';
        }
        if (allActionItems.length > 0) return '진행 중';
        return normalizeProjectStatus(project);
    }, [project, allActionItems]);

    useEffect(() => {
        if (!project?.id) return;
        if (project.status === computedProjectStatus) return;

        const id = String(project.id);
        const nextOverrides = readProjectOverrides();
        const prevOverride = nextOverrides[id] && typeof nextOverrides[id] === 'object' ? nextOverrides[id] : {};
        nextOverrides[id] = {
            ...prevOverride,
            id,
            status: computedProjectStatus,
            isCompleted: computedProjectStatus === '완료',
            completedAt: computedProjectStatus === '완료' ? prevOverride.completedAt || new Date().toISOString() : null,
        };
        writeProjectOverrides(nextOverrides);

        setProjectCatalog((prev) => {
            const base = Array.isArray(prev) ? prev : [];
            const next = base.map((item) =>
                isSameProjectId(item?.id, id)
                    ? {
                          ...item,
                          status: computedProjectStatus,
                          isCompleted: computedProjectStatus === '완료',
                          completedAt: computedProjectStatus === '완료' ? item.completedAt || new Date().toISOString() : null,
                      }
                    : item
            );
            writeProjectCatalog(next);
            return next;
        });
    }, [project?.id, project?.status, computedProjectStatus]);

    const actionAssigneeOptions = useMemo(() => {
        const participants = Array.isArray(project?.participants) ? project.participants : [];
        return ['전체', ...new Set([...participants, ...allActionItems.map((item) => item.assignee)].filter(Boolean))];
    }, [project, allActionItems]);
    const actionStatusOptions = useMemo(() => {
        const statusSet = new Set(ACTION_STATUS_ORDER);
        allActionItems.forEach((item) => statusSet.add(normalizeActionStatus(item.status)));
        return ['전체', ...statusSet];
    }, [allActionItems]);
    const actionSourceOptions = useMemo(() => {
        const meetingTitles = (project?.meetings || [])
            .map((meeting) => String(meeting?.title || '').trim())
            .filter(Boolean);
        const itemSources = allActionItems
            .map((item) => String(item?.source || '').trim())
            .filter(Boolean);
        return ['전체', ...new Set([...meetingTitles, ...itemSources])];
    }, [project?.meetings, allActionItems]);

    const actionMetricItems = useMemo(() => {
        return allActionItems.filter((item) => {
            const assigneeOk = actionAssigneeFilter === '전체' || item.assignee === actionAssigneeFilter;
            const sourceOk = actionSourceFilter === '전체' || item.source === actionSourceFilter;
            return assigneeOk && sourceOk;
        });
    }, [allActionItems, actionAssigneeFilter, actionSourceFilter]);

    const filteredActionItems = useMemo(() => {
        return allActionItems.filter((item) => {
            const assigneeOk = actionAssigneeFilter === '전체' || item.assignee === actionAssigneeFilter;
            const normalizedStatus = normalizeActionStatus(item.status);
            const statusOk =
                actionStatusFilter === '전체' ||
                (actionStatusFilter === '연동완료'
                    ? normalizedStatus === '연동완료' || hasActionIntegration(item)
                    : normalizedStatus === actionStatusFilter);
            const sourceOk = actionSourceFilter === '전체' || item.source === actionSourceFilter;
            return assigneeOk && statusOk && sourceOk;
        });
    }, [allActionItems, actionAssigneeFilter, actionStatusFilter, actionSourceFilter]);

    const actionDashboardStats = useMemo(() => {
        return {
            reviewPending: actionMetricItems.filter((item) => normalizeActionStatus(item.status) === '검토대기').length,
            reviewDone: actionMetricItems.filter((item) => normalizeActionStatus(item.status) === '검토완료').length,
            performed: actionMetricItems.filter((item) => normalizeActionStatus(item.status) === '수행완료').length,
            linked: actionMetricItems.filter((item) => normalizeActionStatus(item.status) === '연동완료' || hasActionIntegration(item)).length,
        };
    }, [actionMetricItems]);

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
        return [
            ...new Set(
                [...(fromMeeting.length > 0 ? fromMeeting : fallbackParticipants), actionDraft.assignee].filter(Boolean)
            ),
        ];
    }, [project, actionDraft]);

    if (!project) {
        return (
            <div className="min-h-screen bg-[#F8FAFF] overflow-x-hidden pt-20 pb-20 md:pb-0 flex flex-col">
                <Header isMobile={isMobile} phase="IDLE" stateLabels={stateLabels} />
                <main className="flex-1 w-full px-4 md:px-8 py-6 md:py-8">
                    <div className="max-w-4xl mx-auto rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-8 text-center">
                        <p className="text-lg font-bold text-[#0D1B2A]">프로젝트를 찾을 수 없습니다.</p>
                        <p className="text-sm text-[#5A6F8A] mt-2">프로젝트 목록에서 다시 선택해 주세요.</p>
                        <button
                            type="button"
                            onClick={() => navigate('/project-list')}
                            className="mt-5 px-4 py-2 rounded-lg bg-[#0099CC] text-white text-sm font-semibold hover:bg-[#007EA7]"
                        >
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
        if (fromProject.length > 0) return [...new Set(fromProject)];
        if (project.teamLead && participants.includes(project.teamLead)) return [project.teamLead];
        return [];
    }, [project]);

    const showToast = (msg, type = 'info') => {
        setToast({ message: msg, type });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast({ message: '', type: 'info' }), 2200);
    };
    const openParticipantsModal = (members = [], title = '회의 참여자') => {
        const normalized = Array.isArray(members) ? members.filter(Boolean) : [];
        setParticipantsModalMembers(normalized);
        setParticipantsModalTitle(title);
        setIsParticipantsModalOpen(true);
    };
    const closeParticipantsModal = () => setIsParticipantsModalOpen(false);
    const parseTagInput = (raw) => {
        return [
            ...new Set(
                String(raw || '')
                    .split(/[\s,]+/)
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
            ),
        ];
    };
    const normalizeTag = (raw) => {
        const base = String(raw || '').trim();
        if (!base) return '';
        return base.startsWith('#') ? base : `#${base}`;
    };
    const persistProjectMeetings = (nextMeetings) => {
        const id = String(project?.id || '');
        if (!id) return;
        const nextOverrides = readProjectOverrides();
        const prev = nextOverrides[id] && typeof nextOverrides[id] === 'object' ? nextOverrides[id] : {};
        nextOverrides[id] = { ...prev, meetings: nextMeetings };
        writeProjectOverrides(nextOverrides);
    };
    const handleEditMeeting = (meetingId) => {
        const target = meetings.find((meeting) => meeting.id === meetingId);
        if (!target) return;
        setPendingEditMeetingId(meetingId);
        setEditMeetingTitle(target.title || '');
        setEditMeetingTagsDraft(Array.isArray(target.tags) ? [...target.tags] : []);
        setEditMeetingTagInput('');
    };
    const addTagToDraft = () => {
        const normalized = normalizeTag(editMeetingTagInput);
        if (!normalized) return;
        setEditMeetingTagsDraft((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
        setEditMeetingTagInput('');
    };
    const removeTagFromDraft = (tag) => {
        setEditMeetingTagsDraft((prev) => prev.filter((item) => item !== tag));
    };
    const cancelEditMeeting = () => {
        setPendingEditMeetingId(null);
        setEditMeetingTitle('');
        setEditMeetingTagsDraft([]);
        setEditMeetingTagInput('');
    };
    const confirmEditMeeting = async () => {
        const nextTitle = String(editMeetingTitle || '').trim();
        if (!pendingEditMeetingId) return;
        if (!nextTitle) {
            showToast('회의 제목을 입력해 주세요.', 'warning');
            return;
        }
        const mergedTags = [...editMeetingTagsDraft, ...parseTagInput(editMeetingTagInput)];
        const nextTags = [...new Set(mergedTags.map((tag) => normalizeTag(tag)).filter(Boolean))];
        if (nextTags.length === 0) {
            showToast('태그를 1개 이상 입력해 주세요.', 'warning');
            return;
        }
        const nextMeetings = meetings.map((meeting) =>
            meeting.id === pendingEditMeetingId ? { ...meeting, title: nextTitle, tags: nextTags } : meeting
        );
        setMeetings(nextMeetings);
        persistProjectMeetings(nextMeetings);
        try {
            await updateProjectMeeting(project.id, pendingEditMeetingId, {
                title: nextTitle,
                tags: nextTags,
            });
        } catch {
            // Keep the local edit visible; the next project refetch will reconcile server state.
        }
        cancelEditMeeting();
        showToast('회의 제목/태그가 수정되었습니다.', 'success');
    };
    const handleDeleteMeeting = (meetingId) => {
        setPendingDeleteMeeting(meetingId);
    };
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
        setSelectedIntegrationTools([]);
        setActionDraft({
            id: item.id,
            text: item.text,
            description: item.description || '',
            due: item.due || '-',
            assignee: item.assignee || project.teamLead || '담당자 미지정',
            status: normalizeActionStatus(item.status),
            source: item.source || '-',
            integrationTool: item.integrationTool || null,
            integrationLinks: getActionIntegrationLinks(item),
            externalLink: item.externalLink || '',
            updatedAt: item.updatedAt || getKSTTimestampLabel(),
        });
        setPendingIntegrationTarget('');
        setActionDrawerView('detail');
        setIsDueDateOpen(false);
        setIsDrawerAssigneeOpen(false);
        setOpenActionMoreMenuId(null);
        setIsActionEditMode(false);
        setIsActionDrawerOpen(true);
    };

    const closeActionDrawer = () => {
        setIsActionDrawerOpen(false);
        setActiveActionItemId(null);
        setActionDraft(null);
        setIsActionEditMode(false);
        setPendingIntegrationTarget('');
        setSelectedIntegrationTools([]);
        setActionDrawerView('detail');
        setIsDueDateOpen(false);
        setIsDrawerAssigneeOpen(false);
    };

    const saveActionDraft = ({ nextStatus = null, integrationTool = null, integrationTools = null, closeAfterSave = false } = {}) => {
        if (!actionDraft) return false;
        const nextText = String(actionDraft.text || '').trim();
        if (!nextText) {
            showToast('해야 할 일 제목을 입력해 주세요.', 'warning');
            return false;
        }
        const normalizedStatus = nextStatus
            ? normalizeActionStatus(nextStatus)
            : normalizeActionStatus(actionDraft.status);
        const now = getKSTTimestampLabel();
        const targetTools = Array.isArray(integrationTools) && integrationTools.length > 0
            ? integrationTools
            : integrationTool ? [integrationTool] : [];
        const draftLinks = getActionIntegrationLinks(actionDraft);
        const addedLinks = targetTools.reduce((acc, tool) => {
            const key = String(tool || '').toLowerCase();
            if (key === 'jira' || key === 'notion') acc[key] = buildExternalLink(tool, nextText);
            return acc;
        }, {});
        const nextIntegrationLinks = targetTools.length > 0 ? { ...draftLinks, ...addedLinks } : draftLinks;
        const primaryTool = targetTools[targetTools.length - 1] || actionDraft.integrationTool || null;
        const primaryKey = String(primaryTool || '').toLowerCase();
        const nextPrimaryTool = primaryTool || null;
        const nextPrimaryLink = nextIntegrationLinks[primaryKey] || actionDraft.externalLink || '';
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
                integrationTool: nextPrimaryTool || item.integrationTool || null,
                integrationLinks: nextIntegrationLinks,
                externalLink: nextPrimaryLink || item.externalLink || '',
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
                integrationTool: nextPrimaryTool || prev.integrationTool || null,
                integrationLinks: nextIntegrationLinks,
                externalLink: nextPrimaryLink || prev.externalLink || '',
                updatedAt: now,
            };
        });
        if (closeAfterSave) closeActionDrawer();
        return true;
    };

    const toggleIntegrationTool = (tool) => {
        if (!actionDraft || hasActionIntegrationTool(actionDraft, tool)) return;
        setSelectedIntegrationTools((prev) =>
            prev.includes(tool) ? prev.filter((item) => item !== tool) : [...prev, tool]
        );
    };

    const startActionIntegration = async (tools) => {
        if (!actionDraft) return;
        const targetTools = (Array.isArray(tools) ? tools : [tools])
            .filter(Boolean)
            .filter((tool) => !hasActionIntegrationTool(actionDraft, tool));
        if (targetTools.length === 0) return;
        setPendingIntegrationTarget(targetTools.join(','));
        try {
            if (!actionDraft.meetingId) {
                throw new Error('회의록 출처가 없는 업무는 외부 서비스로 보낼 수 없습니다.');
            }
            const nextLinks = { ...getActionIntegrationLinks(actionDraft) };
            for (const tool of targetTools) {
                const response = await sendMeetingTasks(actionDraft.meetingId, {
                    provider: tool,
                    taskIds: [actionDraft.id],
                });
                const synced = (response?.results || []).find((item) => item.taskId === actionDraft.id || item.taskId === String(actionDraft.id));
                if (!synced || synced.syncStatus === 'failed') {
                    throw new Error(synced?.errorMessage || `${tool === 'notion' ? 'Notion' : 'Jira'} 전송에 실패했습니다.`);
                }
                nextLinks[tool] = synced.externalUrl || nextLinks[tool] || '';
            }
            const ok = saveActionDraft({
                nextStatus: normalizeActionStatus(actionDraft.status) === '수행완료' ? '수행완료' : '연동완료',
                closeAfterSave: false,
            });
            if (ok) {
                const nextItems = allActionItems.map((item) =>
                    item.id === actionDraft.id
                        ? {
                              ...item,
                              status: normalizeActionStatus(actionDraft.status) === '수행완료' ? '수행완료' : '연동완료',
                              integrationLinks: nextLinks,
                              externalLink: nextLinks.jira || nextLinks.notion || item.externalLink || '',
                              integrationTool: targetTools[targetTools.length - 1] === 'notion' ? 'Notion' : 'Jira',
                          }
                        : item
                );
                setActionItems(nextItems);
                persistProjectActionItems(nextItems);
                showToast(`${targetTools.map((tool) => (tool === 'notion' ? 'Notion' : 'Jira')).join(', ')} 전송이 완료되었습니다.`, 'success');
                closeActionDrawer();
            }
        } catch (err) {
            showToast(err?.message || '업무 보내기에 실패했습니다.', 'error');
        } finally {
            setPendingIntegrationTarget('');
            setSelectedIntegrationTools([]);
        }
    };

    const removeActionItem = (itemId) => {
        const nextItems = allActionItems.filter((item) => item.id !== itemId);
        setActionItems(nextItems);
        persistProjectActionItems(nextItems);
        if (activeActionItemId === itemId) closeActionDrawer();
        setOpenActionMoreMenuId(null);
        showToast('해야 할 일이 삭제되었습니다.', 'success');
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
    const confirmDeleteMeeting = async () => {
        if (!pendingDeleteMeeting) return;
        const meetingId = pendingDeleteMeeting;
        setDeletedMeetingIds((prev) => [...prev, meetingId]);
        showToast('회의가 목록에서 삭제되었습니다.', 'success');
        setPendingDeleteMeeting(null);
        try {
            await deleteProjectMeeting(project.id, meetingId);
        } catch {
            setDeletedMeetingIds((prev) => prev.filter((id) => id !== meetingId));
            showToast('회의 삭제에 실패했습니다.', 'error');
        }
    };
    const currentToastVariant = TOAST_VARIANTS[toast.type] || TOAST_VARIANTS.info;
    const projectDescriptionText = project.description?.trim() || '';
    const visibilityMeta = getProjectVisibilityMeta(project.visibility);
    const projectCreatedAtText =
        toDateLabel(project.createdAt) ||
        toDateLabel(project.created_at) ||
        toDateLabel(projectCatalog.find((item) => isSameProjectId(item?.id, project.id))?.createdAt) ||
        new Date().toISOString().slice(0, 10);

    // 데스크톱 해야 할 일 표 컬럼 비율 (마감일 길이 증가 대응: 각 컬럼 최소폭 보장)
    const actionTableGridStyle = {
        gridTemplateColumns:
            '40px minmax(0,4.6fr) minmax(90px,1.2fr) minmax(96px,1.2fr) minmax(120px,1.7fr) minmax(130px,1.5fr) 32px',
    };

    // 데스크톱 회의기록 표 컬럼 비율 (날짜/제목/상태/태그/더보기)
    const meetingTableGridStyle = {
        gridTemplateColumns: '16% 34% 16% 27% 7%',
    };

    const actionCompactFilterButtonClass = (isOpen) =>
        `w-full px-3 py-2.5 rounded-2xl border transition flex items-start justify-between gap-3 min-h-[48px] ${
            isOpen
                ? 'bg-[#EEF3FF] border-[#0099CC]/45 shadow-[0_0_0_3px_rgba(0,153,204,0.12)] text-[#0D1B2A]'
                : 'bg-white border-[rgba(0,100,180,0.12)] text-[#0D1B2A] hover:border-[rgba(0,153,204,0.4)] hover:bg-[#F8FAFF]'
        }`;

    useEffect(() => {
        if (!isParticipantsModalOpen) return undefined;
        const handleEscClose = (e) => {
            if (e.key === 'Escape') closeParticipantsModal();
        };
        document.addEventListener('keydown', handleEscClose);
        return () => document.removeEventListener('keydown', handleEscClose);
    }, [isParticipantsModalOpen]);

    useEffect(() => {
        if (!isActionDrawerOpen) return undefined;
        const handleEscClose = (e) => {
            if (e.key === 'Escape') closeActionDrawer();
        };
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
            <style>
                {`
					@keyframes spinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
					.spin-slow { animation: spinSlow 0.9s linear infinite; }
					@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
					.panel-enter { animation: slideInRight 0.28s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
					@keyframes slideInUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
					.panel-enter-bottom { animation: slideInUp 0.28s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
					@keyframes slideInFromRight { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
					@keyframes slideInFromLeft { from { transform: translateX(-24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
					.view-enter-right { animation: slideInFromRight 0.22s ease-out forwards; }
					.view-enter-left { animation: slideInFromLeft 0.22s ease-out forwards; }
					@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
					.overlay-enter { animation: fadeIn 0.2s ease-out forwards; }
				`}
            </style>
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
                        {/* 사이드바 */}
                        <aside className="hidden md:block xl:col-span-3">
                            <section className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-4">
                                <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">프로젝트</h3>
                                <div className="relative">
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A9AB0] pointer-events-none"
                                        aria-hidden="true"
                                    >
                                        <circle cx="11" cy="11" r="7" />
                                        <path d="m21 21-4.3-4.3" />
                                    </svg>
                                    <input
                                        value={projectSearch}
                                        onChange={(e) => setProjectSearch(e.target.value)}
                                        placeholder="프로젝트 검색"
                                        className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[rgba(0,100,180,0.12)] bg-[#F8FAFF] focus:outline-none focus:border-[#0099CC]"
                                    />
                                </div>
                                <div
                                    className="mt-3 space-y-2 max-h-[220px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden"
                                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                >
                                    {filteredProjects.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() =>
                                                navigate(`/project/${item.id}/meetings`, { state: { project: item } })
                                            }
                                            className={`w-full text-left px-3 py-2.5 rounded-xl border transition ${item.id === project.id ? 'bg-[#EEF3FF] border-[#0099CC]/35 text-[#0099CC] font-semibold' : 'bg-white border-[rgba(0,100,180,0.12)] text-[#0D1B2A] hover:bg-[#F8FAFF]'}`}
                                        >
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
                                            <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F7FB] px-2 py-0.5 text-[11px] font-semibold text-[#6B7F95]">
                                                <VisibilityIcon type={visibilityMeta.icon} className="text-[#8EA1B6]" />
                                                {visibilityMeta.label}
                                            </span>
                                            <span className="text-xs text-[#8A9AB0]">생성일 {projectCreatedAtText}</span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                            <h1 className="text-2xl font-bold text-[#0D1B2A]">{project.name}</h1>
                                            <span
                                                className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusBadgeClass(computedProjectStatus)}`}
                                            >
                                                {computedProjectStatus}
                                            </span>
                                        </div>
                                        {projectDescriptionText && (
                                            <p className="text-sm text-[#5A6F8A] mt-2 leading-relaxed">
                                                {projectDescriptionText}
                                            </p>
                                        )}
                                        <div className="mt-3 flex items-center gap-2.5">
                                            <div
                                                className="flex -space-x-2 cursor-pointer"
                                                onClick={() =>
                                                    openParticipantsModal(project.participants, '프로젝트 참여자')
                                                }
                                            >
                                                {visibleParticipants.map((name) => (
                                                    <span
                                                        key={name}
                                                        className="w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center border-2 border-white text-white"
                                                        style={{
                                                            backgroundColor: PARTICIPANT_COLOR_MAP[name] || '#0099CC',
                                                        }}
                                                        title={name}
                                                    >
                                                        {name.slice(0, 1)}
                                                    </span>
                                                ))}
                                                {hiddenParticipantsCount > 0 && (
                                                    <span className="w-7 h-7 rounded-full bg-slate-400 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">
                                                        +{hiddenParticipantsCount}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openParticipantsModal(project.participants, '프로젝트 참여자')
                                                }
                                                className="text-xs text-slate-400 hover:text-slate-600"
                                            >
                                                {project.teamLead}님 외 {Math.max(project.participants.length - 1, 0)}명
                                                참여
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
                                    해야 할 일
                                    {allActionItems.length > 0 && (
                                        <span
                                            className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full font-bold ${activePageTab === 'actions' ? 'bg-[#0099CC] text-white' : 'bg-[#F0F2F5] text-[#5A6F8A]'}`}
                                        >
                                            {allActionItems.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* 회의 기록 탭 */}
                            {activePageTab === 'meetings' && (
                                <>
                                    <section className="mt-4 p-0">
                                        <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-full md:flex-wrap md:items-center md:gap-2">
                                            <div className="relative col-span-2 w-full md:col-span-1 md:w-72 lg:w-80">
                                                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#B0BFCC]">
                                                    <svg
                                                        width="14"
                                                        height="14"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        aria-hidden="true"
                                                    >
                                                        <circle cx="11" cy="11" r="6" />
                                                        <path d="m21 21-4.35-4.35" />
                                                    </svg>
                                                </span>
                                                <input
                                                    value={meetingSearch}
                                                    onChange={(e) => setMeetingSearch(e.target.value)}
                                                    placeholder="회의록 검색"
                                                    className="w-full rounded-xl border border-[rgba(0,0,0,0.09)] bg-white py-2 pl-8 pr-3 text-sm text-[#0D1B2A] placeholder-[#B0BFCC] transition focus:border-[#0099CC] focus:outline-none focus:ring-2 focus:ring-[rgba(0,153,204,0.12)]"
                                                />
                                            </div>
                                            <div className="col-span-2 grid w-full grid-cols-2 gap-2 md:ml-auto md:flex md:w-auto md:items-center md:gap-2 md:shrink-0">
                                                <div className="relative min-w-0" ref={sortDropdownRef}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsSortOpen((prev) => !prev);
                                                            setIsTypeOpen(false);
                                                        }}
                                                        className={`w-full min-w-0 md:w-auto px-3.5 py-2.5 text-sm rounded-xl border transition flex items-center justify-between gap-1.5 ${isSortOpen ? 'border-[#0099CC]/40 bg-white shadow-[0_0_0_3px_rgba(0,153,204,0.10)] text-[#0D1B2A]' : 'border-[rgba(0,0,0,0.09)] bg-white text-[#0D1B2A] hover:border-[rgba(0,153,204,0.35)]'}`}
                                                    >
                                                        <span className="truncate whitespace-nowrap font-medium">
                                                            {sortOrder}
                                                        </span>
                                                        <ChevronDownIcon
                                                            className={`text-[#A0AFBF] transition-transform ${isSortOpen ? 'rotate-180' : ''}`}
                                                        />
                                                    </button>
                                                    {isSortOpen && (
                                                        <div className="absolute left-0 z-20 mt-2 w-32 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
                                                            {['최신순', '과거순'].map((option) => (
                                                                <button
                                                                    key={option}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSortOrder(option);
                                                                        setIsSortOpen(false);
                                                                    }}
                                                                    className={`w-full px-3.5 py-2.5 text-sm text-left flex items-center justify-between transition-colors ${sortOrder === option ? 'bg-[#F5F7FB] text-[#0099CC] font-semibold' : 'text-[#0D1B2A] hover:bg-[#F5F7FB]'}`}
                                                                >
                                                                    <span>{option}</span>
                                                                    {sortOrder === option && (
                                                                        <CheckIcon className="text-[#0099CC]" />
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="relative min-w-0" ref={typeDropdownRef}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsTypeOpen((prev) => !prev);
                                                            setIsSortOpen(false);
                                                        }}
                                                        className={`w-full min-w-0 md:w-auto px-3.5 py-2.5 text-sm rounded-xl border transition flex items-center justify-between gap-1.5 ${isTypeOpen ? 'border-[#0099CC]/40 bg-white shadow-[0_0_0_3px_rgba(0,153,204,0.10)] text-[#0D1B2A]' : 'border-[rgba(0,0,0,0.09)] bg-white text-[#0D1B2A] hover:border-[rgba(0,153,204,0.35)]'}`}
                                                    >
                                                        <span className="truncate whitespace-nowrap font-medium">
                                                            {meetingType}
                                                        </span>
                                                        <ChevronDownIcon
                                                            className={`text-[#A0AFBF] transition-transform ${isTypeOpen ? 'rotate-180' : ''}`}
                                                        />
                                                    </button>
                                                    {isTypeOpen && (
                                                        <div className="absolute left-0 z-20 mt-2 w-32 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
                                                            {['전체', '정기', '수시'].map((option) => (
                                                                <button
                                                                    key={option}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setMeetingType(option);
                                                                        setIsTypeOpen(false);
                                                                    }}
                                                                    className={`w-full px-3.5 py-2.5 text-sm text-left flex items-center justify-between transition-colors ${meetingType === option ? 'bg-[#F5F7FB] text-[#0099CC] font-semibold' : 'text-[#0D1B2A] hover:bg-[#F5F7FB]'}`}
                                                                >
                                                                    <span>{option}</span>
                                                                    {meetingType === option && (
                                                                        <CheckIcon className="text-[#0099CC]" />
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div
                                                    className="relative col-span-2 w-full md:col-auto md:w-auto shrink-0"
                                                    ref={createDropdownRef}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsCreateOpen((prev) => !prev)}
                                                        className={`w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl whitespace-nowrap text-white text-sm font-semibold transition ${isCreateOpen ? 'bg-[#007EA7]' : 'bg-[#0099CC] hover:bg-[#007EA7]'}`}
                                                    >
                                                        <span>+ 새 회의록</span>
                                                        <ChevronDownIcon
                                                            className={`text-[#E6F4FF] transition-transform ${isCreateOpen ? 'rotate-180' : ''}`}
                                                        />
                                                    </button>
                                                    {isCreateOpen && (
                                                        <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.16)] bg-white shadow-[0_12px_28px_rgba(0,100,180,0.18)]">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setIsCreateOpen(false);
                                                                    navigate('/meeting-create', {
                                                                        state: {
                                                                            projectId: project.id,
                                                                            projectName: project.name,
                                                                        },
                                                                    });
                                                                }}
                                                                className="w-full px-3.5 py-3 text-left hover:bg-[#EEF3FF]"
                                                            >
                                                                <p className="text-sm font-semibold text-[#0D1B2A]">
                                                                    회의록 직접 작성
                                                                </p>
                                                                <p className="text-xs text-[#5A6F8A] mt-0.5">
                                                                    템플릿에 바로 입력해서 회의록을 생성합니다.
                                                                </p>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setIsCreateOpen(false);
                                                                    navigate('/upload', {
                                                                        state: {
                                                                            from: 'project-meetings',
                                                                            projectId: project.id,
                                                                            projectName: project.name,
                                                                        },
                                                                    });
                                                                }}
                                                                className="w-full px-3.5 py-3 text-left border-t border-[rgba(0,100,180,0.08)] hover:bg-[#EEF3FF]"
                                                            >
                                                                <p className="text-sm font-semibold text-[#0D1B2A]">
                                                                    회의 파일 업로드
                                                                </p>
                                                                <p className="text-xs text-[#5A6F8A] mt-0.5">
                                                                    파일을 올려 AI 회의록을 자동 생성합니다.
                                                                </p>
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
                                                <p className="text-sm font-semibold text-[#0D1B2A]">
                                                    아직 생성된 회의록이 없습니다.
                                                </p>
                                                <p className="text-xs text-[#5A6F8A] mt-1">첫 회의록을 작성해보세요.</p>
                                                <div className="mt-4 inline-flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            navigate('/meeting-create', {
                                                                state: {
                                                                    projectId: project.id,
                                                                    projectName: project.name,
                                                                },
                                                            })
                                                        }
                                                        className="px-4 py-2 rounded-lg bg-[#0099CC] text-white text-sm font-semibold hover:bg-[#007EA7]"
                                                    >
                                                        회의록 직접 작성
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            navigate('/upload', {
                                                                state: {
                                                                    from: 'project-meetings',
                                                                    projectId: project.id,
                                                                    projectName: project.name,
                                                                },
                                                            })
                                                        }
                                                        className="px-4 py-2 rounded-lg border border-[rgba(0,100,180,0.16)] text-[#5A6F8A] text-sm font-semibold hover:bg-[#F8FAFF]"
                                                    >
                                                        회의 파일 업로드
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div
                                                    className="hidden md:grid px-4 py-3 text-xs font-bold text-[#5A6F8A] bg-[#F8FAFF] border-b border-[rgba(0,100,180,0.1)] rounded-t-2xl"
                                                    style={meetingTableGridStyle}
                                                >
                                                    <div className="text-left">회의 날짜</div>
                                                    <div className="text-left">회의 제목</div>
                                                    <div className="text-left">상태</div>
                                                    <div className="text-left">주요 태그</div>
                                                    <div />
                                                </div>
                                                <div className="hidden md:block">
                                                    {visibleMeetings.map((meeting) => {
                                                        const isEditing = pendingEditMeetingId === meeting.id;
                                                        const meetingDisplayStatus = getMeetingDisplayStatus(meeting, allActionItems);
                                                        const onTitleKeyDown = (e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                confirmEditMeeting();
                                                            }
                                                            if (e.key === 'Escape') {
                                                                e.preventDefault();
                                                                cancelEditMeeting();
                                                            }
                                                        };
                                                        const onTagKeyDown = (e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                addTagToDraft();
                                                            }
                                                            if (e.key === 'Escape') {
                                                                e.preventDefault();
                                                                cancelEditMeeting();
                                                            }
                                                        };
                                                        return (
                                                            <div
                                                                key={meeting.id}
                                                                className="grid px-4 py-3 items-center border-b border-[rgba(0,100,180,0.08)] last:border-b-0"
                                                                style={meetingTableGridStyle}
                                                            >
                                                                <div className="text-left text-sm text-[#5A6F8A]">
                                                                    {formatDueDateDisplay(meeting.date)}
                                                                </div>
                                                                {isEditing ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editMeetingTitle}
                                                                        onChange={(e) =>
                                                                            setEditMeetingTitle(e.target.value)
                                                                        }
                                                                        onKeyDown={onTitleKeyDown}
                                                                        className="w-full pr-4 px-2.5 py-1.5 text-sm rounded-lg border border-[rgba(0,100,180,0.16)] bg-white focus:outline-none focus:border-[#0099CC]"
                                                                    />
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            navigate(
                                                                                meeting.detailType === 'manual'
                                                                                    ? '/meeting-manual-detail'
                                                                                    : '/meeting-detail',
                                                                                {
                                                                                    state:
                                                                                        meeting.detailType === 'manual'
                                                                                            ? {
                                                                                                  recordId: meeting.detailRecordId || meeting.id,
                                                                                                  meetingId: meeting.id,
                                                                                                  meeting,
                                                                                                  projectId: project.id,
                                                                                                  projectName: project.name,
                                                                                              }
                                                                                            : {
                                                                                                  meetingId: meeting.id,
                                                                                                  meeting,
                                                                                                  projectId: project.id,
                                                                                                  projectName: project.name,
                                                                                              },
                                                                                }
                                                                            )
                                                                        }
                                                                        title={meeting.title}
                                                                        className="w-full pr-4 text-left text-sm font-semibold text-[#0D1B2A] hover:text-[#0099CC] leading-snug line-clamp-2 break-all"
                                                                    >
                                                                        {meeting.title}
                                                                    </button>
                                                                )}
                                                                <div className="text-left">
                                                                    <span
                                                                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(meetingDisplayStatus)}`}
                                                                    >
                                                                        {meetingDisplayStatus}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-wrap gap-1 text-left">
                                                                    {isEditing ? (
                                                                        <div className="w-full min-h-[36px] px-2 py-1 rounded-lg border border-[rgba(0,100,180,0.16)] bg-white flex flex-wrap items-center gap-1">
                                                                            {editMeetingTagsDraft.map((tag) => (
                                                                                <span
                                                                                    key={tag}
                                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[#EEF3FF] text-[#0099CC]"
                                                                                >
                                                                                    {tag}
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() =>
                                                                                            removeTagFromDraft(tag)
                                                                                        }
                                                                                        className="text-[#5A6F8A] hover:text-[#0D1B2A]"
                                                                                    >
                                                                                        ×
                                                                                    </button>
                                                                                </span>
                                                                            ))}
                                                                            <input
                                                                                type="text"
                                                                                value={editMeetingTagInput}
                                                                                onChange={(e) =>
                                                                                    setEditMeetingTagInput(
                                                                                        e.target.value
                                                                                    )
                                                                                }
                                                                                onKeyDown={onTagKeyDown}
                                                                                onBlur={addTagToDraft}
                                                                                placeholder="#태그"
                                                                                className="flex-1 min-w-[72px] text-xs py-0.5 bg-transparent focus:outline-none"
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        meeting.tags.map((tag) => (
                                                                            <span
                                                                                key={tag}
                                                                                className="px-2 py-0.5 rounded-full text-xs bg-[#EEF3FF] text-[#0099CC]"
                                                                            >
                                                                                {tag}
                                                                            </span>
                                                                        ))
                                                                    )}
                                                                </div>
                                                                <div
                                                                    className="flex justify-end"
                                                                    data-more-menu-root
                                                                >
                                                                    {isEditing ? (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <button
                                                                                type="button"
                                                                                onClick={confirmEditMeeting}
                                                                                className="w-7 h-7 rounded-full bg-[#0099CC] text-white hover:bg-[#007EA7] flex items-center justify-center"
                                                                                aria-label="저장"
                                                                            >
                                                                                <CheckIcon className="text-white" />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={cancelEditMeeting}
                                                                                className="w-7 h-7 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center"
                                                                                aria-label="취소"
                                                                            >
                                                                                <svg
                                                                                    width="12"
                                                                                    height="12"
                                                                                    viewBox="0 0 24 24"
                                                                                    fill="none"
                                                                                    stroke="currentColor"
                                                                                    strokeWidth="2.5"
                                                                                    strokeLinecap="round"
                                                                                    strokeLinejoin="round"
                                                                                >
                                                                                    <path d="M18 6 6 18" />
                                                                                    <path d="m6 6 12 12" />
                                                                                </svg>
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="relative">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    setOpenMoreMenuId((prev) =>
                                                                                        prev === meeting.id
                                                                                            ? null
                                                                                            : meeting.id
                                                                                    )
                                                                                }
                                                                                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#5A6F8A] hover:text-[#0D1B2A] hover:bg-[#F8FAFF] transition"
                                                                                aria-label="더 보기"
                                                                            >
                                                                                <MoreVerticalIcon />
                                                                            </button>
                                                                            {openMoreMenuId === meeting.id && (
                                                                                <div className="absolute right-full mr-1 top-0 z-40 w-28 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_24px_rgba(0,100,180,0.14)]">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setOpenMoreMenuId(null);
                                                                                            handleEditMeeting(
                                                                                                meeting.id
                                                                                            );
                                                                                        }}
                                                                                        className="w-full px-3.5 py-2.5 text-left text-sm text-[#0D1B2A] hover:bg-[#EEF3FF]"
                                                                                    >
                                                                                        수정
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setOpenMoreMenuId(null);
                                                                                            handleDeleteMeeting(
                                                                                                meeting.id
                                                                                            );
                                                                                        }}
                                                                                        className="w-full px-3.5 py-2.5 text-left text-sm text-[#EF4444] hover:bg-[#FCE8E6]"
                                                                                    >
                                                                                        삭제
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* 모바일 카드 */}
                                                <div className="md:hidden divide-y divide-[rgba(0,100,180,0.08)]">
                                                    {visibleMeetings.map((meeting) => {
                                                        const isEditing = pendingEditMeetingId === meeting.id;
                                                        const meetingDisplayStatus = getMeetingDisplayStatus(meeting, allActionItems);
                                                        const onMobileTitleKeyDown = (e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                confirmEditMeeting();
                                                            }
                                                            if (e.key === 'Escape') {
                                                                e.preventDefault();
                                                                cancelEditMeeting();
                                                            }
                                                        };
                                                        const onMobileTagKeyDown = (e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                addTagToDraft();
                                                            }
                                                        };
                                                        return (
                                                            <article key={meeting.id} className="p-4 space-y-2.5">
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <span className="text-xs text-[#5A6F8A]">
                                                                        {formatDueDateDisplay(meeting.date)}
                                                                    </span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span
                                                                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(meetingDisplayStatus)}`}
                                                                        >
                                                                            {meetingDisplayStatus}
                                                                        </span>
                                                                        {!isEditing && (
                                                                            <div
                                                                                className="relative"
                                                                                data-more-menu-root
                                                                            >
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        setOpenMoreMenuId((prev) =>
                                                                                            prev === meeting.id
                                                                                                ? null
                                                                                                : meeting.id
                                                                                        )
                                                                                    }
                                                                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5A6F8A] hover:bg-[#F8FAFF] transition"
                                                                                >
                                                                                    <MoreVerticalIcon />
                                                                                </button>
                                                                                {openMoreMenuId === meeting.id && (
                                                                                    <div className="absolute right-full mr-1 top-0 z-40 w-28 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_24px_rgba(0,100,180,0.14)]">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setOpenMoreMenuId(null);
                                                                                                handleEditMeeting(
                                                                                                    meeting.id
                                                                                                );
                                                                                            }}
                                                                                            className="w-full px-3.5 py-2.5 text-left text-sm text-[#0D1B2A] hover:bg-[#EEF3FF]"
                                                                                        >
                                                                                            수정
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setOpenMoreMenuId(null);
                                                                                                handleDeleteMeeting(
                                                                                                    meeting.id
                                                                                                );
                                                                                            }}
                                                                                            className="w-full px-3.5 py-2.5 text-left text-sm text-[#EF4444] hover:bg-[#FCE8E6]"
                                                                                        >
                                                                                            삭제
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {isEditing ? (
                                                                    <div className="space-y-2">
                                                                        <input
                                                                            type="text"
                                                                            value={editMeetingTitle}
                                                                            onChange={(e) =>
                                                                                setEditMeetingTitle(e.target.value)
                                                                            }
                                                                            onKeyDown={onMobileTitleKeyDown}
                                                                            className="w-full px-2.5 py-2 text-sm rounded-lg border border-[rgba(0,100,180,0.16)] bg-white focus:outline-none focus:border-[#0099CC]"
                                                                        />
                                                                        <div className="w-full min-h-[38px] px-2 py-1 rounded-lg border border-[rgba(0,100,180,0.16)] bg-white flex flex-wrap items-center gap-1">
                                                                            {editMeetingTagsDraft.map((tag) => (
                                                                                <span
                                                                                    key={tag}
                                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[#EEF3FF] text-[#0099CC]"
                                                                                >
                                                                                    {tag}
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() =>
                                                                                            removeTagFromDraft(tag)
                                                                                        }
                                                                                        className="text-[#5A6F8A] hover:text-[#0D1B2A]"
                                                                                    >
                                                                                        ×
                                                                                    </button>
                                                                                </span>
                                                                            ))}
                                                                            <input
                                                                                type="text"
                                                                                value={editMeetingTagInput}
                                                                                onChange={(e) =>
                                                                                    setEditMeetingTagInput(
                                                                                        e.target.value
                                                                                    )
                                                                                }
                                                                                onKeyDown={onMobileTagKeyDown}
                                                                                onBlur={addTagToDraft}
                                                                                placeholder="#태그"
                                                                                className="flex-1 min-w-[72px] text-xs py-0.5 bg-transparent focus:outline-none"
                                                                            />
                                                                        </div>
                                                                        <div className="flex justify-end gap-2 pt-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={cancelEditMeeting}
                                                                                className="w-7 h-7 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center"
                                                                                aria-label="취소"
                                                                            >
                                                                                <svg
                                                                                    width="12"
                                                                                    height="12"
                                                                                    viewBox="0 0 24 24"
                                                                                    fill="none"
                                                                                    stroke="currentColor"
                                                                                    strokeWidth="2.5"
                                                                                    strokeLinecap="round"
                                                                                    strokeLinejoin="round"
                                                                                >
                                                                                    <path d="M18 6 6 18" />
                                                                                    <path d="m6 6 12 12" />
                                                                                </svg>
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={confirmEditMeeting}
                                                                                className="w-7 h-7 rounded-full bg-[#0099CC] text-white hover:bg-[#007EA7] flex items-center justify-center"
                                                                                aria-label="저장"
                                                                            >
                                                                                <CheckIcon className="text-white" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                navigate(
                                                                                    meeting.detailType === 'manual'
                                                                                        ? '/meeting-manual-detail'
                                                                                        : '/meeting-detail',
                                                                                    {
                                                                                        state:
                                                                                            meeting.detailType === 'manual'
                                                                                                ? {
                                                                                                      recordId: meeting.detailRecordId || meeting.id,
                                                                                                      meetingId: meeting.id,
                                                                                                      meeting,
                                                                                                      projectId: project.id,
                                                                                                      projectName: project.name,
                                                                                                  }
                                                                                                : {
                                                                                                      meetingId: meeting.id,
                                                                                                      meeting,
                                                                                                      projectId: project.id,
                                                                                                      projectName: project.name,
                                                                                                  },
                                                                                    }
                                                                                )
                                                                            }
                                                                            title={meeting.title}
                                                                            className="w-full text-left text-sm font-semibold text-[#0D1B2A] leading-snug line-clamp-2 break-all"
                                                                        >
                                                                            {meeting.title}
                                                                        </button>
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {meeting.tags.map((tag) => (
                                                                                <span
                                                                                    key={tag}
                                                                                    className="px-2 py-0.5 rounded-full text-xs bg-[#EEF3FF] text-[#0099CC]"
                                                                                >
                                                                                    {tag}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </article>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}
                                    </section>
                                </>
                            )}

                            {/* 해야 할일 탭 */}
                            {activePageTab === 'actions' && (
                                <section className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white overflow-visible">
                                    {/* 필터 영역 */}
                                    <div className="px-4 py-3.5 border-b border-[rgba(0,100,180,0.08)] bg-[#F8FAFF] rounded-t-2xl">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                            <div className="relative" ref={actionAssigneeFilterRef}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setOpenActionFilter((prev) =>
                                                            prev === 'assignee' ? null : 'assignee'
                                                        )
                                                    }
                                                    className={actionCompactFilterButtonClass(
                                                        openActionFilter === 'assignee'
                                                    )}
                                                >
                                                    <span className="flex min-w-0 flex-col items-start gap-1.5">
                                                        <span className="text-[11px] font-semibold leading-none text-[#5A6F8A]">
                                                            담당자
                                                        </span>
                                                        <span className="truncate text-sm font-semibold leading-tight">
                                                            {actionAssigneeFilter}
                                                        </span>
                                                    </span>
                                                    <ChevronDownIcon
                                                        className={`shrink-0 text-[#5A6F8A] transition-transform ${openActionFilter === 'assignee' ? 'rotate-180' : ''}`}
                                                    />
                                                </button>
                                                {openActionFilter === 'assignee' && (
                                                    <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_12px_30px_rgba(0,100,180,0.16)]">
                                                        <div className="max-h-64 overflow-auto py-1">
                                                            {actionAssigneeOptions.map((option) => (
                                                                <button
                                                                    key={option}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setActionAssigneeFilter(option);
                                                                        setOpenActionFilter(null);
                                                                    }}
                                                                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${actionAssigneeFilter === option ? 'bg-[#EEF3FF] text-[#0099CC] font-semibold' : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'}`}
                                                                >
                                                                    <span>{option}</span>
                                                                    {actionAssigneeFilter === option && (
                                                                        <CheckIcon className="text-[#0099CC]" />
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="relative" ref={actionStatusFilterRef}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setOpenActionFilter((prev) =>
                                                            prev === 'status' ? null : 'status'
                                                        )
                                                    }
                                                    className={actionCompactFilterButtonClass(
                                                        openActionFilter === 'status'
                                                    )}
                                                >
                                                    <span className="flex min-w-0 flex-col items-start gap-1.5">
                                                        <span className="text-[11px] font-semibold leading-none text-[#5A6F8A]">
                                                            상태
                                                        </span>
                                                        <span className="truncate text-sm font-semibold leading-tight">
                                                            {actionStatusFilter}
                                                        </span>
                                                    </span>
                                                    <ChevronDownIcon
                                                        className={`shrink-0 text-[#5A6F8A] transition-transform ${openActionFilter === 'status' ? 'rotate-180' : ''}`}
                                                    />
                                                </button>
                                                {openActionFilter === 'status' && (
                                                    <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_12px_30px_rgba(0,100,180,0.16)]">
                                                        <div className="max-h-64 overflow-auto py-1">
                                                            {actionStatusOptions.map((option) => (
                                                                <button
                                                                    key={option}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setActionStatusFilter(option);
                                                                        setOpenActionFilter(null);
                                                                    }}
                                                                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${actionStatusFilter === option ? 'bg-[#EEF3FF] text-[#0099CC] font-semibold' : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'}`}
                                                                >
                                                                    <span>
                                                                        {option === '전체'
                                                                            ? option
                                                                            : getActionStatusLabel(option)}
                                                                    </span>
                                                                    {actionStatusFilter === option && (
                                                                        <CheckIcon className="text-[#0099CC]" />
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="relative" ref={actionSourceFilterRef}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setOpenActionFilter((prev) =>
                                                            prev === 'source' ? null : 'source'
                                                        )
                                                    }
                                                    className={actionCompactFilterButtonClass(
                                                        openActionFilter === 'source'
                                                    )}
                                                >
                                                    <span className="flex min-w-0 flex-col items-start gap-1.5">
                                                        <span className="text-[11px] font-semibold leading-none text-[#5A6F8A]">
                                                            회의록 출처
                                                        </span>
                                                        <span className="truncate text-sm font-semibold leading-tight">
                                                            {actionSourceFilter}
                                                        </span>
                                                    </span>
                                                    <ChevronDownIcon
                                                        className={`shrink-0 text-[#5A6F8A] transition-transform ${openActionFilter === 'source' ? 'rotate-180' : ''}`}
                                                    />
                                                </button>
                                                {openActionFilter === 'source' && (
                                                    <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_12px_30px_rgba(0,100,180,0.16)]">
                                                        <div className="max-h-64 overflow-auto py-1">
                                                            {actionSourceOptions.map((option) => (
                                                                <button
                                                                    key={option}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setActionSourceFilter(option);
                                                                        setOpenActionFilter(null);
                                                                    }}
                                                                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${actionSourceFilter === option ? 'bg-[#EEF3FF] text-[#0099CC] font-semibold' : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'}`}
                                                                >
                                                                    <span>{option}</span>
                                                                    {actionSourceFilter === option && (
                                                                        <CheckIcon className="text-[#0099CC]" />
                                                                    )}
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
                                                <p className="text-lg font-bold text-[#F59E0B]">
                                                    {actionDashboardStats.reviewPending}
                                                </p>
                                            </div>
                                            <div className="rounded-xl border border-[rgba(0,100,180,0.1)] bg-[#F8FAFF] p-3">
                                                <p className="text-[11px] text-[#5A6F8A]">검토완료</p>
                                                <p className="text-lg font-bold text-[#0D1B2A]">
                                                    {actionDashboardStats.reviewDone}
                                                </p>
                                            </div>
                                            <div className="rounded-xl border border-[rgba(0,100,180,0.1)] bg-[#F8FAFF] p-3">
                                                <p className="text-[11px] text-[#5A6F8A]">연동완료</p>
                                                <p className="text-lg font-bold text-[#0099CC]">
                                                    {actionDashboardStats.linked}
                                                </p>
                                            </div>
                                            <div className="rounded-xl border border-[rgba(0,100,180,0.1)] bg-[#F8FAFF] p-3">
                                                <p className="text-[11px] text-[#5A6F8A]">수행완료</p>
                                                <p className="text-lg font-bold text-[#10B981]">
                                                    {actionDashboardStats.performed}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {filteredActionItems.length === 0 ? (
                                        <div className="px-4 py-12 text-center">
                                            <p className="text-sm font-semibold text-[#0D1B2A]">
                                                조건에 맞는 해야 할 일이 없습니다.
                                            </p>
                                            <p className="text-xs text-[#5A6F8A] mt-1">
                                                필터를 초기화하거나 다른 조건을 선택해 보세요.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* ✅ PC 테이블 헤더 — gridTemplateColumns 수정 */}
                                            <div
                                                className="hidden md:grid items-center px-4 py-3 bg-[#F8FAFF] border-b border-[rgba(0,100,180,0.1)] text-[12px] font-semibold text-[#5A6F8A] text-left"
                                                style={actionTableGridStyle}
                                            >
                                                <div />
                                                <div className="text-left">해야 할 일</div>
                                                <div className="text-left">담당자</div>
                                                <div className="text-left">상태</div>
                                                <div className="text-left">회의록 출처</div>
                                                <div className="text-left">마감일</div>
                                                <div />
                                            </div>

                                            {/* ✅ PC 테이블 행 */}
                                            <div className="hidden md:block divide-y divide-[rgba(0,100,180,0.08)]">
                                                {filteredActionItems.map((item) => {
                                                    const statusStyle = actionStatusStyle(item.status);
                                                    const isFinalDone =
                                                        normalizeActionStatus(item.status) === '수행완료';
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className="grid items-center px-4 py-3 cursor-pointer hover:bg-[#F8FAFF] transition-colors"
                                                            style={actionTableGridStyle}
                                                            onClick={() => openActionDrawer(item)}
                                                        >
                                                            {/* 체크박스 */}
                                                            <div className="flex items-center justify-start">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isFinalDone}
                                                                    readOnly
                                                                    disabled={isFinalDone}
                                                                    className={`w-4 h-4 ${isFinalDone ? 'accent-[#94A3B8] cursor-not-allowed opacity-70' : 'accent-[#0099CC]'}`}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>

                                                            {/* 해야 할일 텍스트 */}
                                                            <div className="flex items-center justify-start min-h-[44px] pr-10 text-left">
                                                                <span className="text-sm font-medium text-[#0D1B2A] leading-snug line-clamp-2">
                                                                    {item.text}
                                                                </span>
                                                            </div>

                                                            {/* 담당자 */}
                                                            <div className="flex items-center justify-start min-h-[44px] text-left">
                                                                <span className="text-sm text-[#0D1B2A]">
                                                                    {item.assignee}
                                                                </span>
                                                            </div>

                                                            {/* 상태 배지 (수동 변경 금지) */}
                                                            <div className="flex items-center justify-start text-left">
                                                                <span
                                                                    className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold border"
                                                                    style={{
                                                                        backgroundColor: statusStyle.bg,
                                                                        color: statusStyle.color,
                                                                        borderColor: `${statusStyle.border}40`,
                                                                    }}
                                                                >
                                                                    {getActionStatusBadgeLabel(item.status)}
                                                                </span>
                                                            </div>

                                                            {/* ✅ 회의록 출처 */}
                                                            <div className="flex items-center justify-start min-h-[44px] pr-4 text-left">
                                                                <span
                                                                    className="text-sm text-[#5A6F8A] truncate"
                                                                    title={item.source}
                                                                >
                                                                    {item.source}
                                                                </span>
                                                            </div>

                                                            {/* 마감일 */}
                                                            <div className="flex items-center justify-start min-h-[44px] text-left">
                                                                <span className="text-sm text-[#0D1B2A] whitespace-nowrap">
                                                                    {formatDueDateDisplay(item.due)}
                                                                </span>
                                                            </div>

                                                            {/* 관리 메뉴 */}
                                                            <div
                                                                className="flex items-center justify-end"
                                                                data-action-more-menu-root
                                                            >
                                                                <div className="relative">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setOpenActionMoreMenuId((prev) =>
                                                                                prev === item.id ? null : item.id
                                                                            );
                                                                        }}
                                                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#5A6F8A] hover:text-[#0D1B2A] hover:bg-[#F8FAFF] transition"
                                                                        aria-label="해야 할일 더 보기"
                                                                    >
                                                                        <MoreVerticalIcon />
                                                                    </button>
                                                                    {openActionMoreMenuId === item.id && (
                                                                        <div className="absolute right-full mr-1 top-0 z-40 w-28 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_24px_rgba(0,100,180,0.14)]">
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    requestDeleteActionItem(item.id);
                                                                                }}
                                                                                className="w-full px-3.5 py-2.5 text-left text-sm text-[#EF4444] hover:bg-[#FCE8E6]"
                                                                            >
                                                                                삭제
                                                                            </button>
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
                                                    const isFinalDone =
                                                        normalizeActionStatus(item.status) === '수행완료';
                                                    return (
                                                        <article
                                                            key={item.id}
                                                            className="px-4 py-4 space-y-2.5 cursor-pointer hover:bg-[#F8FAFF] transition-colors"
                                                            onClick={() => openActionDrawer(item)}
                                                        >
                                                            {/* 상단: 체크박스 + 텍스트 + 수정/삭제 */}
                                                            <div className="flex items-start gap-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isFinalDone}
                                                                    readOnly
                                                                    disabled={isFinalDone}
                                                                    className={`w-4 h-4 mt-0.5 shrink-0 ${isFinalDone ? 'accent-[#94A3B8] cursor-not-allowed opacity-70' : 'accent-[#0099CC]'}`}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-semibold text-[#0D1B2A] leading-snug">
                                                                        {item.text}
                                                                    </p>
                                                                </div>
                                                                {/* 모바일 관리 메뉴 */}
                                                                <div
                                                                    className="relative shrink-0"
                                                                    data-action-more-menu-root
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setOpenActionMoreMenuId((prev) =>
                                                                                prev === item.id ? null : item.id
                                                                            );
                                                                        }}
                                                                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5A6F8A] hover:bg-[#F8FAFF] transition"
                                                                        aria-label="해야 할일 더 보기"
                                                                    >
                                                                        <MoreVerticalIcon />
                                                                    </button>
                                                                    {openActionMoreMenuId === item.id && (
                                                                        <div className="absolute right-full mr-1 top-0 z-40 w-28 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_24px_rgba(0,100,180,0.14)]">
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    requestDeleteActionItem(item.id);
                                                                                }}
                                                                                className="w-full px-3.5 py-2.5 text-left text-sm text-[#EF4444] hover:bg-[#FCE8E6]"
                                                                            >
                                                                                삭제
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* 하단: 담당자 · 마감일 + 상태 */}
                                                            <div className="flex items-center justify-between pl-7 gap-2">
                                                                <div className="flex items-center gap-2 min-w-0 flex-1 text-xs text-[#5A6F8A]">
                                                                    <span className="font-medium text-[#0D1B2A] truncate max-w-[110px]">
                                                                        {item.assignee}
                                                                    </span>
                                                                    <span className="text-[#CBD5E1]">·</span>
                                                                    <span className="shrink-0">
                                                                        {formatDueDateDisplay(item.due)}
                                                                    </span>
                                                                </div>
                                                                {/* 상태 배지 (수동 변경 금지) */}
                                                                <div className="shrink-0">
                                                                    <span
                                                                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold border"
                                                                        style={{
                                                                            backgroundColor: statusStyle.bg,
                                                                            color: statusStyle.color,
                                                                            borderColor: `${statusStyle.border}40`,
                                                                        }}
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
                <div
                    className={`overlay-enter fixed inset-0 z-[130] flex ${isMobile ? 'items-end justify-center' : 'justify-end'}`}
                    style={{ backgroundColor: 'rgba(13,27,42,0.35)', backdropFilter: 'blur(2px)' }}
                    onClick={closeActionDrawer}
                    aria-modal="true"
                    role="dialog"
                >
                    <aside
                        className={`${isMobile ? 'panel-enter-bottom rounded-t-3xl border-t border-x border-[rgba(0,100,180,0.14)] h-auto max-h-[88vh] w-full max-w-none' : 'panel-enter h-full w-full max-w-[520px] border-l border-[rgba(0,100,180,0.14)]'} relative flex flex-col bg-white shadow-2xl overflow-hidden`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isMobile && (
                            <div className="shrink-0 pt-2 pb-1 flex justify-center" aria-hidden="true">
                                <span className="block w-10 h-1 rounded-full bg-[#C9D6E3]" />
                            </div>
                        )}
                        <div className="px-4 sm:px-5 py-4 border-b border-[rgba(0,100,180,0.1)] flex items-center justify-between gap-3">
                            {actionDrawerView === 'integrate' ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActionDrawerView('detail');
                                        setPendingIntegrationTarget('');
                                    }}
                                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#5A6F8A] hover:text-[#0D1B2A] transition-colors -ml-1 px-1"
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <polyline points="15 18 9 12 15 6" />
                                    </svg>
                                    뒤로
                                </button>
                            ) : (
                                (() => {
                                    const statusStyle = actionStatusStyle(actionDraft.status);
                                    return (
                                        <span
                                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border"
                                            style={{
                                                backgroundColor: statusStyle.bg,
                                                color: statusStyle.color,
                                                borderColor: `${statusStyle.border}40`,
                                            }}
                                        >
                                            {getActionStatusBadgeLabel(actionDraft.status)}
                                        </span>
                                    );
                                })()
                            )}
                            <div className="flex items-center gap-1.5">
                                {actionDrawerView === 'detail' && (
                                    <button
                                        type="button"
                                        onClick={() => setIsActionEditMode((prev) => !prev)}
                                        className={`w-8 h-8 rounded-lg border transition ${isActionEditMode ? 'bg-[#EEF3FF] text-[#0099CC] border-[rgba(0,153,204,0.35)]' : 'border-[rgba(0,100,180,0.14)] text-[#5A6F8A] hover:bg-[#F8FAFF] hover:text-[#0D1B2A]'}`}
                                        aria-label="수정 모드"
                                        title="수정 모드"
                                    >
                                        <span className="flex items-center justify-center">
                                            <PencilIcon />
                                        </span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={closeActionDrawer}
                                    className="w-8 h-8 rounded-lg text-[#5A6F8A] hover:bg-[#F8FAFF] hover:text-[#0D1B2A]"
                                    aria-label="드로어 닫기"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {actionDrawerView === 'detail' ? (
                                <div className="view-enter-left p-5 space-y-5">
                                    <div className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-[#F8FAFF] p-3.5">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="px-2 py-0.5 rounded-full bg-[#EEF3FF] text-[#0099CC] text-xs font-semibold">
                                                #{project.name}
                                            </span>
                                            <span className="max-w-full sm:max-w-[280px] truncate px-2 py-0.5 rounded-full bg-white border border-[rgba(0,100,180,0.12)] text-[#5A6F8A] text-xs font-semibold">
                                                출처: {actionDraft.source || '-'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-[#5A6F8A]">
                                            타임스탬프: {actionDraft.updatedAt || getKSTTimestampLabel()}
                                        </p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-[#0D1B2A]">제목</label>
                                        <input
                                            type="text"
                                            value={actionDraft.text}
                                            onChange={(e) => {
                                                if (!isActionEditMode) return;
                                                setActionDraft((prev) => ({ ...prev, text: e.target.value }));
                                            }}
                                            readOnly={!isActionEditMode}
                                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[rgba(0,100,180,0.14)] bg-white focus:outline-none focus:border-[#0099CC]"
                                            placeholder="해야 할 일 제목"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-[#0D1B2A]">설명</label>
                                        <textarea
                                            ref={actionDescriptionRef}
                                            value={actionDraft.description || ''}
                                            onChange={(e) => {
                                                if (!isActionEditMode) return;
                                                setActionDraft((prev) => ({ ...prev, description: e.target.value }));
                                            }}
                                            readOnly={!isActionEditMode}
                                            rows={5}
                                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[rgba(0,100,180,0.14)] bg-white resize-none focus:outline-none focus:border-[#0099CC]"
                                            placeholder="세부 설명을 입력하세요"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1.5 relative" ref={dueDateDropdownRef}>
                                            <label className="text-xs font-bold text-[#0D1B2A]">마감 기한</label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!isActionEditMode) return;
                                                    setIsDrawerAssigneeOpen(false);
                                                    setIsDueDateOpen((prev) => !prev);
                                                }}
                                                disabled={!isActionEditMode}
                                                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition flex items-center justify-between ${isDueDateOpen ? 'bg-[#EEF3FF] border-[#0099CC]/40 shadow-[0_0_0_3px_rgba(0,153,204,0.12)]' : 'bg-white border-[rgba(0,100,180,0.12)] hover:border-[rgba(0,153,204,0.4)]'}`}
                                            >
                                                <span
                                                    className={`${actionDraft.due && actionDraft.due !== '-' ? 'text-[#0D1B2A]' : 'text-[#9AA7B8]'}`}
                                                >
                                                    {actionDraft.due && actionDraft.due !== '-'
                                                        ? formatDueDateDisplay(actionDraft.due)
                                                        : '날짜 선택'}
                                                </span>
                                                <CalendarIcon className="text-[#5A6F8A]" />
                                            </button>
                                            {isDueDateOpen && (
                                                <CustomDatePicker
                                                    value={toDateInputValue(actionDraft.due)}
                                                    onSelect={(dateStr) =>
                                                        setActionDraft((prev) => ({
                                                            ...prev,
                                                            due: fromDateInputValue(dateStr),
                                                        }))
                                                    }
                                                    onClose={() => setIsDueDateOpen(false)}
                                                    anchorRef={dueDateDropdownRef}
                                                />
                                            )}
                                        </div>
                                        <div
                                            className="space-y-1.5 relative"
                                            ref={drawerAssigneeRef}
                                            data-drawer-assignee-root
                                        >
                                            <label className="text-xs font-bold text-[#0D1B2A]">담당자</label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!isActionEditMode) return;
                                                    setIsDueDateOpen(false);
                                                    setIsDrawerAssigneeOpen((prev) => !prev);
                                                }}
                                                disabled={!isActionEditMode}
                                                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition flex items-center justify-between gap-2 ${isDrawerAssigneeOpen ? 'bg-[#EEF3FF] border-[#0099CC]/40 shadow-[0_0_0_3px_rgba(0,153,204,0.12)] text-[#0D1B2A]' : 'bg-white border-[rgba(0,100,180,0.14)] text-[#0D1B2A] hover:border-[rgba(0,153,204,0.4)]'}`}
                                            >
                                                <span className="truncate text-left">
                                                    {actionDraft.assignee || '담당자 선택'}
                                                </span>
                                                <ChevronDownIcon
                                                    className={`shrink-0 text-[#5A6F8A] transition-transform ${isDrawerAssigneeOpen ? 'rotate-180' : ''}`}
                                                />
                                            </button>
                                            {isDrawerAssigneeOpen && (
                                                <div className="absolute left-0 right-0 z-30 bottom-full mb-2 overflow-hidden rounded-2xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_12px_30px_rgba(0,100,180,0.16)]">
                                                    <div className="max-h-64 overflow-auto py-1">
                                                        {drawerAssigneeOptions.map((member) => (
                                                            <button
                                                                key={member}
                                                                type="button"
                                                                onClick={() => {
                                                                    setActionDraft((prev) => ({
                                                                        ...prev,
                                                                        assignee: member,
                                                                    }));
                                                                    setIsDrawerAssigneeOpen(false);
                                                                }}
                                                                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${actionDraft.assignee === member ? 'bg-[#EEF3FF] text-[#0099CC] font-semibold' : 'text-[#0D1B2A] hover:bg-[#F8FAFF]'}`}
                                                            >
                                                                <span>{member}</span>
                                                                {actionDraft.assignee === member && (
                                                                    <CheckIcon className="text-[#0099CC]" />
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {hasActionIntegration(actionDraft) && (
                                        <div className="space-y-2">
                                            {getActionIntegrationEntries(actionDraft).map((entry) => (
                                                <div key={entry.id} className="rounded-xl border border-[#10B981]/30 bg-[#E6F4EA] p-4 flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="shrink-0 w-7 h-7 rounded-lg bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
                                                            <CheckCircleIcon className="text-[#10B981]" />
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="text-[12px] font-bold text-[#0E8F69]">
                                                                {entry.label} 연동 완료
                                                            </p>
                                                            <p className="text-[11px] text-[#5A6F8A] truncate">
                                                                {entry.link}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <a
                                                        href={entry.link}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-[#0099CC] hover:underline"
                                                    >
                                                        {entry.label} 확인
                                                        <ArrowUpRightIcon />
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="view-enter-right p-5 space-y-4">
                                    <div>
                                        <h3 className="text-base font-bold text-[#0D1B2A]">연동 도구 선택</h3>
                                        <p className="text-sm text-[#5A6F8A] mt-1">
                                            이 해야 할 일을 어떤 툴로 내보낼까요?
                                        </p>
                                    </div>

                                    {pendingIntegrationTarget ? (
                                        <div className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-[#F8FAFF] p-8 flex flex-col items-center justify-center gap-3">
                                            <svg
                                                width="28"
                                                height="28"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="spin-slow text-[#0099CC]"
                                            >
                                                <line x1="12" y1="2" x2="12" y2="6" />
                                                <line x1="12" y1="18" x2="12" y2="22" />
                                                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                                                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                                                <line x1="2" y1="12" x2="6" y2="12" />
                                                <line x1="18" y1="12" x2="22" y2="12" />
                                                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                                                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                                            </svg>
                                            <p className="text-sm font-semibold text-[#5A6F8A]">연동 중입니다…</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            <button
                                                type="button"
                                                onClick={() => toggleIntegrationTool('jira')}
                                                disabled={hasActionIntegrationTool(actionDraft, 'jira')}
                                                className={`group w-full flex items-center gap-4 p-4 rounded-2xl border-2 bg-white transition-all text-left ${hasActionIntegrationTool(actionDraft, 'jira') ? 'border-[#10B981]/30 bg-[#F8FFFB] opacity-70 cursor-default' : selectedIntegrationTools.includes('jira') ? 'border-[#0099CC] bg-[#EEF3FF] shadow-md' : 'border-[#0099CC]/30 hover:border-[#0099CC] hover:bg-[#EEF3FF] hover:shadow-md'}`}
                                            >
                                                <span className="shrink-0 w-12 h-12 rounded-xl bg-[#EEF3FF] group-hover:bg-[#0099CC]/15 text-[#0099CC] flex items-center justify-center transition-colors">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                                        <path
                                                            d="M11.53 2 4 9.53a1.5 1.5 0 0 0 0 2.12l3.18 3.18 4.35-4.35 4.35 4.35 3.18-3.18a1.5 1.5 0 0 0 0-2.12L11.53 2Z"
                                                            fill="currentColor"
                                                            opacity="0.55"
                                                        />
                                                        <path
                                                            d="M11.53 9.18 4 16.71a1.5 1.5 0 0 0 0 2.12L7.18 22l4.35-4.35-4.35-4.35Z"
                                                            fill="currentColor"
                                                        />
                                                        <path
                                                            d="M15.88 9.18 11.53 13.53l4.35 4.35L19.06 14.7a1.5 1.5 0 0 0 0-2.12l-3.18-3.4Z"
                                                            fill="currentColor"
                                                            opacity="0.85"
                                                        />
                                                    </svg>
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-[#0D1B2A]">{hasActionIntegrationTool(actionDraft, 'jira') ? 'Jira 연동완료' : 'Jira로 연동'}</p>
                                                    <p className="text-[12px] text-[#5A6F8A] mt-0.5">
                                                        Jira API를 통해 해야 할 일을 자동 생성합니다.
                                                    </p>
                                                </div>
                                                <svg
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="shrink-0 text-[#C0CFDC] group-hover:text-[#0099CC] ml-auto transition-colors"
                                                >
                                                    <polyline points="9 18 15 12 9 6" />
                                                </svg>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => toggleIntegrationTool('notion')}
                                                disabled={hasActionIntegrationTool(actionDraft, 'notion')}
                                                className={`group w-full flex items-center gap-4 p-4 rounded-2xl border-2 bg-white transition-all text-left ${hasActionIntegrationTool(actionDraft, 'notion') ? 'border-[#10B981]/30 bg-[#F8FFFB] opacity-70 cursor-default' : selectedIntegrationTools.includes('notion') ? 'border-[#7C3AED] bg-[#F6F0FF] shadow-md' : 'border-[#7C3AED]/20 hover:border-[#7C3AED] hover:bg-[#F6F0FF] hover:shadow-md'}`}
                                            >
                                                <span className="shrink-0 w-12 h-12 rounded-xl bg-[#7C3AED]/10 group-hover:bg-[#7C3AED]/20 text-[#7C3AED] flex items-center justify-center transition-colors">
                                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
                                                    </svg>
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-[#0D1B2A]">{hasActionIntegrationTool(actionDraft, 'notion') ? 'Notion 연동완료' : 'Notion으로 연동'}</p>
                                                    <p className="text-[12px] text-[#5A6F8A] mt-0.5">
                                                        Notion 페이지에 태스크로 자동 추가합니다.
                                                    </p>
                                                </div>
                                                <svg
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="shrink-0 text-[#C0CFDC] group-hover:text-[#7C3AED] ml-auto transition-colors"
                                                >
                                                    <polyline points="9 18 15 12 9 6" />
                                                </svg>
                                            </button>

                                            <button
                                                type="button"
                                                disabled={selectedIntegrationTools.length === 0}
                                                onClick={() => startActionIntegration(selectedIntegrationTools)}
                                                className={`mt-1 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white transition ${selectedIntegrationTools.length === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-[linear-gradient(135deg,#0099CC,#7C3AED)] hover:-translate-y-0.5 shadow-[0_8px_20px_rgba(0,100,180,0.18)]'}`}
                                            >
                                                선택한 도구로 연동
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {actionDrawerView === 'detail' && (
                            <div className="shrink-0 px-5 pb-5 pt-3 border-t border-slate-100 bg-white overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                <div className="flex items-center justify-between gap-2 min-w-max">
                                    <button
                                        type="button"
                                        onClick={() => requestDeleteActionItem(actionDraft.id)}
                                        className="px-3.5 py-2 text-xs font-semibold text-[#EF4444] hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5"
                                        aria-label="삭제"
                                    >
                                        <TrashIcon />
                                        삭제
                                    </button>

                                    <div className="flex items-center justify-end gap-2">
                                        {normalizeActionStatus(actionDraft.status) === '검토대기' && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const ok = saveActionDraft({ closeAfterSave: true });
                                                        if (ok) showToast('변경 사항이 저장되었습니다.', 'success');
                                                    }}
                                                    className="text-sm font-semibold px-4 py-2 rounded-xl text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                                                >
                                                    수정 저장
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const ok = saveActionDraft({
                                                            nextStatus: '검토완료',
                                                            closeAfterSave: true,
                                                        });
                                                        if (ok)
                                                            showToast(
                                                                '확인 완료 처리되어 검토 완료로 전환되었습니다.',
                                                                'success'
                                                            );
                                                    }}
                                                    className="flex items-center gap-1.5 text-sm font-bold px-5 py-2 rounded-xl text-white transition-all hover:-translate-y-0.5"
                                                    style={{
                                                        background:
                                                            'linear-gradient(135deg,#0099CC,#7C3AED)',
                                                        boxShadow: '0 4px 12px rgba(0,100,180,0.18)',
                                                    }}
                                                >
                                                    <CheckCircleIcon />
                                                    검토완료
                                                </button>
                                            </>
                                        )}

                                        {normalizeActionStatus(actionDraft.status) === '검토완료' && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const ok = saveActionDraft({
                                                            nextStatus: '수행완료',
                                                            closeAfterSave: true,
                                                        });
                                                        if (ok) showToast('수행 완료 처리되었습니다.', 'success');
                                                    }}
                                                    className="text-sm font-semibold px-4 py-2 rounded-xl text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                                                >
                                                    수행완료
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActionDrawerView('integrate')}
                                                    className="flex items-center gap-1.5 text-sm font-bold px-5 py-2 rounded-xl text-white transition-all hover:-translate-y-0.5"
                                                    style={{
                                                        background:
                                                            'linear-gradient(135deg,#0099CC,#7C3AED)',
                                                        boxShadow: '0 4px 12px rgba(0,100,180,0.18)',
                                                    }}
                                                >
                                                    <ZapIcon className="text-white" />
                                                    연동하기
                                                </button>
                                            </>
                                        )}

                                        {normalizeActionStatus(actionDraft.status) === '수행완료' && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const ok = saveActionDraft({ closeAfterSave: true });
                                                        if (ok) showToast('변경 사항이 저장되었습니다.', 'success');
                                                    }}
                                                    className="text-sm font-semibold px-4 py-2 rounded-xl text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                                                >
                                                    수정 저장
                                                </button>
                                                {getActionIntegrationEntries(actionDraft).length < 2 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setActionDrawerView('integrate')}
                                                        className="flex items-center gap-1.5 text-sm font-bold px-5 py-2 rounded-xl text-white transition-all hover:-translate-y-0.5"
                                                        style={{
                                                            background:
                                                                'linear-gradient(135deg,#0099CC,#7C3AED)',
                                                            boxShadow: '0 4px 12px rgba(0,100,180,0.18)',
                                                        }}
                                                    >
                                                        <ZapIcon className="text-white" />
                                                        연동하기
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        {normalizeActionStatus(actionDraft.status) === '연동완료' && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const ok = saveActionDraft({ closeAfterSave: true });
                                                        if (ok) showToast('변경 사항이 저장되었습니다.', 'success');
                                                    }}
                                                    className="text-sm font-semibold px-4 py-2 rounded-xl text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                                                >
                                                    수정 저장
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const ok = saveActionDraft({
                                                            nextStatus: '수행완료',
                                                            closeAfterSave: true,
                                                        });
                                                        if (ok) showToast('수행 완료 처리되었습니다.', 'success');
                                                    }}
                                                    className="flex items-center gap-1.5 text-sm font-bold px-5 py-2 rounded-xl text-white transition-all hover:-translate-y-0.5"
                                                    style={{
                                                        background:
                                                            'linear-gradient(135deg,#0099CC,#7C3AED)',
                                                        boxShadow: '0 4px 12px rgba(0,100,180,0.18)',
                                                    }}
                                                >
                                                    수행완료
                                                </button>
                                                {getActionIntegrationEntries(actionDraft).length < 2 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setActionDrawerView('integrate')}
                                                        className="flex items-center gap-1.5 text-sm font-bold px-5 py-2 rounded-xl text-white transition-all hover:-translate-y-0.5"
                                                        style={{
                                                            background:
                                                                'linear-gradient(135deg,#0099CC,#7C3AED)',
                                                            boxShadow: '0 4px 12px rgba(0,100,180,0.18)',
                                                        }}
                                                    >
                                                        <ZapIcon className="text-white" />
                                                        추가 연동
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            )}

            {/* 참여자 모달 */}
            {isParticipantsModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    aria-modal="true"
                    role="dialog"
                >
                    <div
                        className="absolute inset-0 bg-[#0D1B2A]/40 backdrop-blur-[2px]"
                        onClick={closeParticipantsModal}
                    />
                    <div
                        className="relative w-full max-w-md rounded-3xl border border-[rgba(0,100,180,0.12)] bg-white shadow-2xl overflow-hidden"
                        style={{ maxHeight: isMobile ? '72vh' : '80vh' }}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <p className="text-sm font-bold text-slate-900">{participantsModalTitle}</p>
                            <button
                                type="button"
                                onClick={closeParticipantsModal}
                                className="text-slate-400 hover:text-slate-700"
                                aria-label="참여자 팝업 닫기"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="px-5 py-4 overflow-y-auto">
                            <p className="text-xs text-slate-400 mb-2">총 {participantsModalMembers.length}명 참여</p>
                            <div className="space-y-2 pr-1">
                                {participantsModalMembers.map((member) => (
                                    <div
                                        key={member}
                                        className="flex items-center gap-3 p-3 rounded-xl border border-slate-200"
                                    >
                                        <div
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                            style={{ backgroundColor: PARTICIPANT_COLOR_MAP[member] || '#0099CC' }}
                                        >
                                            {member.slice(0, 1)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <p className="text-sm font-semibold text-slate-900 truncate">
                                                    {member}
                                                </p>
                                                {adminNames.includes(member) && (
                                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 bg-sky-50 text-sky-600 text-[10px] font-bold">
                                                        <svg
                                                            width="10"
                                                            height="10"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            aria-hidden="true"
                                                        >
                                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                                        </svg>
                                                        관리자
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400">
                                                {ROLE_MAP[member] || 'Team Member'}
                                            </p>
                                        </div>
                                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-600">
                                            참여 중
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 삭제 확인 모달 */}
            {pendingDeleteMeeting && (
                <div
                    className="fixed inset-0 z-[65] flex items-center justify-center p-4"
                    aria-modal="true"
                    role="dialog"
                >
                    <div className="absolute inset-0 bg-[#0D1B2A]/45" onClick={() => setPendingDeleteMeeting(null)} />
                    <div className="relative w-full max-w-sm rounded-3xl border border-[rgba(0,100,180,0.12)] bg-white p-6 shadow-2xl">
                        <p className="text-base font-bold text-slate-900">회의를 삭제할까요?</p>
                        <p className="mt-2 text-sm text-slate-500">
                            삭제하면 목록에서 사라집니다. 이 작업을 진행하시겠습니까?
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setPendingDeleteMeeting(null)}
                                className="px-3.5 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteMeeting}
                                className="px-3.5 py-2 rounded-lg bg-[#EF4444] text-white text-sm font-semibold hover:bg-[#DC2626]"
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 해야 할일 삭제 확인 모달 */}
            {pendingDeleteActionItemId && (
                <div
                    className="fixed inset-0 z-[74] flex items-center justify-center p-4"
                    aria-modal="true"
                    role="dialog"
                >
                    <div
                        className="absolute inset-0 bg-[#0D1B2A]/45"
                        onClick={() => setPendingDeleteActionItemId(null)}
                    />
                    <div className="relative w-full max-w-sm rounded-3xl border border-[rgba(0,100,180,0.12)] bg-white p-6 shadow-2xl">
                        <p className="text-base font-bold text-slate-900">해야 할 일을 삭제할까요?</p>
                        <p className="mt-2 text-sm text-slate-500">
                            정말 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setPendingDeleteActionItemId(null)}
                                className="px-3.5 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteActionItem}
                                className="px-3.5 py-2 rounded-lg bg-[#EF4444] text-white text-sm font-semibold hover:bg-[#DC2626]"
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 토스트 */}
            {toast.message && (
                <div
                    className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-[70] px-4 w-full sm:w-auto"
                    style={{ bottom: isMobile ? 'calc(env(safe-area-inset-bottom) + 5.75rem)' : '1.5rem' }}
                >
                    <div
                        className="relative text-xs sm:text-sm font-semibold py-3.5 px-5 rounded-2xl shadow-xl border flex items-center gap-2 w-full sm:w-auto sm:min-w-[260px]"
                        style={{
                            backgroundColor: currentToastVariant.background,
                            color: currentToastVariant.text,
                            borderColor: currentToastVariant.border,
                        }}
                    >
                        <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={currentToastVariant.icon}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            {toast.type === 'error' && (
                                <>
                                    <path d="M18 6 6 18" />
                                    <path d="m6 6 12 12" />
                                </>
                            )}
                            {toast.type === 'warning' && (
                                <>
                                    <path d="M10.29 3.86 1.82 18A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                                    <path d="M12 9v4" />
                                    <path d="M12 17h.01" />
                                </>
                            )}
                            {toast.type === 'success' && (
                                <>
                                    <circle cx="12" cy="12" r="10" fill={TOAST_COLORS.success} stroke="none" />
                                    <path
                                        d="M16.7 9.2 10.6 15.3 7.2 11.9"
                                        stroke="#FFFFFF"
                                        strokeWidth="2.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </>
                            )}
                            {(toast.type === 'info' || toast.type === 'ai') && (
                                <>
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 10v6" />
                                    <path d="M12 7h.01" />
                                </>
                            )}
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

