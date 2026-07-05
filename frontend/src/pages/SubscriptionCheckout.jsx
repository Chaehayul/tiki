import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { PLANS, COUPON_CODES, applyCoupon, formatPrice } from '../data/subscriptionPlans';
import { getTossCheckoutConfig, subscribePlan } from '../api/apiClient';

const CUSTOMER_KEY_STORAGE = 'tiki_toss_customer_key';

function getOrCreateCustomerKey() {
  try {
    const raw = localStorage.getItem('tiki_user');
    const user = raw ? JSON.parse(raw) : null;
    if (user?.id) return String(user.id);
  } catch {
    // fall through to a locally generated key
  }
  let key = localStorage.getItem(CUSTOMER_KEY_STORAGE);
  if (!key) {
    key = `guest_${crypto.randomUUID()}`;
    localStorage.setItem(CUSTOMER_KEY_STORAGE, key);
  }
  return key;
}

const cn = (...c) => c.filter(Boolean).join(' ');
const CHECKOUT_KEY = 'tiki_subscription_checkout';

const iconPaths = {
  check: ['M20 6L9 17l-5-5'],
  lock: ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  creditCard: ['M2 9h20', 'M1 5h22a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M5 15h2M9 15h2'],
  arrowLeft: ['M19 12H5', 'M12 19l-7-7 7-7'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
  zap: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
  tag: ['M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z', 'M7 7h.01'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
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

function StepIndicator({ current }) {
  const steps = ['플랜 선택', '결제', '완료'];
  return (
    <div className="flex items-center justify-center">
      {steps.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold transition-all',
                done ? 'bg-[#0099CC] text-white'
                  : active ? 'bg-[linear-gradient(135deg,#0099CC,#7C3AED)] text-white shadow-[0_2px_10px_rgba(0,153,204,0.4)]'
                    : 'border-2 border-[rgba(0,100,180,0.15)] bg-white text-[#8A9AB0]',
              )}>
                {done ? <Icon name="check" size={14} color="white" sw={2.5} /> : step}
              </div>
              <span className={cn('text-[11px] font-semibold', active || done ? 'text-[#0099CC]' : 'text-[#8A9AB0]')}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('mx-3 mb-5 h-[2px] w-12 rounded-full', done ? 'bg-[#0099CC]' : 'bg-[rgba(0,100,180,0.12)]')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CouponInput({ onApply, applied, onRemove }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleApply = () => {
    const upper = code.trim().toUpperCase();
    if (!upper) {
      setError('쿠폰 코드를 입력해주세요.');
      return;
    }
    const coupon = COUPON_CODES[upper];
    if (!coupon) {
      setError('사용할 수 없는 쿠폰 코드입니다.');
      return;
    }
    setError('');
    onApply({ code: upper, ...coupon });
    setCode('');
  };

  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-[10px] border border-[rgba(5,150,105,0.3)] bg-[rgba(5,150,105,0.06)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon name="tag" size={14} color="#059669" />
          <span className="text-[13px] font-semibold text-[#059669]">{applied.code}</span>
          <span className="text-[12px] text-[#5A6F8A]">{applied.label} 적용됨</span>
        </div>
        <button type="button" onClick={onRemove} className="text-[#8A9AB0] transition-colors hover:text-[#EF4444]" aria-label="쿠폰 삭제">
          <Icon name="x" size={15} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <div className={cn('flex flex-1 items-center gap-2 rounded-[10px] border px-3 py-2.5 transition-colors', error ? 'border-[#EF4444]' : 'border-[rgba(0,100,180,0.15)] focus-within:border-[#0099CC]')}>
          <Icon name="tag" size={14} color="#8A9AB0" />
          <input
            type="text"
            placeholder="쿠폰 코드 입력"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApply())}
            className="min-w-0 flex-1 bg-transparent text-[13px] uppercase tracking-wider text-[#0D1B2A] outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-[#C0CAD4]"
          />
        </div>
        <button type="button" onClick={handleApply} className="shrink-0 rounded-[10px] bg-[#0D1B2A] px-4 py-2.5 text-[13px] font-bold text-white transition-all hover:bg-[#0099CC]">
          적용
        </button>
      </div>
      {error && <p className="mt-1.5 text-[12px] text-[#EF4444]">{error}</p>}
    </div>
  );
}

function readCheckoutState(routeState) {
  if (routeState?.plan) return routeState;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CHECKOUT_KEY) || 'null');
    const plan = PLANS.find((item) => item.id === parsed?.planId);
    return plan ? { plan, billing: parsed.billing || 'monthly' } : null;
  } catch {
    return null;
  }
}

