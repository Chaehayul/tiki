const icons = {
  fileAudio: ["M17.5 22h.5a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3", "M14 2v4a2 2 0 0 0 2 2h4", "M9 17v-5", "M12 17v-3", "M15 17v-1"],
  twitter: ["M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"],
  github: ["M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"],
  mail: ["M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z", "M22 6l-10 7L2 6"],
  shieldCheck: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", "M9 12l2 2 4-4"],
  globe: ["M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z", "M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
};

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

export default function Footer() {
  return (
    <footer className="relative z-[1] animate-footerFadeIn border-t border-[rgba(0,100,180,.1)] bg-[rgba(248,250,255,.97)] px-12 pb-10 pt-14 backdrop-blur-[12px]">
      <div className="mx-auto grid max-w-[1080px] grid-cols-[2fr_1fr_1fr_1fr] gap-12">
        <div>
          <div className="mb-3.5 flex items-center gap-2.5">
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[linear-gradient(135deg,#0099CC,#7C3AED)]">
              <IIcon name="fileAudio" size={18} color="#fff" sw={2} />
            </div>
            <span className="text-xl font-bold tracking-[-1px] text-[#0D1B2A]">
              <span className="text-[#0099CC]">TI</span>KI
            </span>
          </div>
          <p className="mb-5 max-w-[260px] text-[13px] leading-7 text-[#5A6F8A]">
            음성 회의록을 AI로 자동 정리하고, Jira 티켓까지 연동하는 스마트 업무 자동화 플랫폼입니다.
          </p>
          <div className="flex gap-2">
            {[
              { icon: "twitter", label: "Twitter" },
              { icon: "github", label: "GitHub" },
              { icon: "mail", label: "Email" },
            ].map(({ icon, label }) => (
              <a key={icon} href="#" title={label} className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[rgba(0,100,180,.1)] bg-[rgba(0,60,150,.05)] text-[#5A6F8A] no-underline transition-colors duration-200 hover:border-[rgba(0,153,204,.4)] hover:bg-[rgba(0,153,204,.08)] hover:text-[#0099CC]">
                <IIcon name={icon} size={15} color="currentColor" />
              </a>
            ))}
          </div>
        </div>

        {[
          { title: "제품", links: ["기능 소개", "요금제", "API 문서", "변경 이력"] },
          { title: "회사", links: ["팀 소개", "블로그", "채용", "파트너십"] },
          { title: "지원", links: ["고객센터", "커뮤니티", "개인정보처리방침", "이용약관"] },
        ].map(({ title, links }) => (
          <div key={title}>
            <div className="mb-4 text-xs font-bold uppercase tracking-[1px] text-[#0099CC]">{title}</div>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {links.map((link) => (
                <li key={link}>
                  <a href="#" className="text-[13px] text-[#5A6F8A] no-underline transition-colors duration-200 hover:text-[#0D1B2A]">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 flex max-w-[1080px] flex-wrap items-center justify-between gap-3 border-t border-[rgba(0,100,180,.1)] pt-6">
        <p className="text-xs text-[#5A6F8A]">© 2025 TIKI Inc. All rights reserved.</p>
        <div className="flex items-center gap-4">
          {[
            { icon: "shieldCheck", text: "SOC 2 Type II" },
            { icon: "globe", text: "한국어 / English" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-xs text-[#5A6F8A]">
              <IIcon name={icon} size={13} color="#0099CC" />
              {text}
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
