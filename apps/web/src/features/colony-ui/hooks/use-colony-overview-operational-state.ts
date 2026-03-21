import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { api } from "@nullvector/backend/convex/_generated/api";

import { useQuery } from "@/lib/convex-hooks";

export function useColonyOverviewOperationalState(colonyId: Id<"colonies"> | null) {
	return useQuery(
		api.colonyOverview.getColonyOverviewOperationalState,
		colonyId ? { colonyId } : "skip",
	);
}
