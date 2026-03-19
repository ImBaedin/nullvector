import type { ResourceBucket, ShipKey } from "@nullvector/game-logic";

import {
	Check,
	ChevronDown,
	Crosshair,
	Globe2,
	Package,
	Rocket,
	RotateCcw,
	Sparkles,
} from "lucide-react";

import { formatColonyDuration } from "@/features/colony-ui/time";

import type { FleetTargetResolution, PlannerCoords } from "./fleet-hooks";
import type { FleetMissionKind } from "./star-map-picker-context";

import { ShipAssignmentList } from "./ship-assignment-list";

type PlannerCoordsKey = keyof PlannerCoords;

const COORD_FIELD_LABELS = {
	g: "Galaxy",
	p: "Planet",
	s: "Sector",
	ss: "System",
} as const satisfies Record<PlannerCoordsKey, string>;

type MissionPlannerPanelProps = {
	availableResources: ResourceBucket;
	canLaunch: boolean;
	cargo: ResourceBucket;
	cargoCapacity: number;
	cargoUsed: number;
	colonyPickerOpen: boolean;
	coords: PlannerCoords;
	distance: number;
	hasShips: boolean;
	launchCtaLabel: string;
	missionType: FleetMissionKind;
	nonCurrentColonies: Array<{ addressLabel: string; id: string; name: string }>;
	oneWaySeconds: number;
	onCargoChange: (cargo: ResourceBucket) => void;
	onCoordsChange: (coords: PlannerCoords) => void;
	onLaunch: () => void;
	onMissionTypeChange: (missionType: FleetMissionKind) => void;
	onOpenMapPicker: () => void;
	onRoundTripChange: (value: boolean) => void;
	onSelectColony: (colonyId: string) => void;
	onSetColonyPickerOpen: (open: boolean) => void;
	onSetSelectedColonyId: (colonyId: string | null) => void;
	onShipCountChange: (shipKey: ShipKey, nextCount: number) => void;
	roundTrip: boolean;
	selectedColonyId: string | null;
	selectedShips: Record<ShipKey, number>;
	ships: Array<{
		available: number;
		cargoCapacity: number;
		fuelLaunchCost: number;
		fuelDistanceRate: number;
		key: ShipKey;
		name: string;
		speed: number;
	}>;
	slowestSpeed: number;
	supportsStationing: boolean;
	targetResolution: FleetTargetResolution;
	travelFuelCost: number;
};

export function MissionPlannerPanel(props: MissionPlannerPanelProps) {
	return (
		<div className="lg:sticky lg:top-4 lg:self-start">
			<div
				className="
     rounded-2xl border border-white/12
     bg-[linear-gradient(170deg,rgba(12,20,36,0.95),rgba(6,10,18,0.98))]
   "
			>
				<header
					className="
      flex items-center gap-2.5 border-b border-white/8 px-5 py-3.5
    "
				>
					<Rocket className="size-5 text-cyan-300" />
					<h2 className="font-(family-name:--nv-font-display) text-sm font-bold">
						Plan Expedition
					</h2>
				</header>

				<div className="space-y-4 p-5">
					<MissionTypeSection
						missionType={props.missionType}
						onMissionTypeChange={props.onMissionTypeChange}
					/>
					<DestinationSection
						colonyPickerOpen={props.colonyPickerOpen}
						coords={props.coords}
						missionType={props.missionType}
						nonCurrentColonies={props.nonCurrentColonies}
						onCoordsChange={props.onCoordsChange}
						onOpenMapPicker={props.onOpenMapPicker}
						onSelectColony={props.onSelectColony}
						onSetColonyPickerOpen={props.onSetColonyPickerOpen}
						onSetSelectedColonyId={props.onSetSelectedColonyId}
						selectedColonyId={props.selectedColonyId}
						targetResolution={props.targetResolution}
					/>
					<RoundTripSection
						missionType={props.missionType}
						onRoundTripChange={props.onRoundTripChange}
						roundTrip={props.roundTrip}
					/>
					{props.missionType === "transport" && !props.roundTrip && !props.supportsStationing ? (
						<p className="text-[10px] text-amber-200/70">
							One-way stationing is available only for your own colony destinations.
						</p>
					) : null}
					<ShipAssignmentSection
						onShipCountChange={props.onShipCountChange}
						selectedShips={props.selectedShips}
						ships={props.ships}
					/>
					<FleetMetricsSection
						distance={props.distance}
						hasShips={props.hasShips}
						oneWaySeconds={props.oneWaySeconds}
						roundTrip={props.roundTrip}
						slowestSpeed={props.slowestSpeed}
						travelFuelCost={props.travelFuelCost}
					/>
					<CargoSection
						cargo={props.cargo}
						cargoCapacity={props.cargoCapacity}
						cargoUsed={props.cargoUsed}
						onCargoChange={props.onCargoChange}
					/>
					<LaunchSummarySection
						availableResources={props.availableResources}
						cargo={props.cargo}
						travelFuelCost={props.travelFuelCost}
					/>
					<LaunchButton
						canLaunch={props.canLaunch}
						launchCtaLabel={props.launchCtaLabel}
						onLaunch={props.onLaunch}
					/>
				</div>
			</div>
		</div>
	);
}

