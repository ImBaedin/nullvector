import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { HostileFactionKey } from "@nullvector/game-logic";
import type { ReactNode } from "react";

import {
	DEFAULT_DEFENSE_DEFINITIONS,
	DEFAULT_SHIP_DEFINITIONS,
	HOSTILE_FACTIONS,
	MISSION_TEMPLATES,
	type CombatMissionTypeKey,
	type ShipKey,
} from "@nullvector/game-logic";
import {
	ArrowLeft,
	ChevronRight,
	Clock3,
	Crosshair,
	Layers3,
	Lock,
	Shield,
	Ship,
	Sparkles,
	Swords,
} from "lucide-react";
import { useMemo } from "react";

import {
	buildContractForecast,
	defenseIconSrc,
	factionColor,
	factionIconSrc,
	getEnemyWeightLabel,
	getForecastToneClass,
	getPlanetControlToneClass,
	shipIconSrc,
	sumDefenseCounts,
	sumShipCounts,
	DEFENSE_DISPLAY_ORDER,
	SHIP_DISPLAY_ORDER,
	type BrowseLevel,
	type ContractForecast,
	type ContractView,
	type HostilePlanetView,
	type HostileSectorWithDistance,
	type RecommendedContractView,
	type ShipAssignment,
	type SystemGroup,
} from "./contracts-screen-shared";
import { ShipAssignmentList } from "./ship-assignment-list";
import { formatDuration } from "./shipyard-mock-shared";

export function RecommendedSection(props: {
	contracts: RecommendedContractView[] | null;
	loading: boolean;
	selectedContractId: Id<"contracts"> | null;
	playerRank: number;
	nowMs: number;
	onSelect: (contract: RecommendedContractView) => void;
}): ReactNode {
	if (props.loading) {
		return (
			<div>
				<SectionHeading
					icon={<Crosshair className="size-4 text-cyan-300/60" />}
					label="Recommended Contracts"
				/>
				<div
					className="
       mt-3 grid gap-3
       sm:grid-cols-2
       xl:grid-cols-3
     "
				>
					{[0, 1, 2].map((index) => (
						<div
							key={index}
							className="
         h-36 animate-pulse rounded-xl border border-white/10 bg-white/3
       "
						/>
					))}
				</div>
			</div>
		);
	}

	if (!props.contracts || props.contracts.length === 0) {
		return (
			<div>
				<SectionHeading
					icon={<Crosshair className="size-4 text-cyan-300/60" />}
					label="Recommended Contracts"
				/>
				<div
					className="
       mt-3 rounded-xl border border-white/10 bg-white/2 px-4 py-6 text-center
       text-xs text-white/45
     "
				>
					No contracts available nearby. Explore hostile sectors below.
				</div>
			</div>
		);
	}

	return (
		<div>
			<SectionHeading
				icon={<Crosshair className="size-4 text-cyan-300/60" />}
				label="Recommended Contracts"
			/>
			<div
				className="
      mt-3 grid gap-3
      sm:grid-cols-2
      xl:grid-cols-3
    "
			>
				{props.contracts.map((contract) => (
					<RecommendedContractCard
						key={contract.id}
						contract={contract}
						isSelected={props.selectedContractId === contract.id}
						nowMs={props.nowMs}
						playerRank={props.playerRank}
						onSelect={() => props.onSelect(contract)}
					/>
				))}
			</div>
		</div>
	);
}

function RecommendedContractCard(props: {
	contract: RecommendedContractView;
	isSelected: boolean;
	playerRank: number;
	nowMs: number;
	onSelect: () => void;
}): ReactNode {
	const { contract } = props;
	const template = MISSION_TEMPLATES[contract.missionTypeKey as CombatMissionTypeKey];
	const missionName = template?.displayName ?? contract.missionTypeKey;
	const locked = props.playerRank < contract.requiredRank;
	const faction = HOSTILE_FACTIONS[contract.hostileFactionKey];
	const factionClasses = factionColor(contract.hostileFactionKey);
	const expirySeconds = contract.expiresAt
		? Math.max(0, Math.ceil((contract.expiresAt - props.nowMs) / 1_000))
		: 0;

	return (
		<button className={`
    relative overflow-hidden rounded-xl border p-4 text-left transition-all
    ${props.isSelected ? "border-cyan-300/30 bg-cyan-400/6" : `
      border-white/10
      bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,16,0.95))]
      hover:border-white/15 hover:bg-white/3
    `}
    ${locked ? "opacity-60" : ""}
  `} onClick={props.onSelect} type="button">
			<div
				className="
      pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r
      from-transparent via-cyan-400/30 to-transparent
    "
			/>

			<div className="flex items-start gap-3">
				<img alt={faction.displayName} className={`
      size-8 shrink-0 rounded-lg border
      ${factionClasses.border}
      bg-black/30 object-cover p-0.5
    `} src={factionIconSrc(contract.hostileFactionKey)} />
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className="text-xs font-semibold">{missionName}</span>
						{locked ? (
							<span className="flex items-center gap-0.5 text-[8px] text-rose-300/70">
								<Lock className="size-2.5" /> Rank {contract.requiredRank}
							</span>
						) : null}
					</div>
					<p className="mt-0.5 truncate text-[10px] text-white/35">
						{contract.planetDisplayName} · {contract.sectorDisplayName}
					</p>
				</div>
			</div>

			<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px]">
				<span className="font-semibold text-white/50">Tier {contract.difficultyTier}</span>
				<span className="font-(family-name:--nv-font-mono) text-amber-200/60">
					{contract.rewardCredits.toLocaleString()} cr
				</span>
				<span className="font-(family-name:--nv-font-mono) text-cyan-200/60">
					{contract.rewardRankXpSuccess} XP
				</span>
				<span className="font-(family-name:--nv-font-mono) text-white/30">
					{contract.distance.toFixed(1)} AU
				</span>
				{expirySeconds > 0 && contract.status === "available" ? (
					<span className="flex items-center gap-0.5 text-white/25">
						<Clock3 className="size-2.5" />
						{formatDuration(expirySeconds)}
					</span>
				) : null}
			</div>
		</button>
	);
}

