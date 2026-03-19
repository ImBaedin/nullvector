import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { useCallback } from "react";

import { useColonyDevConsole as useSharedColonyDevConsole } from "@/features/colony-ui/hooks/use-colony-dev-console";
import { useConvexAuth } from "@/lib/convex-hooks";

export function useColonyDevConsole(colonyId: Id<"colonies"> | null) {
	const { isAuthenticated } = useConvexAuth();
	const shared = useSharedColonyDevConsole(colonyId && isAuthenticated ? colonyId : null);

	const canShowDevUi = shared.canShowDevUi;
	const canUseDevConsole = shared.canUseDevConsole;
	const canToggleDevConsoleUi = colonyId !== null && isAuthenticated;

	const toggleDevConsoleUi = useCallback(
		async (enabled: boolean) => {
			if (!canUseDevConsole || !canToggleDevConsoleUi) {
				return;
			}

			await shared.actions.setUiEnabled(enabled);
		},
		[canToggleDevConsoleUi, canUseDevConsole, shared.actions],
	);

	const launchNpcRaid = useCallback(async () => {
		if (!colonyId || !canUseDevConsole) {
			return null;
		}

		return await shared.actions.triggerRaid();
	}, [canUseDevConsole, colonyId, shared.actions]);

	return {
		canShowDevUi,
		canToggleDevConsoleUi,
		canUseDevConsole,
		devConsoleState: shared.state,
		launchNpcRaid,
		toggleDevConsoleUi,
	};
}