function MissionTypeSection(props: {
	missionType: FleetMissionKind;
	onMissionTypeChange: (missionType: FleetMissionKind) => void;
}) {
	return (
		<div>
			<SectionLabel>Mission Type</SectionLabel>
			<div className="mt-1.5 flex gap-2">
				{(["transport", "colonize"] as const).map((type) => (
					<button className={`
        flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2
        text-xs font-semibold transition-all
        ${props.missionType === type ? `
            border-cyan-300/40 bg-cyan-400/12 text-cyan-100
          ` : `
            border-white/10 bg-white/3 text-white/40
            hover:text-white/60
          `}
      `} key={type} onClick={() => props.onMissionTypeChange(type)} type="button">
						{type === "transport" ? (
							<Package className="size-3.5" />
						) : (
							<Globe2
								className="
        size-3.5
      "
							/>
						)}
						<span className="capitalize">{type}</span>
					</button>
				))}
			</div>
		</div>
	);
}

function DestinationSection(props: {
	colonyPickerOpen: boolean;
	coords: PlannerCoords;
	missionType: FleetMissionKind;
	nonCurrentColonies: Array<{ addressLabel: string; id: string; name: string }>;
	onCoordsChange: (coords: PlannerCoords) => void;
	onOpenMapPicker: () => void;
	onSelectColony: (colonyId: string) => void;
	onSetColonyPickerOpen: (open: boolean) => void;
	onSetSelectedColonyId: (colonyId: string | null) => void;
	selectedColonyId: string | null;
	targetResolution: FleetTargetResolution;
}) {
	return (
		<div>
			<SectionLabel>Destination</SectionLabel>
			{props.targetResolution?.ok && props.targetResolution.targetPreview ? (
				<p
					className="
      mt-1.5 rounded-lg border border-cyan-300/20 bg-cyan-400/6 px-3 py-2
      text-[11px] text-cyan-100
    "
				>
					{props.targetResolution.targetPreview.label}
				</p>
			) : null}

			<div className={`
      mt-1.5 grid grid-cols-4 gap-1.5 transition-opacity
      ${props.selectedColonyId ? "opacity-35" : ""}
    `}>
				{(["g", "s", "ss", "p"] as const).map((field, index) => (
					<div key={field}>
						<span className="block text-center text-[7px] text-white/25 uppercase">
							{["Gal", "Sec", "Sys", "Pla"][index]}
						</span>
						<input
							aria-label={COORD_FIELD_LABELS[field]}
							className="
         w-full rounded-md border border-white/12 bg-black/35 px-1 py-1.5
         text-center font-(family-name:--nv-font-mono) text-sm text-white
         outline-none
         focus:border-cyan-300/40
       "
							maxLength={4}
							onChange={(event) => {
								props.onSetSelectedColonyId(null);
								props.onCoordsChange({
									...props.coords,
									[field]: event.target.value.replace(/[^\d]/g, ""),
								});
							}}
							value={props.coords[field]}
						/>
					</div>
				))}
			</div>

			{props.missionType === "transport" ? (
				<div className="mt-2">
					<button className={`
        flex w-full items-center justify-between gap-1.5 rounded-lg border px-3
        py-2 text-[10px] transition-all
        ${props.colonyPickerOpen ? `
            border-cyan-300/30 bg-cyan-400/6 text-cyan-100
          ` : `
            border-dashed border-white/10 text-white/30
            hover:border-cyan-300/20 hover:text-cyan-200/50
          `}
      `} onClick={() => props.onSetColonyPickerOpen(!props.colonyPickerOpen)} type="button">
						<span className="flex items-center gap-1.5">
							<Globe2 className="size-3" />
							My Colonies
						</span>
						<ChevronDown className={`
         size-3 transition-transform duration-200
         ${props.colonyPickerOpen ? "rotate-180" : ""}
       `} />
					</button>

					{props.colonyPickerOpen ? (
						<div className="pt-1 pb-0.5">
							{props.nonCurrentColonies.map((colony) => (
								<button className={`
           group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2
           text-left transition-colors
           hover:bg-white/[0.035]
           ${props.selectedColonyId === colony.id ? "bg-cyan-400/6" : ""}
         `} key={colony.id} onClick={() => props.onSelectColony(colony.id)} type="button">
									<div
										className="
           flex size-7 shrink-0 items-center justify-center rounded-md border
           border-white/10
           bg-[linear-gradient(150deg,rgba(61,217,255,0.08),rgba(255,145,79,0.08))]
           text-[8px] font-bold text-white/60 transition-colors
           group-hover:border-cyan-300/20 group-hover:text-white/80
         "
									>
										{colony.name.slice(0, 2).toUpperCase()}
									</div>
									<div className="min-w-0 flex-1">
										<p
											className="
            truncate text-[11px] font-semibold text-white/80 transition-colors
            group-hover:text-white
          "
										>
											{colony.name}
										</p>
										<p
											className="
            font-(family-name:--nv-font-mono) text-[9px] text-white/25
          "
										>
											{colony.addressLabel}
										</p>
									</div>
									{props.selectedColonyId === colony.id ? (
										<Check
											className="
           size-3 shrink-0 text-cyan-300
         "
										/>
									) : null}
								</button>
							))}
						</div>
					) : null}

					{props.selectedColonyId ? (
						<button
							className="
        mt-1 inline-flex items-center gap-1 text-[10px] text-cyan-200/70
        transition-colors hover:text-cyan-100
      "
							onClick={() => props.onSetSelectedColonyId(null)}
							type="button"
						>
							Clear selected colony
						</button>
					) : null}
				</div>
			) : null}

			<button
				className="
      mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border
      border-dashed border-white/10 py-2 text-[10px] text-white/30
      hover:border-cyan-300/20 hover:text-cyan-200/50
    "
				onClick={props.onOpenMapPicker}
				type="button"
			>
				<Crosshair className="size-3" />
				Select from Star Map
			</button>

			{!props.targetResolution?.ok && props.targetResolution?.reason ? (
				<p className="mt-2 text-[10px] text-amber-200/70">{props.targetResolution.reason}</p>
			) : null}
		</div>
	);
}

