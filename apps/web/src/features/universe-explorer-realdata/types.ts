import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

export type ExplorerLevel = "universe" | "galaxy" | "sector" | "system" | "planet";

export type ExplorerEntityType = "galaxy" | "sector" | "system" | "planet";
export type ExplorerQualityPreset = "auto" | "low" | "medium" | "high";
export type ExplorerResolvedQuality = "low" | "medium" | "high";

export type ExplorerPathState = {
	galaxyId?: Id<"galaxies">;
	sectorId?: Id<"sectors">;
	systemId?: Id<"systems">;
	planetId?: Id<"planets">;
};

export type SectorHostilityInfo = {
	hostileFactionKey: "spacePirates" | "rogueAi";
	status: "hostile" | "cleared";
	hostilePlanetCount: number;
	clearedPlanetCount: number;
};

export type RenderableEntity = {
	id: string;
	sourceId: string;
	entityType: ExplorerEntityType;
	name: string;
	addressLabel: string;
	visualSeed?: string;
	hostility?: SectorHostilityInfo;
	colony?: {
		name: string;
		playerName: string;
	};
	x: number;
	y: number;
	sphereRadius: number;
	bounds?: {
		minX: number;
		maxX: number;
		minY: number;
		maxY: number;
	};
	orbit?: {
		centerX: number;
		centerY: number;
		orbitRadius: number;
		orbitPhaseRad: number;
		orbitAngularVelocityRadPerSec: number;
		orbitEpochMs: number;
	};
};

export type HoverCardData = {
	entityType: ExplorerEntityType;
	name: string;
	addressLabel: string;
	colonyName?: string;
	colonyPlayerName?: string;
	hostility?: SectorHostilityInfo;
};

export type HoverPanelState = HoverCardData & {
	screenX: number;
	screenY: number;
};

export type CameraFocusTarget = {
	x: number;
	y: number;
	zoom: number;
	key: number;
};

export type ExplorerCameraLock =
	| {
			mode: "free";
	  }
	| {
			mode: "planet";
			planetId: Id<"planets">;
	  };
