import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { StarMapHeaderNavigation } from "@/features/game-ui/header/app-header";
import { cn } from "@/lib/utils";

import { ExplorerCanvas } from "./explorer-canvas";
import { HoverPanel } from "./hover-panel";
import { LevelGalaxy } from "./level-galaxy";
import { LevelSector } from "./level-sector";
import { LevelSystem } from "./level-system";
import { LevelUniverse } from "./level-universe";
import { useExplorerContext } from "../context/explorer-context";
import { useExplorerData } from "../hooks/use-explorer-data";
import { useExplorerQuality } from "../hooks/use-explorer-quality";
import { useColonyLayoutBootstrap } from "../hooks/use-colony-layout-bootstrap";
import { computeOrbitWorldPosition } from "../lib/orbits";
import type { HoverPanelState, RenderableEntity } from "../types";

import { useColonyStarMapPicker } from "@/features/colony-route/star-map-picker-context";

const ZOOM = {
	galaxy: 0.22,
	planet: 2.8,
	sector: 0.55,
	system: 1.9,
} as const;

export function ColonyStarMapLayer(props: {
	colonyId: Id<"colonies">;
	isAuthenticated: boolean;
	isOpen: boolean;
	onClose: () => void;
	onHeaderNavigationChange: (navigation: StarMapHeaderNavigation | null) => void;
}) {
	const { colonyId, isAuthenticated, isOpen, onClose, onHeaderNavigationChange } = props;
	const explorer = useExplorerContext();
	const { completeSelection, pickerRequest } = useColonyStarMapPicker();
	const data = useExplorerData();
	const { antialiasEnabled, canvasDpr, qualityPreset, resolvedQuality, setQualityPreset } =
		useExplorerQuality();
	useColonyLayoutBootstrap({
		colonyId,
		isAuthenticated,
	});
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const [hover, setHover] = useState<HoverPanelState | null>(null);
	const hoverRafRef = useRef<number | null>(null);
	const pendingHoverRef = useRef<HoverPanelState | null>(null);

	useEffect(() => {
		return () => {
			if (hoverRafRef.current !== null) {
				cancelAnimationFrame(hoverRafRef.current);
				hoverRafRef.current = null;
			}
		};
	}, []);

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
			hostility: entity.hostility,
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
		handleHeaderNavSelect,
		headerEntityItems,
		headerPathItems,
		onHeaderNavigationChange,
		onClose,
		qualityPreset,
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
