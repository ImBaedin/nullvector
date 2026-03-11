import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
	HoverPanelState,
	RenderableEntity,
} from "@/features/universe-explorer-realdata/types";

import { ExplorerBreadcrumbs } from "@/features/universe-explorer-realdata/components/explorer-breadcrumbs";
import { ExplorerCanvas } from "@/features/universe-explorer-realdata/components/explorer-canvas";
import { ExplorerLayout } from "@/features/universe-explorer-realdata/components/explorer-layout";
import { ExplorerQualityControl } from "@/features/universe-explorer-realdata/components/explorer-quality-control";
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

export const Route = createFileRoute("/universe-explorer-realdata")({
	component: UniverseExplorerRealDataRoute,
});

const ZOOM = {
	universe: 0.08,
	galaxy: 0.22,
	sector: 0.55,
	system: 1.9,
	planet: 2.8,
} as const;

function UniverseExplorerRealDataRoute() {
	return (
		<ExplorerProvider>
			<UniverseExplorerScene />
		</ExplorerProvider>
	);
}

function UniverseExplorerScene() {
	const explorer = useExplorerContext();
	const data = useExplorerData();
	const { antialiasEnabled, canvasDpr, qualityPreset, resolvedQuality, setQualityPreset } =
		useExplorerQuality();

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

	const clearHover = () => {
		setHoveredId(null);
		pendingHoverRef.current = null;
		setHover(null);
		if (hoverRafRef.current !== null) {
			cancelAnimationFrame(hoverRafRef.current);
			hoverRafRef.current = null;
		}
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
	const cameraLockLabel =
		explorer.cameraLock.mode === "planet"
			? (data.selectedPlanet?.displayName ?? "Locking...")
			: "None";

	const breadcrumbProps = useMemo(() => {
		const galaxy = data.selectedGalaxy
			? {
					id: data.selectedGalaxy.id,
					name: data.selectedGalaxy.displayName,
					x: data.selectedGalaxy.gx,
					y: data.selectedGalaxy.gy,
				}
			: undefined;

		const sector = data.selectedSector
			? {
					id: data.selectedSector.id,
					name: data.selectedSector.displayName,
					x: data.selectedSector.centerX,
					y: data.selectedSector.centerY,
				}
			: undefined;

		const system = data.selectedSystem
			? {
					id: data.selectedSystem.id,
					name: data.selectedSystem.displayName,
					x: data.selectedSystem.x,
					y: data.selectedSystem.y,
				}
			: undefined;

		const planet =
			explorer.cameraLock.mode === "planet" && data.selectedPlanet
				? (() => {
						if (data.selectedSystem) {
							const position = computeOrbitWorldPosition(
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

							return {
								id: data.selectedPlanet.id,
								name: data.selectedPlanet.displayName,
								x: position.x,
								y: position.y,
							};
						}

						return {
							id: data.selectedPlanet.id,
							name: data.selectedPlanet.displayName,
							x: data.selectedPlanet.orbitX,
							y: data.selectedPlanet.orbitY,
						};
					})()
				: undefined;

		return { galaxy, sector, system, planet };
	}, [
		data.selectedGalaxy,
		data.selectedPlanet,
		data.selectedSector,
		data.selectedSystem,
		data.systemData?.universe.orbitEpochMs,
		explorer.cameraLock,
	]);

	const currentEntities =
		explorer.level === "universe"
			? data.galaxyEntities
			: explorer.level === "galaxy"
				? data.sectorEntities
				: explorer.level === "sector"
					? data.systemEntities
					: data.planetEntities;

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

	const sidebar = (
		<div className="space-y-4">
			<div>
				<p className="text-[11px] tracking-[0.24em] text-cyan-200/85 uppercase">Real Data</p>
				<h1 className="mt-1 text-2xl font-semibold tracking-tight">Universe Explorer</h1>
				<p className="mt-2 text-sm text-slate-300/85">
					Isometric orthographic exploration of generated entities with drill navigation.
				</p>
			</div>

			<ExplorerBreadcrumbs {...breadcrumbProps} />

			<ExplorerQualityControl
				qualityPreset={qualityPreset}
				onQualityPresetChange={setQualityPreset}
			/>

			<div
				className="
      rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs
      text-slate-200
    "
			>
				<p>
					<span className="text-slate-400">Universe:</span>{" "}
					{data.overview?.universe.name ?? "Loading..."}
				</p>
				<p>
					<span className="text-slate-400">Level:</span> {displayedLevel}
				</p>
				<p>
					<span className="text-slate-400">Camera lock:</span> {cameraLockLabel}
				</p>
				<p>
					<span className="text-slate-400">Visible entities:</span> {currentEntities.length}
				</p>
			</div>

			<div>
				<h2 className="mb-2 text-xs tracking-[0.16em] text-slate-300 uppercase">
					Current Entities
				</h2>

				{data.isCurrentLevelLoading ? (
					<p className="text-sm text-slate-300/80">Loading current level...</p>
				) : currentEntities.length === 0 ? (
					<p className="text-sm text-slate-300/80">No entities found for this level.</p>
				) : (
					<div className="space-y-1">
						{currentEntities.map((entity) => (
							<button
								key={entity.id}
								className="
          flex w-full items-center justify-between rounded-sm border
          border-white/10 bg-white/5 px-2 py-1 text-left text-xs
          hover:bg-white/10
        "
								onMouseEnter={(event) => handleHover(entity, event.clientX, event.clientY)}
								onMouseLeave={clearHover}
								onMouseMove={(event) => handleHover(entity, event.clientX, event.clientY)}
								onClick={() => {
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
								}}
								type="button"
							>
								<span>{entity.name}</span>
								<span className="font-mono text-[10px] text-slate-400">{entity.addressLabel}</span>
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);

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

	return (
		<ExplorerLayout
			sidebar={sidebar}
			canvas={
				<ExplorerCanvas
					antialias={antialiasEnabled}
					dpr={canvasDpr}
					focusTarget={explorer.focusTarget}
					cameraMode={explorer.cameraLock.mode === "planet" ? "followPlanet" : "free"}
					trackingOrbit={trackingOrbit}
					onPanWhileLocked={handlePanWhileLocked}
					onPointerMissed={clearHover}
					quality={resolvedQuality}
					sceneKey={explorer.level}
				>
					{sceneContent}
				</ExplorerCanvas>
			}
			hoverPanel={<HoverPanel hover={hover} />}
		/>
	);
}
