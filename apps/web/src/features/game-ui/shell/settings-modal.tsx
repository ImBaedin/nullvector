import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { Dialog } from "@base-ui/react/dialog";
import { Switch } from "@base-ui/react/switch";
import { api } from "@nullvector/backend/convex/_generated/api";
import {
	Bell,
	ChevronRight,
	Code2,
	Eye,
	Gamepad2,
	Globe,
	Keyboard,
	LoaderCircle,
	Lock,
	Palette,
	Shield,
	User,
	Volume2,
	X,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";

import { NvDivider, NvInput, NvScrollArea, NvSelect } from "@/features/game-ui/primitives";
import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";
import { cn } from "@/lib/utils";

type SettingsCategory = {
	id: string;
	label: string;
	icon: React.ReactNode;
};

const CATEGORIES: SettingsCategory[] = [
	{ id: "profile", label: "Profile", icon: <User className="size-4" /> },
	{ id: "privacy", label: "Privacy & Security", icon: <Shield className="size-4" /> },
	{ id: "notifications", label: "Notifications", icon: <Bell className="size-4" /> },
	{ id: "display", label: "Display", icon: <Palette className="size-4" /> },
	{ id: "audio", label: "Audio", icon: <Volume2 className="size-4" /> },
	{ id: "gameplay", label: "Gameplay", icon: <Gamepad2 className="size-4" /> },
	{ id: "controls", label: "Controls", icon: <Keyboard className="size-4" /> },
	{ id: "language", label: "Language", icon: <Globe className="size-4" /> },
	{ id: "developer", label: "Developer", icon: <Code2 className="size-4" /> },
];

function NvSwitch({
	checked,
	onCheckedChange,
	disabled,
}: {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	disabled?: boolean;
}) {
	return (
		<Switch.Root checked={checked} className={cn(`
    relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center
    rounded-full border transition-colors
    focus-visible:ring-2 focus-visible:ring-(--nv-focus-ring)
    focus-visible:outline-none
    disabled:cursor-not-allowed disabled:opacity-40
  `, checked ? "border-cyan-400/40 bg-cyan-400/24" : `
    border-white/16 bg-white/8
  `)} disabled={disabled} onCheckedChange={onCheckedChange}>
			<Switch.Thumb className={cn(`
     pointer-events-none block size-3.5 rounded-full shadow-sm
     transition-transform
   `, checked ? "translate-x-[18px] bg-cyan-300" : `
     translate-x-[3px] bg-white/50
   `)} />
		</Switch.Root>
	);
}

function SettingsRow({
	label,
	description,
	children,
}: {
	label: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-4 py-3">
			<div className="min-w-0">
				<p className="text-sm font-medium text-(--nv-text-primary)">{label}</p>
				{description ? (
					<p className="mt-0.5 text-xs text-(--nv-text-muted)">{description}</p>
				) : null}
			</div>
			<div className="shrink-0">{children}</div>
		</div>
	);
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div
			className="
     mb-6
     last:mb-0
   "
		>
			<h3
				className="
      mb-1 text-[10px] font-semibold tracking-[0.14em] text-(--nv-text-muted)
      uppercase
    "
			>
				{title}
			</h3>
			<NvDivider className="mb-1" />
			<div>{children}</div>
		</div>
	);
}

