import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MobileTab from '../components/MobileTab';
import {
  connectProjectIntegration,
  createProjectMeeting,
  disconnectProjectIntegration,
  getProject,
  getProjectIntegrations,
  inviteProjectMember,
  listJiraProjects,
  removeProjectMember,
  setJiraProject,
  syncProjectIntegrationMeetings,
  updateProject,
  updateProjectMeeting,
  updateProjectMember,
} from '../api/apiClient';

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

const MEETING_TEMPLATE_OPTIONS = [
  { value: 'basic', label: '기본 회의록', description: '가장 일반적인 회의록 형식' },
  { value: 'sprint', label: '스프린트 회의', description: '스프린트 점검에 적합한 형식' },
  { value: 'design', label: '디자인 리뷰', description: '디자인 리뷰에 맞춘 형식' },
  { value: 'planning', label: '기획 회의', description: '기획/의사결정 중심 형식' },
  { value: 'marketing', label: '마케팅 회의', description: '캠페인/성과 정리에 적합' },
];

const VISIBILITY_OPTIONS = [
  { value: 'private', label: '개인' },
  { value: 'members', label: '구성원만' },
  { value: 'org', label: '전체보기' },
];

const avatarPalette = ['bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-indigo-500'];

const PROJECT_OVERRIDE_STORAGE_KEY = 'tiki_project_overrides';
const MANUAL_MEETING_RECORDS_KEY = 'tiki_manual_minutes_records';


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

const localMeetingToPayload = (meeting = {}) => {
  const actions = Array.isArray(meeting.action_items)
    ? meeting.action_items
    : Array.isArray(meeting.actionItemsList)
      ? meeting.actionItemsList
      : Array.isArray(meeting.actions)
        ? meeting.actions
        : [];
  const actionItems = actions
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => ({
      id: item.id || item.task_id || `${meeting.id || 'local'}-task-${index + 1}`,
      title: item.title || item.text || item.name || '업무',
      text: item.text || item.title || item.name || '업무',
      description: item.description || item.detail || '',
      assignee: item.assignee || item.owner || '',
      due: item.due || item.due_at || item.dueDate || '',
      status: item.status || '검토대기',
      priority: item.priority || '',
    }));

  const decisions = Array.isArray(meeting.decisions)
    ? meeting.decisions.map((item) => (typeof item === 'string' ? item : item?.text)).filter(Boolean)
    : [];
  const issues = Array.isArray(meeting.issues)
    ? meeting.issues.map((item) => (typeof item === 'string' ? item : item?.text)).filter(Boolean)
    : [];
  const extraSections = [
    decisions.length ? `\n\n주요 결정\n${decisions.map((item) => `- ${item}`).join('\n')}` : '',
    issues.length ? `\n\n이슈 및 리스크\n${issues.map((item) => `- ${item}`).join('\n')}` : '',
    meeting.nextAgenda ? `\n\n다음 회의 안건\n${meeting.nextAgenda}` : '',
  ].join('');

  return {
    title: String(meeting.title || meeting.name || '회의록').trim(),
    date: String(meeting.date || meeting.meeting_date || meeting.createdAt || new Date().toISOString().slice(0, 10)).slice(0, 20),
    round_number: Number(meeting.round_number || meeting.roundNumber || 1),
    status: meeting.status || '진행 중',
    meeting_type: meeting.meeting_type || meeting.type || '정기',
    tags: Array.isArray(meeting.tags) ? meeting.tags.map(String) : [],
    participants: Array.isArray(meeting.participants) ? meeting.participants.map(String) : [],
    summary: `${meeting.summary || meeting.fullSummary || meeting.content || ''}${extraSections}`,
    action_items: actionItems,
    action_items_count: actionItems.length,
  };
};

const mergeActionItemsIntoMeetingPayload = (payload, actionItems = []) => {
  const existing = Array.isArray(payload.action_items) ? [...payload.action_items] : [];
  const seen = new Set(existing.map((item) => String(item?.id || item?.title || item?.text || '').trim()).filter(Boolean));
  actionItems.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const title = String(item.title || item.text || '').trim();
    if (!title) return;
    const key = String(item.id || title).trim();
    if (seen.has(key)) return;
    seen.add(key);
    existing.push({
      id: item.id || `${payload.title}-action-${index + 1}`,
      title,
      text: item.text || title,
      description: item.description || '',
      assignee: item.assignee || '',
      due: item.due || item.dueDate || item.due_at || '',
      status: item.status || '검토대기',
      priority: item.priority || '',
    });
  });
  return {
    ...payload,
    action_items: existing,
    action_items_count: existing.length,
  };
};

const avatarColor = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash += name.charCodeAt(i);
  return avatarPalette[hash % avatarPalette.length];
};

const memberDisplayName = (member) => member?.name || member?.email || '';