export function SectorBrowser(props: {
	sectors: HostileSectorWithDistance[];
	browseLevel: BrowseLevel;
	planetContracts: ContractView[] | null;
	contractsLoading: boolean;
	selectedSectorLoading: boolean;
	selectedSectorSystems: SystemGroup[];
	selectedContractId: Id<"contracts"> | null;
	playerRank: number;
	nowMs: number;
	originX: number;
	originY: number;
	onSelectSector: (sector: HostileSectorWithDistance) => void;
	onSelectSystem: (sector: HostileSectorWithDistance, system: SystemGroup) => void;
	onSelectPlanet: (
		sector: HostileSectorWithDistance,
		system: SystemGroup,
		planet: HostilePlanetView,
	) => void;
	onSelectContract: (
		contract: ContractView,
		planetContext: {
			displayName: string;
			addressLabel: string;
			hostileFactionKey: HostileFactionKey;
			sectorDisplayName: string;
		},
		distance: number,
	) => void;
	onBack: () => void;
}): ReactNode {
	const { browseLevel } = props;

	return (
		<div>
			<SectionHeading
				icon={<Swords className="size-4 text-rose-300/60" />}
				label="Hostile Sectors"
			/>

			{browseLevel.level !== "sectors" ? (
				<BrowseBreadcrumb level={browseLevel} onBack={props.onBack} />
			) : null}

			<div className="mt-3">
				{browseLevel.level === "sectors" ? (
					<SectorGrid sectors={props.sectors} onSelect={props.onSelectSector} />
				) : null}

				{browseLevel.level === "systems" ? (
					props.selectedSectorLoading ? (
						<SectorDetailLoading label="Loading systems" />
					) : (
						<SystemGrid
							sector={browseLevel.sector}
							systems={props.selectedSectorSystems}
							onSelect={(system) => props.onSelectSystem(browseLevel.sector, system)}
						/>
					)
				) : null}

				{browseLevel.level === "planets" ? (
					props.selectedSectorLoading ? (
						<SectorDetailLoading label="Loading planets" />
					) : (
						<PlanetGrid
							sector={browseLevel.sector}
							system={browseLevel.system}
							onSelect={(planet) =>
								props.onSelectPlanet(browseLevel.sector, browseLevel.system, planet)
							}
						/>
					)
				) : null}

				{browseLevel.level === "contracts" ? (
					<PlanetContractList
						contracts={props.planetContracts}
						loading={props.contractsLoading}
						nowMs={props.nowMs}
						originX={props.originX}
						originY={props.originY}
						planet={browseLevel.planet}
						playerRank={props.playerRank}
						sector={browseLevel.sector}
						selectedContractId={props.selectedContractId}
						onSelectContract={props.onSelectContract}
					/>
				) : null}
			</div>
		</div>
	);
}

function SectorDetailLoading(props: { label: string }): ReactNode {
	return (
		<div className="rounded-xl border border-white/10 bg-white/2 px-4 py-6 text-center text-xs text-white/45">
			{props.label}
		</div>
	);
}

function BrowseBreadcrumb(props: { level: BrowseLevel; onBack: () => void }): ReactNode {
	const crumbs: string[] = [];
	if (
		props.level.level === "systems" ||
		props.level.level === "planets" ||
		props.level.level === "contracts"
	) {
		crumbs.push(props.level.sector.displayName);
	}
	if (props.level.level === "planets" || props.level.level === "contracts") {
		crumbs.push(props.level.system.displayName);
	}
	if (props.level.level === "contracts") {
		crumbs.push(props.level.planet.displayName);
	}

	return (
		<div className="mt-2 flex items-center gap-1.5">
			<button
				className="
      flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-white/50
      transition-colors
      hover:bg-white/5 hover:text-white/70
    "
				onClick={props.onBack}
				type="button"
			>
				<ArrowLeft className="size-3" />
				Back
			</button>
			<div className="flex items-center gap-1 text-[10px] text-white/30">
				{crumbs.map((crumb, index) => (
					<span key={crumb} className="flex items-center gap-1">
						{index > 0 ? <ChevronRight className="size-2.5" /> : null}
						<span className={index === crumbs.length - 1 ? "text-white/60" : ""}>{crumb}</span>
					</span>
				))}
			</div>
		</div>
	);
}

