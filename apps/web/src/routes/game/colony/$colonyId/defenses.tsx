import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { api } from "@nullvector/backend/convex/_generated/api";
import { selectDefenseCatalog, type DefenseKey } from "@nullvector/game-logic";
import { HOSTILE_FACTIONS } from "@nullvector/game-logic";
import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Heart, Layers3, Package, Shield, ShieldAlert, Swords, X, Zap } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import {
	useColonySelectors,
	useColonySessionSnapshot,
	useOptimisticColonyMutation,
} from "@/features/colony-state/hooks";
import { getQueueableBuildActionPresentation } from "@/features/colony-ui/action-state";
import { ActionButton } from "@/features/colony-ui/components/action-button";
import { CostPill } from "@/features/colony-ui/components/cost-pill";
import { LockWarningPopover } from "@/features/colony-ui/components/lock-warning-popover";
import { QuantityStepper } from "@/features/colony-ui/components/quantity-stepper";
import { StatusBadge } from "@/features/colony-ui/components/status-badge";
import { getQueueProgress } from "@/features/colony-ui/queue-state";
import { formatColonyDuration } from "@/features/colony-ui/time";
import { useColonyResources } from "@/hooks/use-colony-resources";
import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";

import { ActivityTimelinePanel, type ActivityTimelineItem } from "./active-activity-panel";
import { DefensesRouteSkeleton } from "./loading-skeletons";

export const Route = createFileRoute("/game/colony/$colonyId/defenses")({
	component: DefensesRoute,
});

type DefensePresentation = {
	description: string;
	image: string;
};

type DefenseDisplay = {
	attack: number;
	buildSeconds: number;
	cost: { alloy: number; crystal: number; fuel: number };
	description: string;
	hull: number;
	image: string;
	isUnlocked: boolean;
	key: DefenseKey;
	name: string;
	owned: number;
	queued: number;
	requiredLevel: number;
	shield: number;
};

type DefenseQueueItem = {
	id: Id<"colonyQueueItems">;
	defenseKey: DefenseKey;
	defenseName: string;
	isActive: boolean;
	remaining: number;
	timeLeftSeconds: number;
	total: number;
};

type DefenseBuildQueueRow = {
	completesAt: number;
	id: Id<"colonyQueueItems">;
	kind: "defenseBuild";
	payload: {
		completedQuantity: number;
		defenseKey: DefenseKey;
		perUnitDurationSeconds: number;
		quantity: number;
	};
	startsAt?: number;
	status: "active" | "queued" | "completed" | "cancelled" | "failed";
};

type DefenseGroup = {
	keys: DefenseKey[];
	label: string;
};

const DEFENSE_PRESENTATION: Record<DefenseKey, DefensePresentation> = {
	missileBattery: {
		description: "Surface-to-orbit kinetic launcher for light interdiction and point defense.",
		image: "/game-icons/defenses/missile-battery.png",
	},
	laserTurret: {
		description: "Focused-beam emitter with rapid tracking for mid-range threat engagement.",
		image: "/game-icons/defenses/laser-turret.png",
	},
	gaussCannon: {
		description: "Electromagnetic siege rail delivering devastating long-range kinetic strikes.",
		image: "/game-icons/defenses/gauss-cannon.png",
	},
	shieldDome: {
		description: "Planetary barrier projector absorbing orbital bombardment across the colony.",
		image: "/game-icons/defenses/shield-dome.png",
	},
};

const DEFENSE_GROUPS: DefenseGroup[] = [
	{ label: "Light Defenses", keys: ["missileBattery", "laserTurret"] },
	{ label: "Heavy Ordnance", keys: ["gaussCannon"] },
	{ label: "Shield Systems", keys: ["shieldDome"] },
];

function isDefenseBuildQueueRow(item: {
	kind: string;
	payload: unknown;
}): item is DefenseBuildQueueRow {
	return (
		item.kind === "defenseBuild" &&
		typeof item.payload === "object" &&
		item.payload !== null &&
		"defenseKey" in item.payload
	);
}

