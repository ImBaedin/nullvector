import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { useExplorerContext } from "../context/explorer-context";

type GalaxyCrumb = {
	id: Id<"galaxies">;
	name: string;
	x: number;
	y: number;
};

type SectorCrumb = {
	id: Id<"sectors">;
	name: string;
	x: number;
	y: number;
};

type SystemCrumb = {
	id: Id<"systems">;
	name: string;
	x: number;
	y: number;
};

type PlanetCrumb = {
	id: Id<"planets">;
	name: string;
	x: number;
	y: number;
};

type ExplorerBreadcrumbsProps = {
	galaxy?: GalaxyCrumb;
	sector?: SectorCrumb;
	system?: SystemCrumb;
	planet?: PlanetCrumb;
};

const ZOOM = {
	universe: 0.08,
	galaxy: 0.22,
	sector: 0.55,
	system: 1.9,
	planet: 2.8,
} as const;

function CrumbButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
	return (
		<button
			className="
     rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs
     text-slate-100 transition
     hover:bg-white/12
     disabled:opacity-50
   "
			disabled={!onClick}
			onClick={onClick}
			type="button"
		>
			{children}
		</button>
	);
}

export function ExplorerBreadcrumbs({ galaxy, sector, system, planet }: ExplorerBreadcrumbsProps) {
	const explorer = useExplorerContext();

	return (
		<div className="flex flex-wrap items-center gap-2">
			<CrumbButton onClick={() => explorer.setUniverseLevel({ x: 0, y: 0, zoom: ZOOM.universe })}>
				Universe
			</CrumbButton>

			{galaxy ? (
				<CrumbButton
					onClick={() =>
						explorer.setGalaxyLevel(galaxy.id, {
							x: galaxy.x,
							y: galaxy.y,
							zoom: ZOOM.galaxy,
						})
					}
				>
					{galaxy.name}
				</CrumbButton>
			) : null}

			{sector && explorer.path.galaxyId ? (
				<CrumbButton
					onClick={() =>
						explorer.setSectorLevel(
							{
								galaxyId: explorer.path.galaxyId!,
								sectorId: sector.id,
							},
							{
								x: sector.x,
								y: sector.y,
								zoom: ZOOM.sector,
							},
						)
					}
				>
					{sector.name}
				</CrumbButton>
			) : null}

			{system && explorer.path.galaxyId && explorer.path.sectorId ? (
				<CrumbButton
					onClick={() =>
						explorer.setSystemLevel(
							{
								galaxyId: explorer.path.galaxyId!,
								sectorId: explorer.path.sectorId!,
								systemId: system.id,
							},
							{
								x: system.x,
								y: system.y,
								zoom: ZOOM.system,
							},
						)
					}
				>
					{system.name}
				</CrumbButton>
			) : null}

			{planet && explorer.path.galaxyId && explorer.path.sectorId && explorer.path.systemId ? (
				<CrumbButton
					onClick={() =>
						explorer.setPlanetLevel(
							{
								galaxyId: explorer.path.galaxyId!,
								sectorId: explorer.path.sectorId!,
								systemId: explorer.path.systemId!,
								planetId: planet.id,
							},
							{
								x: planet.x,
								y: planet.y,
								zoom: ZOOM.planet,
							},
						)
					}
				>
					{planet.name}
				</CrumbButton>
			) : null}
		</div>
	);
}
