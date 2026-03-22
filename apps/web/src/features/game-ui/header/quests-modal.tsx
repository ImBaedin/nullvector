import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { QuestReward, QuestTimelineItem } from "@nullvector/game-logic";

import { Dialog } from "@base-ui/react/dialog";
import { QUEST_DEFINITIONS } from "@nullvector/game-logic";
import {
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	LoaderCircle,
	Lock,
	ScrollText,
	Trophy,
	X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { NvButton, NvProgress, NvScrollArea } from "@/features/game-ui/primitives";
import { formatObjectiveDescription, useQuestProgress } from "@/features/game-ui/quests";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getObjectiveDescriptions(questId: string): string[] {
	const def = QUEST_DEFINITIONS.find((d) => d.id === questId);
	if (!def) return [];
	return def.objectives.map((obj) => formatObjectiveDescription(obj));
}

function escapeAttributeValue(value: string) {
	if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
		return CSS.escape(value);
	}
	return value.replace(/["\\]/g, "\\$&");
}

// ─── Reward badge ─────────────────────────────────────────────────────────────

function RewardChip({ reward }: { reward: QuestReward }) {
	if (reward.kind === "xp") {
		return (
			<span
				className="
      inline-flex items-center gap-1 rounded-full border border-amber-400/25
      bg-amber-400/8 px-2 py-0.5 text-[10px] font-semibold text-amber-300/80
    "
			>
				<Trophy className="size-2.5" />
				{reward.amount.toLocaleString()} XP
			</span>
		);
	}
	if (reward.kind === "credits") {
		return (
			<span
				className="
      inline-flex items-center gap-1 rounded-full border border-cyan-400/25
      bg-cyan-400/8 px-2 py-0.5 text-[10px] font-semibold text-cyan-300/70
    "
			>
				{reward.amount.toLocaleString()} CR
			</span>
		);
	}
	const parts = Object.entries(reward.resources)
		.filter(([, amt]) => amt > 0)
		.map(([key, amt]) => `${amt.toLocaleString()} ${key}`);
	return (
		<span
			className="
     inline-flex items-center rounded-full border border-white/10 bg-white/4
     px-2 py-0.5 text-[10px] font-medium text-(--nv-text-muted)
   "
		>
			{parts.join(" · ")}
		</span>
	);
}

// ─── Objective row ─────────────────────────────────────────────────────────────

function ObjectiveRow({
	index,
	objective,
	questId,
}: {
	index: number;
	objective: QuestTimelineItem["objectives"][number];
	questId: string;
}) {
	const descriptions = getObjectiveDescriptions(questId);
	const label = descriptions[index] ?? `Objective ${index + 1}`;
	const percent = objective.required > 0 ? (objective.current / objective.required) * 100 : 0;

	return (
		<div className="flex items-start gap-2.5">
			<div
				className={cn(
					"mt-1 size-1.5 shrink-0 rounded-full",
					objective.complete ? "bg-emerald-400" : "bg-white/20",
				)}
			/>
			<div className="min-w-0 flex-1">
				<div className="mb-1 flex items-center justify-between gap-2">
					<span
						className={cn(
							"text-[11px] leading-tight",
							objective.complete
								? "text-(--nv-text-muted) line-through decoration-white/20"
								: "text-(--nv-text-secondary)",
						)}
					>
						{label}
					</span>
					<span
						className={cn(
							"shrink-0 font-mono text-[10px] tabular-nums",
							objective.complete ? "text-emerald-300/60" : "text-(--nv-text-muted)",
						)}
					>
						{objective.current.toLocaleString()} / {objective.required.toLocaleString()}
					</span>
				</div>
				<NvProgress tone={objective.complete ? "success" : "neutral"} value={percent} />
			</div>
		</div>
	);
}

// ─── Active quest card ────────────────────────────────────────────────────────

function ActiveQuestCard({
	claimingQuestId,
	focused,
	item,
	onClaim,
	syncing,
}: {
	claimingQuestId: string | null;
	focused: boolean;
	item: QuestTimelineItem;
	onClaim: (questId: string) => void;
	syncing: boolean;
}) {
	const isClaimable = item.claimable;

	return (
		<div
			data-quest-id={item.id}
			className={cn(
				"relative overflow-hidden rounded-xl border transition-all",
				"bg-[linear-gradient(170deg,rgba(11,20,36,0.9),rgba(7,12,22,0.96))]",
				isClaimable ? `
      nv-quest-claimable-pulse border-emerald-400/25
      shadow-[0_0_28px_rgba(52,211,153,0.08)]
    ` : "border-white/8",
				focused ? "ring-1 ring-cyan-300/40" : null,
			)}
		>
			{/* Left accent bar */}
			<div
				className={cn(
					"absolute inset-y-0 left-0 w-[3px]",
					isClaimable
						? "bg-[linear-gradient(180deg,rgba(52,211,153,0.9),rgba(52,211,153,0.4))]"
						: "bg-[linear-gradient(180deg,rgba(61,217,255,0.6),rgba(61,217,255,0.2))]",
				)}
			/>

			<div className="py-4 pr-4 pl-5">
				{/* Meta row */}
				<div className="mb-1.5 flex items-center gap-2">
					<span
						className="
        text-[10px] font-bold tracking-[0.12em] text-white/25 uppercase
      "
					>
						{item.category === "main"
							? "Main Quest"
							: item.category === "system"
								? "System Quest"
								: "Side Quest"}
					</span>
					{isClaimable ? (
						<>
							<span className="text-white/15">·</span>
							<span
								className="
          text-[10px] font-bold tracking-[0.08em] text-emerald-300/60 uppercase
        "
							>
								Complete
							</span>
						</>
					) : null}
				</div>

				{/* Title + description */}
				<h3
					className="
       font-(family-name:--nv-font-display) text-[13px] leading-tight font-bold
       text-(--nv-text-primary)
     "
				>
					{item.title}
				</h3>
				<p className="mt-1.5 text-xs/relaxed text-(--nv-text-muted)">{item.description}</p>

				{/* Objectives */}
				{item.objectives.length > 0 ? (
					<div className="mt-4 space-y-3 border-t border-white/6 pt-3">
						{item.objectives.map((obj, i) => (
							<ObjectiveRow
								index={i}
								key={`${item.id}:obj:${i}`}
								objective={obj}
								questId={item.id}
							/>
						))}
					</div>
				) : null}

				{/* Rewards + Claim */}
				<div className="mt-3 flex items-center justify-between gap-3">
					<div className="flex flex-wrap gap-1.5">
						{item.rewards.map((reward, i) => (
							<RewardChip key={`${item.id}:rw:${i}`} reward={reward} />
						))}
					</div>
					{isClaimable ? (
						<NvButton
							disabled={syncing || claimingQuestId === item.id}
							onClick={() => onClaim(item.id)}
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
					) : null}
				</div>
			</div>
		</div>
	);
}

// ─── Upcoming quest card ──────────────────────────────────────────────────────

function UpcomingQuestCard({ item }: { item: QuestTimelineItem }) {
	const isLocked = item.status === "locked";

	if (isLocked) {
		return (
			<div className="flex items-center gap-2.5 rounded-lg px-3 py-2 opacity-35">
				<Lock className="size-3 shrink-0 text-white/30" />
				<span className="min-w-0 flex-1 truncate text-[11px] text-(--nv-text-muted)">
					{item.title}
				</span>
				<div className="flex shrink-0 gap-1.5">
					{item.rewards.map((r, i) => (
						<span className="text-[10px] text-white/20" key={i}>
							{r.kind === "xp"
								? `${r.amount.toLocaleString()} XP`
								: r.kind === "credits"
									? `${r.amount.toLocaleString()} CR`
									: null}
						</span>
					))}
				</div>
			</div>
		);
	}

	return (
		<div
			className="
     rounded-xl border border-white/6 bg-white/2.5 px-4 py-3 opacity-65
   "
		>
			<div className="flex items-start gap-2.5">
				<ChevronRight className="mt-0.5 size-3.5 shrink-0 text-white/20" />
				<div className="min-w-0 flex-1">
					<p
						className="
        text-[12px] leading-tight font-semibold text-(--nv-text-secondary)
      "
					>
						{item.title}
					</p>
					<p className="mt-1 text-[11px] leading-relaxed text-(--nv-text-muted)">
						{item.description}
					</p>
					{item.prerequisites.length > 0 ? (
						<p className="mt-1.5 text-[10px] text-white/25">
							After:{" "}
							{item.prerequisites
								.filter((p) => p.questId && !p.questId.startsWith("rank:"))
								.map((p) => p.title)
								.join(", ")}
						</p>
					) : null}
					{item.rewards.length > 0 ? (
						<div className="mt-2 flex flex-wrap gap-1.5">
							{item.rewards.map((reward, i) => (
								<RewardChip key={`${item.id}:rw:${i}`} reward={reward} />
							))}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}

// ─── Claimed quest row ────────────────────────────────────────────────────────

function ClaimedQuestRow({ item }: { item: QuestTimelineItem }) {
	const xpReward = item.rewards.find((r) => r.kind === "xp");

	return (
		<div className="flex items-center gap-3 py-1.5">
			<div
				className="
      flex size-4 shrink-0 items-center justify-center rounded-full border
      border-emerald-400/20 bg-emerald-400/8
    "
			>
				<CheckCircle2 className="size-2.5 text-emerald-400/60" />
			</div>
			<span className="min-w-0 flex-1 truncate text-[11px] text-(--nv-text-muted)">
				{item.title}
			</span>
			{xpReward && xpReward.kind === "xp" ? (
				<span className="shrink-0 text-[10px] text-amber-300/35">
					+{xpReward.amount.toLocaleString()} XP
				</span>
			) : null}
		</div>
	);
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function CollapsibleSection({
	badge,
	children,
	defaultOpen = true,
	label,
}: {
	badge?: number;
	children: React.ReactNode;
	defaultOpen?: boolean;
	label: string;
}) {
	const [open, setOpen] = useState(defaultOpen);

	return (
		<section>
			<button
				className="group mb-3 flex w-full items-center gap-3 text-left"
				onClick={() => setOpen((v) => !v)}
				type="button"
			>
				<span className="h-px flex-1 bg-white/8" />
				<div className="flex items-center gap-1.5">
					<span
						className="
        text-[10px] font-bold tracking-[0.14em] text-white/30 uppercase
      "
					>
						{label}
					</span>
					{badge !== undefined && badge > 0 ? (
						<span
							className="
         flex h-4 min-w-4 items-center justify-center rounded-full bg-white/8
         px-1 text-[9px] font-bold text-white/35
       "
						>
							{badge}
						</span>
					) : null}
				</div>
				<ChevronDown
					className={cn(
						"size-3 text-white/25 transition-transform duration-200",
						open ? "rotate-180" : "",
					)}
				/>
				<span className="h-px w-4 bg-white/8" />
			</button>

			<div
				className={cn(
					"grid transition-[grid-template-rows] duration-300 ease-out",
					open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
				)}
			>
				<div className="min-h-0 overflow-hidden">{children}</div>
			</div>
		</section>
	);
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function QuestsModal({
	activeColonyId,
	focusQuestId,
	onOpenChange,
	open,
}: {
	activeColonyId: Id<"colonies"> | null;
	focusQuestId?: string | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const scrollAreaRef = useRef<HTMLDivElement | null>(null);
	const { claimQuest, ensureActivations, loading, timelineItems } = useQuestProgress();
	const [claimingQuestId, setClaimingQuestId] = useState<string | null>(null);
	// TODO: keep activeColonyId reserved for future colony-scoped quest actions.
	void activeColonyId;

	useEffect(() => {
		if (!open) {
			return;
		}

		void ensureActivations().catch((error) => {
			toast.error(error instanceof Error ? error.message : "Failed to ensure quests");
		});
	}, [ensureActivations, open]);

	const activeItems = useMemo(
		() => timelineItems.filter((item) => item.status === "active" || item.status === "claimable"),
		[timelineItems],
	);

	const upcomingItems = useMemo(
		() => timelineItems.filter((item) => item.status === "upcoming" || item.status === "locked"),
		[timelineItems],
	);

	const claimedItems = useMemo(
		() => timelineItems.filter((item) => item.status === "claimed"),
		[timelineItems],
	);

	const activeTrackerCount = activeItems.length;

	useEffect(() => {
		if (!open || !focusQuestId) {
			return;
		}

		const frame = requestAnimationFrame(() => {
			const escapedQuestId = escapeAttributeValue(focusQuestId);
			const target = scrollAreaRef.current?.querySelector<HTMLElement>(
				`[data-quest-id="${escapedQuestId}"]`,
			);
			target?.scrollIntoView({
				block: "center",
				behavior: "smooth",
			});
		});

		return () => {
			cancelAnimationFrame(frame);
		};
	}, [activeItems.length, focusQuestId, open]);

	function handleClaim(questId: string) {
		if (loading) {
			return;
		}
		setClaimingQuestId(questId);
		void claimQuest(questId)
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
       fixed inset-0 z-95 bg-[rgba(3,6,12,0.75)] backdrop-blur-sm transition-all
       duration-200
       data-ending-style:opacity-0
       data-starting-style:opacity-0
     "
				/>
				<Dialog.Popup
					className="
       fixed top-1/2 left-1/2 z-100 flex h-[min(90vh,780px)] w-[min(96vw,680px)]
       -translate-1/2 flex-col overflow-hidden rounded-2xl border
       border-white/10
       bg-[linear-gradient(170deg,rgba(9,15,26,0.98),rgba(5,9,17,0.99))]
       shadow-[0_28px_90px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)]
       transition-all duration-200
       data-ending-style:scale-95 data-ending-style:opacity-0
       data-starting-style:scale-95 data-starting-style:opacity-0
     "
				>
					{/* Header */}
					<div
						className="
        flex items-center justify-between border-b border-white/7 px-6 py-4
      "
					>
						<div className="flex items-center gap-3">
							<div
								className="
          flex size-7 items-center justify-center rounded-lg border
          border-cyan-400/20 bg-cyan-400/8
        "
							>
								<ScrollText className="size-3.5 text-cyan-400/70" />
							</div>
							<div>
								<Dialog.Title
									className="
           font-(family-name:--nv-font-display) text-sm font-bold
           text-(--nv-text-primary)
         "
								>
									Quests
								</Dialog.Title>
								{activeTrackerCount > 0 ? (
									<p className="text-[10px] text-(--nv-text-muted)">{activeTrackerCount} active</p>
								) : null}
							</div>
						</div>
						<div className="flex items-center gap-2">
							{loading ? <LoaderCircle className="size-4 animate-spin text-white/30" /> : null}
							<Dialog.Close
								className="
          rounded-lg border border-white/10 bg-white/3 p-1.5 text-white/40
          transition
          hover:bg-white/7 hover:text-white/70
        "
							>
								<X className="size-4" />
							</Dialog.Close>
						</div>
					</div>

					<NvScrollArea className="min-h-0 flex-1 p-6" ref={scrollAreaRef}>
						<div className="space-y-7">
							{/* Active Section — no collapsible, always shown */}
							<section>
								{loading ? (
									<div className="space-y-3">
										{[1, 2].map((i) => (
											<div className="h-32 animate-pulse rounded-xl bg-white/4" key={i} />
										))}
									</div>
								) : activeItems.length > 0 ? (
									<div className="space-y-3">
										{activeItems.map((item) => (
											<ActiveQuestCard
												claimingQuestId={claimingQuestId}
												focused={focusQuestId === item.id}
												item={item}
												key={item.id}
												onClaim={handleClaim}
												syncing={loading}
											/>
										))}
									</div>
								) : (
									<div
										className="
            flex flex-col items-center justify-center rounded-xl border
            border-dashed border-white/10 py-10 text-center
          "
									>
										<ScrollText className="mb-3 size-6 text-white/15" />
										<p className="text-sm font-medium text-(--nv-text-muted)">No active quests</p>
										<p className="mt-1 text-xs text-white/25">
											New quests will appear as your colony grows.
										</p>
									</div>
								)}
							</section>

							{/* Upcoming Section */}
							{upcomingItems.length > 0 ? (
								<CollapsibleSection badge={upcomingItems.length} label="Upcoming">
									<div className="space-y-2 pb-1">
										{upcomingItems.map((item) => (
											<UpcomingQuestCard item={item} key={item.id} />
										))}
									</div>
								</CollapsibleSection>
							) : null}

							{/* Completed Section */}
							{claimedItems.length > 0 ? (
								<CollapsibleSection
									badge={claimedItems.length}
									defaultOpen={false}
									label="Completed"
								>
									<div className="divide-y divide-white/5 pb-1">
										{claimedItems.map((item) => (
											<ClaimedQuestRow item={item} key={item.id} />
										))}
									</div>
								</CollapsibleSection>
							) : null}
						</div>
					</NvScrollArea>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
