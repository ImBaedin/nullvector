import type {
	BuildingKey,
	LaneQueueItem,
	ResourceBucket,
	ResourceBuildingCardData,
	ResourceBuildingLevelRow,
} from "@nullvector/game-logic";
import type { ReactNode } from "react";

import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import {
	DEFAULT_GENERATOR_REGISTRY,
	getGeneratorConsumptionPerMinute,
	getGeneratorProductionPerMinute,
	getUpgradeCost,
	getUpgradeDurationSeconds,
} from "@nullvector/game-logic";
import { Clock3, Gauge, Info, Layers3, X } from "lucide-react";
import { useMemo, useState } from "react";

import { getUpgradeActionPresentation } from "@/features/colony-ui/action-state";
import { ActionButton } from "@/features/colony-ui/components/action-button";
import { formatColonyDuration } from "@/features/colony-ui/time";

type DeltaResourceKey = "alloy" | "crystal" | "fuel" | "energy";
type CardStatus = "Running" | "Shortage" | "Overflow" | "Paused";
type PlanetMultipliers = {
	alloy: number;
	crystal: number;
	fuel: number;
};
type BuildingLevelSnapshot = Record<BuildingKey, number>;

const BUILDING_VISUALS: Record<
	BuildingKey,
	{
		accent: string;
		glowColor: string;
		imageUrl: string;
		portraitUrl: string;
	}
> = {
	alloyMineLevel: {
		accent: "rgba(74, 233, 255, 0.65)",
		glowColor: "rgba(74, 233, 255, 0.12)",
		imageUrl: "/game-icons/alloy.png",
		portraitUrl: "/game-icons/generators/alloy-mine.png",
	},
	crystalMineLevel: {
		accent: "rgba(122, 181, 255, 0.62)",
		glowColor: "rgba(122, 181, 255, 0.12)",
		imageUrl: "/game-icons/crystal.png",
		portraitUrl: "/game-icons/generators/crystal-mine.png",
	},
	fuelRefineryLevel: {
		accent: "rgba(255, 170, 106, 0.7)",
		glowColor: "rgba(255, 170, 106, 0.10)",
		imageUrl: "/game-icons/deuterium.png",
		portraitUrl: "/game-icons/generators/fuel-refinery.png",
	},
	powerPlantLevel: {
		accent: "rgba(255, 125, 167, 0.66)",
		glowColor: "rgba(255, 125, 167, 0.10)",
		imageUrl: "/game-icons/energy.png",
		portraitUrl: "/game-icons/generators/power-plant.png",
	},
	alloyStorageLevel: {
		accent: "rgba(83, 205, 235, 0.54)",
		glowColor: "rgba(83, 205, 235, 0.10)",
		imageUrl: "/game-icons/alloy.png",
		portraitUrl: "/game-icons/storages/alloy-depot.png",
	},
	crystalStorageLevel: {
		accent: "rgba(133, 164, 255, 0.52)",
		glowColor: "rgba(133, 164, 255, 0.10)",
		imageUrl: "/game-icons/crystal.png",
		portraitUrl: "/game-icons/storages/crystal-vault.png",
	},
	fuelStorageLevel: {
		accent: "rgba(255, 182, 122, 0.56)",
		glowColor: "rgba(255, 182, 122, 0.10)",
		imageUrl: "/game-icons/deuterium.png",
		portraitUrl: "/game-icons/storages/fuel-silo.png",
	},
};

const STATUS_STYLES: Record<CardStatus, { badge: string; card: string }> = {
	Running: {
		badge: "border-emerald-300/30 bg-emerald-400/8 text-emerald-200/80",
		card: "border-white/10",
	},
	Shortage: {
		badge: "border-amber-300/35 bg-amber-400/10 text-amber-200/80",
		card: "border-amber-300/20",
	},
	Overflow: {
		badge: "border-sky-200/35 bg-sky-400/10 text-sky-200/80",
		card: "border-sky-300/20",
	},
	Paused: {
		badge: "border-rose-300/30 bg-rose-400/10 text-rose-200/80",
		card: "border-rose-300/20",
	},
};

const DELTA_RESOURCE_META: Record<
	DeltaResourceKey,
	{ icon: string; label: string; suffix: string }
> = {
	alloy: { icon: "/game-icons/alloy.png", label: "Alloy", suffix: "/m" },
	crystal: { icon: "/game-icons/crystal.png", label: "Crystal", suffix: "/m" },
	fuel: { icon: "/game-icons/deuterium.png", label: "Fuel", suffix: "/m" },
	energy: { icon: "/game-icons/energy.png", label: "Energy", suffix: " MW" },
};

function formatUpgradeTime(seconds?: number) {
	if (!seconds || seconds <= 0) {
		return "N/A";
	}

	return formatColonyDuration(seconds, "seconds");
}

function formatSignedDelta(value: number, suffix: string) {
	return `${value > 0 ? "+" : ""}${value.toLocaleString()}${suffix}`;
}

