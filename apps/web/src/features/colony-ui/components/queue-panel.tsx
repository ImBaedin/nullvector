import type { ReactNode } from "react";

import { Clock3 } from "lucide-react";

import type { QueuePanelItem } from "@/features/colony-ui/queue-state";

import { getPendingQueueIndexLabel } from "@/features/colony-ui/queue-state";
import { cn } from "@/lib/utils";

type QueuePanelTheme = "resource" | "facility" | "shipyard" | "defense";

const HEADER_ICON_CLASSNAMES: Record<QueuePanelTheme, string> = {
	defense: "text-rose-300",
	facility: "text-violet-300",
	resource: "text-cyan-300",
	shipyard: "text-cyan-300",
};

export function QueuePanel(props: {
	activeItem: QueuePanelItem | null;
	activeProgressPercent: number;
	className?: string;
	completeAction?: ReactNode;
	emptyDescription: string;
	emptyTitle: string;
	headerIcon?: ReactNode;
	pendingItems: QueuePanelItem[];
	theme: QueuePanelTheme;
	title: string;
	totalCount?: number;
}) {
	const totalCount = props.totalCount ?? (props.activeItem ? 1 : 0) + props.pendingItems.length;
	const clampedPercent = Math.max(0, Math.min(100, Number(props.activeProgressPercent) || 0));

	return (
		<div className={cn(`
    rounded-2xl border border-white/12
    bg-[linear-gradient(170deg,rgba(12,20,36,0.95),rgba(6,10,18,0.98))]
  `, props.className)}>
			<div className="
     flex items-center gap-2.5 border-b border-white/8 px-5 py-3.5
   ">
				{props.headerIcon ?? (
					<Clock3 className={cn("size-5", HEADER_ICON_CLASSNAMES[props.theme])} />
				)}
				<h2 className="font-(family-name:--nv-font-display) text-sm font-bold">{props.title}</h2>
				{totalCount > 0 ? (
					<span
						className="
        ml-auto font-(family-name:--nv-font-mono) text-[9px] text-white/30
      "
					>
						{totalCount} item{totalCount !== 1 ? "s" : ""}
					</span>
				) : null}
			</div>

			<div className="p-5">
				{props.activeItem ? (
					<div className="space-y-3">
						<p
							className="
         text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase
       "
						>
							Active
						</p>
						<div className="
        rounded-xl border border-emerald-300/20 bg-emerald-400/4 p-3
      ">
							<div className="flex items-center justify-between gap-3">
								<div>
									<p className="text-xs font-semibold">{props.activeItem.title}</p>
									<p
										className="
            mt-0.5 font-(family-name:--nv-font-mono) text-[10px] text-white/40
          "
									>
										{props.activeItem.subtitle}
									</p>
								</div>
								{props.activeItem.remainingLabel ? (
									<div className="text-right">
										<p
											className="
             font-(family-name:--nv-font-mono) text-xs font-bold
             text-emerald-200
           "
										>
											{props.activeItem.remainingLabel}
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
								) : null}
							</div>
							{props.activeItem.totalLabel ? (
								<p
									className="
           mt-2 font-(family-name:--nv-font-mono) text-[10px] text-white/35
         "
								>
									{props.activeItem.totalLabel}
								</p>
							) : null}
							<div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/8">
								<div
									className="
           h-full rounded-full bg-linear-to-r from-emerald-400/60
           to-emerald-300/40 transition-all
         "
									style={{ width: `${clampedPercent}%` }}
								/>
							</div>
							<div className="mt-1 flex items-center justify-between">
								<span className="
          font-(family-name:--nv-font-mono) text-[9px] text-white/25
        ">
									{Math.round(clampedPercent)}%
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
									In progress
								</span>
							</div>
							{props.completeAction ? <div className="mt-2">{props.completeAction}</div> : null}
						</div>
					</div>
				) : null}

				{props.pendingItems.length > 0 ? (
					<div className={props.activeItem ? "mt-4" : ""}>
						<p
							className="
         text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase
       "
						>
							Pending ({props.pendingItems.length})
						</p>
						<div className="mt-2 space-y-1">
							{props.pendingItems.map((item, index) => (
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
											{getPendingQueueIndexLabel(index)}
										</span>
										<div>
											<p className="text-[11px] font-semibold text-white/80">{item.title}</p>
											<p
												className="
              font-(family-name:--nv-font-mono) text-[9px] text-white/30
            "
											>
												{item.subtitle}
											</p>
										</div>
									</div>
									<div className="text-right">
										{item.totalLabel ? (
											<p
												className="
              font-(family-name:--nv-font-mono) text-[10px] text-white/35
            "
											>
												{item.totalLabel}
											</p>
										) : null}
										{item.remainingLabel ? (
											<p
												className="
              font-(family-name:--nv-font-mono) text-[10px] text-white/35
            "
											>
												{item.remainingLabel}
											</p>
										) : null}
									</div>
								</div>
							))}
						</div>
					</div>
				) : null}

				{!props.activeItem && props.pendingItems.length === 0 ? (
					<div className="flex flex-col items-center py-8 text-center">
						<div
							className="
         flex size-12 items-center justify-center rounded-full border
         border-white/8 bg-white/3
       "
						>
							<Clock3 className="size-5 text-white/20" />
						</div>
						<p className="mt-3 text-xs font-medium text-white/30">{props.emptyTitle}</p>
						<p className="mt-1 text-[10px] text-white/18">{props.emptyDescription}</p>
					</div>
				) : null}
			</div>
		</div>
	);
}
