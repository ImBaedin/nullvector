import type { HoverPanelState } from "../types";

export function HoverPanel({ hover }: { hover: HoverPanelState | null }) {
	if (!hover) {
		return null;
	}

	const entityLabel = hover.entityType.charAt(0).toUpperCase() + hover.entityType.slice(1);

	return (
		<div
			className="
     pointer-events-none fixed z-50 w-[260px] overflow-hidden rounded-xl border
     border-cyan-200/25
     bg-[linear-gradient(165deg,rgba(10,22,40,0.95),rgba(8,14,28,0.94))] p-0
     text-xs text-slate-100
     shadow-[0_10px_34px_rgba(0,0,0,0.45),0_0_0_1px_rgba(103,232,249,0.08)]
     backdrop-blur-sm
   "
			style={{
				left: hover.screenX + 12,
				top: hover.screenY - 12,
				transform: "translateY(-100%)",
			}}
		>
			<div
				className="
      h-1.5 w-full
      bg-[linear-gradient(90deg,rgba(34,211,238,0.75),rgba(125,211,252,0.22),transparent)]
    "
			/>

			<div className="space-y-3 p-3">
				<div className="flex items-start justify-between gap-2">
					<div>
						<p className="text-[10px] tracking-[0.2em] text-cyan-200/90 uppercase">
							{entityLabel} Echo
						</p>
						<p className="mt-1 text-sm font-semibold text-white">{hover.name}</p>
					</div>
					<span className="relative mt-0.5 inline-flex size-4 items-center justify-center">
						<span
							className="
         absolute inline-flex size-4 animate-ping rounded-full bg-cyan-300/45
       "
						/>
						<span
							className="
         absolute inline-flex size-4 rounded-full border border-cyan-200/65
         bg-cyan-300/15
       "
						/>
						<span className="relative inline-flex size-1.5 rounded-full bg-cyan-100" />
					</span>
				</div>

				<div className="rounded-lg border border-white/10 bg-white/3 px-2.5 py-2">
					<p className="text-[9px] tracking-[0.18em] text-slate-400 uppercase">Coordinates</p>
					<p className="mt-1 font-mono text-[11px] text-slate-200">{hover.addressLabel}</p>
				</div>

				{hover.hostility ? (
					<div className={`
       rounded-lg border px-2.5 py-2
       ${hover.hostility.status === "hostile" ? `
         border-rose-300/20 bg-rose-400/[0.07]
       ` : `border-emerald-300/20 bg-emerald-400/[0.07]`}
     `}>
						<p className={`
        text-[9px] tracking-[0.18em] uppercase
        ${hover.hostility.status === "hostile" ? "text-rose-200/95" : `
          text-emerald-200/95
        `}
      `}>{hover.hostility.status === "hostile" ? "Hostile Territory" : "Cleared Sector"}</p>
						<p className={`
        mt-1 text-[12px] font-medium
        ${hover.hostility.status === "hostile" ? "text-rose-100" : `
          text-emerald-100
        `}
      `}>{hover.hostility.hostileFactionKey === "rogueAi" ? "Rogue AI" : "Space Pirates"}</p>
						<p className="mt-0.5 text-[11px] text-white/50">
							{hover.hostility.clearedPlanetCount}/{hover.hostility.hostilePlanetCount} planets
							cleared
						</p>
					</div>
				) : null}

				{hover.colonyName && hover.colonyPlayerName ? (
					<div
						className="
        rounded-lg border border-emerald-300/20 bg-emerald-400/[0.07] px-2.5
        py-2
      "
					>
						<p className="text-[9px] tracking-[0.18em] text-emerald-200/95 uppercase">
							Colony Signal
						</p>
						<p className="mt-1 text-[12px] font-medium text-emerald-100">{hover.colonyName}</p>
						<p className="mt-0.5 text-[11px] text-emerald-100/85">
							Commander {hover.colonyPlayerName}
						</p>
					</div>
				) : null}
			</div>
		</div>
	);
}
