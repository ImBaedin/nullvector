import type { ShipKey } from "@nullvector/game-logic";
import type { ReactNode } from "react";

import { Popover } from "@base-ui/react/popover";
import { AlertTriangle, Clock3, Gauge, Layers3, X } from "lucide-react";

const SHIP_KEY_TO_SLUG: Record<ShipKey, string> = {
	smallCargo: "small-cargo",
	largeCargo: "large-cargo",
	colonyShip: "colony-ship",
	interceptor: "interceptor",
	frigate: "frigate",
	cruiser: "cruiser",
	bomber: "bomber",
};

export function getShipImagePath(shipKey: ShipKey): string {
	return `/game-icons/ships/${SHIP_KEY_TO_SLUG[shipKey]}.png`;
}

export type ShipGroup = {
	label: string;
	keys: ShipKey[];
};

export const SHIP_GROUPS: ShipGroup[] = [
	{ label: "Cargo", keys: ["smallCargo", "largeCargo"] },
	{ label: "Combat", keys: ["interceptor", "frigate", "cruiser", "bomber"] },
	{ label: "Utility", keys: ["colonyShip"] },
];

export type ShipDefinition = {
	buildSeconds: number;
	cargo: string;
	cost: { alloy: number; crystal: number; fuel: number };
	description: string;
	image: string;
	name: string;
	stock: number;
	speed: string;
	unlocked: boolean;
	warning?: string;
};

export type QueueItem = {
	id: string;
	isActive: boolean;
	remaining: number;
	shipName: string;
	timeLeftSeconds: number;
	total: number;
};

type QueuePanelShipCatalogEntry = {
	cost: { alloy: number; crystal: number; fuel: number };
	image: string;
	name: string;
};

export const SHIPS: ShipDefinition[] = [
	{
		buildSeconds: 42,
		cargo: "5,000",
		cost: { alloy: 2_500, crystal: 900, fuel: 700 },
		description: "Short-haul freighter for balancing alloy and crystal across nearby colonies.",
		image: "/game-icons/ships/small-cargo.png",
		name: "Small Cargo",
		stock: 37,
		speed: "12.5 AU/min",
		unlocked: true,
	},
	{
		buildSeconds: 125,
		cargo: "25,000",
		cost: { alloy: 12_000, crystal: 5_200, fuel: 3_600 },
		description: "Bulk logistics hull with expanded cargo pods and reinforced engines.",
		image: "/game-icons/ships/large-cargo.png",
		name: "Large Cargo",
		stock: 8,
		speed: "8.6 AU/min",
		unlocked: false,
		warning: "Requires Shipyard Level 3 (current: 2).",
	},
	{
		buildSeconds: 560,
		cargo: "75,000 + colony module",
		cost: { alloy: 55_000, crystal: 38_000, fuel: 28_000 },
		description: "Ark-class expansion vessel carrying habitat modules and colony command systems.",
		image: "/game-icons/ships/colony-ship.png",
		name: "Colony Ship",
		stock: 1,
		speed: "6.1 AU/min",
		unlocked: false,
		warning: "Requires Interstellar Habitats research and Shipyard Level 5.",
	},
];

export const POPOVER_PANEL_CLASS =
	"origin-[var(--transform-origin)] w-[240px] rounded-xl border border-white/30 bg-[rgba(5,10,18,0.82)] p-3 text-xs text-white/90 shadow-[0_20px_45px_rgba(0,0,0,0.5)] outline-none backdrop-blur-md transition-[transform,scale,opacity] duration-200 data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0";

function resourceIcon(kind: "alloy" | "crystal" | "fuel") {
	if (kind === "alloy") {
		return "/game-icons/alloy.png";
	}
	if (kind === "crystal") {
		return "/game-icons/crystal.png";
	}
	return "/game-icons/deuterium.png";
}

export function formatDuration(seconds: number) {
	const totalSeconds = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(totalSeconds / 3_600);
	const minutes = Math.floor((totalSeconds % 3_600) / 60);
	const remainingSeconds = totalSeconds % 60;
	if (hours > 0) {
		return `${hours}h ${minutes}m ${remainingSeconds}s`;
	}
	if (minutes > 0) {
		return `${minutes}m ${remainingSeconds}s`;
	}
	return `${remainingSeconds}s`;
}

