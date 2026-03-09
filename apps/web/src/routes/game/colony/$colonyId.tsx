import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { api } from "@nullvector/backend/convex/_generated/api";

import "@/features/game-ui/theme";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Activity, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
	HoverPanelState,
	RenderableEntity,
} from "@/features/universe-explorer-realdata/types";

import { AppHeader, type StarMapHeaderNavigation } from "@/features/game-ui/header";
import { ExplorerCanvas } from "@/features/universe-explorer-realdata/components/explorer-canvas";
import { HoverPanel } from "@/features/universe-explorer-realdata/components/hover-panel";
import { LevelGalaxy } from "@/features/universe-explorer-realdata/components/level-galaxy";
import { LevelSector } from "@/features/universe-explorer-realdata/components/level-sector";
import { LevelSystem } from "@/features/universe-explorer-realdata/components/level-system";
import { LevelUniverse } from "@/features/universe-explorer-realdata/components/level-universe";
import {
	ExplorerProvider,
	useExplorerContext,
} from "@/features/universe-explorer-realdata/context/explorer-context";
import { useExplorerData } from "@/features/universe-explorer-realdata/hooks/use-explorer-data";
import { useExplorerQuality } from "@/features/universe-explorer-realdata/hooks/use-explorer-quality";
import { computeOrbitWorldPosition } from "@/features/universe-explorer-realdata/lib/orbits";
import { useGameTimedSync } from "@/hooks/use-game-timed-sync";
import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";
import { cn } from "@/lib/utils";

import {
	ColonyStarMapPickerProvider,
	useColonyStarMapPicker,
} from "./$colonyId/star-map-picker-context";

export const Route = createFileRoute("/game/colony/$colonyId")({
	component: ColonyLayoutRoute,
});

const ZOOM = {
	galaxy: 0.22,
	planet: 2.8,
	sector: 0.55,
	system: 1.9,
} as const;
const STAR_MAP_CONTENT_TRANSITION_MS = 500;

type OverlayContentPhase = "visible" | "hiding" | "hidden" | "revealing";

function isSameHeaderNavigation(
	current: StarMapHeaderNavigation | null,
	next: StarMapHeaderNavigation | null,
) {
	if (current === next) {
		return true;
	}
	if (!current || !next) {
		return false;
	}
	if (current.levelLabel !== next.levelLabel || current.qualityPreset !== next.qualityPreset) {
		return false;
	}
	if (current.pathItems.length !== next.pathItems.length) {
		return false;
	}
	for (let i = 0; i < current.pathItems.length; i += 1) {
		const currentItem = current.pathItems[i];
		const nextItem = next.pathItems[i];
		if (currentItem.id !== nextItem.id || currentItem.label !== nextItem.label) {
			return false;
		}
	}
	if (current.entityItems.length !== next.entityItems.length) {
		return false;
	}
	for (let i = 0; i < current.entityItems.length; i += 1) {
		const currentItem = current.entityItems[i];
		const nextItem = next.entityItems[i];
		if (
			currentItem.id !== nextItem.id ||
			currentItem.label !== nextItem.label ||
			currentItem.subtitle !== nextItem.subtitle
		) {
			return false;
		}
	}
	return true;
}

function ColonyLayoutRoute() {
	return (
		<ColonyStarMapPickerProvider>
			<ColonyLayoutContent />
		</ColonyStarMapPickerProvider>
	);
}

