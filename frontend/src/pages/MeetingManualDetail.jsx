import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MobileTab from '../components/MobileTab';
import ToastPopup from '../components/toastpopup';
import { getProjectIntegrations, listProjectMeetings, updateProjectMeeting } from '../api/apiClient';

const MANUAL_MEETING_RECORDS_KEY = 'tiki_manual_minutes_records';
const PROJECT_OVERRIDE_STORAGE_KEY = 'tiki_project_overrides';
const PROJECT_CATALOG_STORAGE_KEY = 'tiki_project_catalog';
const PROJECTLIST_CHEVRON_COLOR = '#A0AFBF';

const buildServerManualActionItems = (minutes) => {
  const actions = Array.isArray(minutes?.actions) ? minutes.actions : [];
  const recordId = String(minutes?.id || minutes?.recordId || 'manual');
  const metaItem = {
    id: `${recordId}-meta`,
    type: '__tiki_meeting_meta',
    __tiki_meta: true,
    data: {
      source: 'manual',
      summary: minutes?.summary || '직접 작성된 회의록입니다.',
      keywords: Array.isArray(minutes?.keywords) ? minutes.keywords : [],
      decisions: Array.isArray(minutes?.decisions) ? minutes.decisions : [],
      issues: Array.isArray(minutes?.issues) ? minutes.issues : [],
      nextAgenda: minutes?.nextAgenda || '',
      raw_text: minutes?.summary || '직접 작성된 회의록입니다.',
    },
  };

  const taskItems = actions
    .map((item, index) => {
      const title = String(item?.text || item?.title || '').trim();
      if (!title) return null;
      return {
        id: item?.id || `${recordId}-action-${index + 1}`,
        text: title,
        title,
        assignee: item?.assignee || '담당자 미지정',
        assignees: item?.assignee ? [item.assignee] : [],
        due: item?.due || item?.dueDate || '',
        dueDate: item?.dueDate || item?.due || '',
        checked: Boolean(item?.checked),
        status: item?.checked ? '수행완료' : item?.status || '검토대기',
        source: minutes?.title || '직접 작성 회의록',
        projectId: minutes?.projectId || '',
        projectName: minutes?.projectName || '',
      };
    })
    .filter(Boolean);

  return [metaItem, ...taskItems];
};

const mergeMinutesWithServerMeeting = (minutes, meeting) => {
  if (!minutes || !meeting || typeof meeting !== 'object') return minutes;
  const serverItems = Array.isArray(meeting.action_items)
    ? meeting.action_items
    : Array.isArray(meeting.actionItemsList)
      ? meeting.actionItemsList
      : [];
  const visibleServerItems = serverItems.filter((item) => !(item?.__tiki_meta || item?.type === '__tiki_meeting_meta'));
  if (visibleServerItems.length === 0) return minutes;

  const nextActions = (Array.isArray(minutes.actions) ? minutes.actions : []).map((action, index) => {
    const expectedId = action?.id || `${minutes.id}-action-${index + 1}`;
    const server = visibleServerItems.find((item) => String(item?.id || '') === String(expectedId))
      || visibleServerItems.find((item) => String(item?.title || item?.text || '').trim() === String(action?.text || '').trim());
    if (!server) return action;
    const serverDone = server.status === '수행완료' || Boolean(server.checked);
    const localDone = action.status === '수행완료' || Boolean(action.checked);
    const status = serverDone || localDone ? '수행완료' : server.status || action.status || '';
    return {
      ...action,
      text: server.text || server.title || action.text,
      assignee: server.assignee || action.assignee,
      dueDate: server.dueDate || server.due || action.dueDate,
      status,
      checked: status === '수행완료',
    };
  });

  return {
    ...minutes,
    meetingId: minutes.meetingId || meeting.id || '',
    serverMeetingId: minutes.serverMeetingId || meeting.id || '',
    actions: nextActions,
  };
};

