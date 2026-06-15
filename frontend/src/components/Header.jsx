const icons = {
  fileAudio: ["M17.5 22h.5a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3", "M14 2v4a2 2 0 0 0 2 2h4", "M9 17v-5", "M12 17v-3", "M15 17v-1"],
  cpu: ["M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0", "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"],
};

const cn = (...classes) => classes.filter(Boolean).join(" ");

function IIcon({ name, size = 16, color = "currentColor", sw = 2 }) {
  const paths = icons[name];
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

export default function Header({ isMobile, phase, stateLabels }) {
  const pillClasses = {
    UPLOADING: "border-[rgba(245,158,11,.3)] bg-[rgba(245,158,11,.1)] text-[#B45309]",
    PROCESSING: "border-[rgba(0,153,204,.5)] bg-[rgba(0,153,204,.1)] text-[#0099CC]",
    COMPLETED: "border-[rgba(16,185,129,.3)] bg-[rgba(16,185,129,.1)] text-[#059669]",
    FAILED: "border-[rgba(239,68,68,.25)] bg-[rgba(239,68,68,.08)] text-[#DC2626]",
  };

  return (
    <header className={cn("fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-[rgba(0,100,180,.1)] bg-[rgba(248,250,255,.92)] backdrop-blur-[12px]", isMobile ? "px-4 py-[14px]" : "px-12 py-5")}>
      <a href="#" onClick={(event) => event.preventDefault()} className="flex items-center gap-2.5 text-[#0D1B2A] no-underline">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#0099CC,#7C3AED)]">
          <IIcon name="fileAudio" size={20} color="#fff" sw={2} />
        </div>
        <span className="text-[22px] font-bold tracking-[-1px]">
          <span className="text-[#0099CC]">TI</span>KI
        </span>
      </a>

      <nav className="flex items-center gap-2">
        {!isMobile && (
          <>
            {["기능 소개", "요금제", "문서"].map((link) => (
              <a key={link} href="#" className="rounded-[6px] px-[14px] py-[6px] text-sm text-[#5A6F8A] no-underline transition-colors duration-200 hover:text-[#0D1B2A]">
                {link}
              </a>
            ))}
          </>
        )}
        {phase !== "IDLE" && (
          <div className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-bold uppercase tracking-[0.3px]", isMobile ? "text-[11px]" : "text-xs", pillClasses[phase])}>
            <span className={cn("h-[7px] w-[7px] shrink-0 rounded-full bg-current", phase === "PROCESSING" || phase === "UPLOADING" ? "animate-pulseDot" : "")} />
            {stateLabels[phase]}
          </div>
        )}
        <a href="#" className={cn("rounded-[6px] border border-[rgba(0,153,204,.5)] bg-[rgba(0,153,204,.08)] font-semibold text-[#0099CC] no-underline", isMobile ? "px-3 py-[6px] text-[13px]" : "px-[14px] py-[6px] text-sm")}>
          무료 시작
        </a>
      </nav>
    </header>
  );
}
