import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MobileTab from '../components/MobileTab';

const ISSUE_PRIORITY_OPTIONS = ['높음', '보통', '낮음'];

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

const openDatePicker = (input) => {
  if (!input) return;
  try {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
  } catch {
    // Some browsers restrict direct picker open calls.
  }
  input.focus();
};

function Toast({ msg, color }) {
  if (!msg) return null;

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-fit max-w-[calc(100vw-2rem)] px-4 py-2.5 rounded-full text-white text-xs font-semibold shadow-lg pointer-events-none whitespace-nowrap overflow-hidden text-ellipsis"
      style={{ background: color }}
    >
      {msg}
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

export default function MeetingMinutesCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const typeDropdownRef = useRef(null);
  const meetingDateInputRef = useRef(null);
  const actionDueDateInputRef = useRef(null);
  const toastTimerRef = useRef(null);
  const saveTimerRef = useRef(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState('home');
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ msg: '', color: '#10B981' });

  const [decisionInput, setDecisionInput] = useState('');
  const [actionInput, setActionInput] = useState({ title: '', assignee: '', dueDate: '' });
  const [decisionItems, setDecisionItems] = useState([]);
  const [actionItems, setActionItems] = useState([]);

  const [issueInput, setIssueInput] = useState('');
  const [issuePriority, setIssuePriority] = useState('보통');
  const [issueItems, setIssueItems] = useState([]);

  const [keywordInput, setKeywordInput] = useState('');
  const [keywordTags, setKeywordTags] = useState([]);

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

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const addDecision = () => {
    const value = decisionInput.trim();
    if (!value) return;

    setDecisionItems((prev) => [...prev, { id: Date.now() + Math.random(), text: value, checked: false }]);
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
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [, month, day] = parts;
    return `${Number(month)}/${Number(day)}`;
  };

  const toggleAction = (id) => {
    setActionItems((prev) => prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)));
  };

  const removeAction = (id) => {
    setActionItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addKeywordTags = () => {
    const nextTags = keywordInput
      .split(/[\n,]/)
      .map((word) => word.trim().replace(/^#/, ''))
      .filter(Boolean);

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

  const showToast = useCallback((msg, color = '#10B981') => {
    setToast({ msg, color });

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = setTimeout(() => {
      setToast({ msg: '', color });
    }, 2800);
  }, []);

  const stateLabels = {
    IDLE: '대기 중',
    UPLOADING: '업로드 중',
    PROCESSING: 'AI 분석 중',
    COMPLETED: '분석 완료',
    FAILED: '오류 발생',
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    if (isSaving) return;

    setIsSaving(true);

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      setIsSaving(false);
      showToast('저장되었습니다.', '#10B981');
    }, 1100);
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
                  <div className="cursor-pointer" onClick={() => openDatePicker(meetingDateInputRef.current)}>
                    <input
                      ref={meetingDateInputRef}
                      type="date"
                      value={form.date}
                      onChange={(e) => update('date', e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl focus:outline-none focus:border-[#0099CC] cursor-pointer"
                    />
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
                    <span className="text-[11px] text-[#5A6F8A]">엔터를 누르면 해시태그로 추가됩니다.</span>
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
                      <span className="text-[11px] text-[#5A6F8A]">Enter로 빠르게 추가하세요.</span>
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
                          <button type="button" onClick={() => removeDecision(item.id)} className="text-xs text-[#9AAAC0] hover:text-[#EF4444]">
                            삭제
                          </button>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[rgba(0,100,180,0.08)] bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-xs font-semibold text-[#5A6F8A]">액션 아이템</label>
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
                          placeholder="담당자"
                          className="w-full min-w-0 px-3 py-2.5 text-sm bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl focus:outline-none focus:border-[#0099CC]"
                        />
                        <div className="cursor-pointer" onClick={() => openDatePicker(actionDueDateInputRef.current)}>
                          <input
                            ref={actionDueDateInputRef}
                            type="date"
                            value={actionInput.dueDate}
                            onChange={(e) => updateActionInput('dueDate', e.target.value)}
                            className="w-full min-w-0 px-3 py-2.5 text-sm bg-[#F8FAFF] border border-[rgba(0,100,180,0.12)] rounded-xl focus:outline-none focus:border-[#0099CC] cursor-pointer"
                          />
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
                        <p className="text-xs text-[#7C8EA6] px-1 py-2">추가된 액션 아이템이 없습니다.</p>
                      )}
                      {actionItems.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${
                            item.checked ? 'border-[#A7E8C5] bg-[#ECFDF5]' : 'border-[rgba(0,100,180,0.12)] bg-white'
                          }`}
                        >
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
                          <button
                            type="button"
                            onClick={() => removeAction(item.id)}
                            className="text-xs text-[#9AAAC0] hover:text-[#EF4444] shrink-0"
                          >
                            삭제
                          </button>
                        </div>
                      ))}
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
                              className="text-xs text-[#9AAAC0] hover:text-[#EF4444] shrink-0"
                            >
                              삭제
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
      <Toast msg={toast.msg} color={toast.color} />
    </div>
  );
}
