import type { LucideIcon } from "lucide-react";

import { CircleDot, Earth, Globe, Grid3x3, Sparkles, Sun } from "lucide-react";

import type { FleetMissionKind } from "@/features/colony-route/star-map-picker-context";

import { cn } from "@/lib/utils";

import type { ExplorerLevel, RenderableEntity } from "../types";

type StarMapHudPanelProps = {
	entities: RenderableEntity[];
	hoveredId: string | null;
	isOpen: boolean;
	isReady: boolean;
	levelLabel: ExplorerLevel;
	pathItems: Array<{ id: string; label: string; onSelect: () => void }>;
	pickerRequest: { missionKind: FleetMissionKind } | null;
	onHoverEntity: (entity: RenderableEntity) => void;
	onHoverEnd: () => void;
	onExit: () => void;
	onSelectEntity: (entity: RenderableEntity) => void;
};

type LevelConfig = {
	Icon: LucideIcon;
};

const LEVEL_CONFIG: Record<ExplorerLevel, LevelConfig> = {
	galaxy: { Icon: Sparkles },
	planet: { Icon: CircleDot },
	sector: { Icon: Grid3x3 },
	system: { Icon: Sun },
	universe: { Icon: Globe },
};

const LEVEL_ENTITY_LABEL: Record<ExplorerLevel, string> = {
	galaxy: "Galaxies",
	planet: "Planets",
	sector: "Sectors",
	system: "Systems",
	universe: "Galaxies",
};

function EntityStatusDot({ entity }: { entity: RenderableEntity }) {
	if (entity.colony) {
		return (
			<span className="relative mt-1 flex size-1.5 shrink-0">
				<span
					className="
       absolute inline-flex size-full animate-ping rounded-full bg-cyan-400/50
     "
				/>
				<span className="relative inline-flex size-1.5 rounded-full bg-cyan-300/90" />
			</span>
		);
	}

	if (entity.hostility?.status === "hostile") {
		return <span className="mt-1 size-1.5 shrink-0 rounded-full bg-rose-400/70" />;
	}

	if (entity.hostility?.status === "cleared") {
		return <span className="mt-1 size-1.5 shrink-0 rounded-full bg-emerald-400/60" />;
	}

	return <span className="mt-1 size-1.5 shrink-0 rounded-full bg-white/20" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<p
			className="
     font-(family-name:--nv-font-mono) text-[8px] tracking-[0.2em]
     text-cyan-200/30 uppercase
   "
		>
			{children}
		</p>
	);
}