function ProfilePanel() {
	const { isAuthenticated } = useConvexAuth();
	const profile = useQuery(api.auth.getCurrentPlayerProfile, isAuthenticated ? {} : "skip");
	const updateCurrentPlayerDisplayName = useMutation(api.auth.updateCurrentPlayerDisplayName);
	const [displayName, setDisplayName] = useState("");
	const [bio, setBio] = useState("");
	const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);

	useEffect(() => {
		if (!profile?.displayName) {
			return;
		}
		setDisplayName(profile.displayName);
	}, [profile?.displayName]);

	const saveDisplayName = async () => {
		const trimmedDisplayName = displayName.trim();
		if (trimmedDisplayName.length < 3) {
			toast.error("Display name must be at least 3 characters");
			return;
		}
		if (trimmedDisplayName.length > 32) {
			toast.error("Display name must be 32 characters or fewer");
			return;
		}
		if (!profile || trimmedDisplayName === profile.displayName) {
			return;
		}

		setIsSavingDisplayName(true);
		const error = await updateCurrentPlayerDisplayName({
				displayName: trimmedDisplayName,
			})
				.then(() => null)
				.catch((caughtError) => caughtError);
		setIsSavingDisplayName(false);
		if (error) {
			toast.error(error instanceof Error ? error.message : "Failed to update display name");
		} else {
			toast.success("Display name updated");
		}
	};

	return (
		<>
			<SettingsSection title="Account">
				<SettingsRow label="Display Name" description="Visible to other players in-game">
					<div className="flex items-center gap-2">
						<NvInput
							className="w-48"
							maxLength={32}
							onChange={(e) => setDisplayName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									void saveDisplayName();
								}
							}}
							placeholder="Enter name"
							value={displayName}
						/>
						<button
							className="
         inline-flex items-center gap-1.5 rounded-md border border-white/12
         bg-white/4 px-3 py-1.5 text-xs font-medium text-(--nv-text-secondary)
         transition
         hover:bg-white/8 hover:text-white
         disabled:opacity-50
       "
							disabled={
								isSavingDisplayName ||
								!profile ||
								displayName.trim().length < 3 ||
								displayName.trim() === profile.displayName
							}
							onClick={() => {
								void saveDisplayName();
							}}
							type="button"
						>
							{isSavingDisplayName ? "Saving..." : "Save"}
						</button>
					</div>
				</SettingsRow>
				<SettingsRow label="Email" description="Used for account recovery">
					<span className="text-sm text-(--nv-text-secondary)">
						{profile?.email ?? "No email available"}
					</span>
				</SettingsRow>
				<SettingsRow label="Bio" description="A short description for your profile">
					<NvInput
						className="w-48"
						maxLength={140}
						onChange={(e) => setBio(e.target.value)}
						placeholder="Tell us about yourself..."
						value={bio}
					/>
				</SettingsRow>
			</SettingsSection>
			<SettingsSection title="Avatar">
				<div className="flex items-center gap-4 py-3">
					<div
						className="
        flex size-16 items-center justify-center rounded-xl border
        border-white/12 bg-white/4
      "
					>
						<User className="size-7 text-(--nv-text-muted)" />
					</div>
					<div>
						<p className="text-sm text-(--nv-text-secondary)">No avatar uploaded</p>
						<button
							className="
         mt-1 text-xs font-medium text-cyan-400 transition-colors
         hover:text-cyan-300
       "
							type="button"
						>
							Upload avatar
						</button>
					</div>
				</div>
			</SettingsSection>
		</>
	);
}

function PrivacyPanel() {
	const [profileVisibility, setProfileVisibility] = useState("friends");
	const [showOnlineStatus, setShowOnlineStatus] = useState(true);
	const [allowMessages, setAllowMessages] = useState(true);
	const [showColonyCoords, setShowColonyCoords] = useState(false);
	const [twoFactor, setTwoFactor] = useState(false);

	return (
		<>
			<SettingsSection title="Visibility">
				<SettingsRow label="Profile Visibility" description="Who can view your player profile">
					<NvSelect
						className="w-36"
						onValueChange={setProfileVisibility}
						options={[
							{ label: "Everyone", value: "everyone" },
							{ label: "Friends", value: "friends" },
							{ label: "Nobody", value: "nobody" },
						]}
						value={profileVisibility}
					/>
				</SettingsRow>
				<SettingsRow label="Online Status" description="Show when you're active in-game">
					<NvSwitch checked={showOnlineStatus} onCheckedChange={setShowOnlineStatus} />
				</SettingsRow>
				<SettingsRow
					label="Colony Coordinates"
					description="Reveal colony locations on the star map"
				>
					<NvSwitch checked={showColonyCoords} onCheckedChange={setShowColonyCoords} />
				</SettingsRow>
			</SettingsSection>
			<SettingsSection title="Communication">
				<SettingsRow label="Direct Messages" description="Allow other players to message you">
					<NvSwitch checked={allowMessages} onCheckedChange={setAllowMessages} />
				</SettingsRow>
			</SettingsSection>
			<SettingsSection title="Security">
				<SettingsRow label="Two-Factor Authentication" description="Protect your account with 2FA">
					<NvSwitch checked={twoFactor} onCheckedChange={setTwoFactor} />
				</SettingsRow>
				<SettingsRow label="Active Sessions" description="Manage devices signed into your account">
					<button
						className="
        inline-flex items-center gap-1 text-xs font-medium text-cyan-400
        transition-colors
        hover:text-cyan-300
      "
						type="button"
					>
						View <ChevronRight className="size-3" />
					</button>
				</SettingsRow>
			</SettingsSection>
		</>
	);
}