function SectorGrid(props: {
	sectors: HostileSectorWithDistance[];
	onSelect: (sector: HostileSectorWithDistance) => void;
}): ReactNode {
	if (props.sectors.length === 0) {
		return (
			<div
				className="
      rounded-xl border border-white/10 bg-white/2 px-4 py-6 text-center text-xs
      text-white/45
    "
			>
				No hostile sectors detected in this universe.
			</div>
		);
	}

	return (
		<div
			className="
     grid gap-3
     sm:grid-cols-2
     xl:grid-cols-3
   "
		>
			{props.sectors.map((sector) => {
				const factionClasses = factionColor(sector.hostileFactionKey);
				const faction = HOSTILE_FACTIONS[sector.hostileFactionKey];
				const isCleared = sector.status === "cleared";
				const hostilePercent =
					sector.hostilePlanetCount > 0
						? ((sector.hostilePlanetCount - sector.clearedPlanetCount) /
								sector.hostilePlanetCount) *
							100
						: 0;

				return (
					<button
						key={sector.sectorId}
						className="
        group relative overflow-hidden rounded-xl border border-white/10
        bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,16,0.95))] p-4
        text-left transition-all
        hover:border-white/15 hover:bg-white/3
      "
						onClick={() => props.onSelect(sector)}
						type="button"
					>
						<div className="flex items-start gap-3">
							<img alt={faction.displayName} className={`
         size-9 shrink-0 rounded-lg border
         ${factionClasses.border}
         bg-black/30 object-cover p-0.5
       `} src={factionIconSrc(sector.hostileFactionKey)} />
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span className="text-xs font-semibold">{sector.displayName}</span>
									{isCleared ? (
										<span
											className="
             rounded-sm bg-emerald-400/12 px-1.5 py-0.5 text-[8px] font-semibold
             text-emerald-200/80
           "
										>
											Cleared
										</span>
									) : null}
								</div>
								<p className="mt-0.5 text-[10px] text-white/35">
									<span className={factionClasses.text}>{faction.displayName}</span>
									<span className="mx-1.5 text-white/15">·</span>
									{sector.addressLabel}
								</p>
							</div>
							<ChevronRight
								className="
          mt-0.5 size-3.5 shrink-0 text-white/20 transition-transform
          group-hover:translate-x-0.5
        "
							/>
						</div>

						<div className="mt-3 flex items-center gap-3 text-[9px] text-white/40">
							<span>
								{sector.clearedPlanetCount}/{sector.hostilePlanetCount} cleared
							</span>
							<span className="font-(family-name:--nv-font-mono)">
								{sector.distance.toFixed(1)} AU
							</span>
						</div>

						{!isCleared ? (
							<div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/8">
								<div
									className="h-full rounded-full bg-rose-400/40"
									style={{ width: `${hostilePercent}%` }}
								/>
							</div>
						) : null}
					</button>
				);
			})}
		</div>
	);
}

function SystemGrid(props: {
	sector: HostileSectorWithDistance;
	systems: SystemGroup[];
	onSelect: (system: SystemGroup) => void;
}): ReactNode {
	const factionClasses = factionColor(props.sector.hostileFactionKey);

	if (props.systems.length === 0) {
		return (
			<div
				className="
      rounded-xl border border-white/10 bg-white/2 px-4 py-6 text-center text-xs
      text-white/45
    "
			>
				No systems found in this sector.
			</div>
		);
	}

	return (
		<div
			className="
     grid gap-3
     sm:grid-cols-2
     xl:grid-cols-3
   "
		>
			{props.systems.map((system) => {
				const totalPlanets = system.planets.length;
				const allCleared = system.clearedCount === totalPlanets;

				return (
					<button
						key={system.systemIndex}
						className="
        group flex items-center gap-3 rounded-xl border border-white/10
        bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,16,0.95))] p-4
        text-left transition-all
        hover:border-white/15 hover:bg-white/3
      "
						onClick={() => props.onSelect(system)}
						type="button"
					>
						<div className={`
        flex size-9 shrink-0 items-center justify-center rounded-lg border
        ${factionClasses.border}
        bg-black/20
      `}>
							<span
								className="
          font-(family-name:--nv-font-mono) text-xs font-bold text-white/60
        "
							>
								{system.systemIndex + 1}
							</span>
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<span className="text-xs font-semibold">{system.displayName}</span>
								{allCleared ? (
									<span
										className="
            rounded-sm bg-emerald-400/12 px-1.5 py-0.5 text-[8px] font-semibold
            text-emerald-200/80
          "
									>
										Cleared
									</span>
								) : null}
							</div>
							<p className="mt-0.5 text-[10px] text-white/40">
								{totalPlanets} planet{totalPlanets !== 1 ? "s" : ""}
								{system.hostileCount > 0 ? (
									<span className="text-rose-200/50"> · {system.hostileCount} hostile</span>
								) : null}
							</p>
						</div>
						<ChevronRight
							className="
         size-3.5 shrink-0 text-white/20 transition-transform
         group-hover:translate-x-0.5
       "
						/>
					</button>
				);
			})}
		</div>
	);
}

