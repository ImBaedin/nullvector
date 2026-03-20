import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { api } from "@nullvector/backend/convex/_generated/api";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { ContextNavItem, ResourceDatum } from "@/features/game-ui/contracts/navigation";

import {
	useColonySessionSnapshot,
	useOptimisticColonyMutation,
} from "@/features/colony-state/hooks";
import { useColonyResources } from "@/hooks/use-colony-resources";
import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";

import { getHeaderConfig, parseColonyId } from "./header-config";

export type HeaderHudData = NonNullable<Parameters<typeof getHeaderConfig>[1]>;

function useCompactHeaderMode() {
	const [isCompact, setIsCompact] = useState(false);

	useEffect(() => {
		const onScroll = () => {
			setIsCompact(window.scrollY > 24);
		};

		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
		};
	}, []);

	return isCompact;
}

export function useHeaderData() {
	const navigate = useNavigate();
	const { isAuthenticated } = useConvexAuth();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const colonyId = parseColonyId(pathname);
	const colonyIdAsId = colonyId ? (colonyId as Id<"colonies">) : null;
	const renameColony = useOptimisticColonyMutation({
		intentFromArgs: (args: { colonyId: Id<"colonies">; name: string }) => ({
			name: args.name,
			type: "renameColony",
		}),
		mutation: api.colonyNav.renameColony,
	});
	const colonySession = useColonySessionSnapshot(
		colonyIdAsId && isAuthenticated ? colonyIdAsId : null,
	);
	const publicOverview = useQuery(
		api.colonyOverview.getColonyOverview,
		colonyIdAsId ? { colonyId: colonyIdAsId } : "skip",
	);
	const raidStatus = useQuery(
		api.raids.getRaidStatusForColony,
		colonyIdAsId && isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const colonyResources = useColonyResources(colonyIdAsId && isAuthenticated ? colonyIdAsId : null);
	const progressionOverview = useQuery(api.progression.getOverview, isAuthenticated ? {} : "skip");
	const syncQuestAvailability = useMutation(api.quests.syncAvailability);
	const notificationSummary = useQuery(
		api.notifications.getNotificationUnreadSummary,
		isAuthenticated ? {} : "skip",
	);
	const [isRenamingColony, setIsRenamingColony] = useState(false);
	const [isSavingColonyName, setIsSavingColonyName] = useState(false);
	const isCompact = useCompactHeaderMode();

	useEffect(() => {
		if (!isAuthenticated || !colonyIdAsId) {
			return;
		}

		void syncQuestAvailability({ activeColonyId: colonyIdAsId }).catch((error) => {
			toast.error(error instanceof Error ? error.message : "Failed to sync quests");
		});
	}, [colonyIdAsId, isAuthenticated, syncQuestAvailability]);

	const hud = useMemo<HeaderHudData | undefined>(() => {
		if (!colonySession || !colonyResources.hudResources) {
			return undefined;
		}

		return {
			activeColonyId: colonySession.activeColonyId,
			colonies: colonySession.colonies,
			resources: colonyResources.hudResources as ResourceDatum[],
			title: colonySession.title,
		};
	}, [colonyResources.hudResources, colonySession]);

	const config = useMemo(
		() =>
			getHeaderConfig(
				pathname,
				hud
					? {
							activeColonyId: hud.activeColonyId,
							colonies: hud.colonies,
							resources: hud.resources,
							title: hud.title,
						}
					: undefined,
				progressionOverview
					? {
							features: {
								overview: progressionOverview.features.overview,
								contracts: progressionOverview.features.contracts,
								defenses: progressionOverview.features.defenses,
								facilities: progressionOverview.features.facilities,
								fleet: progressionOverview.features.fleet,
								shipyard: progressionOverview.features.shipyard,
							},
						}
					: undefined,
			),
		[hud, pathname, progressionOverview],
	);

	const liveNotificationsCount = notificationSummary?.total ?? config.notificationsCount ?? 0;
	const contextTabs = useMemo<ContextNavItem[] | undefined>(() => {
		if (!config.contextTabs) {
			return undefined;
		}

		const baseTabs = config.contextTabs.map((tab) => {
			if (tab.id !== "defenses") {
				return tab;
			}
			if (!raidStatus?.activeRaid) {
				return tab;
			}

			return {
				...tab,
				icon: (
					<span className="relative inline-flex shrink-0">
						{tab.icon}
						<span
							className="
         absolute -top-0.5 -right-0.5 flex size-2.5 items-center justify-center
       "
						>
							<span
								className="
          absolute inline-flex size-2.5 animate-ping rounded-full bg-rose-400/35
        "
							/>
							<span
								className="
          relative inline-flex size-1.5 rounded-full bg-rose-300
          shadow-[0_0_8px_rgba(253,164,175,0.8)]
        "
							/>
						</span>
					</span>
				),
			};
		});
		if (publicOverview?.viewerRelation === "owner") {
			return baseTabs;
		}
		return baseTabs.map((tab) => ({
			...tab,
			isDisabled: tab.id !== "overview",
		}));
	}, [config.contextTabs, publicOverview?.viewerRelation, raidStatus?.activeRaid]);

	const drawerConfig = useMemo(
		() => ({
			...config,
			contextTabs,
			notificationsCount: liveNotificationsCount,
			onOpenNotifications: () => {
				// Handled by the header shell.
			},
			onOpenSettings: () => {
				// Handled by the header shell.
			},
		}),
		[config, contextTabs, liveNotificationsCount],
	);

	const activeColony = useMemo(
		() =>
			config.activeColonyId && config.colonies
				? (config.colonies.find((candidate) => candidate.id === config.activeColonyId) ?? null)
				: null,
		[config.activeColonyId, config.colonies],
	);
	const headerTitle = useMemo(() => {
		if (activeColony?.name) {
			return activeColony.name;
		}
		if (publicOverview?.header.name) {
			return publicOverview.header.name;
		}
		return (config.title ?? "Colony Operations").replace(/ Resources$/, "");
	}, [activeColony?.name, config.title, publicOverview?.header.name]);

	const commitColonyRename = useCallback(
		async (nextName: string) => {
			if (!activeColony || isSavingColonyName) {
				return;
			}

			const normalizedName = nextName.trim().replace(/\s+/g, " ");
			if (normalizedName.length < 3) {
				toast.error("Colony name must be at least 3 characters");
				return;
			}
			if (normalizedName.length > 40) {
				toast.error("Colony name must be 40 characters or fewer");
				return;
			}

			if (normalizedName === activeColony.name) {
				setIsRenamingColony(false);
				return;
			}

			setIsSavingColonyName(true);
			const error = await renameColony({
				colonyId: activeColony.id as Id<"colonies">,
				name: normalizedName,
			})
				.then(() => null)
				.catch((caughtError) => caughtError);
			setIsSavingColonyName(false);
			if (error) {
				toast.error(error instanceof Error ? error.message : "Failed to rename colony");
			} else {
				setIsRenamingColony(false);
				toast.success("Colony renamed");
			}
		},
		[activeColony, isSavingColonyName, renameColony],
	);

	const beginColonyRename = useCallback(() => {
		if (!activeColony) {
			return;
		}

		setIsRenamingColony(true);
	}, [activeColony]);

	const handleColonyChange = useCallback(
		(nextColonyId: string) => {
			navigate({
				to: "/game/colony/$colonyId",
				params: { colonyId: nextColonyId },
			});
		},
		[navigate],
	);

	return {
		activeColony,
		beginColonyRename,
		colonyIdAsId,
		colonySession,
		config,
		commitColonyRename,
		contextTabs,
		drawerConfig,
		headerTitle,
		isCompact,
		isRenamingColony,
		isSavingColonyName,
		liveNotificationsCount,
		progressionOverview,
		publicOverview,
		raidStatus,
		colonyResources,
		handleColonyChange,
		setIsRenamingColony,
	};
}