function NotificationsPanel() {
	const { isAuthenticated } = useConvexAuth();
	const preferences = useQuery(
		api.notifications.getNotificationPreferences,
		isAuthenticated ? {} : "skip",
	);
	const updateNotificationPreferences = useMutation(
		api.notifications.updateNotificationPreferences,
	);
	const [savingKind, setSavingKind] = useState<string | null>(null);

	const savePreference = async (
		kind:
			| "raidResolved"
			| "contractResolved"
			| "transportDelivered"
			| "transportReceived"
			| "transportReturned"
			| "operationFailed",
		enabled: boolean,
	) => {
		setSavingKind(kind);
		const error = await updateNotificationPreferences({
				preferences: {
					[kind]: enabled,
				},
			})
				.then(() => null)
				.catch((caughtError) => caughtError);
		setSavingKind(null);
		if (error) {
			toast.error(error instanceof Error ? error.message : "Failed to update preferences");
		}
	};

	if (!isAuthenticated) {
		return (
			<SettingsSection title="Notifications">
				<p className="py-3 text-sm text-(--nv-text-muted)">
					Sign in to manage notification preferences.
				</p>
			</SettingsSection>
		);
	}

	return (
		<>
			<SettingsSection title="Critical">
				<SettingsRow
					label="Incoming Raids"
					description="Critical hostile approach warnings are always enabled."
				>
					<div className="flex items-center gap-2 text-(--nv-text-muted)">
						<Lock className="size-3.5" />
						<NvSwitch
							checked={preferences?.settings.raidIncoming.enabled ?? true}
							disabled
							onCheckedChange={() => {}}
						/>
					</div>
				</SettingsRow>
			</SettingsSection>

			<SettingsSection title="Combat">
				<SettingsRow label="Raid Results" description="Battle outcomes, salvage, and XP deltas">
					<div className="flex items-center gap-2">
						{savingKind === "raidResolved" ? (
							<LoaderCircle className="size-3.5 animate-spin text-(--nv-text-muted)" />
						) : null}
						<NvSwitch
							checked={preferences?.settings.raidResolved.enabled ?? true}
							disabled={!preferences || savingKind !== null}
							onCheckedChange={(checked) => {
								void savePreference("raidResolved", checked);
							}}
						/>
					</div>
				</SettingsRow>
				<SettingsRow label="Contract Results" description="Contract success, rewards, and losses">
					<div className="flex items-center gap-2">
						{savingKind === "contractResolved" ? (
							<LoaderCircle className="size-3.5 animate-spin text-(--nv-text-muted)" />
						) : null}
						<NvSwitch
							checked={preferences?.settings.contractResolved.enabled ?? true}
							disabled={!preferences || savingKind !== null}
							onCheckedChange={(checked) => {
								void savePreference("contractResolved", checked);
							}}
						/>
					</div>
				</SettingsRow>
			</SettingsSection>

			<SettingsSection title="Fleet">
				<SettingsRow
					label="Transport Delivered"
					description="Cargo delivered by your outbound fleets"
				>
					<div className="flex items-center gap-2">
						{savingKind === "transportDelivered" ? (
							<LoaderCircle className="size-3.5 animate-spin text-(--nv-text-muted)" />
						) : null}
						<NvSwitch
							checked={preferences?.settings.transportDelivered.enabled ?? true}
							disabled={!preferences || savingKind !== null}
							onCheckedChange={(checked) => {
								void savePreference("transportDelivered", checked);
							}}
						/>
					</div>
				</SettingsRow>
				<SettingsRow
					label="Transport Received"
					description="Cargo arriving from other colonies or players"
				>
					<div className="flex items-center gap-2">
						{savingKind === "transportReceived" ? (
							<LoaderCircle className="size-3.5 animate-spin text-(--nv-text-muted)" />
						) : null}
						<NvSwitch
							checked={preferences?.settings.transportReceived.enabled ?? true}
							disabled={!preferences || savingKind !== null}
							onCheckedChange={(checked) => {
								void savePreference("transportReceived", checked);
							}}
						/>
					</div>
				</SettingsRow>
				<SettingsRow
					label="Transport Returned"
					description="Fleet returns after completing a transport"
				>
					<div className="flex items-center gap-2">
						{savingKind === "transportReturned" ? (
							<LoaderCircle className="size-3.5 animate-spin text-(--nv-text-muted)" />
						) : null}
						<NvSwitch
							checked={preferences?.settings.transportReturned.enabled ?? true}
							disabled={!preferences || savingKind !== null}
							onCheckedChange={(checked) => {
								void savePreference("transportReturned", checked);
							}}
						/>
					</div>
				</SettingsRow>
				<SettingsRow
					label="Operation Failures"
					description="Transport, colonize, contract, and combat failures"
				>
					<div className="flex items-center gap-2">
						{savingKind === "operationFailed" ? (
							<LoaderCircle className="size-3.5 animate-spin text-(--nv-text-muted)" />
						) : null}
						<NvSwitch
							checked={preferences?.settings.operationFailed.enabled ?? true}
							disabled={!preferences || savingKind !== null}
							onCheckedChange={(checked) => {
								void savePreference("operationFailed", checked);
							}}
						/>
					</div>
				</SettingsRow>
			</SettingsSection>

			<SettingsSection title="Email">
				<SettingsRow
					label="Email Delivery"
					description="Email notification delivery is not available yet."
				>
					<span className="text-xs text-(--nv-text-muted)">Coming soon</span>
				</SettingsRow>
			</SettingsSection>
		</>
	);
}