// Reverse of buildServerManualActionItems — reconstructs a full `minutes`
// object straight from a real backend Meeting when there is no localStorage
// record for it at all (e.g. a fresh page load with no navigation state to
// carry the in-memory copy). The structured summary/decisions/issues/next
// agenda live inside a hidden __tiki_meeting_meta marker in action_items.
const buildMinutesFromServerMeeting = (meeting, { recordId, projectId, projectName } = {}) => {
  const items = Array.isArray(meeting?.action_items) ? meeting.action_items : [];
  const metaItem = items.find((item) => item?.__tiki_meta || item?.type === '__tiki_meeting_meta');
  const visibleItems = items.filter((item) => !(item?.__tiki_meta || item?.type === '__tiki_meeting_meta'));
  const data = metaItem?.data || {};

  return {
    id: recordId || String(meeting?.id || '').trim() || `manual-${Date.now()}`,
    meetingId: String(meeting?.id || '').trim(),
    serverMeetingId: String(meeting?.id || '').trim(),
    projectId: String(projectId || '').trim(),
    projectName: projectName || '',
    title: meeting?.title || '회의 제목 없음',
    date: meeting?.date || '-',
    rawDate: '',
    type: meeting?.meeting_type || '정기',
    participants: Array.isArray(meeting?.participants) ? meeting.participants : [],
    summary: data.summary || meeting?.summary || '',
    // Older records (created before the meta marker existed) never got a
    // keywords list, but the meeting's own tags serve the same purpose.
    keywords: Array.isArray(data.keywords) && data.keywords.length
      ? data.keywords
      : Array.isArray(meeting?.tags)
        ? meeting.tags.map((tag) => String(tag || '').replace(/^#/, '')).filter(Boolean)
        : [],
    decisions: Array.isArray(data.decisions) ? data.decisions : [],
    issues: Array.isArray(data.issues) ? data.issues : [],
    nextAgenda: typeof data.nextAgenda === 'string' ? data.nextAgenda : '',
    actions: visibleItems.map((item) => ({
      id: item?.id || '',
      text: item?.text || item?.title || '',
      assignee: item?.assignee || '',
      dueDate: item?.dueDate || item?.due || '',
      checked: item?.status === '수행완료' || Boolean(item?.checked),
      status: item?.status || '검토대기',
    })),
    createdAt: meeting?.created_at || new Date().toISOString(),
  };
};

const stateLabels = {
  IDLE: '대기 중',
  UPLOADING: '업로드 중',
  PROCESSING: 'AI 분석 중',
  COMPLETED: '분석 완료',
  FAILED: '오류 발생',
};

const PARTICIPANT_COLORS = ['#0099CC', '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#0EA5E9'];

function colorForParticipant(name) {
  const key = String(name || '');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return PARTICIPANT_COLORS[Math.abs(hash) % PARTICIPANT_COLORS.length];
}

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

const writeManualMeetingRecords = (next) => {
  try {
    localStorage.setItem(MANUAL_MEETING_RECORDS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage write failures in local mock mode
  }
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

const readProjectCatalog = () => {
  try {
    const raw = localStorage.getItem(PROJECT_CATALOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeProjectOverrides = (next) => {
  try {
    localStorage.setItem(PROJECT_OVERRIDE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage write failures in local mock mode
  }
};

const buildStoredIntegrationLogs = ({ projectId = '', sourceTitle = '' } = {}) => {
  const overrides = readProjectOverrides();
  const normalizedProjectId = String(projectId || '').trim();
  const normalizedSource = String(sourceTitle || '').trim();
  const projects = normalizedProjectId
    ? [[normalizedProjectId, overrides[normalizedProjectId]]]
    : Object.entries(overrides);

  return projects.flatMap(([currentProjectId, projectOverride]) => {
    const items = Array.isArray(projectOverride?.myActionItems) ? projectOverride.myActionItems : [];
    return items
      .filter((item) => item?.integrationTool || item?.externalLink || item?.jiraLink)
      .filter((item) => {
        const projectMatches = !normalizedProjectId || String(item?.projectId || currentProjectId) === normalizedProjectId;
        const sourceMatches = !normalizedSource || String(item?.source || '').trim() === normalizedSource;
        return projectMatches && sourceMatches;
      })
      .map((item, index) => {
        const rawTool = String(item?.integrationTool || item?.integrationProvider || item?.externalLink || item?.jiraLink || '').toLowerCase();
        const svcId = rawTool.includes('notion') ? 'notion' : 'jira';
        return {
          svcId,
          label: item?.title || item?.text || `대시보드 연동 업무 ${index + 1}`,
          time: item?.updatedAt || item?.updated_at || new Date().toISOString(),
          user: item?.assignee || getStoredUserName() || '담당자',
          source: 'dashboard',
        };
      });
  });
};

const buildExternalLink = (svcId, title) => {
  const params = new URLSearchParams({ jql: `text ~ "${String(title || '업무').slice(0, 40)}"` });
  if (svcId === 'notion') return `https://www.notion.so/search?query=${encodeURIComponent(String(title || '업무'))}`;
  return `https://jira.atlassian.com/issues/?${params.toString()}`;
};

const getStoredUserName = () => {
  try {
    const user = JSON.parse(localStorage.getItem('tiki_user') || 'null');
    return String(user?.name || user?.email || '').trim();
  } catch {
    return '';
  }
};

const normalizeMemberName = (member) => {
  if (typeof member === 'string') return member.trim();
  if (!member || typeof member !== 'object') return '';
  const inviteStatus = String(member.invite_status || member.inviteStatus || '').trim();
  if (inviteStatus && inviteStatus !== 'accepted') return '';
  return String(member.name || member.email || '').trim();
};

const buildAcceptedProjectParticipants = ({ projectId = '', state = {} } = {}) => {
  const names = new Set();
  const add = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized || ['미정', '미지정', '담당자', '담당자 미지정', '회의록', '전체'].includes(normalized)) return;
    names.add(normalized);
  };
  const addParticipants = (values) => {
    if (!Array.isArray(values)) return;
    values.forEach((value) => add(normalizeMemberName(value)));
  };

  const normalizedProjectId = String(projectId || state?.projectId || state?.project?.id || '').trim();
  const overrides = readProjectOverrides();
  const override = normalizedProjectId ? overrides[normalizedProjectId] : null;
  const catalogProject = readProjectCatalog().find((item) => String(item?.id || '') === normalizedProjectId);
  const projectSources = [state?.project, override, catalogProject].filter(Boolean);

  projectSources.forEach((project) => {
    add(project?.teamLead || project?.team_lead);
    addParticipants(project?.admins);
    addParticipants(project?.participants);
    addParticipants(project?.members);
  });

  if (names.size === 0) add(getStoredUserName());
  return [...names];
};

const buildProjectAssigneeOptions = ({ projectId = '', state = {}, participants = [], actions = [] } = {}) => {
  const names = new Set();
  const add = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized || ['미정', '미지정', '담당자', '담당자 미지정', '회의록', '전체'].includes(normalized)) return;
    names.add(normalized);
  };
  const addMany = (values) => {
    if (!Array.isArray(values)) return;
    values.forEach((value) => add(normalizeMemberName(value)));
  };

  const normalizedProjectId = String(projectId || state?.projectId || state?.project?.id || '').trim();
  const overrides = readProjectOverrides();
  const override = normalizedProjectId ? overrides[normalizedProjectId] : null;
  const catalogProject = readProjectCatalog().find((item) => String(item?.id || '') === normalizedProjectId);
  const projectSources = [state?.project, override, catalogProject].filter(Boolean);

  buildAcceptedProjectParticipants({ projectId: normalizedProjectId, state }).forEach(add);
  addMany(participants);
  addMany(state?.projectParticipants);
  projectSources.forEach((project) => {
    add(project?.teamLead || project?.team_lead);
    addMany(project?.participants);
    addMany(project?.admins);
    addMany(project?.members);
  });
  add(getStoredUserName());

  return [...names];
};

const formatDueDate = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return '미정';
  return normalizeDueLabel(value) || value;
};

const formatDisplayDate = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return '-';
  return value;
};

const formatPublishedDate = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return '-';

  if (/^\d{4}년\s*\d{1,2}월\s*\d{1,2}일$/.test(value)) return value;

  const ymd = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    return `${Number(ymd[1])}년 ${Number(ymd[2])}월 ${Number(ymd[3])}일`;
  }

  const mdhm = value.match(/^(\d{2})-(\d{2})\s+\d{2}:\d{2}$/);
  if (mdhm) {
    const year = new Date().getFullYear();
    return `${year}년 ${Number(mdhm[1])}월 ${Number(mdhm[2])}일`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월 ${parsed.getDate()}일`;
  }

  return value;
};

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const pad2 = (n) => String(n).padStart(2, '0');

const toDateStr = (year, month, day) => `${year}-${pad2(month + 1)}-${pad2(day)}`;

const parseDateStr = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
};

const buildCalendarGrid = (year, month) => {
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
};

const parseDueToDateStr = (due) => {
  if (!due) return null;
  const raw = `${due}`.trim();

  const koreanMatched = raw.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
  if (koreanMatched) {
    const year = Number(koreanMatched[1]);
    const month = Number(koreanMatched[2]);
    const day = Number(koreanMatched[3]);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return toDateStr(year, month - 1, day);
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const dottedMatched = raw.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
  if (dottedMatched) {
    const year = Number(dottedMatched[1]);
    const month = Number(dottedMatched[2]);
    const day = Number(dottedMatched[3]);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return toDateStr(year, month - 1, day);
    }
  }

  const legacyMatched = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (legacyMatched) {
    const month = Number(legacyMatched[1]);
    const day = Number(legacyMatched[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const now = new Date();
      return toDateStr(now.getFullYear(), month - 1, day);
    }
  }

  return null;
};

const formatDueFromDateStr = (dateStr) => {
  const parsed = parseDateStr(dateStr);
  if (!parsed) return null;
  return `${parsed.year}년 ${parsed.month + 1}월 ${parsed.day}일`;
};

const normalizeDueLabel = (due) => {
  if (!due) return due;
  const dateStr = parseDueToDateStr(due);
  if (!dateStr) return due;
  return formatDueFromDateStr(dateStr);
};

const SVC_ISSUE_BTN = {
  jira: 'linear-gradient(135deg,#10B981,#059669)',
  notion: 'linear-gradient(135deg,#0D1B2A,#374151)',
};

function LucideIcon({ name, size = 14, color = 'currentColor', strokeWidth = 2, className = '' }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
  };

  switch (name) {
    case 'x':
      return <svg {...common}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>;
    case 'check':
      return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>;
    case 'check-circle':
      return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M9 12.5 11 14.5 15.5 10" /></svg>;
    case 'circle':
      return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
    case 'arrow-up':
      return <svg {...common}><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></svg>;
    case 'alert-triangle':
      return <svg {...common}><path d="M10.29 3.86 1.82 18A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
    case 'alert-circle':
      return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>;
    case 'info':
      return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M12 10v6" /><path d="M12 7h.01" /></svg>;
    case 'clipboard-list':
      return <svg {...common}><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 11h.01" /><path d="M13 11h3" /><path d="M9 16h.01" /><path d="M13 16h3" /></svg>;
    case 'rows-3':
      return <svg {...common}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>;
    case 'chevron-down':
      return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
    case 'pencil':
      return <svg {...common}><path d="m16.5 3.5 4 4L8 20l-4 1 1-4 11.5-13.5Z" /></svg>;
    case 'shield':
      return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    default:
      return null;
  }
}

function Spinner({ size = 14, color = '#fff' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'tiki-spin 0.75s linear infinite', flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" stroke={color} strokeOpacity="0.25" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <style>{'@keyframes tiki-spin { to { transform: rotate(360deg); } }'}</style>
    </svg>
  );
}

function Modal({ open, onClose, title, children, footer, maxWidth = 448, bodyOverflowY = 'auto', bodyHeight }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center p-4"
      style={{ alignItems: 'center', paddingBottom: '76px' }}
    >
      <div
        className="absolute inset-0"
        style={{ backdropFilter: 'blur(8px)', background: 'rgba(13,27,42,0.4)' }}
        onClick={onClose}
      />
      <div className="relative self-center w-full rounded-2xl bg-white border border-[rgba(0,100,180,0.12)] shadow-[0_18px_50px_rgba(13,27,42,0.22)]" style={{ maxWidth }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,100,180,0.08)]">
          <h3 className="text-base font-bold text-[#0D1B2A]">{title}</h3>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8FAFF] text-[#5A6F8A] flex items-center justify-center">
            <LucideIcon name="x" size={16} />
          </button>
        </div>
        <div className="px-5 py-4" style={{ overflowY: bodyOverflowY, height: bodyHeight }}>{children}</div>
        {footer && <div className="px-5 py-4 border-t border-[rgba(0,100,180,0.08)] flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

function CustomDropdown({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  hasError = false,
  triggerStyle,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-between gap-2"
        style={{
          borderColor: hasError ? 'rgba(239,68,68,0.4)' : 'rgba(0,100,180,0.12)',
          background: '#F8FAFF',
          color: value ? '#0D1B2A' : '#9CA3AF',
          fontFamily: 'inherit',
          ...(triggerStyle || {}),
        }}
      >
        <span className="truncate">{value || placeholder}</span>
        <span
          className="flex-shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transformOrigin: '50% 50%', transition: 'transform 0.2s ease' }}
        >
          <LucideIcon name="chevron-down" size={14} color={PROJECTLIST_CHEVRON_COLOR} strokeWidth={2} />
        </span>
      </button>

      {open && !disabled && (
        <div
          className="absolute z-20 bottom-full mb-1 w-full rounded-lg border overflow-hidden max-h-52 overflow-y-auto"
          style={{ borderColor: 'rgba(0,100,180,0.12)', background: '#fff', boxShadow: '0 8px 24px rgba(13,27,42,0.12)' }}
        >
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                option === value
                  ? 'bg-cyan-50 text-cyan-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DueDateCalendar({ value, onSelect, onClose, placement = 'bottom' }) {
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const parsedValue = parseDateStr(value) || parseDateStr(todayStr);
  const [viewYear, setViewYear] = useState(parsedValue.year);
  const [viewMonth, setViewMonth] = useState(parsedValue.month);

  useEffect(() => {
    const parsed = parseDateStr(value);
    if (!parsed) return;
    setViewYear(parsed.year);
    setViewMonth(parsed.month);
  }, [value]);

  const cells = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  return (
    <div
      className={`absolute z-20 left-0 w-[280px] max-w-[88vw] box-border overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)] p-3.5 ${placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2.5">
        <button
          type="button"
          onClick={() => {
            if (viewMonth === 0) {
              setViewMonth(11);
              setViewYear((y) => y - 1);
            } else {
              setViewMonth((m) => m - 1);
            }
          }}
          className="p-1.5 rounded-lg text-[#5A6F8A] hover:bg-[#F1F4F8] hover:text-[#0D1B2A] transition-colors cursor-pointer"
          aria-label="이전 달"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-sm font-bold text-[#0D1B2A]">{viewYear}년 {viewMonth + 1}월</span>
        <button
          type="button"
          onClick={() => {
            if (viewMonth === 11) {
              setViewMonth(0);
              setViewYear((y) => y + 1);
            } else {
              setViewMonth((m) => m + 1);
            }
          }}
          className="p-1.5 rounded-lg text-[#5A6F8A] hover:bg-[#F1F4F8] hover:text-[#0D1B2A] transition-colors cursor-pointer"
          aria-label="다음 달"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 w-full">
        {WEEKDAY_LABELS.map((label, idx) => (
          <div
            key={label}
            className={`text-center text-[11px] font-semibold py-1 ${
              idx === 0 ? 'text-[#EF4444]' : idx === 6 ? 'text-[#0099CC]' : 'text-[#9AA7B8]'
            }`}
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
              className={`aspect-square w-full flex items-center justify-center text-[13px] rounded-lg transition-colors cursor-pointer ${
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

function IntegrationBadge({ svc, onClick, issuedCount = 0 }) {
  const hasIssued = issuedCount > 0;

  return (
    <button
      type="button"
      onClick={() => onClick(svc)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all hover:scale-105 active:scale-95 cursor-pointer"
      style={{
        background: hasIssued ? 'rgba(16,185,129,0.06)' : 'rgba(90,111,138,0.06)',
        borderColor: hasIssued ? 'rgba(16,185,129,0.35)' : 'rgba(0,100,180,0.12)',
      }}
    >
      <span
        className="w-4 h-4 rounded flex items-center justify-center text-white font-bold flex-shrink-0"
        style={{ background: svc.iconBg, fontSize: 9 }}
      >
        {svc.iconLabel}
      </span>
      <span className="text-xs font-semibold text-slate-500">{svc.name}</span>
      <span className="text-xs font-bold" style={{ color: hasIssued ? '#10B981' : '#5A6F8A' }}>
        {hasIssued ? `${issuedCount}건 연동` : '연동 전'}
      </span>
      {hasIssued && <span className="text-emerald-500"><LucideIcon name="check" size={12} /></span>}
    </button>
  );
}

function ServiceDetailModal({ open, onClose, svc, auditLog }) {
  if (!svc) return null;

  const svcLogs = auditLog.filter((log) => log.svcId === svc.id);
  const done = svcLogs.length;
  const statusLabel = { done: '완료', progress: '진행 중', todo: '대기' };
  const statusCls = {
    done: 'bg-emerald-100 text-emerald-700',
    progress: 'bg-amber-100 text-amber-700',
    todo: 'bg-slate-100 text-slate-500',
  };
  const normalizeText = (value) => String(value || '').trim().toLowerCase();
  const issuedTicketTitles = new Set(svcLogs.map((log) => normalizeText(log.label)).filter(Boolean));
  const displayTickets = [
    ...svc.tickets.map((ticket) => {
      const isIssued = issuedTicketTitles.has(normalizeText(ticket.title)) || issuedTicketTitles.has(normalizeText(`${ticket.id} · ${ticket.title}`));
      return isIssued ? { ...ticket, status: 'done' } : ticket;
    }),
    ...svcLogs
      .filter((log) => !svc.tickets.some((ticket) => normalizeText(ticket.title) === normalizeText(log.label)))
      .map((log, idx) => ({
        id: `${svc.iconLabel || svc.id}-${idx + 1}`,
        title: log.label,
        assignee: log.user || '담당자',
        status: 'done',
      })),
  ];
  return (
    <Modal open={open} onClose={onClose} title={`${svc.name} 연동 현황`}>
      <div className="mb-4">
        <div className="flex justify-between mb-1.5">
          <span className="text-xs text-slate-400">실제 발행 이력</span>
          <span className="text-xs font-bold text-slate-900">{done > 0 ? `${done}건 연동` : '연동 전'}</span>
        </div>
      </div>

      {svcLogs.length === 0 ? (
        <div className="rounded-xl p-4 mb-4 border border-slate-200 bg-slate-50">
          <p className="text-sm font-semibold text-slate-700">아직 {svc.name}로 보낸 업무가 없습니다.</p>
          <p className="text-xs text-slate-400 mt-1">업무 보내기를 실행하면 이곳에 실제 발행 이력이 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
        {displayTickets.map((ticket) => (
          <div key={ticket.id} className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border ${ticket.status === 'done' ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'}`}>
            <span className="flex-shrink-0">
              {ticket.status === 'done' ? (
                <LucideIcon name="check-circle" size={14} color="#10B981" />
              ) : ticket.status === 'progress' ? (
                <Spinner size={14} color="#F59E0B" />
              ) : (
                <LucideIcon name="circle" size={14} color="#94A3B8" />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{ticket.id} · {ticket.title}</p>
              <p className="text-xs text-slate-400">{ticket.assignee}</p>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusCls[ticket.status]}`}>{statusLabel[ticket.status]}</span>
          </div>
        ))}
        </div>
      )}

      {svcLogs.length > 0 && (
        <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'rgba(0,153,204,0.04)', border: '1px solid rgba(0,153,204,0.12)' }}>
          <p className="text-xs font-semibold text-slate-400 mb-2">발행 이력</p>
          {svcLogs.slice(0, 3).map((log, idx) => (
            <div key={`${log.time}-${idx}`} className="flex items-center gap-2 text-xs">
              <span className="text-emerald-500 flex-shrink-0"><LucideIcon name="arrow-up" size={12} /></span>
              <span className="text-slate-600 flex-1 truncate">{log.label}</span>
              <span className="text-slate-400 flex-shrink-0">{formatPublishedDate(log.time)}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function IssueButton({ onClick, issuingGlobal = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={issuingGlobal}
      className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-white text-xs font-bold transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 cursor-pointer"
      style={{ background: 'linear-gradient(135deg,#0099CC,#7C3AED)', borderRadius: '10px', minWidth: 100 }}
    >
      {issuingGlobal ? (
        <>
          <Spinner size={12} color="#fff" />
          <span>연동 중...</span>
        </>
      ) : (
        <>
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
          업무 보내기
        </>
      )}
    </button>
  );
}

// Replaces the old IntegrationControlTower's fake "업무 보내기"/simulated issue
// count with the same real, project-level connection status already shown on
// Dashboard.jsx/ProjectMeetings.jsx — sync itself is automatic, so there is
// nothing to manually "send" here anymore.
function RealIntegrationStatus({ connectedProviders, onManage }) {
  const jiraConnected = Boolean(connectedProviders?.jira);
  const notionConnected = Boolean(connectedProviders?.notion);
  return (
    <div
      className="lg:w-auto flex-shrink-0 rounded-2xl px-4 py-4 flex flex-wrap items-center gap-3"
      style={{ border: '1px solid rgba(0,100,180,0.12)', background: 'rgba(0,153,204,0.03)' }}
    >
      <p className="text-xs font-semibold text-slate-400">연동 현황</p>
      <span
        className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
        style={{
          background: jiraConnected ? 'rgba(16,185,129,0.1)' : 'rgba(90,111,138,0.08)',
          color: jiraConnected ? '#10B981' : '#5A6F8A',
        }}
      >
        Jira {jiraConnected ? '연동됨' : '미연동'}
      </span>
      <span
        className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
        style={{
          background: notionConnected ? 'rgba(16,185,129,0.1)' : 'rgba(90,111,138,0.08)',
          color: notionConnected ? '#10B981' : '#5A6F8A',
        }}
      >
        Notion {notionConnected ? '연동됨' : '미연동'}
      </span>
      {!(jiraConnected && notionConnected) && (
        <button
          type="button"
          onClick={onManage}
          className="text-xs font-bold text-[#0099CC] hover:underline cursor-pointer"
        >
          프로젝트 설정에서 연동하기
        </button>
      )}
    </div>
  );
}

function IntegrationControlTower({ services, auditLog, onBadgeClick, onIssueOpen, isMobile, issuing }) {
  const latestLog = auditLog[auditLog.length - 1] || null;
  const hasIssued = Boolean(latestLog);
  const issuedCountByService = auditLog.reduce((acc, log) => {
    if (!log?.svcId) return acc;
    acc[log.svcId] = (acc[log.svcId] || 0) + 1;
    return acc;
  }, {});
  const totalIssued = auditLog.length;

  return (
    <div
      className="lg:w-auto flex-shrink-0 rounded-2xl px-4 py-4"
      style={{ border: '1px solid rgba(0,100,180,0.12)', background: 'rgba(0,153,204,0.03)' }}
    >
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-slate-400">연동 서비스 현황</p>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              background: hasIssued ? 'rgba(16,185,129,0.1)' : 'rgba(90,111,138,0.08)',
              color: hasIssued ? '#10B981' : '#5A6F8A',
            }}
          >
            {hasIssued ? `${totalIssued}건 연동 완료` : '연동 전'}
          </span>
        </div>

        {!isMobile && latestLog && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#10B981' }} />
            <span className="text-xs text-slate-400">
              최근 발행일:&nbsp;
              <span className="font-semibold text-slate-600">{formatPublishedDate(latestLog.time)}</span>
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {services.map((svc) => (
          <IntegrationBadge key={svc.id} svc={svc} onClick={onBadgeClick} issuedCount={issuedCountByService[svc.id] || 0} />
        ))}

        <div className="hidden sm:block w-px h-5 bg-slate-200 mx-1" />

        <IssueButton onClick={onIssueOpen} issuingGlobal={issuing} />
      </div>

      {isMobile && latestLog && (
        <p className="text-xs text-slate-400 mt-2.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          최근 발행일: <span className="font-semibold text-slate-600">{formatPublishedDate(latestLog.time)}</span>
        </p>
      )}
    </div>
  );
}

function AgendaCompletionSection({ actions, onToggleAction }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const total = actions.length;
  const done = actions.filter((action) => action.status === 'done').length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const achieved = total > 0 && done === total;
  const gaugeColor = achieved ? '#10B981' : '#0099CC';
  const size = 136;
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const remaining = total - done;

  return (
    <section className="rounded-2xl bg-white px-5 py-5 md:px-7 md:py-6 overflow-hidden relative" style={{ border: '1px solid rgba(0,100,180,0.12)' }}>
      <div className="relative flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: gaugeColor }}>
            AGENDA PROGRESS
          </p>
          <p className="text-base md:text-lg font-bold text-slate-900">이번 회의, 할 일을 다 끝냈을까?</p>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="text-xs leading-none font-semibold px-3 py-1 rounded-full flex items-center justify-center text-center gap-[2px]"
            style={{ color: achieved ? '#10B981' : '#0099CC', background: achieved ? 'rgba(16,185,129,0.12)' : 'rgba(0,153,204,0.1)' }}
          >
            {achieved && <LucideIcon name="check-circle" size={8} color="#10B981" />}
            {achieved ? '목표 달성' : `${remaining}건 남음`}
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="h-7 px-1 flex items-center justify-center cursor-pointer"
            style={{ color: achieved ? '#10B981' : '#0099CC', background: 'transparent' }}
            aria-label="의제 진행 접기/펼치기"
          >
            <LucideIcon name="chevron-down" size={12} color={PROJECTLIST_CHEVRON_COLOR} strokeWidth={2} />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="relative flex flex-col md:flex-row md:items-center gap-5 md:gap-30 md:ml-24">
          <div className="flex items-center gap-5 md:gap-0 md:flex-col md:items-center flex-shrink-0">
            <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(0,100,180,0.08)" strokeWidth={stroke} />
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={gaugeColor}
                  strokeWidth={stroke}
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-extrabold leading-none" style={{ color: gaugeColor }}>
                  {pct}
                  <span className="text-base font-bold">%</span>
                </p>
                <p className="text-[11px] font-semibold text-slate-400 mt-1.5">{done}/{total} 완료</p>
              </div>
            </div>
          </div>

          <div className="hidden md:block w-px h-32 bg-slate-100 flex-shrink-0" />

          <div className="min-w-0 w-full md:max-w-2xl">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-semibold text-slate-400">해야 할 일 상세</p>
              <p className="text-xs text-slate-300">{done}/{total}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              {actions.map((action, idx) => {
                const isDone = action.status === 'done';
                return (
                  <button
                    key={`${action.text}-${idx}`}
                    type="button"
                    onClick={() => onToggleAction(idx)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all hover:-translate-y-0.5 cursor-pointer"
                    style={{ borderColor: isDone ? 'rgba(16,185,129,0.3)' : 'rgba(0,100,180,0.1)', background: isDone ? 'rgba(16,185,129,0.06)' : '#fff' }}
                  >
                    <span className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-colors" style={{ background: isDone ? '#10B981' : 'rgba(0,100,180,0.08)' }}>
                      {isDone ? <LucideIcon name="check" size={11} color="#fff" /> : null}
                    </span>
                    <span className={`text-sm font-medium flex-1 min-w-0 truncate ${isDone ? 'text-emerald-700 line-through' : 'text-slate-700'}`}>
                      {action.text}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{action.due || '미정'}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: isDone ? '#10B981' : '#5A6F8A', background: isDone ? 'rgba(16,185,129,0.1)' : 'rgba(90,111,138,0.08)' }}>
                        {action.assignee}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Divider({ label }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-px bg-slate-100" />
      <span className="text-xs font-semibold text-slate-400">{label}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

function EditableDecision({ text, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(text);

  useEffect(() => {
    setVal(text);
  }, [text]);

  return (
    <div className="group p-2.5 rounded-lg hover:bg-blue-50 transition-colors">
      {editing ? (
        <div>
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            rows={2}
            className="w-full border border-cyan-400 rounded-lg px-3 py-2 text-sm outline-none resize-none bg-white"
            style={{ fontFamily: 'inherit' }}
          />
          <div className="flex gap-1.5 mt-1.5">
            <button
              type="button"
              onClick={() => {
                onSave(val);
                setEditing(false);
              }}
              className="text-xs font-bold px-2.5 py-1 rounded text-white bg-cyan-500"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => {
                setVal(text);
                setEditing(false);
              }}
              className="text-xs text-slate-400 px-2.5 py-1 rounded hover:bg-slate-100"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="w-full flex items-start gap-2 text-left">
          <p className="text-sm text-slate-800 leading-relaxed flex-1">{val}</p>
        </button>
      )}
    </div>
  );
}

function ActionItemCard({ item, checked, onToggle }) {
  return (
    <div
      className={`group flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${
        checked ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'
      }`}
      onClick={onToggle}
    >
      <input
        type="checkbox"
        checked={checked}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggle}
        className={`mt-0.5 flex-shrink-0 ${checked ? 'accent-emerald-500' : 'accent-cyan-500'}`}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${checked ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.text}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {item.assignee}
          {checked ? ' · 완료' : item.due ? ` · ${item.due}` : ''}
        </p>
      </div>
      {checked && <span className="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-100 text-emerald-600">완료</span>}
    </div>
  );
}

function EditField({ label, hint, action, children }) {
  return (
    <div>
      {(label || action) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <p className="text-xs font-semibold text-slate-500">{label}</p>}
          {action}
        </div>
      )}
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

const EDIT_INPUT_CLS =
  'w-full text-sm rounded-lg px-3 py-2.5 outline-none border border-slate-200 bg-white transition-colors placeholder:text-slate-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100';

function EditAddButton({ onClick, label = '항목 추가' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-dashed border-slate-300 text-slate-500 hover:border-cyan-300 hover:text-cyan-600 hover:bg-cyan-50/60 transition-colors cursor-pointer"
    >
      <span className="text-sm leading-none">+</span>
      {label}
    </button>
  );
}

function EditRemoveButton({ onClick, label = '삭제' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
    >
      <LucideIcon name="x" size={14} />
    </button>
  );
}

function EditEmptyRow({ children }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 py-3 px-3 text-center text-xs text-slate-400">
      {children}
    </div>
  );
}

function EditSaveButton({ onClick, label = '저장' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg text-white transition-all hover:-translate-y-0.5 cursor-pointer"
      style={{ background: 'linear-gradient(135deg,#0099CC,#7C3AED)', boxShadow: '0 4px 12px rgba(0,100,180,0.18)' }}
    >
      <LucideIcon name="check" size={11} color="#fff" />
      {label}
    </button>
  );
}

const PRIORITY_STYLE = {
  높음: { card: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-500' },
  보통: { card: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-600' },
  낮음: { card: 'bg-slate-50 border-slate-200', badge: 'bg-slate-100 text-slate-500' },
};

const ISSUE_CFG = {
  높음: { icon: 'alert-triangle', iconColor: '#EF4444', badge: 'bg-red-100 text-red-500', card: 'bg-red-50 border-red-200' },
  보통: { icon: 'alert-circle', iconColor: '#F59E0B', badge: 'bg-amber-100 text-amber-600', card: 'bg-amber-50 border-amber-200' },
  낮음: { icon: 'info', iconColor: '#64748B', badge: 'bg-slate-100 text-slate-500', card: 'bg-slate-50 border-slate-200' },
};

function buildInitialServices(minutes) {
  const baseActions = Array.isArray(minutes.actions) ? minutes.actions : [];
  const baseDecisions = Array.isArray(minutes.decisions) ? minutes.decisions : [];

  const jiraTickets = (baseActions.length > 0 ? baseActions : [{ text: '해야 할 일 없음', assignee: '미지정', checked: false }]).map((item, idx) => ({
    id: `MAN-${idx + 1}`,
    title: item.text || '해야 할 일',
    assignee: item.assignee || '미지정',
    due: formatDueDate(item.dueDate),
    status: 'todo',
  }));

  const notionTickets = (baseDecisions.length > 0 ? baseDecisions : [{ text: '결정 사항 없음' }]).map((item, idx) => ({
    id: `DOC-${idx + 1}`,
    title: item.text || '결정 사항',
    assignee: '회의록',
    status: 'progress',
  }));

  return [
    {
      id: 'jira',
      name: 'Jira',
      iconBg: '#0099CC',
      iconLabel: 'J',
      tickets: jiraTickets,
    },
    {
      id: 'notion',
      name: 'Notion',
      iconBg: '#0D1B2A',
      iconLabel: 'N',
      tickets: notionTickets,
    },
  ];
}

export default function MeetingManualDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const [detailSvc, setDetailSvc] = useState(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueStep, setIssueStep] = useState(1);
  const [selectedIssueSvc, setSelectedIssueSvc] = useState('');
  const [issueCheckedItems, setIssueCheckedItems] = useState(new Set());
  const [issueMode, setIssueMode] = useState('merged');
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDesc, setIssueDesc] = useState('회의에서 논의된 항목입니다. 내용을 확인하고 처리해주세요.');
  const [issuePriority, setIssuePriority] = useState('보통');
  const [issueAssignee, setIssueAssignee] = useState('');
  const [issueDueDate, setIssueDueDate] = useState('미정');
  const [issueIndividualDrafts, setIssueIndividualDrafts] = useState([]);
  const [issuing, setIssuing] = useState(false);
  const [openDuePickerIdx, setOpenDuePickerIdx] = useState(null);
  const [isIssueDuePickerOpen, setIsIssueDuePickerOpen] = useState(false);
  const [issueIndividualDuePickerIdx, setIssueIndividualDuePickerIdx] = useState(null);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [participantsModalMembers, setParticipantsModalMembers] = useState([]);
  const [collapsedSections, setCollapsedSections] = useState({
    decisions: false,
    actions: false,
    issues: false,
    nextAgenda: false,
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState({
    keywordsInput: '',
    summaryInput: '',
    decisionsDraft: [],
    actionsDraft: [],
    issuesDraft: [],
    nextAgendaInput: '',
  });

  const isAnyModalOpen = Boolean(detailSvc || issueOpen || isParticipantsModalOpen);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // location.state only survives an in-app navigation from the meeting list —
  // a refresh or direct URL visit loses it, which used to fall back straight to
  // placeholder content with no way to recover. Fall back to the URL's query
  // params instead, and mirror state into the URL so a refresh keeps working.
  const recordId = location.state?.recordId || location.state?.meetingId || searchParams.get('recordId') || '';
  const urlProjectId = location.state?.projectId || searchParams.get('projectId') || '';

  useEffect(() => {
    const stateRecordId = location.state?.recordId || location.state?.meetingId;
    const stateProjectId = location.state?.projectId;
    if (
      (stateRecordId && searchParams.get('recordId') !== stateRecordId) ||
      (stateProjectId && searchParams.get('projectId') !== stateProjectId)
    ) {
      const next = new URLSearchParams(searchParams);
      if (stateRecordId) next.set('recordId', stateRecordId);
      if (stateProjectId) next.set('projectId', stateProjectId);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const initialRecord = useMemo(() => {
    const all = readManualMeetingRecords();
    const currentUserName = getStoredUserName();
    if (recordId && all[recordId]) {
      const stored = all[recordId];
      const mergedStored = mergeMinutesWithServerMeeting(stored, location.state?.meeting);
      return {
        ...mergedStored,
        meetingId: mergedStored.meetingId || mergedStored.serverMeetingId || location.state?.meetingId || '',
        serverMeetingId: mergedStored.serverMeetingId || location.state?.meetingId || '',
        participants: buildAcceptedProjectParticipants({
          projectId: mergedStored.projectId || location.state?.projectId,
          state: location.state,
        }),
      };
    }

    const fromMeeting = location.state?.meeting;
    if (fromMeeting && typeof fromMeeting === 'object') {
      // fromMeeting is the real backend Meeting object — its structured summary/
      // decisions/issues/next agenda and real to-do items live inside a hidden
      // __tiki_meeting_meta marker in action_items, so reconstruct from that
      // instead of hardcoding them empty.
      const built = buildMinutesFromServerMeeting(fromMeeting, {
        recordId: recordId || undefined,
        projectId: location.state?.projectId,
        projectName: location.state?.projectName,
      });
      return {
        ...built,
        keywords: built.keywords.length
          ? built.keywords
          : Array.isArray(fromMeeting.tags)
            ? fromMeeting.tags.map((tag) => String(tag || '').replace(/^#/, '')).filter(Boolean)
            : [],
        participants: buildAcceptedProjectParticipants({
          projectId: location.state?.projectId,
          state: location.state,
        }),
      };
    }

    // A specific recordId was requested (from the URL, surviving a refresh)
    // but isn't in localStorage and there's no navigation state to build from —
    // don't guess by grabbing an unrelated recent record here. A dedicated
    // effect below fetches the real meeting from the backend instead.
    if (recordId) return null;

    const values = Object.values(all);
    if (values.length === 0) return null;

    return values.sort((left, right) => {
      const leftTs = new Date(left?.createdAt || 0).getTime();
      const rightTs = new Date(right?.createdAt || 0).getTime();
      return rightTs - leftTs;
    })[0];
  }, [location.state, recordId]);

  const [minutes, setMinutes] = useState(initialRecord);
  const [services, setServices] = useState(() => (initialRecord ? buildInitialServices(initialRecord) : []));
  const [auditLog, setAuditLog] = useState([]);

  const [connectedProviders, setConnectedProviders] = useState({ jira: false, notion: false });
  useEffect(() => {
    const projectId = minutes?.projectId || location.state?.projectId || urlProjectId;
    if (!projectId) return;
    getProjectIntegrations(projectId)
      .then((result) => setConnectedProviders({
        jira: Boolean(result?.jira?.connected),
        notion: Boolean(result?.notion?.connected),
      }))
      .catch(() => setConnectedProviders({ jira: false, notion: false }));
  }, [minutes?.projectId, location.state, urlProjectId]);

  // Nothing local and no navigation state to build from (a refresh/direct URL
  // visit on a meeting that only ever lived on the server) — fetch the real
  // meeting directly instead of showing an empty/placeholder page.
  useEffect(() => {
    if (minutes || !recordId || !urlProjectId) return undefined;
    let cancelled = false;
    listProjectMeetings(urlProjectId)
      .then((meetings) => {
        if (cancelled) return;
        const serverMeeting = (Array.isArray(meetings) ? meetings : []).find(
          (m) => String(m?.id || '') === String(recordId)
        );
        if (!serverMeeting) return;
        const built = buildMinutesFromServerMeeting(serverMeeting, {
          recordId,
          projectId: urlProjectId,
        });
        setMinutes(built);
        setServices(buildInitialServices(built));
      })
      .catch(() => {
        if (!cancelled) showToast('회의록을 불러오지 못했습니다.', 'error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, urlProjectId]);

  const mergedAuditLog = useMemo(() => {
    const storedLogs = buildStoredIntegrationLogs({
      projectId: minutes?.projectId,
      sourceTitle: minutes?.title,
    });
    const seen = new Set();
    return [...auditLog, ...storedLogs].filter((log) => {
      const key = `${log.svcId}|${log.label}|${log.user || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [auditLog, minutes?.projectId, minutes?.title]);

  const summaryActions = useMemo(
    () => (Array.isArray(minutes?.actions) ? minutes.actions : []).map((action) => ({
      text: action.text,
      assignee: action.assignee || '미지정',
      due: formatDueDate(action.dueDate),
      status: action.checked ? 'done' : 'todo',
    })),
    [minutes]
  );

  const issueActionItems = useMemo(
    () => (Array.isArray(minutes?.actions) ? minutes.actions : [])
      .map((action) => ({
        text: String(action?.text || '').trim(),
        assignee: String(action?.assignee || '').trim() || '미지정',
        due: formatDueDate(action?.dueDate),
      }))
      .filter((item) => item.text),
    [minutes]
  );

  const selectedIssueItemsList = useMemo(
    () => [...issueCheckedItems].map((idx) => issueActionItems[idx]).filter(Boolean),
    [issueActionItems, issueCheckedItems]
  );
  const issuedIssueKeySet = useMemo(() => {
    if (!selectedIssueSvc) return new Set();
    if (selectedIssueSvc === 'both') return new Set();
    return new Set(
      mergedAuditLog
        .filter((log) => log.svcId === selectedIssueSvc)
        .map((log) => String(log.label || '').trim().toLowerCase())
        .filter(Boolean)
    );
  }, [mergedAuditLog, selectedIssueSvc]);
  const isIssueItemIssued = useCallback(
    (item) => issuedIssueKeySet.has(String(item?.text || item?.title || '').trim().toLowerCase()),
    [issuedIssueKeySet]
  );
  const issueAssigneeOptions = useMemo(
    () => buildProjectAssigneeOptions({
      projectId: minutes?.projectId,
      state: location.state,
      participants: minutes?.participants,
      actions: [
        ...(Array.isArray(minutes?.actions) ? minutes.actions : []),
        ...issueActionItems,
        ...issueIndividualDrafts,
      ],
    }),
    [issueActionItems, issueIndividualDrafts, location.state, minutes]
  );
  const selectableIssueItemIndexes = useMemo(
    () => issueActionItems.map((item, idx) => (isIssueItemIssued(item) ? null : idx)).filter((idx) => idx !== null),
    [isIssueItemIssued, issueActionItems]
  );
  const allIssueItemsSelected = selectableIssueItemIndexes.length > 0 && issueCheckedItems.size === selectableIssueItemIndexes.length;

  const toggleAllIssueItems = useCallback(() => {
    if (selectableIssueItemIndexes.length === 0) return;
    setIssueCheckedItems((prev) => {
      if (prev.size === selectableIssueItemIndexes.length) return new Set();
      return new Set(selectableIssueItemIndexes);
    });
  }, [selectableIssueItemIndexes]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = previousOverflow || '';
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAnyModalOpen]);

  useEffect(() => {
    if (openDuePickerIdx === null) return;

    const handleOutsideClick = (event) => {
      if (event.target instanceof Element && event.target.closest('[data-due-picker-root]')) return;
      setOpenDuePickerIdx(null);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openDuePickerIdx]);

  useEffect(() => {
    if (!isIssueDuePickerOpen) return;

    const handleOutsideClick = (event) => {
      if (event.target instanceof Element && event.target.closest('[data-issue-due-picker-root]')) return;
      setIsIssueDuePickerOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isIssueDuePickerOpen]);

  useEffect(() => {
    if (issueIndividualDuePickerIdx === null) return;

    const handleOutsideClick = (event) => {
      if (event.target instanceof Element && event.target.closest('[data-issue-individual-due-picker-root]')) return;
      setIssueIndividualDuePickerIdx(null);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [issueIndividualDuePickerIdx]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type }), 2200);
  }, []);

  const persistMinutes = useCallback((nextMinutes) => {
    const key = String(nextMinutes?.id || '').trim();
    if (!key) return;
    const all = readManualMeetingRecords();
    all[key] = nextMinutes;
    writeManualMeetingRecords(all);

    const projectId = String(nextMinutes?.projectId || location.state?.projectId || '').trim();
    const meetingId = String(nextMinutes?.serverMeetingId || nextMinutes?.meetingId || location.state?.meetingId || '').trim();
    if (!projectId || !meetingId) return;

    updateProjectMeeting(projectId, meetingId, {
      title: nextMinutes.title || '직접 작성 회의록',
      date: nextMinutes.date || '-',
      status: '검토대기',
      meeting_type: nextMinutes.type || '정기',
      tags: (Array.isArray(nextMinutes.keywords) ? nextMinutes.keywords : [])
        .slice(0, 12)
        .map((tag) => `#${String(tag || '').replace(/^#/, '')}`),
      participants: Array.isArray(nextMinutes.participants) ? nextMinutes.participants : [],
      summary: nextMinutes.summary || '직접 작성된 회의록입니다.',
      action_items: buildServerManualActionItems(nextMinutes),
      action_items_count: Array.isArray(nextMinutes.actions) ? nextMinutes.actions.length : 0,
    }).catch(() => {
      showToast('로컬에는 저장됐지만 서버 회의록 동기화에 실패했습니다.', 'error');
    });
  }, [location.state, showToast]);

  useEffect(() => {
    const projectId = String(minutes?.projectId || location.state?.projectId || '').trim();
    const meetingId = String(minutes?.serverMeetingId || minutes?.meetingId || location.state?.meetingId || '').trim();
    if (!projectId || !meetingId) return undefined;

    let active = true;
    listProjectMeetings(projectId)
      .then((meetings) => {
        if (!active || !Array.isArray(meetings)) return;
        const serverMeeting = meetings.find((meeting) => String(meeting?.id || '') === meetingId);
        if (!serverMeeting) return;

        setMinutes((prev) => {
          if (!prev) return prev;
          const merged = mergeMinutesWithServerMeeting(prev, serverMeeting);
          const key = String(merged?.id || '').trim();
          if (key) {
            const all = readManualMeetingRecords();
            all[key] = merged;
            writeManualMeetingRecords(all);
          }
          return merged;
        });
      })
      .catch(() => {
        if (active) showToast('서버 회의록 상태를 불러오지 못했습니다.', 'error');
      });

    return () => {
      active = false;
    };
  }, [
    minutes?.projectId,
    minutes?.serverMeetingId,
    minutes?.meetingId,
    location.state?.projectId,
    location.state?.meetingId,
    showToast,
  ]);

  const handleToggleAction = useCallback((index) => {
    setMinutes((prev) => {
      if (!prev || !Array.isArray(prev.actions)) return prev;
      const nextActions = prev.actions.map((action, idx) => {
        if (idx !== index) return action;
        return { ...action, checked: !action.checked };
      });
      const next = { ...prev, actions: nextActions };
      persistMinutes(next);
      return next;
    });

  }, [persistMinutes]);

  const backToMeetings = () => {
    const pid = String(minutes?.projectId || location.state?.projectId || '').trim();
    if (pid) {
      navigate(`/project/${pid}/meetings`);
      return;
    }
    navigate('/project-list');
  };

  const openParticipantsModal = useCallback((members = []) => {
    const normalized = Array.isArray(members) ? members.filter(Boolean) : [];
    setParticipantsModalMembers(normalized);
    setIsParticipantsModalOpen(true);
  }, []);

  const toggleSection = useCallback((key) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const openIssueModal = useCallback(() => {
    setSelectedIssueSvc('');
    setIssueCheckedItems(new Set());
    setIssueStep(1);
    setIssueMode('merged');
    const first = issueActionItems[0];
    setIssueTitle(first?.text || '');
    setIssueAssignee(first?.assignee && first.assignee !== '미지정' ? first.assignee : issueAssigneeOptions[0] || '');
    setIssueDueDate(first?.due || '미정');
    setIssueDesc('회의에서 논의된 항목입니다. 내용을 확인하고 처리해주세요.');
    setIssuePriority('보통');
    setIssueIndividualDrafts([]);
    setIsIssueDuePickerOpen(false);
    setIssueIndividualDuePickerIdx(null);
    setIssueOpen(true);
  }, [issueActionItems, issueAssigneeOptions]);

  useEffect(() => {
    if (!selectedIssueSvc) return;
    setIssueCheckedItems((prev) => {
      const next = new Set([...prev].filter((idx) => {
        const item = issueActionItems[idx];
        return item && !isIssueItemIssued(item);
      }));
      return next.size === prev.size ? prev : next;
    });
  }, [isIssueItemIssued, issueActionItems, selectedIssueSvc]);

  const goIssueStep2 = useCallback(() => {
    if (!selectedIssueSvc || issueCheckedItems.size === 0) return;
    const items = [...issueCheckedItems].map((i) => issueActionItems[i]).filter(Boolean);
    const autoTitle = items.length === 1
      ? items[0].text
      : `${items[0]?.text || '업무'} 외 ${items.length - 1}건`;
    setIssueTitle(autoTitle);
    setIssueAssignee(items.length === 1 && items[0]?.assignee !== '미지정' ? (items[0]?.assignee || '') : '');
    setIssueDueDate(items.length === 1 ? (items[0]?.due || '미정') : '미정');
    setIssueIndividualDrafts(items.map((item) => ({
      title: item.text,
      assignee: item.assignee && item.assignee !== '미지정' ? item.assignee : issueAssigneeOptions[0] || '',
      due: item.due,
    })));
    setIssueIndividualDuePickerIdx(null);
    setIssueStep(2);
  }, [issueActionItems, issueCheckedItems, issueAssigneeOptions, selectedIssueSvc]);

  const buildDraftFromMinutes = useCallback((source) => {
    const safe = source || {};
    const baseActions = Array.isArray(safe.actions) ? safe.actions : [];
    const baseDecisions = Array.isArray(safe.decisions) ? safe.decisions : [];
    const baseIssues = Array.isArray(safe.issues) ? safe.issues : [];
    return {
      keywordsInput: (Array.isArray(safe.keywords) ? safe.keywords : []).join(', '),
      summaryInput: String(safe.summary || ''),
      decisionsDraft: baseDecisions.map((item) => ({ text: item.text || '', checked: Boolean(item.checked) })),
      actionsDraft: baseActions.map((item) => ({
        text: item.text || '',
        assignee: item.assignee || '',
        dueDate: normalizeDueLabel(item.dueDate || ''),
        checked: Boolean(item.checked),
      })),
      issuesDraft: baseIssues.map((item) => ({
        text: item.text || '',
        priority: item.priority || '보통',
      })),
      nextAgendaInput: String(safe.nextAgenda || ''),
    };
  }, []);

  const beginEditMode = useCallback(() => {
    setEditDraft(buildDraftFromMinutes(minutes));
    setIsEditMode(true);
  }, [buildDraftFromMinutes, minutes]);

  const endEditMode = useCallback(() => {
    setIsEditMode(false);
  }, []);

  const handleInlineCancel = useCallback(() => {
    setEditDraft(buildDraftFromMinutes(minutes));
    setIsEditMode(false);
  }, [buildDraftFromMinutes, minutes]);

  const applyMinutesPatch = useCallback((patch, successMessage) => {
    setMinutes((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      persistMinutes(next);
      return next;
    });
    if (successMessage) {
      showToast(successMessage);
    }
  }, [persistMinutes, showToast]);

  const handleInlineDone = useCallback(() => {
    const nextKeywords = editDraft.keywordsInput
      .split(/[\n,]/)
      .map((item) => item.trim().replace(/^#/, ''))
      .filter(Boolean);

    const nextDecisions = editDraft.decisionsDraft
      .map((item) => ({ text: String(item.text || '').trim(), checked: Boolean(item.checked) }))
      .filter((item) => item.text);

    const nextActions = editDraft.actionsDraft
      .map((item) => ({
        text: String(item.text || '').trim(),
        assignee: String(item.assignee || '').trim(),
        dueDate: String(item.dueDate || '').trim(),
        checked: Boolean(item.checked),
      }))
      .filter((item) => item.text);

    const nextIssues = editDraft.issuesDraft
      .map((item) => ({
        text: String(item.text || '').trim(),
        priority: item.priority || '보통',
      }))
      .filter((item) => item.text);

    applyMinutesPatch({
      keywords: nextKeywords,
      summary: editDraft.summaryInput.trim(),
      decisions: nextDecisions,
      actions: nextActions,
      issues: nextIssues,
      nextAgenda: editDraft.nextAgendaInput.trim(),
    }, '직접 작성 회의록이 저장되었습니다.');

    setServices((prev) => prev.map((svc) => {
      if (svc.id === 'jira') {
        const tickets = (nextActions.length > 0 ? nextActions : [{ text: '해야 할 일 없음', assignee: '미지정', checked: false }]).map((item, idx) => ({
          id: `MAN-${idx + 1}`,
          title: item.text || '해야 할 일',
          assignee: item.assignee || '미지정',
          due: formatDueDate(item.dueDate),
          status: 'todo',
        }));
        return { ...svc, tickets };
      }
      if (svc.id === 'notion') {
        const tickets = (nextDecisions.length > 0 ? nextDecisions : [{ text: '결정 사항 없음', checked: false }]).map((item, idx) => ({
          id: `DOC-${idx + 1}`,
          title: item.text || '결정 사항',
          assignee: '회의록',
          status: 'progress',
        }));
        return { ...svc, tickets };
      }
      return svc;
    }));

    setIsEditMode(false);
  }, [applyMinutesPatch, editDraft]);

  const saveSummarySection = useCallback(() => {
    const nextKeywords = editDraft.keywordsInput
      .split(/[\n,]/)
      .map((item) => item.trim().replace(/^#/, ''))
      .filter(Boolean);
    applyMinutesPatch({
      keywords: nextKeywords,
      summary: editDraft.summaryInput.trim(),
    }, '협업 인사이트가 저장되었습니다.');
  }, [applyMinutesPatch, editDraft.keywordsInput, editDraft.summaryInput]);

  const saveDecisionsSection = useCallback(() => {
    const nextDecisions = editDraft.decisionsDraft
      .map((item) => ({ text: String(item.text || '').trim(), checked: Boolean(item.checked) }))
      .filter((item) => item.text);
    applyMinutesPatch({ decisions: nextDecisions }, '주요 결정이 저장되었습니다.');

    setServices((prev) => prev.map((svc) => {
      if (svc.id !== 'notion') return svc;
      const tickets = (nextDecisions.length > 0 ? nextDecisions : [{ text: '결정 사항 없음', checked: false }]).map((item, idx) => ({
        id: `DOC-${idx + 1}`,
        title: item.text || '결정 사항',
        assignee: '회의록',
        status: 'progress',
      }));
      return { ...svc, tickets };
    }));
  }, [applyMinutesPatch, editDraft.decisionsDraft]);

  const updateDecisionDraftItem = useCallback((index, key, value) => {
    setEditDraft((prev) => ({
      ...prev,
      decisionsDraft: prev.decisionsDraft.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)),
    }));
  }, []);

  const addDecisionDraftItem = useCallback(() => {
    setEditDraft((prev) => ({
      ...prev,
      decisionsDraft: [...prev.decisionsDraft, { text: '', checked: false }],
    }));
  }, []);

  const removeDecisionDraftItem = useCallback((index) => {
    setEditDraft((prev) => ({
      ...prev,
      decisionsDraft: prev.decisionsDraft.filter((_, idx) => idx !== index),
    }));
  }, []);

  const saveDecisionItem = useCallback((index, text) => {
    const nextText = String(text || '').trim();
    setMinutes((prev) => {
      if (!prev || !Array.isArray(prev.decisions)) return prev;
      const nextDecisions = prev.decisions.map((item, idx) => (idx === index ? { ...item, text: nextText || item.text } : item));
      const next = { ...prev, decisions: nextDecisions };
      persistMinutes(next);
      return next;
    });

    setServices((prev) => prev.map((svc) => {
      if (svc.id !== 'notion') return svc;
      return {
        ...svc,
        tickets: svc.tickets.map((ticket, idx) => (idx === index ? { ...ticket, title: nextText || ticket.title } : ticket)),
      };
    }));

    showToast('주요 결정이 반영되었습니다.');
  }, [persistMinutes, showToast]);

  const resetSummarySection = useCallback(() => {
    setEditDraft((prev) => ({
      ...prev,
      keywordsInput: (Array.isArray(minutes?.keywords) ? minutes.keywords : []).join(', '),
      summaryInput: String(minutes?.summary || ''),
    }));
    showToast('협업 인사이트를 초기화했습니다.');
  }, [minutes, showToast]);

  const resetDecisionsSection = useCallback(() => {
    setEditDraft((prev) => ({
      ...prev,
      decisionsDraft: (Array.isArray(minutes?.decisions) ? minutes.decisions : []).map((item) => ({ text: item.text || '', checked: Boolean(item.checked) })),
    }));
    showToast('주요 결정을 초기화했습니다.');
  }, [minutes, showToast]);

  const resetActionsSection = useCallback(() => {
    setEditDraft((prev) => ({
      ...prev,
      actionsDraft: (Array.isArray(minutes?.actions) ? minutes.actions : []).map((item) => ({
        text: item.text || '',
        assignee: item.assignee || '',
        dueDate: item.dueDate || '',
        checked: Boolean(item.checked),
      })),
    }));
    showToast('해야 할 일을 초기화했습니다.');
  }, [minutes, showToast]);

  const resetIssuesSection = useCallback(() => {
    setEditDraft((prev) => ({
      ...prev,
      issuesDraft: (Array.isArray(minutes?.issues) ? minutes.issues : []).map((item) => ({
        text: item.text || '',
        priority: item.priority || '보통',
      })),
    }));
    showToast('이슈/리스크를 초기화했습니다.');
  }, [minutes, showToast]);

  const resetNextAgendaSection = useCallback(() => {
    setEditDraft((prev) => ({
      ...prev,
      nextAgendaInput: String(minutes?.nextAgenda || ''),
    }));
    showToast('다음 안건을 초기화했습니다.');
  }, [minutes, showToast]);

  const updateActionDraftItem = useCallback((index, key, value) => {
    setEditDraft((prev) => ({
      ...prev,
      actionsDraft: prev.actionsDraft.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)),
    }));
  }, []);

  const addActionDraftItem = useCallback(() => {
    setEditDraft((prev) => ({
      ...prev,
      actionsDraft: [...prev.actionsDraft, { text: '', assignee: '', dueDate: '', checked: false }],
    }));
  }, []);

  const removeActionDraftItem = useCallback((index) => {
    setEditDraft((prev) => ({
      ...prev,
      actionsDraft: prev.actionsDraft.filter((_, idx) => idx !== index),
    }));
  }, []);

  const saveActionsSection = useCallback(() => {
    const nextActions = editDraft.actionsDraft
      .map((item) => ({
        text: String(item.text || '').trim(),
        assignee: String(item.assignee || '').trim(),
        dueDate: String(item.dueDate || '').trim(),
        checked: Boolean(item.checked),
      }))
      .filter((item) => item.text);

    applyMinutesPatch({ actions: nextActions }, '해야 할 일이 저장되었습니다.');

    setServices((prev) => prev.map((svc) => {
      if (svc.id !== 'jira') return svc;
      const tickets = (nextActions.length > 0 ? nextActions : [{ text: '해야 할 일 없음', assignee: '미지정', checked: false }]).map((item, idx) => ({
        id: `MAN-${idx + 1}`,
        title: item.text || '해야 할 일',
        assignee: item.assignee || '미지정',
        due: formatDueDate(item.dueDate),
        status: 'todo',
      }));
      return { ...svc, tickets };
    }));
  }, [applyMinutesPatch, editDraft.actionsDraft]);

  const updateIssueDraftItem = useCallback((index, key, value) => {
    setEditDraft((prev) => ({
      ...prev,
      issuesDraft: prev.issuesDraft.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)),
    }));
  }, []);

  const addIssueDraftItem = useCallback(() => {
    setEditDraft((prev) => ({
      ...prev,
      issuesDraft: [...prev.issuesDraft, { text: '', priority: '보통' }],
    }));
  }, []);

  const removeIssueDraftItem = useCallback((index) => {
    setEditDraft((prev) => ({
      ...prev,
      issuesDraft: prev.issuesDraft.filter((_, idx) => idx !== index),
    }));
  }, []);

  const saveIssuesSection = useCallback(() => {
    const nextIssues = editDraft.issuesDraft
      .map((item) => ({
        text: String(item.text || '').trim(),
        priority: item.priority || '보통',
      }))
      .filter((item) => item.text);

    applyMinutesPatch({ issues: nextIssues }, '이슈/리스크가 저장되었습니다.');
  }, [applyMinutesPatch, editDraft.issuesDraft]);

  const saveNextAgendaSection = useCallback(() => {
    applyMinutesPatch({ nextAgenda: editDraft.nextAgendaInput.trim() }, '다음 안건이 저장되었습니다.');
  }, [applyMinutesPatch, editDraft.nextAgendaInput]);

  const handleIssue = async () => {
    if (issuing) return;
    if (issueCheckedItems.size === 0) return;

    const isMultiple = issueCheckedItems.size > 1;
    if (!selectedIssueSvc) return;
    if (issueMode === 'merged' && isMultiple && !String(issueAssignee || '').trim()) return;

    setIssuing(true);
    await new Promise((resolve) => setTimeout(resolve, 900));

    const targetSvcs = selectedIssueSvc === 'both' ? ['jira', 'notion'] : [selectedIssueSvc === 'notion' ? 'notion' : 'jira'];
    const selectedTicketItemsBySvc = targetSvcs.map((targetSvc) => ({
      targetSvc,
      items: services.find((svc) => svc.id === targetSvc)?.tickets
        ?.map((ticket, idx) => ({ ...ticket, index: idx }))
        .filter((ticket) => issueCheckedItems.has(ticket.index)) || [],
    }));

    setServices((prev) =>
      prev.map((svc) => {
        if (!targetSvcs.includes(svc.id)) return svc;
        return {
          ...svc,
          tickets: svc.tickets.map((ticket, idx) => {
            if (issueCheckedItems.has(idx)) {
              return { ...ticket, status: 'done' };
            }
            return ticket;
          }),
        };
      })
    );

    const now = new Date();
    const time = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
    const nextLogs = selectedTicketItemsBySvc.flatMap(({ targetSvc, items }) => items.map((ticket) => ({
      svcId: targetSvc,
      label: ticket.title,
      time,
      user: ticket.assignee || getStoredUserName() || '담당자',
    })));
    setAuditLog((prev) => [...prev, ...nextLogs]);

    if (minutes?.projectId && minutes?.title && nextLogs.length > 0) {
      const overrides = readProjectOverrides();
      const projectId = String(minutes.projectId);
      const prevProject = overrides[projectId] && typeof overrides[projectId] === 'object' ? overrides[projectId] : {};
      const prevItems = Array.isArray(prevProject.myActionItems) ? prevProject.myActionItems : [];
      const nextItems = [...prevItems];
      selectedTicketItemsBySvc.forEach(({ targetSvc, items }) => items.forEach((ticket) => {
        const id = `${minutes.id || minutes.title}-action-${ticket.index + 1}`;
        const existingIndex = nextItems.findIndex((item) => String(item?.id || '') === id);
        const existing = existingIndex >= 0 ? nextItems[existingIndex] : {};
        const existingLinks = existing?.integrationLinks && typeof existing.integrationLinks === 'object' ? existing.integrationLinks : {};
        const externalLink = buildExternalLink(targetSvc, ticket.title);
        const persisted = {
          ...existing,
          id,
          text: ticket.title,
          title: ticket.title,
          description: minutes.summary || '',
          due: ticket.due || '',
          dueDate: ticket.due || '',
          assignee: ticket.assignee || getStoredUserName() || '담당자',
          assignees: [ticket.assignee || getStoredUserName() || '담당자'].filter(Boolean),
          status: '연동완료',
          source: minutes.title,
          projectId,
          projectName: minutes.projectName || '',
          integrationTool: targetSvc === 'notion' ? 'Notion' : 'Jira',
          integrationLinks: {
            ...existingLinks,
            [targetSvc]: externalLink,
          },
          externalLink,
          updatedAt: new Date().toISOString(),
        };
        if (existingIndex >= 0) nextItems[existingIndex] = { ...nextItems[existingIndex], ...persisted };
        else nextItems.unshift(persisted);
      }));
      overrides[projectId] = { ...prevProject, myActionItems: nextItems };
      writeProjectOverrides(overrides);
    }

    setIssuing(false);
    setIssueOpen(false);
    setIssueStep(1);
    showToast(selectedIssueSvc === 'both' ? 'Jira와 Notion에 연동되었습니다.' : selectedIssueSvc === 'jira' ? 'Jira에 연동되었습니다.' : 'Notion에 연동되었습니다.');
  };

  if (!minutes) {
    return (
      <div className="min-h-screen bg-[#F8FAFF] overflow-x-hidden pt-20 pb-20 md:pb-0 flex flex-col">
        <Header isMobile={isMobile} phase="IDLE" stateLabels={stateLabels} />
        <main className="flex-1 w-full px-4 md:px-8 py-6 md:py-8">
          <div className="max-w-3xl mx-auto rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-6 text-center">
            <h1 className="text-xl font-bold text-[#0D1B2A]">저장된 회의록을 찾을 수 없습니다.</h1>
            <p className="text-sm text-[#5A6F8A] mt-2">회의 목록으로 이동해서 다시 확인해 주세요.</p>
            <button
              type="button"
              onClick={backToMeetings}
              className="mt-5 px-4 py-2 rounded-lg bg-[#0099CC] text-white text-sm font-semibold hover:bg-[#007EA7]"
            >
              회의 목록으로 이동
            </button>
          </div>
        </main>
        {!isMobile && <Footer />}
        {isMobile && <MobileTab active={activeTab} onChange={setActiveTab} />}
      </div>
    );
  }

  const participants = Array.isArray(minutes.participants) ? minutes.participants : [];
  const adminNameSet = useMemo(() => {
    const names = new Set();
    const pid = String(minutes?.projectId || location.state?.projectId || '').trim();
    const overrides = readProjectOverrides();
    const override = pid ? overrides[pid] : null;

    [minutes?.admins, location.state?.projectAdmins, location.state?.project?.admins, override?.admins].forEach((source) => {
      if (!Array.isArray(source)) return;
      source.forEach((name) => {
        const normalized = String(name || '').trim();
        if (normalized && participants.includes(normalized)) names.add(normalized);
      });
    });

    if (names.size === 0) {
      const fallbackLead = String(
        minutes?.teamLead
          || location.state?.project?.teamLead
          || override?.teamLead
          || ''
      ).trim();
      if (fallbackLead && participants.includes(fallbackLead)) {
        names.add(fallbackLead);
      }
    }

    return names;
  }, [location.state, minutes, participants]);
  const visibleParticipants = participants.slice(0, 4);
  const hiddenCount = Math.max(participants.length - visibleParticipants.length, 0);
  const hasRichContent = Boolean(
    String(minutes.summary || '').trim() ||
      (Array.isArray(minutes.keywords) && minutes.keywords.length > 0) ||
      (Array.isArray(minutes.decisions) && minutes.decisions.length > 0) ||
      (Array.isArray(minutes.actions) && minutes.actions.length > 0) ||
      (Array.isArray(minutes.issues) && minutes.issues.length > 0) ||
      String(minutes.nextAgenda || '').trim()
  );
  const selectedIssueSvcObj = selectedIssueSvc === 'both'
    ? { id: 'both', name: 'Jira + Notion', iconBg: '#7C3AED', iconLabel: 'J+N' }
    : services.find((svc) => svc.id === selectedIssueSvc);
  const selectedIssueSvcIds = selectedIssueSvc === 'both'
    ? ['jira', 'notion']
    : selectedIssueSvc ? [selectedIssueSvc] : [];
  const toggleIssueSvc = (svcId) => {
    setSelectedIssueSvc((prev) => {
      const current = prev === 'both' ? ['jira', 'notion'] : prev ? [prev] : [];
      const next = current.includes(svcId)
        ? current.filter((id) => id !== svcId)
        : [...current, svcId];
      if (next.length === 2) return 'both';
      return next[0] || '';
    });
  };
  const canIssueNext = Boolean(selectedIssueSvc) && issueCheckedItems.size > 0;
  const issueIsMultiple = issueCheckedItems.size > 1;
  const canIssueSubmit = issueMode !== 'merged' || !issueIsMultiple || String(issueAssignee || '').trim().length > 0;
  const totalActions = Array.isArray(minutes.actions) ? minutes.actions.length : 0;
  const doneActions = Array.isArray(minutes.actions) ? minutes.actions.filter((a) => Boolean(a.checked)).length : 0;
  const editActions = Array.isArray(editDraft.actionsDraft) ? editDraft.actionsDraft.length : 0;
  const actionCountLabel = isEditMode ? `${editActions}건` : `${doneActions}/${totalActions}건`;

  return (
    <div
      className="min-h-screen"
      style={{
        background: '#F8FAFF',
        fontFamily: '"Pretendard Variable","Pretendard",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        color: '#0D1B2A',
      }}
    >
      <Header isMobile={isMobile} phase="IDLE" stateLabels={stateLabels} />

      <div className="px-4 md:px-8 lg:px-12 pt-24 pb-0 max-w-screen-xl mx-auto">
        <button type="button" onClick={backToMeetings} className="text-sm text-[#5A6F8A] hover:text-[#0D1B2A] mb-4">
          ← 돌아가기
        </button>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-400">{formatDisplayDate(minutes.date || minutes.rawDate)}</span>
                <span className="text-slate-300">·</span>
                <span className="text-xs font-semibold text-slate-400">{minutes.type || '정기'}</span>
              </div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-snug mb-3">
                {minutes.projectName ? `[${minutes.projectName}] ` : ''}
                {minutes.title}
              </h1>
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-2">
                  {visibleParticipants.map((name, idx) => (
                    <button
                      type="button"
                      key={`${name}-${idx}`}
                      onClick={() => openParticipantsModal(participants)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white"
                      style={{ background: colorForParticipant(name) }}
                      title={name}
                    >
                      {name[0] || '?'}
                    </button>
                  ))}
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => openParticipantsModal(participants)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white bg-slate-400 hover:bg-slate-500 transition-colors"
                    >
                      +{hiddenCount}
                    </button>
                  )}
                </div>
                <span className="text-xs text-slate-400">총 {participants.length}명 참여</span>
              </div>
            </div>

            <RealIntegrationStatus
              connectedProviders={connectedProviders}
              onManage={() => {
                const projectId = minutes?.projectId || location.state?.projectId || urlProjectId;
                navigate(`/configuration?projectId=${projectId}&tab=integration`);
              }}
            />
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 lg:px-12 pt-4 max-w-screen-xl mx-auto">
        <AgendaCompletionSection actions={summaryActions} onToggleAction={handleToggleAction} />
      </div>

      <div className="px-4 md:px-8 lg:px-12 py-5 max-w-screen-xl mx-auto pb-32">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-full flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
            <span className="text-sm font-bold text-slate-900">직접 작성 회의록</span>
            <div className="flex items-center gap-2">
              {isEditMode && <span className="text-[11px] font-semibold text-[#0099CC]">편집 모드</span>}
              <button
                type="button"
                onClick={() => (isEditMode ? endEditMode() : beginEditMode())}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                  isEditMode
                    ? 'border-[#0099CC]/35 bg-[#EEF3FF] text-[#0099CC]'
                    : 'border-[rgba(0,100,180,0.14)] text-[#5A6F8A] hover:bg-[#F8FAFF] hover:text-[#0D1B2A]'
                }`}
                aria-label="직접 작성 회의록 편집"
              >
                <LucideIcon name="pencil" size={14} />
              </button>
            </div>
          </div>

          <div className="px-5 py-5 space-y-6 overflow-y-auto flex-1">
            {!hasRichContent && (
              <div className="rounded-xl p-3 border border-[#FDE68A] bg-[#FFFBEB]">
                <p className="text-sm font-semibold text-[#92400E]">상세 입력 항목이 비어 있습니다.</p>
                <p className="text-xs text-[#B45309] mt-1">
                  현재는 기본 정보만 저장된 상태입니다. 직접 작성 화면에서 요약/결정/해야 할 일/이슈를 입력하면 여기 그대로 표시됩니다.
                </p>
              </div>
            )}

            {isEditMode && (
              <div
                className="mb-3 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap border"
                style={{
                  background: 'linear-gradient(180deg, rgba(0,153,204,0.07), rgba(124,58,237,0.05))',
                  borderColor: 'rgba(0,100,180,0.12)',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#0099CC,#7C3AED)' }}
                  >
                    <LucideIcon name="pencil" size={13} color="#fff" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900 leading-tight">직접 작성 회의록 수정 중</p>
                    <p className="text-[11px] text-slate-400 leading-tight">저장하면 바로 반영돼요</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleInlineCancel}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleInlineDone}
                    className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg text-white transition-all hover:-translate-y-0.5 cursor-pointer"
                    style={{ background: 'linear-gradient(135deg,#0099CC,#7C3AED)', boxShadow: '0 4px 12px rgba(0,100,180,0.18)' }}
                  >
                    <LucideIcon name="check" size={12} color="#fff" />
                    수정 완료
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-xl p-4 space-y-3 bg-blue-50 border border-blue-100">
              {isEditMode ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800">핵심 키워드 / 전체 요약</p>
                    <EditSaveButton onClick={saveSummarySection} />
                  </div>

                  <EditField label="핵심 키워드" hint="쉼표(,)로 구분해서 입력하세요">
                    <input
                      value={editDraft.keywordsInput}
                      onChange={(e) => setEditDraft((prev) => ({ ...prev, keywordsInput: e.target.value }))}
                      placeholder="예: STT 파이프라인, 화자 분리, 배포 일정"
                      className={EDIT_INPUT_CLS}
                      style={{ fontFamily: 'inherit' }}
                    />
                    {editDraft.keywordsInput.trim() && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {editDraft.keywordsInput
                          .split(/[\n,]/)
                          .map((v) => v.trim())
                          .filter(Boolean)
                          .map((k, i) => (
                            <span key={`${k}-${i}`} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                              {k}
                            </span>
                          ))}
                      </div>
                    )}
                  </EditField>

                  <EditField label="전체 요약">
                    <textarea
                      value={editDraft.summaryInput}
                      onChange={(e) => setEditDraft((prev) => ({ ...prev, summaryInput: e.target.value }))}
                      rows={4}
                      placeholder="회의 내용을 한눈에 알 수 있도록 정리해주세요"
                      className={`${EDIT_INPUT_CLS} resize-none leading-relaxed`}
                      style={{ fontFamily: 'inherit' }}
                    />
                  </EditField>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">핵심 키워드</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(Array.isArray(minutes.keywords) ? minutes.keywords : []).length > 0 ? (
                        minutes.keywords.map((word) => (
                          <span key={word} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                            {String(word).startsWith('#') ? word : `#${word}`}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">키워드가 없습니다.</span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-blue-100 pt-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">전체 요약</p>
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">{minutes.summary || '요약 내용이 없습니다.'}</p>
                  </div>
                </>
              )}
            </div>

            <Divider label="협업" />

            <section className="pt-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">주요 결정</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {isEditMode && <EditAddButton onClick={addDecisionDraftItem} label="항목 추가" />}
                  {isEditMode && <EditSaveButton onClick={saveDecisionsSection} />}
                  <span className="text-xs text-slate-300">{isEditMode ? editDraft.decisionsDraft.length : (Array.isArray(minutes.decisions) ? minutes.decisions.length : 0)}건</span>
                  <button
                    type="button"
                    onClick={() => toggleSection('decisions')}
                    className="w-7 h-7 rounded-lg text-[#5A6F8A] hover:bg-[#F8FAFF] flex items-center justify-center"
                    aria-label="주요 결정 접기/펼치기"
                  >
                    <LucideIcon name="chevron-down" size={14} className={`transition-transform ${collapsedSections.decisions ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
              {!collapsedSections.decisions && (
                <div className="space-y-2">
                  {isEditMode ? (
                    <div className="space-y-2">
                      {editDraft.decisionsDraft.length === 0 && <EditEmptyRow>아직 추가된 결정 사항이 없어요</EditEmptyRow>}
                      {editDraft.decisionsDraft.map((item, idx) => (
                        <div key={`edit-decision-${idx}`} className="flex items-center gap-2">
                          <span
                            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                            style={{ background: 'rgba(0,153,204,0.5)' }}
                          >
                            {idx + 1}
                          </span>
                          <input
                            value={item.text}
                            onChange={(e) => updateDecisionDraftItem(idx, 'text', e.target.value)}
                            className={EDIT_INPUT_CLS}
                            style={{ fontFamily: 'inherit' }}
                            placeholder={`주요 결정 ${idx + 1}`}
                          />
                          <EditRemoveButton onClick={() => removeDecisionDraftItem(idx)} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {(Array.isArray(minutes.decisions) ? minutes.decisions : []).length > 0 ? (
                        minutes.decisions.map((item, idx) => (
                          <EditableDecision key={`${item.text}-${idx}`} text={item.text} onSave={(value) => saveDecisionItem(idx, value)} />
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">등록된 결정이 없습니다.</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>

            <section className="pt-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">해야 할 일</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {isEditMode && <EditAddButton onClick={addActionDraftItem} label="항목 추가" />}
                  {isEditMode && <EditSaveButton onClick={saveActionsSection} />}
                  <span className="text-xs text-slate-300">{actionCountLabel}</span>
                  <button
                    type="button"
                    onClick={() => toggleSection('actions')}
                    className="w-7 h-7 rounded-lg text-[#5A6F8A] hover:bg-[#F8FAFF] flex items-center justify-center"
                    aria-label="해야 할 일 접기/펼치기"
                  >
                    <LucideIcon name="chevron-down" size={14} className={`transition-transform ${collapsedSections.actions ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
              {!collapsedSections.actions && (
                <div className="space-y-2">
                  {isEditMode ? (
                    <div className="space-y-2.5">
                      {editDraft.actionsDraft.length === 0 && <EditEmptyRow>아직 추가된 할 일이 없어요</EditEmptyRow>}
                      {editDraft.actionsDraft.map((item, idx) => {
                        const isDone = Boolean(item.checked);
                        return (
                          <div
                            key={`edit-action-${idx}`}
                            className="rounded-xl border p-3 space-y-2.5 transition-colors"
                            style={{
                              borderColor: isDone ? 'rgba(16,185,129,0.3)' : 'rgba(0,100,180,0.12)',
                              background: isDone ? 'rgba(16,185,129,0.05)' : '#F8FAFF',
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                value={item.text || ''}
                                onChange={(e) => updateActionDraftItem(idx, 'text', e.target.value)}
                                className={`${EDIT_INPUT_CLS} bg-white font-medium`}
                                style={{ fontFamily: 'inherit' }}
                                placeholder="할 일 내용"
                              />
                              <EditRemoveButton onClick={() => removeActionDraftItem(idx)} />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <input
                                value={item.assignee || ''}
                                onChange={(e) => updateActionDraftItem(idx, 'assignee', e.target.value)}
                                className={`${EDIT_INPUT_CLS} bg-white text-xs py-2`}
                                style={{ fontFamily: 'inherit' }}
                                placeholder="담당자"
                              />
                              <div className="relative" data-due-picker-root>
                                <button
                                  type="button"
                                  onClick={() => setOpenDuePickerIdx((prev) => (prev === idx ? null : idx))}
                                  className={`${EDIT_INPUT_CLS} bg-white text-xs py-2 text-left flex items-center justify-between gap-2 cursor-pointer`}
                                  style={{ fontFamily: 'inherit' }}
                                >
                                  <span className={`${item.dueDate ? 'text-slate-700' : 'text-slate-400'}`}>{item.dueDate || '마감일'}</span>
                                  <LucideIcon name="chevron-down" size={12} color={PROJECTLIST_CHEVRON_COLOR} strokeWidth={2} />
                                </button>
                                {openDuePickerIdx === idx && (
                                  <DueDateCalendar
                                    value={parseDueToDateStr(item.dueDate) || toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())}
                                    onSelect={(dateStr) => {
                                      updateActionDraftItem(idx, 'dueDate', formatDueFromDateStr(dateStr));
                                    }}
                                    onClose={() => setOpenDuePickerIdx(null)}
                                  />
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => updateActionDraftItem(idx, 'checked', !isDone)}
                                className="h-8 mt-3 justify-self-end px-2.5 flex items-center justify-center text-[10px] font-semibold rounded-md border transition-colors cursor-pointer whitespace-nowrap"
                                style={{
                                  borderColor: isDone ? 'rgba(16,185,129,0.4)' : 'rgba(0,100,180,0.15)',
                                  color: isDone ? '#10B981' : '#5A6F8A',
                                  background: isDone ? 'rgba(16,185,129,0.1)' : '#fff',
                                }}
                              >
                                {isDone ? '완료' : '진행 중'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <>
                      {(Array.isArray(minutes.actions) ? minutes.actions : []).length > 0 ? (
                        minutes.actions.map((item, idx) => (
                          <ActionItemCard
                            key={`${item.text}-${idx}`}
                            item={{ text: item.text, assignee: item.assignee || '미지정', due: formatDueDate(item.dueDate) }}
                            checked={Boolean(item.checked)}
                            onToggle={() => handleToggleAction(idx)}
                          />
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">등록된 해야 할 일이 없습니다.</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>

            <Divider label="인사이트" />

            <section className="pt-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">이슈 & 리스크</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {isEditMode && <EditAddButton onClick={addIssueDraftItem} label="항목 추가" />}
                  {isEditMode && <EditSaveButton onClick={saveIssuesSection} />}
                  <span className="text-xs text-slate-300">{isEditMode ? editDraft.issuesDraft.length : (Array.isArray(minutes.issues) ? minutes.issues.length : 0)}건</span>
                  <button
                    type="button"
                    onClick={() => toggleSection('issues')}
                    className="w-7 h-7 rounded-lg text-[#5A6F8A] hover:bg-[#F8FAFF] flex items-center justify-center"
                    aria-label="이슈 리스크 접기/펼치기"
                  >
                    <LucideIcon name="chevron-down" size={14} className={`transition-transform ${collapsedSections.issues ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
              {!collapsedSections.issues && (
                <div className="space-y-2">
                  {isEditMode ? (
                    <div className="space-y-2">
                      {editDraft.issuesDraft.length === 0 && <EditEmptyRow>아직 등록된 이슈가 없어요</EditEmptyRow>}
                      {editDraft.issuesDraft.map((issue, idx) => (
                        <div key={`edit-issue-${idx}`} className="flex items-center gap-2">
                          <div className="w-[92px] flex-shrink-0">
                            <CustomDropdown
                              value={issue.priority || '보통'}
                              onChange={(label) => updateIssueDraftItem(idx, 'priority', label)}
                              options={['높음', '보통', '낮음']}
                              placeholder="보통"
                              triggerStyle={
                                issue.priority === '높음'
                                  ? { background: '#FEF2F2', borderColor: '#FECACA', color: '#EF4444' }
                                  : issue.priority === '낮음'
                                  ? { background: '#F8FAFC', borderColor: '#E2E8F0', color: '#64748B' }
                                  : { background: '#FFFBEB', borderColor: '#FDE68A', color: '#D97706' }
                              }
                            />
                          </div>
                          <input
                            value={issue.text}
                            onChange={(e) => updateIssueDraftItem(idx, 'text', e.target.value)}
                            placeholder="이슈/리스크 내용"
                            className={EDIT_INPUT_CLS}
                            style={{ fontFamily: 'inherit' }}
                          />
                          <EditRemoveButton onClick={() => removeIssueDraftItem(idx)} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {(Array.isArray(minutes.issues) ? minutes.issues : []).length > 0 ? (
                        minutes.issues.map((issue, idx) => {
                          const style = ISSUE_CFG[issue.priority] || ISSUE_CFG.보통;
                          return (
                            <div key={`${issue.text}-${idx}`} className={`flex items-start gap-3 p-3 rounded-xl border ${style.card}`}>
                              <span className="flex-shrink-0 mt-0.5">
                                <LucideIcon name={style.icon} size={16} color={style.iconColor} />
                              </span>
                              <p className="flex-1 text-sm text-slate-800 leading-relaxed">{issue.text}</p>
                              <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded ${style.badge}`}>{issue.priority}</span>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-slate-500">등록된 이슈/리스크가 없습니다.</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>

            <section className="pt-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">다음 회의 안건</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {isEditMode && (
                    <>
                      <EditAddButton
                        onClick={() => setEditDraft((prev) => ({
                          ...prev,
                          nextAgendaInput: `${prev.nextAgendaInput}${prev.nextAgendaInput.trim() ? '\n' : ''}`,
                        }))}
                        label="항목 추가"
                      />
                      <EditSaveButton onClick={saveNextAgendaSection} />
                    </>
                  )}
                  <span className="text-xs text-slate-300">
                    {isEditMode
                      ? editDraft.nextAgendaInput
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean).length
                      : String(minutes.nextAgenda || '')
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean).length}
                    건
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSection('nextAgenda')}
                    className="w-7 h-7 rounded-lg text-[#5A6F8A] hover:bg-[#F8FAFF] flex items-center justify-center"
                    aria-label="다음 안건 접기/펼치기"
                  >
                    <LucideIcon name="chevron-down" size={14} className={`transition-transform ${collapsedSections.nextAgenda ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
              {!collapsedSections.nextAgenda && (
                <div className="rounded-xl p-3 space-y-2 bg-cyan-50/60 border border-cyan-100">
                  {isEditMode ? (
                    <div className="space-y-2">
                      {editDraft.nextAgendaInput
                        .split('\n')
                        .map((line) => line.trim())
                        .filter((_, idx, arr) => arr.length > 1 || String(editDraft.nextAgendaInput || '').trim() || idx === 0)
                        .map((line, idx, arr) => (
                          <div key={`agenda-edit-${idx}`} className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold bg-cyan-500 mt-2">
                              {idx + 1}
                            </span>
                            <div className="flex-1">
                              <input
                                value={line}
                                onChange={(e) => {
                                  const nextLines = [...arr];
                                  nextLines[idx] = e.target.value;
                                  setEditDraft((prev) => ({ ...prev, nextAgendaInput: nextLines.join('\n') }));
                                }}
                                className={EDIT_INPUT_CLS}
                                style={{ fontFamily: 'inherit' }}
                                placeholder={`다음 회의 안건 ${idx + 1}`}
                              />
                            </div>
                            <EditRemoveButton
                              onClick={() => {
                                const nextLines = [...arr].filter((_, lineIdx) => lineIdx !== idx);
                                setEditDraft((prev) => ({ ...prev, nextAgendaInput: nextLines.join('\n') }));
                              }}
                            />
                          </div>
                        ))}
                    </div>
                  ) : (
                    <>
                      {String(minutes.nextAgenda || '').trim() ? (
                        String(minutes.nextAgenda)
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .map((line, idx) => (
                            <div key={`${line}-${idx}`} className="flex items-start gap-2.5">
                              <span className="flex-shrink-0 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center text-white mt-0.5 bg-cyan-500" style={{ fontSize: 10 }}>
                                {idx + 1}
                              </span>
                              <p className="text-sm text-slate-800 leading-relaxed">{line}</p>
                            </div>
                          ))
                      ) : (
                        <p className="text-sm text-slate-500">다음 안건이 없습니다.</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {!isMobile && <Footer />}
      {isMobile && <MobileTab active={activeTab} onChange={setActiveTab} />}

      <ServiceDetailModal open={!!detailSvc} onClose={() => setDetailSvc(null)} svc={detailSvc} auditLog={mergedAuditLog} />

      <Modal
        open={issueOpen}
        onClose={issuing ? undefined : () => setIssueOpen(false)}
        title="업무 보내기"
        maxWidth={500}
        bodyOverflowY="auto"
        bodyHeight={isMobile ? '56vh' : '460px'}
        footer={(
          issueStep === 1 ? (
            <>
              <button
                type="button"
                onClick={() => setIssueOpen(false)}
                className="text-sm font-semibold px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={goIssueStep2}
                disabled={!canIssueNext}
                className="text-sm font-bold px-5 py-2 rounded-xl text-white transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 cursor-pointer"
                style={{ background: 'linear-gradient(135deg,#0099CC,#7C3AED)' }}
              >
                다음 →
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIssueStep(1)}
                disabled={issuing}
                className="text-sm font-semibold px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                ← 이전
              </button>
              <button
                type="button"
                onClick={handleIssue}
                disabled={issuing || !canIssueSubmit}
                className="text-sm font-bold px-5 py-2 rounded-xl text-white transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
                style={{ background: selectedIssueSvc === 'both' ? 'linear-gradient(135deg,#0099CC,#7C3AED)' : selectedIssueSvc ? SVC_ISSUE_BTN[selectedIssueSvc] : '#10B981', minWidth: 130 }}
              >
                {issuing ? (
                  <>
                    <Spinner size={13} color="#fff" />
                    <span>연동 중...</span>
                  </>
                ) : (
                  `${selectedIssueSvcObj?.name} 에 생성`
                )}
              </button>
            </>
          )
        )}
      >
        {issueStep === 1 && (
          <div
            className="mb-5 rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(0,153,204,0.05)', border: '1px solid rgba(0,153,204,0.14)' }}
          >
            <p className="text-xs font-semibold text-slate-600 leading-relaxed">
              회의에서 추출된 업무를 Jira 또는 Notion에 등록할 수 있습니다.
            </p>
          </div>
        )}

        {issueStep === 1 && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2.5">어디에 등록할까요?</p>
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
              >
                {[
                  { id: 'jira', name: 'Jira', iconBg: '#0099CC', iconLabel: 'J' },
                  { id: 'notion', name: 'Notion', iconBg: '#0D1B2A', iconLabel: 'N' },
                ].map((svc) => {
                  const selected = selectedIssueSvcIds.includes(svc.id);
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => toggleIssueSvc(svc.id)}
                      className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl border transition-all hover:-translate-y-0.5 cursor-pointer"
                      style={{
                        borderColor: selected ? '#0099CC' : 'rgba(0,100,180,0.12)',
                        background: selected ? 'rgba(0,153,204,0.06)' : '#fff',
                      }}
                    >
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                        style={{ background: svc.iconBg }}
                      >
                        {svc.iconLabel}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">{svc.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  보낼 업무 선택
                  {issueCheckedItems.size > 0 && <span className="ml-2 text-cyan-500 normal-case">({issueCheckedItems.size}개 선택됨)</span>}
                </p>
                {issueActionItems.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAllIssueItems}
                    className="shrink-0 rounded-lg border border-[rgba(0,100,180,0.12)] px-2.5 py-1 text-[11px] font-bold text-[#0099CC] transition hover:bg-[#EEF3FF]"
                  >
                    {allIssueItemsSelected ? '전체 해제' : '전체 선택'}
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {issueActionItems.length > 0 ? issueActionItems.map((item, idx) => {
                  const checked = issueCheckedItems.has(idx);
                  const alreadyIssued = selectedIssueSvc && isIssueItemIssued(item);
                  const canSelectItem = Boolean(selectedIssueSvc) && !alreadyIssued;
                  return (
                    <div
                      key={`${item.text}-${idx}`}
                      onClick={() => {
                        if (!canSelectItem) return;
                        setIssueCheckedItems((prev) => {
                          const next = new Set(prev);
                          next.has(idx) ? next.delete(idx) : next.add(idx);
                          return next;
                        });
                      }}
                      className="flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all"
                      style={{
                        borderColor: alreadyIssued ? 'rgba(16,185,129,0.28)' : checked ? 'rgba(16,185,129,0.35)' : 'rgba(0,100,180,0.12)',
                        background: alreadyIssued ? '#F3FBF7' : checked ? '#F0FDF9' : '#fff',
                        cursor: canSelectItem ? 'pointer' : 'not-allowed',
                        opacity: !selectedIssueSvc ? 0.6 : 1,
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-all border"
                        style={{
                          background: alreadyIssued || checked ? '#10B981' : 'transparent',
                          borderColor: alreadyIssued || checked ? '#10B981' : 'rgba(0,100,180,0.2)',
                        }}
                      >
                        {(alreadyIssued || checked) && <LucideIcon name="check" size={10} color="#fff" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm text-slate-800 leading-snug truncate">{item.text}</p>
                          {alreadyIssued && (
                            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              이미 연동됨
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{item.assignee} · {item.due}</p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-xl p-3 border border-[rgba(0,100,180,0.12)] bg-[#F8FAFF]">
                    <p className="text-xs text-slate-500">연동할 해야 할 일이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {issueStep === 2 && (
          <div className="space-y-4">
            <div
              className="flex rounded-xl p-1 gap-1"
              style={{ background: 'rgba(0,100,180,0.06)', border: '1px solid rgba(0,100,180,0.10)' }}
            >
              <button
                type="button"
                onClick={() => setIssueMode('merged')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                style={{
                  background: issueMode === 'merged' ? '#fff' : 'transparent',
                  color: issueMode === 'merged' ? '#0099CC' : '#5A6F8A',
                  boxShadow: issueMode === 'merged' ? '0 1px 4px rgba(0,100,180,0.12)' : 'none',
                }}
              >
                <LucideIcon name="clipboard-list" size={13} />
                하나의 업무로 등록
              </button>
              <button
                type="button"
                onClick={() => setIssueMode('individual')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                style={{
                  background: issueMode === 'individual' ? '#fff' : 'transparent',
                  color: issueMode === 'individual' ? '#7C3AED' : '#5A6F8A',
                  boxShadow: issueMode === 'individual' ? '0 1px 4px rgba(0,100,180,0.12)' : 'none',
                }}
              >
                <LucideIcon name="rows-3" size={13} />
                각각 등록
                {issueCheckedItems.size > 1 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-white font-bold" style={{ background: '#7C3AED', fontSize: 9 }}>
                    {issueCheckedItems.size}
                  </span>
                )}
              </button>
            </div>

            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(0,153,204,0.05)', border: '1px solid rgba(0,153,204,0.18)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: selectedIssueSvcObj?.iconBg, fontSize: 9 }}>
                  {selectedIssueSvcObj?.iconLabel}
                </span>
                <span className="text-xs font-bold" style={{ color: '#0099CC' }}>
                  {selectedIssueSvcObj?.name} 생성 예정 · {issueCheckedItems.size}건
                  {issueMode === 'individual' && <span className="ml-1.5 text-purple-500">→ {issueCheckedItems.size}개 업무</span>}
                </span>
              </div>
              <div className="space-y-1">
                {selectedIssueItemsList.map((item, idx) => (
                  <p key={`${item.text}-${idx}`} className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="text-cyan-400">·</span>
                    {item.text}
                    <span className="text-slate-400">({item.assignee})</span>
                  </p>
                ))}
              </div>
            </div>

            {issueMode === 'merged' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5">업무 제목</label>
                  <input
                    value={issueTitle}
                    onChange={(e) => setIssueTitle(e.target.value)}
                    disabled={issuing}
                    className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none transition-colors disabled:opacity-50"
                    style={{ borderColor: 'rgba(0,100,180,0.12)', background: '#F8FAFF', color: '#0D1B2A', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5">설명</label>
                  <textarea
                    rows={2}
                    value={issueDesc}
                    onChange={(e) => setIssueDesc(e.target.value)}
                    disabled={issuing}
                    className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none resize-none transition-colors disabled:opacity-50"
                    style={{ borderColor: 'rgba(0,100,180,0.12)', background: '#F8FAFF', color: '#0D1B2A', fontFamily: 'inherit' }}
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-400 block mb-1.5">담당자</label>
                    <CustomDropdown
                      value={issueAssignee}
                      onChange={setIssueAssignee}
                      options={issueAssigneeOptions}
                      placeholder="담당자 선택"
                      disabled={issuing}
                      hasError={issueIsMultiple && !issueAssignee}
                    />
                    {issueIsMultiple && (
                      <p className="text-xs mt-1" style={{ color: '#EF4444' }}>* 통합 발행 시 대표 담당자를 선택해주세요.</p>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-400 block mb-1.5">우선순위</label>
                    <CustomDropdown
                      value={issuePriority}
                      onChange={setIssuePriority}
                      options={['높음', '보통', '낮음']}
                      placeholder="우선순위 선택"
                      disabled={issuing}
                    />
                  </div>
                </div>
                <div className="relative" data-issue-due-picker-root>
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5">마감일</label>
                  <button
                    type="button"
                    onClick={() => !issuing && setIsIssueDuePickerOpen((prev) => !prev)}
                    disabled={issuing}
                    className="w-full text-sm px-3 py-2.5 rounded-lg border outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-left flex items-center justify-between gap-2"
                    style={{ borderColor: 'rgba(0,100,180,0.12)', background: '#F8FAFF', color: '#0D1B2A', fontFamily: 'inherit' }}
                  >
                    <span className={`${issueDueDate && issueDueDate !== '미정' ? 'text-slate-700' : 'text-slate-400'}`}>
                      {issueDueDate || '마감일'}
                    </span>
                    <LucideIcon name="chevron-down" size={14} color={PROJECTLIST_CHEVRON_COLOR} strokeWidth={2} />
                  </button>
                  {isIssueDuePickerOpen && (
                    <DueDateCalendar
                      value={parseDueToDateStr(issueDueDate) || toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())}
                      onSelect={(dateStr) => {
                        setIssueDueDate(formatDueFromDateStr(dateStr) || '미정');
                      }}
                      onClose={() => setIsIssueDuePickerOpen(false)}
                      placement="top"
                    />
                  )}
                </div>
              </div>
            )}

            {issueMode === 'individual' && (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-0.5">
                <p className="text-xs text-slate-400 leading-relaxed">각 항목의 제목과 담당자를 확인하세요. 수정 후 한 번에 발행됩니다.</p>
                {(issueIndividualDrafts.length > 0 ? issueIndividualDrafts : selectedIssueItemsList).map((item, idx) => (
                  <div
                    key={`${item.title || item.text}-${idx}`}
                    className="rounded-xl border p-3 space-y-2.5"
                    style={{ borderColor: 'rgba(0,100,180,0.12)', background: 'rgba(248,250,255,0.8)' }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg,#0099CC,#7C3AED)', fontSize: 10 }}>
                        {idx + 1}
                      </span>
                      <p className="text-xs font-semibold text-slate-500 truncate flex-1">{item.title || item.text}</p>
                      <span className="text-xs text-slate-400 flex-shrink-0">{item.due}</span>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">업무 제목</label>
                      <input
                        value={item.title || ''}
                        onChange={(e) => {
                          setIssueIndividualDrafts((prev) => prev.map((draft, i) => (i === idx ? { ...draft, title: e.target.value } : draft)));
                        }}
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none transition-colors"
                        style={{ borderColor: 'rgba(0,100,180,0.12)', background: '#fff', color: '#0D1B2A', fontFamily: 'inherit' }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">담당자</label>
                      <CustomDropdown
                        value={item.assignee}
                        onChange={(nextAssignee) => {
                          setIssueIndividualDrafts((prev) => prev.map((draft, i) => (i === idx ? { ...draft, assignee: nextAssignee } : draft)));
                        }}
                        options={issueAssigneeOptions}
                        placeholder="담당자 선택"
                      />
                    </div>
                    <div className="relative" data-issue-individual-due-picker-root>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">마감일</label>
                      <button
                        type="button"
                        onClick={() => setIssueIndividualDuePickerIdx((prev) => (prev === idx ? null : idx))}
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none transition-colors cursor-pointer text-left flex items-center justify-between gap-2"
                        style={{ borderColor: 'rgba(0,100,180,0.12)', background: '#fff', color: '#0D1B2A', fontFamily: 'inherit' }}
                      >
                        <span className={`${item.due && item.due !== '미정' ? 'text-slate-700' : 'text-slate-400'}`}>
                          {item.due || '마감일'}
                        </span>
                        <LucideIcon name="chevron-down" size={12} color={PROJECTLIST_CHEVRON_COLOR} strokeWidth={2} />
                      </button>
                      {issueIndividualDuePickerIdx === idx && (
                        <DueDateCalendar
                          value={parseDueToDateStr(item.due) || toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())}
                          onSelect={(dateStr) => {
                            const nextDue = formatDueFromDateStr(dateStr) || '미정';
                            setIssueIndividualDrafts((prev) => prev.map((draft, i) => (i === idx ? { ...draft, due: nextDue } : draft)));
                          }}
                          onClose={() => setIssueIndividualDuePickerIdx(null)}
                          placement="top"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {isParticipantsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
          <div
            className="absolute inset-0 bg-[#0D1B2A]/40 backdrop-blur-[2px]"
            onClick={() => setIsParticipantsModalOpen(false)}
          />
          <div
            className="relative w-full max-w-sm rounded-3xl border border-[rgba(0,100,180,0.12)] bg-white shadow-2xl overflow-hidden"
            style={{ maxHeight: isMobile ? '72vh' : '80vh' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-bold text-slate-900">회의 참여자</p>
              <button
                type="button"
                onClick={() => setIsParticipantsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="참여자 팝업 닫기"
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto">
              <p className="text-xs text-slate-400 mb-2">총 {participantsModalMembers.length}명 참여</p>
              <div className="space-y-2 pr-1">
                {participantsModalMembers.length > 0 ? (
                  participantsModalMembers.map((name, idx) => {
                    const isAdmin = adminNameSet.has(name);
                    return (
                    <div
                      key={`${name}-${idx}`}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                        style={{ backgroundColor: colorForParticipant(name) }}
                      >
                        {String(name || '?').slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
                          {isAdmin && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 bg-sky-50 text-sky-600 text-[10px] font-bold">
                              <LucideIcon name="shield" size={9} />
                              관리자
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">포지션 미설정</p>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-600">참여 중</span>
                    </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-[#7C8EA6]">참여자 정보가 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastPopup show={toast.show} message={toast.message} type={toast.type} />
    </div>
  );
}