export function StarMapHudPanel({
	entities,
	hoveredId,
	isOpen,
	isReady,
	levelLabel,
	pathItems,
	pickerRequest,
	onHoverEntity,
	onHoverEnd,
	onExit,
	onSelectEntity,
}: StarMapHudPanelProps) {
	const visible = isOpen && isReady;
	const { Icon } = LEVEL_CONFIG[levelLabel] ?? LEVEL_CONFIG.universe;
	const entityLabel = LEVEL_ENTITY_LABEL[levelLabel];

	return (
		<div
			className={cn(
				// Position
				"fixed top-[80px] left-2 z-10",
				// Sizing
				"flex w-56 flex-col overflow-hidden",
				"max-h-[calc(100dvh-96px)]",
				// Visual
				"rounded-xl border border-l-0 border-white/10",
				"bg-[linear-gradient(160deg,rgba(8,14,26,0.94),rgba(5,10,19,0.96))]",
				"shadow-[4px_8px_32px_rgba(0,0,0,0.55),0_0_0_1px_rgba(103,232,249,0.04)]",
				"backdrop-blur-md",
				// Animation
				`
      transition-[transform,opacity] duration-300
      ease-[cubic-bezier(0.22,1,0.36,1)]
    `,
				visible
					? "pointer-events-auto translate-x-0 opacity-100"
					: "pointer-events-none -translate-x-[calc(100%+12px)] opacity-0",
			)}
		>
			{/* Left accent border */}
			<div className={cn(`
     absolute inset-y-0 left-0 w-[2px] rounded-l-xl transition-opacity
     duration-500
   `, `
     bg-[linear-gradient(180deg,rgba(34,211,238,0.55),rgba(34,211,238,0.18),rgba(34,211,238,0.04))]
   `, visible ? "opacity-100" : "opacity-0")} />

			{/* Picker mode banner */}
			{pickerRequest ? (
				<div
					className="
       mx-3 mt-3 rounded-lg border border-amber-300/22 bg-amber-400/8 px-3
       py-2.5
     "
				>
					<p
						className="
        font-(family-name:--nv-font-mono) text-[8px] tracking-[0.18em]
        text-amber-200/60 uppercase
      "
					>
						Target Selection Active
					</p>
					<p className="mt-1 text-[11px] font-medium text-amber-100/90">
						{pickerRequest.missionKind === "transport"
							? "Pick a colonized planet"
							: "Pick a destination planet"}
					</p>
				</div>
			) : null}

			{/* Level indicator */}
			<div className="px-4 pt-3.5 pb-3 pl-5">
				<SectionLabel>Navigation Console</SectionLabel>
				<div key={levelLabel} className="mt-2 flex items-center gap-2.5">
					<div
						className="
        flex size-6 shrink-0 items-center justify-center rounded-md border
        border-cyan-300/18 bg-cyan-400/8
      "
					>
						<Icon className="size-3.5 text-cyan-300/75" />
					</div>
					<span
						className="
        font-(family-name:--nv-font-display) text-[13px] font-bold tracking-wide
        text-white/90
      "
					>
						{levelLabel.charAt(0).toUpperCase() + levelLabel.slice(1)} View
					</span>
				</div>
			</div>

			<div className="mx-3 h-px bg-linear-to-r from-white/8 via-white/4 to-transparent" />

			{/* Breadcrumb path */}
			<div className="p-3 pl-5">
				<SectionLabel>Current Path</SectionLabel>
				<div className="mt-2.5">
					{pathItems.map((item, index) => {
						const isLast = index === pathItems.length - 1;
						return (
							<div className="flex items-start gap-2.5" key={item.id}>
								{/* Connector column */}
								<div className="flex w-2.5 shrink-0 flex-col items-center">
									<div className={cn("mt-[5px] size-[7px] rounded-full border", isLast ? `
           border-cyan-300/60 bg-cyan-400/30
           shadow-[0_0_5px_rgba(34,211,238,0.4)]
         ` : "border-white/20 bg-white/8")} />
									{!isLast ? <div className="mt-[2px] h-4 w-px bg-white/10" /> : null}
								</div>

								{/* Label */}
								<button
									className={cn(
										"pb-1 text-left text-[11px] transition-colors",
										isLast ? "font-semibold text-cyan-100" : `
            text-white/40
            hover:text-white/70
          `,
									)}
									onClick={item.onSelect}
									type="button"
								>
									{item.label}
								</button>
							</div>
						);
					})}
				</div>
			</div>

			<div className="mx-3 h-px bg-linear-to-r from-white/8 via-white/4 to-transparent" />

			{/* Entity list */}
			<div className="flex min-h-0 flex-1 flex-col p-3 pl-5">
				<SectionLabel>
					{entityLabel}
					{entities.length > 0 ? ` · ${entities.length}` : ""}
				</SectionLabel>

				<div className="mt-2 min-h-0 flex-1 overflow-y-auto">
					{entities.length === 0 ? (
						<p className="py-1 text-[11px] text-white/20">No objects detected</p>
					) : (
						<div className="space-y-0.5">
							{entities.map((entity) => (
								<button className={cn(`
          flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left
          transition-colors
          hover:bg-white/4
        `, hoveredId === entity.id ? "bg-cyan-400/10 text-white" : null)} key={entity.id} onMouseEnter={() => onHoverEntity(entity)} onMouseLeave={onHoverEnd} onMouseMove={() => onHoverEntity(entity)} onClick={() => onSelectEntity(entity)} type="button">
									<EntityStatusDot entity={entity} />
									<div className="min-w-0 flex-1">
										<p className="truncate text-[11px] font-medium text-white/80">{entity.name}</p>
										<p
											className="
             font-(family-name:--nv-font-mono) text-[9px] text-white/22
           "
										>
											{entity.addressLabel}
										</p>
									</div>
								</button>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Footer — Return to Colony */}
			<div className="border-t border-white/8 p-2">
				<button
					className="
       flex w-full items-center gap-2 rounded-lg border border-white/8
       bg-white/3 px-3 py-2 text-[11px] font-medium text-white/45
       transition-colors
       hover:bg-white/6 hover:text-white/70
     "
					onClick={onExit}
					type="button"
				>
					<Earth className="size-3.5" />
					Return to Colony
				</button>
			</div>
		</div>
	);
}
