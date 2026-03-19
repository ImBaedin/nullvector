import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { api } from "@nullvector/backend/convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";

import { resolveNotificationDestinationPath } from "./notification-routing";
import type { NotificationFeedItem } from "./notification-renderers";

export type NotificationCenterStatusFilter = "all" | "unread" | "read" | "archived";
export type NotificationCenterCategoryFilter =
	| "all"
	| "combat"
	| "fleet"
	| "colony"
	| "system";

type ColonyOption = {
	id: string;
	name: string;
};

export function useNotificationCenter(args: {
	activeColonyId: Id<"colonies"> | null;
	colonies: ColonyOption[];
	onOpenChange: (open: boolean) => void;
}) {
	const navigate = useNavigate();
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
	const [selectedNotification, setSelectedNotification] = useState<NotificationFeedItem | null>(
		null,
	);
	const [statusFilter, setStatusFilter] = useState<NotificationCenterStatusFilter>("all");
	const [categoryFilter, setCategoryFilter] = useState<NotificationCenterCategoryFilter>("all");
	const [selectedColonyFilter, setSelectedColonyFilter] = useState<string>("all");
	const [markingAllRead, setMarkingAllRead] = useState(false);
	const [archivingNotificationId, setArchivingNotificationId] =
		useState<Id<"notifications"> | null>(null);
	const markNotificationRead = useMutation(api.notifications.markNotificationRead);
	const markAllNotificationsRead = useMutation(api.notifications.markAllNotificationsRead);
	const archiveNotification = useMutation(api.notifications.archiveNotification);

	const selectedColonyId =
		selectedColonyFilter === "all" ? undefined : (selectedColonyFilter as Id<"colonies">);
	const unreadSummary = useQuery(
		api.notifications.getNotificationUnreadSummary,
		isAuthenticated ? (selectedColonyId ? { colonyId: selectedColonyId } : {}) : "skip",
	);
	const colonyOptions = useMemo(
		() => [
			{ label: "All Colonies", value: "all" },
			...args.colonies.map((colony) => ({
				label: colony.id === args.activeColonyId ? `${colony.name} (Active)` : colony.name,
				value: colony.id,
			})),
		],
		[args.activeColonyId, args.colonies],
	);
	const selectedColonyLabel =
		colonyOptions.find((option) => option.value === selectedColonyFilter)?.label ??
		"All Colonies";

	const getColonyName = useCallback(
		(colonyId?: Id<"colonies">) => {
			if (!colonyId) {
				return null;
			}
			return args.colonies.find((candidate) => candidate.id === colonyId)?.name ?? null;
		},
		[args.colonies],
	);

	const markReadIfUnread = useCallback(
		async (notification: NotificationFeedItem) => {
			if (notification.status !== "unread") {
				return;
			}

			await markNotificationRead({
				notificationId: notification.id,
			});
		},
		[markNotificationRead],
	);

	const handleOpenDetails = useCallback(
		(notification: NotificationFeedItem) => {
			void markReadIfUnread(notification).catch((error) => {
				toast.error(error instanceof Error ? error.message : "Failed to update notification");
			});
			setSelectedNotification(notification);
		},
		[markReadIfUnread],
	);

	const handleNavigate = useCallback(
		(notification: NotificationFeedItem) => {
			const destinationPath = resolveNotificationDestinationPath(notification.destination);
			if (!destinationPath) {
				handleOpenDetails(notification);
				return;
			}

			void markReadIfUnread(notification).catch((error) => {
				toast.error(error instanceof Error ? error.message : "Failed to update notification");
			});
			args.onOpenChange(false);
			setSelectedNotification(null);

			try {
				void navigate({ to: destinationPath });
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Unable to open notification");
			}
		},
		[args, handleOpenDetails, markReadIfUnread, navigate],
	);

	const handleMarkAllRead = useCallback(async () => {
		setMarkingAllRead(true);
		try {
			await markAllNotificationsRead({
				category: categoryFilter,
				colonyId: selectedColonyId,
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to mark notifications read");
		} finally {
			setMarkingAllRead(false);
		}
	}, [categoryFilter, markAllNotificationsRead, selectedColonyId]);

	const handleArchive = useCallback(
		async (notification: NotificationFeedItem) => {
			setArchivingNotificationId(notification.id);
			try {
				await archiveNotification({
					notificationId: notification.id,
				});
				setSelectedNotification(null);
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Failed to archive notification");
			} finally {
				setArchivingNotificationId(null);
			}
		},
		[archiveNotification],
	);

	return {
		archivingNotificationId,
		categoryFilter,
		colonyOptions,
		isAuthenticated,
		isAuthLoading,
		getColonyName,
		handleArchive,
		handleMarkAllRead,
		handleNavigate,
		handleOpenDetails,
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
	};
}
