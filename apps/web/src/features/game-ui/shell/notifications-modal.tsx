import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type {
	NotificationCategory,
	NotificationSeverity,
} from "@nullvector/backend/runtime/gameplay/notificationsModel";

import { Dialog } from "@base-ui/react/dialog";
import { Select } from "@base-ui/react/select";
import { api } from "@nullvector/backend/convex/_generated/api";
import {
	Archive,
	Bell,
	Check,
	CheckCheck,
	ChevronDown,
	ChevronLeft,
	Clock3,
	ExternalLink,
	Globe,
	LoaderCircle,
	PanelRightOpen,
	ShieldAlert,
	Swords,
	X,
} from "lucide-react";

import { NvBadge, NvButton, NvDivider, NvScrollArea } from "@/features/game-ui/primitives";
import { usePaginatedQuery } from "@/lib/convex-hooks";
import { cn } from "@/lib/utils";

import {
	NotificationContent,
	NotificationDisplayTitle,
	NotificationStateBadge,
	type NotificationFeedItem,
} from "./notification-renderers";
import { resolveNotificationDestinationPath } from "./notification-routing";
import {
	type NotificationCenterCategoryFilter as CategoryFilter,
	type NotificationCenterStatusFilter as StatusFilter,
	useNotificationCenter,
} from "./use-notification-center";
type ColonyNameResolver = (colonyId?: Id<"colonies">) => string | null;

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
	{ id: "all", label: "All" },
	{ id: "unread", label: "Unread" },
	{ id: "read", label: "Read" },
	{ id: "archived", label: "Archived" },
];

const CATEGORY_FILTERS: Array<{ id: CategoryFilter; label: string }> = [
	{ id: "all", label: "All" },
	{ id: "combat", label: "Combat" },
	{ id: "fleet", label: "Fleet" },
	{ id: "colony", label: "Colony" },
	{ id: "system", label: "System" },
];

function formatRelativeTime(timestamp: number) {
	const diffMs = Date.now() - timestamp;
	const diffMin = Math.floor(diffMs / 60_000);
	const diffHr = Math.floor(diffMs / 3_600_000);
	const diffDay = Math.floor(diffMs / 86_400_000);

	if (diffMin < 1) return "Just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	return `${diffDay}d ago`;
}

function formatDateTime(timestamp: number) {
	return new Date(timestamp).toLocaleString();
}

function severityTone(severity: NotificationSeverity) {
	switch (severity) {
		case "danger":
			return "danger";
		case "warning":
			return "warning";
		default:
			return "info";
	}
}

function categoryConfig(category: NotificationCategory, severity: NotificationSeverity) {
	switch (category) {
		case "combat":
			return {
				color: severity === "danger" ? "text-rose-300" : "text-amber-300",
				icon:
					severity === "danger" ? (
						<ShieldAlert className="size-4" />
					) : (
						<Swords className="size-4" />
					),
				label: "Combat",
			};
		case "fleet":
			return {
				color: "text-cyan-300",
				icon: <Bell className="size-4" />,
				label: "Fleet",
			};
		case "colony":
			return {
				color: "text-emerald-300",
				icon: <Bell className="size-4" />,
				label: "Colony",
			};
		case "system":
			return {
				color: "text-white/70",
				icon: <Bell className="size-4" />,
				label: "System",
			};
	}
}

function NotificationRow({
	getColonyName,
	notification,
	onNavigate,
	onOpenDetails,
}: {
	getColonyName: ColonyNameResolver;
	notification: NotificationFeedItem;
	onNavigate: (notification: NotificationFeedItem) => void;
	onOpenDetails: (notification: NotificationFeedItem) => void;
}) {
	const config = categoryConfig(notification.category, notification.severity);

	return (
		<div className={cn(`
    group flex items-start gap-3 rounded-lg border px-3.5 py-3 transition-all
    hover:bg-white/4
  `, notification.status === "unread" ? "border-white/10 bg-white/3" : `
    border-transparent bg-transparent
    hover:border-white/6
  `)}>
			<button
				className="flex min-w-0 flex-1 items-start gap-3 text-left"
				onClick={() => onNavigate(notification)}
				type="button"
			>
				<div className={cn(`
      mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border
      transition-colors
    `, notification.severity === "danger" ? `border-rose-400/25 bg-rose-400/10` : notification.severity === "warning" ? `
      border-amber-400/25 bg-amber-400/10
    ` : `border-white/10 bg-white/5`)}>
					<span className={config.color}>{config.icon}</span>
				</div>

				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-3">
						<NotificationContent
							getColonyName={getColonyName}
							notification={notification}
							variant="row"
						/>
						<span className="shrink-0 pt-0.5 text-[10px] text-(--nv-text-muted)">
							{formatRelativeTime(notification.occurredAt)}
						</span>
					</div>
					<div className="mt-2 flex items-center gap-2">
						<NvBadge tone={severityTone(notification.severity)}>{config.label}</NvBadge>
						<NotificationStateBadge status={notification.status} />
					</div>
				</div>
			</button>

			<NvButton
				aria-label="Open notification details"
				className="shrink-0"
				onClick={(event) => {
					event.stopPropagation();
					onOpenDetails(notification);
				}}
				size="icon"
				type="button"
				variant="ghost"
			>
				<PanelRightOpen className="size-4" />
			</NvButton>
		</div>
	);
}

