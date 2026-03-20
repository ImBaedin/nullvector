import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { Dialog } from "@base-ui/react/dialog";
import { api } from "@nullvector/backend/convex/_generated/api";
import { CheckCircle2, LoaderCircle, ScrollText, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
	NvBadge,
	NvButton,
	NvPanel,
	NvProgress,
	NvScrollArea,
} from "@/features/game-ui/primitives";
import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";

function formatQuestCategory(category: "main" | "side" | "system") {
	return category === "main" ? "Main" : category === "system" ? "System" : "Side";
}

function formatQuestReward(
	reward:
		| { kind: "credits"; amount: number }
		| { kind: "xp"; amount: number }
		| { kind: "resources"; resources: { alloy: number; crystal: number; fuel: number } },
) {
	if (reward.kind === "credits") {
		return `${reward.amount.toLocaleString()} CR`;
	}
	if (reward.kind === "xp") {
		return `${reward.amount.toLocaleString()} XP`;
	}

	return Object.entries(reward.resources)
		.filter(([, amount]) => amount > 0)
		.map(([key, amount]) => `${amount.toLocaleString()} ${key}`)
		.join(" | ");
}

function QuestStatusBadge({
	claimable,
	status,
}: {
	claimable: boolean;
	status: "active" | "claimable" | "claimed";
}) {
	if (claimable) {
		return <NvBadge tone="success">Claimable</NvBadge>;
	}

	return <NvBadge tone={status === "claimed" ? "neutral" : "info"}>{status}</NvBadge>;
}

function QuestCard({
	action,
	item,
}: {
	action?: React.ReactNode;
	item: {
		category: "main" | "side" | "system";
		claimable: boolean;
		description: string;
		id: string;
		objectives: Array<{
			complete: boolean;
			current: number;
			required: number;
		}>;
		rewards: Array<
			| { kind: "credits"; amount: number }
			| { kind: "xp"; amount: number }
			| { kind: "resources"; resources: { alloy: number; crystal: number; fuel: number } }
		>;
		status: "active" | "claimable" | "claimed";
		title: string;
	};
}) {
	return (
		<NvPanel density="compact">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<p className="text-sm font-semibold text-(--nv-text-primary)">{item.title}</p>
						<NvBadge tone="neutral">{formatQuestCategory(item.category)}</NvBadge>
						<QuestStatusBadge claimable={item.claimable} status={item.status} />
					</div>
					<p className="mt-1 text-xs text-(--nv-text-secondary)">{item.description}</p>
				</div>
				{action}
			</div>

			<div className="mt-3 space-y-2">
				{item.objectives.map((objective, index) => {
					const percent =
						objective.required > 0 ? (objective.current / objective.required) * 100 : 0;

					return (
						<div className="space-y-1.5" key={`${item.id}:objective:${index}`}>
							<div className="flex items-center justify-between gap-3 text-[11px]">
								<span className="text-(--nv-text-secondary)">Objective {index + 1}</span>
								<span className={objective.complete ? "text-emerald-200/80" : `
          text-(--nv-text-muted)
        `}>
									{objective.current.toLocaleString()} / {objective.required.toLocaleString()}
								</span>
							</div>
							<NvProgress tone={objective.complete ? "success" : "neutral"} value={percent} />
						</div>
					);
				})}
			</div>

			{item.rewards.length > 0 ? (
				<div className="mt-3 flex flex-wrap gap-1.5">
					{item.rewards.map((reward, index) => (
						<NvBadge key={`${item.id}:reward:${index}`} tone="info">
							{formatQuestReward(reward)}
						</NvBadge>
					))}
				</div>
			) : null}
		</NvPanel>
	);
}

