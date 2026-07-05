import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MobileTab from '../components/MobileTab';
import { PLANS, FEATURE_COMPARISON, FAQ_ITEMS, yearlyDiscount } from '../data/subscriptionPlans';
import { getSubscription, subscribePlan } from '../api/apiClient';

const cn = (...c) => c.filter(Boolean).join(' ');

const PLAN_TIER = { free: 0, pro: 1, team: 2 };

// ── Icons ──────────────────────────────────────────────────────────────────
const iconPaths = {
  check: ['M20 6L9 17l-5-5'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  zap: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
  chevronDown: ['M6 9l6 6 6-6'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  star: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'],
};

function Icon({ name, size = 16, color = 'currentColor', sw = 2 }) {
  const paths = iconPaths[name];
  if (!paths) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className="block shrink-0">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

// ── Plan Card ──────────────────────────────────────────────────────────────
function PlanCard({ plan, billing, currentPlanId, currentBilling, onSelect }) {
  const isCurrentPlan = plan.id === currentPlanId;
  const isCurrent = isCurrentPlan && billing === currentBilling;
  const price = plan.price[billing];
  const discount = yearlyDiscount(plan);
  const [btnHovered, setBtnHovered] = useState(false);

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-[20px] border p-6 transition-all duration-200',
        plan.highlight
          ? 'border-[#0099CC] bg-white shadow-[0_8px_40px_rgba(0,153,204,0.18)]'
          : 'border-[rgba(0,100,180,0.12)] bg-white hover:border-[rgba(0,153,204,0.4)] hover:shadow-[0_4px_20px_rgba(0,100,180,0.1)]'
      )}
    >
      {/* Badge */}
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-[linear-gradient(135deg,#0099CC,#7C3AED)] px-3 py-1 text-[11px] font-bold text-white shadow-[0_2px_8px_rgba(0,153,204,0.4)]">
            {plan.badge}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-[#0D1B2A]">{plan.name}</h3>
          {isCurrentPlan && (
            <span className="rounded-full border border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.1)] px-2.5 py-0.5 text-[11px] font-semibold text-[#059669]">
              {isCurrent ? '현재 이용 중' : '이용 중'}
            </span>
          )}
        </div>
        <p className="mt-1 text-[13px] text-[#5A6F8A]">{plan.tagline}</p>
      </div>

      {/* Price */}
      <div className="mb-6">
        {price === 0 ? (
          <span className="text-[36px] font-bold tracking-[-1px] text-[#0D1B2A]">무료</span>
        ) : (
          <div className="flex items-end gap-1">
            <span className="text-[36px] font-bold tracking-[-1px] text-[#0D1B2A]">
              {price.toLocaleString('ko-KR')}
            </span>
            <span className="mb-1.5 text-[14px] text-[#5A6F8A]">원 / 월</span>
          </div>
        )}
        {billing === 'yearly' && discount > 0 && (
          <p className="mt-1 text-[12px] text-[#0099CC] font-medium">연간 결제 시 {discount}% 할인</p>
        )}
      </div>

      {/* Features */}
      <ul className="mb-6 flex flex-col gap-2.5">
        {plan.features.map((f) => (
          <li key={f.label} className="flex items-center gap-2.5">
            <span className={cn(
              'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full',
              f.included
                ? 'bg-[rgba(0,153,204,0.1)] text-[#0099CC]'
                : 'bg-[rgba(90,111,138,0.08)] text-[#8A9AB0]'
            )}>
              {f.included
                ? <Icon name="check" size={11} sw={2.5} />
                : <Icon name="x" size={10} sw={2.5} />}
            </span>
            <span className={cn('text-[13px]', f.included ? 'text-[#0D1B2A]' : 'text-[#8A9AB0]')}>
              {f.label}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={() => onSelect(plan, billing)}
        onMouseEnter={() => !isCurrent && setBtnHovered(true)}
        onMouseLeave={() => setBtnHovered(false)}
        className="mt-auto w-full rounded-[10px] py-3 text-[14px] font-semibold transition-all duration-200"
        style={
          isCurrent
            ? { background: '#F1F4F8', color: '#8A9AB0', cursor: 'not-allowed' }
            : btnHovered
              ? { background: 'linear-gradient(135deg,#0099CC,#7C3AED)', color: 'white', border: 'none', boxShadow: '0 4px 16px rgba(0,153,204,0.35)' }
              : { background: 'white', color: '#0099CC', border: '1px solid rgba(0,100,180,0.2)' }
        }
      >
        {isCurrent ? '현재 이용 중' : isCurrentPlan ? `${billing === 'monthly' ? '월간' : '연간'}으로 변경` : plan.name === '무료' ? '무료로 시작' : `${plan.name} 시작하기`}
      </button>
    </div>
  );
}

// ── Feature Comparison Table ───────────────────────────────────────────────
const CATEGORY_COLORS = ['#0099CC', '#7C3AED', '#059669', '#F59E0B'];

// 텍스트 값의 품질 등급 — 높을수록 더 진한 색으로 표시
const VALUE_TIER = {
  '무제한': 3,
  '고급': 2,
  '최대 5명': 2,
  '4시간': 2,
  '15회': 1,
  '30분': 1,
  '기본': 1,
  '5회': 1,
};

const PLAN_META = {
  free: {
    name: '무료',
    headerColor: '#0D1B2A',
    color: '#8A9AB0',
    colBg: 'rgba(16,185,129,0.03)',
    headerBg: 'rgba(16,185,129,0.06)',
    borderTop: '#10B981',
    checkFill: 'rgba(16,185,129,0.15)',
    checkIcon: '#10B981',
    pillBg: 'rgba(16,185,129,0.1)',
    pillColor: '#10B981',
  },
  pro: {
    name: '프로',
    headerColor: '#0099CC',
    color: '#0099CC',
    colBg: 'rgba(0,153,204,0.028)',
    headerBg: 'rgba(0,153,204,0.07)',
    borderTop: '#0099CC',
    checkFill: '#0099CC',
    checkIcon: 'white',
    pillBg: 'rgba(0,153,204,0.1)',
    pillColor: '#0099CC',
  },
  team: {
    name: '팀',
    headerColor: '#7C3AED',
    color: '#7C3AED',
    colBg: 'rgba(124,58,237,0.025)',
    headerBg: 'rgba(124,58,237,0.06)',
    borderTop: '#7C3AED',
    checkFill: '#7C3AED',
    checkIcon: 'white',
    pillBg: 'rgba(124,58,237,0.1)',
    pillColor: '#7C3AED',
  },
};

function ComparisonTable({ isMobile, billing }) {
  const Cell = ({ value, planId }) => {
    const m = PLAN_META[planId];

    // false: 모든 플랜 동일하게 회색 X
    if (value === false) return (
      <div className="inline-flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'rgba(0,0,0,0.04)' }}>
        <Icon name="x" size={11} color="#C9D4DE" sw={2} />
      </div>
    );

    // true: 플랜별 색상 채운 원 + 체크
    if (value === true) return (
      <div
        className="inline-flex h-7 w-7 items-center justify-center rounded-full"
        style={{
          background: m.checkFill,
          boxShadow: m.borderTop ? `0 2px 8px ${m.checkFill}55` : 'none',
        }}
      >
        <Icon name="check" size={13} color={m.checkIcon} sw={2.5} />
      </div>
    );

    // 텍스트: 등급에 따라 채도 다르게
    const tier = VALUE_TIER[value] ?? 1;
    const isSolid = tier >= 3; // '무제한' 등 최상위만 solid fill
    const isMedium = tier === 2; // '고급', '최대 3명' 등
    return (
      <span
        className="inline-block rounded-full px-3 py-0.5 text-[12px] font-bold"
        style={{
          background: isSolid ? m.checkFill : m.pillBg,
          color: isSolid ? m.checkIcon : m.pillColor,
          opacity: isMedium ? 1 : tier === 1 ? 0.75 : 1,
        }}
      >
        {value}
      </span>
    );
  };

  if (isMobile) {
    return (
      <div className="flex flex-col gap-5">
        {FEATURE_COMPARISON.map((group, gi) => (
          <div key={group.category} className="overflow-hidden rounded-[14px] border border-[rgba(0,100,180,0.1)] bg-white shadow-[0_2px_12px_rgba(0,100,180,0.06)]">
            {/* Category header */}
            <div className="flex items-center gap-2.5 border-b border-[rgba(0,100,180,0.08)] px-4 py-3" style={{ background: `${CATEGORY_COLORS[gi]}08` }}>
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[gi] }} />
              <span className="text-[13px] font-bold text-[#0D1B2A]">{group.category}</span>
            </div>
            {/* Plan name row */}
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr] border-b border-[rgba(0,100,180,0.06)] px-4 py-2">
              <div />
              {['free', 'pro', 'team'].map((planId) => (
                <div key={planId} className="flex justify-center rounded-[6px] py-0.5" style={{ background: PLAN_META[planId].borderTop ? `${PLAN_META[planId].borderTop}12` : 'transparent' }}>
                  <span className="text-[11px] font-bold" style={{ color: PLAN_META[planId].headerColor }}>
                    {PLAN_META[planId].name}
                  </span>
                </div>
              ))}
            </div>
            {/* Feature rows */}
            {group.rows.map((row, i) => (
              <div key={row.feature} className={cn('grid grid-cols-[1fr_1fr_1fr_1fr] items-center px-4 py-3.5', i !== 0 && 'border-t border-[rgba(0,100,180,0.05)]')}>
                <p className="pr-2 text-[12px] text-[#5A6F8A] leading-snug">{row.feature}</p>
                {['free', 'pro', 'team'].map((planId) => (
                  <div key={planId} className="flex justify-center rounded-[6px] py-1" style={{ background: PLAN_META[planId].colBg }}>
                    <Cell value={row[planId]} planId={planId} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[20px] border border-[rgba(0,100,180,0.12)] bg-white shadow-[0_4px_24px_rgba(0,100,180,0.08)]">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="w-[38%] border-b border-[rgba(0,100,180,0.1)] bg-[#F8FAFF] py-5 pl-7 pr-4 text-left text-[12px] font-semibold uppercase tracking-wider text-[#8A9AB0]">
              기능
            </th>
            {PLANS.map((p) => {
              const meta = PLAN_META[p.id];
              const price = p.price[billing ?? 'monthly'];
              return (
                <th
                  key={p.id}
                  className="border-b border-[rgba(0,100,180,0.1)] py-5 px-4 text-center"
                  style={{
                    background: meta.headerBg,
                    borderTop: meta.borderTop ? `3px solid ${meta.borderTop}` : undefined,
                  }}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    {p.badge && (
                      <span className="mb-1 rounded-full bg-[linear-gradient(135deg,#0099CC,#7C3AED)] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-[0_1px_6px_rgba(0,153,204,0.4)]">
                        {p.badge}
                      </span>
                    )}
                    <span className="text-[16px] font-bold" style={{ color: meta.headerColor }}>
                      {p.name}
                    </span>
                    <span className="text-[11px] font-medium text-[#8A9AB0]">
                      {price === 0 ? '무료' : `${price.toLocaleString('ko-KR')}원/월`}
                    </span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {FEATURE_COMPARISON.map((group, gi) => (
            <>
              <tr key={group.category} className={cn('border-b border-[rgba(0,100,180,0.06)]', gi > 0 && 'border-t-2 border-t-[rgba(0,100,180,0.07)]')}>
                <td className="py-3 pl-7" style={{ background: `${CATEGORY_COLORS[gi]}07` }}>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[gi] }} />
                    <span className="text-[13px] font-bold text-[#0D1B2A]">{group.category}</span>
                  </div>
                </td>
                {['free', 'pro', 'team'].map((planId) => (
                  <td key={planId} className="py-3" style={{ background: PLAN_META[planId].colBg }} />
                ))}
              </tr>
              {group.rows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={cn(
                    'border-b border-[rgba(0,100,180,0.05)] transition-colors hover:bg-[rgba(238,243,255,0.35)]',
                    i === group.rows.length - 1 && 'border-b-0'
                  )}
                >
                  <td className="py-4 pl-10 pr-4 text-[13px] text-[#5A6F8A]">{row.feature}</td>
                  {['free', 'pro', 'team'].map((planId) => (
                    <td key={planId} className="py-4 px-4 text-center" style={{ background: PLAN_META[planId].colBg }}>
                      <div className="flex justify-center">
                        <Cell value={row[planId]} planId={planId} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── FAQ Accordion ──────────────────────────────────────────────────────────
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[rgba(0,100,180,0.08)] last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-[15px] font-semibold text-[#0D1B2A]">{q}</span>
        <span className={cn('shrink-0 text-[#0099CC] transition-transform duration-200', open && 'rotate-180')}>
          <Icon name="chevronDown" size={18} />
        </span>
      </button>
      {open && (
        <p className="pb-5 text-[14px] leading-relaxed text-[#5A6F8A]">{a}</p>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Subscription() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [billing, setBilling] = useState('monthly');
  const [alreadyMsg, setAlreadyMsg] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const alreadyMsgTimer = useRef(null);
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(localStorage.getItem('tiki_access_token')));
  const [currentPlanId, setCurrentPlanId] = useState(() => {
    try {
      const raw = localStorage.getItem('tiki_user');
      return raw ? (JSON.parse(raw).planId ?? 'free') : 'free';
    } catch {
      return 'free';
    }
  });
  const [currentBilling, setCurrentBilling] = useState(() => {
    try {
      const raw = localStorage.getItem('tiki_user');
      return raw ? (JSON.parse(raw).billing ?? 'monthly') : 'monthly';
    } catch {
      return 'monthly';
    }
  });

  // auth 상태 변화 반응
  useEffect(() => {
    const sync = () => setIsLoggedIn(Boolean(localStorage.getItem('tiki_access_token')));
    window.addEventListener('tiki-auth-changed', sync);
    return () => window.removeEventListener('tiki-auth-changed', sync);
  }, []);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useLayoutEffect(() => {
    const resetTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    resetTop();
    const raf = requestAnimationFrame(resetTop);
    const timer = setTimeout(resetTop, 0);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [location.key]);

  // 로그인 상태면 API에서 실제 플랜 조회
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPlanLoading(true);
      getSubscription()
        .then((sub) => {
          if (cancelled) return;
          setCurrentPlanId(sub.plan_id);
          setCurrentBilling(sub.billing ?? 'monthly');
        })
        .catch(() => {
          // Keep the locally cached plan if the subscription lookup fails.
        })
        .finally(() => {
          if (!cancelled) setPlanLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isLoggedIn]);

  // 언마운트 시 타이머 정리
  useEffect(() => () => clearTimeout(alreadyMsgTimer.current), []);

  const showAlreadyMsg = (msg) => {
    setAlreadyMsg(msg);
    clearTimeout(alreadyMsgTimer.current);
    alreadyMsgTimer.current = setTimeout(() => setAlreadyMsg(''), 2500);
  };

  const saveLocalSubscription = (subscription) => {
    try {
      const raw = localStorage.getItem('tiki_user');
      const user = raw ? JSON.parse(raw) : {};
      localStorage.setItem('tiki_user', JSON.stringify({
        ...user,
        isSubscribed: subscription.plan_id !== 'free',
        planId: subscription.plan_id,
        billing: subscription.billing,
        nextBillingAt: subscription.next_billing_at,
        currentPeriodStartedAt: subscription.current_period_started_at || subscription.updated_at,
        currentPeriodEndsAt: subscription.current_period_ends_at || subscription.next_billing_at,
      }));
      window.dispatchEvent(new Event('tiki-auth-changed'));
    } catch {
      // 서버 구독 정보가 원본이므로 로컬 캐시 저장 실패는 무시한다.
    }
  };

  const handleSelectPlan = async (plan, selectedBilling) => {
    if (isLoggedIn) {
      const currentTier = PLAN_TIER[currentPlanId] ?? 0;
      const selectedTier = PLAN_TIER[plan.id] ?? 0;
      const isSameSubscription = plan.id === currentPlanId && selectedBilling === currentBilling;
      if (isSameSubscription) {
        const currentPlan = PLANS.find(p => p.id === currentPlanId);
        showAlreadyMsg(`이미 ${currentPlan?.name} 플랜을 이용 중입니다`);
        return;
      }
      // Downgrading (including to Free, i.e. cancelling) removes access rather
      // than adding it, so it doesn't need a real charge — apply it directly
      // instead of a payment flow. This used to just refuse and tell people to
      // go to 마이페이지, which itself only ever bounced back here.
      if (selectedTier < currentTier) {
        const activePlan = PLANS.find((p) => p.id === currentPlanId);
        const confirmed = window.confirm(
          plan.id === 'free'
            ? `구독을 해지하고 무료 플랜으로 전환할까요? 유료 기능(${activePlan?.name} 플랜 전용 기능 포함)을 더 이상 사용할 수 없습니다.`
            : `${activePlan?.name}에서 ${plan.name} 플랜으로 변경할까요? 다운그레이드는 즉시 적용되며, 상위 플랜 전용 기능을 더 이상 사용할 수 없습니다.`
        );
        if (!confirmed) return;
        try {
          const subscription = await subscribePlan({ planId: plan.id, billing: selectedBilling });
          saveLocalSubscription(subscription);
          setCurrentPlanId(subscription.plan_id);
          setCurrentBilling(subscription.billing ?? selectedBilling);
          showAlreadyMsg(plan.id === 'free' ? '구독이 해지되었습니다' : '플랜이 변경되었습니다');
        } catch (error) {
          showAlreadyMsg(error.message || '플랜 변경에 실패했습니다');
        }
        return;
      }
    }

    // 비로그인 → 로그인 페이지로 보내고 구독 페이지로 돌아오게
    if (!isLoggedIn) {
      navigate('/login', { state: { from: '/subscription' } });
      return;
    }

    // 무료 플랜 변경 → 결제 없이 서버에 즉시 저장
    if (plan.price.monthly === 0) {
      try {
        const subscription = await subscribePlan({ planId: plan.id, billing: selectedBilling });
        saveLocalSubscription(subscription);
        navigate('/subscription/complete', { state: { plan, billing: selectedBilling, subscription, paidAmount: 0 } });
      } catch (error) {
        showAlreadyMsg(error.message || '구독 정보를 변경하지 못했습니다');
      }
      return;
    }

    sessionStorage.setItem('tiki_subscription_checkout', JSON.stringify({
      planId: plan.id,
      billing: selectedBilling,
    }));
    navigate('/subscription/checkout', { state: { plan, billing: selectedBilling } });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFF]">
      {/* 이미 이용 중 토스트 */}
      {alreadyMsg && (
        <div className="pointer-events-none fixed left-1/2 top-6 z-[9999] -translate-x-1/2">
          <div className="flex items-center gap-2.5 rounded-full bg-[#0D1B2A] px-5 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
            <Icon name="check" size={14} color="#10B981" sw={2.5} />
            <span className="text-[13px] font-semibold text-white">{alreadyMsg}</span>
          </div>
        </div>
      )}
      <Header isMobile={isMobile} />

      <main className={cn('mx-auto max-w-[1080px]', isMobile ? 'px-4 pb-28 pt-24' : 'px-6 pb-20 pt-28')}>

        {/* ── Hero ── */}
        <section className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[rgba(0,153,204,0.2)] bg-[rgba(0,153,204,0.06)] px-4 py-1.5">
            <Icon name="zap" size={13} color="#0099CC" />
            <span className="text-[12px] font-semibold text-[#0099CC]">지금 바로 시작할 수 있어요</span>
          </div>
          <h1 className={cn('font-bold tracking-[-1.5px] text-[#0D1B2A]', isMobile ? 'text-[28px]' : 'text-[40px]')}>
            나에게 맞는 플랜을 선택하세요
          </h1>
          <p className={cn('mx-auto mt-3 text-[#5A6F8A]', isMobile ? 'text-[14px]' : 'text-[16px] max-w-[500px]')}>
            회의 분석부터 업무 자동화까지, TIKI와 함께 더 스마트하게
          </p>

          {/* Billing Toggle */}
          <div className="mt-8 inline-flex items-center gap-1 rounded-[10px] border border-[rgba(0,100,180,0.12)] bg-white p-1 shadow-[0_2px_8px_rgba(0,100,180,0.06)]">
            {['monthly', 'yearly'].map((b) => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                className={cn(
                  'rounded-[7px] px-5 py-2 text-[13px] font-semibold transition-all duration-200',
                  billing === b
                    ? 'bg-[#0099CC] text-white shadow-[0_2px_8px_rgba(0,153,204,0.3)]'
                    : 'text-[#5A6F8A] hover:text-[#0D1B2A]'
                )}
              >
                {b === 'monthly' ? '월간' : '연간'}
                {b === 'yearly' && (
                  <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold', billing === 'yearly' ? 'bg-white text-[#0099CC]' : 'bg-[rgba(0,153,204,0.1)] text-[#0099CC]')}>
                    20% 할인
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* ── Plan Cards ── */}
        <section className={cn('relative mb-16 grid gap-5', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
          {planLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[20px] bg-[rgba(248,250,255,0.7)] backdrop-blur-[2px]">
              <svg className="h-7 w-7 animate-spin text-[#0099CC]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billing={billing}
              currentPlanId={currentPlanId}
              currentBilling={currentBilling}
              onSelect={handleSelectPlan}
            />
          ))}
        </section>

        {/* ── Trust badges ── */}
        <section className={cn('mb-16 grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
          {[
            { icon: 'shield', title: '안전한 결제', desc: 'SSL 암호화로 카드 정보를 안전하게 보호합니다.' },
            { icon: 'zap', title: '즉시 이용 가능', desc: '결제 완료 후 바로 모든 기능을 사용할 수 있습니다.' },
            { icon: 'users', title: '언제든지 취소', desc: '약정 없이 언제든지 구독을 변경하거나 취소할 수 있습니다.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3 rounded-[12px] border border-[rgba(0,100,180,0.08)] bg-white px-5 py-4">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#EEF3FF]">
                <Icon name={icon} size={17} color="#0099CC" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#0D1B2A]">{title}</p>
                <p className="mt-0.5 text-[12px] text-[#5A6F8A]">{desc}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ── Feature Comparison ── */}
        <section className="mb-16">
          <h2 className={cn('mb-2 font-bold tracking-[-0.5px] text-[#0D1B2A]', isMobile ? 'text-[20px]' : 'text-[26px]')}>
            플랜별 기능 비교
          </h2>
          <p className="mb-8 text-[14px] text-[#5A6F8A]">어떤 플랜이 나에게 맞는지 한눈에 확인하세요.</p>
          <ComparisonTable isMobile={isMobile} billing={billing} />
        </section>

        {/* ── FAQ ── */}
        <section className="mb-16">
          <h2 className={cn('mb-2 font-bold tracking-[-0.5px] text-[#0D1B2A]', isMobile ? 'text-[20px]' : 'text-[26px]')}>
            자주 묻는 질문
          </h2>
          <p className="mb-8 text-[14px] text-[#5A6F8A]">궁금한 점이 있으시면 아래에서 확인해보세요.</p>
          <div className="rounded-[16px] border border-[rgba(0,100,180,0.1)] bg-white px-6">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} {...item} />
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className={cn('rounded-[20px] bg-[linear-gradient(135deg,#0099CC,#7C3AED)] p-1')}>
          <div className={cn('rounded-[18px] bg-[linear-gradient(135deg,rgba(0,153,204,0.95),rgba(124,58,237,0.95))] text-center', isMobile ? 'px-6 py-10' : 'px-12 py-14')}>
            <h2 className={cn('font-bold tracking-[-1px] text-white', isMobile ? 'text-[22px]' : 'text-[30px]')}>
              지금 바로 시작해보세요
            </h2>
            <p className="mx-auto mt-3 max-w-[400px] text-[14px] text-[rgba(255,255,255,0.8)]">
              무료 플랜으로 시작해서 필요할 때 언제든지 업그레이드하세요.
            </p>
            <div className={cn('mt-8 flex justify-center gap-3', isMobile && 'flex-col items-center')}>
              <button
                onClick={() => handleSelectPlan(PLANS[0], billing)}
                className="rounded-[10px] bg-white px-7 py-3 text-[14px] font-bold text-[#0099CC] shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-all duration-200 hover:shadow-[0_6px_24px_rgba(0,0,0,0.2)] hover:opacity-95"
              >
                무료로 시작하기
              </button>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="rounded-[10px] border border-[rgba(255,255,255,0.4)] px-7 py-3 text-[14px] font-semibold text-white transition-all duration-200 hover:bg-[rgba(255,255,255,0.1)]"
              >
                플랜 보기
              </button>
            </div>
          </div>
        </section>
      </main>

      {!isMobile && <Footer />}
      {isMobile && <MobileTab />}
    </div>
  );
}
