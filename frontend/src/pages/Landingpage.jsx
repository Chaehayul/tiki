import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MobileTab from '../components/MobileTab';

// ─── Icon 컴포넌트 (lucide-react 의존성 제거, SVG 인라인) ───────────────────
function Icon({ name, size = 20, className = '' }) {
    const icons = {
        // 기존
        sparkles: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5 5 3Z" />
                <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z" />
            </svg>
        ),
        mic: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
        ),
        brain: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
            </svg>
        ),
        shield: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
        ),
        zap: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
        ),
        link: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
        ),
        upload: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
        ),
        cpu: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                <rect x="9" y="9" width="6" height="6" />
                <line x1="9" y1="1" x2="9" y2="4" />
                <line x1="15" y1="1" x2="15" y2="4" />
                <line x1="9" y1="20" x2="9" y2="23" />
                <line x1="15" y1="20" x2="15" y2="23" />
                <line x1="20" y1="9" x2="23" y2="9" />
                <line x1="20" y1="14" x2="23" y2="14" />
                <line x1="1" y1="9" x2="4" y2="9" />
                <line x1="1" y1="14" x2="4" y2="14" />
            </svg>
        ),
        database: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
        ),
        check: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <polyline points="20 6 9 17 4 12" />
            </svg>
        ),
        arrowRight: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
            </svg>
        ),
        clock: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
            </svg>
        ),
        users: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        ),
        x: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
        ),
        checkCircle: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
        ),
        lock: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
        ),
        mail: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
            </svg>
        ),
        trendingUp: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
            </svg>
        ),

        // ── 신규 추가 (lucide-react@0.383.0 기준) ───────────────────────────────
        // AlertCircle (= CircleAlert)
        alertCircle: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
        ),
        // ClipboardList
        clipboardList: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <rect x="8" y="2" width="8" height="4" rx="1" />
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <path d="M12 11h4" />
                <path d="M12 16h4" />
                <path d="M8 11h.01" />
                <path d="M8 16h.01" />
            </svg>
        ),
        // Clock3
        clock3: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16.5 12" />
            </svg>
        ),
        // FileText
        fileText: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                <path d="M10 9H8" />
                <path d="M16 13H8" />
                <path d="M16 17H8" />
            </svg>
        ),
        // Map
        map: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
                <path d="M15 5.764v15" />
                <path d="M9 3.236v15" />
            </svg>
        ),
        // Repeat
        repeat: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="m17 2 4 4-4 4" />
                <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                <path d="m7 22-4-4 4-4" />
                <path d="M21 13v1a4 4 0 0 1-4 4H3" />
            </svg>
        ),
        // Settings2
        settings2: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="M20 7h-9" />
                <path d="M14 17H5" />
                <circle cx="17" cy="17" r="3" />
                <circle cx="7" cy="7" r="3" />
            </svg>
        ),
        // ShieldAlert
        shieldAlert: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
            </svg>
        ),
        // Trophy
        trophy: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
        ),
        // User
        user: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
            </svg>
        ),
        // VolumeX
        volumeX: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="22" y1="9" x2="16" y2="15" />
                <line x1="16" y1="9" x2="22" y2="15" />
            </svg>
        ),
        // Wrench
        wrench: (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
        ),
    };
    return icons[name] || null;
}

function FloatingOrb({ className, style }) {
    return <div className={`absolute rounded-full pointer-events-none ${className}`} style={style} />;
}