function RoundTripSection(props: {
	missionType: FleetMissionKind;
	onRoundTripChange: (value: boolean) => void;
	roundTrip: boolean;
}) {
	return (
		<div
			className="
    flex items-center justify-between rounded-lg border border-white/8
    bg-black/15 p-2.5
  "
		>
			<div className="flex items-center gap-2">
				<RotateCcw className={`
      size-3.5
      ${props.roundTrip ? "text-cyan-300" : "text-white/25"}
    `} />
				<span className="text-xs text-white/55">Round Trip</span>
			</div>
			<button
				aria-checked={props.roundTrip}
				aria-disabled={props.missionType === "colonize"}
				aria-label="Round trip"
				className={`
      relative h-6 w-10 rounded-full border transition-all
      ${props.roundTrip ? "border-cyan-300/40 bg-cyan-400/20" : `
          border-white/15 bg-white/8
        `}
    `}
				disabled={props.missionType === "colonize"}
				onClick={() => props.onRoundTripChange(!props.roundTrip)}
				role="switch"
				type="button"
			>
				<span className={`
      absolute top-1/2 left-[3px] size-4 -translate-y-1/2 rounded-full bg-white
      shadow-sm transition-transform
      ${props.roundTrip ? "translate-x-4" : "translate-x-0"}
    `} />
			</button>
		</div>
	);
}

function ShipAssignmentSection(props: {
	onShipCountChange: (shipKey: ShipKey, nextCount: number) => void;
	selectedShips: Record<ShipKey, number>;
	ships: Array<{ available: number; key: ShipKey; name: string }>;
}) {
	return (
		<ShipAssignmentList
			label="Fleet"
			onShipCountChange={props.onShipCountChange}
			selectedShips={props.selectedShips}
			ships={props.ships}
		/>
	);
}

function FleetMetricsSection(props: {
	distance: number;
	hasShips: boolean;
	oneWaySeconds: number;
	roundTrip: boolean;
	slowestSpeed: number;
	travelFuelCost: number;
}) {
	if (!props.hasShips) {
		return null;
	}

	return (
		<div className="rounded-xl border border-cyan-300/15 bg-cyan-400/4 p-3">
			<div className="grid grid-cols-2 gap-2">
				<MetricCard label="Distance" value={props.distance > 0 ? props.distance.toFixed(1) : "—"} />
				<MetricCard label="One Way" value={formatColonyDuration(props.oneWaySeconds, "seconds")} />
				<MetricCard
					label={props.roundTrip ? "Travel Fuel" : "One Way Fuel"}
					value={props.travelFuelCost.toLocaleString()}
				/>
				<MetricCard
					label="Speed"
					value={props.slowestSpeed > 0 ? props.slowestSpeed.toLocaleString() : "—"}
				/>
			</div>
		</div>
	);
}