function statusFromBuilding(args: {
	isProduction: boolean;
	overflow: number;
	storageFull: boolean;
	energyRatio: number;
	outputPerMinute: number;
}): CardStatus {
	if (args.isProduction && args.overflow > 0) {
		return "Overflow";
	}
	if (args.isProduction && args.storageFull) {
		return "Paused";
	}
	if (args.isProduction && args.energyRatio < 0.55) {
		return "Shortage";
	}
	if (args.outputPerMinute <= 0) {
		return "Paused";
	}
	return "Running";
}

function resourceNameForBuilding(key: BuildingKey) {
	if (key === "alloyMineLevel" || key === "alloyStorageLevel") {
		return "Alloy";
	}
	if (key === "crystalMineLevel" || key === "crystalStorageLevel") {
		return "Crystal";
	}
	if (key === "fuelRefineryLevel" || key === "fuelStorageLevel") {
		return "Fuel";
	}
	return "Energy";
}

function efficiencyLabel(status: CardStatus, energyRatio: number) {
	if (status === "Paused") {
		return "0%";
	}
	const value = Math.max(0, Math.min(100, Math.round(energyRatio * 100)));
	return `${value}%`;
}

function outputResourceKeyForBuilding(key: BuildingKey): DeltaResourceKey {
	if (key === "alloyMineLevel" || key === "alloyStorageLevel") {
		return "alloy";
	}
	if (key === "crystalMineLevel" || key === "crystalStorageLevel") {
		return "crystal";
	}
	if (key === "fuelRefineryLevel" || key === "fuelStorageLevel") {
		return "fuel";
	}
	return "energy";
}

export function isStorageBuildingKey(key: BuildingKey) {
	return key === "alloyStorageLevel" || key === "crystalStorageLevel" || key === "fuelStorageLevel";
}

export function isProductionBuildingKey(key: BuildingKey) {
	return key === "alloyMineLevel" || key === "crystalMineLevel" || key === "fuelRefineryLevel";
}

const STORAGE_BUILDING_MAX_LEVEL = 25;
const STORAGE_CAP_BASE_UNITS = 10_000;
const STORAGE_CAP_GROWTH = 1.7;

const STORAGE_UPGRADE_CONFIG: Record<
	"alloyStorageLevel" | "crystalStorageLevel" | "fuelStorageLevel",
	{
		costBase: ResourceBucket;
		costGrowth: number;
		durationBaseSeconds: number;
		durationGrowth: number;
	}
> = {
	alloyStorageLevel: {
		costBase: { alloy: 160, crystal: 60, fuel: 0 },
		costGrowth: 1.58,
		durationBaseSeconds: 110,
		durationGrowth: 1.2,
	},
	crystalStorageLevel: {
		costBase: { alloy: 130, crystal: 95, fuel: 0 },
		costGrowth: 1.58,
		durationBaseSeconds: 118,
		durationGrowth: 1.2,
	},
	fuelStorageLevel: {
		costBase: { alloy: 210, crystal: 90, fuel: 0 },
		costGrowth: 1.6,
		durationBaseSeconds: 126,
		durationGrowth: 1.21,
	},
};

function toWholeUnitBucket(resourceMap: Partial<Record<string, number>>): ResourceBucket {
	return {
		alloy: Math.max(0, Math.round(resourceMap.alloy ?? 0)),
		crystal: Math.max(0, Math.round(resourceMap.crystal ?? 0)),
		fuel: Math.max(0, Math.round(resourceMap.fuel ?? 0)),
	};
}

function storageCapForLevel(level: number) {
	if (level <= 0) {
		return 0;
	}
	return Math.round(STORAGE_CAP_BASE_UNITS * Math.pow(STORAGE_CAP_GROWTH, level - 1));
}

function storageCapsFromBuildingLevels(levels: BuildingLevelSnapshot): ResourceBucket {
	return {
		alloy: storageCapForLevel(levels.alloyStorageLevel),
		crystal: storageCapForLevel(levels.crystalStorageLevel),
		fuel: storageCapForLevel(levels.fuelStorageLevel),
	};
}

function getGeneratorIdForBuilding(key: BuildingKey) {
	if (key === "alloyMineLevel") {
		return "alloy_mine";
	}
	if (key === "crystalMineLevel") {
		return "crystal_mine";
	}
	if (key === "fuelRefineryLevel") {
		return "deuterium_extractor";
	}
	return "solar_plant";
}

function getGeneratorOrThrow(key: BuildingKey) {
	const generatorId = getGeneratorIdForBuilding(key);
	const generator = DEFAULT_GENERATOR_REGISTRY.get(generatorId);
	if (!generator) {
		throw new Error(`Missing generator config: ${generatorId}`);
	}
	return generator;
}

