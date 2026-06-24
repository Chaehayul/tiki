import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import MobileTab from "../components/MobileTab";
import Footer from "../components/Footer";

/* ─── Design Tokens ───────────────────────────────────────────────────────── */
// bg:        #F8FAFF
// surface:   #FFFFFF
// surface2:  #EEF3FF
// cyan:      #0099CC
// purple:    #7C3AED
// green:     #10B981
// yellow:    #F59E0B
// red:       #EF4444
// text:      #0D1B2A
// muted:     #5A6F8A
// border:    rgba(0,100,180,0.12)
// border-a:  rgba(0,153,204,0.5)
// font:      Pretendard

function Mono({ children, className = "" }) {
  return (
    <span
      className={`tabular-nums ${className}`}
      style={{ fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {children}
    </span>
  );
}

/* ─── Hero ────────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#F8FAFF]">
      {/* subtle grid overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,100,180,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,100,180,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 md:px-8 pt-6 sm:pt-10 md:pt-14 pb-0">
        {/* eyebrow */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EEF3FF] border border-[rgba(0,153,204,0.3)] mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0099CC] animate-pulse" />
          <Mono className="text-[11px] font-bold text-[#0099CC] tracking-widest uppercase">
            회의 요약 자동화
          </Mono>
        </div>

        {/* headline */}
        <h1 className="text-[36px] sm:text-[52px] md:text-[68px] font-extrabold leading-[1.06] tracking-tight text-[#0D1B2A] max-w-4xl">
          회의를 올리면
          <br />
          <span className="relative inline-block">
            <span className="bg-gradient-to-r from-[#0099CC] via-[#4F8ECC] to-[#7C3AED] bg-clip-text text-transparent">
              핵심만 남습니다
            </span>
            <svg
              aria-hidden
              className="absolute -bottom-2 left-0 w-full"
              viewBox="0 0 400 12"
              fill="none"
            >
              <path
                d="M2 9 Q100 3 200 8 Q300 13 398 6"
                stroke="url(#underline-grad)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="underline-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0099CC" />
                  <stop offset="100%" stopColor="#7C3AED" />
                </linearGradient>
              </defs>
            </svg>
          </span>
        </h1>

        <p className="mt-8 text-base sm:text-lg text-[#5A6F8A] leading-relaxed max-w-lg">
          프로젝트를 만들고 회의 파일을 올리면<br className="hidden sm:block" />
          요약·액션 아이템·Jira 연동까지 한 번에.
        </p>

        {/* CTA row */}
        <div className="mt-8 flex flex-wrap items-center gap-3 pb-12 sm:pb-16">
          <Link to="/signup" className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-[#0099CC] hover:bg-[#007AA8] transition-all duration-200 shadow-[0_10px_28px_rgba(0,153,204,0.38)] hover:-translate-y-0.5 active:translate-y-0">
            <Icon name="play" size={14} className="text-white" strokeWidth={2.4} />
            무료로 시작하기
          </Link>
        </div>

        {/* mock result card — same size/shape, meeting-detail content inside */}
        <div className="relative mx-auto max-w-4xl">
          <div className="rounded-t-2xl bg-white overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.16)] ring-1 ring-[rgba(0,100,180,0.12)]">
            {/* window chrome */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[rgba(0,100,180,0.1)] bg-[#F8FAFF]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]/70" />
              <Mono className="ml-4 text-[11px] text-[#5A6F8A]">
                tiki.app · meeting-detail
              </Mono>
            </div>

            {/* result preview — image */}
            <div className="relative min-h-[280px] sm:min-h-[340px] overflow-hidden">
              <img
                src="/images/hero-card.png"
                alt="회의 결과 미리보기"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Stats Band ──────────────────────────────────────────────────────────── */
function StatsBand() {
  const stats = [
    { value: "2~5분", label: "첫 결과까지 걸리는 시간" },
    { value: "6종", label: "지원 오디오 포맷" },
    { value: "3단계", label: "시작에 필요한 전부" },
    { value: "할일 자동추출", label: "회의록 기반 액션 아이템 생성" },
  ];
  return (
    <section className="border-t border-b border-[rgba(0,100,180,0.12)] bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[rgba(0,100,180,0.12)]">
          {stats.map((s) => (
            <div
              key={s.value}
              className="py-6 sm:py-7 px-4 sm:px-8 sm:first:pl-0 sm:last:pr-0 flex flex-col gap-3"
            >
              <span className="text-2xl sm:text-3xl font-bold text-[#0099CC] tracking-tight">
                {s.value}
              </span>
              <span className="text-[12px] text-[#5A6F8A] font-medium">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Problem → Solution ──────────────────────────────────────────────────── */
function ProblemSolution() {
  const problems = [
    "회의가 끝난 뒤 누가 뭘 해야 하는지 다시 정리하느라 30분이 사라진다",
    "회의록을 쓰는 사람이 정작 회의에 집중을 못 한다",
    "Jira 이슈나 Notion 정리를 따로 해야 해서 이중 작업이 생긴다",
  ];

  return (
    <section className="bg-[#F8FAFF] py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* left: problem */}
          <div>
            <p className="text-[11px] font-bold text-[#5A6F8A] uppercase tracking-widest mb-4">
              지금 이런 상황인가요?
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0D1B2A] leading-tight mb-8">
              회의는 끝났는데<br />
              <span className="text-[#5A6F8A] font-medium">정리는 이제부터 시작</span>
            </h2>
            <div className="space-y-3">
              {problems.map((p, i) => (
                <div
                  key={i}
                  className="flex gap-3 items-start p-4 rounded-xl bg-white ring-1 ring-[rgba(0,100,180,0.12)]"
                >
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#EF4444]/10 flex items-center justify-center mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                  </span>
                  <p className="text-[13px] text-[#5A6F8A] leading-relaxed">{p}</p>
                </div>
              ))}
            </div>
          </div>

          {/* right: solution */}
          <div>
            <p className="text-[11px] font-bold text-[#0099CC] uppercase tracking-widest mb-4">
              TIKI가 하는 일
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0D1B2A] leading-tight mb-8">
              올리면 끝,<br />
              <span className="bg-gradient-to-r from-[#0099CC] to-[#7C3AED] bg-clip-text text-transparent">
                나머지는 TIKI가
              </span>
            </h2>
            <div className="space-y-3">
              {[
                { icon: "zap", color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10", text: "회의 핵심을 자동으로 요약해 드려요" },
                { icon: "check", color: "text-[#10B981]", bg: "bg-[#10B981]/10", text: "담당자별 액션 아이템을 뽑아드려요" },
                { icon: "share2", color: "text-[#7C3AED]", bg: "bg-[#7C3AED]/10", text: "Jira·Notion으로 바로 내보낼 수 있어요" },
              ].map(({ icon, color, bg, text }) => (
                <div
                  key={text}
                  className="flex gap-3 items-start p-4 rounded-xl bg-white ring-1 ring-[rgba(0,100,180,0.12)] hover:ring-[rgba(0,153,204,0.5)] transition-all"
                >
                  <span className={`shrink-0 w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                    <Icon name={icon} size={15} className={color} strokeWidth={2.5} />
                  </span>
                  <p className="text-[13px] text-[#0D1B2A] font-medium leading-relaxed self-center">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works (3 steps) ─────────────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: "upload",
      iconBg: "bg-[#EEF3FF]",
      iconColor: "text-[#0099CC]",
      accent: "border-[#0099CC]",
      title: "프로젝트 만들기",
      desc: "회의 결과가 쌓일 공간을 먼저 만들어두면 나중에 찾고 관리하기가 훨씬 편합니다.",
      t: "00:00",
    },
    {
      num: "02",
      icon: "play",
      iconBg: "bg-[#F3F0FF]",
      iconColor: "text-[#7C3AED]",
      accent: "border-[#7C3AED]",
      title: "회의 파일 올리기",
      desc: "mp3, wav, m4a, aac, ogg, flac — 어떤 형식이든 그냥 올리면 됩니다. 분석이 자동으로 시작돼요.",
      t: "01:30",
    },
    {
      num: "03",
      icon: "zap",
      iconBg: "bg-[#ECFDF5]",
      iconColor: "text-[#10B981]",
      accent: "border-[#10B981]",
      title: "결과 확인하기",
      desc: "요약, 액션 아이템, 연동 흐름까지 실제 결과를 보며 자연스럽게 익힐 수 있어요.",
      t: "03:00",
    },
  ];

  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8">
        {/* header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12 sm:mb-16">
          <div>
            <p className="text-[11px] font-bold text-[#5A6F8A] uppercase tracking-widest mb-3">
              시작하는 방법
            </p>
            <h2 className="text-2xl sm:text-[34px] font-extrabold text-[#0D1B2A] tracking-tight leading-tight">
              딱 세 단계면 충분해요
            </h2>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EEF3FF] border border-[rgba(0,153,204,0.3)]">
            <Mono className="text-[11px] font-bold text-[#0099CC]">00:00</Mono>
            <span className="w-16 h-0.5 bg-[rgba(0,100,180,0.15)] rounded-full relative overflow-hidden">
              <span className="absolute inset-y-0 left-0 w-1/3 bg-[#0099CC] rounded-full" />
            </span>
            <Mono className="text-[11px] font-bold text-[#0099CC]">03:00</Mono>
          </div>
        </div>

        {/* steps */}
        <div className="grid sm:grid-cols-3 gap-6 sm:gap-5">
          {steps.map((s) => {
            return (
              <div
                key={s.num}
                className={`relative rounded-2xl border-t-[3px] ${s.accent} bg-[#F8FAFF] ring-1 ring-[rgba(0,100,180,0.12)] p-6 sm:p-7 hover:-translate-y-1 hover:shadow-lg transition-all duration-300`}
              >
                <div className="flex items-center justify-between mb-5">
                  <span className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center`}>
                    <Icon name={s.icon} size={18} className={s.iconColor} strokeWidth={2} />
                  </span>
                  <Mono className="text-[11px] font-bold text-[#5A6F8A]">{s.t}</Mono>
                </div>
                <Mono className="block text-[11px] font-bold text-[#5A6F8A] mb-2 tracking-widest">
                  STEP {s.num}
                </Mono>
                <h3 className="text-[16px] font-bold text-[#0D1B2A] mb-2">{s.title}</h3>
                <p className="text-[13px] text-[#5A6F8A] leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>

        {/* format support */}
        <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-[#0D1B2A] flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[12px] font-semibold text-white/50 self-center mr-1">
              지원 포맷
            </span>
            {["MP3", "WAV", "M4A", "AAC", "OGG", "FLAC"].map((f) => (
              <Mono
                key={f}
                className="px-2.5 py-1 rounded-lg bg-white/10 text-[11px] font-bold text-[#0099CC]"
              >
                {f}
              </Mono>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Feature Showcase ────────────────────────────────────────────────────── */
function FeatureShowcase() {
  const features = [
    {
      tag: "요약",
      tagColor: "text-[#0099CC]",
      tagBg: "bg-[#EEF3FF]",
      title: "회의 핵심만 빠르게 보기",
      desc: "긴 회의 내용을 다시 정리하지 않아도 핵심 흐름과 결정사항을 바로 확인할 수 있습니다. 자연어로 검색해서 특정 내용을 찾는 것도 가능해요.",
      highlight: "긴 회의도 핵심만 빠르게 요약",
    },
    {
      tag: "액션",
      tagColor: "text-[#7C3AED]",
      tagBg: "bg-[#F3F0FF]",
      title: "해야 할 일까지 바로 이어가기",
      desc: "담당자, 마감일, 내용을 자동으로 분류해 액션 아이템을 정리해 드립니다. 회의가 끝난 뒤 바로 다음 행동으로 넘어갈 수 있어요.",
      highlight: "담당자 자동 인식 및 할 일 분류",
    },
    {
      tag: "연동",
      tagColor: "text-[#10B981]",
      tagBg: "bg-[#ECFDF5]",
      title: "익숙한 도구와 그대로 연결하기",
      desc: "Jira와 Notion에 연결해 팀의 기존 워크플로 안에서 그대로 쓸 수 있습니다. 처음에는 연동 없이 써도 충분해요.",
      highlight: "Jira · Notion 원클릭 내보내기",
    },
  ];

  return (
    <section className="bg-[#F8FAFF] py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8">
        <p className="text-[11px] font-bold text-[#5A6F8A] uppercase tracking-widest mb-3">
          주요 기능
        </p>
        <h2 className="text-2xl sm:text-[34px] font-extrabold text-[#0D1B2A] tracking-tight leading-tight mb-12 sm:mb-16">
          처음부터 체감되는 변화
        </h2>

        <div className="border-t border-[rgba(0,100,180,0.12)]">
          {features.map((f) => (
            <div
              key={f.tag}
              className="group grid sm:grid-cols-[120px_1fr] gap-4 sm:gap-10 py-8 sm:py-10 border-b border-[rgba(0,100,180,0.12)] items-start"
            >
              {/* tag */}
              <div className="flex sm:flex-col sm:items-start items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg ${f.tagBg} ${f.tagColor} text-[11px] font-bold tracking-widest`}>
                  [{f.tag}]
                </span>
              </div>

              {/* content */}
              <div className="grid sm:grid-cols-[1fr_220px] gap-6 sm:gap-10">
                <div>
                  <h3 className="text-[17px] font-bold text-[#0D1B2A] mb-2 group-hover:text-[#0099CC] transition-colors">
                    {f.title}
                  </h3>
                  <p className="text-[13px] text-[#5A6F8A] leading-relaxed">{f.desc}</p>
                </div>
                <div className="self-center px-4 py-3 rounded-xl bg-white ring-1 ring-[rgba(0,100,180,0.12)]">
                  <p className="text-[12px] font-semibold text-[#0D1B2A]">{f.highlight}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Tips ────────────────────────────────────────────────────────────────── */
function Tips() {
  const tips = [
    {
      accent: "from-[#0099CC] to-[#4F8ECC]",
      topBorder: "border-[#0099CC]",
      icon: "folderPlus",
      iconBg: "bg-[#EEF3FF]",
      iconColor: "text-[#0099CC]",
      title: "프로젝트부터 만드는 게 좋아요",
      desc: "처음 프로젝트를 잡아두면 회의 결과가 흩어지지 않고 한 곳에 차곡차곡 쌓입니다.",
    },
    {
      accent: "from-[#7C3AED] to-[#9F67F0]",
      topBorder: "border-[#7C3AED]",
      icon: "link2",
      iconBg: "bg-[#F3F0FF]",
      iconColor: "text-[#7C3AED]",
      title: "연동은 나중에 해도 괜찮아요",
      desc: "처음에는 업로드와 결과 확인이 더 중요합니다. Jira·Notion은 필요할 때 연결해도 돼요.",
    },
    {
      accent: "from-[#10B981] to-[#34D399]",
      topBorder: "border-[#10B981]",
      icon: "rocket",
      iconBg: "bg-[#ECFDF5]",
      iconColor: "text-[#10B981]",
      title: "일단 한 번 써보면 감이 옵니다",
      desc: "긴 설명보다 실제 회의를 올리고 결과를 보는 편이 훨씬 빠르게 익숙해집니다.",
    },
  ];

  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 sm:mb-12">
          <div>
            <p className="text-[11px] font-bold text-[#5A6F8A] uppercase tracking-widest mb-3">
              먼저 알아두면 좋아요
            </p>
            <h2 className="text-2xl sm:text-[34px] font-extrabold text-[#0D1B2A] tracking-tight leading-tight">
              처음엔 이 정도만 기억하세요
            </h2>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 sm:gap-5">
          {tips.map((c) => {
            return (
            <div
              key={c.title}
              className={`relative overflow-hidden rounded-2xl border-t-[3px] ${c.topBorder} bg-[#F8FAFF] ring-1 ring-[rgba(0,100,180,0.12)] hover:ring-[rgba(0,153,204,0.5)] hover:-translate-y-0.5 transition-all duration-300 p-6 sm:p-7`}
            >
              <div className={`w-9 h-9 rounded-xl ${c.iconBg} ring-1 ring-[rgba(0,100,180,0.14)] flex items-center justify-center mb-5`}>
                <Icon name={c.icon} size={16} className={c.iconColor} strokeWidth={2.2} />
              </div>
              <h3 className="text-[15px] font-bold text-[#0D1B2A] mb-2 mt-1">{c.title}</h3>
              <p className="text-[13px] text-[#5A6F8A] leading-relaxed">{c.desc}</p>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA ─────────────────────────────────────────────────────────────────── */
function CTA() {
  return (
    <section className="bg-[#F8FAFF] px-4 sm:px-6 md:px-8 pb-10 sm:pb-14">
      <div className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl bg-[#0D1B2A] px-6 sm:px-12 md:px-16 py-12 sm:py-16">
          {/* background accent blobs */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#0099CC] opacity-[0.07] blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-16 w-56 h-56 rounded-full bg-[#7C3AED] opacity-[0.07] blur-3xl"
          />

          {/* progress bar deco */}
          <div className="flex items-center gap-2 mb-7">
            <Mono className="text-[11px] font-bold text-[#0099CC]">00:00</Mono>
            <div className="relative flex-1 max-w-[120px] h-[2px] bg-white/10 rounded-full">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#0099CC] shadow-[0_0_8px_rgba(0,153,204,0.8)]" />
            </div>
            <Mono className="text-[11px] font-bold text-white/25">03:00</Mono>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div>
              <h2 className="text-2xl sm:text-[36px] font-extrabold text-white tracking-tight leading-tight">
                이제 한 번 써보면 됩니다
              </h2>
              <p className="mt-3 text-[14px] sm:text-[15px] text-white/55 leading-relaxed max-w-lg">
                프로젝트를 만들고 첫 회의를 올려보세요.<br className="hidden sm:block" />
                결과를 한 번 보면 TIKI를 어떻게 써야 하는지 자연스럽게 감이 옵니다.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <button className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-[#0099CC] hover:bg-[#007AA8] transition-all duration-200 shadow-[0_8px_28px_rgba(0,153,204,0.45)] hover:-translate-y-0.5 whitespace-nowrap">
                <Icon name="play" size={14} className="text-white" strokeWidth={2.4} />
                프로젝트 생성하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function TikiOnboardingPage() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1024 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      className="min-h-screen w-full bg-[#F8FAFF] text-[#0D1B2A] overflow-x-hidden pb-20 lg:pb-0"
      style={{ fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <Header isMobile={isMobile} />
      <main className="pt-20 lg:pt-24">
        <Hero />
        <StatsBand />
        <ProblemSolution />
        <HowItWorks />
        <FeatureShowcase />
        <Tips />
        <CTA />
      </main>
      {!isMobile ? <Footer /> : null}
      {isMobile ? <MobileTab active="home" /> : null}
    </div>
  );
}

const icons = {
  play: ["M8 5v14l11-7z"],
  check: ["M20 6L9 17l-5-5"],
  upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"],
  zap: ["M13 2L3 14h9l-1 8 10-12h-9l1-8z"],
  share2: ["M18 8a3 3 0 1 0-3-3", "M6 14a3 3 0 1 0 3 3", "M18 8l-8.59 5.73", "M6 14l8.59 5.73"],
  folderPlus: ["M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z", "M12 11v6", "M9 14h6"],
  link2: ["M15 7h3a5 5 0 0 1 0 10h-3", "M9 17H6a5 5 0 0 1 0-10h3", "M8 12h8"],
  rocket: ["M4.5 16.5c-1.5 1.5-1.5 4 0 5.5", "M19 3c-4.5 0-8.5 2-11 5.5L3 13l4 1 1 4 4.5-5C16 10.5 18 6.5 18 2z", "M10 14l-2 2", "M14 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4"],
};

function Icon({ name, size = 16, className = "", strokeWidth = 2 }) {
  const paths = icons[name];
  if (!paths) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths.map((d, idx) => (
        <path key={idx} d={d} />
      ))}
    </svg>
  );
}