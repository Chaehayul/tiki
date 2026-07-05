import { useNavigate, useSearchParams } from 'react-router-dom';

const FAIL_MESSAGES = {
  USER_CANCEL: '결제가 취소되었습니다.',
  PAY_PROCESS_CANCELED: '결제가 취소되었습니다.',
};

export default function SubscriptionCheckoutFail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const message = searchParams.get('message');
  const displayMessage = FAIL_MESSAGES[code] || message || '결제를 완료하지 못했습니다.';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFF] px-4">
      <div className="w-full max-w-[420px] rounded-[20px] border border-[rgba(0,100,180,0.12)] bg-white p-8 text-center shadow-[0_16px_48px_rgba(0,100,180,0.1)]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(239,68,68,0.1)]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </div>
        <h1 className="mb-2 text-[18px] font-bold text-[#0D1B2A]">결제가 완료되지 않았어요</h1>
        <p className="mb-6 text-[13px] text-[#5A6F8A]">{displayMessage}</p>
        <button
          onClick={() => navigate('/subscription/checkout')}
          className="mb-2.5 w-full rounded-[12px] bg-[linear-gradient(135deg,#0099CC,#7C3AED)] py-3.5 text-[14px] font-bold text-white"
        >
          다시 시도하기
        </button>
        <button
          onClick={() => navigate('/subscription')}
          className="w-full rounded-[12px] border border-[rgba(0,100,180,0.15)] py-3.5 text-[14px] font-semibold text-[#5A6F8A]"
        >
          요금제로 돌아가기
        </button>
      </div>
    </div>
  );
}
