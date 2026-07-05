import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PLANS } from '../data/subscriptionPlans';
import { confirmTossPayment } from '../api/apiClient';

const iconPaths = {
  loader: [
    'M12 2v4', 'M12 18v4', 'M4.93 4.93l2.83 2.83', 'M16.24 16.24l2.83 2.83',
    'M2 12h4', 'M18 12h4', 'M4.93 19.07l2.83-2.83', 'M16.24 7.76l2.83-2.83',
  ],
  alertCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 8v4', 'M12 16h.01'],
};

function Icon({ name, size = 16, color = 'currentColor', sw = 2, className }) {
  const paths = iconPaths[name];
  if (!paths) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

function saveLocalSubscription(subscription) {
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
}

export default function SubscriptionCheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = Number(searchParams.get('amount'));
    const planId = searchParams.get('planId');
    const billing = searchParams.get('billing') || 'monthly';

    if (!paymentKey || !orderId || !amount || !planId) {
      setError('결제 정보를 확인할 수 없습니다.');
      return;
    }

    confirmTossPayment({ paymentKey, orderId, amount, planId, billing })
      .then((subscription) => {
        saveLocalSubscription(subscription);
        sessionStorage.removeItem('tiki_subscription_checkout');
        const plan = PLANS.find((item) => item.id === planId);
        navigate('/subscription/complete', {
          replace: true,
          state: { plan, billing, subscription, paidAmount: amount },
        });
      })
      .catch((err) => {
        setError(err.message || '결제 승인에 실패했습니다.');
      });
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFF] px-4">
      <div className="w-full max-w-[420px] rounded-[20px] border border-[rgba(0,100,180,0.12)] bg-white p-8 text-center shadow-[0_16px_48px_rgba(0,100,180,0.1)]">
        {error ? (
          <>
            <Icon name="alertCircle" size={40} color="#EF4444" className="mx-auto mb-4" />
            <h1 className="mb-2 text-[18px] font-bold text-[#0D1B2A]">결제 승인에 실패했어요</h1>
            <p className="mb-6 text-[13px] text-[#5A6F8A]">{error}</p>
            <button
              onClick={() => navigate('/subscription/checkout')}
              className="w-full rounded-[12px] bg-[linear-gradient(135deg,#0099CC,#7C3AED)] py-3.5 text-[14px] font-bold text-white"
            >
              다시 시도하기
            </button>
          </>
        ) : (
          <>
            <Icon name="loader" size={32} color="#0099CC" className="mx-auto mb-4 animate-spin" />
            <h1 className="mb-2 text-[16px] font-bold text-[#0D1B2A]">결제를 확인하고 있어요</h1>
            <p className="text-[13px] text-[#8A9AB0]">잠시만 기다려주세요...</p>
          </>
        )}
      </div>
    </div>
  );
}
