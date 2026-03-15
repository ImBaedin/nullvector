import { ChevronDown, Clock3 } from "lucide-react";
import { Fragment, type ReactNode } from "react";

export type ActivityEndpoint = {
	icon: ReactNode;
	iconContainerClassName: string;
	subtitle?: string;
	title: string;
};

export type ActivityTimelineItem = {
	actions?: ReactNode[];
	detailChips: ReactNode[];
	dotClassName: string;
	etaLabel: string;
	id: string;
	kindBadgeClassName: string;
	kindLabel: string;
	origin: ActivityEndpoint;
	progress: number;
	progressBarClassName: string;
	relationBadgeClassName?: string;
	relationLabel?: string;
	statusLabel?: string;
	summaryLabel: string;
	target: ActivityEndpoint;
	transitIcon: ReactNode;
	transitIconBorderClassName: string;
	transitIconFillClassName: string;
	transitLineClassName: string;
};

type ActivityTimelinePanelProps = {
	emptyMessage: string;
	expandedId: string | null;
	header: ReactNode;
	items: ActivityTimelineItem[];
	onToggle: (itemId: string) => void;
};

export function ActivityTimelinePanel(props: ActivityTimelinePanelProps) {
	if (props.items.length === 0) {
		return (
			<div>
				{props.header}
				<div
					className="
       mt-3 rounded-xl border border-white/10 bg-white/2 px-4 py-6 text-center
       text-xs text-white/45
     "
				>
					{props.emptyMessage}
				</div>
			</div>
		);
	}

	return (
		<div>
			{props.header}
			<div className="mt-3 space-y-2">
				{props.items.map((item) => {
					const isExpanded = props.expandedId === item.id;

					return (
						<div
							className="
         overflow-hidden rounded-xl border border-white/10
         bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,16,0.95))]
       "
							key={item.id}
						>
							<button
								className="
          flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors
          hover:bg-white/2
        "
								onClick={() => props.onToggle(item.id)}
								type="button"
							>
								<span className={`
          inline-block size-2 shrink-0 rounded-full
          ${item.dotClassName}
        `} />
								<span className="min-w-0 shrink-0 text-xs font-semibold">{item.summaryLabel}</span>
								<span className={`
          shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase
          ${item.kindBadgeClassName}
        `}>{item.kindLabel}</span>
								{item.relationLabel ? <span className={`
          shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase
          ${item.relationBadgeClassName ?? `
            border border-white/10 bg-white/3 text-white/70
          `}
        `}>{item.relationLabel}</span> : null}

								<div
									className="
           mx-1 hidden h-1 min-w-[60px] flex-1 overflow-hidden rounded-full
           bg-white/8
           sm:block
         "
								>
									<div className={`
           h-full rounded-full
           ${item.progressBarClassName}
         `} style={{ width: `${item.progress}%` }} />
								</div>

								<span
									className="
           shrink-0 font-(family-name:--nv-font-mono) text-[10px] text-white/35
         "
								>
									{Math.round(item.progress)}%
								</span>

								<div className="
          flex shrink-0 items-center gap-1 text-[10px] text-white/45
        ">
									<Clock3 className="size-3" />
									<span
										className="
            font-(family-name:--nv-font-mono) font-semibold text-cyan-100
          "
									>
										{item.etaLabel}
									</span>
								</div>

								<ChevronDown className={`
          ml-auto size-3.5 shrink-0 text-white/25 transition-transform
          ${isExpanded ? "rotate-180" : ""}
        `} />
							</button>

							<div
								className="
          grid transition-[grid-template-rows] duration-300
          ease-[cubic-bezier(0.25,0.8,0.25,1)]
        "
								style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
							>
								<div className="overflow-hidden">
									<div className="border-t border-white/6">
										<div className="flex items-start px-5 pt-5 pb-8">
											<EndpointNode endpoint={item.origin} isExpanded={isExpanded} delayMs={60} />

											<div className="relative z-0 -mx-2 mt-5 min-w-[40px] flex-1">
												<div className="h-px bg-white/10" />
												<div
													className={`
               absolute top-0 h-px
               ${item.transitLineClassName}
             `}
													style={
														isExpanded
															? {
																	width: `${item.progress}%`,
																	animation:
																		"nv-fleet-line-draw 500ms cubic-bezier(0.21,1,0.34,1) both",
																	animationDelay: "140ms",
																}
															: { width: 0, opacity: 0 }
													}
												/>
												<div
													className="absolute -top-3 flex flex-col items-center"
													style={
														isExpanded
															? {
																	left: `calc(${item.progress}% - 12px)`,
																	animation:
																		"nv-fleet-ship-in 400ms cubic-bezier(0.21,1,0.34,1) both",
																	animationDelay: "280ms",
																}
															: {
																	left: `calc(${item.progress}% - 12px)`,
																	opacity: 0,
																}
													}
												>
													<div className={`
               flex size-6 items-center justify-center rounded-full border-2
               shadow-lg
               ${item.transitIconBorderClassName}
               ${item.transitIconFillClassName}
             `}>{item.transitIcon}</div>
													<span
														className="
                mt-0.5 font-(family-name:--nv-font-mono) text-[8px]
                text-white/30
              "
													>
														{Math.round(item.progress)}%
													</span>
												</div>
											</div>

											<EndpointNode endpoint={item.target} isExpanded={isExpanded} delayMs={180} />
										</div>

										<div
											className="
             flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/6
             px-5 py-3 text-[10px] text-white/45
           "
											style={
												isExpanded
													? {
															animation: "nv-fleet-chips-in 350ms cubic-bezier(0.21,1,0.34,1) both",
															animationDelay: "320ms",
														}
													: { opacity: 0 }
											}
										>
											{item.detailChips.map((chip, index) => (
												<Fragment key={`${item.id}:chip:${index}`}>{chip}</Fragment>
											))}
											{item.statusLabel ? (
												<span
													className="
               font-(family-name:--nv-font-mono) text-[10px] text-white/30
             "
												>
													{item.statusLabel}
												</span>
											) : null}
											{item.actions?.map((action, index) => (
												<Fragment key={`${item.id}:action:${index}`}>{action}</Fragment>
											))}
										</div>
									</div>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function EndpointNode(props: { delayMs: number; endpoint: ActivityEndpoint; isExpanded: boolean }) {
	return (
		<div
			className="z-10 w-[100px] shrink-0 text-center"
			style={
				props.isExpanded
					? {
							animation: "nv-fleet-node-in 360ms cubic-bezier(0.21,1,0.34,1) both",
							animationDelay: `${props.delayMs}ms`,
						}
					: { opacity: 0 }
			}
		>
			<div className={`
     mx-auto flex size-10 items-center justify-center rounded-full border
     ${props.endpoint.iconContainerClassName}
   `}>{props.endpoint.icon}</div>
			<p className="mt-1.5 truncate text-[11px] font-semibold">{props.endpoint.title}</p>
			{props.endpoint.subtitle ? (
				<p
					className="
       truncate font-(family-name:--nv-font-mono) text-[9px] text-white/30
     "
				>
					{props.endpoint.subtitle}
				</p>
			) : null}
		</div>
	);
}

export function splitActivityLabel(label: string): { address: string; name: string } | null {
	const match = label.match(/^(.+?)\s*\(([^)]+)\)$/);
	if (!match) {
		return null;
	}

	return {
		name: match[1] ?? label,
		address: match[2] ?? "",
	};
}