function PlanetGrid(props: {
	system: SystemGroup;
	sector: HostileSectorWithDistance;
	onSelect: (planet: HostilePlanetView) => void;
}): ReactNode {
	return (
		<div
			className="
     grid gap-3
     sm:grid-cols-2
     xl:grid-cols-3
   "
		>
			{props.system.planets.map((planet) => {
				const controlPercent =
					planet.controlMax > 0 ? (planet.controlCurrent / planet.controlMax) * 100 : 0;
				const isCleared = planet.status === "cleared";

				return (
					<button key={planet.planetId} className={`
       group rounded-xl border
       bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,16,0.95))] p-4
       text-left transition-all
       ${isCleared ? "border-white/8 opacity-60" : `
         border-white/10
         hover:border-white/15 hover:bg-white/3
       `}
     `} onClick={() => props.onSelect(planet)} type="button">
						<div className="flex items-center gap-2">
							<span className="text-xs font-semibold">{planet.displayName}</span>
							<span className="
         font-(family-name:--nv-font-mono) text-[9px] text-white/25
       ">
								{planet.addressLabel}
							</span>
							{isCleared ? (
								<span
									className="
           rounded-sm bg-emerald-400/12 px-1 py-0.5 text-[8px] font-semibold
           text-emerald-200/80
         "
								>
									Cleared
								</span>
							) : null}
						</div>

						{!isCleared ? (
							<>
								<div className="
          mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/8
        ">
									<div className={`
           h-full rounded-full
           ${getPlanetControlToneClass(controlPercent)}
         `} style={{ width: `${controlPercent}%` }} />
								</div>
								<div className="mt-1 flex items-center justify-between text-[9px]">
									<span className="font-(family-name:--nv-font-mono) text-white/30">
										{planet.controlCurrent.toLocaleString()} / {planet.controlMax.toLocaleString()}
									</span>
									<ChevronRight
										className="
            size-3 text-white/20 transition-transform
            group-hover:translate-x-0.5
          "
									/>
								</div>
							</>
						) : null}
					</button>
				);
			})}
		</div>
	);
}

function PlanetContractList(props: {
	planet: HostilePlanetView;
	sector: HostileSectorWithDistance;
	contracts: ContractView[] | null;
	loading: boolean;
	selectedContractId: Id<"contracts"> | null;
	playerRank: number;
	nowMs: number;
	originX: number;
	originY: number;
	onSelectContract: (
		contract: ContractView,
		planetContext: {
			displayName: string;
			addressLabel: string;
			hostileFactionKey: HostileFactionKey;
			sectorDisplayName: string;
		},
		distance: number,
	) => void;
}): ReactNode {
	const distance = useMemo(() => {
		const dx = props.planet.systemX - props.originX;
		const dy = props.planet.systemY - props.originY;
		return Math.sqrt(dx * dx + dy * dy);
	}, [props.originX, props.originY, props.planet.systemX, props.planet.systemY]);

	const planetContext = {
		displayName: props.planet.displayName,
		addressLabel: props.planet.addressLabel,
		hostileFactionKey: props.sector.hostileFactionKey,
		sectorDisplayName: props.sector.displayName,
	};

	if (props.loading) {
		return (
			<div className="space-y-2">
				{[0, 1].map((index) => (
					<div
						key={index}
						className="
        h-20 animate-pulse rounded-xl border border-white/10 bg-white/3
      "
					/>
				))}
			</div>
		);
	}

	if (!props.contracts || props.contracts.length === 0) {
		return (
			<div
				className="
      rounded-xl border border-white/10 bg-white/2 px-4 py-6 text-center text-xs
      text-white/45
    "
			>
				{props.planet.status === "cleared"
					? "Planet cleared — no contracts available."
					: "No contracts available on this planet."}
			</div>
		);
	}

	return (
		<div
			className="
     grid gap-3
     sm:grid-cols-2
   "
		>
			{props.contracts.map((contract) => {
				const template = MISSION_TEMPLATES[contract.missionTypeKey as CombatMissionTypeKey];
				const missionName = template?.displayName ?? contract.missionTypeKey;
				const locked = props.playerRank < contract.requiredRank;
				const isSelected = props.selectedContractId === contract.id;
				const expirySeconds = contract.expiresAt
					? Math.max(0, Math.ceil((contract.expiresAt - props.nowMs) / 1_000))
					: 0;

				return (
					<button key={contract.id} className={`
       rounded-xl border p-4 text-left transition-all
       ${isSelected ? "border-cyan-300/30 bg-cyan-400/6" : `
         border-white/10
         bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,16,0.95))]
         hover:border-white/15 hover:bg-white/3
       `}
       ${locked ? "opacity-60" : ""}
     `} onClick={() => props.onSelectContract(contract, planetContext, distance)} type="button">
						<div className="flex items-center gap-2">
							<Crosshair className="size-3 shrink-0 text-rose-300/60" />
							<span className="text-xs font-semibold">{missionName}</span>
							{contract.status === "inProgress" ? (
								<span
									className="
           rounded-sm bg-amber-400/12 px-1 py-0.5 text-[8px] font-semibold
           text-amber-200/80
         "
								>
									In Progress
								</span>
							) : null}
							{locked ? (
								<span className="flex items-center gap-0.5 text-[8px] text-rose-300/70">
									<Lock className="size-2.5" /> Rank {contract.requiredRank}
								</span>
							) : null}
						</div>
						<div
							className="
         mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px]
         text-white/40
       "
						>
							<span className="font-semibold">Tier {contract.difficultyTier}</span>
							<span className="font-(family-name:--nv-font-mono) text-amber-200/60">
								{contract.rewardCredits.toLocaleString()} cr
							</span>
							<span className="font-(family-name:--nv-font-mono) text-cyan-200/60">
								{contract.rewardRankXpSuccess} XP
							</span>
							<span className="font-(family-name:--nv-font-mono) text-rose-200/50">
								-{contract.controlReduction} ctrl
							</span>
							{expirySeconds > 0 && contract.status === "available" ? (
								<span className="flex items-center gap-0.5 text-white/25">
									<Clock3 className="size-2.5" />
									{formatDuration(expirySeconds)}
								</span>
							) : null}
						</div>
					</button>
				);
			})}
		</div>
	);
}

