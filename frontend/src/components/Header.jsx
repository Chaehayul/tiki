import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

// ── Icons ────────────────────────────────────────────────────────────────────
const iconPaths = {
    fileAudio: [
        'M17.5 22h.5a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3',
        'M14 2v4a2 2 0 0 0 2 2h4',
        'M9 17v-5',
        'M12 17v-3',
        'M15 17v-1',
    ],
    layoutDashboard: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
    fileText: [
        'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
        'M14 2v6h6',
        'M16 13H8',
        'M16 17H8',
        'M10 9H8',
    ],
    creditCard: [
        'M2 9h20',
        'M1 5h22a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
        'M5 15h2M9 15h2',
    ],
    zap: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
    user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
    settings: [
        'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
        'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
    ],
    helpCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01'],
    logOut: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
    menu: ['M3 12h18', 'M3 6h18', 'M3 18h18'],
    x: ['M18 6L6 18', 'M6 6l12 12'],
    book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
    chevronDown: ['M6 9l6 6 6-6'],
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
            {paths.map((d, i) => (
                <path key={i} d={d} />
            ))}
        </svg>
    );
}

// ── Status Pill ───────────────────────────────────────────────────────────────
const pillClasses = {
    UPLOADING: 'border-[rgba(245,158,11,.3)] bg-[rgba(245,158,11,.1)] text-[#B45309]',
    PROCESSING: 'border-[rgba(0,153,204,.5)] bg-[rgba(0,153,204,.1)] text-[#0099CC]',
    COMPLETED: 'border-[rgba(16,185,129,.3)] bg-[rgba(16,185,129,.1)] text-[#059669]',
    FAILED: 'border-[rgba(239,68,68,.25)] bg-[rgba(239,68,68,.08)] text-[#DC2626]',
};

function StatusPill({ phase, stateLabels, isMobile }) {
    if (!phase || phase === 'IDLE') return null;
    return (
        <div
            className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-bold uppercase tracking-[0.3px]',
                isMobile ? 'text-[11px]' : 'text-xs',
                pillClasses[phase]
            )}
        >
            <span
                className={cn(
                    'h-[7px] w-[7px] shrink-0 rounded-full bg-current',
                    phase === 'PROCESSING' || phase === 'UPLOADING' ? 'animate-pulseDot' : ''
                )}
            />
            {stateLabels?.[phase]}
        </div>
    );
}

