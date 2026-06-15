import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthHeader from '../components/AuthHeader';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const iconPaths = {
    mail: ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'M22 6l-10 7L2 6'],
    lock: ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
    zap: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
    mic: ['M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v4', 'M8 23h8'],
    box: [
        'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
        'M3.27 6.96L12 12.01l8.73-5.05',
        'M12 22.08V12',
    ],
    checkCircle: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4L12 14.01l-3-3'],
    alertCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 8v4', 'M12 16h.01'],
    loader: [
        'M12 2v4',
        'M12 18v4',
        'M4.93 4.93l2.83 2.83',
        'M16.24 16.24l2.83 2.83',
        'M2 12h4',
        'M18 12h4',
        'M4.93 19.07l2.83-2.83',
        'M16.24 7.76l2.83-2.83',
    ],
    arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
    arrowLeft: ['M19 12H5', 'M12 19l-7-7 7-7'],
    github: [
        'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22',
    ],
    check: ['M20 6L9 17l-5-5'],
    shieldCheck: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
    user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
    briefcase: [
        'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z',
        'M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2',
    ],
    users: [
        'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
        'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
        'M22 21v-2a4 4 0 0 0-3-3.87',
        'M16 3.13a4 4 0 0 1 0 7.75',
    ],
    clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
    sparkles: [
        'M12 3L13.5 8.5H19L14.5 12L16 17.5L12 14L8 17.5L9.5 12L5 8.5H10.5L12 3Z',
        'M5 3L5.5 5H7L6 6L6.5 8L5 7L3.5 8L4 6L3 5H4.5L5 3Z',
        'M19 13L19.5 15H21L20 16L20.5 18L19 17L17.5 18L18 16L17 15H18.5L19 13Z',
    ],
    gift: [
        'M20 12v10H4V12',
        'M2 7h20v5H2z',
        'M12 22V7',
        'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z',
        'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
    ],
};

function Icon({ name, size = 16, color = 'currentColor', sw = 2, className }) {
    const paths = iconPaths[name];
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
            className={cn('block shrink-0', className)}
        >
            {paths.map((d, i) => (
                <path key={i} d={d} />
            ))}
        </svg>
    );
}

function EyeIcon({ open, size = 18, color = 'currentColor' }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="block shrink-0"
        >
            {open ? (
                <>
                    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                    <circle cx="12" cy="12" r="3" />
                </>
            ) : (
                <>
                    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                    <path d="m2 2 20 20" />
                </>
            )}
        </svg>
    );
}

function GoogleIcon({ size = 18 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="block shrink-0">
            <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path fill="#FBBC05" d="M5.84 14.09a6.97 6.97 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86z" />
            <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
        </svg>
    );
}

/* ── 비밀번호 강도 계산 ── */
function getPasswordStrength(pw) {
    if (!pw) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const levels = [
        { label: '', color: '' },
        { label: '취약', color: '#EF4444' },
        { label: '보통', color: '#F59E0B' },
        { label: '좋음', color: '#0099CC' },
        { label: '강함', color: '#10B981' },
    ];
    return { score, ...levels[score] };
}

/* ── 입력 필드 공통 컴포넌트 ── */
function Field({ id, label, iconName, iconColor = '#0099CC', error, hint, children, aside }) {
    return (
        <div>
            <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor={id} className="text-[13px] font-semibold text-[#0D1B2A]">
                    {label}
                </label>
                {aside}
            </div>
            <div className="relative">
                <div className="pointer-events-none absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] bg-white shadow-[0_1px_4px_rgba(0,60,150,.10)]">
                    <Icon name={iconName} size={15} color={iconColor} />
                </div>
                {children}
            </div>
            {error && (
                <p className="mt-1.5 flex items-center gap-1 text-[12px] text-[#DC2626]">
                    <Icon name="alertCircle" size={12} color="#EF4444" />
                    {error}
                </p>
            )}
            {hint && !error && <p className="mt-1.5 text-[12px] text-[#5A6F8A]">{hint}</p>}
        </div>
    );
}

const INPUT_BASE =
    'w-full rounded-xl border border-transparent bg-[#EEF3FF] py-[11px] pl-12 pr-4 text-sm text-[#0D1B2A] outline-none transition-all duration-200 placeholder:text-[#5A6F8A]/60 focus:border-[rgba(0,153,204,.5)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,153,204,.12)]';
const INPUT_ERROR =
    'border-[rgba(239,68,68,.4)] bg-[rgba(239,68,68,.04)] focus:border-[rgba(239,68,68,.5)] focus:shadow-[0_0_0_3px_rgba(239,68,68,.10)]';