const projectParticipants = (project) => {
  if (Array.isArray(project?.members)) {
    return project.members
      .filter((member) => !member?.invite_status || member.invite_status === 'accepted')
      .map((member) => ({
        id: member?.id ?? null,
        name: memberDisplayName(member),
        role: member?.role === 'admin' ? 'admin' : 'member',
      }))
      .filter((participant) => participant.name);
  }
  return Array.isArray(project?.participants)
    ? project.participants
        .map((entry) => (typeof entry === 'string' ? { id: null, name: entry, role: 'member' } : entry))
        .filter((participant) => participant?.name)
    : [];
};

const inviteStatusMeta = {
  pending: { label: '승인 대기', className: 'bg-amber-50 text-amber-700' },
  accepted: { label: '승인 완료', className: 'bg-emerald-50 text-emerald-700' },
  declined: { label: '거절됨', className: 'bg-red-50 text-red-600' },
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
  const stateProject = location.state?.project || null;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const projectIdFromQuery = searchParams.get('projectId') || searchParams.get('project_id') || '';
  const oauthProviderFromQuery = searchParams.has('jira') ? 'jira' : searchParams.has('notion') ? 'notion' : '';
  const oauthStatusFromQuery = oauthProviderFromQuery ? searchParams.get(oauthProviderFromQuery) : '';
  const tabFromQuery = searchParams.get('tab') || '';

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState('settings');
  const [settingsTab, setSettingsTab] = useState(() => (oauthProviderFromQuery || tabFromQuery === 'integration' ? 'integration' : 'basic'));
  const [resolvedProject, setResolvedProject] = useState(stateProject);
  const [isResolvingProject, setIsResolvingProject] = useState(Boolean(projectIdFromQuery && !stateProject?.id));
  const selectedProject = resolvedProject || stateProject;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const buildInitialState = (project) => ({
    projectName: project?.name || '',
    projectPurpose: project?.description || '',
    meetingTemplate: 'basic',
    projectVisibility: 'project',
    participants: projectParticipants(project),
    jiraDomain: '',
    jiraEmail: '',
    jiraToken: '',
    notionDbId: '',
    notionToken: '',
  });

  const [formData, setFormData] = useState(() => buildInitialState(selectedProject));
  const [status, setStatus] = useState({ jira: 'disconnected', notion: 'disconnected' });
  const [integrationStatus, setIntegrationStatus] = useState({
    jira: { connected: false, status: 'disconnected' },
    notion: { connected: false, status: 'disconnected' },
  });
  const [integrationLoading, setIntegrationLoading] = useState({ jira: false, notion: false });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [integrationSyncing, setIntegrationSyncing] = useState({ jira: false, notion: false });
  const [jiraProjectOptions, setJiraProjectOptions] = useState([]);
  const [jiraProjectLoading, setJiraProjectLoading] = useState(false);
  const [jiraProjectSaving, setJiraProjectSaving] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const toastTimerRef = useRef(null);
  const [guideModal, setGuideModal] = useState(null);
  const [showGuideDetails, setShowGuideDetails] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [sentInvitations, setSentInvitations] = useState([]);
  const [adminNames, setAdminNames] = useState([]);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [templateMenuDirection, setTemplateMenuDirection] = useState('down');
  const [templateMenuMaxHeight, setTemplateMenuMaxHeight] = useState(320);
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);
  const templateMenuRef = useRef(null);
  const visibilityMenuRef = useRef(null);
  const oauthToastShownRef = useRef('');
  const currentToastVariant = TOAST_VARIANTS[toast.type] || TOAST_VARIANTS.info;

  const refreshIntegrationStatus = async (projectId = selectedProject?.id) => {
    if (!projectId) return;
    try {
      const next = await getProjectIntegrations(projectId);
      setIntegrationStatus({
        jira: next?.jira || { connected: false, status: 'disconnected' },
        notion: next?.notion || { connected: false, status: 'disconnected' },
      });
      setStatus({
        jira: next?.jira?.connected ? 'connected' : 'disconnected',
        notion: next?.notion?.connected ? 'connected' : 'disconnected',
      });
    } catch (err) {
      showToast(err?.message || '외부 연동 상태를 불러오지 못했습니다.', 'error');
    }
  };

  const buildInitialAdminNames = (project, participants) => {
    // Backend ProjectMember.role is now the source of truth when available.
    const fromRole = participants.filter((p) => p.role === 'admin').map((p) => p.name);
    if (fromRole.length > 0) {
      return [...new Set(fromRole)];
    }

    const names = participants.map((p) => p.name);
    const fromProject = Array.isArray(project?.admins)
      ? project.admins.filter((name) => names.includes(name))
      : [];

    if (fromProject.length > 0) {
      return [...new Set(fromProject)];
    }

    if (project?.teamLead && names.includes(project.teamLead)) {
      return [project.teamLead];
    }

    return names[0] ? [names[0]] : [];
  };

  useEffect(() => {
    if (stateProject?.id) {
      setResolvedProject(stateProject);
    }
  }, [stateProject?.id]);

  useEffect(() => {
    if (!projectIdFromQuery) return;
    if (selectedProject?.id === projectIdFromQuery) {
      setIsResolvingProject(false);
      return;
    }

    let cancelled = false;
    setIsResolvingProject(true);
    getProject(projectIdFromQuery)
      .then((project) => {
        if (cancelled) return;
        setResolvedProject(project);
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedProject(null);
      })
      .finally(() => {
        if (!cancelled) setIsResolvingProject(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectIdFromQuery, selectedProject?.id]);

  useEffect(() => {
    if (!oauthProviderFromQuery) return;
    setSettingsTab('integration');

    const providerLabel = oauthProviderFromQuery === 'jira' ? 'Jira' : 'Notion';
    const toastKey = `${projectIdFromQuery}:${oauthProviderFromQuery}:${oauthStatusFromQuery}`;
    if (oauthToastShownRef.current !== toastKey) {
      oauthToastShownRef.current = toastKey;
      if (oauthStatusFromQuery === 'connected') {
        showToast(`${providerLabel} 연동이 완료되었습니다.`, 'success');
      } else if (oauthStatusFromQuery === 'failed') {
        showToast(`${providerLabel} 연동에 실패했습니다. 다시 시도해 주세요.`, 'error');
      }
    }

    const projectId = selectedProject?.id || projectIdFromQuery;
    if (projectId) {
      refreshIntegrationStatus(projectId);
    }
  }, [oauthProviderFromQuery, oauthStatusFromQuery, projectIdFromQuery, selectedProject?.id]);

  useEffect(() => {
    setFormData(buildInitialState(selectedProject));
    setInviteQuery('');
    const initialParticipants = projectParticipants(selectedProject);
    setAdminNames(buildInitialAdminNames(selectedProject, initialParticipants));
  }, [selectedProject]);

  useEffect(() => {
    if (!selectedProject?.id) return;
    refreshIntegrationStatus(selectedProject.id);
  }, [selectedProject?.id]);

  useEffect(() => {
    const projectId = selectedProject?.id;
    if (!projectId) {
      setSentInvitations([]);
      return;
    }

    let cancelled = false;
    getProject(projectId)
      .then((project) => {
        if (cancelled) return;
        if (project?.id) {
          setResolvedProject(project);
        }
        const participants = projectParticipants(project);
        setFormData((prev) => ({
          ...prev,
          projectName: project?.name || prev.projectName,
          projectPurpose: project?.description || prev.projectPurpose,
          meetingTemplate: project?.meeting_template || prev.meetingTemplate,
          projectVisibility: project?.visibility || prev.projectVisibility,
          participants,
        }));
        setAdminNames(buildInitialAdminNames(selectedProject, participants));
        setSentInvitations(Array.isArray(project?.members) ? project.members : []);
      })
      .catch(() => {
        setSentInvitations([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(event.target)) {
        setTemplateMenuOpen(false);
      }
      if (visibilityMenuRef.current && !visibilityMenuRef.current.contains(event.target)) {
        setVisibilityMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setTemplateMenuOpen(false);
        setVisibilityMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
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

  const handleConnectIntegration = async (provider) => {
    if (!selectedProject?.id) {
      showToast('프로젝트 정보가 없습니다.', 'error');
      return;
    }
    setIntegrationLoading((prev) => ({ ...prev, [provider]: true }));
    try {
      const result = await connectProjectIntegration(selectedProject.id, provider);
      if (result?.authorization_url) {
        window.location.href = result.authorization_url;
        return;
      }
      showToast('OAuth 연결 URL을 받지 못했습니다.', 'error');
    } catch (err) {
      showToast(err?.message || '외부 연동을 시작하지 못했습니다.', 'error');
    } finally {
      setIntegrationLoading((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const handleDisconnectIntegration = async (provider) => {
    if (!selectedProject?.id) return;
    setIntegrationLoading((prev) => ({ ...prev, [provider]: true }));
    try {
      await disconnectProjectIntegration(selectedProject.id, provider);
      await refreshIntegrationStatus(selectedProject.id);
      showToast(`${provider === 'jira' ? 'Jira' : 'Notion'} 연동을 해제했습니다.`, 'success');
    } catch (err) {
      showToast(err?.message || '연동 해제에 실패했습니다.', 'error');
    } finally {
      setIntegrationLoading((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const handleLoadJiraProjects = async () => {
    if (!selectedProject?.id) return;
    setJiraProjectLoading(true);
    try {
      const options = await listJiraProjects(selectedProject.id);
      setJiraProjectOptions(Array.isArray(options) ? options : []);
    } catch (err) {
      showToast(err?.message || 'Jira 프로젝트 목록을 불러오지 못했습니다.', 'error');
    } finally {
      setJiraProjectLoading(false);
    }
  };

  const handleSelectJiraProject = async (key) => {
    const option = jiraProjectOptions.find((item) => item.key === key);
    if (!option || !selectedProject?.id) return;
    setJiraProjectSaving(true);
    try {
      await setJiraProject(selectedProject.id, { key: option.key, name: option.name });
      await refreshIntegrationStatus(selectedProject.id);
      showToast(`Jira 프로젝트를 "${option.name}"(으)로 설정했습니다.`, 'success');
    } catch (err) {
      showToast(err?.message || 'Jira 프로젝트 설정에 실패했습니다.', 'error');
    } finally {
      setJiraProjectSaving(false);
    }
  };

  useEffect(() => {
    if (integrationStatus.jira.connected && jiraProjectOptions.length === 0 && !jiraProjectLoading) {
      handleLoadJiraProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationStatus.jira.connected, selectedProject?.id]);

  const syncLocalMeetingsToBackend = async () => {
    const projectId = selectedProject?.id;
    if (!projectId) return 0;
    const override = readProjectOverrides()[String(projectId)] || {};
    const manualRecords = Object.values(readManualMeetingRecords()).filter((record) => String(record?.projectId || '') === String(projectId));
    const projectActionItems = [
      ...(Array.isArray(stateProject?.myActionItems) ? stateProject.myActionItems : []),
      ...(Array.isArray(selectedProject?.myActionItems) ? selectedProject.myActionItems : []),
      ...(Array.isArray(override?.myActionItems) ? override.myActionItems : []),
    ];
    const sources = [
      ...(Array.isArray(stateProject?.meetings) ? stateProject.meetings : []),
      ...(Array.isArray(selectedProject?.meetings) ? selectedProject.meetings : []),
      ...(Array.isArray(override?.meetings) ? override.meetings : []),
      ...manualRecords,
    ];
    const localMeetings = [];
    const seenLocal = new Set();
    sources.forEach((meeting) => {
      let payload = localMeetingToPayload(meeting);
      const relatedActions = projectActionItems.filter((item) => {
        const source = String(item?.source || item?.meetingTitle || item?.meeting || '').trim();
        return source && source === payload.title;
      });
      payload = mergeActionItemsIntoMeetingPayload(payload, relatedActions);
      const key = `${payload.title.trim()}::${payload.date}`;
      if (!payload.title.trim() || seenLocal.has(key)) return;
      seenLocal.add(key);
      localMeetings.push(payload);
    });
    if (localMeetings.length === 0) return 0;

    let backendProject = null;
    try {
      backendProject = await getProject(projectId);
    } catch {
      backendProject = null;
    }
    const backendMeetings = Array.isArray(backendProject?.meetings) ? backendProject.meetings : [];
    const existing = new Map(backendMeetings.map((meeting) => [`${String(meeting.title || '').trim()}::${String(meeting.date || '').slice(0, 20)}`, meeting]));
    let changed = 0;
    for (const payload of localMeetings) {
      const key = `${payload.title.trim()}::${payload.date}`;
      const existingMeeting = existing.get(key);
      if (existingMeeting?.id) {
        const existingSummaryLength = String(existingMeeting.summary || '').length;
        const nextSummaryLength = String(payload.summary || '').length;
        const existingActions = Array.isArray(existingMeeting.action_items) ? existingMeeting.action_items.length : 0;
        const nextActions = Array.isArray(payload.action_items) ? payload.action_items.length : 0;
        if (nextSummaryLength > existingSummaryLength || nextActions > existingActions) {
          await updateProjectMeeting(projectId, existingMeeting.id, payload);
          changed += 1;
        }
        continue;
      }
      const createdMeeting = await createProjectMeeting(projectId, payload);
      existing.set(key, createdMeeting || payload);
      changed += 1;
    }
    if (changed > 0) {
      const refreshed = await getProject(projectId);
      if (refreshed?.id) setResolvedProject(refreshed);
    }
    return changed;
  };

  const handleSyncExistingMeetings = async (provider) => {
    if (!selectedProject?.id) {
      showToast('프로젝트 정보가 없습니다.', 'error');
      return;
    }
    setIntegrationSyncing((prev) => ({ ...prev, [provider]: true }));
    try {
      await syncLocalMeetingsToBackend();
      const result = await syncProjectIntegrationMeetings(selectedProject.id, provider);
      await refreshIntegrationStatus(selectedProject.id);
      const providerLabel = provider === 'jira' ? 'Jira' : 'Notion';
      const total = result?.total || 0;
      const synced = result?.synced || 0;
      const failed = result?.failed || 0;
      const firstError = Array.isArray(result?.errors) ? result.errors.find((item) => item?.message)?.message : '';
      if (total === 0) {
        showToast('백엔드에 저장된 회의록이 없습니다. 회의록을 다시 생성하면 동기화할 수 있습니다.', 'error');
      } else if (failed > 0) {
        showToast(`${providerLabel} 동기화 ${synced}/${total}건 완료, ${failed}건 실패${firstError ? `: ${firstError}` : ''}`, 'error');
      } else {
        showToast(`${providerLabel} 기존 회의록 동기화 완료: ${synced}/${total}건`, 'success');
      }
    } catch (err) {
      showToast(err?.message || '기존 회의록 동기화에 실패했습니다.', 'error');
    } finally {
      setIntegrationSyncing((prev) => ({ ...prev, [provider]: false }));
    }
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

  const matchedMembers = useMemo(() => [], []);

  const inviteMember = async () => {
    const email = inviteQuery.trim().toLowerCase();
    if (!email || !email.includes('@')) return;

    const projectId = selectedProject?.id;
    if (!projectId) {
      showToast('프로젝트 정보가 없습니다.', 'error');
      return;
    }

    try {
      const invitation = await inviteProjectMember(projectId, { email, role: 'member' });
      setSentInvitations((prev) => [invitation, ...prev.filter((item) => item.id !== invitation.id)]);
      setInviteQuery('');
      window.dispatchEvent(new Event('tiki-invitations-changed'));
      showToast(`초대 완료: ${email}`, 'success');
    } catch (err) {
      showToast(err?.message || '초대에 실패했습니다.', 'error');
    }
  };

  const removeParticipant = async (participant) => {
    if (adminNames.includes(participant.name)) return;
    const projectId = selectedProject?.id;

    if (projectId && participant.id) {
      try {
        await removeProjectMember(projectId, participant.id);
      } catch (err) {
        showToast(err?.message || '참여자 삭제에 실패했습니다.', 'error');
        return;
      }
    }

    setFormData((prev) => ({
      ...prev,
      participants: prev.participants.filter((item) => item.name !== participant.name),
    }));
    showToast(`${participant.name}님을 프로젝트에서 제외했습니다.`, 'success');
  };

  const toggleAdminRole = async (participant) => {
    if (!formData.participants.some((item) => item.name === participant.name)) return;
    const isCurrentlyAdmin = adminNames.includes(participant.name);
    if (isCurrentlyAdmin && adminNames.length <= 1) return;
    const nextRole = isCurrentlyAdmin ? 'member' : 'admin';

    const projectId = selectedProject?.id;
    if (projectId && participant.id) {
      try {
        await updateProjectMember(projectId, participant.id, { role: nextRole });
      } catch (err) {
        showToast(err?.message || '권한 변경에 실패했습니다.', 'error');
        return;
      }
    }

    setFormData((prev) => ({
      ...prev,
      participants: prev.participants.map((item) =>
        item.name === participant.name ? { ...item, role: nextRole } : item
      ),
    }));
    setAdminNames((prev) =>
      nextRole === 'admin' ? [...new Set([...prev, participant.name])] : prev.filter((item) => item !== participant.name)
    );
  };

  const openGuideModal = (type) => {
    setGuideModal(type);
    setShowGuideDetails(false);
  };

  const handleSaveSettings = async () => {
    if (!selectedProject?.id) {
      showToast('프로젝트 정보를 찾을 수 없어 저장할 수 없습니다.', 'error');
      return;
    }

    const participants = [...new Set(formData.participants.map((p) => String(p?.name || '').trim()).filter(Boolean))];
    const resolvedAdmins = adminNames.filter((name) => participants.includes(name));
    if (resolvedAdmins.length === 0 && participants[0]) {
      resolvedAdmins.push(participants[0]);
    }

    const nextProject = {
      ...selectedProject,
      name: formData.projectName.trim() || selectedProject.name,
      description: formData.projectPurpose.trim(),
      meetingTemplate: formData.meetingTemplate,
      visibility: formData.projectVisibility,
      participants,
      admins: resolvedAdmins,
      teamLead: resolvedAdmins[0] || selectedProject.teamLead || participants[0] || '담당자',
      jiraDomain: formData.jiraDomain.trim(),
      jiraEmail: formData.jiraEmail.trim(),
      notionDbId: formData.notionDbId.trim(),
    };

    setIsSavingSettings(true);
    try {
      // name/description/visibility/meeting_template/jira/notion metadata are real
      // Project columns on the backend — persist them there instead of only locally.
      const updated = await updateProject(selectedProject.id, {
        name: nextProject.name,
        description: nextProject.description,
        visibility: nextProject.visibility,
        meeting_template: nextProject.meetingTemplate,
        jira_domain: nextProject.jiraDomain || null,
        jira_email: nextProject.jiraEmail || null,
        notion_database_id: nextProject.notionDbId || null,
      });
      if (updated?.id) setResolvedProject(updated);
      // participants/admins/teamLead have no backend column yet (see project_service.py) —
      // keep them in the local override until member-role management ships server-side.
      // Never carry `meetings`/`members` snapshots into the override: other pages merge
      // {...freshServerData, ...override}, so a stale collection captured here would
      // permanently shadow real updates (new meetings, status changes) made afterward.
      const { meetings: _meetings, members: _members, ...overridePayload } = nextProject;
      writeProjectOverride(selectedProject.id, overridePayload);
      showToast('설정이 저장되었습니다.', 'success');
    } catch (err) {
      showToast(err?.message || '설정 저장에 실패했습니다.', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const goBack = () => {
    navigate('/project-list');
  };

  const templateLabel = MEETING_TEMPLATE_OPTIONS.find((item) => item.value === formData.meetingTemplate)?.label || '기본 회의록';
  const visibilityLabel = VISIBILITY_OPTIONS.find((item) => item.value === formData.projectVisibility)?.label || '프로젝트 참여자';

  const stateLabels = {
    IDLE: '대기 중',
    UPLOADING: '업로드 중',
    PROCESSING: 'AI 분석 중',
    COMPLETED: '분석 완료',
    FAILED: '오류 발생',
  };

  const settingsTabs = [
    { id: 'basic', title: '기본정보 수정', icon: 'sliders' },
    { id: 'access', title: '공개범위', icon: 'shield' },
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

            {isResolvingProject && (
              <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3.5 text-sm font-semibold text-sky-700">
                프로젝트 연동 정보를 불러오는 중입니다.
              </div>
            )}

            {!selectedProject && !isResolvingProject && (
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
                    <p className="mt-1 text-sm text-slate-500">프로젝트의 핵심 정보와 회의 기본 형식을 정합니다.</p>
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
                      <label className={labelClass}>프로젝트 설명</label>
                      <textarea
                        rows={4}
                        value={formData.projectPurpose}
                        placeholder="이 프로젝트가 어떤 목적을 가지고 있는지 간단히 적어주세요"
                        className={`${inputClass} resize-none`}
                        onChange={(e) => updateField('projectPurpose', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>기본 회의 템플릿</label>
                      <div ref={templateMenuRef} className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            const nextOpen = !templateMenuOpen;
                            if (nextOpen) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const viewportPadding = 12;
                              const isMobileViewport = window.innerWidth < 768;
                              const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
                              const spaceAbove = rect.top - viewportPadding;

                              const shouldOpenUp = isMobileViewport
                                ? spaceAbove >= spaceBelow
                                : spaceBelow < 300 && spaceAbove > spaceBelow;

                              const direction = shouldOpenUp ? 'up' : 'down';
                              const availableSpace = Math.max(180, direction === 'up' ? spaceAbove : spaceBelow);
                              const maxHeight = isMobileViewport
                                ? Math.min(availableSpace, Math.floor(window.innerHeight * 0.55))
                                : Math.min(availableSpace, 320);

                              setTemplateMenuDirection(direction);
                              setTemplateMenuMaxHeight(maxHeight);
                            }
                            setTemplateMenuOpen(nextOpen);
                          }}
                          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-800 transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
                          aria-haspopup="listbox"
                          aria-expanded={templateMenuOpen}
                        >
                          <div className="min-w-0">
                            <span className="block truncate font-medium">
                              {MEETING_TEMPLATE_OPTIONS.find((option) => option.value === formData.meetingTemplate)?.label || '기본 회의록'}
                            </span>
                          </div>
                          <span className={`ml-3 flex shrink-0 items-center text-slate-400 transition-transform ${templateMenuOpen ? 'rotate-180' : ''}`}>
                            <IIcon name="chevronDown" size={16} />
                          </span>
                        </button>

                        {templateMenuOpen && (
                          <div
                            className={`absolute left-0 right-0 z-30 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-[0_16px_30px_-18px_rgba(15,23,42,0.28)] ${
                              templateMenuDirection === 'up'
                                ? 'bottom-[calc(100%+0.45rem)]'
                                : 'top-[calc(100%+0.45rem)]'
                            }`}
                            style={{ maxHeight: `${templateMenuMaxHeight}px` }}
                          >
                            {MEETING_TEMPLATE_OPTIONS.map((option) => {
                              const selected = formData.meetingTemplate === option.value;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => {
                                    updateField('meetingTemplate', option.value);
                                    setTemplateMenuOpen(false);
                                  }}
                                  className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 transition-colors ${
                                    selected ? 'bg-sky-50' : 'bg-white hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <p className={`truncate text-sm font-semibold ${selected ? 'text-sky-700' : 'text-slate-800'}`}>{option.label}</p>
                                      <span className="hidden shrink-0 text-xs text-slate-300 sm:inline">·</span>
                                      <p className="hidden truncate text-xs text-slate-400 sm:block">{option.description}</p>
                                    </div>
                                  </div>
                                  {selected && <IIcon name="checkCircle" size={16} className="mt-0.5 shrink-0 text-sky-500" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        회의 생성 시 기본으로 적용될 형식을 선택합니다. 필요하면 회의별로 따로 조정할 수 있어요.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                      <p className="text-sm font-semibold text-slate-800">선택한 템플릿과 공개범위는 프로젝트 기본값으로 저장됩니다.</p>
                      <p className="mt-1 text-xs text-slate-500">회의 생성 시 이 값이 기본으로 적용되며, 필요한 경우 회의별로 따로 조정할 수 있습니다.</p>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'access' && (
                <div className={cardClass}>
                  <div className="border-b border-slate-100 pb-5">
                    <h2 className="text-lg font-bold text-slate-900">프로젝트 공개범위</h2>
                    <p className="mt-1 text-sm text-slate-500">프로젝트 기본 접근 범위를 정합니다. 회의별로 더 좁게 설정할 수도 있습니다.</p>
                  </div>

                  <div className="mt-6">
                    <label className={labelClass}>기본 공개범위</label>
                    <div className="grid gap-2 md:grid-cols-3">
                      {VISIBILITY_OPTIONS.map((option) => {
                        const selected = formData.projectVisibility === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => updateField('projectVisibility', option.value)}
                            className={`rounded-xl border px-4 py-3 text-left transition-all ${
                              selected
                                ? 'border-sky-300 bg-sky-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className={`text-sm font-semibold ${selected ? 'text-sky-700' : 'text-slate-700'}`}>
                                {option.label}
                              </span>
                              {selected && <IIcon name="checkCircle" size={16} className="text-sky-500" />}
                            </div>
                            <p className="mt-1 text-xs text-slate-400">
                              {option.value === 'private' && '나만 볼 수 있는 상태로 설정됩니다.'}
                              {option.value === 'members' && '초대된 구성원만 볼 수 있습니다.'}
                              {option.value === 'org' && '조직 전체에서 볼 수 있는 상태로 설정됩니다.'}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/70 p-4 text-sm text-slate-600">
                      공개범위는 프로젝트 기본값입니다. 실제 회의록 공개 여부는 나중에 회의 생성/회의별 설정에서 더 세밀하게 조정하는 방식이 가장 자연스럽습니다.
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'members' && (
                <div className={cardClass}>
                  <div className="border-b border-slate-100 pb-5">
                    <h2 className="text-lg font-bold text-slate-900">인원 관리</h2>
                    <p className="mt-1 text-sm text-slate-500">구성원을 추가/삭제하고, 관리자 권한을 여러 명에게 부여할 수 있습니다.</p>
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
                    <label className={labelClass}>참여 인원 추가 (이메일 입력)</label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative flex-1">
                        <IIcon name="userPlus" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="email"
                          value={inviteQuery}
                          placeholder="초대할 이메일 주소 입력"
                          className={`${inputClass} pl-10`}
                          onChange={(e) => setInviteQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              inviteMember();
                            }
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => inviteMember()}
                        disabled={!inviteQuery.trim().includes('@')}
                        className={`shrink-0 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-colors ${
                          inviteQuery.trim().includes('@')
                            ? 'bg-sky-600 hover:bg-sky-700'
                            : 'bg-slate-300 cursor-not-allowed'
                        }`}
                      >
                        추가
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">이메일 주소를 입력하고 추가 버튼을 누르면 해당 사용자가 프로젝트에 초대됩니다.</p>
                  </div>

                  <div className="mt-6">
                    <p className="mb-2 text-xs font-semibold text-slate-500">보낸 초대 ({sentInvitations.length})</p>
                    {sentInvitations.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                        아직 보낸 초대가 없습니다.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <div className="divide-y divide-slate-100">
                          {sentInvitations.map((member) => {
                            const statusInfo = inviteStatusMeta[member.invite_status] || inviteStatusMeta.pending;
                            return (
                              <div key={member.id || member.email} className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-800">{member.email}</p>
                                  <p className="mt-0.5 text-xs text-slate-400">
                                    {member.role === 'admin' ? '관리자' : '멤버'} 초대
                                  </p>
                                </div>
                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusInfo.className}`}>
                                  {statusInfo.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
                          {formData.participants.map((participant) => {
                            const name = participant.name;
                            const isAdmin = adminNames.includes(name);
                            return (
                              <div key={participant.id || name} className="flex items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4">
                                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(name)}`}>
                                    {name.slice(0, 1)}
                                  </span>
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
                                    {isAdmin && (
                                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-sky-600">
                                        <IIcon name="shield" size={11} />
                                        관리자
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleAdminRole(participant)}
                                    className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors sm:px-2.5 sm:text-xs ${
                                      isAdmin
                                        ? 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    {isAdmin ? '권한해제' : '권한부여'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeParticipant(participant)}
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
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Jira</h2>
                        <p className="mt-1 text-sm text-slate-500">회의록은 대표 Issue로, 선택한 업무는 Jira Task로 중복 없이 동기화됩니다.</p>
                      </div>
                      <StatusBadge status={integrationStatus.jira.connected ? 'connected' : 'disconnected'} />
                    </div>
                    <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800">상태: {integrationStatus.jira.connected ? '연동됨' : '미연동'}</p>
                      {integrationStatus.jira.connected && (
                        <p className="mt-1 text-sm text-slate-500">
                          사이트: {integrationStatus.jira.siteName || 'Jira'} {integrationStatus.jira.siteUrl ? `· ${integrationStatus.jira.siteUrl}` : ''}
                        </p>
                      )}
                    </div>
                    {integrationStatus.jira.connected && (
                      <div className="mt-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
                        <p className="text-xs font-semibold text-slate-500">Jira 프로젝트 선택</p>
                        <p className="mt-1 text-xs text-slate-400">
                          이 TIKI 프로젝트의 회의록/할 일을 어느 Jira 프로젝트에 만들지 선택하세요. 사이트 안에 프로젝트가 여러 개 있을 수 있습니다.
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <select
                            value={integrationStatus.jira.jiraProjectKey || ''}
                            onChange={(e) => handleSelectJiraProject(e.target.value)}
                            disabled={jiraProjectLoading || jiraProjectSaving || jiraProjectOptions.length === 0}
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-60"
                          >
                            <option value="" disabled>
                              {jiraProjectLoading ? '불러오는 중...' : jiraProjectOptions.length === 0 ? '프로젝트 없음' : '프로젝트를 선택하세요'}
                            </option>
                            {jiraProjectOptions.map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.name} ({option.key})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleLoadJiraProjects}
                            disabled={jiraProjectLoading}
                            title="목록 새로고침"
                            className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-60"
                          >
                            <IIcon name="refreshCw" size={14} />
                          </button>
                        </div>
                        {integrationStatus.jira.jiraProjectName && (
                          <p className="mt-2 text-xs font-semibold text-sky-700">
                            현재 선택됨: {integrationStatus.jira.jiraProjectName}
                          </p>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => integrationStatus.jira.connected ? handleDisconnectIntegration('jira') : handleConnectIntegration('jira')}
                      disabled={integrationLoading.jira || !selectedProject?.id}
                      className={`mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${integrationStatus.jira.connected ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'bg-sky-600 text-white hover:bg-sky-700'} ${integrationLoading.jira || !selectedProject?.id ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      {integrationLoading.jira ? '처리 중...' : integrationStatus.jira.connected ? '연동 해제' : 'Jira 연동하기'}
                    </button>
                    {integrationStatus.jira.connected && (
                      <button
                        type="button"
                        onClick={() => handleSyncExistingMeetings('jira')}
                        disabled={integrationSyncing.jira || !selectedProject?.id}
                        className={`mt-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition-colors hover:bg-sky-100 ${integrationSyncing.jira || !selectedProject?.id ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        {integrationSyncing.jira ? '동기화 중...' : '기존 회의록 동기화'}
                      </button>
                    )}
                  </div>

                  <div className={cardClass}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Notion</h2>
                        <p className="mt-1 text-sm text-slate-500">회의록은 Notion 페이지로, 선택한 업무는 Task Database 또는 회의록 페이지에 동기화됩니다.</p>
                      </div>
                      <StatusBadge status={integrationStatus.notion.connected ? 'connected' : 'disconnected'} />
                    </div>
                    <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800">상태: {integrationStatus.notion.connected ? '연동됨' : '미연동'}</p>
                      {integrationStatus.notion.connected && (
                        <p className="mt-1 text-sm text-slate-500">워크스페이스: {integrationStatus.notion.workspaceName || 'Notion Workspace'}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => integrationStatus.notion.connected ? handleDisconnectIntegration('notion') : handleConnectIntegration('notion')}
                      disabled={integrationLoading.notion || !selectedProject?.id}
                      className={`mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${integrationStatus.notion.connected ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'bg-sky-600 text-white hover:bg-sky-700'} ${integrationLoading.notion || !selectedProject?.id ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      {integrationLoading.notion ? '처리 중...' : integrationStatus.notion.connected ? '연동 해제' : 'Notion 연동하기'}
                    </button>
                    {integrationStatus.notion.connected && (
                      <button
                        type="button"
                        onClick={() => handleSyncExistingMeetings('notion')}
                        disabled={integrationSyncing.notion || !selectedProject?.id}
                        className={`mt-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition-colors hover:bg-sky-100 ${integrationSyncing.notion || !selectedProject?.id ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        {integrationSyncing.notion ? '동기화 중...' : '기존 회의록 동기화'}
                      </button>
                    )}
                  </div>

                  <div className="space-y-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-6 sm:p-7">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-sky-700">
                      <IIcon name="zap" size={16} /> 실제 동기화 안내
                    </h3>
                    <p className="text-sm text-slate-600">OAuth 연동 후 생성되는 회의록은 외부 대표 리소스로 연결되고, 업무 보내기에서는 선택한 업무만 외부 서비스에 생성 또는 업데이트됩니다.</p>
                    <ul className="space-y-1.5 text-sm text-slate-600">
                      <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-sky-400" />프로젝트마다 서로 다른 Jira / Notion 계정을 연결할 수 있습니다.</li>
                      <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-sky-400" />이미 전송된 업무는 중복 생성하지 않고 기존 외부 항목을 업데이트합니다.</li>
                    </ul>
                  </div>
                </div>
              )}
              {false && (
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
                      <IIcon name="zap" size={16} /> 기본값 안내
                    </h3>
                    <p className="text-sm text-slate-600">
                      프로젝트 기본 설정은 회의 생성 시 기본값으로 반영됩니다. 템플릿과 공개범위를 먼저 정해두면 이후 회의 생성이 훨씬 빨라집니다.
                    </p>
                    <ul className="space-y-1.5 text-sm text-slate-600">
                      <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-sky-400" />기본 회의 템플릿: {templateLabel}</li>
                      <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-sky-400" />기본 공개범위: {visibilityLabel}</li>
                    </ul>
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
            disabled={isSavingSettings}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(14,165,233,0.7)] transition-all hover:brightness-105 disabled:opacity-60"
          >
            <IIcon name="save" size={17} /> {isSavingSettings ? '저장 중...' : '저장'}
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