function CargoSection(props: {
	cargo: ResourceBucket;
	cargoCapacity: number;
	cargoUsed: number;
	onCargoChange: (cargo: ResourceBucket) => void;
}) {
	return (
		<div>
			<div className="flex items-center justify-between">
				<SectionLabel>Cargo</SectionLabel>
				<span className="font-(family-name:--nv-font-mono) text-[9px] text-white/25">
					{props.cargoUsed.toLocaleString()} / {props.cargoCapacity.toLocaleString()}
				</span>
			</div>
			{props.cargoCapacity > 0 ? (
				<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8">
					<div
						className="
       h-full rounded-full bg-linear-to-r from-cyan-400/60 to-cyan-300/40
     "
						style={{ width: `${Math.min(100, (props.cargoUsed / props.cargoCapacity) * 100)}%` }}
					/>
				</div>
			) : null}

			<div className="mt-2 space-y-2">
				{(["alloy", "crystal", "fuel"] as const).map((resourceKey) => (
					<div className="flex items-center gap-2" key={resourceKey}>
						<img
							alt={resourceKey}
							className="size-4 object-contain"
							src={`/game-icons/${resourceKey === "fuel" ? "deuterium" : resourceKey}.png`}
						/>
						<span className="w-12 text-[10px] text-white/45 capitalize">{resourceKey}</span>
						<input
							aria-label={`${resourceKey[0]!.toUpperCase()}${resourceKey.slice(1)} cargo`}
							className="
         flex-1 [appearance:textfield] rounded-md border border-white/10
         bg-black/25 px-2 py-1 text-right font-(family-name:--nv-font-mono)
         text-xs text-white outline-none
         focus:border-cyan-300/30
         [&::-webkit-inner-spin-button]:appearance-none
         [&::-webkit-outer-spin-button]:appearance-none
       "
							min={0}
							onChange={(event) => {
								const nextValue = Math.max(0, Math.floor(Number(event.target.value) || 0));
								props.onCargoChange({
									...props.cargo,
									[resourceKey]: nextValue,
								});
							}}
							type="number"
							value={props.cargo[resourceKey]}
						/>
					</div>
				))}
			</div>
		</div>
	);
}

function LaunchSummarySection(props: {
	availableResources: ResourceBucket;
	cargo: ResourceBucket;
	travelFuelCost: number;
}) {
	const remainingAlloy = Math.max(0, props.availableResources.alloy - props.cargo.alloy);
	const remainingCrystal = Math.max(0, props.availableResources.crystal - props.cargo.crystal);
	const remainingFuel = Math.max(
		0,
		props.availableResources.fuel - (props.cargo.fuel + props.travelFuelCost),
	);

	return (
		<div
			className="
    rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[10px]
    text-white/55
  "
		>
			<p>
				Resources after launch: Alloy {remainingAlloy.toLocaleString()} / Crystal{" "}
				{remainingCrystal.toLocaleString()} / Fuel {remainingFuel.toLocaleString()}
			</p>
			<p className="mt-1 text-white/35">
				Required now: Alloy {props.cargo.alloy.toLocaleString()} / Crystal{" "}
				{props.cargo.crystal.toLocaleString()} / Fuel{" "}
				{(props.cargo.fuel + props.travelFuelCost).toLocaleString()}
			</p>
		</div>
	);
}

function LaunchButton(props: { canLaunch: boolean; launchCtaLabel: string; onLaunch: () => void }) {
	return (
		<button
			className="
     flex w-full items-center justify-center gap-2 rounded-xl border
     border-cyan-200/50 bg-linear-to-b from-cyan-400/25 to-cyan-400/10 px-4 py-3
     font-(family-name:--nv-font-display) text-sm font-bold tracking-[0.08em]
     text-cyan-50 uppercase shadow-[0_0_20px_rgba(61,217,255,0.12)]
     transition-all
     hover:-translate-y-0.5 hover:border-cyan-100/70
     hover:shadow-[0_0_30px_rgba(61,217,255,0.25)]
     disabled:translate-y-0 disabled:border-white/10 disabled:bg-white/5
     disabled:text-white/30 disabled:shadow-none
   "
			disabled={!props.canLaunch}
			onClick={props.onLaunch}
			type="button"
		>
			<Sparkles className="size-4" />
			{props.launchCtaLabel}
		</button>
	);
}

function SectionLabel(props: { children: string }) {
	return (
		<p
			className="
   text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase
 "
		>
			{props.children}
		</p>
	);
}

function MetricCard(props: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-cyan-300/10 bg-cyan-400/3 p-2">
			<p className="text-[8px] tracking-widest text-cyan-200/45 uppercase">{props.label}</p>
			<p
				className="
     mt-0.5 font-(family-name:--nv-font-mono) text-xs font-bold text-cyan-100
   "
			>
				{props.value}
			</p>
		</div>
	);
}
