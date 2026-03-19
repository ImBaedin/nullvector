import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { useState } from "react";
import { toast } from "sonner";

import { NvSwitch, SettingsRow, SettingsSection } from "./settings-panel-primitives";
import { useColonyDevConsole } from "./use-colony-dev-console";

export function DeveloperPanel({ activeColonyId }: { activeColonyId: Id<"colonies"> | null }) {
	const {
		canToggleDevConsoleUi,
		canUseDevConsole,
		devConsoleState,
		launchNpcRaid,
		toggleDevConsoleUi,
	} = useColonyDevConsole(activeColonyId);
	const [isTriggeringRaid, setIsTriggeringRaid] = useState(false);

	const handleTriggerRaid = async () => {
		if (!activeColonyId) {
			toast.error("Open settings from a colony route to trigger a raid");
			return;
		}

		setIsTriggeringRaid(true);
		try {
			const result = await launchNpcRaid();
			if (result?.raidOperationId) {
				toast.success("NPC raid launched toward the current colony");
				return;
			}
			toast.error("No hostile source available to launch a raid");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to trigger raid");
		} finally {
			setIsTriggeringRaid(false);
		}
	};

	return (
		<>
			<div
				className="
      mb-5 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3.5 py-2.5
    "
			>
				<p className="text-xs font-medium text-amber-300/90">
					These options are for development and testing. They may cause unexpected behaviour and are
					not available in production.
				</p>
			</div>

			<SettingsSection title="Dev Console">
				<SettingsRow
					label="Enable Console UI"
					description="Show developer console controls in colony screens for this player."
				>
					<NvSwitch
						checked={devConsoleState?.showDevConsoleUi === true}
						disabled={!canToggleDevConsoleUi || !canUseDevConsole}
						onCheckedChange={(checked) => {
							void toggleDevConsoleUi(checked);
						}}
					/>
				</SettingsRow>
				{!canToggleDevConsoleUi ? (
					<p className="pt-1 text-xs text-(--nv-text-muted)">
						Open settings from a colony route to update this flag.
					</p>
				) : null}
				<SettingsRow
					label="Trigger Raid"
					description="Force an NPC raid to target the currently open colony immediately."
				>
					<button
						className="
        inline-flex items-center gap-1.5 rounded-md border
        border-[rgba(255,111,136,0.35)] bg-[rgba(255,111,136,0.08)] px-3 py-1.5
        text-xs font-medium text-[#ffd4dd] transition
        hover:bg-[rgba(255,111,136,0.15)]
        disabled:cursor-not-allowed disabled:opacity-50
      "
						disabled={!canUseDevConsole || !activeColonyId || isTriggeringRaid}
						onClick={() => {
							void handleTriggerRaid();
						}}
						type="button"
					>
						{isTriggeringRaid ? "Launching..." : "Launch Raid"}
					</button>
				</SettingsRow>
				{!canUseDevConsole ? (
					<p className="pt-1 text-xs text-(--nv-text-muted)">
						Developer console access is disabled for this player.
					</p>
				) : null}
			</SettingsSection>
		</>
	);
}