export function QuestsModal({
	activeColonyId,
	onOpenChange,
	open,
}: {
	activeColonyId: Id<"colonies"> | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const { isAuthenticated } = useConvexAuth();
	const tracker = useQuery(api.quests.getTracker, isAuthenticated ? {} : "skip");
	const log = useQuery(api.quests.getLog, isAuthenticated ? {} : "skip");
	const syncAvailability = useMutation(api.quests.syncAvailability);
	const claimQuest = useMutation(api.quests.claim);
	const [claimingQuestId, setClaimingQuestId] = useState<string | null>(null);
	const [syncing, setSyncing] = useState(false);

	useEffect(() => {
		if (!open || !isAuthenticated) {
			return;
		}

		setSyncing(true);
		void syncAvailability(activeColonyId ? { activeColonyId } : {})
			.catch((error) => {
				toast.error(error instanceof Error ? error.message : "Failed to sync quests");
			})
			.finally(() => {
				setSyncing(false);
			});
	}, [activeColonyId, isAuthenticated, open, syncAvailability]);

	const claimedItems = useMemo(
		() => (log?.items ?? []).filter((item) => item.status === "claimed"),
		[log?.items],
	);

	function handleClaim(questId: string) {
		if (syncing) {
			return;
		}
		setClaimingQuestId(questId);
		void claimQuest({ questId })
			.then(() => {
				toast.success("Quest claimed");
			})
			.catch((error) => {
				toast.error(error instanceof Error ? error.message : "Failed to claim quest");
			})
			.finally(() => {
				setClaimingQuestId(null);
			});
	}

	return (
		<Dialog.Root onOpenChange={onOpenChange} open={open}>
			<Dialog.Portal>
				<Dialog.Backdrop
					className="
       fixed inset-0 z-95 bg-[rgba(3,6,12,0.72)] backdrop-blur-sm transition-all
       duration-200
       data-ending-style:opacity-0
       data-starting-style:opacity-0
     "
				/>
				<Dialog.Popup
					className="
       fixed top-1/2 left-1/2 z-100 flex h-[min(88vh,720px)] w-[min(96vw,720px)]
       -translate-1/2 flex-col overflow-hidden rounded-2xl border
       border-white/10
       bg-[linear-gradient(170deg,rgba(10,16,28,0.97),rgba(6,10,18,0.99))]
       shadow-[0_24px_80px_rgba(0,0,0,0.6)] transition-all duration-200
       data-ending-style:scale-95 data-ending-style:opacity-0
       data-starting-style:scale-95 data-starting-style:opacity-0
     "
				>
					<div
						className="
        flex items-center justify-between border-b border-white/8 px-6 py-4
      "
					>
						<div className="flex items-center gap-2.5">
							<ScrollText className="size-4 text-cyan-400/70" />
							<Dialog.Title
								className="font-(family-name:--nv-font-display) text-sm font-bold"
							>
								Quest Tracker
							</Dialog.Title>
							{tracker?.items.length ? (
								<span
									className="
           flex h-5 min-w-5 items-center justify-center rounded-full
           bg-cyan-400/15 px-1.5 text-[10px] font-bold text-cyan-300
         "
								>
									{tracker.items.length}
								</span>
							) : null}
						</div>
						<div className="flex items-center gap-2">
							{syncing ? <LoaderCircle className="size-4 animate-spin text-white/40" /> : null}
							<Dialog.Close
								className="
          rounded-md border border-white/12 bg-white/3 p-1.5 text-white/50
          transition
          hover:bg-white/6 hover:text-white/80
        "
							>
								<X className="size-4" />
							</Dialog.Close>
						</div>
					</div>

					<NvScrollArea className="min-h-0 flex-1 px-6 py-5">
						<div className="space-y-6">
							<section className="space-y-3">
								<div className="flex items-center justify-between gap-3">
									<div>
										<p
											className="
             text-xs font-semibold tracking-[0.12em] text-white/40 uppercase
           "
										>
											Tracker
										</p>
										<p className="mt-1 text-xs text-(--nv-text-muted)">
											Active and claimable quests for the current commander.
										</p>
									</div>
								</div>

								{tracker === undefined ? (
									<div className="text-xs text-(--nv-text-muted)">Loading tracker...</div>
								) : tracker.items.length > 0 ? (
									<div className="space-y-3">
										{tracker.items.map((item) => (
											<QuestCard
												action={
													item.claimable ? (
														<NvButton
															disabled={syncing || claimingQuestId === item.id}
															onClick={() => {
																handleClaim(item.id);
															}}
															size="sm"
															type="button"
															variant="solid"
														>
															{claimingQuestId === item.id ? (
																<LoaderCircle className="size-3 animate-spin" />
															) : (
																<CheckCircle2 className="size-3" />
															)}
															Claim
														</NvButton>
													) : null
												}
												item={item}
												key={item.id}
											/>
										))}
									</div>
								) : (
									<NvPanel density="compact">
										<p className="text-sm text-(--nv-text-primary)">No active quests.</p>
										<p className="mt-1 text-xs text-(--nv-text-muted)">
											New quests will appear here as progression unlocks them.
										</p>
									</NvPanel>
								)}
							</section>

							<section className="space-y-3 border-t border-white/8 pt-5">
								<div>
									<p
										className="
            text-xs font-semibold tracking-[0.12em] text-white/40 uppercase
          "
									>
										Log
									</p>
									<p className="mt-1 text-xs text-(--nv-text-muted)">
										Claimed quests are retained here for reference.
									</p>
								</div>

								{log === undefined ? (
									<div className="text-xs text-(--nv-text-muted)">Loading log...</div>
								) : claimedItems.length > 0 ? (
									<div className="space-y-3">
										{claimedItems.map((item) => (
											<QuestCard item={item} key={item.id} />
										))}
									</div>
								) : (
									<NvPanel density="compact">
										<p className="text-xs text-(--nv-text-muted)">No claimed quests yet.</p>
									</NvPanel>
								)}
							</section>
						</div>
					</NvScrollArea>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