function ColonyLayoutContent() {
	const { colonyId } = Route.useParams();
	const colonyIdAsId = colonyId as Id<"colonies">;
	const { isAuthenticated } = useConvexAuth();
	const [isStarMapOpen, setIsStarMapOpen] = useState(false);
	const [headerStarMapNavigation, setHeaderStarMapNavigation] =
		useState<StarMapHeaderNavigation | null>(null);
	const handleHeaderNavigationChange = useCallback((navigation: StarMapHeaderNavigation | null) => {
		setHeaderStarMapNavigation((current) =>
			isSameHeaderNavigation(current, navigation) ? current : navigation,
		);
	}, []);
	const { pickerRequest } = useColonyStarMapPicker();
	const fleetActiveOperations = useQuery(
		api.fleetV2.getFleetOperationsForColony,
		isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const syncColony = useMutation(api.colonyQueue.syncColony);
	const isSyncingRef = useRef(false);
	const sync = useCallback(async () => {
		if (!isAuthenticated || isSyncingRef.current) {
			return;
		}

		isSyncingRef.current = true;
		try {
			await syncColony({ colonyId: colonyIdAsId });
		} catch {
			// Route-level timed sync should be silent; leaf pages already surface sync errors.
		} finally {
			isSyncingRef.current = false;
		}
	}, [colonyIdAsId, isAuthenticated, syncColony]);
	const [contentPhase, setContentPhase] = useState<OverlayContentPhase>("visible");
	const revealRafRef = useRef<number | null>(null);
	const handleCloseStarMap = useCallback(() => {
		setIsStarMapOpen(false);
	}, []);

	useEffect(() => {
		return () => {
			if (revealRafRef.current !== null) {
				cancelAnimationFrame(revealRafRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (revealRafRef.current !== null) {
			cancelAnimationFrame(revealRafRef.current);
			revealRafRef.current = null;
		}

		if (!isStarMapOpen) {
			setContentPhase((current) => {
				if (current === "hidden") {
					// Mount in collapsed state first, then animate to fully visible.
					revealRafRef.current = requestAnimationFrame(() => {
						revealRafRef.current = null;
						setContentPhase("visible");
					});
					return "revealing";
				}

				if (current === "hiding") {
					return "visible";
				}
				return current;
			});
			return;
		}

		setContentPhase((current) => (current === "hidden" ? current : "hiding"));

		const hideTimerId = window.setTimeout(() => {
			setContentPhase("hidden");
		}, STAR_MAP_CONTENT_TRANSITION_MS);

		return () => {
			window.clearTimeout(hideTimerId);
		};
	}, [isStarMapOpen]);

	useEffect(() => {
		if (!pickerRequest) {
			return;
		}
		setIsStarMapOpen(true);
	}, [pickerRequest]);

	useGameTimedSync({
		enabled: isAuthenticated,
		events: [
			{
				id: "fleet-next-event-player",
				atMs: fleetActiveOperations?.nextEventAt ?? null,
			},
		],
		onDue: () => sync(),
		scopeId: `colony:${colonyId}:layout:fleet`,
	});

	const shouldCollapseContent =
		contentPhase === "hiding" || contentPhase === "hidden" || contentPhase === "revealing";
	const outletActivityMode = contentPhase === "hidden" ? "hidden" : "visible";

	return (
		<div
			className="relative h-full overflow-y-auto"
			style={{
				background:
					"linear-gradient(180deg, #15263f 0%, #101c31 18%, #0b1524 40%, #070f1c 60%, #060c15 100%)",
			}}
		>
			<div className="
     pointer-events-none absolute inset-0
     bg-[radial-gradient(circle_at_16%_18%,rgba(72,180,255,0.18),transparent_36%),radial-gradient(circle_at_84%_22%,rgba(74,233,255,0.14),transparent_38%)]
   " />

			<ExplorerProvider>
				<ColonyStarMapLayer
					colonyId={colonyId as Id<"colonies">}
					isOpen={isStarMapOpen}
					onClose={handleCloseStarMap}
					onHeaderNavigationChange={handleHeaderNavigationChange}
				/>
			</ExplorerProvider>

			<AppHeader
				collapseContextNav={isStarMapOpen}
				collapseResources={isStarMapOpen}
				isStarMapOpen={isStarMapOpen}
				onToggleStarMap={() => setIsStarMapOpen((current) => !current)}
				starMapNavigation={isStarMapOpen ? headerStarMapNavigation : null}
			/>

			<div
				className={cn(
					"relative z-10 min-h-full overflow-hidden",
					isStarMapOpen || contentPhase !== "visible" ? "pointer-events-none" : null,
				)}
			>
				<div
					className={cn(
						`
        relative min-h-full transition-[clip-path,opacity,transform]
        duration-500 ease-out
      `,
						shouldCollapseContent
							? "pointer-events-none -translate-y-3 opacity-0"
							: "translate-y-0 opacity-100",
					)}
					style={{
						clipPath: shouldCollapseContent
							? "inset(0 0 100% 0 round 0.5rem)"
							: "inset(0 0 0 0 round 0.5rem)",
					}}
				>
					<Activity mode={outletActivityMode}>
						<Outlet />
					</Activity>
				</div>
			</div>
		</div>
	);
}

function ColonyStarMapLayer({
	colonyId,
	isOpen,
	onClose,
	onHeaderNavigationChange,
}: {
	colonyId: Id<"colonies">;
	isOpen: boolean;
	onClose: () => void;
	onHeaderNavigationChange: (navigation: StarMapHeaderNavigation | null) => void;
}) {
	const explorer = useExplorerContext();
	const { completeSelection, pickerRequest } = useColonyStarMapPicker();
	const { isAuthenticated } = useConvexAuth();
	const data = useExplorerData();
	const { antialiasEnabled, canvasDpr, qualityPreset, resolvedQuality, setQualityPreset } =
		useExplorerQuality();
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const [hover, setHover] = useState<HoverPanelState | null>(null);
	const hoverRafRef = useRef<number | null>(null);
	const pendingHoverRef = useRef<HoverPanelState | null>(null);
	const initializedColonyIdRef = useRef<Id<"colonies"> | null>(null);
	const coordinates = useQuery(
		api.colonyNav.getColonyCoordinates,
		isAuthenticated ? { colonyId } : "skip",
	);

	useEffect(() => {
		return () => {
			if (hoverRafRef.current !== null) {
				cancelAnimationFrame(hoverRafRef.current);
				hoverRafRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		if (!coordinates) {
			return;
		}
		if (initializedColonyIdRef.current === colonyId) {
			return;
		}

		const { galaxyId, focusX, focusY, planetId, sectorId, systemId } = coordinates;

		explorer.setPlanetLevel(
			{
				galaxyId,
				sectorId,
				systemId,
				planetId,
			},
			{
				x: focusX,
				y: focusY,
				zoom: ZOOM.planet,
			},
		);
		initializedColonyIdRef.current = colonyId;
	}, [colonyId, coordinates, explorer]);

	const clearHover = () => {
		setHoveredId(null);
		pendingHoverRef.current = null;
		setHover(null);
		if (hoverRafRef.current !== null) {
			cancelAnimationFrame(hoverRafRef.current);
			hoverRafRef.current = null;
		}
	};

	const handleHover = (entity: RenderableEntity, screenX: number, screenY: number) => {
		setHoveredId(entity.id);
		pendingHoverRef.current = {
			entityType: entity.entityType,
			name: entity.name,
			addressLabel: entity.addressLabel,
			colonyName: entity.colony?.name,
			colonyPlayerName: entity.colony?.playerName,
			screenX,
			screenY,
		};

		if (hoverRafRef.current !== null) {
			return;
		}

		hoverRafRef.current = requestAnimationFrame(() => {
			hoverRafRef.current = null;
			setHover(pendingHoverRef.current);
		});
	};

	const handleUniverseEntitySelect = (entity: RenderableEntity) => {
		explorer.setGalaxyLevel(entity.sourceId as Id<"galaxies">, {
			x: entity.x,
			y: entity.y,
			zoom: ZOOM.galaxy,
		});
	};

	const handleGalaxyEntitySelect = (entity: RenderableEntity) => {
		if (!explorer.path.galaxyId) {
			return;
		}

		explorer.setSectorLevel(
			{
				galaxyId: explorer.path.galaxyId,
				sectorId: entity.sourceId as Id<"sectors">,
			},
			{
				x: entity.x,
				y: entity.y,
				zoom: ZOOM.sector,
			},
		);
	};

	const handleSectorEntitySelect = (entity: RenderableEntity) => {
		if (!explorer.path.galaxyId || !explorer.path.sectorId) {
			return;
		}

		explorer.setSystemLevel(
			{
				galaxyId: explorer.path.galaxyId,
				sectorId: explorer.path.sectorId,
				systemId: entity.sourceId as Id<"systems">,
			},
			{
				x: entity.x,
				y: entity.y,
				zoom: ZOOM.system,
			},
		);
	};

	const handlePlanetEntitySelect = (
		entity: RenderableEntity,
		position?: {
			x: number;
			y: number;
		},
	) => {
		if (pickerRequest) {
			if (!data.selectedGalaxy || !data.selectedSector || !data.selectedSystem) {
				toast.error("Zoom into a system before selecting a destination.");
				return;
			}

			const selectedPlanet = data.systemData?.planets.find(
				(planet) => planet.id === (entity.sourceId as Id<"planets">),
			);
			if (!selectedPlanet) {
				toast.error("Unable to resolve the selected planet.");
				return;
			}

			if (pickerRequest.missionKind === "transport" && !selectedPlanet.colony) {
				toast.error("Transport missions require a colonized destination.");
				return;
			}

			completeSelection({
				missionKind: pickerRequest.missionKind,
				galaxyIndex: data.selectedGalaxy.galaxyIndex,
				sectorIndex: data.selectedSector.sectorIndex,
				systemIndex: data.selectedSystem.systemIndex,
				planetIndex: selectedPlanet.planetIndex,
				planetId: selectedPlanet.id,
				planetName: selectedPlanet.displayName,
				addressLabel: selectedPlanet.addressLabel,
				colonyId: selectedPlanet.colony?.id,
				colonyName: selectedPlanet.colony?.name,
			});
			onClose();
			return;
		}

		if (!explorer.path.galaxyId || !explorer.path.sectorId || !explorer.path.systemId) {
			return;
		}

		const livePosition =
			position ??
			(entity.orbit
				? computeOrbitWorldPosition(entity.orbit, Date.now())
				: { x: entity.x, y: entity.y });

		explorer.setPlanetLevel(
			{
				galaxyId: explorer.path.galaxyId,
				sectorId: explorer.path.sectorId,
				systemId: explorer.path.systemId,
				planetId: entity.sourceId as Id<"planets">,
			},
			{
				x: livePosition.x,
				y: livePosition.y,
				zoom: ZOOM.planet,
			},
		);
	};

	const displayedLevel =
		explorer.level === "planet" && explorer.cameraLock.mode === "free" ? "system" : explorer.level;

	const currentEntities =
		explorer.level === "universe"
			? data.galaxyEntities
			: explorer.level === "galaxy"
				? data.sectorEntities
				: explorer.level === "sector"
					? data.systemEntities
					: data.planetEntities;

	const navigateToUniverse = useCallback(() => {
		explorer.setUniverseLevel({ x: 0, y: 0, zoom: 0.08 });
	}, [explorer]);

	const navigateToGalaxy = useCallback(() => {
		if (!data.selectedGalaxy) {
			return;
		}

		explorer.setGalaxyLevel(data.selectedGalaxy.id, {
			x: data.selectedGalaxy.gx,
			y: data.selectedGalaxy.gy,
			zoom: ZOOM.galaxy,
		});
	}, [data.selectedGalaxy, explorer]);

	const navigateToSector = useCallback(() => {
		if (!data.selectedGalaxy || !data.selectedSector) {
			return;
		}

		explorer.setSectorLevel(
			{
				galaxyId: data.selectedGalaxy.id,
				sectorId: data.selectedSector.id,
			},
			{
				x: data.selectedSector.centerX,
				y: data.selectedSector.centerY,
				zoom: ZOOM.sector,
			},
		);
	}, [data.selectedGalaxy, data.selectedSector, explorer]);

	const navigateToSystem = useCallback(() => {
		if (!data.selectedGalaxy || !data.selectedSector || !data.selectedSystem) {
			return;
		}

		explorer.setSystemLevel(
			{
				galaxyId: data.selectedGalaxy.id,
				sectorId: data.selectedSector.id,
				systemId: data.selectedSystem.id,
			},
			{
				x: data.selectedSystem.x,
				y: data.selectedSystem.y,
				zoom: ZOOM.system,
			},
		);
	}, [data.selectedGalaxy, data.selectedSector, data.selectedSystem, explorer]);

	const navigateToPlanet = useCallback(() => {
		if (
			!data.selectedGalaxy ||
			!data.selectedSector ||
			!data.selectedSystem ||
			!data.selectedPlanet
		) {
			return;
		}

		const livePosition = computeOrbitWorldPosition(
			{
				centerX: data.selectedSystem.x,
				centerY: data.selectedSystem.y,
				orbitRadius: data.selectedPlanet.orbitRadius,
				orbitPhaseRad: data.selectedPlanet.orbitPhaseRad,
				orbitAngularVelocityRadPerSec: data.selectedPlanet.orbitAngularVelocityRadPerSec,
				orbitEpochMs: data.systemData?.universe.orbitEpochMs ?? Date.now(),
			},
			Date.now(),
		);

		explorer.setPlanetLevel(
			{
				galaxyId: data.selectedGalaxy.id,
				sectorId: data.selectedSector.id,
				systemId: data.selectedSystem.id,
				planetId: data.selectedPlanet.id,
			},
			{
				x: livePosition.x,
				y: livePosition.y,
				zoom: ZOOM.planet,
			},
		);
	}, [
		data.selectedGalaxy,
		data.selectedPlanet,
		data.selectedSector,
		data.selectedSystem,
		data.systemData?.universe.orbitEpochMs,
		explorer,
	]);

	const sceneContent = (
		<>
			{explorer.level === "universe" ? (
				<LevelUniverse
					entities={data.galaxyEntities}
					hoveredId={hoveredId}
					quality={resolvedQuality}
					onHover={handleHover}
					onHoverEnd={clearHover}
					onSelect={handleUniverseEntitySelect}
				/>
			) : null}

			{explorer.level === "galaxy" ? (
				<LevelGalaxy
					entities={data.sectorEntities}
					hoveredId={hoveredId}
					quality={resolvedQuality}
					onHover={handleHover}
					onHoverEnd={clearHover}
					onSelect={handleGalaxyEntitySelect}
				/>
			) : null}

			{explorer.level === "sector" ? (
				<LevelSector
					entities={data.systemEntities}
					hoveredId={hoveredId}
					quality={resolvedQuality}
					onHover={handleHover}
					onHoverEnd={clearHover}
					onSelect={handleSectorEntitySelect}
				/>
			) : null}

			{explorer.level === "system" || explorer.level === "planet" ? (
				<LevelSystem
					entities={data.planetEntities}
					hoveredId={hoveredId}
					quality={resolvedQuality}
					selectedPlanetId={
						explorer.cameraLock.mode === "planet" ? explorer.cameraLock.planetId : undefined
					}
					starCenter={
						data.selectedSystem ? { x: data.selectedSystem.x, y: data.selectedSystem.y } : undefined
					}
					onHover={handleHover}
					onHoverEnd={clearHover}
					onSelect={handlePlanetEntitySelect}
				/>
			) : null}
		</>
	);

	const trackingOrbit = useMemo(() => {
		if (explorer.cameraLock.mode !== "planet" || !data.selectedSystem) {
			return null;
		}
		const lockedPlanetId = explorer.cameraLock.planetId;

		const lockedPlanet =
			data.systemData?.planets.find((planet) => planet.id === lockedPlanetId) ?? null;

		if (!lockedPlanet) {
			return null;
		}

		return {
			centerX: data.selectedSystem.x,
			centerY: data.selectedSystem.y,
			orbitRadius: lockedPlanet.orbitRadius,
			orbitPhaseRad: lockedPlanet.orbitPhaseRad,
			orbitAngularVelocityRadPerSec: lockedPlanet.orbitAngularVelocityRadPerSec,
			orbitEpochMs: data.systemData?.universe.orbitEpochMs ?? Date.now(),
		};
	}, [
		data.systemData?.planets,
		data.selectedSystem,
		data.systemData?.universe.orbitEpochMs,
		explorer.cameraLock,
	]);

	const handlePanWhileLocked = useCallback(() => {
		explorer.unlockCameraLock();
	}, [explorer]);

	const selectEntityForCurrentLevel = useCallback(
		(entity: RenderableEntity) => {
			if (explorer.level === "universe") {
				handleUniverseEntitySelect(entity);
				return;
			}
			if (explorer.level === "galaxy") {
				handleGalaxyEntitySelect(entity);
				return;
			}
			if (explorer.level === "sector") {
				handleSectorEntitySelect(entity);
				return;
			}
			handlePlanetEntitySelect(entity);
		},
		[
			explorer.level,
			handleGalaxyEntitySelect,
			handlePlanetEntitySelect,
			handleSectorEntitySelect,
			handleUniverseEntitySelect,
		],
	);

	const headerEntityItems = useMemo(
		() =>
			currentEntities.slice(0, 7).map((entity) => ({
				id: entity.id,
				label: entity.name,
				subtitle: entity.addressLabel,
			})),
		[currentEntities],
	);

	const headerPathItems = useMemo(() => {
		const pathItems: StarMapHeaderNavigation["pathItems"] = [
			{
				id: "universe",
				label: data.overview?.universe.name ?? "Universe",
				onSelect: navigateToUniverse,
			},
		];

		if (data.selectedGalaxy) {
			pathItems.push({
				id: data.selectedGalaxy.id,
				label: data.selectedGalaxy.displayName,
				onSelect: navigateToGalaxy,
			});
		}
		if (data.selectedSector) {
			pathItems.push({
				id: data.selectedSector.id,
				label: data.selectedSector.displayName,
				onSelect: navigateToSector,
			});
		}
		if (data.selectedSystem) {
			pathItems.push({
				id: data.selectedSystem.id,
				label: data.selectedSystem.displayName,
				onSelect: navigateToSystem,
			});
		}
		if (explorer.cameraLock.mode === "planet" && data.selectedPlanet) {
			pathItems.push({
				id: data.selectedPlanet.id,
				label: data.selectedPlanet.displayName,
				onSelect: navigateToPlanet,
			});
		}

		return pathItems;
	}, [
		data.overview?.universe.name,
		data.selectedGalaxy,
		data.selectedPlanet,
		data.selectedSector,
		data.selectedSystem,
		explorer.cameraLock.mode,
		navigateToGalaxy,
		navigateToPlanet,
		navigateToSector,
		navigateToSystem,
		navigateToUniverse,
	]);

	const handleHeaderNavSelect = useCallback(
		(entityId: string) => {
			const entity = currentEntities.find((candidate) => candidate.id === entityId);
			if (!entity) {
				return;
			}
			selectEntityForCurrentLevel(entity);
		},
		[currentEntities, selectEntityForCurrentLevel],
	);

	useEffect(() => {
		onHeaderNavigationChange({
			pathItems: headerPathItems,
			entityItems: headerEntityItems,
			levelLabel: displayedLevel,
			onExit: onClose,
			onSelectEntity: handleHeaderNavSelect,
			qualityPreset,
			onQualityPresetChange: setQualityPreset,
		});
	}, [
		displayedLevel,
		headerEntityItems,
		headerPathItems,
		handleHeaderNavSelect,
		qualityPreset,
		onClose,
		onHeaderNavigationChange,
		setQualityPreset,
	]);

	useEffect(() => {
		return () => {
			onHeaderNavigationChange(null);
		};
	}, [onHeaderNavigationChange]);

	return (
		<>
			<div className="fixed inset-0 z-0">
				<ExplorerCanvas
					antialias={antialiasEnabled}
					dpr={canvasDpr}
					focusTarget={explorer.focusTarget}
					cameraMode={explorer.cameraLock.mode === "planet" ? "followPlanet" : "free"}
					trackingOrbit={trackingOrbit}
					onPanWhileLocked={handlePanWhileLocked}
					maxFps={isOpen ? 60 : 10}
					onPointerMissed={clearHover}
					quality={resolvedQuality}
					sceneKey={explorer.level}
				>
					{sceneContent}
				</ExplorerCanvas>
			</div>

			<div
				className={cn(
					"pointer-events-none fixed inset-0 z-1 transition-all duration-500",
					isOpen ? "bg-[rgba(4,8,18,0.2)]" : "bg-[rgba(4,10,20,0.48)]",
				)}
			/>

			<HoverPanel hover={hover} />
		</>
	);
}