function productionRatesPerMinute(args: {
	buildingLevels: BuildingLevelSnapshot;
	overflow: ResourceBucket;
	planetMultipliers: PlanetMultipliers;
}) {
	const alloyGenerator = getGeneratorOrThrow("alloyMineLevel");
	const crystalGenerator = getGeneratorOrThrow("crystalMineLevel");
	const fuelGenerator = getGeneratorOrThrow("fuelRefineryLevel");
	const powerGenerator = getGeneratorOrThrow("powerPlantLevel");
	const rawAlloyRate =
		getGeneratorProductionPerMinute(alloyGenerator, args.buildingLevels.alloyMineLevel) *
		args.planetMultipliers.alloy;
	const rawCrystalRate =
		getGeneratorProductionPerMinute(crystalGenerator, args.buildingLevels.crystalMineLevel) *
		args.planetMultipliers.crystal;
	const rawFuelRate =
		getGeneratorProductionPerMinute(fuelGenerator, args.buildingLevels.fuelRefineryLevel) *
		args.planetMultipliers.fuel;
	const energyProduced = getGeneratorProductionPerMinute(
		powerGenerator,
		args.buildingLevels.powerPlantLevel,
	);
	const energyConsumed =
		getGeneratorConsumptionPerMinute(alloyGenerator, args.buildingLevels.alloyMineLevel) +
		getGeneratorConsumptionPerMinute(crystalGenerator, args.buildingLevels.crystalMineLevel) +
		getGeneratorConsumptionPerMinute(fuelGenerator, args.buildingLevels.fuelRefineryLevel);
	const energyRatio =
		energyConsumed <= 0 ? 1 : Math.max(0, Math.min(1, energyProduced / energyConsumed));

	return {
		resources: {
			alloy: args.overflow.alloy > 0 ? 0 : rawAlloyRate * energyRatio,
			crystal: args.overflow.crystal > 0 ? 0 : rawCrystalRate * energyRatio,
			fuel: args.overflow.fuel > 0 ? 0 : rawFuelRate * energyRatio,
		},
		energyProduced,
	};
}

function storageUpgradeCost(
	buildingKey: "alloyStorageLevel" | "crystalStorageLevel" | "fuelStorageLevel",
	currentLevel: number,
): ResourceBucket {
	const config = STORAGE_UPGRADE_CONFIG[buildingKey];
	return {
		alloy: Math.round(config.costBase.alloy * Math.pow(config.costGrowth, currentLevel)),
		crystal: Math.round(config.costBase.crystal * Math.pow(config.costGrowth, currentLevel)),
		fuel: Math.round(config.costBase.fuel * Math.pow(config.costGrowth, currentLevel)),
	};
}

function storageUpgradeDurationSeconds(
	buildingKey: "alloyStorageLevel" | "crystalStorageLevel" | "fuelStorageLevel",
	currentLevel: number,
) {
	const config = STORAGE_UPGRADE_CONFIG[buildingKey];
	return Math.round(config.durationBaseSeconds * Math.pow(config.durationGrowth, currentLevel));
}

function buildLevelTable(args: {
	building: ResourceBuildingCardData;
	buildingLevels: BuildingLevelSnapshot;
	overflow: ResourceBucket;
	planetMultipliers: PlanetMultipliers;
}) {
	const { building } = args;
	const isStorage = isStorageBuildingKey(building.key);
	const maxLevel = isStorage
		? STORAGE_BUILDING_MAX_LEVEL
		: getGeneratorOrThrow(building.key).maxLevel;
	const startLevel = Math.max(1, building.currentLevel);
	const endLevel = Math.min(maxLevel, startLevel + 9);
	const rows: ResourceBuildingLevelRow[] = [];

	for (let level = startLevel; level <= endLevel; level += 1) {
		const previewLevels: BuildingLevelSnapshot = {
			...args.buildingLevels,
			[building.key]: level,
		};
		const previewRates = productionRatesPerMinute({
			buildingLevels: previewLevels,
			overflow: args.overflow,
			planetMultipliers: args.planetMultipliers,
		});
		const previewStorageCaps = storageCapsFromBuildingLevels(previewLevels);
		const outputResource = outputResourceKeyForBuilding(building.key);
		const outputPerMinute = isStorage
			? outputResource === "alloy"
				? previewStorageCaps.alloy
				: outputResource === "crystal"
					? previewStorageCaps.crystal
					: previewStorageCaps.fuel
			: outputResource === "energy"
				? previewRates.energyProduced
				: Math.max(0, Math.floor(previewRates.resources[outputResource]));
		const energyUsePerMinute = isStorage
			? 0
			: building.key === "powerPlantLevel"
				? 0
				: getGeneratorConsumptionPerMinute(getGeneratorOrThrow(building.key), level);

		let cost = { alloy: 0, crystal: 0, fuel: 0 };
		let durationSeconds = 0;
		if (level < maxLevel) {
			if (isStorage) {
				cost = storageUpgradeCost(
					building.key as "alloyStorageLevel" | "crystalStorageLevel" | "fuelStorageLevel",
					level,
				);
				durationSeconds = storageUpgradeDurationSeconds(
					building.key as "alloyStorageLevel" | "crystalStorageLevel" | "fuelStorageLevel",
					level,
				);
			} else {
				const generator = getGeneratorOrThrow(building.key);
				cost = toWholeUnitBucket(getUpgradeCost(generator, level));
				durationSeconds = getUpgradeDurationSeconds(generator, level);
			}
		}

		rows.push({
			level,
			outputPerMinute,
			energyUsePerMinute,
			deltaOutputPerMinute: outputPerMinute - building.outputPerMinute,
			deltaEnergyPerMinute: energyUsePerMinute - building.energyUsePerMinute,
			cost,
			durationSeconds,
		});
	}

	return rows;
}