export default function TikiLandingPage() {
    const [activeStep, setActiveStep] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [activeBottomTab, setActiveBottomTab] = useState('home');
    const [scrollY, setScrollY] = useState(0);

    const uploadStateLabels = {
        IDLE: '대기',
        UPLOADING: '업로드 중',
        PROCESSING: '분석 중',
        COMPLETED: '완료',
        FAILED: '실패',
    };

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const t = setInterval(() => setActiveStep((p) => (p + 1) % 4), 2500);
        return () => clearInterval(t);
    }, []);

    const features = [
        {
            icon: 'mic',
            color: '#0099CC',
            gradient: 'from-[#0099CC]/20 to-[#0099CC]/5',
            border: 'border-[#0099CC]/20',
            glow: 'shadow-[0_0_30px_rgba(0,153,204,0.15)]',
            title: '자동 받아쓰기',
            sub: '소음 속에서도 명확하게',
            desc: 'Whisper 엔진 기반의 고정밀 STT로 어떤 환경의 파일도 오탈자 없이 완벽하게 텍스트로 변환합니다.',
            badge: 'STT 정확도 94%',
        },
        {
            icon: 'brain',
            color: '#7C3AED',
            gradient: 'from-[#7C3AED]/20 to-[#7C3AED]/5',
            border: 'border-[#7C3AED]/20',
            glow: 'shadow-[0_0_30px_rgba(124,58,237,0.15)]',
            title: '스마트 요약',
            sub: '긴 회의도 3줄로 핵심만',
            desc: 'LLM이 대화의 맥락과 의도를 분석하여 실행 가능한 해야 할 일만 정밀하게 추출합니다.',
            badge: '평균 3초 추출',
        },
        {
            icon: 'shield',
            color: '#10B981',
            gradient: 'from-[#10B981]/20 to-[#10B981]/5',
            border: 'border-[#10B981]/20',
            glow: 'shadow-[0_0_30px_rgba(16,185,129,0.15)]',
            title: '보안 마스킹',
            sub: '민감 정보는 자동으로 가려집니다',
            desc: '사내 고객 정보, 개인정보, 기밀 데이터를 AI가 자동 감지하여 외부 유출 없이 안전하게 처리합니다.',
            badge: '100% 온프레미스',
        },
        {
            icon: 'link',
            color: '#F59E0B',
            gradient: 'from-[#F59E0B]/20 to-[#F59E0B]/5',
            border: 'border-[#F59E0B]/20',
            glow: 'shadow-[0_0_30px_rgba(245,158,11,0.15)]',
            title: '원클릭 연동',
            sub: 'Jira · Notion 즉시 전송',
            desc: '승인 버튼 하나로 추출된 태스크가 Jira에 자동 연동됩니다. 복사·붙여넣기는 영원히 안녕.',
            badge: '2종 툴 지원',
        },
    ];

    const steps = [
        {
            icon: 'upload',
            label: '파일 업로드',
            desc: '.mp3 / .wav / .m4a / .txt / 한글 / PDF / Word 지원',
            color: '#0099CC',
            num: '01',
        },
        { icon: 'cpu', label: 'AI 엔진 분석', desc: 'Whisper + LLM 처리', color: '#7C3AED', num: '02' },
        { icon: 'shield', label: '보안 마스킹', desc: '민감 정보 자동 필터링', color: '#10B981', num: '03' },
        { icon: 'link', label: '툴 연동 완료', desc: 'Jira · Notion 전송', color: '#F59E0B', num: '04' },
    ];

    const whyItems = [
        {
            label: 'TIKI',
            isUs: true,
            items: [
                '로컬 Whisper로 음성 데이터 외부 미전송',
                'AI 보안 마스킹 자동 적용',
                '회의록 원본 인용 (타임스탬프 링크)',
                'Diff View로 AI 초안 vs 최종본 비교',
                '할루시네이션 피드백 학습 루프',
            ],
        },
        {
            label: '타 서비스',
            isUs: false,
            items: [
                '음성 클라우드 전송 (개인정보 위험)',
                '마스킹 없이 그대로 저장',
                '원본 회의록 인용 불가',
                'AI 결과물 그대로 사용 강제',
                '피드백 반영 구조 없음',
            ],
        },
    ];

    const techStack = [
        { name: 'FastAPI', category: 'Backend', color: '#0099CC', abbr: 'FA' },
        { name: 'Whisper', category: 'STT Engine', color: '#7C3AED', abbr: 'WH' },
        { name: 'LangChain', category: 'LLM Orch.', color: '#10B981', abbr: 'LC' },
        { name: 'PostgreSQL', category: 'Database', color: '#F59E0B', abbr: 'PG' },
        { name: 'Supabase', category: 'Auth & Storage', color: '#EF4444', abbr: 'SB' },
        { name: 'React', category: 'Frontend', color: '#7C3AED', abbr: 'RE' },
        { name: 'Tailwind', category: 'Styling', color: '#10B981', abbr: 'TW' },
    ];

    const roadmap = [
        {
            phase: 'v1.0',
            label: '현재 운영 중',
            status: 'done',
            color: '#10B981',
            bg: 'from-[#10B981]/10 to-[#10B981]/5',
            border: 'border-[#10B981]/30',
            items: ['사후 파일 업로드 분석', 'LLM 해야 할 일 추출', 'Jira 원클릭 연동', '보안 마스킹 시스템'],
        },
        {
            phase: 'v1.5',
            label: '다음 분기 예정',
            status: 'progress',
            color: '#0099CC',
            bg: 'from-[#0099CC]/10 to-[#0099CC]/5',
            border: 'border-[#0099CC]/30',
            items: ['실시간 대화 스트리밍 요약', '자동 회의록 공유 알림', 'Notion 데이터베이스 연동'],
        },
        {
            phase: 'v2.0',
            label: '하반기 목표',
            status: 'planned',
            color: '#7C3AED',
            bg: 'from-[#7C3AED]/10 to-[#7C3AED]/5',
            border: 'border-[#7C3AED]/30',
            items: ['음성 감정 분석 모듈', '다국어 지원 (EN · JP)', '엔터프라이즈 SSO 통합'],
        },
    ];

    const problems = [
        { icon: 'fileText', text: '회의 끝나자마자 30분을 회의록 정리에 쏟는다' },
        { icon: 'clipboardList', text: 'Jira에 누가 무엇을 언제까지 해야 하는지 일일이 옮겨 적는다' },
        { icon: 'volumeX', text: '중요한 결정이 녹취록 어딘가에 묻혀 잊혀진다' },
        { icon: 'repeat', text: '같은 내용을 Notion, Jira에 반복해서 복붙한다' },
        { icon: 'shieldAlert', text: '고객 정보가 담긴 회의록을 외부 AI에 올리기 꺼려진다' },
        { icon: 'clock3', text: '다음 회의 전까지도 전 회의 정리가 완료되지 않는다' },
    ];

    const team = [
        { name: '정아름', role: '프론트엔드', color: '#0099CC' },
        { name: '송지영', role: 'PM · 아키텍트', color: '#7C3AED' },
        { name: '김소현', role: '서비스 기획', color: '#10B981' },
        { name: '채하율', role: '데이터 엔지니어', color: '#F59E0B' },
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFF] text-[#0D1B2A] font-['Pretendard',sans-serif] antialiased overflow-x-hidden">
            <Header isMobile={isMobile} phase="IDLE" stateLabels={uploadStateLabels} isLoggedIn={false} />

            {/* ─── HERO ─── */}
            <section className="relative pt-28 pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
                <FloatingOrb className="w-[600px] h-[600px] bg-[#0099CC]/8 blur-[120px] -top-40 -left-32" style={{}} />
                <FloatingOrb className="w-[500px] h-[500px] bg-[#7C3AED]/8 blur-[100px] top-20 right-0" style={{}} />
                <FloatingOrb className="w-[300px] h-[300px] bg-[#10B981]/6 blur-[80px] bottom-0 left-1/3" style={{}} />

                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(0,100,180,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,100,180,1) 1px, transparent 1px)',
                        backgroundSize: '60px 60px',
                    }}
                />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[rgba(0,153,204,0.3)] rounded-full mb-8 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                        <span className="text-xs font-bold text-[#0D1B2A]">AI 기반 회의 자동화 플랫폼</span>
                        <span className="text-xs text-[#5A6F8A]">· 네오테크 스타트업</span>
                    </div>

                    <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#0D1B2A] leading-[1.1] mb-6">
                        회의록 작성에
                        <br className="hidden sm:block" /> 쏟는 시간,
                        <br />
                        <span className="relative">
                            <span className="bg-gradient-to-r from-[#0099CC] via-[#7C3AED] to-[#0099CC] bg-clip-text text-transparent bg-[length:200%] animate-[shimmer_3s_linear_infinite]">
                                0초로 만드세요.
                            </span>
                            <span className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-[#0099CC]/0 via-[#7C3AED]/50 to-[#0099CC]/0 rounded-full" />
                        </span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-base sm:text-xl text-[#5A6F8A] leading-relaxed mb-10">
                        회의가 끝나는 순간, AI가 모든 대화를 분석하여 실행 가능한 업무를 자동으로 연동해 드립니다.
                    </p>

                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-16">
                        <Link
                            to="/login"
                            className="group w-full sm:w-auto px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-[#0099CC] to-[#0077aa] hover:from-[#0086b3] hover:to-[#006699] rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#0099CC]/30 hover:shadow-xl hover:shadow-[#0099CC]/40 hover:-translate-y-0.5"
                        >
                            지금 무료로 시작하기
                            <Icon
                                name="arrowRight"
                                size={16}
                                className="text-white transition-transform group-hover:translate-x-1"
                            />
                        </Link>
                        <a
                            href="#how"
                            className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-[#0D1B2A] bg-white border border-[rgba(0,100,180,0.15)] hover:bg-[#EEF3FF] hover:border-[rgba(0,153,204,0.3)] rounded-2xl transition-all text-center shadow-sm hover:shadow-md"
                        >
                            작동 방식 보기
                        </a>
                    </div>

                    {/* 대시보드 미리보기 */}
                    <div className="max-w-4xl mx-auto relative">
                        <div className="absolute -inset-4 bg-gradient-to-r from-[#0099CC]/20 via-[#7C3AED]/20 to-[#10B981]/20 rounded-3xl blur-2xl" />
                        <div className="relative bg-white rounded-2xl border border-[rgba(0,100,180,0.12)] shadow-2xl overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(0,100,180,0.08)] bg-[#F8FAFF]">
                                <span className="w-3 h-3 rounded-full bg-[#EF4444]" />
                                <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                                <span className="w-3 h-3 rounded-full bg-[#10B981]" />
                                <div className="flex-1 mx-4 px-3 py-1 bg-white border border-[rgba(0,100,180,0.1)] rounded-md text-[11px] text-[#5A6F8A] font-mono truncate">
                                    https://tiki.neotech.io/dashboard
                                </div>
                                <span className="flex items-center gap-1 text-[11px] text-[#10B981] font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                                    LIVE
                                </span>
                            </div>

                            <div className="p-4 sm:p-6 bg-[#F8FAFF]">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 p-4 bg-white rounded-xl border border-[rgba(0,100,180,0.12)] gap-3 text-left">
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                                            <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wide">
                                                AI 분석 완료
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-[#0D1B2A]">
                                            네오테크 6월 3주차 스프린트 회의
                                        </p>
                                        <p className="text-xs text-[#5A6F8A] mt-0.5">
                                            참여자 4명 · 녹화 시간 38분 · 해야 할 일 7개 추출
                                        </p>
                                    </div>
                                    <button className="shrink-0 px-4 py-2 bg-[#0099CC] text-white text-xs font-bold rounded-xl hover:bg-[#0086b3] transition-colors">
                                        Jira 전송 준비됨 →
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {[
                                        {
                                            status: '검증 전',
                                            title: '컬러 팔레트 CSS 변수 정의',
                                            assignee: '정아름',
                                            time: '03:12',
                                            priority: '보통',
                                            statusColor: 'bg-[#F59E0B]',
                                            priorityColor: 'text-[#F59E0B]',
                                        },
                                        {
                                            status: 'Jira 연동됨',
                                            title: '세션 토큰 리프레시 로직 보완',
                                            assignee: '김소현',
                                            time: '11:45',
                                            priority: '높음',
                                            statusColor: 'bg-[#10B981]',
                                            priorityColor: 'text-[#EF4444]',
                                        },
                                        {
                                            status: 'Jira 연동됨',
                                            title: 'Figma 최종 시안 업로드 요청',
                                            assignee: '채하율',
                                            time: '24:02',
                                            priority: '낮음',
                                            statusColor: 'bg-[#10B981]',
                                            priorityColor: 'text-[#5A6F8A]',
                                        },
                                    ].map((card, i) => (
                                        <div
                                            key={i}
                                            className="bg-white rounded-xl border border-[rgba(0,100,180,0.12)] p-4 hover:border-[rgba(0,153,204,0.3)] transition-colors text-left"
                                        >
                                            <div className="flex justify-between items-center mb-3">
                                                <span
                                                    className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${card.statusColor}`}
                                                >
                                                    {card.status}
                                                </span>
                                                <span className={`text-[10px] font-semibold ${card.priorityColor}`}>
                                                    {card.priority}
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-[#0D1B2A] leading-snug mb-3">
                                                {card.title}
                                            </p>
                                            <div className="flex justify-between text-[10px] text-[#5A6F8A] pt-2 border-t border-gray-100">
                                                {/* User 아이콘 → Icon 컴포넌트 */}
                                                <span className="font-semibold inline-flex items-center gap-1">
                                                    <Icon name="user" size={11} className="text-[#5A6F8A]" />
                                                    {card.assignee}
                                                </span>
                                                {/* Clock3 아이콘 → Icon 컴포넌트 */}
                                                <span className="text-[#0099CC] font-bold inline-flex items-center gap-1">
                                                    <Icon name="clock3" size={11} className="text-[#0099CC]" />
                                                    {card.time}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── 문제 제기 ─── */}
            <section className="py-20 sm:py-28 bg-[#F8FAFF] relative overflow-hidden">
                <FloatingOrb className="w-96 h-96 bg-[#EF4444]/5 blur-[80px] -right-20 top-10" style={{}} />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-3xl mx-auto text-center mb-14">
                        {/* AlertCircle → Icon 컴포넌트 */}
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#EF4444] bg-[#EF4444]/10 px-3 py-1.5 rounded-full uppercase tracking-widest mb-4">
                            <Icon name="alertCircle" size={12} className="text-[#EF4444]" />
                            문제 인식
                        </span>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0D1B2A] mb-4 leading-tight">
                            지금도 이런 상황이
                            <br />
                            반복되고 있진 않나요?
                        </h2>
                        <p className="text-[#5A6F8A] text-base sm:text-lg">
                            회의 후 매번 30분을 낭비하는 팀을 위해 TIKI가 설계되었습니다.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {problems.map((item, i) => (
                            <div
                                key={i}
                                className="group bg-white border border-[rgba(0,100,180,0.1)] hover:border-[rgba(239,68,68,0.3)] rounded-2xl p-5 flex items-center text-left gap-4 transition-all hover:shadow-lg hover:shadow-[#EF4444]/5 hover:-translate-y-0.5"
                            >
                                <span className="shrink-0 w-9 h-9 rounded-xl bg-[rgba(0,100,180,0.06)] flex items-center justify-center">
                                    {/* 문제 아이콘 → Icon 컴포넌트 */}
                                    <Icon
                                        name={item.icon}
                                        size={20}
                                        className="text-[#5A6F8A] group-hover:text-[#0D1B2A] transition-colors"
                                    />
                                </span>
                                <p className="text-sm text-[#5A6F8A] leading-relaxed group-hover:text-[#0D1B2A] transition-colors">
                                    {item.text}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── HOW IT WORKS ─── */}
            <section id="how" className="py-20 sm:py-28 bg-white relative overflow-hidden">
                <FloatingOrb className="w-[400px] h-[400px] bg-[#0099CC]/6 blur-[100px] -left-20 top-0" style={{}} />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-2xl mx-auto text-center mb-16">
                        {/* Settings2 → Icon 컴포넌트 */}
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0099CC] bg-[#0099CC]/10 px-3 py-1.5 rounded-full uppercase tracking-widest mb-4">
                            <Icon name="settings2" size={12} className="text-[#0099CC]" />
                            작동 방식
                        </span>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0D1B2A] mb-4">
                            4단계 자동화 파이프라인
                        </h2>
                        <p className="text-[#5A6F8A] text-base sm:text-lg">
                            업로드 하나로 시작해서 Jira 연동까지 전 과정이 자동입니다.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 max-w-5xl mx-auto">
                        {steps.map((step, i) => (
                            <div
                                key={i}
                                onClick={() => setActiveStep(i)}
                                className={`relative cursor-pointer rounded-2xl p-5 border-2 transition-all duration-300 ${
                                    activeStep === i
                                        ? 'border-current bg-white shadow-xl -translate-y-1 overflow-hidden'
                                        : 'border-[rgba(0,100,180,0.1)] bg-[#F8FAFF] hover:bg-white hover:shadow-md hover:-translate-y-0.5 overflow-hidden'
                                }`}
                                style={
                                    activeStep === i
                                        ? { borderColor: step.color, boxShadow: `0 20px 40px ${step.color}25` }
                                        : {}
                                }
                            >
                                <div
                                    className="text-xs font-black mb-3 tracking-widest"
                                    style={{ color: activeStep === i ? step.color : '#5A6F8A' }}
                                >
                                    {step.num}
                                </div>
                                <div
                                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-all"
                                    style={{
                                        backgroundColor: activeStep === i ? step.color : `${step.color}18`,
                                        color: activeStep === i ? 'white' : step.color,
                                    }}
                                >
                                    <Icon name={step.icon} size={20} />
                                </div>
                                <h4 className="text-sm font-bold text-[#0D1B2A] mb-1">{step.label}</h4>
                                <p className="text-xs text-[#5A6F8A]">{step.desc}</p>
                                {activeStep === i && (
                                    <div
                                        className="absolute bottom-0 left-0 right-0 h-1.5"
                                        style={{ backgroundColor: step.color }}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="max-w-5xl mx-auto p-6 bg-[#F8FAFF] rounded-2xl border border-[rgba(0,100,180,0.1)]">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div
                                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                                style={{ backgroundColor: steps[activeStep].color, color: 'white' }}
                            >
                                <Icon name={steps[activeStep].icon} size={22} />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-[#5A6F8A] uppercase tracking-widest mb-1">
                                    STEP {activeStep + 1}
                                </p>
                                <p className="text-base font-bold text-[#0D1B2A]">{steps[activeStep].label}</p>
                                <p className="text-sm text-[#5A6F8A] mt-0.5">{steps[activeStep].desc}</p>
                            </div>
                            <div className="flex gap-2">
                                {steps.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setActiveStep(i)}
                                        className="h-2 rounded-full transition-all duration-300"
                                        style={{
                                            width: i === activeStep ? '24px' : '8px',
                                            backgroundColor:
                                                i === activeStep ? steps[activeStep].color : 'rgba(0,100,180,0.2)',
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── 핵심 기능 ─── */}
            <section id="features" className="py-20 sm:py-28 bg-[#F8FAFF] relative overflow-hidden">
                <FloatingOrb className="w-[500px] h-[500px] bg-[#7C3AED]/6 blur-[100px] right-0 top-0" style={{}} />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-2xl mx-auto text-center mb-16">
                        {/* LucideSparkles → Icon 컴포넌트 */}
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7C3AED] bg-[#7C3AED]/10 px-3 py-1.5 rounded-full uppercase tracking-widest mb-4">
                            <Icon name="sparkles" size={12} className="text-[#7C3AED]" />
                            핵심 기능
                        </span>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0D1B2A] mb-4">
                            기능이 아닌, 결과를
                            <br />
                            경험하세요
                        </h2>
                        <p className="text-[#5A6F8A] text-base sm:text-lg">
                            TIKI는 기술 스펙을 자랑하지 않습니다. 팀이 실제로 체감하는 변화를 만듭니다.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {features.map((f, i) => (
                            <div
                                key={i}
                                className={`group relative bg-white border ${f.border} rounded-2xl p-6 hover:-translate-y-1 transition-all duration-300 ${f.glow} hover:shadow-xl cursor-default overflow-hidden`}
                            >
                                <div
                                    className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl`}
                                />
                                <div className="relative">
                                    <div
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold mb-5"
                                        style={{ backgroundColor: `${f.color}15`, color: f.color }}
                                    >
                                        {f.badge}
                                    </div>
                                    <div
                                        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-all group-hover:scale-110"
                                        style={{ backgroundColor: `${f.color}18`, color: f.color }}
                                    >
                                        <Icon name={f.icon} size={22} />
                                    </div>
                                    <h3 className="text-base font-bold text-[#0D1B2A] mb-1">{f.title}</h3>
                                    <p className="text-xs font-semibold mb-3" style={{ color: f.color }}>
                                        {f.sub}
                                    </p>
                                    <p className="text-sm text-[#5A6F8A] leading-relaxed">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── WHY US ─── */}
            <section id="why" className="py-20 sm:py-28 bg-white relative overflow-hidden">
                <FloatingOrb className="w-[400px] h-[400px] bg-[#10B981]/6 blur-[100px] left-0 bottom-0" style={{}} />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-2xl mx-auto text-center mb-16">
                        {/* Trophy → Icon 컴포넌트 */}
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#10B981] bg-[#10B981]/10 px-3 py-1.5 rounded-full uppercase tracking-widest mb-4">
                            <Icon name="trophy" size={12} className="text-[#10B981]" />
                            차별점
                        </span>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0D1B2A] mb-4">
                            왜 TIKI여야 할까요?
                        </h2>
                        <p className="text-[#5A6F8A] text-base sm:text-lg">
                            기능은 비슷해 보여도 핵심 철학이 다릅니다.
                        </p>
                    </div>

                    <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {whyItems.map((col, ci) => (
                            <div
                                key={ci}
                                className={`rounded-2xl border p-6 transition-all ${
                                    ci === 0
                                        ? 'border-[#0099CC]/30 bg-gradient-to-br from-[#EEF3FF] to-white shadow-lg shadow-[#0099CC]/10'
                                        : 'border-[rgba(0,100,180,0.1)] bg-[#F8FAFF]'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-6">
                                    {ci === 0 ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#0099CC] to-[#7C3AED] text-white text-xs font-bold rounded-full">
                                            <Icon name="sparkles" size={10} className="text-white" /> TIKI
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1.5 bg-[#5A6F8A]/10 text-[#5A6F8A] text-xs font-bold rounded-full">
                                            타 서비스
                                        </span>
                                    )}
                                </div>
                                <ul className="space-y-3.5">
                                    {col.items.map((item, ii) => (
                                        <li key={ii} className="flex items-start gap-3 text-sm">
                                            <span
                                                className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center ${
                                                    col.isUs
                                                        ? 'bg-[#10B981]/15 text-[#10B981]'
                                                        : 'bg-[#EF4444]/10 text-[#EF4444]'
                                                }`}
                                            >
                                                {col.isUs ? (
                                                    <Icon name="check" size={11} />
                                                ) : (
                                                    <Icon name="x" size={11} />
                                                )}
                                            </span>
                                            <span
                                                className={col.isUs ? 'text-[#0D1B2A] font-medium' : 'text-[#5A6F8A]'}
                                            >
                                                {item}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── TECH STACK ─── */}
            <section id="tech" className="py-20 sm:py-28 relative overflow-hidden">
                <div className="absolute inset-0 bg-[#0D1B2A]" />
                <div
                    className="absolute inset-0 opacity-5"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                        backgroundSize: '50px 50px',
                    }}
                />
                <FloatingOrb className="w-[400px] h-[400px] bg-[#0099CC]/15 blur-[120px] -right-20 top-0" style={{}} />
                <FloatingOrb className="w-[300px] h-[300px] bg-[#7C3AED]/15 blur-[80px] left-0 bottom-0" style={{}} />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-2xl mx-auto text-center mb-16">
                        {/* Wrench → Icon 컴포넌트 */}
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F59E0B] bg-[#F59E0B]/15 px-3 py-1.5 rounded-full uppercase tracking-widest mb-4">
                            <Icon name="wrench" size={12} className="text-[#F59E0B]" />
                            기술 스택
                        </span>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4">Powered by</h2>
                        <p className="text-white/60 text-base sm:text-lg">
                            안정적인 아키텍처와 확장성을 처음부터 고민했습니다.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mb-10">
                        {techStack.map((t, i) => (
                            <div
                                key={i}
                                className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl p-5 text-center transition-all hover:-translate-y-1 cursor-default"
                            >
                                <div
                                    className="w-11 h-11 rounded-xl mx-auto mb-3 flex items-center justify-center text-xs font-extrabold transition-all group-hover:scale-110"
                                    style={{ backgroundColor: `${t.color}25`, color: t.color }}
                                >
                                    {t.abbr}
                                </div>
                                <p className="text-sm font-bold text-white">{t.name}</p>
                                <p className="text-[11px] text-white/50 mt-0.5">{t.category}</p>
                            </div>
                        ))}
                    </div>

                    <div className="max-w-3xl mx-auto p-5 bg-white/5 border border-white/10 rounded-2xl">
                        <p className="text-xs font-bold text-white/40 mb-4 uppercase tracking-widest">
                            데이터 아키텍처 흐름
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            {[
                                '오디오 수신',
                                'Whisper STT',
                                'LangChain LLM',
                                'PostgreSQL',
                                'Supabase 인증',
                                'Jira · Notion',
                            ].map((item, i, arr) => (
                                <React.Fragment key={i}>
                                    <span className="px-3 py-1.5 bg-[#0099CC]/15 text-[#0099CC] border border-[#0099CC]/20 font-semibold rounded-lg">
                                        {item}
                                    </span>
                                    {i < arr.length - 1 && (
                                        <Icon name="arrowRight" size={12} className="text-white/30" />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── 로드맵 ─── */}
            <section id="roadmap" className="py-20 sm:py-28 bg-[#F8FAFF] relative overflow-hidden">
                <FloatingOrb className="w-[400px] h-[400px] bg-[#7C3AED]/6 blur-[100px] right-0 top-20" style={{}} />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-2xl mx-auto text-center mb-16">
                        {/* Map → Icon 컴포넌트 */}
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7C3AED] bg-[#7C3AED]/10 px-3 py-1.5 rounded-full uppercase tracking-widest mb-4">
                            <Icon name="map" size={12} className="text-[#7C3AED]" />
                            로드맵
                        </span>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0D1B2A] mb-4">
                            TIKI는 계속 성장합니다
                        </h2>
                        <p className="text-[#5A6F8A] text-base sm:text-lg">
                            현재 버전은 시작일 뿐, 팀의 더 깊은 니즈를 채우기 위해 진화 중입니다.
                        </p>
                    </div>

                    <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5 relative">
                        {roadmap.map((r, i) => (
                            <div
                                key={i}
                                className={`relative rounded-2xl border p-6 bg-gradient-to-br ${r.bg} ${r.border} hover:-translate-y-1 transition-all hover:shadow-xl`}
                                style={{ boxShadow: `0 0 0 1px ${r.color}20` }}
                            >
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`w-3 h-3 rounded-full ${r.status === 'done' ? 'animate-none' : 'animate-pulse'}`}
                                            style={{ backgroundColor: r.color }}
                                        />
                                        <span className="text-xl font-extrabold" style={{ color: r.color }}>
                                            {r.phase}
                                        </span>
                                    </div>
                                    <span
                                        className="text-[10px] font-bold text-white px-2.5 py-1 rounded-full"
                                        style={{ backgroundColor: r.color }}
                                    >
                                        {r.status === 'done' ? '완료' : r.status === 'progress' ? '진행 중' : '예정'}
                                    </span>
                                </div>
                                <p className="text-xs font-semibold text-[#5A6F8A] mb-4">{r.label}</p>
                                <ul className="space-y-2.5">
                                    {r.items.map((item, ii) => (
                                        <li key={ii} className="flex items-center gap-2.5 text-sm text-[#0D1B2A]">
                                            <span
                                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                                style={{ backgroundColor: r.color }}
                                            />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── 팀 소개 ─── */}
            <section className="py-20 sm:py-28 bg-white border-t border-[rgba(0,100,180,0.08)]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-2xl mx-auto text-center mb-14">
                        {/* Users → Icon 컴포넌트 */}
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0099CC] bg-[#0099CC]/10 px-3 py-1.5 rounded-full uppercase tracking-widest mb-4">
                            <Icon name="users" size={12} className="text-[#0099CC]" />팀 소개
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0D1B2A] mb-4">
                            네오테크를 만드는 사람들
                        </h2>
                        <p className="text-[#5A6F8A]">작지만 강한 팀이 큰 문제를 해결합니다.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-6 max-w-xs mx-auto sm:max-w-2xl sm:grid-cols-4">
                        {team.map((m, i) => (
                            <div key={i} className="text-center group">
                                <div
                                    className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-lg font-extrabold text-white transition-all group-hover:scale-110 group-hover:shadow-lg"
                                    style={{ backgroundColor: m.color, boxShadow: `0 8px 20px ${m.color}30` }}
                                >
                                    {m.name.slice(0, 1)}
                                </div>
                                <p className="text-sm font-bold text-[#0D1B2A]">{m.name}</p>
                                <p className="text-xs text-[#5A6F8A]">{m.role}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── CTA ─── */}
            <section id="cta" className="relative py-24 sm:py-32 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#0099CC] via-[#5C3AED] to-[#7C3AED]" />
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage:
                            'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.8) 1px, transparent 1px)',
                        backgroundSize: '30px 30px',
                    }}
                />
                <FloatingOrb className="w-96 h-96 bg-white/10 blur-[80px] -right-20 -top-20" style={{}} />
                <FloatingOrb className="w-64 h-64 bg-white/10 blur-[60px] -left-10 bottom-0" style={{}} />

                <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/15 mb-8">
                        <Icon name="sparkles" size={30} className="text-white" />
                    </div>
                    <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-6 leading-tight">
                        지금 바로 첫 회의록을
                        <br />
                        AI에게 맡겨보세요
                    </h2>
                    <p className="text-white/75 text-base sm:text-xl mb-12 max-w-xl mx-auto leading-relaxed">
                        신용카드 없이, 설치 없이.
                        <br />
                        파일 하나만 있으면 됩니다.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                        <Link
                            to="/login"
                            className="group w-full sm:w-auto px-8 py-4 text-base font-bold text-[#0099CC] bg-white hover:bg-[#EEF3FF] rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-black/20 hover:shadow-2xl hover:-translate-y-0.5"
                        >
                            무료로 시작하기
                            <Icon
                                name="arrowRight"
                                size={16}
                                className="text-[#0099CC] transition-transform group-hover:translate-x-1"
                            />
                        </Link>
                        <a
                            href="#"
                            className="w-full sm:w-auto px-8 py-4 text-base font-bold text-white border-2 border-white/30 hover:bg-white/15 hover:border-white/50 rounded-2xl transition-all flex items-center justify-center gap-2"
                        >
                            <Icon name="mail" size={16} className="text-white" />
                            팀에 문의하기
                        </a>
                    </div>

                    <div className="mt-12 flex flex-wrap justify-center gap-6 text-white/60 text-sm">
                        <span className="flex items-center gap-1.5">
                            <Icon name="check" size={14} className="text-[#10B981]" /> 무료 플랜 제공
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Icon name="check" size={14} className="text-[#10B981]" /> 설치 불필요
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Icon name="check" size={14} className="text-[#10B981]" /> 데이터 보안 보장
                        </span>
                    </div>
                </div>
            </section>

            {!isMobile && <Footer />}
            {isMobile && <MobileTab active={activeBottomTab} onChange={setActiveBottomTab} />}

            <style>{`
        @keyframes shimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
        </div>
    );
}