export function CostPill(props: {
	amount: number;
	kind: "alloy" | "crystal" | "fuel";
	label: string;
}) {
	const { amount, kind, label } = props;
	return (
		<span
			className="
     inline-flex items-center gap-1 rounded-md border border-white/20
     bg-black/35 px-2 py-1 text-[11px] font-semibold text-slate-100
   "
		>
			<img alt={`${label} icon`} className="size-3.5 object-contain" src={resourceIcon(kind)} />
			{amount.toLocaleString()}
		</span>
	);
}

export function LockWarningPopover({ message }: { message: string }) {
	return (
		<Popover.Root>
			<Popover.Trigger
				closeDelay={90}
				delay={60}
				openOnHover
				render={
					<button
						className="
        rounded-full border border-amber-100/35 bg-amber-300/20 p-1
        text-amber-100
      "
					>
						<AlertTriangle className="size-3.5" />
					</button>
				}
			/>
			<Popover.Portal>
				<Popover.Positioner align="end" className="z-90" sideOffset={8}>
					<Popover.Popup className={POPOVER_PANEL_CLASS}>{message}</Popover.Popup>
				</Popover.Positioner>
			</Popover.Portal>
		</Popover.Root>
	);
}

export function initialQueue(): QueueItem[] {
	return [
		{
			id: "active-small-cargo",
			isActive: true,
			remaining: 4,
			shipName: "Small Cargo",
			timeLeftSeconds: 168,
			total: 12,
		},
		{
			id: "queued-large-cargo",
			isActive: false,
			remaining: 2,
			shipName: "Large Cargo",
			timeLeftSeconds: 250,
			total: 2,
		},
		{
			id: "queued-small-cargo",
			isActive: false,
			remaining: 8,
			shipName: "Small Cargo",
			timeLeftSeconds: 336,
			total: 8,
		},
	];
}

export function addToQueue(current: QueueItem[], shipName: string, amount: number) {
	const ship = SHIPS.find((entry) => entry.name === shipName);
	if (!ship || amount <= 0) {
		return current;
	}

	const nextItem: QueueItem = {
		id: `${shipName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}-${amount}`,
		isActive: current.length === 0,
		remaining: amount,
		shipName,
		timeLeftSeconds: ship.buildSeconds * amount,
		total: amount,
	};
	return [...current, nextItem];
}

export function cancelQueueItem(current: QueueItem[], id: string) {
	const withoutItem = current.filter((item) => item.id !== id);
	if (withoutItem.length === 0) {
		return withoutItem;
	}
	const hasActive = withoutItem.some((item) => item.isActive);
	if (hasActive) {
		return withoutItem;
	}
	return withoutItem.map((item, index) => (index === 0 ? { ...item, isActive: true } : item));
}