/* ── 역할 선택 옵션 ── */
const ROLES = [
    { value: 'dev', label: '개발자', icon: 'zap', color: '#0099CC' },
    { value: 'pm', label: 'PM', icon: 'briefcase', color: '#7C3AED' },
    { value: 'design', label: '디자이너', icon: 'sparkles', color: '#F59E0B' },
    { value: 'other', label: '기타', icon: 'users', color: '#5A6F8A' },
];

/* ── 성공 화면 ── */
function SuccessScreen() {
    return (
        <div className="flex flex-col items-center py-4 text-center">
            <div className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[rgba(16,185,129,.2)] bg-[rgba(16,185,129,.08)]">
                <Icon name="checkCircle" size={36} color="#10B981" sw={1.8} />
            </div>
            <h2 className="mb-2 text-[20px] font-bold tracking-[-0.3px] text-[#0D1B2A]">가입 완료!</h2>
            <p className="mb-1 text-[13px] leading-[1.6] text-[#5A6F8A]">이메일로 인증 링크를 보냈어요.</p>
            <p className="mb-6 text-[13px] leading-[1.6] text-[#5A6F8A]">확인 후 Tiki를 바로 시작할 수 있어요.</p>
            <div className="mb-6 flex w-full flex-wrap justify-center gap-3 rounded-[14px] border border-[rgba(16,185,129,.15)] bg-[rgba(16,185,129,.06)] px-4 py-4">
                {[
                    { icon: 'mic', text: '화자 분리 무료 체험', color: '#0099CC' },
                    { icon: 'box', text: 'AI 요약 즉시 이용', color: '#7C3AED' },
                    { icon: 'checkCircle', text: 'Jira 연동 설정', color: '#10B981' },
                ].map(({ icon, text, color }) => (
                    <div key={text} className="flex items-center gap-1.5 text-[12px] text-[#5A6F8A]">
                        <Icon name={icon} size={13} color={color} />
                        {text}
                    </div>
                ))}
            </div>
            <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0099CC_0%,#7C3AED_100%)] py-[13px] text-[15px] font-bold text-white shadow-[0_4px_20px_rgba(0,153,204,.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(124,58,237,.3)]">
                Tiki 시작하기
                <Icon name="arrowRight" size={16} color="#fff" />
            </button>
        </div>
    );
}

