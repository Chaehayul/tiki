// ──────────────────────────────────────────────────────────────────────────────
// 구독 플랜 임시 데이터
// 가격·플랜명·기능은 확정 전이므로 이 파일만 수정하면 전체 반영됩니다.
// ──────────────────────────────────────────────────────────────────────────────

export const PLANS = [
  {
    id: 'free',
    name: '무료',
    tagline: '시작하는 개인 사용자',
    price: { monthly: 0, yearly: 0 },
    badge: null,
    highlight: false,
    ctaVariant: 'outline',
    features: [
      { label: '월 5회 회의 분석', included: true },
      { label: '음성 녹음 30분', included: true },
      { label: '기본 STT 전사', included: true },
      { label: 'AI 회의 요약', included: true },
      { label: '해야 할 일 자동 추출', included: false },
      { label: 'Jira / Notion 연동', included: false },
      { label: '화자 분리', included: false },
      { label: '팀원 초대', included: false },
    ],
  },
  {
    id: 'pro',
    name: '프로',
    tagline: '개인 전문가와 소규모 팀',
    price: { monthly: 19900, yearly: 15900 },
    badge: '인기',
    highlight: true,
    ctaVariant: 'primary',
    features: [
      { label: '월 15회 회의 분석', included: true },
      { label: '음성 녹음 4시간', included: true },
      { label: '고급 STT 전사 (병렬 처리)', included: true },
      { label: 'AI 회의 요약', included: true },
      { label: '해야 할 일 자동 추출', included: true },
      { label: 'Jira / Notion 연동', included: true },
      { label: '화자 분리', included: true },
      { label: '팀원 초대 (최대 5명)', included: true },
    ],
  },
  {
    id: 'team',
    name: '팀',
    tagline: '협업이 중요한 성장 팀',
    price: { monthly: 49900, yearly: 39900 },
    badge: null,
    highlight: false,
    ctaVariant: 'outline',
    features: [
      { label: '무제한 회의 분석', included: true },
      { label: '음성 녹음 무제한', included: true },
      { label: '고급 STT 전사 (병렬 처리)', included: true },
      { label: 'AI 회의 요약', included: true },
      { label: '해야 할 일 자동 추출', included: true },
      { label: 'Jira / Notion 연동', included: true },
      { label: '화자 분리', included: true },
      { label: '팀원 초대 (무제한)', included: true },
    ],
  },
];

export const FEATURE_COMPARISON = [
  {
    category: '전사 & 분석',
    rows: [
      { feature: '월 회의 분석 횟수', free: '5회', pro: '15회', team: '무제한' },
      { feature: '음성 녹음 길이', free: '30분', pro: '4시간', team: '무제한' },
      { feature: 'STT 전사 품질', free: '기본', pro: '고급', team: '고급' },
      { feature: '화자 분리', free: false, pro: true, team: true },
    ],
  },
  {
    category: 'AI 기능',
    rows: [
      { feature: 'AI 회의 요약', free: true, pro: true, team: true },
      { feature: '해야 할 일 자동 추출', free: false, pro: true, team: true },
      { feature: '해야 할 일 생성', free: false, pro: true, team: true },
    ],
  },
  {
    category: '연동 & 협업',
    rows: [
      { feature: 'Jira 연동', free: false, pro: true, team: true },
      { feature: 'Notion 연동', free: false, pro: true, team: true },
      { feature: '팀원 초대', free: false, pro: '최대 5명', team: '무제한' },
    ],
  },
  {
    category: '지원',
    rows: [
      { feature: '이메일 지원', free: true, pro: true, team: true },
    ],
  },
];

export const FAQ_ITEMS = [
  {
    q: '언제든지 구독을 취소할 수 있나요?',
    a: '네, 언제든지 취소 가능합니다. 취소 후에도 현재 결제 기간이 끝날 때까지 서비스를 계속 이용할 수 있습니다.',
  },
  {
    q: '연간 요금제와 월간 요금제의 차이가 무엇인가요?',
    a: '연간 요금제는 월간 대비 약 20% 할인된 가격으로 제공됩니다. 연간 요금은 한 번에 결제되며 환불 정책에 따라 처리됩니다.',
  },
  {
    q: '업그레이드하면 기존 데이터는 유지되나요?',
    a: '네, 기존에 분석된 회의 데이터, 해야 할 일, 연동 설정 모두 유지됩니다.',
  },
  {
    q: '팀 플랜에서 팀원 수를 변경할 수 있나요?',
    a: '언제든지 팀원을 추가하거나 제거할 수 있습니다. 요금은 다음 결제 주기에 정산됩니다.',
  },
  {
    q: '결제 수단은 무엇을 지원하나요?',
    a: '신용카드 및 체크카드(Visa, Mastercard, 국내 카드)를 지원합니다. 기업 고객의 경우 세금계산서 발행 및 계좌이체도 가능합니다.',
  },
];

// 쿠폰 코드 임시 데이터 — 추후 API(/api/v1/coupons/validate)로 교체
export const COUPON_CODES = {
  TIKI10:  { type: 'percent', value: 10,   label: '10% 할인' },
  TIKI20:  { type: 'percent', value: 20,   label: '20% 할인' },
  WELCOME: { type: 'fixed',   value: 5000, label: '5,000원 할인' },
};

export const applyCoupon = (price, coupon) => {
  if (!coupon || price === 0) return 0;
  if (coupon.type === 'percent') return Math.round(price * coupon.value / 100);
  return Math.min(coupon.value, price);
};

export const formatPrice = (price) =>
  price === 0 ? '무료' : price.toLocaleString('ko-KR') + '원';

export const yearlyDiscount = (plan) => {
  if (!plan.price.monthly || !plan.price.yearly) return 0;
  return Math.round((1 - plan.price.yearly / plan.price.monthly) * 100);
};
