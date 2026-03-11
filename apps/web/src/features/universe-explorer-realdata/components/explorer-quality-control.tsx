import type { ExplorerQualityPreset } from "../types";

const QUALITY_LABELS: Array<{ label: string; value: ExplorerQualityPreset }> = [
	{ label: "Auto", value: "auto" },
	{ label: "Low", value: "low" },
	{ label: "Medium", value: "medium" },
	{ label: "High", value: "high" },
];

export function ExplorerQualityControl({
	qualityPreset,
	onQualityPresetChange,
}: {
	qualityPreset: ExplorerQualityPreset;
	onQualityPresetChange: (preset: ExplorerQualityPreset) => void;
}) {
	return (
		<div
			className="
     rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs
     text-slate-200
   "
		>
			<p className="text-[11px] tracking-[0.18em] text-slate-300 uppercase">Render quality</p>
			<div className="mt-2 flex flex-wrap gap-1">
				{QUALITY_LABELS.map((entry) => {
					const isActive = entry.value === qualityPreset;
					return (
						<button key={entry.value} className={isActive ? `
        rounded-sm border border-cyan-300/70 bg-cyan-400/20 px-2 py-1
        text-[11px] text-cyan-100
      ` : `
        rounded-sm border border-white/15 bg-white/5 px-2 py-1 text-[11px]
        text-slate-300
        hover:bg-white/10
      `} onClick={() => onQualityPresetChange(entry.value)} type="button">
							{entry.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}
