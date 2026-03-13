import type { ShipKey } from "@nullvector/game-logic";

import { Minus, Plus } from "lucide-react";

import { getShipImagePath, SHIP_GROUPS } from "./shipyard-mock-shared";

type ShipAssignmentShip = {
	available: number;
	key: ShipKey;
	name: string;
};

export function ShipAssignmentList(props: {
	label: string;
	selectedShips: Record<ShipKey, number>;
	ships: ShipAssignmentShip[];
	onShipCountChange: (shipKey: ShipKey, nextCount: number) => void;
}) {
	return (
		<div>
			<SectionLabel>{props.label}</SectionLabel>
			<div className="mt-1.5 space-y-2.5">
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

								return (
									<div key={ship.key} className={`
           flex items-center gap-2 py-1.5
           ${index < groupShips.length - 1 ? "border-b border-white/6" : ""}
         `}>
										<img
											alt={ship.name}
											className="size-5 shrink-0 object-contain"
											src={getShipImagePath(ship.key)}
										/>
										<span className={`
            min-w-0 flex-1 truncate text-xs
            ${count > 0 ? "font-semibold text-white" : "text-white/70"}
          `}>{ship.name}</span>
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
											<span className={`
             w-6 text-center font-(family-name:--nv-font-mono) text-xs font-bold
             ${count > 0 ? "text-cyan-100" : "text-white/30"}
           `}>{count}</span>
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