/* ── 메인 컴포넌트 ── */
export default function SignUpPage() {
    const [step, setStep] = useState(1); // 1 | 2 | 'done'

    /* Step 1 */
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [s1Errors, setS1Errors] = useState({});

    /* Step 2 */
    const [password, setPassword] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [role, setRole] = useState('');
    const [agree, setAgree] = useState(false);
    const [s2Errors, setS2Errors] = useState({});
    const [loading, setLoading] = useState(false);

    const strength = getPasswordStrength(password);

    /* ── 유효성 검사 ── */
    const validateStep1 = () => {
        const errs = {};
        if (!name.trim()) errs.name = '이름을 입력해주세요.';
        if (!email) errs.email = '이메일을 입력해주세요.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = '올바른 이메일 형식이 아닙니다.';
        setS1Errors(errs);
        return Object.keys(errs).length === 0;
    };

    const validateStep2 = () => {
        const errs = {};
        if (!password) errs.password = '비밀번호를 입력해주세요.';
        else if (password.length < 8) errs.password = '비밀번호는 8자 이상이어야 합니다.';
        if (!confirmPw) errs.confirmPw = '비밀번호를 한 번 더 입력해주세요.';
        else if (password !== confirmPw) errs.confirmPw = '비밀번호가 일치하지 않아요.';
        if (!role) errs.role = '역할을 선택해주세요.';
        if (!agree) errs.agree = '이용약관에 동의해주세요.';
        setS2Errors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleNext = (e) => {
        e.preventDefault();
        if (validateStep1()) setStep(2);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validateStep2()) return;
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            setStep('done');
        }, 1600);
    };

    return (
        <div
            className="relative flex min-h-screen flex-col items-center justify-center bg-[#F0F4FF] px-4 pb-10 pt-24"
            style={{ fontFamily: "'Space Grotesk', -apple-system, sans-serif" }}
        >
            <style>
                {
                    "@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');"
                }
            </style>

            <AuthHeader />

            {/* 배경 */}
            <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(0,100,180,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(0,100,180,.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
            <div className="pointer-events-none fixed left-[-120px] top-[-80px] z-0 h-80 w-80 rounded-full bg-[#0099CC]/10 blur-3xl" />
            <div className="pointer-events-none fixed bottom-[-80px] right-[-120px] z-0 h-80 w-80 rounded-full bg-[#7C3AED]/10 blur-3xl" />

            {/* 카드 */}
            <div className="relative z-[1] w-full max-w-[420px] rounded-[20px] border border-[rgba(0,100,180,.12)] bg-white px-8 py-8 shadow-[0_4px_32px_rgba(0,60,150,.10)]">
                {step === 'done' ? (
                    <SuccessScreen />
                ) : (
                    <>
                        {/* 헤더 */}
                        <div className="mb-6 text-center">
                            <h1 className="mb-1 text-[22px] font-bold tracking-[-0.5px] text-[#0D1B2A]">
                                {step === 1 ? (
                                    <>
                                        Tiki와 함께{' '}
                                        <span className="bg-[linear-gradient(90deg,#0099CC,#7C3AED)] bg-clip-text text-transparent">
                                            시작해요
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        거의 다{' '}
                                        <span className="bg-[linear-gradient(90deg,#0099CC,#7C3AED)] bg-clip-text text-transparent">
                                            왔어요
                                        </span>
                                    </>
                                )}
                            </h1>
                            <p className="text-[13px] text-[#5A6F8A]">
                                {step === 1 ? '14일 무료 체험, 카드 등록 없이 시작' : '보안 설정과 역할을 선택하세요'}
                            </p>
                        </div>

                        {/* 스텝 인디케이터 */}
                        <div className="mb-6 flex items-center gap-2">
                            {[1, 2].map((s) => (
                                <div key={s} className="flex flex-1 flex-col gap-1.5">
                                    <div
                                        className={cn(
                                            'h-1 w-full rounded-full transition-all duration-300',
                                            step >= s
                                                ? 'bg-[linear-gradient(90deg,#0099CC,#7C3AED)]'
                                                : 'bg-[rgba(0,60,150,.10)]'
                                        )}
                                    />
                                    <span
                                        className={cn(
                                            'text-[11px] font-medium transition-colors',
                                            step >= s ? 'text-[#0099CC]' : 'text-[#5A6F8A]/50'
                                        )}
                                    >
                                        {s === 1 ? '기본 정보' : '보안 & 설정'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* ── STEP 1 ── */}
                        {step === 1 && (
                            <>
                                {/* 소셜 */}
                                <div className="mb-5 flex flex-col gap-2.5">
                                    <button
                                        type="button"
                                        className="flex items-center justify-center gap-2.5 rounded-xl border border-[rgba(0,100,180,.14)] bg-white py-[11px] text-[13px] font-semibold text-[#0D1B2A] transition-colors hover:bg-[#EEF3FF]"
                                    >
                                        <GoogleIcon size={17} />
                                        Google로 가입하기
                                    </button>
                                    <button
                                        type="button"
                                        className="flex items-center justify-center gap-2.5 rounded-xl border border-[rgba(0,100,180,.14)] bg-white py-[11px] text-[13px] font-semibold text-[#0D1B2A] transition-colors hover:bg-[#EEF3FF]"
                                    >
                                        <Icon name="github" size={17} color="#0D1B2A" />
                                        GitHub로 가입하기
                                    </button>
                                </div>

                                <div className="mb-5 flex items-center gap-3">
                                    <div className="h-px flex-1 bg-[rgba(0,100,180,.10)]" />
                                    <span className="text-[12px] font-medium text-[#5A6F8A]">또는 이메일로 가입</span>
                                    <div className="h-px flex-1 bg-[rgba(0,100,180,.10)]" />
                                </div>

                                <form onSubmit={handleNext} className="flex flex-col gap-4" noValidate>
                                    <Field
                                        id="name"
                                        label="이름"
                                        iconName="user"
                                        iconColor="#0099CC"
                                        error={s1Errors.name}
                                    >
                                        <input
                                            id="name"
                                            type="text"
                                            value={name}
                                            onChange={(e) => {
                                                setName(e.target.value);
                                                setS1Errors((p) => ({ ...p, name: '' }));
                                            }}
                                            placeholder="홍길동"
                                            className={cn(INPUT_BASE, s1Errors.name && INPUT_ERROR)}
                                        />
                                    </Field>

                                    <Field
                                        id="email"
                                        label="업무용 이메일"
                                        iconName="mail"
                                        iconColor="#0099CC"
                                        error={s1Errors.email}
                                        hint="팀 초대 및 알림을 이 이메일로 받아요"
                                    >
                                        <input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => {
                                                setEmail(e.target.value);
                                                setS1Errors((p) => ({ ...p, email: '' }));
                                            }}
                                            placeholder="you@company.com"
                                            className={cn(INPUT_BASE, s1Errors.email && INPUT_ERROR)}
                                        />
                                    </Field>

                                    <button
                                        type="submit"
                                        className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0099CC_0%,#7C3AED_100%)] py-[13px] text-[15px] font-bold text-white shadow-[0_4px_20px_rgba(0,153,204,.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(124,58,237,.3)]"
                                    >
                                        다음 단계
                                        <Icon name="arrowRight" size={16} color="#fff" />
                                    </button>
                                </form>
                            </>
                        )}

                        {/* ── STEP 2 ── */}
                        {step === 2 && (
                            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                                {/* 비밀번호 */}
                                <Field
                                    id="password"
                                    label="비밀번호"
                                    iconName="lock"
                                    iconColor="#7C3AED"
                                    error={s2Errors.password}
                                >
                                    <input
                                        id="password"
                                        type={showPw ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            setS2Errors((p) => ({ ...p, password: '' }));
                                        }}
                                        placeholder="8자 이상 입력"
                                        className={cn(INPUT_BASE, 'pr-11', s2Errors.password && INPUT_ERROR)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPw((v) => !v)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5A6F8A] transition-colors hover:text-[#0099CC]"
                                        aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 표시'}
                                    >
                                        <EyeIcon open={showPw} />
                                    </button>
                                </Field>

                                {/* 강도 바 */}
                                {password && (
                                    <div className="-mt-2">
                                        <div className="mb-1 flex gap-1">
                                            {[1, 2, 3, 4].map((i) => (
                                                <div
                                                    key={i}
                                                    className="h-1 flex-1 rounded-full transition-all duration-300"
                                                    style={{
                                                        backgroundColor:
                                                            i <= strength.score ? strength.color : 'rgba(0,60,150,.10)',
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <p className="text-[11px] font-medium" style={{ color: strength.color }}>
                                            비밀번호 강도: {strength.label}
                                        </p>
                                    </div>
                                )}

                                {/* 비밀번호 확인 */}
                                <Field
                                    id="confirmPw"
                                    label="비밀번호 확인"
                                    iconName="lock"
                                    iconColor="#7C3AED"
                                    error={s2Errors.confirmPw}
                                >
                                    <input
                                        id="confirmPw"
                                        type={showConfirm ? 'text' : 'password'}
                                        value={confirmPw}
                                        onChange={(e) => {
                                            setConfirmPw(e.target.value);
                                            setS2Errors((p) => ({ ...p, confirmPw: '' }));
                                        }}
                                        placeholder="비밀번호 재입력"
                                        className={cn(
                                            INPUT_BASE,
                                            'pr-11',
                                            s2Errors.confirmPw
                                                ? INPUT_ERROR
                                                : confirmPw && confirmPw === password
                                                  ? 'border-[rgba(16,185,129,.4)] focus:border-[rgba(16,185,129,.5)] focus:shadow-[0_0_0_3px_rgba(16,185,129,.10)]'
                                                  : ''
                                        )}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm((v) => !v)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5A6F8A] transition-colors hover:text-[#0099CC]"
                                        aria-label={showConfirm ? '비밀번호 숨기기' : '비밀번호 표시'}
                                    >
                                        <EyeIcon open={showConfirm} />
                                    </button>
                                    {confirmPw && confirmPw === password && (
                                        <div className="pointer-events-none absolute right-10 top-1/2 -translate-y-1/2">
                                            <Icon name="check" size={14} color="#10B981" sw={2.5} />
                                        </div>
                                    )}
                                </Field>

                                {/* 역할 선택 */}
                                <div>
                                    <label className="mb-2 block text-[13px] font-semibold text-[#0D1B2A]">
                                        팀에서의 역할
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {ROLES.map(({ value, label, icon, color }) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => {
                                                    setRole(value);
                                                    setS2Errors((p) => ({ ...p, role: '' }));
                                                }}
                                                className={cn(
                                                    'flex flex-col items-center gap-1.5 rounded-xl border py-3 text-[11px] font-semibold transition-all duration-150',
                                                    role === value
                                                        ? 'border-[rgba(0,153,204,.4)] bg-[rgba(0,153,204,.07)] text-[#0099CC] shadow-[0_0_0_2px_rgba(0,153,204,.15)]'
                                                        : 'border-[rgba(0,60,150,.10)] bg-[#F8FAFF] text-[#5A6F8A] hover:bg-[#EEF3FF]'
                                                )}
                                            >
                                                <span
                                                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                                                    style={{
                                                        backgroundColor:
                                                            role === value ? `${color}1A` : 'rgba(0,60,150,.06)',
                                                    }}
                                                >
                                                    <Icon
                                                        name={icon}
                                                        size={14}
                                                        color={role === value ? color : '#5A6F8A'}
                                                    />
                                                </span>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    {s2Errors.role && (
                                        <p className="mt-1.5 flex items-center gap-1 text-[12px] text-[#DC2626]">
                                            <Icon name="alertCircle" size={12} color="#EF4444" />
                                            {s2Errors.role}
                                        </p>
                                    )}
                                </div>

                                {/* 약관 동의 */}
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAgree((v) => !v);
                                            setS2Errors((p) => ({ ...p, agree: '' }));
                                        }}
                                        className="flex items-start gap-2 self-start text-left"
                                        aria-pressed={agree}
                                    >
                                        <span
                                            className={cn(
                                                'mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors',
                                                agree
                                                    ? 'border-[#0099CC] bg-[#0099CC]'
                                                    : 'border-[rgba(0,100,180,.25)] bg-white',
                                                s2Errors.agree && !agree && 'border-[#EF4444]'
                                            )}
                                        >
                                            {agree && <Icon name="check" size={12} color="#fff" sw={3} />}
                                        </span>
                                        <span className="text-[12px] leading-[1.6] text-[#5A6F8A]">
                                            <button
                                                type="button"
                                                className="font-semibold text-[#0099CC] hover:underline"
                                            >
                                                이용약관
                                            </button>{' '}
                                            및{' '}
                                            <button
                                                type="button"
                                                className="font-semibold text-[#0099CC] hover:underline"
                                            >
                                                개인정보처리방침
                                            </button>
                                            에 동의합니다
                                        </span>
                                    </button>
                                    {s2Errors.agree && (
                                        <p className="mt-1.5 flex items-center gap-1 pl-[26px] text-[12px] text-[#DC2626]">
                                            <Icon name="alertCircle" size={12} color="#EF4444" />
                                            {s2Errors.agree}
                                        </p>
                                    )}
                                </div>

                                {/* 버튼 */}
                                <div className="mt-1 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="flex items-center justify-center gap-1.5 rounded-xl border border-[rgba(0,60,150,.14)] bg-white px-4 py-[13px] text-[13px] font-semibold text-[#5A6F8A] transition-colors hover:bg-[#EEF3FF]"
                                    >
                                        <Icon name="arrowLeft" size={15} color="#5A6F8A" />
                                        이전
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0099CC_0%,#7C3AED_100%)] py-[13px] text-[15px] font-bold text-white shadow-[0_4px_20px_rgba(0,153,204,.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(124,58,237,.3)] disabled:translate-y-0 disabled:opacity-70"
                                    >
                                        {loading ? (
                                            <>
                                                <Icon name="loader" size={17} color="#fff" className="animate-spin" />
                                                가입 중...
                                            </>
                                        ) : (
                                            <>
                                                가입 완료
                                                <Icon name="arrowRight" size={16} color="#fff" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* 로그인 링크 */}
                        <p className="mt-5 text-center text-[13px] text-[#5A6F8A]">
                            이미 계정이 있으신가요?{' '}
                            <Link to="/login" className="font-semibold text-[#0099CC] hover:underline">
                                로그인
                            </Link>
                        </p>
                    </>
                )}
            </div>

            {/* 하단 트러스트 배지 */}
            <div className="relative z-[1] mt-5 flex flex-wrap justify-center gap-2">
                {[
                    { icon: 'gift', text: '14일 무료 체험', color: '#10B981' },
                    { icon: 'shieldCheck', text: '개인정보 암호화', color: '#0099CC' },
                    { icon: 'clock', text: '언제든 해지 가능', color: '#7C3AED' },
                ].map(({ icon, text, color }) => (
                    <div
                        key={text}
                        className="flex items-center gap-1.5 rounded-full border border-[rgba(0,60,150,.08)] bg-white/70 px-3 py-1.5 text-[11px] text-[#5A6F8A] backdrop-blur-sm"
                    >
                        <span
                            className="flex h-4 w-4 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${color}1A` }}
                        >
                            <Icon name={icon} size={10} color={color} />
                        </span>
                        {text}
                    </div>
                ))}
            </div>
        </div>
    );
}
