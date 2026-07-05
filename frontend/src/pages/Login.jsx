import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loginUser, saveAuthSession } from '../api/apiClient';
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
    alertTriangle: [
        'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0-3.42 0z',
        'M12 9v4',
        'M12 17h.01',
    ],
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
    github: [
        'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22',
    ],
    check: ['M20 6L9 17l-5-5'],
    shieldCheck: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
    clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
    users: [
        'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
        'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
        'M22 21v-2a4 4 0 0 0-3-3.87',
        'M16 3.13a4 4 0 0 1 0 7.75',
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

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const redirectTo = location.state?.from ?? '/upload';
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, []);

    useEffect(() => {
        if (localStorage.getItem('tiki_access_token')) {
            navigate(redirectTo, { replace: true });
        }
    }, [navigate, redirectTo]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setError('이메일과 비밀번호를 모두 입력해주세요.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('올바른 이메일 형식이 아닙니다.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const authResponse = await loginUser({ email, password });
            saveAuthSession(authResponse);
            sessionStorage.removeItem('tiki_flash_toast');
            navigate(redirectTo, { replace: true });
        } catch (err) {
            setError(err.message || '로그인에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleFillDemoCredentials = () => {
        setError('');
        setEmail('demo@tiki.app');
        setPassword('TikiDemo2026!');
    };

    return (
        <div
            className="relative flex min-h-screen flex-col items-center justify-center bg-[#F0F4FF] px-4 pb-10 pt-24"
        >
            <AuthHeader />

            {/* Subtle grid background */}
            <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(0,100,180,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(0,100,180,.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
            {/* Ambient blobs */}
            <div className="pointer-events-none fixed left-[-120px] top-[-80px] z-0 h-80 w-80 rounded-full bg-[#0099CC]/10 blur-3xl" />
            <div className="pointer-events-none fixed bottom-[-80px] right-[-120px] z-0 h-80 w-80 rounded-full bg-[#7C3AED]/10 blur-3xl" />

            {/* ── Main Card ── */}
            <div className="relative z-[1] w-full max-w-[420px] rounded-[20px] border border-[rgba(0,100,180,.12)] bg-white px-8 py-8 shadow-[0_4px_32px_rgba(0,60,150,.10)]">
                {/* Heading */}
                <div className="mb-6 text-center">
                    <h1 className="mb-1 text-[22px] font-bold tracking-[-0.5px] text-[#0D1B2A]">
                        다시 만나서{' '}
                        <span className="bg-[linear-gradient(90deg,#0099CC,#7C3AED)] bg-clip-text text-transparent">
                            반가워요
                        </span>
                    </h1>
                    <p className="text-[13px] text-[#5A6F8A]">회의록과 작업을 이어가세요</p>
                </div>

                {/* Demo account — fills the fields below, doesn't log in automatically */}
                <button
                    type="button"
                    onClick={handleFillDemoCredentials}
                    className="mb-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[linear-gradient(135deg,#0099CC_0%,#7C3AED_100%)] py-[13px] text-[14px] font-bold text-white shadow-[0_4px_20px_rgba(0,153,204,.20)] transition-all duration-200 hover:-translate-y-0.5"
                >
                    <Icon name="zap" size={15} color="#fff" />
                    데모 계정 정보 자동입력
                </button>

                {/* Social buttons */}
                <div className="mb-5 flex flex-col gap-2.5">
                    <button
                        type="button"
                        className="flex cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-[rgba(0,100,180,.14)] bg-white py-[11px] text-[13px] font-semibold text-[#0D1B2A] transition-colors hover:bg-[#EEF3FF]"
                    >
                        <GoogleIcon size={17} />
                        Google로 계속하기
                    </button>
                    <button
                        type="button"
                        className="flex cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-[rgba(0,100,180,.14)] bg-white py-[11px] text-[13px] font-semibold text-[#0D1B2A] transition-colors hover:bg-[#EEF3FF]"
                    >
                        <Icon name="github" size={17} color="#0D1B2A" />
                        GitHub로 계속하기
                    </button>
                </div>

                {/* Divider */}
                <div className="mb-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-[rgba(0,100,180,.10)]" />
                    <span className="text-[12px] font-medium text-[#5A6F8A]">또는 이메일로 로그인</span>
                    <div className="h-px flex-1 bg-[rgba(0,100,180,.10)]" />
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                    {/* Email */}
                    <div>
                        <label htmlFor="email" className="mb-1.5 block text-[13px] font-semibold text-[#0D1B2A]">
                            이메일
                        </label>
                        <div className="relative">
                            <div className="pointer-events-none absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] bg-white shadow-[0_1px_4px_rgba(0,60,150,.10)]">
                                <Icon name="mail" size={15} color="#0099CC" />
                            </div>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full rounded-xl border border-transparent bg-[#EEF3FF] py-[11px] pl-12 pr-4 text-sm text-[#0D1B2A] outline-none transition-all duration-200 placeholder:text-[#5A6F8A]/60 focus:border-[rgba(0,153,204,.5)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,153,204,.12)]"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <div className="mb-1.5 flex items-center justify-between">
                            <label htmlFor="password" className="text-[13px] font-semibold text-[#0D1B2A]">
                                비밀번호
                            </label>
                            <button type="button" className="text-[12px] font-semibold text-[#0099CC] hover:underline">
                                비밀번호 찾기
                            </button>
                        </div>
                        <div className="relative">
                            <div className="pointer-events-none absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] bg-white shadow-[0_1px_4px_rgba(0,60,150,.10)]">
                                <Icon name="lock" size={15} color="#7C3AED" />
                            </div>
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full rounded-xl border border-transparent bg-[#EEF3FF] py-[11px] pl-12 pr-11 text-sm text-[#0D1B2A] outline-none transition-all duration-200 placeholder:text-[#5A6F8A]/60 focus:border-[rgba(0,153,204,.5)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,153,204,.12)]"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer text-[#5A6F8A] transition-colors hover:text-[#0099CC]"
                                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                            >
                                <EyeIcon open={showPassword} />
                            </button>
                        </div>
                    </div>

                    {/* Remember me */}
                    <div className="flex flex-col gap-1.5">
                        <button
                            type="button"
                            onClick={() => setRemember((v) => !v)}
                            className="flex cursor-pointer items-center gap-2 self-start"
                            aria-pressed={remember}
                        >
                            <span
                                className={cn(
                                    'flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-colors',
                                    remember ? 'border-[#0099CC] bg-[#0099CC]' : 'border-[rgba(0,100,180,.25)] bg-white'
                                )}
                            >
                                {remember && <Icon name="check" size={12} color="#fff" sw={3} />}
                            </span>
                            <span className="text-[13px] text-[#5A6F8A]">로그인 상태 유지</span>
                        </button>
                        {remember && (
                            <p className="flex items-center gap-1.5 pl-[26px] text-[12px] text-[#B45309]">
                                <Icon name="alertTriangle" size={12} color="#F59E0B" />
                                공용 기기에서는 사용을 권장하지 않습니다
                            </p>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-start gap-2 rounded-xl border border-[rgba(239,68,68,.2)] bg-[rgba(239,68,68,.06)] px-4 py-3">
                            <Icon name="alertCircle" size={16} color="#EF4444" />
                            <span className="text-[13px] text-[#DC2626]">{error}</span>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[linear-gradient(135deg,#0099CC_0%,#7C3AED_100%)] px-4 py-[13px] text-[15px] font-bold text-white shadow-[0_4px_20px_rgba(0,153,204,.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(124,58,237,.3)] disabled:translate-y-0 disabled:opacity-70"
                    >
                        {loading ? (
                            <>
                                <Icon name="loader" size={17} color="#fff" className="animate-spin" />
                                로그인 중...
                            </>
                        ) : (
                            <>
                                로그인
                                <Icon name="arrowRight" size={16} color="#fff" />
                            </>
                        )}
                    </button>
                </form>

                {/* Sign up */}
                <p className="mt-5 text-center text-[13px] text-[#5A6F8A]">
                    아직 계정이 없으신가요?{' '}
                    <button
                        type="button"
                        onClick={() => navigate('/signup')}
                        className="cursor-pointer font-semibold text-[#0099CC] hover:underline"
                    >
                        무료로 시작하기
                    </button>
                </p>
            </div>

            {/* ── Trust badges (below card) ── */}
            <div className="relative z-[1] mt-5 flex flex-wrap justify-center gap-2">
                {[
                    { icon: 'lock', text: '종단간 암호화', color: '#0099CC' },
                    { icon: 'shieldCheck', text: '2단계 인증', color: '#10B981' },
                    { icon: 'clock', text: '24시간 접근', color: '#7C3AED' },
                    { icon: 'users', text: '1,200+ 팀 사용 중', color: '#F59E0B' },
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