function DisplayPanel() {
	const [theme, setTheme] = useState("neon-dockyard");
	const [compactMode, setCompactMode] = useState(false);
	const [animatedBg, setAnimatedBg] = useState(true);
	const [showResourceDelta, setShowResourceDelta] = useState(true);
	const [uiScale, setUiScale] = useState("100");

	return (
		<>
			<SettingsSection title="Theme">
				<SettingsRow label="Visual Theme" description="Customize the look of the interface">
					<NvSelect
						className="w-36"
						onValueChange={setTheme}
						options={[
							{ label: "Neon Dockyard", value: "neon-dockyard" },
							{ label: "Deep Space", value: "deep-space" },
							{ label: "Solar Flare", value: "solar-flare" },
						]}
						value={theme}
					/>
				</SettingsRow>
				<SettingsRow label="Animated Backgrounds" description="Decorative background effects">
					<NvSwitch checked={animatedBg} onCheckedChange={setAnimatedBg} />
				</SettingsRow>
			</SettingsSection>
			<SettingsSection title="Layout">
				<SettingsRow label="Compact Mode" description="Reduce spacing for smaller screens">
					<NvSwitch checked={compactMode} onCheckedChange={setCompactMode} />
				</SettingsRow>
				<SettingsRow label="UI Scale" description="Adjust the overall interface size">
					<NvSelect
						className="w-36"
						onValueChange={setUiScale}
						options={[
							{ label: "90%", value: "90" },
							{ label: "100%", value: "100" },
							{ label: "110%", value: "110" },
							{ label: "125%", value: "125" },
						]}
						value={uiScale}
					/>
				</SettingsRow>
				<SettingsRow
					label="Resource Delta"
					description="Show per-minute production rates in the header"
				>
					<NvSwitch checked={showResourceDelta} onCheckedChange={setShowResourceDelta} />
				</SettingsRow>
			</SettingsSection>
		</>
	);
}