export function ContractDetailPanel(props: {
	contract: ContractView | null;
	planet: {
		addressLabel: string;
		displayName: string;
		hostileFactionKey: HostileFactionKey;
		sectorDisplayName: string;
	} | null;
	ships: ShipAssignment[];
	selectedShips: Record<ShipKey, number>;
	canLaunch: boolean;
	launchCtaLabel: string;
	activeContractCount: number;
	activeContractLimit: number;
	contractLimitReached: boolean;
	rankTooLow: boolean;
	playerRank: number;
	distance: number;
	fuelCost: number;
	travelSeconds: number;
	onShipCountChange: (shipKey: ShipKey, nextCount: number) => void;
	onLaunch: () => void;
}): ReactNode {
	if (!props.contract) {
		return (
			<div className="lg:sticky lg:top-4 lg:self-start">
				<div
					className="
       rounded-2xl border border-white/12
       bg-[linear-gradient(170deg,rgba(12,20,36,0.95),rgba(6,10,18,0.98))]
     "
				>
					<div className="
       flex items-center gap-2.5 border-b border-white/8 px-5 py-3.5
     ">
						<Swords className="size-5 text-rose-300" />
						<h2 className="font-(family-name:--nv-font-display) text-sm font-bold">
							Mission Briefing
						</h2>
					</div>
					<div className="px-5 py-12 text-center text-xs text-white/30">
						Select a contract to view mission details.
					</div>
				</div>
			</div>
		);
	}

	const template = MISSION_TEMPLATES[props.contract.missionTypeKey as CombatMissionTypeKey];
	const missionName = template?.displayName ?? props.contract.missionTypeKey;
	const factionKey = props.planet?.hostileFactionKey ?? "spacePirates";
	const faction = HOSTILE_FACTIONS[factionKey];
	const factionClasses = factionColor(factionKey);
	const forecast = buildContractForecast(props.contract, props.selectedShips);

	return (
		<div className="lg:sticky lg:top-4 lg:self-start">
			<div
				className="
      rounded-2xl border border-white/12
      bg-[linear-gradient(170deg,rgba(12,20,36,0.95),rgba(6,10,18,0.98))]
    "
			>
				<div className="
      flex items-center gap-2.5 border-b border-white/8 px-5 py-3.5
    ">
					<Swords className="size-5 text-rose-300" />
					<h2 className="font-(family-name:--nv-font-display) text-sm font-bold">
						Mission Briefing
					</h2>
				</div>

				<div className="space-y-4 p-5">
					<div className="flex items-center gap-3">
						<img alt={faction.displayName} className={`
        size-10 shrink-0 rounded-lg border
        ${factionClasses.border}
        object-cover p-0.5
      `} src={factionIconSrc(factionKey)} />
						<div>
							<p className="text-sm font-bold">{missionName}</p>
							<p className="text-[10px] text-white/40">
								{props.planet?.displayName} · {props.planet?.addressLabel} · {faction.displayName}
							</p>
						</div>
					</div>

					{props.rankTooLow ? (
						<div
							className="
         flex items-center gap-2 rounded-lg border border-rose-300/20
         bg-rose-400/6 px-3 py-2 text-[10px] text-rose-200/80
       "
						>
							<Lock className="size-3.5" />
							Requires Rank {props.contract.requiredRank} — you are Rank {props.playerRank}
						</div>
					) : null}

					{props.contractLimitReached ? (
						<div
							className="
         flex items-center gap-2 rounded-lg border border-amber-300/20
         bg-amber-400/6 px-3 py-2 text-[10px] text-amber-100/85
       "
						>
							<Clock3 className="size-3.5" />
							Active contract limit reached: {props.activeContractCount}/{props.activeContractLimit}
							. Increase rank to unlock another slot.
						</div>
					) : null}

					<EnemyForcesSection contract={props.contract} />
					<RewardsSection contract={props.contract} />

					<ShipAssignmentList
						label="Assign Fleet"
						onShipCountChange={props.onShipCountChange}
						selectedShips={props.selectedShips}
						ships={props.ships}
					/>

					<ContractForecastSection forecast={forecast} />

					<div
						className="
        grid grid-cols-3 gap-2.5 rounded-xl border border-white/8 bg-black/20
        p-3
      "
					>
						<MissionMetric
							label="Distance"
							unit={props.distance > 0 ? "AU" : undefined}
							value={props.distance > 0 ? props.distance.toFixed(1) : "—"}
						/>
						<MissionMetric
							highlight={props.fuelCost > 0}
							label="Fuel cost"
							value={props.fuelCost > 0 ? props.fuelCost.toLocaleString() : "—"}
						/>
						<MissionMetric
							label="Travel"
							value={props.travelSeconds > 0 ? formatDuration(props.travelSeconds) : "—"}
						/>
					</div>

					<button
						className="
        flex w-full items-center justify-center gap-2 rounded-xl border
        border-rose-200/50 bg-linear-to-b from-rose-400/25 to-rose-400/10 px-4
        py-3 font-(family-name:--nv-font-display) text-sm font-bold
        tracking-[0.08em] text-rose-50 uppercase
        shadow-[0_0_20px_rgba(255,100,100,0.12)] transition-all
        hover:-translate-y-0.5 hover:border-rose-100/70
        hover:shadow-[0_0_30px_rgba(255,100,100,0.25)]
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
				</div>
			</div>
		</div>
	);
}