function NotificationDetail({
	archiving,
	getColonyName,
	notification,
	onArchive,
	onBack,
	onOpenDestination,
}: {
	archiving: boolean;
	getColonyName: ColonyNameResolver;
	notification: NotificationFeedItem;
	onArchive: (notification: NotificationFeedItem) => void;
	onBack: () => void;
	onOpenDestination: (notification: NotificationFeedItem) => void;
}) {
	const config = categoryConfig(notification.category, notification.severity);
	const destinationPath = resolveNotificationDestinationPath(notification.destination);

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-2 border-b border-white/8 px-6 py-4">
				<button
					className="
       flex size-7 items-center justify-center rounded-md text-white/40
       transition
       hover:bg-white/6 hover:text-white/70
     "
					onClick={onBack}
					type="button"
				>
					<ChevronLeft className="size-4" />
				</button>
				<div className="flex min-w-0 flex-1 items-center gap-2.5">
					<span className={config.color}>{config.icon}</span>
					<h2
						className="
        truncate font-(family-name:--nv-font-display) text-base font-bold
        text-(--nv-text-primary)
      "
					>
						{NotificationDisplayTitle({ getColonyName, notification })}
					</h2>
				</div>
				<NvBadge tone={severityTone(notification.severity)}>{config.label}</NvBadge>
			</div>

			<NvScrollArea className="flex-1 px-6 py-5">
				<div className="space-y-4">
					<div className="flex items-center gap-2 text-xs text-(--nv-text-muted)">
						<Clock3 className="size-3" />
						<span>{formatDateTime(notification.occurredAt)}</span>
					</div>

					<div className="flex flex-wrap gap-2">
						<NvBadge tone="neutral">{notification.kind}</NvBadge>
						<NotificationStateBadge status={notification.status} />
					</div>

					<NvDivider />

					<NotificationContent
						getColonyName={getColonyName}
						notification={notification}
						variant="detail"
					/>
				</div>
			</NvScrollArea>

			<div
				className="
      flex items-center justify-between gap-3 border-t border-white/8 px-6 py-4
    "
			>
				<NvButton
					disabled={archiving}
					onClick={() => onArchive(notification)}
					size="sm"
					type="button"
					variant="danger"
				>
					{archiving ? (
						<LoaderCircle className="size-3.5 animate-spin" />
					) : (
						<Archive className="size-3.5" />
					)}
					Archive
				</NvButton>
				<NvButton
					disabled={!destinationPath}
					onClick={() => onOpenDestination(notification)}
					size="sm"
					type="button"
					variant="ghost"
				>
					<ExternalLink className="size-3.5" />
					Open destination
				</NvButton>
			</div>
		</div>
	);
}

function AuthenticatedNotificationList({
	categoryFilter,
	getColonyName,
	onNavigate,
	onOpenDetails,
	selectedColonyId,
	statusFilter,
}: {
	categoryFilter: CategoryFilter;
	getColonyName: ColonyNameResolver;
	onNavigate: (notification: NotificationFeedItem) => void;
	onOpenDetails: (notification: NotificationFeedItem) => void;
	selectedColonyId?: Id<"colonies">;
	statusFilter: StatusFilter;
}) {
	const { loadMore, results, status } = usePaginatedQuery(
		api.notifications.getNotificationFeed,
		{
			category: categoryFilter,
			colonyId: selectedColonyId,
			status: statusFilter,
		},
		{ initialNumItems: 25 },
	);
	const notifications = (results ?? []) as NotificationFeedItem[];
	const isInitialLoading = status === "LoadingFirstPage";
	const canLoadMore = status === "CanLoadMore";
	const loadingMore = status === "LoadingMore";

	return (
		<NvScrollArea className="flex-1 px-3 py-2">
			{isInitialLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 4 }).map((_, index) => (
						<div
							className="
         h-24 animate-pulse rounded-lg border border-white/6 bg-white/3
       "
							key={index}
						/>
					))}
				</div>
			) : notifications.length > 0 ? (
				<div className="space-y-1">
					{notifications.map((notification) => (
						<NotificationRow
							getColonyName={getColonyName}
							key={notification.id}
							notification={notification}
							onNavigate={onNavigate}
							onOpenDetails={onOpenDetails}
						/>
					))}

					{canLoadMore || loadingMore ? (
						<div className="pt-3">
							<NvButton
								className="w-full"
								disabled={loadingMore}
								onClick={() => loadMore(25)}
								size="sm"
								type="button"
								variant="ghost"
							>
								{loadingMore ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
								{loadingMore ? "Loading..." : "Load more"}
							</NvButton>
						</div>
					) : null}
				</div>
			) : (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<div
						className="
        mb-3 flex size-12 items-center justify-center rounded-xl border
        border-white/8 bg-white/3
      "
					>
						{statusFilter === "unread" ? (
							<Check className="size-5 text-(--nv-text-muted)" />
						) : (
							<Archive className="size-5 text-(--nv-text-muted)" />
						)}
					</div>
					<p className="text-sm font-medium text-(--nv-text-secondary)">
						{statusFilter === "unread" ? "All caught up" : "No notifications"}
					</p>
					<p className="mt-1 text-xs text-(--nv-text-muted)">
						{statusFilter === "unread"
							? "You've read all notifications for this scope."
							: "No notifications match the selected filters."}
					</p>
				</div>
			)}
		</NvScrollArea>
	);
}