function AudioPanel() {
	const [masterVolume, setMasterVolume] = useState(80);
	const [sfxVolume, setSfxVolume] = useState(70);
	const [musicVolume, setMusicVolume] = useState(50);
	const [ambientSounds, setAmbientSounds] = useState(true);

	return (
		<>
			<SettingsSection title="Volume">
				<SettingsRow label="Master Volume">
					<div className="flex w-48 items-center gap-3">
						<input
							className="
         h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/12
         accent-cyan-400
         [&::-webkit-slider-thumb]:size-3.5
         [&::-webkit-slider-thumb]:appearance-none
         [&::-webkit-slider-thumb]:rounded-full
         [&::-webkit-slider-thumb]:bg-cyan-400
       "
							max={100}
							min={0}
							onChange={(e) => setMasterVolume(Number(e.target.value))}
							type="range"
							value={masterVolume}
						/>
						<span
							className="
         w-8 text-right font-(family-name:--nv-font-mono) text-xs
         text-(--nv-text-muted)
       "
						>
							{masterVolume}
						</span>
					</div>
				</SettingsRow>
				<SettingsRow label="Sound Effects">
					<div className="flex w-48 items-center gap-3">
						<input
							className="
         h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/12
         accent-cyan-400
         [&::-webkit-slider-thumb]:size-3.5
         [&::-webkit-slider-thumb]:appearance-none
         [&::-webkit-slider-thumb]:rounded-full
         [&::-webkit-slider-thumb]:bg-cyan-400
       "
							max={100}
							min={0}
							onChange={(e) => setSfxVolume(Number(e.target.value))}
							type="range"
							value={sfxVolume}
						/>
						<span
							className="
         w-8 text-right font-(family-name:--nv-font-mono) text-xs
         text-(--nv-text-muted)
       "
						>
							{sfxVolume}
						</span>
					</div>
				</SettingsRow>
				<SettingsRow label="Music">
					<div className="flex w-48 items-center gap-3">
						<input
							className="
         h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/12
         accent-cyan-400
         [&::-webkit-slider-thumb]:size-3.5
         [&::-webkit-slider-thumb]:appearance-none
         [&::-webkit-slider-thumb]:rounded-full
         [&::-webkit-slider-thumb]:bg-cyan-400
       "
							max={100}
							min={0}
							onChange={(e) => setMusicVolume(Number(e.target.value))}
							type="range"
							value={musicVolume}
						/>
						<span
							className="
         w-8 text-right font-(family-name:--nv-font-mono) text-xs
         text-(--nv-text-muted)
       "
						>
							{musicVolume}
						</span>
					</div>
				</SettingsRow>
			</SettingsSection>
			<SettingsSection title="Ambient">
				<SettingsRow label="Ambient Sounds" description="Background colony and space sounds">
					<NvSwitch checked={ambientSounds} onCheckedChange={setAmbientSounds} />
				</SettingsRow>
			</SettingsSection>
		</>
	);
}

function GameplayPanel() {
	const [autoQueue, setAutoQueue] = useState(false);
	const [confirmActions, setConfirmActions] = useState(true);
	const [fleetSpeed, setFleetSpeed] = useState("normal");
	const [tutorialHints, setTutorialHints] = useState(true);

	return (
		<>
			<SettingsSection title="Automation">
				<SettingsRow
					label="Auto-Queue Builds"
					description="Automatically re-queue completed builds"
				>
					<NvSwitch checked={autoQueue} onCheckedChange={setAutoQueue} />
				</SettingsRow>
			</SettingsSection>
			<SettingsSection title="Confirmation">
				<SettingsRow
					label="Confirm Destructive Actions"
					description="Require confirmation for fleet attacks, demolitions, etc."
				>
					<NvSwitch checked={confirmActions} onCheckedChange={setConfirmActions} />
				</SettingsRow>
			</SettingsSection>
			<SettingsSection title="Fleet">
				<SettingsRow label="Default Fleet Speed" description="Speed preset for new missions">
					<NvSelect
						className="w-36"
						onValueChange={setFleetSpeed}
						options={[
							{ label: "Cautious", value: "cautious" },
							{ label: "Normal", value: "normal" },
							{ label: "Maximum", value: "maximum" },
						]}
						value={fleetSpeed}
					/>
				</SettingsRow>
			</SettingsSection>
			<SettingsSection title="Help">
				<SettingsRow label="Tutorial Hints" description="Show contextual tips for new features">
					<NvSwitch checked={tutorialHints} onCheckedChange={setTutorialHints} />
				</SettingsRow>
			</SettingsSection>
		</>
	);
}

