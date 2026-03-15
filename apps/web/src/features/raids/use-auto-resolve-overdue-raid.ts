import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { api } from "@nullvector/backend/convex/_generated/api";
import { useEffect, useRef } from "react";

import { useMutation } from "@/lib/convex-hooks";

type ActiveRaid = {
	arriveAt: number;
	id: string;
};

export function useAutoResolveOverdueRaid(args: {
	activeRaid: ActiveRaid | null | undefined;
	colonyId: Id<"colonies"> | null;
	enabled: boolean;
}) {
	const resolveOverdueRaidForColony = useMutation(api.raids.resolveOverdueRaidForColony);
	const attemptedRaidIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (!args.enabled || !args.colonyId || !args.activeRaid) {
			attemptedRaidIdRef.current = null;
			return;
		}
		if (args.activeRaid.arriveAt > Date.now()) {
			if (attemptedRaidIdRef.current !== args.activeRaid.id) {
				attemptedRaidIdRef.current = null;
			}
			return;
		}
		if (attemptedRaidIdRef.current === args.activeRaid.id) {
			return;
		}

		attemptedRaidIdRef.current = args.activeRaid.id;
		void resolveOverdueRaidForColony({
			colonyId: args.colonyId,
		}).catch(() => {
			attemptedRaidIdRef.current = null;
		});
	}, [args.activeRaid, args.colonyId, args.enabled, resolveOverdueRaidForColony]);
}