// ── Profile Dropdown ──────────────────────────────────────────────────────────
function ProfileDropdown({ user, onLogout }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const initials = user?.name
        ? user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()
        : 'U';

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-full border border-[rgba(0,100,180,0.12)] bg-white px-1 py-1 transition-all duration-150 hover:border-[rgba(0,153,204,0.5)] hover:shadow-[0_0_0_3px_rgba(0,153,204,0.08)] focus:outline-none"
                aria-label="프로필 메뉴"
            >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0099CC,#7C3AED)] text-[11px] font-bold text-white">
                    {initials}
                </div>
                <span className={cn('transition-transform duration-200', open ? 'rotate-180' : '')}>
                    <Icon name="chevronDown" size={14} color="#5A6F8A" />
                </span>
            </button>

            {open && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 overflow-hidden rounded-[12px] border border-[rgba(0,100,180,0.12)] bg-white shadow-[0_8px_32px_rgba(0,100,180,0.12)]">
                    {/* User info */}
                    <div className="border-b border-[rgba(0,100,180,0.08)] px-4 py-3">
                        <p className="text-[13px] font-semibold text-[#0D1B2A]">{user?.name ?? '사용자'}</p>
                        <p className="mt-0.5 text-[12px] text-[#5A6F8A]">{user?.email ?? ''}</p>
                    </div>

                    {/* Menu items */}
                    <div className="py-1.5">
                        {[
                            { icon: 'user', label: '마이페이지', to: '/mypage' },
                            { icon: 'helpCircle', label: '고객센터 / 문서', to: '/docs' },
                        ].map(({ icon, label, to }) => (
                            <Link
                                key={label}
                                to={to}
                                onClick={() => setOpen(false)}
                                className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#0D1B2A] no-underline transition-colors hover:bg-[#EEF3FF]"
                            >
                                <Icon name={icon} size={15} color="#5A6F8A" />
                                {label}
                            </Link>
                        ))}
                    </div>

                    <div className="border-t border-[rgba(0,100,180,0.08)] py-1.5">
                        <button
                            onClick={() => {
                                setOpen(false);
                                onLogout?.();
                            }}
                            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#EF4444] transition-colors hover:bg-[rgba(239,68,68,0.06)]"
                        >
                            <Icon name="logOut" size={15} color="#EF4444" />
                            로그아웃
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Mobile Side Menu ──────────────────────────────────────────────────────────
function MobileSideMenu({ open, onClose, isLoggedIn, isSubscribed, onLogout }) {
    // Trap focus + lock scroll while open
    useEffect(() => {
        if (open) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    const publicLinks = [
        { icon: 'zap', label: '기능 소개', to: '/landing' },
        { icon: 'creditCard', label: '요금제', to: '#pricing' },
    ];

    const authLinks = [
        { icon: 'fileAudio', label: '업로드', to: '/upload' },
        { icon: 'layoutDashboard', label: '프로젝트', to: '/project-list' },
        { icon: 'creditCard', label: isSubscribed ? '구독중' : '구독', to: '/mypage' },
    ];

    const links = isLoggedIn ? authLinks : publicLinks;

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    'fixed inset-0 z-40 bg-[rgba(13,27,42,0.4)] backdrop-blur-[2px] transition-opacity duration-300',
                    open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                )}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Panel */}
            <div
                className={cn(
                    'fixed right-0 top-0 z-50 w-[280px] bg-white shadow-[-8px_0_32px_rgba(0,100,180,0.12)] transition-transform duration-300 ease-[cubic-bezier(.32,.72,0,1)] flex flex-col',
                    open ? 'translate-x-0' : 'translate-x-full'
                )}
                style={{ height: 'calc(100% - 60px - env(safe-area-inset-bottom, 0px))' }}
            >
                {/* Panel header */}
                <div className="flex shrink-0 items-center justify-between border-b border-[rgba(0,100,180,0.08)] px-5 py-4">
                    <span className="text-[15px] font-bold tracking-[-0.5px] text-[#0D1B2A]">
                        <span className="text-[#0099CC]">TI</span>KI
                    </span>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[#5A6F8A] transition-colors hover:bg-[#EEF3FF] hover:text-[#0D1B2A]"
                        aria-label="메뉴 닫기"
                    >
                        <Icon name="x" size={18} />
                    </button>
                </div>

                {/* Nav links */}
                <nav className="flex-1 overflow-y-auto py-3">
                    {links.map(({ icon, label, to }) => (
                        <Link
                            key={label}
                            to={to}
                            onClick={onClose}
                            className="flex items-center gap-3 px-5 py-3 text-[14px] font-medium text-[#0D1B2A] no-underline transition-colors hover:bg-[#EEF3FF] hover:text-[#0099CC]"
                        >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#EEF3FF] text-[#0099CC]">
                                <Icon name={icon} size={16} color="currentColor" />
                            </span>
                            {label}
                        </Link>
                    ))}
                </nav>

                {/* Bottom CTA */}
                <div className="shrink-0 border-t border-[rgba(0,100,180,0.08)] px-5 py-4 pb-8">
                    {isLoggedIn ? (
                        <button
                            onClick={() => {
                                onClose();
                                onLogout?.();
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)] py-2.5 text-[14px] font-semibold text-[#EF4444]"
                        >
                            <Icon name="logOut" size={15} color="currentColor" />
                            로그아웃
                        </button>
                    ) : (
                        <Link
                            to="/login"
                            onClick={onClose}
                            className="flex w-full items-center justify-center rounded-[8px] bg-[linear-gradient(135deg,#0099CC,#7C3AED)] py-2.5 text-[14px] font-semibold text-white no-underline"
                        >
                            무료로 시작하기
                        </Link>
                    )}
                </div>
            </div>
        </>
    );
}

// ── Main Header ───────────────────────────────────────────────────────────────
/**
 * Props:
 *   isMobile   boolean
 *   isLoggedIn boolean
 *   phase      'IDLE' | 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
 *   stateLabels { UPLOADING: string, ... }
 *   user        { name: string, email: string }
 *   isSubscribed boolean
 *   onLogout    () => void
 */
export default function Header({ isMobile, isLoggedIn, phase, stateLabels, user, isSubscribed, onLogout }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const subscribed = typeof isSubscribed === 'boolean' ? isSubscribed : Boolean(user?.isSubscribed);

    const desktopLoggedOutLinks = [
        { label: '기능 소개', to: '/landing' },
        { label: '요금제', to: '#pricing' },
    ];

    const desktopLoggedInLinks = [
        { label: '업로드', to: '/upload' },
        { label: '프로젝트', to: '/project-list' },
        { label: subscribed ? '구독중' : '구독', to: '/mypage' },
    ];

    return (
        <>
            <header
                className={cn(
                    'fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-[rgba(0,100,180,0.12)] bg-[rgba(248,250,255,0.92)] backdrop-blur-[12px]',
                    isMobile ? 'px-4 py-[14px]' : 'px-12 py-5'
                )}
            >
                {/* ── Logo ── */}
                <Link
                    to={isLoggedIn ? '/dashboard' : '/'}
                    className="flex items-center gap-2.5 text-[#0D1B2A] no-underline"
                >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#0099CC,#7C3AED)]">
                        <Icon name="fileAudio" size={20} color="#fff" sw={2} />
                    </div>
                    <span className="text-[22px] font-bold tracking-[-1px]">
                        <span className="text-[#0099CC]">TI</span>KI
                    </span>
                </Link>

                {/* ── Right side ── */}
                <nav className="flex items-center gap-1">
                    {!isMobile && (
                        <>
                            {(isLoggedIn ? desktopLoggedInLinks : desktopLoggedOutLinks).map(({ label, to }) => (
                                <Link
                                    key={label}
                                    to={to}
                                    className="rounded-[6px] px-[14px] py-[6px] text-sm text-[#5A6F8A] no-underline transition-colors duration-200 hover:bg-[#EEF3FF] hover:text-[#0D1B2A]"
                                >
                                    {label}
                                </Link>
                            ))}
                        </>
                    )}

                    {/* Status pill (non-mobile only to save space) */}
                    {!isMobile && <StatusPill phase={phase} stateLabels={stateLabels} isMobile={false} />}

                    {/* Logged-in: profile avatar */}
                    {isLoggedIn && !isMobile && (
                        <div className="ml-1">
                            <ProfileDropdown user={user} onLogout={onLogout} />
                        </div>
                    )}

                    {/* Logged-out: CTA */}
                    {!isLoggedIn && !isMobile && (
                        <Link
                            to="/login"
                            className="ml-1 rounded-[6px] border border-[rgba(0,153,204,.5)] bg-[rgba(0,153,204,.08)] px-[14px] py-[6px] text-sm font-semibold text-[#0099CC] no-underline transition-colors hover:bg-[rgba(0,153,204,.15)]"
                        >
                            무료 시작
                        </Link>
                    )}

                    {/* Mobile: status pill + hamburger */}
                    {isMobile && (
                        <>
                            <StatusPill phase={phase} stateLabels={stateLabels} isMobile />
                            <button
                                onClick={() => setMobileOpen(true)}
                                className="ml-1 flex h-9 w-9 items-center justify-center rounded-[8px] text-[#0D1B2A] transition-colors hover:bg-[#EEF3FF]"
                                aria-label="메뉴 열기"
                            >
                                <Icon name="menu" size={22} />
                            </button>
                        </>
                    )}
                </nav>
            </header>

            {/* Mobile drawer */}
            {isMobile && (
                <MobileSideMenu
                    open={mobileOpen}
                    onClose={() => setMobileOpen(false)}
                    isLoggedIn={isLoggedIn}
                    isSubscribed={subscribed}
                    onLogout={onLogout}
                />
            )}
        </>
    );
}