export default function SubscriptionCheckout() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const checkoutState = useMemo(() => readCheckoutState(state), [state]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  const [coupon, setCoupon] = useState(null);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!checkoutState?.plan) {
      navigate('/subscription', { replace: true });
      return;
    }
    if (!localStorage.getItem('tiki_access_token')) {
      navigate('/login', { state: { from: '/subscription' }, replace: true });
      return;
    }
    sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify({
      planId: checkoutState.plan.id,
      billing: checkoutState.billing || 'monthly',
    }));
  }, [checkoutState, navigate]);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  if (!checkoutState?.plan) return null;

  const plan = checkoutState.plan;
  const billing = checkoutState.billing || 'monthly';
  const billingLabel = billing === 'monthly' ? '월' : '년';
  const chargeTotal = billing === 'yearly' ? plan.price.yearly * 12 : plan.price.monthly;
  const annualSaving = billing === 'yearly' && plan.price.monthly > 0 ? (plan.price.monthly - plan.price.yearly) * 12 : 0;
  const couponDiscount = applyCoupon(chargeTotal, coupon);
  const finalPrice = Math.max(0, chargeTotal - couponDiscount);

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
      // Local cache sync is best-effort; the server subscription is already saved.
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreed) {
      setErrors({ agreed: '이용약관에 동의해주세요.' });
      return;
    }
    setErrors({});
    setLoading(true);
    setSubmitError('');

    // A plan/coupon combination that comes out to 0 needs no real charge —
    // Toss doesn't accept a 0-amount payment request, so just activate it directly.
    if (finalPrice <= 0) {
      try {
        const subscription = await subscribePlan({ planId: plan.id, billing });
        saveLocalSubscription(subscription);
        sessionStorage.removeItem(CHECKOUT_KEY);
        navigate('/subscription/complete', {
          replace: true,
          state: { plan, billing, subscription, paidAmount: 0 },
        });
      } catch (error) {
        setSubmitError(error.message || '구독 처리에 실패했습니다. 잠시 후 다시 시도해주세요.');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const { clientKey } = await getTossCheckoutConfig();
      if (!clientKey) throw new Error('결제 설정이 완료되지 않았습니다. 잠시 후 다시 시도해주세요.');
      if (!window.TossPayments) throw new Error('결제 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');

      const tossPayments = window.TossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: getOrCreateCustomerKey() });
      const orderId = `tiki_${plan.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const successParams = new URLSearchParams({ planId: plan.id, billing }).toString();

      // requestPayment redirects the browser to Toss's hosted payment page —
      // nothing after this call runs on the success path; the actual charge is
      // only finalized once /subscription/checkout/success confirms it with our
      // backend (see SubscriptionCheckoutSuccess.jsx).
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: finalPrice },
        orderId,
        orderName: `TIKI ${plan.name} 플랜 (${billingLabel} 구독)`,
        successUrl: `${window.location.origin}/subscription/checkout/success?${successParams}`,
        failUrl: `${window.location.origin}/subscription/checkout/fail`,
      });
    } catch (error) {
      if (error?.code === 'USER_CANCEL') {
        // Visitor closed the Toss payment window — not a real failure.
      } else {
        setSubmitError(error.message || '결제 요청에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFF]">
      <Header isMobile={isMobile} />
      <main className={cn('mx-auto max-w-[900px]', isMobile ? 'px-4 pb-12 pt-24' : 'px-6 pb-16 pt-28')}>
        <div className="mb-8"><StepIndicator current={2} /></div>

        <div className={cn('grid gap-6', isMobile ? 'grid-cols-1' : 'grid-cols-[1fr_340px]')}>
          <div className="order-2 md:order-1">
            <form onSubmit={handleSubmit} noValidate className="rounded-[20px] border border-[rgba(0,100,180,0.12)] bg-white p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[17px] font-bold text-[#0D1B2A]">결제 정보</h2>
                  <p className="mt-1 text-[12px] text-[#8A9AB0]">
                    {finalPrice > 0 ? '토스페이먼츠 결제창에서 카드 정보를 입력합니다.' : '결제 없이 바로 구독이 시작됩니다.'}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(0,153,204,0.08)] px-3 py-1 text-[12px] font-semibold text-[#0099CC]">
                  <Icon name="lock" size={12} />
                  안전 결제
                </span>
              </div>

              {finalPrice > 0 && (
                <div className="mb-5 flex items-center gap-3 rounded-[12px] border border-[rgba(0,100,180,0.12)] bg-[#F8FAFF] px-4 py-3.5">
                  <Icon name="creditCard" size={18} color="#0099CC" />
                  <span className="text-[13px] text-[#5A6F8A]">
                    "결제하기" 버튼을 누르면 <span className="font-semibold text-[#0D1B2A]">토스페이먼츠</span> 결제창으로 이동해요. 카드 정보는 TIKI 서버에 저장되지 않습니다.
                  </span>
                </div>
              )}

              <div className="mb-5">
                <p className="mb-2 text-[13px] font-semibold text-[#0D1B2A]">쿠폰 / 할인 코드</p>
                <CouponInput applied={coupon} onApply={setCoupon} onRemove={() => setCoupon(null)} />
              </div>

              <label className={cn('mb-5 flex cursor-pointer items-start gap-3 rounded-[10px] border p-3.5 transition-colors', agreed ? 'border-[rgba(0,153,204,0.3)] bg-[rgba(0,153,204,0.04)]' : errors.agreed ? 'border-[#EF4444]' : 'border-[rgba(0,100,180,0.12)]')}>
                <button
                  type="button"
                  onClick={() => { setAgreed((v) => !v); setErrors((prev) => ({ ...prev, agreed: '' })); }}
                  className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border-2 transition-all', agreed ? 'border-[#0099CC] bg-[#0099CC]' : 'border-[rgba(0,100,180,0.3)] bg-white')}
                  aria-label="약관 동의"
                >
                  {agreed && <Icon name="check" size={11} color="white" sw={2.5} />}
                </button>
                <span className="text-[13px] leading-relaxed text-[#5A6F8A]">
                  <span className="font-semibold text-[#0D1B2A]">이용약관</span> 및 <span className="font-semibold text-[#0D1B2A]">개인정보처리방침</span>에 동의합니다. 구독은 선택한 결제 주기마다 자동 갱신됩니다.
                </span>
              </label>
              {errors.agreed && <p className="-mt-3 mb-4 text-[12px] text-[#EF4444]">{errors.agreed}</p>}
              {submitError && <p className="mb-4 rounded-[10px] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[12px] font-medium text-[#DC2626]">{submitError}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[12px] bg-[linear-gradient(135deg,#0099CC,#7C3AED)] py-4 text-[15px] font-bold text-white shadow-[0_4px_16px_rgba(0,153,204,0.35)] transition-all duration-200 hover:shadow-[0_6px_24px_rgba(0,153,204,0.45)] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? '이동 중...'
                  : finalPrice > 0
                    ? `${formatPrice(finalPrice)} 결제하고 구독 시작`
                    : '구독 시작하기'}
              </button>

              <button type="button" onClick={() => navigate('/subscription')} className="mt-3 flex w-full items-center justify-center gap-1.5 py-2 text-[13px] text-[#8A9AB0] transition-colors hover:text-[#5A6F8A]">
                <Icon name="arrowLeft" size={14} />
                플랜 다시 선택
              </button>
            </form>
          </div>

          <aside className="order-1 md:order-2">
            <div className="sticky top-28 rounded-[20px] border border-[rgba(0,100,180,0.12)] bg-white p-6">
              <h3 className="mb-5 text-[15px] font-bold text-[#0D1B2A]">주문 요약</h3>
              <div className="mb-5 flex items-center gap-3 rounded-[12px] bg-[#EEF3FF] p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#0099CC,#7C3AED)]">
                  <Icon name="zap" size={18} color="white" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-[#0D1B2A]">TIKI {plan.name} 플랜</p>
                  <p className="text-[12px] text-[#5A6F8A]">{billing === 'monthly' ? '월간 구독' : '연간 구독'}</p>
                </div>
              </div>

              <div className="mb-5 flex flex-col gap-2.5 border-b border-[rgba(0,100,180,0.08)] pb-5">
                <div className="flex justify-between gap-4 text-[13px]">
                  <span className="text-[#5A6F8A]">{plan.name} 플랜</span>
                  <span className="font-medium text-[#0D1B2A]">{billing === 'yearly' ? `${formatPrice(plan.price.monthly * 12)} / 년` : `${formatPrice(chargeTotal)} / 월`}</span>
                </div>
                {annualSaving > 0 && (
                  <div className="flex justify-between gap-4 text-[13px]">
                    <span className="text-[#059669]">연간 할인</span>
                    <span className="font-medium text-[#059669]">-{formatPrice(annualSaving)} / 년</span>
                  </div>
                )}
                {coupon && couponDiscount > 0 && (
                  <div className="flex items-center justify-between gap-4 text-[13px]">
                    <span className="flex items-center gap-1 text-[#7C3AED]"><Icon name="tag" size={12} color="#7C3AED" />쿠폰 ({coupon.code})</span>
                    <span className="font-medium text-[#7C3AED]">-{formatPrice(couponDiscount)}</span>
                  </div>
                )}
              </div>

              <div className="mb-5 flex justify-between gap-4">
                <span className="text-[14px] font-bold text-[#0D1B2A]">총 결제 금액</span>
                <div className="text-right">
                  {coupon && couponDiscount > 0 && <p className="text-[12px] text-[#8A9AB0] line-through">{formatPrice(chargeTotal)}</p>}
                  <span className="text-[16px] font-bold text-[#0099CC]">{formatPrice(finalPrice)}{finalPrice > 0 ? ` / ${billingLabel}` : ''}</span>
                </div>
              </div>

              <div className="rounded-[10px] bg-[#F8FAFF] p-4">
                <p className="mb-3 text-[12px] font-semibold text-[#5A6F8A]">포함 기능</p>
                <ul className="flex flex-col gap-2">
                  {plan.features.filter((f) => f.included).slice(0, 5).map((f) => (
                    <li key={f.label} className="flex items-center gap-2 text-[12px] text-[#0D1B2A]">
                      <Icon name="check" size={12} color="#0099CC" sw={2.5} />
                      {f.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