export function NotificationsModal({
	activeColonyId,
	colonies,
	open,
	onOpenChange,
}: {
	activeColonyId: Id<"colonies"> | null;
	colonies: Array<{ id: string; name: string }>;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const {
		archivingNotificationId,
		categoryFilter,
		colonyOptions,
		getColonyName,
		handleArchive,
		handleMarkAllRead,
		handleNavigate,
		handleOpenDetails,
		isAuthenticated,
		isAuthLoading,
		markingAllRead,
		selectedColonyFilter,
		selectedColonyId,
		selectedColonyLabel,
		selectedNotification,
		setCategoryFilter,
		setSelectedColonyFilter,
		setSelectedNotification,
		setStatusFilter,
		statusFilter,
		unreadSummary,
	} = useNotificationCenter({
		activeColonyId,
		colonies,
		onOpenChange,
	});

	return (
		<Dialog.Root
			onOpenChange={(nextOpen) => {
				onOpenChange(nextOpen);
				if (!nextOpen) {
					setSelectedNotification(null);
				}
			}}
			open={open}
		>
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
					{selectedNotification ? (
						<NotificationDetail
							archiving={archivingNotificationId === selectedNotification.id}
							getColonyName={getColonyName}
							notification={selectedNotification}
							onArchive={handleArchive}
							onBack={() => setSelectedNotification(null)}
							onOpenDestination={handleNavigate}
						/>
					) : (
						<>
							<div
								className="
          flex items-center justify-between border-b border-white/8 px-6 py-4
        "
							>
								<div className="flex items-center gap-2.5">
									<Bell className="size-4 text-cyan-400/70" />
									<Dialog.Title
										className="
            font-(family-name:--nv-font-display) text-sm font-bold
            text-(--nv-text-primary)
          "
									>
										Notifications
									</Dialog.Title>
									{(unreadSummary?.total ?? 0) > 0 ? (
										<span
											className="
             flex h-5 min-w-5 items-center justify-center rounded-full
             bg-cyan-400/15 px-1.5 text-[10px] font-bold text-cyan-300
           "
										>
											{unreadSummary?.total ?? 0}
										</span>
									) : null}
								</div>
								<div className="flex items-center gap-1.5">
									{(unreadSummary?.total ?? 0) > 0 ? (
										<NvButton
											disabled={markingAllRead}
											onClick={() => {
												void handleMarkAllRead();
											}}
											size="sm"
											type="button"
											variant="ghost"
										>
											{markingAllRead ? (
												<LoaderCircle className="size-3 animate-spin" />
											) : (
												<CheckCheck className="size-3" />
											)}
											Mark all read
										</NvButton>
									) : null}
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
							<Dialog.Description className="sr-only">
								View and manage your in-game notifications.
							</Dialog.Description>

							<div className="space-y-3 border-b border-white/6 px-6 py-4">
								<div className="flex items-center gap-3">
									<Select.Root
										onValueChange={(value) => {
											if (value !== null) setSelectedColonyFilter(value);
										}}
										value={selectedColonyFilter}
									>
										<Select.Trigger
											className="
             nv-transition group flex h-8 items-center gap-2 rounded-lg border
             border-white/10 bg-white/4 px-3 text-xs font-medium
             text-(--nv-text-secondary)
             hover:border-white/16 hover:bg-white/[0.07]
             focus-visible:ring-2 focus-visible:ring-(--nv-focus-ring)
             focus-visible:outline-none
             data-popup-open:border-cyan-400/30 data-popup-open:bg-cyan-400/6
           "
										>
											<Globe
												className="
              size-3.5 text-(--nv-text-muted)
              group-data-popup-open:text-cyan-400/70
            "
											/>
											<Select.Value className="min-w-0 truncate" placeholder="All Colonies">
												{selectedColonyLabel}
											</Select.Value>
											<ChevronDown
												className="
              size-3.5 text-(--nv-text-muted) transition-transform duration-200
              group-data-popup-open:rotate-180
              group-data-popup-open:text-cyan-400/70
            "
											/>
										</Select.Trigger>
										<Select.Portal>
											<Select.Positioner align="start" className="z-200" sideOffset={6}>
												<Select.Popup
													className="
               origin-(--transform-origin) rounded-xl border border-white/12
               bg-[rgba(8,14,26,0.96)] p-1 shadow-[0_16px_48px_rgba(0,0,0,0.5)]
               backdrop-blur-xl transition-[transform,opacity] duration-200
               data-ending-style:scale-95 data-ending-style:opacity-0
               data-starting-style:scale-95 data-starting-style:opacity-0
             "
												>
													{colonyOptions.map((option) => (
														<Select.Item
															className="
                 nv-transition flex cursor-default items-center gap-2.5
                 rounded-lg px-3 py-2 text-xs font-medium
                 text-(--nv-text-secondary) outline-none select-none
                 data-highlighted:bg-white/[0.07]
                 data-highlighted:text-(--nv-text-primary)
                 data-selected:text-cyan-200
               "
															key={option.value}
															value={option.value}
														>
															<Select.ItemIndicator
																className="
                 flex size-4 items-center justify-center
               "
															>
																<Check className="size-3 text-cyan-400" />
															</Select.ItemIndicator>
															<Select.ItemText>{option.label}</Select.ItemText>
														</Select.Item>
													))}
												</Select.Popup>
											</Select.Positioner>
										</Select.Portal>
									</Select.Root>

									<div className="h-4 w-px bg-white/8" />

									<div className="flex items-center gap-1">
										{STATUS_FILTERS.map((filter) => (
											<button className={cn(`
             nv-transition rounded-md px-2.5 py-1 text-[11px] font-semibold
             tracking-wide uppercase
           `, statusFilter === filter.id ? `
             bg-cyan-400/12 text-cyan-200
             shadow-[inset_0_0_0_1px_rgba(61,217,255,0.18)]
           ` : `
             text-(--nv-text-muted)
             hover:bg-white/5 hover:text-(--nv-text-secondary)
           `)} key={filter.id} onClick={() => setStatusFilter(filter.id)} type="button">
												{filter.label}
											</button>
										))}
									</div>
								</div>

								<div className="flex items-center gap-1">
									{CATEGORY_FILTERS.map((filter) => (
										<button className={cn(`
            nv-transition flex items-center gap-1.5 rounded-lg border px-2.5
            py-1.5 text-[11px] font-medium
          `, categoryFilter === filter.id ? `
            border-cyan-400/20 bg-cyan-400/10 text-cyan-200
          ` : `
            border-transparent text-(--nv-text-muted)
            hover:border-white/8 hover:bg-white/4
            hover:text-(--nv-text-secondary)
          `)} key={filter.id} onClick={() => setCategoryFilter(filter.id)} type="button">
											{filter.id === "combat" && <Swords className="size-3" />}
											{filter.id === "fleet" && <Bell className="size-3" />}
											{filter.id === "colony" && <Globe className="size-3" />}
											{filter.id === "system" && <ShieldAlert className="size-3" />}
											{filter.label}
										</button>
									))}
								</div>
							</div>

							{isAuthLoading ? (
								<NvScrollArea className="flex-1 px-3 py-2">
									<div className="space-y-2">
										{Array.from({ length: 4 }).map((_, index) => (
											<div
												className="
              h-24 animate-pulse rounded-lg border border-white/6 bg-white/3
            "
												key={index}
											/>
										))}
									</div>
								</NvScrollArea>
							) : !isAuthenticated ? (
								<NvScrollArea className="flex-1 px-3 py-2">
									<div
										className="
            flex flex-col items-center justify-center py-16 text-center
          "
									>
										<Bell className="mb-3 size-8 text-(--nv-text-muted)" />
										<p className="text-sm font-medium text-(--nv-text-secondary)">
											Sign in to view notifications
										</p>
									</div>
								</NvScrollArea>
							) : (
								<AuthenticatedNotificationList
									categoryFilter={categoryFilter}
									getColonyName={getColonyName}
									onNavigate={handleNavigate}
									onOpenDetails={handleOpenDetails}
									selectedColonyId={selectedColonyId}
									statusFilter={statusFilter}
								/>
							)}
						</>
					)}
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
