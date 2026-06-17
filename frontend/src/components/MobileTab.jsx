import { useLocation, useNavigate } from 'react-router-dom';

const iconPaths = {
    home: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
    folder: ['M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'],
    plus: ['M12 5v14', 'M5 12h14'],
    user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
};

const cn = (...classes) => classes.filter(Boolean).join(' ');

function Icon({ name, size = 20, color = 'currentColor', sw = 1.8 }) {
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

const TABS = [
    { id: 'home', icon: 'home', label: '홈', to: '/dashboard' },
    { id: 'projects', icon: 'folder', label: '프로젝트', to: '/project-list' },
    { id: 'upload', icon: 'plus', label: '업로드', to: '/upload' },
    { id: 'mypage', icon: 'user', label: '마이페이지', to: '/mypage' },
];

/**
 * Props:
 *   active   string  — 현재 활성 탭 id
 *   onChange (id) => void
 */
export default function MobileTab({ active, onChange }) {
    const navigate = useNavigate();
    const location = useLocation();

    const routeActiveTab = TABS.find((tab) => location.pathname.startsWith(tab.to))?.id;
    const activeTab = routeActiveTab ?? active ?? 'home';

    return (
        <div
            className="fixed inset-x-0 bottom-0 z-[100] border-t border-[rgba(0,100,180,0.12)] bg-[rgba(248,250,255,0.94)] backdrop-blur-[16px]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
            <div className="grid grid-cols-4">
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const isUpload = tab.id === 'upload';

                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                onChange?.(tab.id);
                                navigate(tab.to);
                            }}
                            className={cn(
                                'relative flex flex-col items-center justify-center gap-1 py-3 transition-colors duration-150 focus:outline-none',
                                isActive ? (isUpload ? 'text-[#0099CC]' : 'text-[#0099CC]') : 'text-[#5A6F8A]'
                            )}
                        >
                            {/* 활성 인디케이터 — 상단 라인 */}
                            <span
                                className={cn(
                                    'absolute top-0 left-1/2 -translate-x-1/2 h-[2px] rounded-b-full transition-all duration-200',
                                    isActive ? 'w-8 bg-[#0099CC]' : 'w-0 bg-transparent'
                                )}
                            />

                            {/* 아이콘 래퍼 */}
                            <span
                                className={cn(
                                    'flex items-center justify-center rounded-[10px] transition-all duration-150',
                                    isUpload
                                        ? cn(
                                              'h-9 w-9',
                                              isActive ? 'bg-[rgba(0,153,204,0.12)]' : 'bg-[rgba(0,100,180,0.06)]'
                                          )
                                        : cn('h-9 w-9', isActive ? 'bg-[rgba(0,153,204,0.1)]' : '')
                                )}
                            >
                                <Icon
                                    name={tab.icon}
                                    size={isUpload ? 22 : 20}
                                    color={isActive ? '#0099CC' : '#5A6F8A'}
                                    sw={isUpload ? 2.4 : isActive ? 2.2 : 1.8}
                                />
                            </span>

                            {/* 레이블 */}
                            <span
                                className={cn(
                                    'text-[10px] leading-none tracking-[0.1px] transition-all duration-150',
                                    isActive ? 'font-bold text-[#0099CC]' : 'font-medium text-[#5A6F8A]'
                                )}
                            >
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
