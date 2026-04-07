import type { ShipKey } from "@nullvector/game-logic";

import {
	CONTRACT_TASK_FORCE_SHIP_WEIGHTS,
	DEFAULT_SHIP_DEFINITIONS,
} from "@nullvector/game-logic";
import { Minus, Plus } from "lucide-react";

import { getShipImagePath, SHIP_GROUPS } from "./shipyard-shared";

type ShipAssignmentShip = {
	available: number;
	key: ShipKey;
	name: string;
};

// Ordered light → heavy for consistent meter fill direction
const WEIGHT_ORDER: ShipKey[] = [
	"interceptor",
	"smallCargo",
	"largeCargo",
	"frigate",
	"colonyShip",
	"cruiser",
	"bomber",
];

type ShipColorScheme = {
	segment: string;
	badgeActive: string;
	dot: string;
};

const SHIP_COLOR: Record<ShipKey, ShipColorScheme> = {
	interceptor: {
		segment: "bg-sky-400/60",
		badgeActive: "border-sky-400/30 text-sky-300/85",
		dot: "bg-sky-400/65",
	},
	smallCargo: {
		segment: "bg-slate-400/45",
		badgeActive: "border-slate-400/25 text-slate-300/75",
		dot: "bg-slate-400/50",
	},
	largeCargo: {
		segment: "bg-indigo-400/55",
		badgeActive: "border-indigo-400/30 text-indigo-300/80",
		dot: "bg-indigo-400/60",
	},
	frigate: {
		segment: "bg-blue-400/60",
		badgeActive: "border-blue-400/30 text-blue-300/85",
		dot: "bg-blue-400/65",
	},
	colonyShip: {
		segment: "bg-violet-400/55",
		badgeActive: "border-violet-400/30 text-violet-300/80",
		dot: "bg-violet-400/60",
	},
	cruiser: {
		segment: "bg-amber-400/60",
		badgeActive: "border-amber-400/30 text-amber-300/85",
		dot: "bg-amber-400/65",
	},
	bomber: {
		segment: "bg-rose-400/60",
		badgeActive: "border-rose-400/30 text-rose-300/85",
		dot: "bg-rose-400/65",
	},
};

export function ShipAssignmentList(props: {
	label: string;
	selectedShips: Record<ShipKey, number>;
	ships: ShipAssignmentShip[];
	taskForceCap?: number;
	selectedTaskForce?: number;
	onShipCountChange: (shipKey: ShipKey, nextCount: number) => void;
}) {
	const showMeter =
		props.taskForceCap !== undefined && props.selectedTaskForce !== undefined;

	return (
		<div>
			<SectionLabel>{props.label}</SectionLabel>
			{showMeter ? (
				<TaskForceMeter
					selectedShips={props.selectedShips}
					selectedTaskForce={props.selectedTaskForce!}
					taskForceCap={props.taskForceCap!}
				/>
			) : null}
			<div className="mt-3 space-y-2.5">
				{SHIP_GROUPS.map((group) => {
					const groupShips = group.keys
						.map((key) => props.ships.find((ship) => ship.key === key))
						.filter((ship): ship is ShipAssignmentShip => ship != null);
					if (groupShips.length === 0) {
						return null;
					}

					return (
						<div key={group.label}>
							<p
								className="
              mb-1 text-[8px] font-semibold tracking-[0.12em] text-white/25
              uppercase
            "
							>
								{group.label}
							</p>
							{groupShips.map((ship, index) => {
								const count = props.selectedShips[ship.key] ?? 0;
								const weight = CONTRACT_TASK_FORCE_SHIP_WEIGHTS[ship.key];
								const colors = SHIP_COLOR[ship.key];

								return (
									<div
										key={ship.key}
										className={`
                    flex items-center gap-2 py-1.5
                    ${index < groupShips.length - 1 ? "border-b border-white/6" : ""}
                  `}
									>
										<img
											alt={ship.name}
											className="size-5 shrink-0 object-contain"
											src={getShipImagePath(ship.key)}
										/>
										<span
											className={`
                      min-w-0 flex-1 truncate text-xs
                      ${count > 0 ? "font-semibold text-white" : "text-white/70"}
                    `}
										>
											{ship.name}
										</span>

										{/* Unit cost badge */}
										<span
											className={`
                      shrink-0 rounded border px-1 py-px
                      font-(family-name:--nv-font-mono) text-[8px] font-bold
                      transition-colors duration-200
                      ${count > 0 ? colors.badgeActive : "border-white/8 text-white/18"}
                    `}
										>
											{weight}pt
										</span>

										<span
											className="
                      shrink-0 font-(family-name:--nv-font-mono) text-[9px] text-white/30
                    "
										>
											({ship.available})
										</span>
										<div className="flex shrink-0 items-center gap-0.5">
											<button
												className="
                        flex size-5 items-center justify-center rounded-sm border
                        border-white/10 bg-black/25 text-white/60
                        disabled:opacity-25
                      "
												disabled={count <= 0}
												onClick={() => props.onShipCountChange(ship.key, count - 1)}
												type="button"
											>
												<Minus className="size-2.5" />
											</button>
											<span
												className={`
                        w-6 text-center font-(family-name:--nv-font-mono) text-xs font-bold
                        ${count > 0 ? "text-cyan-100" : "text-white/30"}
                      `}
											>
												{count}
											</span>
											<button
												className="
                        flex size-5 items-center justify-center rounded-sm border
                        border-white/10 bg-black/25 text-white/60
                        disabled:opacity-25
                      "
												disabled={count >= ship.available}
												onClick={() => props.onShipCountChange(ship.key, count + 1)}
												type="button"
											>
												<Plus className="size-2.5" />
											</button>
										</div>
									</div>
								);
							})}
						</div>
					);
				})}
			</div>
		</div>
	);
}