export function QueuePanel(props: {
	className?: string;
	fleetTotal?: number;
	items: QueueItem[];
	onCancel: (id: string) => void;
	shipCatalog?: QueuePanelShipCatalogEntry[];
	showCosts?: boolean;
	title?: ReactNode;
}) {
	const { className, fleetTotal, items, onCancel, shipCatalog, showCosts = false, title } = props;
	const active = items.find((item) => item.isActive);
	const railItems = items;
	const ships = shipCatalog ?? SHIPS;
	const totalFleet = fleetTotal ?? SHIPS.reduce((sum, ship) => sum + ship.stock, 0);
	return (
		<section className={`
    rounded-xl border border-white/12 bg-black/25 p-3
    ${className ?? ""}
  `}>
			<div className="flex items-center justify-between gap-2">
				<h3 className="text-xs font-semibold tracking-[0.14em] text-white/70 uppercase">
					{title ?? "Production Queue"}
				</h3>
				<span className="text-[11px] text-white/60">
					{items.length} items • Fleet {totalFleet.toLocaleString()}
				</span>
			</div>

			{!active ? (
				<p
					className="
       mt-2 rounded-lg border border-white/10 bg-black/20 p-2 text-xs
       text-white/70
     "
				>
					No active build.
				</p>
			) : null}

			<div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
				{railItems.length === 0 ? (
					<p
						className="
        rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-white/65
      "
					>
						No queued builds.
					</p>
				) : null}
				{railItems.map((item, index) => {
					const ship = ships.find((entry) => entry.name === item.shipName);
					const completed = Math.max(0, item.total - item.remaining);
					const progress =
						item.total > 0
							? Math.max(0, Math.min(100, Math.round((completed / item.total) * 100)))
							: 0;
					return (
						<article className={`
        relative min-w-[320px] snap-start rounded-2xl border p-4 text-xs
        ${item.isActive ? `
          border-cyan-200/45
          bg-[linear-gradient(155deg,rgba(68,200,255,0.2),rgba(6,14,24,0.94))]
        ` : `
          border-white/12
          bg-[linear-gradient(155deg,rgba(18,24,36,0.88),rgba(6,10,16,0.92))]
        `}
      `} key={item.id}>
							<div
								className="
          pointer-events-none absolute inset-0
          bg-[radial-gradient(circle_at_8%_10%,rgba(255,255,255,0.09),transparent_35%)]
        "
							/>
							<div className="flex items-start justify-between gap-2">
								<div>
									<p className="font-semibold text-white/92">
										{item.isActive ? "Active Build" : `Queued #${index + 1}`}
									</p>
									<p className="text-[11px] text-white/65">{item.shipName}</p>
								</div>
								<button
									className="
           inline-flex items-center gap-1 rounded-md border border-rose-200/45
           bg-rose-300/15 px-2 py-0.5 text-[11px] font-medium text-rose-100
         "
									onClick={() => onCancel(item.id)}
								>
									<X className="size-3" />
									Cancel
								</button>
							</div>

							<div className="mt-3 grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3">
								{ship ? (
									<img
										alt={`${ship.name} queue icon`}
										className="size-14 rounded-xl bg-black/30 object-contain p-1.5"
										src={ship.image}
									/>
								) : null}
								<div className="min-w-0">
									{item.isActive ? (
										<>
											<div className="grid grid-cols-3 gap-3">
												<MetricInline label="Total" value={item.total.toLocaleString()} />
												<MetricInline
													label="Left"
													tone="cyan"
													value={item.remaining.toLocaleString()}
												/>
												<MetricInline
													label="Time Left"
													tone="cyan"
													value={formatDuration(item.timeLeftSeconds)}
												/>
											</div>
										</>
									) : (
										<>
											<div className="grid grid-cols-2 gap-3">
												<MetricInline
													icon={<Layers3 className="size-3" />}
													label="Batch"
													value={`${item.total.toLocaleString()} ships`}
												/>
												<MetricInline
													icon={<Clock3 className="size-3" />}
													label="Completes In"
													value={formatDuration(item.timeLeftSeconds)}
												/>
											</div>
										</>
									)}
								</div>
							</div>

							{showCosts && ship ? (
								<div className="mt-2 flex flex-wrap gap-1.5">
									<CostPill amount={ship.cost.alloy * item.total} kind="alloy" label="Alloy" />
									<CostPill
										amount={ship.cost.crystal * item.total}
										kind="crystal"
										label="Crystal"
									/>
									<CostPill amount={ship.cost.fuel * item.total} kind="fuel" label="Fuel" />
								</div>
							) : null}

							{item.isActive ? (
								<div className="mt-3 border-t border-white/10 pt-2">
									<div className="h-1.5 overflow-hidden rounded-full bg-white/15">
										<div
											className="h-full rounded-full bg-cyan-300/80 transition-all"
											style={{ width: `${progress}%` }}
										/>
									</div>
									<p
										className="
            mt-1 inline-flex items-center gap-1 text-[11px] text-cyan-100/85
          "
									>
										<Gauge className="size-3" />
										{progress}% of batch completed
									</p>
								</div>
							) : null}
						</article>
					);
				})}
			</div>
		</section>
	);
}

function MetricInline(props: {
	icon?: ReactNode;
	label: string;
	tone?: "default" | "cyan";
	value: string;
}) {
	const { icon, label, tone = "default", value } = props;
	return (
		<div className="min-w-0">
			<p className={`
     inline-flex items-center gap-1 text-[10px] tracking-widest uppercase
     ${tone === "cyan" ? "text-cyan-100/80" : "text-white/55"}
   `}>
				{icon}
				{label}
			</p>
			<p className={`
     mt-0.5 truncate text-[13px] leading-tight font-semibold
     ${tone === "cyan" ? "text-cyan-50" : "text-white/92"}
   `}>{value}</p>
		</div>
	);
}