function ControlsPanel() {
	return (
		<>
			<SettingsSection title="Star Map">
				<SettingsRow label="Pan" description="Click and drag to pan the view">
					<span
						className="
        inline-flex items-center gap-1 rounded-md border border-white/12
        bg-white/4 px-2 py-0.5 font-(family-name:--nv-font-mono) text-[11px]
        text-(--nv-text-secondary)
      "
					>
						Mouse Drag
					</span>
				</SettingsRow>
				<SettingsRow label="Zoom" description="Scroll to zoom in and out">
					<span
						className="
        inline-flex items-center gap-1 rounded-md border border-white/12
        bg-white/4 px-2 py-0.5 font-(family-name:--nv-font-mono) text-[11px]
        text-(--nv-text-secondary)
      "
					>
						Scroll Wheel
					</span>
				</SettingsRow>
				<SettingsRow label="Select" description="Click on an object to select it">
					<span
						className="
        inline-flex items-center gap-1 rounded-md border border-white/12
        bg-white/4 px-2 py-0.5 font-(family-name:--nv-font-mono) text-[11px]
        text-(--nv-text-secondary)
      "
					>
						Left Click
					</span>
				</SettingsRow>
			</SettingsSection>
			<SettingsSection title="Shortcuts">
				<SettingsRow label="Open Star Map">
					<span
						className="
        inline-flex items-center gap-1 rounded-md border border-white/12
        bg-white/4 px-2 py-0.5 font-(family-name:--nv-font-mono) text-[11px]
        text-(--nv-text-secondary)
      "
					>
						M
					</span>
				</SettingsRow>
				<SettingsRow label="Open Settings">
					<span
						className="
        inline-flex items-center gap-1 rounded-md border border-white/12
        bg-white/4 px-2 py-0.5 font-(family-name:--nv-font-mono) text-[11px]
        text-(--nv-text-secondary)
      "
					>
						Esc
					</span>
				</SettingsRow>
				<SettingsRow label="Toggle Resource Panel">
					<span
						className="
        inline-flex items-center gap-1 rounded-md border border-white/12
        bg-white/4 px-2 py-0.5 font-(family-name:--nv-font-mono) text-[11px]
        text-(--nv-text-secondary)
      "
					>
						R
					</span>
				</SettingsRow>
			</SettingsSection>
		</>
	);
}

function LanguagePanel() {
	const [language, setLanguage] = useState("en");
	const [dateFormat, setDateFormat] = useState("relative");
	const [numberFormat, setNumberFormat] = useState("abbreviated");

	return (
		<>
			<SettingsSection title="Language">
				<SettingsRow label="Interface Language" description="Language used throughout the game UI">
					<NvSelect
						className="w-40"
						onValueChange={setLanguage}
						options={[
							{ label: "English", value: "en" },
							{ label: "Deutsch", value: "de" },
							{ label: "Francais", value: "fr" },
							{ label: "Espanol", value: "es" },
							{ label: "Portugues", value: "pt" },
						]}
						value={language}
					/>
				</SettingsRow>
			</SettingsSection>
			<SettingsSection title="Formatting">
				<SettingsRow label="Date Display" description="How timestamps are displayed">
					<NvSelect
						className="w-40"
						onValueChange={setDateFormat}
						options={[
							{ label: "Relative (2h ago)", value: "relative" },
							{ label: "Absolute", value: "absolute" },
						]}
						value={dateFormat}
					/>
				</SettingsRow>
				<SettingsRow label="Number Format" description="How large numbers are displayed">
					<NvSelect
						className="w-40"
						onValueChange={setNumberFormat}
						options={[
							{ label: "Abbreviated (1.2k)", value: "abbreviated" },
							{ label: "Full (1,200)", value: "full" },
						]}
						value={numberFormat}
					/>
				</SettingsRow>
			</SettingsSection>
		</>
	);
}