function DefensesRoute() {
	const { colonyId } = Route.useParams();
	const colonyIdAsId = colonyId as Id<"colonies">;
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

	const defenseCatalog = useMemo(() => selectDefenseCatalog(), []);
	const colonySelectors = useColonySelectors(isAuthenticated ? colonyIdAsId : null);
	const colonySession = useColonySessionSnapshot(isAuthenticated ? colonyIdAsId : null);
	const raidStatus = useQuery(
		api.raids.getRaidStatusForColony,
		isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const devConsoleState = useQuery(
		api.devConsole.getDevConsoleState,
		isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const colonyResources = useColonyResources(isAuthenticated ? colonyIdAsId : null);
	const enqueueDefenseBuild = useOptimisticColonyMutation({
		intentFromArgs: (args: {
			colonyId: Id<"colonies">;
			defenseKey: DefenseKey;
			quantity: number;
		}) => ({
			defenseKey: args.defenseKey,
			quantity: args.quantity,
			type: "enqueueDefenseBuild",
		}),
		mutation: api.defenses.enqueueDefenseBuild,
	});
	const cancelDefenseQueueItem = useOptimisticColonyMutation({
		intentFromArgs: (args: { colonyId: Id<"colonies">; queueItemId: Id<"colonyQueueItems"> }) => ({
			queueItemId: args.queueItemId,
			type: "cancelDefenseBuild",
		}),
		mutation: api.defenses.cancelDefenseQueueItem,
	});
	const completeActiveQueueItem = useMutation(api.devConsole.completeActiveQueueItem);
	const setDefenseCounts = useMutation(api.devConsole.setDefenseCounts);
	const completeActiveRaidAtCurrentColony = useMutation(
		api.devConsole.completeActiveRaidAtCurrentColony,
	);

	const [quantities, setQuantities] = useState<Partial<Record<DefenseKey, number>>>({});
	const [quantityInputs, setQuantityInputs] = useState<Partial<Record<DefenseKey, string>>>({});
	const [queueingDefenseKey, setQueueingDefenseKey] = useState<DefenseKey | null>(null);
	const [editingDefenseKey, setEditingDefenseKey] = useState<DefenseKey | null>(null);
	const [defenseDraftValue, setDefenseDraftValue] = useState("");
	const [savingDefenseKey, setSavingDefenseKey] = useState<DefenseKey | null>(null);
	const [cancelingQueueItemId, setCancelingQueueItemId] = useState<Id<"colonyQueueItems"> | null>(
		null,
	);
	const [isCompletingQueueItem, setIsCompletingQueueItem] = useState(false);
	const [isCompletingRaid, setIsCompletingRaid] = useState(false);
	const [expandedRaidId, setExpandedRaidId] = useState<string | null>(null);

	const canShowDevUi = devConsoleState?.showDevConsoleUi === true;
	const canUseDevConsole = devConsoleState?.canUseDevConsole === true;

	const nowMs = colonyResources.nowMs;

	const view = useMemo(() => {
		if (!colonySelectors) {
			return undefined;
		}

		const stateByDefenseKey = new Map(
			colonySelectors.defenseState.defenseStates.map((state) => [state.key, state]),
		);
		const defenses = defenseCatalog.map((defense) => {
			const state = stateByDefenseKey.get(defense.key);
			const presentation = DEFENSE_PRESENTATION[defense.key];

			return {
				attack: defense.attack,
				buildSeconds: state?.perUnitDurationSeconds ?? 0,
				cost: defense.cost,
				description: presentation.description,
				hull: defense.hull,
				image: presentation.image,
				isUnlocked: state?.isUnlocked ?? false,
				key: defense.key,
				name: defense.name,
				owned: state?.owned ?? 0,
				queued: state?.queued ?? 0,
				requiredLevel: defense.requiredDefenseGridLevel,
				shield: defense.shield,
			} satisfies DefenseDisplay;
		});

		return {
			colonyId: colonySelectors.defenseState.colonyId,
			defenseGridLevel: colonySelectors.defenseState.defenseGridLevel,
			defenses,
			lane: colonySelectors.defenseState.lane,
		};
	}, [colonySelectors, defenseCatalog]);

	const defensesByKey = useMemo(
		() => new Map((view?.defenses ?? []).map((defense) => [defense.key, defense])),
		[view?.defenses],
	);

	const queueItems = useMemo(() => {
		const laneItems = [
			...(view?.lane.activeItem ? [view.lane.activeItem] : []),
			...(view?.lane.pendingItems ?? []),
		];

		const items: DefenseQueueItem[] = [];
		for (const item of laneItems) {
			if (!isDefenseBuildQueueRow(item)) {
				continue;
			}

			const defense = defensesByKey.get(item.payload.defenseKey);
			items.push({
				defenseKey: item.payload.defenseKey,
				defenseName: defense?.name ?? item.payload.defenseKey,
				id: item.id,
				isActive: item.status === "active",
				remaining: Math.max(0, item.payload.quantity - item.payload.completedQuantity),
				timeLeftSeconds: Math.max(0, Math.ceil((item.completesAt - nowMs) / 1_000)),
				total: item.payload.quantity,
			});
		}

		return items;
	}, [defensesByKey, nowMs, view]);

	const activeQueueItem = queueItems.find((item) => item.isActive) ?? null;
	const pendingQueueItems = queueItems.filter((item) => !item.isActive);
	const queueItemsCount = queueItems.length;
	const activeRawItem =
		view?.lane.activeItem && isDefenseBuildQueueRow(view.lane.activeItem)
			? view.lane.activeItem
			: null;
	const activeUpgradeProgress = activeRawItem
		? getQueueProgress(nowMs, activeRawItem.startsAt, activeRawItem.completesAt).percent
		: 0;

	const availableResources = colonyResources.projected?.stored;
	const totalOwned = view?.defenses.reduce((sum, defense) => sum + defense.owned, 0) ?? 0;
	const totalQueued = view?.defenses.reduce((sum, defense) => sum + defense.queued, 0) ?? 0;
	const totalAttack =
		view?.defenses.reduce((sum, defense) => sum + defense.attack * defense.owned, 0) ?? 0;
	const totalShield =
		view?.defenses.reduce((sum, defense) => sum + defense.shield * defense.owned, 0) ?? 0;
	const totalHull =
		view?.defenses.reduce((sum, defense) => sum + defense.hull * defense.owned, 0) ?? 0;
	const totalPower = totalAttack + totalShield + totalHull;
	const activeColonyNav = useMemo(
		() =>
			colonySession?.colonies.find((colony) => colony.id === colonyIdAsId) ?? {
				addressLabel: undefined,
				name: "Planetary Defenses",
			},
		[colonyIdAsId, colonySession?.colonies],
	);
	const incomingRaidItems = useMemo(() => {
		if (!raidStatus?.activeRaid) {
			return [];
		}

		const activeRaid = raidStatus.activeRaid;
		const totalDuration = Math.max(1, activeRaid.arriveAt - activeRaid.departAt);
		const elapsed = Math.max(0, nowMs - activeRaid.departAt);
		const progress = Math.min(100, (elapsed / totalDuration) * 100);
		const etaSeconds = Math.max(0, Math.ceil((activeRaid.arriveAt - nowMs) / 1_000));
		const faction = HOSTILE_FACTIONS[activeRaid.hostileFactionKey];
		const shipSummary = Object.entries(activeRaid.attackerFleet)
			.filter(([, count]) => count > 0)
			.map(([shipKey, count]) => `${count}x ${shipKey}`)
			.join(", ");

		return [
			{
				actions:
					canShowDevUi && canUseDevConsole
						? [
								<button
									className="
           rounded-md border border-cyan-300/20 bg-cyan-400/8 px-2 py-1
           text-[10px] font-medium text-cyan-100 transition-colors
           hover:border-cyan-200/35 hover:bg-cyan-400/12
           disabled:cursor-not-allowed disabled:opacity-50
         "
									disabled={isCompletingRaid}
									key="complete-raid"
									onClick={(event) => {
										event.stopPropagation();
										setIsCompletingRaid(true);
										void completeActiveRaidAtCurrentColony({
											colonyId: colonyIdAsId,
										})
											.then(() => {
												toast.success("Active raid completed");
											})
											.catch((error) => {
												toast.error(
													error instanceof Error ? error.message : "Failed to complete active raid",
												);
											})
											.finally(() => {
												setIsCompletingRaid(false);
											});
									}}
									type="button"
								>
									{isCompletingRaid ? "..." : "Complete"}
								</button>,
							]
						: undefined,
				detailChips: [
					<div
						className="
        rounded-sm border border-amber-300/20 bg-amber-300/10 px-1.5 py-0.5
        text-[9px] font-semibold text-amber-100/80 uppercase
      "
						key="relation"
					>
						incoming
					</div>,
					<div className="flex items-center gap-1" key="tier">
						<Swords className="size-3" />
						Tier {activeRaid.difficultyTier} raid
					</div>,
					shipSummary ? (
						<div className="flex items-center gap-1" key="fleet">
							<Package className="size-3" />
							{shipSummary}
						</div>
					) : null,
				].filter(Boolean),
				dotClassName: "bg-rose-400",
				etaLabel: formatColonyDuration(etaSeconds, "seconds"),
				id: activeRaid.id,
				kindBadgeClassName: "bg-rose-400/12 text-rose-200/80",
				kindLabel: "Raid",
				origin: {
					icon: <Swords className="size-4 text-rose-300" />,
					iconContainerClassName: "border-rose-300/25 bg-rose-400/10",
					subtitle: "Hostile fleet",
					title: faction.displayName,
				},
				progress,
				progressBarClassName: "bg-rose-400/50",
				relationBadgeClassName: "border border-amber-300/20 bg-amber-300/10 text-amber-100/80",
				relationLabel: "incoming",
				statusLabel: "inTransit",
				summaryLabel: `${faction.displayName} raid`,
				target: {
					icon: <ShieldAlert className="size-4 text-amber-300" />,
					iconContainerClassName: "border-amber-300/25 bg-amber-400/10",
					subtitle: activeColonyNav.addressLabel,
					title: activeColonyNav.name,
				},
				transitIcon: <Swords className="size-3 text-rose-300" />,
				transitIconBorderClassName: "border-rose-300",
				transitIconFillClassName: "bg-rose-400/20 shadow-rose-400/30",
				transitLineClassName: "bg-linear-to-r from-rose-400/60 to-rose-400/20",
			},
		];
	}, [
		activeColonyNav.addressLabel,
		activeColonyNav.name,
		canShowDevUi,
		canUseDevConsole,
		colonyIdAsId,
		completeActiveRaidAtCurrentColony,
		isCompletingRaid,
		nowMs,
		raidStatus?.activeRaid,
	]);
	const nextRaidEtaSeconds =
		raidStatus?.activeRaid || !raidStatus?.nextNpcRaidAt
			? null
			: Math.max(0, Math.ceil((raidStatus.nextNpcRaidAt - nowMs) / 1_000));

	function updateQuantity(defenseKey: DefenseKey, value: number) {
		setQuantities((current) => ({ ...current, [defenseKey]: value }));
		setQuantityInputs((current) => ({ ...current, [defenseKey]: String(value) }));
	}

	function handleDecrementQuantity(defenseKey: DefenseKey, currentQuantity: number) {
		updateQuantity(defenseKey, Math.max(1, currentQuantity - 1));
	}

	function handleIncrementQuantity(defenseKey: DefenseKey, currentQuantity: number) {
		updateQuantity(defenseKey, Math.min(10_000, currentQuantity + 1));
	}

	function handleQuantityInputChange(defenseKey: DefenseKey, raw: string) {
		if (!/^\d*$/.test(raw)) {
			return;
		}

		setQuantityInputs((current) => ({ ...current, [defenseKey]: raw }));
		if (raw === "") {
			return;
		}

		const parsed = Number(raw);
		if (!Number.isFinite(parsed)) {
			return;
		}

		setQuantities((current) => ({
			...current,
			[defenseKey]: Math.max(1, Math.min(10_000, parsed)),
		}));
	}

	function handleQuantityBlur(defenseKey: DefenseKey, currentQuantity: number) {
		const raw = quantityInputs[defenseKey];
		const parsed = Number(raw);
		const normalized =
			raw && Number.isFinite(parsed) ? Math.max(1, Math.min(10_000, parsed)) : currentQuantity;
		updateQuantity(defenseKey, normalized);
	}

	function handleQueueDefense(defense: DefenseDisplay, quantity: number) {
		setQueueingDefenseKey(defense.key);
		enqueueDefenseBuild({
			colonyId: colonyIdAsId,
			defenseKey: defense.key,
			quantity,
		})
			.then((result) => {
				toast.success(
					result.status === "active"
						? `${defense.name} build started`
						: `${defense.name} build queued`,
				);
			})
			.catch((error) => {
				toast.error(error instanceof Error ? error.message : "Failed to queue defense build");
			})
			.finally(() => {
				setQueueingDefenseKey(null);
			});
	}

	function handleCancel(queueItemId: Id<"colonyQueueItems">) {
		setCancelingQueueItemId(queueItemId);
		cancelDefenseQueueItem({
			colonyId: colonyIdAsId,
			queueItemId,
		})
			.then((result) => {
				const resourceLabel = `${result.refunded.alloy.toLocaleString()} alloy, ${result.refunded.crystal.toLocaleString()} crystal, ${result.refunded.fuel.toLocaleString()} fuel`;
				toast.success(
					`Cancelled ${result.cancelledRemainingQuantity.toLocaleString()} defense(s); refunded ${resourceLabel}.`,
				);
			})
			.catch((error) => {
				toast.error(error instanceof Error ? error.message : "Failed to cancel defense build");
			})
			.finally(() => {
				setCancelingQueueItemId(null);
			});
	}

	const commitDefenseCount = useCallback(
		async (defenseKey: DefenseKey) => {
			if (!canShowDevUi || !canUseDevConsole) {
				return;
			}

			const parsed = Math.max(0, Math.floor(Number(defenseDraftValue) || 0));
			setSavingDefenseKey(defenseKey);
			await setDefenseCounts({
				colonyId: colonyIdAsId,
				defenseCounts: {
					[defenseKey]: parsed,
				},
			})
				.then(() => {
					toast.success("Defense count updated");
					setEditingDefenseKey(null);
				})
				.catch((error) => {
					toast.error(error instanceof Error ? error.message : "Failed to update defense count");
				})
				.finally(() => {
					setSavingDefenseKey(null);
				});
		},
		[canShowDevUi, canUseDevConsole, colonyIdAsId, defenseDraftValue, setDefenseCounts],
	);

	async function handleCompleteActiveQueue() {
		if (!canShowDevUi || !devConsoleState?.canUseDevConsole || isCompletingQueueItem) {
			return;
		}

		setIsCompletingQueueItem(true);
		await completeActiveQueueItem({
			colonyId: colonyIdAsId,
			lane: "defense",
		})
			.then(() => {
				toast.success("Active defense build completed");
			})
			.catch((error) => {
				toast.error(error instanceof Error ? error.message : "Failed to complete defense build");
			})
			.finally(() => {
				setIsCompletingQueueItem(false);
			});
	}

	if (
		isAuthLoading ||
		(isAuthenticated && (!view || colonyResources.isLoading || !colonyResources.projected))
	) {
		return <DefensesRouteSkeleton />;
	}

	if (!view || !availableResources) {
		return (
			<div className="mx-auto w-full max-w-[1440px] px-4 py-8 text-white/80">
				Unable to load defenses. Please sign in again.
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-[1440px] px-4 pt-4 pb-12 text-white">
			<div
				className="
      grid gap-5
      lg:grid-cols-[minmax(0,1fr)_450px]
    "
			>
				<div className="space-y-5">
					<div
						className="
        relative overflow-hidden rounded-2xl border border-white/10
        bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,18,0.96))] p-4
      "
					>
						<div
							className="
         pointer-events-none absolute -top-12 -right-12 size-48 rounded-full
         blur-3xl
       "
							style={{ background: "rgba(251,113,133,0.05)" }}
						/>

						<div className="relative z-10">
							<div className="flex items-center justify-between gap-3">
								<div className="flex items-center gap-3">
									<div
										className="
            flex size-8 items-center justify-center rounded-lg border
            border-rose-300/25 bg-rose-400/8
          "
									>
										<ShieldAlert className="size-4 text-rose-300" />
									</div>
									<div>
										<h1 className="font-(family-name:--nv-font-display) text-lg font-bold">
											Planetary Defenses
										</h1>
										<p className="text-[10px] text-white/40">
											Defense Grid Lv {view.defenseGridLevel} • {totalOwned} deployed
											{totalQueued > 0 ? ` • ${totalQueued} in queue` : ""}
										</p>
									</div>
								</div>
								<div className="text-right">
									<p
										className="
            font-(family-name:--nv-font-mono) text-lg font-bold text-rose-200
          "
									>
										{totalPower.toLocaleString()}
									</p>
									<p className="text-[8px] tracking-widest text-white/30 uppercase">
										Defense Power
									</p>
								</div>
							</div>

							<PowerSplitBar
								totalAttack={totalAttack}
								totalHull={totalHull}
								totalShield={totalShield}
							/>
						</div>
					</div>

					<section
						className="
        overflow-hidden rounded-2xl border border-l-4 border-white/10
        border-l-rose-400/50
        bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,18,0.96))]
      "
						style={{
							animation: "nv-resource-card-in 400ms cubic-bezier(0.21,1,0.34,1) both",
						}}
					>
						<div
							className="
         flex flex-wrap items-center justify-between gap-2 px-4 py-3
         sm:px-5
       "
						>
							<div className="flex items-center gap-2.5">
								<span className="text-white/50">
									<Shield className="size-4" strokeWidth={2.2} />
								</span>
								<div>
									<h2 className="font-(family-name:--nv-font-display) text-sm font-bold">
										Defense Catalog
									</h2>
									<p className="mt-0.5 text-[10px] text-white/35">
										Commission planetary defense emplacements from the grid.
									</p>
								</div>
							</div>
							<span
								className="
          rounded-md border border-white/10 bg-white/3 px-2 py-0.5
          font-(family-name:--nv-font-mono) text-[9px] font-semibold
          text-white/50
        "
							>
								{view.defenses.length} types
							</span>
						</div>

						<div
							className="
         border-t border-white/6 p-3
         sm:p-4
       "
						>
							<div className="space-y-5">
								{DEFENSE_GROUPS.map((group) => {
									const groupDefenses = group.keys
										.map((key) => view.defenses.find((defense) => defense.key === key))
										.filter((defense): defense is DefenseDisplay => defense != null);
									if (groupDefenses.length === 0) {
										return null;
									}

									return (
										<div key={group.label}>
											<p
												className="
              mb-2 text-[10px] font-semibold tracking-[0.14em] text-white/35
              uppercase
            "
											>
												{group.label}
											</p>
											<div className="space-y-2">
												{groupDefenses.map((defense, index) => {
													const quantity = quantities[defense.key] ?? 1;
													return (
														<DefenseCard
															availableResources={availableResources}
															canShowDevUi={canShowDevUi}
															canUseDevConsole={canUseDevConsole}
															defense={defense}
															editingDefenseKey={editingDefenseKey}
															index={index}
															isQueueFull={view.lane.isFull}
															isQueueing={queueingDefenseKey === defense.key}
															isSavingDefenseCount={savingDefenseKey === defense.key}
															key={defense.key}
															onDecrementQuantity={handleDecrementQuantity}
															onEditDefense={(defenseKey, currentCount) => {
																setEditingDefenseKey(defenseKey);
																setDefenseDraftValue(String(currentCount));
															}}
															onIncrementQuantity={handleIncrementQuantity}
															onQuantityBlur={handleQuantityBlur}
															onQuantityInputChange={handleQuantityInputChange}
															onQueueDefense={handleQueueDefense}
															onDefenseDraftCancel={() => {
																setEditingDefenseKey(null);
															}}
															onDefenseDraftChange={setDefenseDraftValue}
															onDefenseDraftCommit={(defenseKey) => {
																void commitDefenseCount(defenseKey);
															}}
															quantity={quantity}
															quantityInput={quantityInputs[defense.key] ?? String(quantity)}
															defenseDraftValue={defenseDraftValue}
														/>
													);
												})}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					</section>
				</div>

				<div
					className="
       space-y-5
       lg:sticky lg:top-4 lg:self-start
     "
				>
					<IncomingRaidPanel
						emptyMessage={
							nextRaidEtaSeconds != null
								? `No active raid. Next threat window in ${formatColonyDuration(nextRaidEtaSeconds, "seconds")}.`
								: "No incoming raids detected."
						}
						expandedRaidId={expandedRaidId}
						items={incomingRaidItems}
						onToggleRaid={(raidId) => {
							setExpandedRaidId((current) => (current === raidId ? null : raidId));
						}}
					/>
					<DefenseQueuePanel
						activeQueueItem={activeQueueItem}
						activeUpgradeProgress={activeUpgradeProgress}
						canShowDevUi={canShowDevUi}
						cancelingQueueItemId={cancelingQueueItemId}
						isCompletingQueueItem={isCompletingQueueItem}
						onCancelQueueItem={handleCancel}
						onCompleteActiveQueueItem={() => {
							void handleCompleteActiveQueue();
						}}
						pendingQueueItems={pendingQueueItems}
						queueItemsCount={queueItemsCount}
					/>
				</div>
			</div>
		</div>
	);
}

function DefenseCard(props: {
	availableResources: { alloy: number; crystal: number; fuel: number };
	canShowDevUi: boolean;
	canUseDevConsole: boolean;
	defense: DefenseDisplay;
	defenseDraftValue: string;
	editingDefenseKey: DefenseKey | null;
	index: number;
	isQueueFull: boolean;
	isQueueing: boolean;
	isSavingDefenseCount: boolean;
	onDecrementQuantity: (defenseKey: DefenseKey, currentQuantity: number) => void;
	onDefenseDraftCancel: () => void;
	onDefenseDraftChange: (raw: string) => void;
	onDefenseDraftCommit: (defenseKey: DefenseKey) => void;
	onEditDefense: (defenseKey: DefenseKey, currentCount: number) => void;
	onIncrementQuantity: (defenseKey: DefenseKey, currentQuantity: number) => void;
	onQuantityBlur: (defenseKey: DefenseKey, currentQuantity: number) => void;
	onQuantityInputChange: (defenseKey: DefenseKey, raw: string) => void;
	onQueueDefense: (defense: DefenseDisplay, quantity: number) => void;
	quantity: number;
	quantityInput: string;
}) {
	const {
		availableResources,
		canShowDevUi,
		canUseDevConsole,
		defense,
		defenseDraftValue,
		editingDefenseKey,
		index,
		isQueueFull,
		isQueueing,
		isSavingDefenseCount,
		onDecrementQuantity,
		onDefenseDraftCancel,
		onDefenseDraftChange,
		onDefenseDraftCommit,
		onEditDefense,
		onIncrementQuantity,
		onQuantityBlur,
		onQuantityInputChange,
		onQueueDefense,
		quantity,
		quantityInput,
	} = props;
	const isLocked = !defense.isUnlocked;
	const availability = getQueueableBuildActionPresentation({
		actionQuantity: quantity,
		availableResources,
		cost: defense.cost,
		isBusy: isQueueing,
		isLocked,
		isQueueFull,
		lockMessage: `Requires Defense Grid Level ${defense.requiredLevel}.`,
		queuedCount: defense.queued,
	});

	return (
		<article
			className={`
     group relative overflow-hidden rounded-xl border
     ${isLocked ? `border-white/8 opacity-60 grayscale` : `border-white/10`}
     bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,16,0.95))]
     text-[13px]
   `}
			style={{
				animation: "nv-resource-card-in 380ms cubic-bezier(0.21,1,0.34,1) both",
				animationDelay: `${120 + index * 40}ms`,
			}}
		>
			<div
				className="pointer-events-none absolute inset-x-0 top-0 h-px"
				style={{
					background: "linear-gradient(90deg, transparent, rgba(251,113,133,0.5), transparent)",
				}}
			/>

			<div
				className="
      relative z-10 p-3
      sm:p-4
    "
			>
				<div className="flex items-center gap-3">
					<img
						alt={defense.name}
						className="
        size-10 shrink-0 rounded-lg border border-white/8 bg-black/30
        object-contain p-1
      "
						src={defense.image}
					/>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<h3 className="font-(family-name:--nv-font-display) text-sm font-bold">
								{defense.name}
							</h3>
							<StatusBadge compact label={availability.badgeLabel} tone={availability.badgeTone} />
							{availability.lockMessage ? (
								<LockWarningPopover message={availability.lockMessage} />
							) : null}
						</div>
						<p className="mt-0.5 text-[11px] leading-snug text-white/40">{defense.description}</p>
					</div>
					{canShowDevUi && editingDefenseKey === defense.key ? (
						<input
							className="
         inline-flex h-7 w-14 shrink-0 items-center justify-center rounded-md
         border border-rose-300/35 bg-black/45 px-1 text-center
         font-(family-name:--nv-font-mono) text-[10px] font-bold text-rose-100
         outline-none
         focus:border-rose-200/60
       "
							inputMode="numeric"
							onBlur={onDefenseDraftCancel}
							onChange={(event) => {
								onDefenseDraftChange(event.target.value.replace(/[^\d]/g, ""));
							}}
							onKeyDown={(event) => {
								if (event.key === "Escape") {
									onDefenseDraftCancel();
									return;
								}
								if (event.key === "Enter") {
									event.preventDefault();
									onDefenseDraftCommit(defense.key);
								}
							}}
							value={defenseDraftValue}
						/>
					) : canShowDevUi ? (
						<button
							className="
         inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md
         border border-rose-300/20 bg-rose-400/8 px-1.5
         font-(family-name:--nv-font-mono) text-[10px] font-bold text-rose-100
         transition
         hover:border-rose-200/45 hover:bg-rose-400/14
         disabled:cursor-not-allowed disabled:opacity-50
       "
							disabled={!canUseDevConsole || isSavingDefenseCount}
							onClick={() => onEditDefense(defense.key, defense.owned)}
							type="button"
						>
							{defense.owned}
						</button>
					) : (
						<span
							className="
         inline-flex size-7 shrink-0 items-center justify-center rounded-md
         border border-white/15 bg-black/25 font-(family-name:--nv-font-mono)
         text-[11px] font-bold text-white/80
       "
						>
							{defense.owned}
						</span>
					)}
				</div>

				<div
					className="
       mt-3 flex flex-wrap items-end gap-x-4 gap-y-2 border-t border-white/6
       pt-3
     "
				>
					<div className="flex gap-3 text-[10px]">
						<ColorStatMini
							color="text-red-300/80"
							label="ATK"
							value={defense.attack.toLocaleString()}
						/>
						<ColorStatMini
							color="text-blue-300/80"
							label="SHD"
							value={defense.shield.toLocaleString()}
						/>
						<ColorStatMini
							color="text-amber-300/80"
							label="HULL"
							value={defense.hull.toLocaleString()}
						/>
						<ColorStatMini
							color="text-white/75"
							label="Build"
							value={formatColonyDuration(defense.buildSeconds, "seconds")}
						/>
					</div>

					<div className="flex gap-1">
						<CostPill amount={defense.cost.alloy * quantity} kind="alloy" label="Alloy" />
						<CostPill amount={defense.cost.crystal * quantity} kind="crystal" label="Crystal" />
						{defense.cost.fuel > 0 ? (
							<CostPill amount={defense.cost.fuel * quantity} kind="fuel" label="Fuel" />
						) : null}
					</div>

					<div className="ml-auto flex items-center gap-2">
						<QuantityStepper
							canEdit={!isLocked && !isQueueing}
							max={10_000}
							min={1}
							onBlur={() => {
								onQuantityBlur(defense.key, quantity);
							}}
							onChange={(value) => {
								onQuantityInputChange(defense.key, value);
							}}
							onDecrement={() => {
								onDecrementQuantity(defense.key, quantity);
							}}
							onIncrement={() => {
								onIncrementQuantity(defense.key, quantity);
							}}
							quantity={quantity}
							value={quantityInput}
						/>

						<ActionButton
							className="px-3 py-1.5 text-[11px]"
							disabled={!availability.isActionEnabled}
							label={availability.buttonLabel}
							leadingIcon={<Zap className="size-3" />}
							loading={isQueueing}
							onClick={() => {
								onQueueDefense(defense, quantity);
							}}
							tone="defense"
						/>
					</div>
				</div>
			</div>
		</article>
	);
}

function ColorStatMini(props: { color: string; label: string; value: string }) {
	return (
		<div>
			<span className="text-[8px] tracking-wider text-white/30 uppercase">{props.label}</span>
			<p className={`
     font-(family-name:--nv-font-mono) font-bold
     ${props.color}
   `}>{props.value}</p>
		</div>
	);
}

function PowerSplitBar(props: { totalAttack: number; totalHull: number; totalShield: number }) {
	const { totalAttack, totalShield, totalHull } = props;
	const total = totalAttack + totalShield + totalHull;
	const attackPct = total > 0 ? (totalAttack / total) * 100 : 33.3;
	const shieldPct = total > 0 ? (totalShield / total) * 100 : 33.3;
	const hullPct = total > 0 ? (totalHull / total) * 100 : 33.4;

	const segments = [
		{
			color: "text-red-400",
			bg: "bg-red-400/60",
			icon: <Swords className="size-3" />,
			label: "ATK",
			value: totalAttack,
			pct: attackPct,
		},
		{
			color: "text-blue-400",
			bg: "bg-blue-400/60",
			icon: <Shield className="size-3" />,
			label: "SHD",
			value: totalShield,
			pct: shieldPct,
		},
		{
			color: "text-amber-400",
			bg: "bg-amber-400/60",
			icon: <Heart className="size-3" />,
			label: "HULL",
			value: totalHull,
			pct: hullPct,
		},
	];

	return (
		<div className="mt-4">
			<div className="flex h-2.5 overflow-hidden rounded-full bg-white/8">
				{segments.map((seg) => (
					<div className={`
       h-full
       ${seg.bg}
       transition-all
     `} key={seg.label} style={{ width: `${seg.pct}%` }} />
				))}
			</div>
			<div className="mt-2 flex">
				{segments.map((seg) => (
					<div className={`
       flex items-center justify-center gap-1.5 text-[9px]
       ${seg.color}
     `} key={seg.label} style={{ width: `${seg.pct}%` }}>
						{seg.icon}
						<span className="tracking-wider uppercase">{seg.label}</span>
						<span
							className="font-(family-name:--nv-font-mono) font-bold text-white/70"
						>
							{seg.value.toLocaleString()}
						</span>
						<span className="font-(family-name:--nv-font-mono) text-white/30">
							{Math.round(seg.pct)}%
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

function IncomingRaidPanel(props: {
	emptyMessage: string;
	expandedRaidId: string | null;
	items: ActivityTimelineItem[];
	onToggleRaid: (raidId: string) => void;
}) {
	return (
		<ActivityTimelinePanel
			emptyMessage={props.emptyMessage}
			expandedId={props.expandedRaidId}
			header={
				<h2
					className="
       flex items-center gap-2 font-(family-name:--nv-font-display) text-sm
       font-bold
     "
				>
					<ShieldAlert className="size-4 text-rose-300/70" />
					Incoming Raid
				</h2>
			}
			items={props.items}
			onToggle={props.onToggleRaid}
		/>
	);
}

function DefenseQueuePanel(props: {
	activeQueueItem: DefenseQueueItem | null;
	activeUpgradeProgress: number;
	canShowDevUi: boolean;
	cancelingQueueItemId: Id<"colonyQueueItems"> | null;
	isCompletingQueueItem: boolean;
	onCancelQueueItem: (queueItemId: Id<"colonyQueueItems">) => void;
	onCompleteActiveQueueItem: () => void;
	pendingQueueItems: DefenseQueueItem[];
	queueItemsCount: number;
}) {
	const {
		activeQueueItem,
		activeUpgradeProgress,
		canShowDevUi,
		cancelingQueueItemId,
		isCompletingQueueItem,
		onCancelQueueItem,
		onCompleteActiveQueueItem,
		pendingQueueItems,
		queueItemsCount,
	} = props;

	return (
		<div
			className="
     rounded-2xl border border-white/12
     bg-[linear-gradient(170deg,rgba(12,20,36,0.95),rgba(6,10,18,0.98))]
   "
		>
			<div
				className="flex items-center gap-2.5 border-b border-white/8 px-5 py-3.5"
			>
				<Clock3 className="size-5 text-rose-300" />
				<h2 className="font-(family-name:--nv-font-display) text-sm font-bold">Defense Queue</h2>
				{queueItemsCount > 0 ? (
					<span
						className="
        ml-auto font-(family-name:--nv-font-mono) text-[9px] text-white/30
      "
					>
						{queueItemsCount} item{queueItemsCount !== 1 ? "s" : ""}
					</span>
				) : null}
			</div>

			<div className="p-5">
				{activeQueueItem ? (
					<div className="space-y-3">
						<p
							className="
         text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase
       "
						>
							Active
						</p>
						<div
							className="rounded-xl border border-emerald-300/20 bg-emerald-400/4 p-3"
						>
							<div className="flex items-start justify-between gap-2">
								<div className="flex items-center gap-2.5">
									<img
										alt={activeQueueItem.defenseName}
										className="
            size-10 rounded-lg border border-white/8 bg-black/30 object-contain
            p-1
          "
										src={DEFENSE_PRESENTATION[activeQueueItem.defenseKey].image}
									/>
									<div>
										<p className="text-xs font-semibold">{activeQueueItem.defenseName}</p>
										<p
											className="
             mt-0.5 font-(family-name:--nv-font-mono) text-[10px] text-white/40
           "
										>
											{activeQueueItem.remaining} of {activeQueueItem.total} remaining
										</p>
									</div>
								</div>
								<div className="flex items-center gap-1.5">
									{canShowDevUi ? (
										<button
											className="
             rounded-md border border-cyan-300/20 bg-cyan-400/8 px-2 py-1
             text-[10px] font-medium text-cyan-100 transition-colors
             hover:border-cyan-200/35 hover:bg-cyan-400/12
             disabled:cursor-not-allowed disabled:opacity-50
           "
											disabled={isCompletingQueueItem}
											onClick={onCompleteActiveQueueItem}
											type="button"
										>
											{isCompletingQueueItem ? "..." : "Complete"}
										</button>
									) : null}
									<button
										className="
            rounded-md border border-rose-300/20 bg-rose-400/8 px-2 py-1
            text-[10px] font-medium text-rose-200/80 transition-colors
            hover:border-rose-200/35 hover:bg-rose-400/12
            disabled:opacity-50
          "
										disabled={cancelingQueueItemId === activeQueueItem.id}
										onClick={() => {
											onCancelQueueItem(activeQueueItem.id);
										}}
										type="button"
									>
										<X className="size-3" />
									</button>
								</div>
							</div>

							<div className="mt-2 flex items-center justify-between text-right">
								<div className="flex items-center gap-1.5">
									<Layers3 className="size-3 text-emerald-300/50" />
									<span
										className="
            font-(family-name:--nv-font-mono) text-[10px] text-white/40
          "
									>
										Batch {activeQueueItem.total}
									</span>
								</div>
								<div>
									<p
										className="
            font-(family-name:--nv-font-mono) text-xs font-bold text-emerald-200
          "
									>
										{formatColonyDuration(activeQueueItem.timeLeftSeconds, "seconds")}
									</p>
									<p
										className="
            font-(family-name:--nv-font-mono) text-[8px] tracking-widest
            text-emerald-200/45 uppercase
          "
									>
										remaining
									</p>
								</div>
							</div>

							<div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/8">
								<div
									className="
           h-full rounded-full bg-linear-to-r from-emerald-400/60
           to-emerald-300/40 transition-all
         "
									style={{ width: `${activeUpgradeProgress}%` }}
								/>
							</div>
							<div className="mt-1 flex items-center justify-between">
								<span
									className="font-(family-name:--nv-font-mono) text-[9px] text-white/25"
								>
									{Math.round(activeUpgradeProgress)}%
								</span>
								<span
									className="
           inline-flex items-center gap-1 text-[9px] text-emerald-300/60
         "
								>
									<span
										className="inline-block size-1.5 rounded-full bg-emerald-400"
										style={{ animation: "nv-queue-pulse 2s ease-in-out infinite" }}
									/>
									Building
								</span>
							</div>
						</div>
					</div>
				) : null}

				{pendingQueueItems.length > 0 ? (
					<div className={activeQueueItem ? "mt-4" : ""}>
						<p
							className="
         text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase
       "
						>
							Pending ({pendingQueueItems.length})
						</p>
						<div className="mt-2 space-y-1">
							{pendingQueueItems.map((item, index) => (
								<div
									className="
           flex items-center justify-between rounded-lg border border-white/6
           bg-white/2 px-3 py-2
         "
									key={item.id}
								>
									<div className="flex items-center gap-2">
										<span
											className="
             flex size-5 items-center justify-center rounded-sm
             font-(family-name:--nv-font-mono) text-[9px] font-bold
             text-white/25
           "
										>
											{index + 1}
										</span>
										<img
											alt={item.defenseName}
											className="
             size-6 rounded-sm border border-white/8 bg-black/20 object-contain
             p-0.5
           "
											src={DEFENSE_PRESENTATION[item.defenseKey].image}
										/>
										<div>
											<p className="text-[11px] font-semibold text-white/80">{item.defenseName}</p>
											<p
												className="
              font-(family-name:--nv-font-mono) text-[9px] text-white/30
            "
											>
												{item.total} units • {formatColonyDuration(item.timeLeftSeconds, "seconds")}
											</p>
										</div>
									</div>
									<button
										className="
            rounded-md border border-rose-300/20 bg-rose-400/8 px-2 py-1
            text-[10px] font-medium text-rose-200/80 transition-colors
            hover:border-rose-200/35 hover:bg-rose-400/12
            disabled:opacity-50
          "
										disabled={cancelingQueueItemId === item.id}
										onClick={() => {
											onCancelQueueItem(item.id);
										}}
										type="button"
									>
										{cancelingQueueItemId === item.id ? "..." : "Cancel"}
									</button>
								</div>
							))}
						</div>
					</div>
				) : null}

				{queueItemsCount === 0 ? (
					<div className="flex flex-col items-center py-8 text-center">
						<div
							className="
         flex size-12 items-center justify-center rounded-full border
         border-white/8 bg-white/3
       "
						>
							<Package className="size-5 text-white/20" />
						</div>
						<p className="mt-3 text-xs font-medium text-white/30">No active builds</p>
						<p className="mt-1 text-[10px] text-white/18">Select a defense to begin construction</p>
					</div>
				) : null}
			</div>
		</div>
	);
}
