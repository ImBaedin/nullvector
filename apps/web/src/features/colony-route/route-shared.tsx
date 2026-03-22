import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { ResourceBucket, ShipKey } from "@nullvector/game-logic";

import { Clock3, Globe2, MapPin, Package, RotateCcw, Ship, Swords, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { useColonyDevConsole as useSharedColonyDevConsole } from "@/features/colony-ui/hooks/use-colony-dev-console";
import { formatColonyDuration } from "@/features/colony-ui/time";

import { ActivityTimelinePanel, splitActivityLabel } from "./active-activity-panel";

export type OperationTimelineRow = {
	id: Id<"fleetOperations">;
	kind: "transport" | "colonize" | "contract" | "combat";
	status: "planned" | "inTransit" | "atTarget" | "returning" | "completed" | "cancelled" | "failed";
	relation: "incoming" | "outgoing";
	originName: string;
	originAddressLabel: string;
	targetPreview: {
		kind: "colony" | "planet";
		label: string;
	};
	shipCounts: Record<ShipKey, number>;
	cargoRequested: ResourceBucket;
	postDeliveryAction?: "returnToOrigin" | "stationAtDestination";
	departAt: number;
	arriveAt: number;
	canCancel: boolean;
};

type OperationAccent = {
	badge: string;
	dot: string;
	iconBorder: string;
	iconFill: string;
	iconText: string;
	kindLabel: string;
	line: string;
	progress: string;
	targetBorder: string;
	targetFill: string;
};

export function useNowMs(enabled: boolean, intervalMs = 1_000): number {
	const [nowMs, setNowMs] = useState(() => Date.now());

	useEffect(() => {
		if (!enabled) {
			return;
		}

		const tick = window.setInterval(() => {
			setNowMs(Date.now());
		}, intervalMs);

		return () => {
			window.clearInterval(tick);
		};
	}, [enabled, intervalMs]);

	return nowMs;
}

export function useColonyDevConsole(colonyId: Id<"colonies"> | null) {
	const shared = useSharedColonyDevConsole(colonyId);

	return {
		canShowDevUi: shared.canShowDevUi,
		canUseDevConsole: shared.canUseDevConsole,
		completeActiveMission: (input: {
			colonyId: Id<"colonies">;
			operationId: Id<"fleetOperations">;
		}) => {
			if (!colonyId || input.colonyId !== colonyId) {
				throw new Error("Colony dev console is not available for this route");
			}

			return shared.actions.completeMission(input.operationId);
		},
		devConsoleState: shared.state,
	};
}

export function getOperationAccent(args: {
	kind: OperationTimelineRow["kind"];
	status: OperationTimelineRow["status"];
}): OperationAccent {
	const isReturning = args.status === "returning";
	const isContract = args.kind === "contract" || args.kind === "combat";

	if (isReturning) {
		return {
			badge: "bg-amber-400/12 text-amber-200/80",
			dot: "bg-amber-400",
			iconBorder: "border-amber-300",
			iconFill: "bg-amber-400/20 shadow-amber-400/30",
			iconText: "text-amber-300",
			kindLabel: "Returning",
			line: "bg-linear-to-r from-amber-400/60 to-amber-400/20",
			progress: "bg-amber-400/50",
			targetBorder: "border-rose-300/25",
			targetFill: "bg-rose-400/10",
		};
	}

	if (isContract) {
		return {
			badge: "bg-rose-400/12 text-rose-200/80",
			dot: "bg-rose-400",
			iconBorder: "border-rose-300",
			iconFill: "bg-rose-400/20 shadow-rose-400/30",
			iconText: "text-rose-300",
			kindLabel: args.kind === "combat" ? "Combat" : "Contract",
			line: "bg-linear-to-r from-rose-400/60 to-rose-400/20",
			progress: "bg-rose-400/50",
			targetBorder: "border-rose-300/25",
			targetFill: "bg-rose-400/10",
		};
	}

	return {
		badge: "bg-cyan-400/12 text-cyan-200/80",
		dot: "bg-cyan-400",
		iconBorder: "border-cyan-300",
		iconFill: "bg-cyan-400/20 shadow-cyan-400/30",
		iconText: "text-cyan-300",
		kindLabel: args.kind,
		line: "bg-linear-to-r from-cyan-400/60 to-cyan-400/20",
		progress: "bg-cyan-400/50",
		targetBorder: args.kind === "colonize" ? "border-amber-300/25" : "border-cyan-300/25",
		targetFill: args.kind === "colonize" ? "bg-amber-400/10" : "bg-cyan-400/10",
	};
}

export function OperationTimelinePanel(props: {
	canShowDevUi: boolean;
	canUseDevConsole: boolean;
	cancelingOperationId: Id<"fleetOperations"> | null;
	completingOperationId: Id<"fleetOperations"> | null;
	emptyMessage: string;
	expandedId: string | null;
	header: ReactNode;
	nowMs: number;
	operations: OperationTimelineRow[];
	shipsByKey: Map<
		ShipKey,
		{
			name: string;
		}
	>;
	onCancel: (operationId: Id<"fleetOperations">) => void;
	onComplete: (operationId: Id<"fleetOperations">) => void;
	onToggle: (operationId: string) => void;
}): ReactNode {
	const items = props.operations.map((operation) => {
		const effectiveNow = Math.min(operation.arriveAt, Math.max(props.nowMs, operation.departAt));
		const totalDuration = Math.max(1, operation.arriveAt - operation.departAt);
		const elapsed = Math.max(0, effectiveNow - operation.departAt);
		const progress = Math.min(100, (elapsed / totalDuration) * 100);
		const etaSeconds = Math.max(0, Math.ceil((operation.arriveAt - effectiveNow) / 1_000));
		const totalCargo =
			operation.cargoRequested.alloy +
			operation.cargoRequested.crystal +
			operation.cargoRequested.fuel;
		const accent = getOperationAccent({
			kind: operation.kind,
			status: operation.status,
		});
		const targetPreview = splitActivityLabel(operation.targetPreview.label);
		const isContract = operation.kind === "contract" || operation.kind === "combat";
		const isReturning = operation.status === "returning";

		return {
			actions: [
				operation.canCancel ? (
					<button
						key="cancel"
						className="
        ml-auto inline-flex items-center gap-1 rounded-md border
        border-rose-300/20 bg-rose-400/8 px-2.5 py-1 text-[10px] font-medium
        text-rose-200/80 transition-colors
        hover:border-rose-200/35 hover:bg-rose-400/12
      "
						disabled={props.cancelingOperationId === operation.id}
						onClick={(event) => {
							event.stopPropagation();
							props.onCancel(operation.id);
						}}
						type="button"
					>
						<X className="size-3" />
						Cancel
					</button>
				) : null,
				props.canShowDevUi ? (
					<button
						key="complete"
						className="
        inline-flex items-center gap-1 rounded-md border border-cyan-300/20
        bg-cyan-400/8 px-2.5 py-1 text-[10px] font-medium text-cyan-100
        transition-colors
        hover:border-cyan-200/35 hover:bg-cyan-400/12
        disabled:cursor-not-allowed disabled:opacity-50
      "
						disabled={props.completingOperationId === operation.id || !props.canUseDevConsole}
						onClick={(event) => {
							event.stopPropagation();
							props.onComplete(operation.id);
						}}
						type="button"
					>
						{props.completingOperationId === operation.id ? "Completing..." : "Complete"}
					</button>
				) : null,
			].filter(Boolean),
			detailChips: [
				<div
					className="
       rounded-sm border border-white/10 bg-white/3 px-1.5 py-0.5 text-[9px]
       font-semibold uppercase
     "
					key="relation"
				>
					{operation.relation}
				</div>,
				<div className="flex items-center gap-1" key="ships">
					<Ship className="size-3" />
					{Object.entries(operation.shipCounts)
						.filter(([, count]) => count > 0)
						.map(
							([shipKey, count]) =>
								`${count}x ${props.shipsByKey.get(shipKey as ShipKey)?.name ?? shipKey}`,
						)
						.join(", ")}
				</div>,
				totalCargo > 0 ? (
					<div className="flex items-center gap-1" key="cargo">
						<Package className="size-3" />
						{totalCargo.toLocaleString()} cargo
					</div>
				) : null,
				operation.postDeliveryAction === "returnToOrigin" ? (
					<div className="flex items-center gap-1" key="roundTrip">
						<RotateCcw className="size-3" />
						Round trip
					</div>
				) : null,
			].filter(Boolean),
			dotClassName: accent.dot,
			etaLabel: formatColonyDuration(etaSeconds, "seconds"),
			id: operation.id,
			kindBadgeClassName: accent.badge,
			kindLabel: accent.kindLabel,
			origin: {
				icon: <MapPin className="size-4 text-cyan-300" />,
				iconContainerClassName: "border-cyan-300/25 bg-cyan-400/10",
				subtitle: operation.originAddressLabel,
				title: operation.originName,
			},
			progress,
			progressBarClassName: accent.progress,
			relationBadgeClassName:
				operation.relation === "incoming"
					? "border border-amber-300/20 bg-amber-300/10 text-amber-100/80"
					: "border border-cyan-300/20 bg-cyan-300/10 text-cyan-100/80",
			relationLabel: operation.relation,
			statusLabel: operation.status,
			summaryLabel: operation.targetPreview.label,
			target: {
				icon: isContract ? (
					<Swords className="size-4 text-rose-300" />
				) : operation.kind === "colonize" ? (
					<Globe2 className="size-4 text-amber-300" />
				) : (
					<MapPin className="size-4 text-cyan-300" />
				),
				iconContainerClassName:
					operation.kind === "colonize"
						? "border-amber-300/25 bg-amber-400/10"
						: `${accent.targetBorder} ${accent.targetFill}`,
				subtitle: targetPreview?.address,
				title: targetPreview?.name ?? operation.targetPreview.label,
			},
			transitIcon: isContract ? (
				<Swords className={`
      size-3
      ${accent.iconText}
    `} />
			) : (
				<Ship className={`
      size-3
      ${isReturning ? "rotate-180" : ""}
      ${accent.iconText}
    `} />
			),
			transitIconBorderClassName: `${accent.iconBorder}`,
			transitIconFillClassName: `${accent.iconFill}`,
			transitLineClassName: `${accent.line}`,
		};
	});

	return (
		<ActivityTimelinePanel
			emptyMessage={props.emptyMessage}
			expandedId={props.expandedId}
			header={props.header}
			items={items}
			onToggle={props.onToggle}
		/>
	);
}