function EnemyForcesSection(props: { contract: ContractView }): ReactNode {
	const template = MISSION_TEMPLATES[props.contract.missionTypeKey as CombatMissionTypeKey];
	if (!template) {
		return null;
	}

	const visibleFleet = SHIP_DISPLAY_ORDER.filter((key) => props.contract.enemyFleet[key] > 0);
	const visibleDefenses = DEFENSE_DISPLAY_ORDER.filter(
		(key) => props.contract.enemyDefenses[key] > 0,
	);

	return (
		<div>
			<SectionLabel>Enemy Forces</SectionLabel>
			<div className="mt-1.5 space-y-2">
				<div className="rounded-lg border border-white/8 bg-black/15 p-2.5">
					<p
						className="
        mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold text-white/40
        uppercase
      "
					>
						<Ship className="size-3" /> Hostile Fleet
						<span className="ml-auto text-white/20">
							{getEnemyWeightLabel(template.fleetWeight)}
						</span>
					</p>
					<p className="text-[10px] text-white/50">
						Fleet weight: {Math.round(template.fleetWeight * 100)}% · Defense weight:{" "}
						{Math.round(template.defenseWeight * 100)}%
					</p>
				</div>

				{visibleFleet.length > 0 ? (
					<div className="rounded-lg border border-white/8 bg-black/15 p-2.5">
						<p
							className="
         mb-2 flex items-center gap-1.5 text-[9px] font-semibold text-white/40
         uppercase
       "
						>
							<Ship className="size-3" /> Snapshotted Fleet
						</p>
						<div className="grid grid-cols-2 gap-1.5">
							{visibleFleet.map((key) => (
								<UnitCountCard
									key={key}
									iconSrc={shipIconSrc(key)}
									label={DEFAULT_SHIP_DEFINITIONS[key].name}
									value={props.contract.enemyFleet[key]}
								/>
							))}
						</div>
					</div>
				) : null}

				{visibleDefenses.length > 0 ? (
					<div className="rounded-lg border border-white/8 bg-black/15 p-2.5">
						<p
							className="
         mb-2 flex items-center gap-1.5 text-[9px] font-semibold text-white/40
         uppercase
       "
						>
							<Shield className="size-3" /> Snapshotted Defenses
						</p>
						<div className="grid grid-cols-2 gap-1.5">
							{visibleDefenses.map((key) => (
								<UnitCountCard
									key={key}
									iconSrc={defenseIconSrc(key)}
									label={DEFAULT_DEFENSE_DEFINITIONS[key].name}
									value={props.contract.enemyDefenses[key]}
								/>
							))}
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}

function ContractForecastSection(props: { forecast: ContractForecast | null }): ReactNode {
	if (!props.forecast) {
		return (
			<div>
				<SectionLabel>Forecast</SectionLabel>
				<div
					className="
       mt-1.5 rounded-lg border border-white/8 bg-black/15 px-3 py-2.5
       text-[10px] text-white/40
     "
				>
					Assign ships to preview the projected contract outcome.
				</div>
			</div>
		);
	}

	const forecast = props.forecast;
	const survivingTotal = sumShipCounts(forecast.projectedSurvivors);
	const lossTotal = sumShipCounts(forecast.projectedLosses);
	const enemyTotal =
		sumShipCounts(forecast.projectedEnemyFleetRemaining) +
		sumDefenseCounts(forecast.projectedEnemyDefensesRemaining);
	const lossEntries = SHIP_DISPLAY_ORDER.filter((key) => forecast.projectedLosses[key] > 0);

	return (
		<div>
			<SectionLabel>Forecast</SectionLabel>
			<div className={`
     mt-1.5 rounded-lg border px-3 py-2.5
     ${getForecastToneClass(forecast.tone)}
   `}>
				<div className="flex items-center justify-between gap-3">
					<p className="text-xs font-semibold">{forecast.label}</p>
					<p
						className="
        font-(family-name:--nv-font-mono) text-[10px] uppercase opacity-70
      "
					>
						{forecast.roundsFought}r
					</p>
				</div>
				<p className="mt-0.5 text-[10px] text-white/60">{forecast.detail}</p>

				<div
					className="
       mt-2 flex items-center gap-3 border-t border-white/8 pt-2 text-[10px]
     "
				>
					<span className="flex items-center gap-1 font-(family-name:--nv-font-mono)">
						<span className="text-[8px] tracking-wider text-white/35 uppercase">Surv</span>
						<span className="font-bold">{survivingTotal}</span>
					</span>
					<span className="flex items-center gap-1 font-(family-name:--nv-font-mono)">
						<span className="text-[8px] tracking-wider text-white/35 uppercase">Lost</span>
						<span className="font-bold">{lossTotal}</span>
					</span>
					<span className="flex items-center gap-1 font-(family-name:--nv-font-mono)">
						<span className="text-[8px] tracking-wider text-white/35 uppercase">Enemy</span>
						<span className="font-bold">{enemyTotal}</span>
					</span>
					{forecast.rewardCargoRecoverable > 0 ? (
						<span
							className="
         ml-auto flex items-center gap-1 font-(family-name:--nv-font-mono)
         text-cyan-200/80
       "
						>
							<span className="text-[8px] tracking-wider text-white/35 uppercase">Cargo</span>
							<span className="font-bold">{forecast.rewardCargoRecoverable.toLocaleString()}</span>
						</span>
					) : null}
				</div>

				{lossEntries.length > 0 ? (
					<div
						className="
        mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/8 pt-2
      "
					>
						<span className="text-[8px] tracking-wider text-white/30 uppercase">Losses</span>
						{lossEntries.map((key) => (
							<span
								key={key}
								className="
          flex items-center gap-0.5 rounded-sm border border-white/8 bg-black/20
          px-1.5 py-0.5
        "
							>
								<img
									alt={DEFAULT_SHIP_DEFINITIONS[key].name}
									className="size-3 object-contain"
									src={shipIconSrc(key)}
								/>
								<span
									className="
           font-(family-name:--nv-font-mono) text-[9px] font-bold text-white/70
         "
								>
									{forecast.projectedLosses[key]}
								</span>
							</span>
						))}
					</div>
				) : null}

				{forecast.rewardCargoLost > 0 ? (
					<p className="mt-1.5 text-[9px] text-amber-200/70">
						Cargo overflow: {forecast.rewardCargoLost.toLocaleString()} left behind
					</p>
				) : null}
			</div>
		</div>
	);
}

function RewardsSection(props: { contract: ContractView }): ReactNode {
	return (
		<div>
			<SectionLabel>Rewards</SectionLabel>
			<div className="mt-1.5 grid grid-cols-2 gap-1.5">
				<RewardCard
					accent="amber"
					label="Credits"
					value={props.contract.rewardCredits.toLocaleString()}
				/>
				<RewardCard accent="cyan" label="Rank XP" value={`${props.contract.rewardRankXpSuccess}`} />
				{props.contract.rewardResources.alloy > 0 ? (
					<RewardCard
						accent="neutral"
						iconSrc="/game-icons/alloy.png"
						label="Alloy"
						value={props.contract.rewardResources.alloy.toLocaleString()}
					/>
				) : null}
				{props.contract.rewardResources.crystal > 0 ? (
					<RewardCard
						accent="neutral"
						iconSrc="/game-icons/crystal.png"
						label="Crystal"
						value={props.contract.rewardResources.crystal.toLocaleString()}
					/>
				) : null}
				{props.contract.rewardResources.fuel > 0 ? (
					<RewardCard
						accent="neutral"
						iconSrc="/game-icons/deuterium.png"
						label="Fuel"
						value={props.contract.rewardResources.fuel.toLocaleString()}
					/>
				) : null}
				<RewardCard accent="rose" label="Control" value={`-${props.contract.controlReduction}`} />
			</div>
			<p className="mt-1 text-[8px] text-white/20">
				On failure: {props.contract.rewardRankXpFailure} XP (pity) · no control reduction
			</p>
		</div>
	);
}

function RewardCard(props: {
	label: string;
	value: string;
	accent: string;
	iconSrc?: string;
}): ReactNode {
	const accentClasses: Record<string, string> = {
		amber: "border-amber-300/15 bg-amber-400/5 text-amber-200",
		cyan: "border-cyan-300/15 bg-cyan-400/5 text-cyan-200",
		rose: "border-rose-300/15 bg-rose-400/5 text-rose-200",
		neutral: "border-white/8 bg-white/3 text-white/80",
	};

	return (
		<div className={`
    flex items-center gap-2 rounded-lg border p-2
    ${accentClasses[props.accent] ?? accentClasses.neutral}
  `}>
			{props.iconSrc ? (
				<img alt={props.label} className="size-4 object-contain" src={props.iconSrc} />
			) : null}
			<div>
				<p className="text-[8px] tracking-widest text-white/35 uppercase">{props.label}</p>
				<p className="font-(family-name:--nv-font-mono) text-xs font-bold">{props.value}</p>
			</div>
		</div>
	);
}

function UnitCountCard(props: { iconSrc: string; label: string; value: number }): ReactNode {
	return (
		<div
			className="
     flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-2
     py-1.5
   "
		>
			<img alt={props.label} className="size-4 object-contain" src={props.iconSrc} />
			<div className="min-w-0 flex-1">
				<p className="truncate text-[9px] text-white/45">{props.label}</p>
				<p
					className="
       font-(family-name:--nv-font-mono) text-[11px] font-bold text-white/85
     "
				>
					{props.value.toLocaleString()}
				</p>
			</div>
		</div>
	);
}

export function ContractHistory(props: { contracts: ContractView[] }): ReactNode {
	return (
		<div>
			<SectionHeading icon={<Layers3 className="size-4 text-white/40" />} label="Recent Missions" />
			<div className="mt-3 space-y-1">
				{props.contracts.map((contract) => {
					const template = MISSION_TEMPLATES[contract.missionTypeKey as CombatMissionTypeKey];
					const missionName = template?.displayName ?? contract.missionTypeKey;
					const isSuccess = contract.status === "completed";

					return (
						<div
							key={contract.id}
							className="
         flex items-center gap-3 rounded-lg border border-white/6 bg-white/1.5
         px-3 py-2
       "
						>
							<span className={`
         inline-block size-2 shrink-0 rounded-full
         ${isSuccess ? `bg-emerald-400` : `bg-rose-400`}
       `} />
							<span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
								{missionName}
							</span>
							<span className={`
         text-[9px] font-semibold
         ${isSuccess ? "text-emerald-200/60" : `text-rose-200/60`}
       `}>{isSuccess ? "Success" : "Failed"}</span>
							{contract.resolvedAt ? (
								<span className="
          font-(family-name:--nv-font-mono) text-[9px] text-white/20
        ">
									{new Date(contract.resolvedAt).toLocaleDateString()}
								</span>
							) : null}
						</div>
					);
				})}
			</div>
		</div>
	);
}

function SectionHeading(props: { icon: ReactNode; label: string }): ReactNode {
	return (
		<h2
			className="
     flex items-center gap-2 font-(family-name:--nv-font-display) text-sm
     font-bold
   "
		>
			{props.icon}
			{props.label}
		</h2>
	);
}

function MissionMetric(props: {
	label: string;
	value: string;
	unit?: string;
	highlight?: boolean;
}): ReactNode {
	return (
		<div className="text-center">
			<p
				className="
      text-[9px] font-semibold tracking-[0.12em] text-white/35 uppercase
    "
			>
				{props.label}
			</p>
			<p className={`
     mt-0.5 font-(family-name:--nv-font-mono) text-sm font-bold
     ${props.highlight ? `text-amber-300` : `text-white/80`}
   `}>
				{props.value}
				{props.unit ? (
					<span className="ml-0.5 text-[10px] font-normal text-white/40">{props.unit}</span>
				) : null}
			</p>
		</div>
	);
}

function SectionLabel(props: { children: ReactNode }): ReactNode {
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

export function ContractsSkeleton(): ReactNode {
	return (
		<div className="mx-auto w-full max-w-[1440px] px-4 pt-4 pb-12 text-white">
			<div
				className="
      grid gap-5
      lg:grid-cols-[minmax(0,1fr)_420px]
    "
			>
				<div className="space-y-5">
					<div
						className="
        h-16 animate-pulse rounded-2xl border border-white/10 bg-white/3
      "
					/>
					<div
						className="
        h-48 animate-pulse rounded-2xl border border-white/10 bg-white/3
      "
					/>
					<div
						className="
        h-64 animate-pulse rounded-2xl border border-white/10 bg-white/3
      "
					/>
				</div>
				<div
					className="
       h-96 animate-pulse rounded-2xl border border-white/10 bg-white/3
     "
				/>
			</div>
		</div>
	);
}
