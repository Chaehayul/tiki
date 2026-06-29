const TOAST_META = {
	info: { color: "#0099CC", icon: "info" },
	ai: { color: "#7C3AED", icon: "info" },
	success: { color: "#10B981", icon: "check" },
	warning: { color: "#F59E0B", icon: "alertTriangle" },
	error: { color: "#EF4444", icon: "x" },
};

function ToastIcon({ name, size = 16, color = "currentColor" }) {
	const iconPaths = {
		check: ["M20 6 9 17 4 12"],
		x: ["M18 6 6 18", "M6 6 18 18"],
		alertTriangle: [
			"M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
			"M12 9v4",
			"M12 17h.01",
		],
		info: ["M12 16v-4", "M12 8h.01", "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"],
	};

	const paths = iconPaths[name] ?? iconPaths.info;

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="shrink-0"
			aria-hidden="true"
		>
			{paths.map((d, idx) => (
				<path key={`${name}-${idx}`} d={d} />
			))}
		</svg>
	);
}

export default function ToastPopup({ show, message, type = "info" }) {
	if (!show || !message) return null;

	const meta = TOAST_META[type] ?? TOAST_META.info;

	return (
		<div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[220] min-w-[260px] max-w-[92vw] flex items-center gap-2.5 bg-[#0D1B2A] text-[#FFFFFF] px-5 py-3 rounded-xl shadow-2xl border border-[rgba(255,255,255,0.12)] animate-in slide-in-from-bottom-4 duration-300">
			<ToastIcon name={meta.icon} color={meta.color} size={16} />
			<span className="text-sm font-semibold text-[#FFFFFF]">{message}</span>
		</div>
	);
}