function TaskForceMeter(props: {
	selectedShips: Record<ShipKey, number>;
	taskForceCap: number;
	selectedTaskForce: number;
}) {
	const overCap = props.selectedTaskForce > props.taskForceCap;
	const hasSelection = props.selectedTaskForce > 0;
	const remaining = Math.max(0, props.taskForceCap - props.selectedTaskForce);

	// Build a flat list of segments ordered light → heavy
	const allSegments: Array<ShipKey> = [];
	for (const key of WEIGHT_ORDER) {
		const count = props.selectedShips[key] ?? 0;
		const weight = CONTRACT_TASK_FORCE_SHIP_WEIGHTS[key];
		for (let i = 0; i < count * weight; i++) {
			allSegments.push(key);
		}
	}

	// Slots within cap (filled or empty)
	const capSlots: Array<ShipKey | null> = Array.from(
		{ length: props.taskForceCap },
		(_, i) => allSegments[i] ?? null,
	);

	// Overflow blocks beyond the cap
	const overSegments: ShipKey[] = overCap ? allSegments.slice(props.taskForceCap) : [];

	// Ships contributing to the current selection (for legend)
	const activeShips = WEIGHT_ORDER.filter((key) => (props.selectedShips[key] ?? 0) > 0);

	return (
		<div
			className="
      mt-1.5 overflow-hidden rounded-lg border border-white/10
      bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.25))]
    "
		>
			{/* Header row */}
			<div className="flex items-center justify-between px-3 pt-2.5 pb-2">
				<span
					className="
          text-[8px] font-semibold tracking-[0.18em] text-white/30 uppercase
        "
				>
					Task Force
				</span>
				<div className="flex items-baseline gap-0.5">
					<span
						className={`
            font-(family-name:--nv-font-mono) text-sm font-bold leading-none
            transition-colors duration-200
            ${overCap ? "text-rose-300" : hasSelection ? "text-cyan-200" : "text-white/25"}
          `}
					>
						{props.selectedTaskForce}
					</span>
					<span className="font-(family-name:--nv-font-mono) text-[10px] text-white/20">
						/{props.taskForceCap}
					</span>
					{!overCap && hasSelection ? (
						<span
							className="
              ml-1.5 font-(family-name:--nv-font-mono) text-[9px] text-white/20
            "
						>
							({remaining} rem)
						</span>
					) : null}
					{overCap ? (
						<span
							className="
              ml-1.5 font-(family-name:--nv-font-mono) text-[9px] font-semibold
              text-rose-400/80
            "
						>
							+{props.selectedTaskForce - props.taskForceCap} over
						</span>
					) : null}
				</div>
			</div>

			{/* Segment bar */}
			<div className="flex items-end gap-[2px] px-3">
				{capSlots.map((shipKey, i) => {
					const filled = shipKey !== null;
					// Taller blocks for filled segments to create a staircase feel
					return (
						<div
							key={i}
							className={`
              flex-1 rounded-t-[2px] transition-all duration-200
              ${filled ? `h-3 ${SHIP_COLOR[shipKey!].segment}` : "h-2 bg-white/6"}
            `}
						/>
					);
				})}
				{/* Overflow blocks */}
				{overSegments.map((shipKey, i) => (
					<div
						key={`over-${i}`}
						className={`
            h-3 w-2 shrink-0 animate-pulse rounded-t-[2px]
            ${SHIP_COLOR[shipKey].segment}
          `}
					/>
				))}
			</div>

			{/* Thin accent line at base of bar */}
			<div
				className={`
        h-px mx-3 transition-colors duration-300
        ${overCap ? "bg-rose-400/40" : hasSelection ? "bg-cyan-400/20" : "bg-white/6"}
      `}
			/>

			{/* Legend / empty state */}
			<div className="px-3 pt-1.5 pb-2.5">
				{hasSelection ? (
					<div className="flex flex-wrap gap-x-3 gap-y-0.5">
						{activeShips.map((key) => {
							const count = props.selectedShips[key] ?? 0;
							const contribution = count * CONTRACT_TASK_FORCE_SHIP_WEIGHTS[key];
							return (
								<span key={key} className="flex items-center gap-1 text-[8px] text-white/35">
									<span className={`inline-block size-1.5 rounded-[1px] ${SHIP_COLOR[key].dot}`} />
									{DEFAULT_SHIP_DEFINITIONS[key].name}
									<span className="font-(family-name:--nv-font-mono) text-white/22">
										{contribution}pt
									</span>
								</span>
							);
						})}
					</div>
				) : (
					<p className="text-[8px] text-white/20">
						Each ship costs task force points — assign ships to allocate.
					</p>
				)}
			</div>
		</div>
	);
}

function SectionLabel(props: { children: string }) {
	return (
		<p
			className="
      text-[10px] font-semibold tracking-[0.18em] text-white/45 uppercase
    "
		>
			{props.children}
		</p>
	);
}
