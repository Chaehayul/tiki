import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MobileTab from '../components/MobileTab';
import ToastPopup from '../components/toastpopup';
import { createProjectMeeting } from '../api/apiClient';

const ISSUE_PRIORITY_OPTIONS = ['높음', '보통', '낮음'];
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const PROJECT_OVERRIDE_STORAGE_KEY = 'tiki_project_overrides';
const MANUAL_MEETING_RECORDS_KEY = 'tiki_manual_minutes_records';

const ISSUE_PRIORITY_STYLES = {
  높음: {
    card: 'border-[#FCA5A5] bg-[#FEF2F2]',
    icon: 'text-[#DC2626]',
    badge: 'bg-[#FEE2E2] text-[#DC2626]',
    dot: 'bg-[#DC2626]',
  },
  보통: {
    card: 'border-[#FDE68A] bg-[#FFFBEB]',
    icon: 'text-[#D97706]',
    badge: 'bg-[#FEF3C7] text-[#B45309]',
    dot: 'bg-[#D97706]',
  },
  낮음: {
    card: 'border-[rgba(0,100,180,0.14)] bg-[#F8FAFF]',
    icon: 'text-[#5A6F8A]',
    badge: 'bg-[#EEF3FF] text-[#5A6F8A]',
    dot: 'bg-[#5A6F8A]',
  },
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

const writeProjectOverrides = (next) => {
  try {
    localStorage.setItem(PROJECT_OVERRIDE_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('tiki-projects-changed'));
  } catch {
    // ignore storage write failures in local mock mode
  }
};

const buildActionDescription = (item, meeting) => {
  const lines = [
    item?.text ? `업무: ${item.text}` : '',
    item?.assignee ? `담당자: ${item.assignee}` : '담당자: 미지정',
    item?.dueDate ? `마감일: ${item.dueDate}` : '',
    meeting?.summary ? `회의 내용 기반: ${meeting.summary}` : '',
  ].filter(Boolean);
  return lines.join('\n');
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

const writeManualMeetingRecords = (next) => {
  try {
    localStorage.setItem(MANUAL_MEETING_RECORDS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage write failures in local mock mode
  }
};

const parseKeywordInput = (value) => {
  return String(value || '')
    .split(/(?=#)|[\s,;]+/)
    .map((word) => word.trim().replace(/^#+/, '').trim())
    .filter(Boolean);
};

const parseDecisionInput = (value) => {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+([0-9]+[.)])/g, '\n$1')
    .replace(/\s+([-*•])\s+/g, '\n')
    .split(/\n|[;；]+/)
    .map((item) => item.replace(/^[-*•]\s*/, '').replace(/^[0-9]+[.)]\s*/, '').trim())
    .filter(Boolean);
};

const formatStorageDate = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.replace(/-/g, '.');
  }
  return value;
};

const pad2 = (n) => String(n).padStart(2, '0');

const toDateStr = (year, month, day) => `${year}-${pad2(month + 1)}-${pad2(day)}`;

const parseDateStr = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('-').map(Number);
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

function CalendarPopover({ value, onSelect, onClose, placement = 'bottom' }) {
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

  const cells = buildCalendarGrid(viewYear, viewMonth);

  return (
    <div
      className={`absolute z-[300] ${placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 w-[280px] max-w-[88vw] box-border overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)] p-3.5`}
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

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-40 bg-[#0D1B2A]/35 backdrop-blur-[2px] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_18px_50px_rgba(13,27,42,0.22)] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full border-2 border-[#0099CC]/20 border-t-[#0099CC] animate-spin" />
          <div>
            <p className="text-sm font-bold text-[#0D1B2A]">저장 중</p>
            <p className="text-xs text-[#5A6F8A] mt-0.5">회의록을 저장하고 있어요.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ open, title, description, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,27,42,0.45)' }}>
      <div className="w-full max-w-sm rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white shadow-[0_18px_50px_rgba(13,27,42,0.22)]">
        <div className="px-5 py-4 border-b border-[rgba(0,100,180,0.08)]">
          <h3 className="text-sm font-bold text-[#0D1B2A]">{title}</h3>
          {description && <p className="text-xs text-[#5A6F8A] mt-1">{description}</p>}
        </div>
        <div className="px-5 py-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-lg border border-[rgba(0,100,180,0.14)] text-[#5A6F8A] text-xs font-semibold hover:bg-[#F8FAFF]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3.5 py-2 rounded-lg bg-[#EF4444] text-white text-xs font-semibold hover:bg-[#DC2626]"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MeetingMinutesCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const typeDropdownRef = useRef(null);
  const toastTimerRef = useRef(null);
  const saveTimerRef = useRef(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState('home');
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info' });

  const [decisionInput, setDecisionInput] = useState('');
  const [actionInput, setActionInput] = useState({ title: '', assignee: '', dueDate: '' });
  const [decisionItems, setDecisionItems] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [editingActionId, setEditingActionId] = useState(null);
  const [actionEditInput, setActionEditInput] = useState({ title: '', assignee: '', dueDate: '' });
  const [pendingDeleteActionId, setPendingDeleteActionId] = useState(null);

  const [issueInput, setIssueInput] = useState('');
  const [issuePriority, setIssuePriority] = useState('보통');
  const [issueItems, setIssueItems] = useState([]);

  const [keywordInput, setKeywordInput] = useState('');
  const [keywordTags, setKeywordTags] = useState([]);
  const [openCalendarKey, setOpenCalendarKey] = useState(null);

  const projectId = location.state?.projectId;
  const projectName = location.state?.projectName || '프로젝트';

  const [form, setForm] = useState({
    title: '',
    date: '',
    type: '정기',
    participants: '',
    summary: '',
    keywords: '',
    nextAgenda: '',
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const addDecision = () => {
    const values = parseDecisionInput(decisionInput);
    if (values.length === 0) return;

    setDecisionItems((prev) => [
      ...prev,
      ...values.map((text) => ({ id: Date.now() + Math.random(), text, checked: false })),
    ]);
    setDecisionInput('');
  };

  const toggleDecision = (id) => {
    setDecisionItems((prev) => prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)));
  };

  const removeDecision = (id) => {
    setDecisionItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateActionInput = (key, value) => setActionInput((prev) => ({ ...prev, [key]: value }));

  const addAction = () => {
    const title = actionInput.title.trim();
    if (!title) return;

    setActionItems((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        text: title,
        assignee: actionInput.assignee.trim(),
        dueDate: actionInput.dueDate,
        checked: false,
      },
    ]);
    setActionInput({ title: '', assignee: '', dueDate: '' });
    setOpenCalendarKey(null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [, month, day] = parts;
    return `${Number(month)}/${Number(day)}`;
  };

  const toggleAction = (id) => {
    let nextChecked = false;
    setActionItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      nextChecked = !item.checked;
      return { ...item, checked: nextChecked };
    }));

    if (nextChecked) {
      showToast('해야 할 일이 완료되었습니다.', 'success');
    }
  };

  const removeAction = (id) => {
    setActionItems((prev) => prev.filter((item) => item.id !== id));
  };

  const startEditAction = (item) => {
    setEditingActionId(item.id);
    setOpenCalendarKey(null);
    setActionEditInput({
      title: item.text || '',
      assignee: item.assignee || '',
      dueDate: item.dueDate || '',
    });
  };

  const updateActionEditInput = (key, value) => {
    setActionEditInput((prev) => ({ ...prev, [key]: value }));
  };

  const cancelEditAction = () => {
    setEditingActionId(null);
    setActionEditInput({ title: '', assignee: '', dueDate: '' });
    setOpenCalendarKey(null);
  };

  const saveEditAction = () => {
    const nextTitle = actionEditInput.title.trim();
    if (!editingActionId) return;
    if (!nextTitle) {
      showToast('해야 할 일 제목을 입력해 주세요.', 'warning');
      return;
    }

    setActionItems((prev) => prev.map((item) => (
      item.id === editingActionId
        ? {
            ...item,
            text: nextTitle,
            assignee: actionEditInput.assignee.trim(),
            dueDate: actionEditInput.dueDate,
          }
        : item
    )));
    cancelEditAction();
    showToast('해야 할 일이 수정되었습니다.', 'success');
  };

  const requestRemoveAction = (id) => {
    setPendingDeleteActionId(id);
  };

  const cancelRemoveAction = () => {
    setPendingDeleteActionId(null);
  };

  const confirmRemoveAction = () => {
    if (!pendingDeleteActionId) return;
    removeAction(pendingDeleteActionId);
    if (editingActionId === pendingDeleteActionId) {
      cancelEditAction();
    }
    setPendingDeleteActionId(null);
    showToast('해야 할 일이 삭제되었습니다.', 'success');
  };

  const addKeywordTags = () => {
    const nextTags = parseKeywordInput(keywordInput);

    if (nextTags.length === 0) return;

    setKeywordTags((prev) => {
      const merged = [...prev];
      nextTags.forEach((tag) => {
        if (!merged.includes(tag) && merged.length < 12) {
          merged.push(tag);
        }
      });
      update('keywords', merged.join(', '));
      return merged;
    });
    setKeywordInput('');
  };

  const removeKeywordTag = (tagToRemove) => {
    setKeywordTags((prev) => {
      const nextTags = prev.filter((tag) => tag !== tagToRemove);
      update('keywords', nextTags.join(', '));
      return nextTags;
    });
  };

  const addIssue = () => {
    const value = issueInput.trim();
    if (!value) return;

    setIssueItems((prev) => [...prev, { id: Date.now() + Math.random(), text: value, priority: issuePriority }]);
    setIssueInput('');
  };

  const removeIssue = (id) => {
    setIssueItems((prev) => prev.filter((item) => item.id !== id));
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) {
        setIsTypeOpen(false);
      }
      if (!e.target.closest('[data-calendar-root]')) {
        setOpenCalendarKey(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = setTimeout(() => {
      setToast({ message: '', type: 'info' });
    }, 2800);
  }, []);

  const stateLabels = {
    IDLE: '대기 중',
    UPLOADING: '업로드 중',
    PROCESSING: 'AI 분석 중',
    COMPLETED: '분석 완료',
    FAILED: '오류 발생',
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    if (isSaving) return;

    setIsSaving(true);

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    const pendingDecisions = parseDecisionInput(decisionInput);
    const pendingActionTitle = actionInput.title.trim();
    const pendingIssue = issueInput.trim();
    const pendingKeywordTags = parseKeywordInput(keywordInput);

    const mergedDecisionItems = pendingDecisions.length > 0
      ? [
          ...decisionItems,
          ...pendingDecisions.map((text) => ({ id: Date.now() + Math.random(), text, checked: false })),
        ]
      : decisionItems;

    const mergedActionItems = pendingActionTitle
      ? [
          ...actionItems,
          {
            id: Date.now() + Math.random(),
            text: pendingActionTitle,
            assignee: actionInput.assignee.trim(),
            dueDate: actionInput.dueDate,
            checked: false,
          },
        ]
      : actionItems;

    const mergedIssueItems = pendingIssue
      ? [...issueItems, { id: Date.now() + Math.random(), text: pendingIssue, priority: issuePriority }]
      : issueItems;

    const mergedKeywords = (() => {
      const base = keywordTags.length > 0
        ? [...keywordTags]
        : parseKeywordInput(form.keywords);
      const next = [...base];
      pendingKeywordTags.forEach((tag) => {
        if (!next.includes(tag) && next.length < 12) {
          next.push(tag);
        }
      });
      return next;
    })();

    const manualRecordId = `mm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const participants = form.participants
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    const meetingDate = formatStorageDate(form.date);
    const normalizedKeywords = mergedKeywords;

    const manualRecord = {
      id: manualRecordId,
      projectId: projectId ? String(projectId) : '',
      projectName,
      title: form.title.trim(),
      date: meetingDate,
      rawDate: form.date,
      type: form.type,
      participants,
      summary: form.summary.trim(),
      keywords: normalizedKeywords,
      decisions: mergedDecisionItems.map((item) => ({ text: item.text, checked: Boolean(item.checked) })),
      actions: mergedActionItems.map((item) => ({
        text: item.text,
        assignee: item.assignee,
        dueDate: item.dueDate,
        checked: Boolean(item.checked),
      })),
      issues: mergedIssueItems.map((item) => ({ text: item.text, priority: item.priority })),
      nextAgenda: form.nextAgenda.trim(),
      createdAt: new Date().toISOString(),
    };

    const nextManualRecords = readManualMeetingRecords();
    nextManualRecords[manualRecordId] = manualRecord;
    writeManualMeetingRecords(nextManualRecords);

    const generatedActionItems = mergedActionItems.map((item, index) => ({
      id: `${manualRecordId}-action-${index + 1}`,
      text: item.text,
      title: item.text,
      description: buildActionDescription(item, manualRecord),
      due: formatStorageDate(item.dueDate),
      dueDate: formatStorageDate(item.dueDate),
      assignee: item.assignee || '담당자 미지정',
      assignees: item.assignee ? [item.assignee] : [],
      status: '검토대기',
      source: manualRecord.title,
      projectId: projectId ? String(projectId) : '',
      projectName,
      integrationTool: null,
      externalLink: '',
      snapshotOf: null,
      historySavedAt: null,
      updatedAt: new Date().toISOString(),
    }));

    let serverMeetingId = '';

    if (projectId) {
      try {
        const createdMeeting = await createProjectMeeting(projectId, {
          title: manualRecord.title,
          date: meetingDate,
          round_number: 1,
          status: '검토대기',
          meeting_type: form.type,
          tags: normalizedKeywords.slice(0, 4).map((tag) => `#${tag}`),
          participants,
          summary: manualRecord.summary || '직접 작성된 회의록입니다.',
          action_items: generatedActionItems,
          action_items_count: generatedActionItems.length,
        });
        serverMeetingId = createdMeeting?.id ? String(createdMeeting.id) : '';
      } catch {
        serverMeetingId = '';
      }

      const nextOverrides = readProjectOverrides();
      const key = String(projectId);
      const prev = nextOverrides[key] && typeof nextOverrides[key] === 'object' ? nextOverrides[key] : {};
      const prevMeetings = Array.isArray(prev.meetings) ? prev.meetings : [];
      const prevActionItems = Array.isArray(prev.myActionItems) ? prev.myActionItems : [];
      const meetingRow = {
        id: serverMeetingId || manualRecordId,
        date: meetingDate,
        title: manualRecord.title,
        status: '검토대기',
        type: form.type,
        tags: normalizedKeywords.slice(0, 4).map((tag) => `#${tag}`),
        participants,
        summary: manualRecord.summary || '직접 작성된 회의록입니다.',
        actionItems: mergedActionItems.length,
        jiraLinked: 0,
        detailType: 'manual',
        detailRecordId: manualRecordId,
      };

      nextOverrides[key] = {
        ...prev,
        meetings: [meetingRow, ...prevMeetings],
        myActionItems: [...generatedActionItems, ...prevActionItems],
      };
      writeProjectOverrides(nextOverrides);
    }

    saveTimerRef.current = setTimeout(() => {
      setIsSaving(false);
      showToast('저장되었습니다.', 'success');
      navigate('/meeting-manual-detail', {
        state: {
          recordId: manualRecordId,
          projectId: projectId ? String(projectId) : '',
          projectName,
        },
      });
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFF] overflow-x-hidden pt-20 pb-20 md:pb-0 flex flex-col">
      <Header isMobile={isMobile} phase="IDLE" stateLabels={stateLabels} />

      <main className="flex-1 w-full px-4 md:px-8 py-6 md:py-8">
        <div className="max-w-4xl mx-auto">
          <button
            type="button"
            onClick={() => (projectId ? navigate(`/project/${projectId}/meetings`) : navigate('/project-list'))}
            className="text-sm text-[#5A6F8A] hover:text-[#0D1B2A]"
          >
            ← 돌아가기
          </button>

          <section className="mt-4 rounded-2xl border border-[rgba(0,100,180,0.12)] bg-white p-5 md:p-6">
            <div className="mb-5">
              <h1 className="text-2xl font-bold text-[#0D1B2A]">회의록 직접 작성</h1>
              <p className="text-sm text-[#5A6F8A] mt-1">{projectName} 프로젝트의 회의록을 추가합니다.</p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#5A6F8A] mb-1.5">회의 제목</label>
                <input
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="예: 6월 스프린트 회의"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl focus:outline-none focus:border-[#0099CC]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#5A6F8A] mb-1.5">회의 날짜</label>
                  <div className="relative" data-calendar-root>
                    <button
                      type="button"
                      onClick={() => setOpenCalendarKey((prev) => (prev === 'meeting' ? null : 'meeting'))}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl text-left flex items-center justify-between gap-2 focus:outline-none focus:border-[#0099CC]"
                    >
                      <span className={form.date ? 'text-[#0D1B2A]' : 'text-[#9AA7B8]'}>
                        {form.date || '날짜 선택'}
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#5A6F8A]">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </button>
                    {openCalendarKey === 'meeting' && (
                      <CalendarPopover
                        value={form.date}
                        onSelect={(nextDate) => update('date', nextDate)}
                        onClose={() => setOpenCalendarKey(null)}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5A6F8A] mb-1.5">회의 유형</label>
                  <div className="relative" ref={typeDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsTypeOpen((prev) => !prev)}
                      className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition flex items-center justify-between ${
                        isTypeOpen
                          ? 'bg-[#EEF3FF] border-[#0099CC]/40 shadow-[0_0_0_3px_rgba(0,153,204,0.12)] text-[#0D1B2A]'
                          : 'bg-[#F8FAFF] border-[rgba(0,100,180,0.12)] text-[#0D1B2A] hover:border-[rgba(0,153,204,0.4)]'
                      }`}
                    >
                      <span className="font-medium">{form.type}</span>
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className={`shrink-0 text-[#A0AFBF] transition-transform ${isTypeOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      >
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    {isTypeOpen && (
                      <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-[rgba(0,100,180,0.14)] bg-white shadow-[0_10px_28px_rgba(0,100,180,0.16)]">
                        {['정기', '수시'].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              update('type', option);
                              setIsTypeOpen(false);
                            }}
                            className={`w-full px-3.5 py-2.5 text-sm text-left flex items-center justify-between transition-colors ${
                              form.type === option ? 'bg-[#F5F7FB] text-[#0099CC] font-semibold' : 'text-[#0D1B2A] hover:bg-[#F5F7FB]'
                            }`}
                          >
                            <span>{option}</span>
                            {form.type === option && (
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="shrink-0 text-[#0099CC]"
                                aria-hidden="true"
                              >
                                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5A6F8A] mb-1.5">참여자</label>
                <input
                  value={form.participants}
                  onChange={(e) => update('participants', e.target.value)}
                  placeholder="예: 김지훈, 박소현, 이민준"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl focus:outline-none focus:border-[#0099CC]"
                />
              </div>

              <div className="rounded-2xl border border-[rgba(0,100,180,0.08)] bg-white p-4 space-y-3">
                <label className="block text-xs font-semibold text-[#5A6F8A]">회의 요약</label>
                <textarea
                  value={form.summary}
                  onChange={(e) => update('summary', e.target.value)}
                  rows={4}
                  placeholder="회의 전체 내용을 간단히 요약해 주세요."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[rgba(0,100,180,0.12)] rounded-xl focus:outline-none focus:border-[#0099CC] resize-none"
                />
              </div>

              <section className="rounded-2xl border border-[rgba(0,100,180,0.12)] bg-[#F8FAFF] p-4 space-y-6">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-[#0D1B2A]">회의 정리 (선택)</h2>
                  <span className="text-[11px] text-[#5A6F8A]">필요한 항목만 채워도 됩니다.</span>
                </div>

                <div className="rounded-2xl border border-[rgba(0,100,180,0.08)] bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-semibold text-[#5A6F8A]">핵심 키워드</label>
                    <span className="text-[11px] text-[#5A6F8A]">공백, #, 쉼표로 자동 구분됩니다.</span>
                  </div>
                  <input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addKeywordTags();
                      }
                    }}
                    placeholder="예: STT, 화자 분리, Jira"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[rgba(0,100,180,0.12)] rounded-xl focus:outline-none focus:border-[#0099CC]"
                  />
                  {keywordTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {keywordTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EEF3FF] text-[#0099CC] border border-[rgba(0,153,204,0.22)]"
                        >
                          <span>#{tag}</span>
                          <button
                            type="button"
                            onClick={() => removeKeywordTag(tag)}
                            className="text-[#5A6F8A] hover:text-[#0D1B2A]"
                            aria-label={`${tag} 삭제`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-[rgba(0,100,180,0.08)] bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-xs font-semibold text-[#5A6F8A]">주요 결정</label>
                      <span className="text-[11px] text-[#5A6F8A]">여러 줄, 번호, 불릿을 한 번에 추가할 수 있어요.</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-stretch">
                      <input
                        value={decisionInput}
                        onChange={(e) => setDecisionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addDecision();
                          }
                        }}
                        onPaste={(e) => {
                          const text = e.clipboardData?.getData('text') || '';
                          const values = parseDecisionInput(text);
                          if (values.length <= 1) return;
                          e.preventDefault();
                          setDecisionItems((prev) => [
                            ...prev,
                            ...values.map((item) => ({ id: Date.now() + Math.random(), text: item, checked: false })),
                          ]);
                          setDecisionInput('');
                        }}
                        placeholder="예: 배포 일정 6/28 확정"
                        className="w-full min-w-0 px-3 py-2.5 text-sm bg-white border border-[rgba(0,100,180,0.12)] rounded-xl focus:outline-none focus:border-[#0099CC]"
                      />
                      <button
                        type="button"
                        onClick={addDecision}
                        className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#0099CC] text-white hover:bg-[#007EA7]"
                      >
                        추가
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                      {decisionItems.length === 0 && (
                        <p className="text-xs text-[#7C8EA6] px-1 py-2">추가된 결정 사항이 없습니다.</p>
                      )}
                      {decisionItems.map((item) => (
                        <label key={item.id} className="flex items-start gap-2 rounded-xl border border-[rgba(0,100,180,0.1)] bg-white px-2.5 py-2">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => toggleDecision(item.id)}
                            className="mt-0.5"
                          />
                          <span className={`flex-1 text-sm ${item.checked ? 'text-[#7C8EA6] line-through' : 'text-[#0D1B2A]'}`}>{item.text}</span>
                          <button
                            type="button"
                            onClick={() => removeDecision(item.id)}
                            className="w-7 h-7 rounded-lg border border-[rgba(0,100,180,0.14)] text-[#7C8EA6] hover:bg-[#FEF2F2] hover:text-[#EF4444] hover:border-[rgba(239,68,68,0.3)] flex items-center justify-center transition-colors"
                            aria-label="주요 결정 삭제"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                              <path d="M3 6h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M10 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[rgba(0,100,180,0.08)] bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-xs font-semibold text-[#5A6F8A]">해야 할 일</label>
                      <span className="text-[11px] text-[#5A6F8A]">담당자와 마감일을 함께 넣을 수 있습니다.</span>
                    </div>
                    <div className="space-y-2">
                      <input
                        value={actionInput.title}
                        onChange={(e) => updateActionInput('title', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addAction();
                          }
                        }}
                        placeholder="예: QA 테스트 시나리오 작성"
                        className="w-full min-w-0 px-3 py-2.5 text-sm bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl focus:outline-none focus:border-[#0099CC]"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-stretch">
                        <input
                          value={actionInput.assignee}
                          onChange={(e) => updateActionInput('assignee', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addAction();
                            }
                          }}
                          placeholder="담당자"
                          className="w-full min-w-0 px-3 py-2.5 text-sm bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl focus:outline-none focus:border-[#0099CC]"
                        />
                        <div className="relative" data-calendar-root>
                          <button
                            type="button"
                            onClick={() => setOpenCalendarKey((prev) => (prev === 'action' ? null : 'action'))}
                            className="w-full min-w-0 px-3 py-2.5 text-sm bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl text-left flex items-center justify-between gap-2 focus:outline-none focus:border-[#0099CC]"
                          >
                            <span className={actionInput.dueDate ? 'text-[#0D1B2A]' : 'text-[#9AA7B8]'}>
                              {actionInput.dueDate || '마감일'}
                            </span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#5A6F8A]">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                              <line x1="16" y1="2" x2="16" y2="6" />
                              <line x1="8" y1="2" x2="8" y2="6" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                          </button>
                          {openCalendarKey === 'action' && (
                            <CalendarPopover
                              value={actionInput.dueDate}
                              onSelect={(nextDate) => updateActionInput('dueDate', nextDate)}
                              onClose={() => setOpenCalendarKey(null)}
                              placement="top"
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={addAction}
                          className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#0D1B2A] text-white hover:bg-[#1A2F45] whitespace-nowrap"
                        >
                          추가
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                      {actionItems.length === 0 && (
                        <p className="text-xs text-[#7C8EA6] px-1 py-2">추가된 해야 할 일이 없습니다.</p>
                      )}
                      {actionItems.map((item) => {
                        const isEditing = editingActionId === item.id;

                        return (
                          <div
                            key={item.id}
                            className={`rounded-xl border px-3 py-2.5 ${
                              item.checked ? 'border-[#A7E8C5] bg-[#ECFDF5]' : 'border-[rgba(0,100,180,0.12)] bg-white'
                            }`}
                          >
                            {isEditing ? (
                              <div className="space-y-2">
                                <input
                                  value={actionEditInput.title}
                                  onChange={(e) => updateActionEditInput('title', e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      saveEditAction();
                                    }
                                  }}
                                  className="w-full min-w-0 px-3 py-2 text-sm bg-white border border-[rgba(0,100,180,0.12)] rounded-lg focus:outline-none focus:border-[#0099CC]"
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2">
                                  <input
                                    value={actionEditInput.assignee}
                                    onChange={(e) => updateActionEditInput('assignee', e.target.value)}
                                    placeholder="담당자"
                                    className="w-full min-w-0 px-3 py-2 text-sm bg-white border border-[rgba(0,100,180,0.12)] rounded-lg focus:outline-none focus:border-[#0099CC]"
                                  />
                                  <div className="relative" data-calendar-root>
                                    <button
                                      type="button"
                                      onClick={() => setOpenCalendarKey((prev) => (prev === `edit-${item.id}` ? null : `edit-${item.id}`))}
                                      className="w-full min-w-0 px-3 py-2 text-sm bg-white border border-[rgba(0,100,180,0.12)] rounded-lg text-left flex items-center justify-between gap-2 focus:outline-none focus:border-[#0099CC]"
                                    >
                                      <span className={actionEditInput.dueDate ? 'text-[#0D1B2A]' : 'text-[#9AA7B8]'}>
                                        {actionEditInput.dueDate || '마감일'}
                                      </span>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#5A6F8A]">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                      </svg>
                                    </button>
                                    {openCalendarKey === `edit-${item.id}` && (
                                      <CalendarPopover
                                        value={actionEditInput.dueDate}
                                        onSelect={(nextDate) => updateActionEditInput('dueDate', nextDate)}
                                        onClose={() => setOpenCalendarKey(null)}
                                        placement="top"
                                      />
                                    )}
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-0.5">
                                  <button
                                    type="button"
                                    onClick={cancelEditAction}
                                    className="px-3 py-1.5 rounded-lg border border-[rgba(0,100,180,0.14)] text-[#5A6F8A] text-xs font-semibold hover:bg-[#F8FAFF]"
                                  >
                                    취소
                                  </button>
                                  <button
                                    type="button"
                                    onClick={saveEditAction}
                                    className="px-3 py-1.5 rounded-lg bg-[#0099CC] text-white text-xs font-semibold hover:bg-[#007EA7]"
                                  >
                                    저장
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={item.checked}
                                  onChange={() => toggleAction(item.id)}
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm ${item.checked ? 'text-[#15803D] line-through' : 'text-[#0D1B2A]'}`}>{item.text}</p>
                                  {(item.assignee || item.dueDate || item.checked) && (
                                    <p className="text-xs text-[#7C8EA6] mt-0.5">
                                      {[item.assignee, item.checked ? '완료' : formatDate(item.dueDate)].filter(Boolean).join(' · ')}
                                    </p>
                                  )}
                                </div>
                                <span
                                  className={`shrink-0 px-2 py-1 rounded-full text-[11px] font-semibold ${
                                    item.checked ? 'bg-[#D1FAE5] text-[#15803D]' : 'bg-[#EEF3FF] text-[#0099CC]'
                                  }`}
                                >
                                  {item.checked ? '완료' : '진행 중'}
                                </span>
                                <div className="shrink-0 flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => startEditAction(item)}
                                    className="w-7 h-7 rounded-lg border border-[rgba(0,100,180,0.14)] text-[#5A6F8A] hover:bg-[#F8FAFF] hover:text-[#0D1B2A] flex items-center justify-center transition-colors"
                                    aria-label="해야 할 일 수정"
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                      <path d="m16.5 3.5 4 4L8 20l-4 1 1-4 11.5-13.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => requestRemoveAction(item.id)}
                                    className="w-7 h-7 rounded-lg border border-[rgba(0,100,180,0.14)] text-[#7C8EA6] hover:bg-[#FEF2F2] hover:text-[#EF4444] hover:border-[rgba(239,68,68,0.3)] flex items-center justify-center transition-colors"
                                    aria-label="해야 할 일 삭제"
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                      <path d="M3 6h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                      <path d="M10 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                      <path d="M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[rgba(0,100,180,0.08)] bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-xs font-semibold text-[#5A6F8A]">리스크 / 이슈</label>
                      <span className="text-[11px] text-[#5A6F8A]">우선순위를 선택해서 추가하세요.</span>
                    </div>
                    <div className="space-y-2">
                      <input
                        value={issueInput}
                        onChange={(e) => setIssueInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addIssue();
                          }
                        }}
                        placeholder="예: STT 처리 속도 8초, 목표 5초 미만"
                        className="w-full px-3 py-2.5 text-sm bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl focus:outline-none focus:border-[#0099CC]"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex gap-1.5">
                          {ISSUE_PRIORITY_OPTIONS.map((level) => (
                            <button
                              key={level}
                              type="button"
                              onClick={() => setIssuePriority(level)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                issuePriority === level
                                  ? `${ISSUE_PRIORITY_STYLES[level].badge} border-transparent`
                                  : 'bg-white text-[#5A6F8A] border-[rgba(0,100,180,0.14)] hover:bg-[#F8FAFF]'
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={addIssue}
                          className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#0099CC] text-white hover:bg-[#007EA7]"
                        >
                          추가
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                      {issueItems.length === 0 && (
                        <p className="text-xs text-[#7C8EA6] px-1 py-2">추가된 리스크 / 이슈가 없습니다.</p>
                      )}
                      {issueItems.map((item) => {
                        const style = ISSUE_PRIORITY_STYLES[item.priority] || ISSUE_PRIORITY_STYLES.보통;

                        return (
                          <div key={item.id} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${style.card}`}>
                            <span className={`text-base leading-none mt-0.5 ${style.icon}`}>{style.symbol}</span>
                            <span className="flex-1 text-sm text-[#0D1B2A]">{item.text}</span>
                            <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold ${style.badge}`}>
                              <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                              {item.priority}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeIssue(item.id)}
                              className="w-7 h-7 rounded-lg border border-[rgba(0,100,180,0.14)] text-[#7C8EA6] hover:bg-[#FEF2F2] hover:text-[#EF4444] hover:border-[rgba(239,68,68,0.3)] flex items-center justify-center transition-colors shrink-0"
                              aria-label="리스크/이슈 삭제"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path d="M3 6h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M10 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[rgba(0,100,180,0.08)] bg-white p-4 space-y-3">
                  <label className="block text-xs font-semibold text-[#5A6F8A]">다음 안건</label>
                  <textarea
                    value={form.nextAgenda}
                    onChange={(e) => update('nextAgenda', e.target.value)}
                    rows={3}
                    placeholder="다음 회의에서 다룰 안건을 적어 주세요."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[rgba(0,100,180,0.12)] rounded-xl focus:outline-none focus:border-[#0099CC] resize-none"
                  />
                </div>
              </section>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => (projectId ? navigate(`/project/${projectId}/meetings`) : navigate('/project-list'))}
                  className="px-4 py-2 rounded-lg border border-[rgba(0,100,180,0.16)] text-[#5A6F8A] text-sm font-semibold hover:bg-[#F8FAFF]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-[#0099CC] text-white text-sm font-semibold hover:bg-[#007EA7] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>

      {!isMobile && <Footer />}
      {isMobile && <MobileTab active={activeTab} onChange={setActiveTab} />}
      {isSaving && <LoadingOverlay />}
      <ConfirmDeleteModal
        open={Boolean(pendingDeleteActionId)}
        title="해야 할 일을 삭제할까요?"
        description="삭제한 항목은 되돌릴 수 없습니다."
        onCancel={cancelRemoveAction}
        onConfirm={confirmRemoveAction}
      />
      <ToastPopup show={Boolean(toast.message)} message={toast.message} type={toast.type} />
    </div>
  );
}