function InlineLevelEditor(props: {
	currentLevel: number;
	isSaving: boolean;
	onCancel: () => void;
	onCommit: (nextLevel: number) => Promise<void> | void;
}) {
	const [draftLevel, setDraftLevel] = useState(() => String(props.currentLevel));

	return (
		<input
			autoFocus
			className="
             inline-flex h-6 w-14 items-center justify-center rounded-md border
             border-cyan-300/35 bg-black/45 px-1 text-center
             font-(family-name:--nv-font-mono) text-[10px] font-bold text-cyan-100
             outline-none
             focus:border-cyan-200/60
           "
			disabled={props.isSaving}
			inputMode="numeric"
			onBlur={props.onCancel}
			onChange={(event) => {
				setDraftLevel(event.target.value.replace(/[^\d]/g, ""));
			}}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					props.onCancel();
					return;
				}
				if (event.key === "Enter") {
					event.preventDefault();
					void props.onCommit(Math.max(0, Math.floor(Number(draftLevel) || 0)));
				}
			}}
			value={draftLevel}
		/>
	);
}

export function ResourceBuildingCard(props: {
	activeQueueItem: LaneQueueItem | null;
	building: ResourceBuildingCardData;
	buildingLevels: BuildingLevelSnapshot;
	buildingQueueIsFull: boolean;
	energyRatio: number;
	isBusy: boolean;
	isTableOpen: boolean;
	overflow: ResourceBucket;
	resourcesStored: ResourceBucket;
	storageCaps: ResourceBucket;
	planetMultipliers: PlanetMultipliers;
	queuedForBuilding: LaneQueueItem | null;
	remainingTimeLabel: string | null;
	devInlineLevelEditor?: {
		enabled: boolean;
		isSaving: boolean;
		onCommit: (nextLevel: number) => Promise<void> | void;
	};
	onTableOpenChange: (open: boolean) => void;
	onUpgrade: () => void;
}) {
	const {
		activeQueueItem,
		building,
		buildingLevels,
		buildingQueueIsFull,
		energyRatio,
		isBusy,
		isTableOpen,
		overflow,
		resourcesStored,
		storageCaps,
		planetMultipliers,
		queuedForBuilding,
		remainingTimeLabel,
		devInlineLevelEditor,
		onTableOpenChange,
		onUpgrade,
	} = props;
	const [isEditingLevel, setIsEditingLevel] = useState(false);

	const isStorageBuilding = isStorageBuildingKey(building.key);
	const isProductionBuilding = isProductionBuildingKey(building.key);
	const isActiveUpgradeTarget = activeQueueItem?.payload.buildingKey === building.key;
	const levelTable = useMemo(
		() =>
			buildLevelTable({
				building,
				buildingLevels,
				overflow,
				planetMultipliers,
			}),
		[building, buildingLevels, overflow, planetMultipliers],
	);
	const nextLevelRow =
		levelTable.find((row) => row.level === building.currentLevel + 1) ?? levelTable[0];
	const resourceOverflow =
		building.key === "alloyMineLevel"
			? overflow.alloy
			: building.key === "crystalMineLevel"
				? overflow.crystal
				: building.key === "fuelRefineryLevel"
					? overflow.fuel
					: 0;
	const resourceStored =
		building.key === "alloyMineLevel"
			? resourcesStored.alloy
			: building.key === "crystalMineLevel"
				? resourcesStored.crystal
				: building.key === "fuelRefineryLevel"
					? resourcesStored.fuel
					: 0;
	const nextUpgradeCost = building.nextUpgradeCost;
	const nextUpgradeDurationSeconds = building.nextUpgradeDurationSeconds;
	const resourceStorageCap =
		building.key === "alloyMineLevel"
			? storageCaps.alloy
			: building.key === "crystalMineLevel"
				? storageCaps.crystal
				: building.key === "fuelRefineryLevel"
					? storageCaps.fuel
					: 0;
	const isPausedByStorageFull =
		isProductionBuilding &&
		resourceOverflow <= 0 &&
		resourceStorageCap > 0 &&
		resourceStored >= resourceStorageCap;
	const hasRequiredResources =
		resourcesStored.alloy >= nextUpgradeCost.alloy &&
		resourcesStored.crystal >= nextUpgradeCost.crystal &&
		resourcesStored.fuel >= nextUpgradeCost.fuel;
	const canStartUpgrade =
		hasRequiredResources &&
		!buildingQueueIsFull &&
		!isBusy &&
		nextUpgradeDurationSeconds !== undefined;
	const actionPresentation = getUpgradeActionPresentation({
		actionLabel: building.currentLevel <= 0 ? "Build" : "Upgrade",
		availableResources: resourcesStored,
		cost: nextUpgradeCost,
		hasQueuedItem: Boolean(queuedForBuilding),
		isActive: isActiveUpgradeTarget,
		isBusy,
		isLocked: false,
		isMaxLevel: nextUpgradeDurationSeconds === undefined,
		isQueueFull: buildingQueueIsFull,
	});
	const cardStatus = statusFromBuilding({
		energyRatio,
		isProduction: isProductionBuilding,
		overflow: resourceOverflow,
		storageFull: isPausedByStorageFull,
		outputPerMinute: building.outputPerMinute,
	});
	const statusStyle = STATUS_STYLES[cardStatus];
	const visual = BUILDING_VISUALS[building.key];
	const outputColumnLabel = isStorageBuilding ? "Capacity" : "Output";
	const outputResourceKey = outputResourceKeyForBuilding(building.key);
	const outputDeltaPerMinute = nextLevelRow?.deltaOutputPerMinute ?? 0;
	const energyDeltaPerMinute = nextLevelRow?.deltaEnergyPerMinute ?? 0;
	const energyImpactDeltaPerMinute = -energyDeltaPerMinute;
	const nextLevelDeltas: Array<{ key: DeltaResourceKey; value: number }> = [];
	const showOverflowBadgePopover =
		!isActiveUpgradeTarget &&
		!queuedForBuilding &&
		isProductionBuilding &&
		cardStatus === "Overflow" &&
		resourceOverflow > 0;
	const effectiveOutputPerMinute = isPausedByStorageFull ? 0 : building.outputPerMinute;
	const statusBadgeLabel = isPausedByStorageFull
		? "Paused (Storage Full)"
		: cardStatus === "Overflow" && resourceOverflow > 0
			? "Paused (Overflow)"
			: cardStatus;

	if (outputDeltaPerMinute !== 0) {
		nextLevelDeltas.push({
			key: outputResourceKey,
			value: outputDeltaPerMinute,
		});
	}

	if (outputResourceKey !== "energy" && energyImpactDeltaPerMinute !== 0) {
		nextLevelDeltas.push({
			key: "energy",
			value: energyImpactDeltaPerMinute,
		});
	}

	return (
		<article className={`
    group relative h-full overflow-hidden rounded-xl border
    ${statusStyle.card}
    bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,16,0.95))]
    text-[13px]
  `}>
			<div
				className="pointer-events-none absolute inset-x-0 top-0 h-px"
				style={{ background: `linear-gradient(90deg, transparent, ${visual.accent}, transparent)` }}
			/>
			<div
				className="
      pointer-events-none absolute -top-8 -right-8 size-32 rounded-full blur-3xl
    "
				style={{ background: visual.glowColor }}
			/>

			{/* ── Portrait + Identity Header ── */}
			<div className="relative z-10 flex h-full items-stretch gap-0">
				<div
					className="
        relative flex w-24 shrink-0 items-center justify-center
        overflow-hidden border-r border-white/6 bg-black/20
      "
				>
					<img
						alt={building.name}
						className="
         h-full w-full object-cover opacity-90
         transition-transform duration-300
         group-hover:scale-105
       "
						draggable={false}
						src={visual.portraitUrl}
					/>
					<div
						className="pointer-events-none absolute inset-0"
						style={{
							background: `linear-gradient(to right, transparent 60%, rgba(6,10,16,0.95))`,
						}}
					/>
				</div>

				<div className="flex min-w-0 flex-1 flex-col p-3.5">
					{/* Name + Level + Actions */}
					<div className="flex items-start justify-between gap-2">
						<div className="min-w-0">
							<h3 className="font-(family-name:--nv-font-display) text-sm leading-tight font-bold">
								{building.name}
							</h3>
							{showOverflowBadgePopover ? (
								<Popover.Root>
									<Popover.Trigger
										closeDelay={120}
										delay={80}
										openOnHover
										render={
											<button className={`
              mt-1.5 inline-flex cursor-help items-center gap-1 rounded-md border
              px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap uppercase
              ${statusStyle.badge}
            `} type="button">
												{statusBadgeLabel}
											</button>
										}
									/>
									<Popover.Portal>
										<Popover.Positioner align="start" className="z-90" sideOffset={8}>
											<Popover.Popup
												className="
               max-w-[300px] rounded-xl border border-amber-200/35
               bg-[rgba(35,24,8,0.86)] p-3 text-xs text-amber-100
               shadow-[0_20px_45px_rgba(0,0,0,0.5)] backdrop-blur-md
               transition-[transform,scale,opacity] duration-200 outline-none
               data-ending-style:scale-90 data-ending-style:opacity-0
               data-starting-style:scale-90 data-starting-style:opacity-0
             "
											>
												Overflow stockpile: {resourceOverflow.toLocaleString()}{" "}
												{resourceNameForBuilding(building.key)}. Production resumes automatically
												when overflow reaches zero.
											</Popover.Popup>
										</Popover.Positioner>
									</Popover.Portal>
								</Popover.Root>
							) : (
								<p className={`
           mt-1.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5
           text-[9px] font-semibold whitespace-nowrap uppercase
           ${statusStyle.badge}
         `}>
									{isActiveUpgradeTarget ? (
										<>
											<Clock3 className="size-3" />
											Upgrading to Lv {activeQueueItem.payload.toLevel}
											{remainingTimeLabel ? ` (${remainingTimeLabel})` : ""}
										</>
									) : queuedForBuilding ? (
										<>Queued for Lv {queuedForBuilding.payload.toLevel}</>
									) : (
										statusBadgeLabel
									)}
								</p>
							)}
						</div>
						<div className="flex shrink-0 items-center gap-1.5">
							{devInlineLevelEditor?.enabled ? (
								isEditingLevel ? (
									<InlineLevelEditor
										key={`${building.key}:${building.currentLevel}`}
										currentLevel={building.currentLevel}
										isSaving={devInlineLevelEditor.isSaving}
										onCancel={() => {
											setIsEditingLevel(false);
										}}
										onCommit={async (nextLevel) => {
											await devInlineLevelEditor.onCommit(nextLevel);
											setIsEditingLevel(false);
										}}
									/>
								) : (
									<button
										aria-label={`Level ${building.currentLevel}`}
										className="
             inline-flex h-6 min-w-9 items-center justify-center rounded-md border
             border-cyan-300/20 bg-cyan-400/8 px-1.5
             font-(family-name:--nv-font-mono) text-[10px] font-bold text-cyan-100
             transition
             hover:border-cyan-200/45 hover:bg-cyan-400/14
             disabled:cursor-not-allowed disabled:opacity-50
           "
										disabled={devInlineLevelEditor.isSaving}
										onClick={() => {
											setIsEditingLevel(true);
										}}
										title={`Level ${building.currentLevel}`}
										type="button"
									>
										{building.currentLevel}
									</button>
								)
							) : (
								<span
									aria-label={`Level ${building.currentLevel}`}
									className="
            inline-flex size-6 items-center justify-center rounded-md border
            border-white/15 bg-black/25 font-(family-name:--nv-font-mono)
            text-[10px] font-bold text-white/80
          "
									title={`Level ${building.currentLevel}`}
								>
									{building.currentLevel}
								</span>
							)}
							{!isStorageBuilding ? (
								<GeneratorInfoPopover
									details={
										<div className="grid gap-1.5 text-[10px]">
											<p className="text-white/50">
												Efficiency:{" "}
												<span
													className="
                font-(family-name:--nv-font-mono) font-semibold text-white
              "
												>
													{efficiencyLabel(cardStatus, energyRatio)}
												</span>
											</p>
											<p className="text-white/50">
												Output:{" "}
												<span
													className="
                font-(family-name:--nv-font-mono) font-semibold text-white
              "
												>
													{effectiveOutputPerMinute.toLocaleString()} {building.outputLabel}
												</span>
											</p>
											<p className="text-white/50">
												Energy Draw:{" "}
												<span
													className="
                font-(family-name:--nv-font-mono) font-semibold text-white
              "
												>
													{building.energyUsePerMinute.toLocaleString()} MW
												</span>
											</p>
											{resourceOverflow > 0 ? (
												<p className="text-white/50">
													Overflow:{" "}
													<span
														className="
                 font-(family-name:--nv-font-mono) font-semibold text-amber-200
               "
													>
														{resourceOverflow.toLocaleString()}{" "}
														{resourceNameForBuilding(building.key)}
													</span>
												</p>
											) : null}
											{isProductionBuilding && resourceOverflow > 0 ? (
												<p className="text-amber-100/90">
													Production is paused while overflow is above zero.
												</p>
											) : isPausedByStorageFull ? (
												<p className="text-rose-100/90">
													Production is paused while storage is full.
												</p>
											) : (
												<p className="text-white/50">
													Overflow:{" "}
													<span className="font-semibold text-white">
														{isProductionBuilding ? "None" : "N/A"}
													</span>
												</p>
											)}
										</div>
									}
								/>
							) : null}
							<Dialog.Root onOpenChange={onTableOpenChange} open={isTableOpen}>
								<Dialog.Trigger
									className="
            rounded-md border border-white/12 bg-white/3 px-2 py-1 text-[10px]
            font-semibold text-white/50 transition
            hover:bg-white/6 hover:text-white/80
          "
								>
									<span className="inline-flex items-center gap-1">
										<Layers3 className="size-3" />
										Levels
									</span>
								</Dialog.Trigger>
								<Dialog.Portal>
									<Dialog.Backdrop
										className="
             fixed inset-0 z-95 bg-[rgba(3,6,12,0.72)] backdrop-blur-sm
             transition-all duration-200
             data-ending-style:opacity-0
             data-starting-style:opacity-0
           "
									/>
									<Dialog.Popup
										className="
             fixed top-1/2 left-1/2 z-100 max-h-[85vh] w-[min(96vw,860px)]
             -translate-1/2 overflow-y-auto rounded-2xl border border-white/12
             bg-[linear-gradient(170deg,rgba(12,20,36,0.98),rgba(6,10,18,0.99))]
             shadow-[0_24px_56px_rgba(0,0,0,0.55)] transition-all duration-200
             outline-none
             data-ending-style:scale-95 data-ending-style:opacity-0
             data-starting-style:scale-95 data-starting-style:opacity-0
           "
									>
										<div
											className="
              p-3.5
              sm:p-5
            "
										>
											<div className="mb-3 flex items-center justify-between gap-2">
												<Dialog.Title
													className="
                inline-flex items-center gap-2
                font-(family-name:--nv-font-display) text-sm font-bold text-white
              "
												>
													<Layers3 className="size-4 text-cyan-300/60" />
													Level Planner: {building.name}
												</Dialog.Title>
												<Dialog.Description className="sr-only">
													Review level progression, upgrade costs, and timing for {building.name}.
												</Dialog.Description>
												<Dialog.Close
													className="
                rounded-md border border-white/12 bg-white/3 p-1.5 text-white/50
                transition
                hover:bg-white/6 hover:text-white/80
              "
												>
													<X className="size-3.5" strokeWidth={2.4} />
												</Dialog.Close>
											</div>
											<div
												className="
               overflow-hidden rounded-lg border border-white/8 bg-black/20
             "
											>
												<table
													className="
                w-full text-left font-(family-name:--nv-font-mono) text-[10px]
              "
												>
													<thead
														className="
                 bg-white/4 text-[9px] tracking-widest text-white/40 uppercase
               "
													>
														<tr>
															<th className="px-2.5 py-2 font-semibold">Lv</th>
															<th className="px-2.5 py-2 font-semibold">{outputColumnLabel}</th>
															<th className="px-2.5 py-2 font-semibold">Energy</th>
															<th className="px-2.5 py-2 font-semibold">Cost</th>
															<th className="px-2.5 py-2 font-semibold">Time</th>
														</tr>
													</thead>
													<tbody>
														{levelTable.map((row) => (
															<tr
																className={
																	row.level === building.currentLevel
																		? "bg-cyan-400/8 text-cyan-100"
																		: `
                     text-white/70
                     hover:bg-white/2
                   `
																}
																key={`${building.key}-${row.level}`}
															>
																<td className="px-2.5 py-1.5 font-bold">{row.level}</td>
																<td className="px-2.5 py-1.5">
																	{row.outputPerMinute.toLocaleString()}{" "}
																	<span
																		className={
																			row.deltaOutputPerMinute >= 0
																				? "text-emerald-300/60"
																				: "text-rose-300/60"
																		}
																	>
																		({row.deltaOutputPerMinute >= 0 ? "+" : ""}
																		{row.deltaOutputPerMinute.toLocaleString()})
																	</span>
																</td>
																<td className="px-2.5 py-1.5">
																	{row.energyUsePerMinute.toLocaleString()}{" "}
																	<span className="text-white/30">
																		({row.deltaEnergyPerMinute >= 0 ? "+" : ""}
																		{row.deltaEnergyPerMinute.toLocaleString()})
																	</span>
																</td>
																<td className="px-2.5 py-1.5">
																	A {row.cost.alloy.toLocaleString()} / C{" "}
																	{row.cost.crystal.toLocaleString()} / F{" "}
																	{row.cost.fuel.toLocaleString()}
																</td>
																<td className="px-2.5 py-1.5">
																	{formatUpgradeTime(row.durationSeconds)}
																</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</div>
									</Dialog.Popup>
								</Dialog.Portal>
							</Dialog.Root>
						</div>
					</div>

					{/* ── Production Rate + Energy ── */}
					{!isStorageBuilding ? (
						<div className="mt-2.5 flex items-center gap-2">
							<div
								className="
          flex items-center gap-1.5 rounded-lg border border-white/6
          bg-black/20 px-2.5 py-1.5
        "
							>
								<img
									alt={DELTA_RESOURCE_META[outputResourceKey].label}
									className="size-3.5 rounded-[2px] border border-white/15 object-cover"
									src={DELTA_RESOURCE_META[outputResourceKey].icon}
								/>
								<span
									className="
            font-(family-name:--nv-font-mono) text-[10px] font-semibold text-white/80
          "
								>
									{effectiveOutputPerMinute.toLocaleString()}
								</span>
								<span className="font-(family-name:--nv-font-mono) text-[9px] text-white/35">
									/m
								</span>
							</div>
							<div
								className="
          flex items-center gap-1.5 rounded-lg border border-white/6
          bg-black/20 px-2.5 py-1.5 text-[10px] text-white/50
        "
							>
								<Gauge className="size-3 text-cyan-300/50" />
								<span
									className="
           font-(family-name:--nv-font-mono) font-semibold text-white/70
         "
								>
									{building.energyUsePerMinute.toLocaleString()} MW
								</span>
							</div>
						</div>
					) : null}

					<div className="mt-auto flex pt-3">
						<Popover.Root>
							<Popover.Trigger
								closeDelay={90}
								delay={60}
								nativeButton={false}
								openOnHover
								render={
									<div>
										<ActionButton
											disabled={!actionPresentation.isActionEnabled}
											durationLabel={formatUpgradeTime(nextUpgradeDurationSeconds)}
											label={actionPresentation.buttonLabel}
											loading={isBusy}
											onClick={() => {
												if (!canStartUpgrade) {
													return;
												}
												onUpgrade();
											}}
											tone="resource"
										/>
									</div>
								}
							/>
							<Popover.Portal>
								<Popover.Positioner align="end" className="z-90" sideOffset={8}>
									<Popover.Popup
										className="
           w-[240px] origin-(--transform-origin) rounded-xl border
           border-white/12
           bg-[linear-gradient(170deg,rgba(12,20,36,0.95),rgba(6,10,18,0.98))]
           p-3 text-xs text-white/80 shadow-[0_20px_45px_rgba(0,0,0,0.5)]
           backdrop-blur-md transition-[transform,scale,opacity] duration-200
           outline-none
           data-ending-style:scale-90 data-ending-style:opacity-0
           data-starting-style:scale-90 data-starting-style:opacity-0
         "
									>
										<p
											className="
            text-[9px] font-semibold tracking-[0.14em] text-white/40 uppercase
          "
										>
											Next Upgrade Cost
										</p>
										<div className="mt-2 flex flex-wrap items-center gap-1.5">
											<CostPill
												amount={nextUpgradeCost.alloy}
												icon="/game-icons/alloy.png"
												label="Alloy"
											/>
											<CostPill
												amount={nextUpgradeCost.crystal}
												icon="/game-icons/crystal.png"
												label="Crystal"
											/>
											<CostPill
												amount={nextUpgradeCost.fuel}
												icon="/game-icons/deuterium.png"
												label="Fuel"
											/>
										</div>
										{nextLevelDeltas.length > 0 ? (
											<div className="mt-3 border-t border-white/15 pt-3">
												<p
													className="
              text-[9px] font-semibold tracking-[0.14em] text-white/40 uppercase
            "
												>
													Next Level Delta
												</p>
												<div className="mt-2 flex flex-wrap items-center gap-1.5">
													{nextLevelDeltas.map((delta) => (
														<DeltaPill
															icon={DELTA_RESOURCE_META[delta.key].icon}
															key={`${building.key}-${delta.key}`}
															label={DELTA_RESOURCE_META[delta.key].label}
															tone={delta.value > 0 ? "positive" : "negative"}
															value={formatSignedDelta(
																delta.value,
																delta.key === outputResourceKey && isStorageBuilding
																	? " cap"
																	: DELTA_RESOURCE_META[delta.key].suffix,
															)}
														/>
													))}
												</div>
											</div>
										) : null}
									</Popover.Popup>
								</Popover.Positioner>
							</Popover.Portal>
						</Popover.Root>
					</div>
				</div>
			</div>
		</article>
	);
}

function CostPill(props: { amount: number; icon: string; label: string }) {
	return (
		<span
			className="
     inline-flex items-center gap-1 rounded-md border border-white/10
     bg-black/25 px-2 py-1 font-(family-name:--nv-font-mono) text-[10px]
     font-semibold text-white/80
   "
		>
			<img
				alt={`${props.label} resource`}
				className="size-3.5 rounded-[2px] border border-white/15 object-cover"
				src={props.icon}
			/>
			<span>{props.amount.toLocaleString()}</span>
		</span>
	);
}

function DeltaPill(props: {
	icon: string;
	label: string;
	tone: "negative" | "positive";
	value: string;
}) {
	return (
		<span className={`
    inline-flex items-center gap-1 rounded-md border px-2 py-1
    font-(family-name:--nv-font-mono) text-[10px] font-semibold
    ${props.tone === "positive" ? `
      border-emerald-300/20 bg-emerald-400/8 text-emerald-200/80
    ` : `border-rose-300/20 bg-rose-400/8 text-rose-200/80`}
  `}>
			<img
				alt={`${props.label} resource`}
				className="size-3.5 rounded-[2px] border border-white/15 object-cover"
				src={props.icon}
			/>
			<span>{props.value}</span>
		</span>
	);
}

function GeneratorInfoPopover({ details }: { details: ReactNode }) {
	return (
		<Popover.Root>
			<Popover.Trigger
				closeDelay={120}
				delay={70}
				openOnHover
				render={
					<button
						className="
        rounded-md border border-white/12 bg-white/3 p-1.5 text-white/50
        transition
        hover:bg-white/6 hover:text-white/80
      "
						type="button"
					>
						<Info className="size-3" strokeWidth={2.4} />
					</button>
				}
			/>
			<Popover.Portal>
				<Popover.Positioner align="end" className="z-90" sideOffset={10}>
					<Popover.Popup
						className="
        max-w-[230px] origin-(--transform-origin) rounded-xl border
        border-white/12
        bg-[linear-gradient(170deg,rgba(12,20,36,0.95),rgba(6,10,18,0.98))] p-3
        text-[10px] text-white/80 shadow-[0_18px_34px_rgba(0,0,0,0.45)]
        backdrop-blur-md transition-[transform,scale,opacity] duration-200
        outline-none
        data-ending-style:scale-90 data-ending-style:opacity-0
        data-starting-style:scale-90 data-starting-style:opacity-0
      "
					>
						{details}
					</Popover.Popup>
				</Popover.Positioner>
			</Popover.Portal>
		</Popover.Root>
	);
}
