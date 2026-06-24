import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const iconPaths = {
    fileAudio: [
        'M17.5 22h.5a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3',
        'M14 2v4a2 2 0 0 0 2 2h4',
        'M9 17v-5',
        'M12 17v-3',
        'M15 17v-1',
    ],
};

const cn = (...classes) => classes.filter(Boolean).join(' ');

function Icon({ name, size = 16, color = 'currentColor', sw = 2 }) {
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
            className="block shrink-0"
        >
            {paths.map((d, index) => (
                <path key={index} d={d} />
            ))}
        </svg>
    );
}

export default function AuthHeader() {
    const { pathname } = useLocation();
    const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(localStorage.getItem('tiki_access_token')));
    const isAuthPage = pathname === '/login' || pathname === '/signup';
    const shouldShowGuestTabs = isAuthPage || !isLoggedIn;

    const authLinks = shouldShowGuestTabs
        ? [
              { label: '로그인', to: '/login' },
              { label: '회원가입', to: '/signup' },
          ]
        : [{ label: '대시보드', to: '/dashboard' }];

    useEffect(() => {
        const syncAuthSession = () => setIsLoggedIn(Boolean(localStorage.getItem('tiki_access_token')));
        window.addEventListener('storage', syncAuthSession);
        window.addEventListener('tiki-auth-changed', syncAuthSession);
        return () => {
            window.removeEventListener('storage', syncAuthSession);
            window.removeEventListener('tiki-auth-changed', syncAuthSession);
        };
    }, []);

    return (
        <header className="fixed left-0 right-0 top-0 z-50 border-b border-[rgba(0,100,180,0.12)] bg-[rgba(248,250,255,0.92)] backdrop-blur-[12px]">
            <div className="mx-auto flex min-h-16 w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:h-16 sm:flex-nowrap sm:px-6 sm:py-0 lg:px-10">
                {/* 로고 — 대시보드로 이동 */}
                <Link to="/dashboard" className="flex shrink-0 items-center gap-2.5 text-[#0D1B2A] no-underline">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#0099CC,#7C3AED)]">
                        <Icon name="fileAudio" size={20} color="#fff" />
                    </div>
                    <span className="text-[22px] font-bold tracking-[-1px]">
                        <span className="text-[#0099CC]">TI</span>KI
                    </span>
                </Link>

                {/* 로그인 / 회원가입 탭 */}
                <nav className="flex items-center gap-1">
                    {authLinks.map((link) => {
                        const active = pathname === link.to;
                        return (
                            <Link
                                key={link.label}
                                to={link.to}
                                className={cn(
                                    'rounded-[6px] px-[14px] py-[6px] text-sm font-semibold no-underline transition-colors duration-200',
                                    active
                                        ? 'border border-[rgba(0,153,204,0.5)] bg-[rgba(0,153,204,0.08)] text-[#0099CC]'
                                        : 'text-[#5A6F8A] hover:bg-[#EEF3FF] hover:text-[#0D1B2A]'
                                )}
                            >
                                {link.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </header>
    );
}
