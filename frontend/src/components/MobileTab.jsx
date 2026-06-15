const icons = {
  home: ["M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 22V12h6v10"],
  uploadCloud: ["M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242", "M12 12v9", "M8 17l4-5 4 5"],
  barChart: ["M12 20V10", "M18 20V4", "M6 20v-4"],
  settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"],
};

const cn = (...classes) => classes.filter(Boolean).join(" ");

function IIcon({ name, size = 16, color = "currentColor", sw = 2 }) {
  const paths = icons[name];
  if (!paths) return null;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className="block shrink-0">
      {paths.map((d, index) => (
        <path key={index} d={d} />
      ))}
    </svg>
  );
}

const TABS = [
  { id: "home", icon: "home", label: "홈" },
  { id: "upload", icon: "uploadCloud", label: "업로드" },
  { id: "reports", icon: "barChart", label: "회의록" },
  { id: "settings", icon: "settings", label: "설정" },
];

export default function MobileTab({ active, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] flex animate-tabSlide border-t border-[rgba(0,100,180,.1)] bg-[rgba(248,250,255,.97)] backdrop-blur-[16px] pb-[env(safe-area-inset-bottom,0px)]">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="relative flex flex-1 cursor-pointer flex-col items-center gap-1 bg-transparent px-0 py-[10px_0_8px] transition-transform duration-150 active:scale-95"
          >
            {isActive && <div className="absolute left-1/2 top-1.5 h-7 w-11 -translate-x-1/2 rounded-[14px] bg-[rgba(0,153,204,.1)]" />}
            <div className="relative z-[1]">
              <IIcon name={tab.icon} size={20} color={isActive ? "#0099CC" : "#5A6F8A"} sw={isActive ? 2.2 : 1.8} />
              {tab.id === "upload" && <span className="absolute -right-1 top-[-3px] h-[7px] w-[7px] rounded-full border-[1.5px] border-[#F8FAFF] bg-[#7C3AED]" />}
            </div>
            <span className={cn("text-[10px] leading-none tracking-[0.2px] transition-colors duration-200", isActive ? "font-bold text-[#0099CC]" : "font-medium text-[#5A6F8A]")}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