function DeveloperPanel({ activeColonyId }: { activeColonyId: Id<"colonies"> | null }) {
	const { isAuthenticated } = useConvexAuth();
	const [debugOverlays, setDebugOverlays] = useState(false);
	const [verboseLogging, setVerboseLogging] = useState(false);
	const [showQueryTiming, setShowQueryTiming] = useState(false);
	const [simulationSpeed, setSimulationSpeed] = useState("1x");
	const [bypassCooldowns, setBypassCooldowns] = useState(false);
	const [showEntityIds, setShowEntityIds] = useState(false);
	const [isTriggeringRaid, setIsTriggeringRaid] = useState(false);
	const devConsoleState = useQuery(
		api.devConsole.getDevConsoleState,
		activeColonyId && isAuthenticated ? { colonyId: activeColonyId } : "skip",
	);
	const setDevConsoleUiEnabled = useMutation(api.devConsole.setDevConsoleUiEnabled);
	const triggerNpcRaidAtCurrentColony = useMutation(api.devConsole.triggerNpcRaidAtCurrentColony);
	const devConsoleUiEnabled = devConsoleState?.showDevConsoleUi === true;
	const canUseDevConsole = devConsoleState?.canUseDevConsole === true;
	const canToggleDevConsoleUi = activeColonyId !== null && isAuthenticated;

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

			<SettingsSection title="Debug">
				<SettingsRow
					label="Debug Overlays"
					description="Show FPS counter, render stats, and query waterfall"
				>
					<NvSwitch checked={debugOverlays} onCheckedChange={setDebugOverlays} />
				</SettingsRow>
				<SettingsRow
					label="Verbose Logging"
					description="Log detailed event traces to the browser console"
				>
					<NvSwitch checked={verboseLogging} onCheckedChange={setVerboseLogging} />
				</SettingsRow>
				<SettingsRow
					label="Query Timing"
					description="Display query round-trip times in the resource strip"
				>
					<NvSwitch checked={showQueryTiming} onCheckedChange={setShowQueryTiming} />
				</SettingsRow>
				<SettingsRow
					label="Show Entity IDs"
					description="Display Convex document IDs next to game objects"
				>
					<NvSwitch checked={showEntityIds} onCheckedChange={setShowEntityIds} />
				</SettingsRow>
			</SettingsSection>

			<SettingsSection title="Simulation">
				<SettingsRow label="Simulation Speed" description="Accelerate game time for testing">
					<NvSelect
						className="w-36"
						onValueChange={setSimulationSpeed}
						options={[
							{ label: "1x (Real)", value: "1x" },
							{ label: "10x", value: "10x" },
							{ label: "100x", value: "100x" },
							{ label: "1000x", value: "1000x" },
						]}
						value={simulationSpeed}
					/>
				</SettingsRow>
				<SettingsRow label="Bypass Cooldowns" description="Skip queue timers and build durations">
					<NvSwitch checked={bypassCooldowns} onCheckedChange={setBypassCooldowns} />
				</SettingsRow>
			</SettingsSection>

			{canUseDevConsole ? (
				<SettingsSection title="Dev Console">
					<SettingsRow
						label="Enable Console UI"
						description="Show developer console controls in colony screens for this player."
					>
						<NvSwitch
							checked={devConsoleUiEnabled}
							disabled={!canToggleDevConsoleUi}
							onCheckedChange={(checked) => {
								void setDevConsoleUiEnabled({ enabled: checked });
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
							disabled={!activeColonyId || isTriggeringRaid}
							onClick={() => {
								if (!activeColonyId) {
									toast.error("Open settings from a colony route to trigger a raid");
									return;
								}

								setIsTriggeringRaid(true);
								void triggerNpcRaidAtCurrentColony({
									colonyId: activeColonyId,
								})
									.then((result) => {
										if (result.raidOperationId) {
											toast.success("NPC raid launched toward the current colony");
											return;
										}
										toast.error("No hostile source available to launch a raid");
									})
									.catch((error) => {
										toast.error(error instanceof Error ? error.message : "Failed to trigger raid");
									})
									.finally(() => {
										setIsTriggeringRaid(false);
									});
							}}
							type="button"
						>
							{isTriggeringRaid ? "Launching..." : "Launch Raid"}
						</button>
					</SettingsRow>
				</SettingsSection>
			) : null}

			<SettingsSection title="Data">
				<SettingsRow label="Export Colony State" description="Download raw colony data as JSON">
					<button
						className="
        inline-flex items-center gap-1.5 rounded-md border border-white/12
        bg-white/4 px-3 py-1.5 text-xs font-medium text-(--nv-text-secondary)
        transition
        hover:bg-white/8 hover:text-white
      "
						type="button"
					>
						Export
					</button>
				</SettingsRow>
				<SettingsRow
					label="Clear Local Storage"
					description="Reset cached preferences and session data"
				>
					<button
						className="
        inline-flex items-center gap-1.5 rounded-md border
        border-[rgba(255,111,136,0.35)] bg-[rgba(255,111,136,0.08)] px-3 py-1.5
        text-xs font-medium text-[#ffd4dd] transition
        hover:bg-[rgba(255,111,136,0.15)]
      "
						type="button"
					>
						Clear
					</button>
				</SettingsRow>
			</SettingsSection>
		</>
	);
}

const PANELS: Record<
	string,
	(props: { activeColonyId: Id<"colonies"> | null }) => React.ReactNode
> = {
	profile: ProfilePanel,
	privacy: PrivacyPanel,
	notifications: NotificationsPanel,
	display: DisplayPanel,
	audio: AudioPanel,
	gameplay: GameplayPanel,
	controls: ControlsPanel,
	language: LanguagePanel,
	developer: DeveloperPanel,
};

export function SettingsModal({
	activeColonyId,
	open,
	onOpenChange,
}: {
	activeColonyId: Id<"colonies"> | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [activeCategoryId, setActiveCategoryId] = useState("profile");
	const activeCategory = CATEGORIES.find((c) => c.id === activeCategoryId) ?? CATEGORIES[0];
	const ActivePanel = PANELS[activeCategoryId] ?? ProfilePanel;

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
       fixed top-1/2 left-1/2 z-100 flex h-[min(86vh,680px)] w-[min(96vw,920px)]
       -translate-1/2 overflow-hidden rounded-2xl border border-white/10
       bg-[linear-gradient(170deg,rgba(10,16,28,0.97),rgba(6,10,18,0.99))]
       shadow-[0_24px_80px_rgba(0,0,0,0.6)] transition-all duration-200
       data-ending-style:scale-95 data-ending-style:opacity-0
       data-starting-style:scale-95 data-starting-style:opacity-0
     "
				>
					{/* Sidebar */}
					<div
						className="
        flex w-56 shrink-0 flex-col border-r border-white/8
        bg-[rgba(5,10,20,0.5)]
      "
					>
						<div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
							<Eye className="size-4 text-cyan-400/70" />
							<Dialog.Title
								className="
          font-(family-name:--nv-font-display) text-sm font-bold
          text-(--nv-text-primary)
        "
							>
								Settings
							</Dialog.Title>
						</div>
						<Dialog.Description className="sr-only">
							Configure your account, privacy, notifications, display, and gameplay preferences.
						</Dialog.Description>

						<NvScrollArea className="flex-1 px-2 pb-4">
							<nav className="space-y-0.5">
								{CATEGORIES.map((category) => (
									<Fragment key={category.id}>
										{category.id === "developer" ? <NvDivider className="my-2" /> : null}
										<button className={cn(`
            flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left
            text-[13px] font-medium transition-all
          `, category.id === activeCategoryId ? `
            bg-cyan-400/10 text-cyan-50
            shadow-[inset_0_0_0_1px_rgba(61,217,255,0.18)]
          ` : `
            text-(--nv-text-muted)
            hover:bg-white/4 hover:text-(--nv-text-secondary)
          `)} onClick={() => setActiveCategoryId(category.id)} type="button">
											<span
												className={cn(
													"shrink-0 transition-colors",
													category.id === activeCategoryId
														? "text-cyan-400/80"
														: "text-(--nv-text-muted)",
												)}
											>
												{category.icon}
											</span>
											{category.label}
										</button>
									</Fragment>
								))}
							</nav>
						</NvScrollArea>

						<div className="border-t border-white/6 px-4 py-3">
							<p className="text-[10px] text-(--nv-text-muted)">Nullvector v0.1.0</p>
						</div>
					</div>

					{/* Content */}
					<div className="flex min-w-0 flex-1 flex-col">
						<div
							className="
         flex items-center justify-between border-b border-white/8 px-6 py-4
       "
						>
							<div className="flex items-center gap-2.5">
								<span className="text-cyan-400/70">{activeCategory.icon}</span>
								<h2
									className="
           font-(family-name:--nv-font-display) text-base font-bold
           text-(--nv-text-primary)
         "
								>
									{activeCategory.label}
								</h2>
							</div>
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

						<NvScrollArea className="flex-1 px-6 py-5">
							<ActivePanel activeColonyId={activeColonyId} />
						</NvScrollArea>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
