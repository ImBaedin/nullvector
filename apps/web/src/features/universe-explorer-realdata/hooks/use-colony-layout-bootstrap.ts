import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { api } from "@nullvector/backend/convex/_generated/api";
import { useConvex, useQuery } from "convex/react";
import { useEffect, useRef } from "react";

import { useExplorerContext } from "../context/explorer-context";

const ZOOM = {
	planet: 2.8,
} as const;

export function useColonyLayoutBootstrap(args: {
	colonyId: Id<"colonies">;
	isAuthenticated: boolean;
}) {
	const convex = useConvex();
	const explorer = useExplorerContext();
	const prefetchedColonyIdsRef = useRef(new Set<string>());
	const initializedColonyIdRef = useRef<Id<"colonies"> | null>(null);
	const coordinates = useQuery(
		api.colonyNav.getColonyCoordinates,
		args.isAuthenticated ? { colonyId: args.colonyId } : "skip",
	);

	useEffect(() => {
		if (!args.isAuthenticated) {
			return;
		}

		if (prefetchedColonyIdsRef.current.has(args.colonyId)) {
			return;
		}
		prefetchedColonyIdsRef.current.add(args.colonyId);

		void Promise.allSettled([
			convex.query(api.colony.getColonySnapshot, {
				colonyId: args.colonyId,
			}),
			convex.query(api.colony.getColonySessionSnapshot, {
				colonyId: args.colonyId,
			}),
			convex.query(api.fleetV2.getFleetGarrison, {
				colonyId: args.colonyId,
			}),
			convex.query(api.fleetV2.getFleetOperationsForColony, {
				colonyId: args.colonyId,
			}),
		]);
	}, [args.colonyId, args.isAuthenticated, convex]);

	useEffect(() => {
		if (!coordinates) {
			return;
		}
		if (initializedColonyIdRef.current === args.colonyId) {
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
		initializedColonyIdRef.current = args.colonyId;
	}, [args.colonyId, coordinates, explorer]);

	return {
		coordinates,
	};
}
