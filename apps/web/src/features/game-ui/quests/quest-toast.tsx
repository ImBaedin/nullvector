import { type CSSProperties, type ReactNode, useState } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type ObjectiveProgress = {
	complete: boolean;
	current: number;
	required: number;
};

export type QuestProgressToastArgs = {
	description: string;
	objectives: ObjectiveProgress[];
	questId: string;
	title: string;
};

export type QuestClaimableToastArgs = {
	onClaim: () => Promise<void>;
	questId: string;
	title: string;
};

export type QuestActivatedToastArgs = {
	onView?: () => void;
	questId: string;
	title: string;
};

// ─── Shared shell ─────────────────────────────────────────────────────────────
//
// All three toast variants use the same NV dark glass shell with a 3px
// left accent bar. The accent color is the only visual difference between
// variants — cyan for progress/activated, emerald for claimable.

const SHELL: CSSProperties = {
	position: "relative",
	overflow: "hidden",
	width: "var(--width, 356px)",
	background: "linear-gradient(170deg, rgba(10,17,30,0.97), rgba(6,11,20,0.99))",
	border: "1px solid rgba(123,173,255,0.12)",
	borderRadius: "10px",
	padding: "14px 16px 14px 19px",
	boxShadow: "0 8px 28px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03)",
	backdropFilter: "blur(14px)",
	display: "flex",
	alignItems: "flex-start",
	gap: "10px",
	fontFamily: "inherit",
};

function ClaimQuestButton(props: { onClaim: () => Promise<void>; toastId: string | number }) {
	const [isPending, setIsPending] = useState(false);

	async function handleClick() {
		if (isPending) {
			return;
		}
		setIsPending(true);
		void props
			.onClaim()
			.then(() => {
				toast.dismiss(props.toastId);
			})
			.catch((error) => {
				toast.error(error instanceof Error ? error.message : "Failed to claim quest");
			})
			.finally(() => {
				setIsPending(false);
			});
	}

	return (
		<button
			disabled={isPending}
			onClick={() => {
				void handleClick();
			}}
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: "4px",
				padding: "4px 10px",
				fontSize: "11px",
				fontWeight: 600,
				color: "rgba(52,211,153,0.9)",
				background: "rgba(52,211,153,0.1)",
				border: "1px solid rgba(52,211,153,0.25)",
				borderRadius: "5px",
				cursor: isPending ? "default" : "pointer",
				letterSpacing: "0.01em",
				opacity: isPending ? 0.6 : 1,
				transition: "background 0.15s, border-color 0.15s",
			}}
			type="button"
		>
			{isPending ? "Claiming..." : "Claim →"}
		</button>
	);
}

function AccentBar({ color }: { color: string }) {
	return (
		<div
			style={{
				position: "absolute",
				left: 0,
				top: 0,
				bottom: 0,
				width: "3px",
				background: color,
			}}
		/>
	);
}

function ToastTitle({ children }: { children: ReactNode }) {
	return (
		<p
			style={{
				fontSize: "13px",
				fontWeight: 600,
				color: "#edf5ff",
				lineHeight: 1.35,
				marginBottom: "2px",
			}}
		>
			{children}
		</p>
	);
}

function ToastDescription({ children, mb = 0 }: { children: ReactNode; mb?: number }) {
	return (
		<p
			style={{
				fontSize: "12px",
				color: "#7f94af",
				lineHeight: 1.4,
				marginBottom: mb,
			}}
		>
			{children}
		</p>
	);
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
	const clamped = Math.max(0, Math.min(100, value));
	return (
		<div
			style={{
				height: "3px",
				borderRadius: "2px",
				background: "rgba(255,255,255,0.08)",
				overflow: "hidden",
				flex: 1,
			}}
		>
			<div
				style={{
					height: "100%",
					borderRadius: "2px",
					width: `${clamped}%`,
					background: "linear-gradient(90deg, rgba(61,217,255,0.6), rgba(61,217,255,0.9))",
					transition: "width 0.3s ease",
				}}
			/>
		</div>
	);
}

// ─── Quest Progress Toast ─────────────────────────────────────────────────────

export function showQuestProgressToast(args: QuestProgressToastArgs) {
	const { title, description, objectives, questId } = args;

	const mostAdvancedObjective = objectives.reduce<ObjectiveProgress | null>((best, obj) => {
		if (!best) return obj;
		const objRatio = obj.required > 0 ? obj.current / obj.required : 0;
		const bestRatio = best.required > 0 ? best.current / best.required : 0;
		return objRatio > bestRatio ? obj : best;
	}, null);

	toast.custom(
		() => (
			<div style={SHELL}>
				<AccentBar color="rgba(61,217,255,0.55)" />

				{/* Quest list icon */}
				<div
					style={{
						width: "16px",
						height: "16px",
						flexShrink: 0,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						marginTop: "1px",
					}}
				>
					<svg
						fill="none"
						height="14"
						viewBox="0 0 14 14"
						width="14"
						xmlns="http://www.w3.org/2000/svg"
					>
						<rect
							height="12"
							rx="2"
							stroke="rgba(61,217,255,0.5)"
							strokeWidth="1.25"
							width="10"
							x="2"
							y="1"
						/>
						<line
							stroke="rgba(61,217,255,0.5)"
							strokeLinecap="round"
							strokeWidth="1.25"
							x1="4.5"
							x2="9.5"
							y1="5"
							y2="5"
						/>
						<line
							stroke="rgba(61,217,255,0.5)"
							strokeLinecap="round"
							strokeWidth="1.25"
							x1="4.5"
							x2="7.5"
							y1="8"
							y2="8"
						/>
					</svg>
				</div>

				<div style={{ flex: 1, minWidth: 0 }}>
					<ToastTitle>{title}</ToastTitle>
					<ToastDescription mb={mostAdvancedObjective ? 8 : 0}>{description}</ToastDescription>
					{mostAdvancedObjective ? (
						<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<ProgressBar
								value={
									mostAdvancedObjective.required > 0
										? (mostAdvancedObjective.current / mostAdvancedObjective.required) * 100
										: 0
								}
							/>
							<span
								style={{
									fontSize: "11px",
									color: "rgba(61,217,255,0.6)",
									whiteSpace: "nowrap",
									fontVariantNumeric: "tabular-nums",
									fontWeight: 600,
								}}
							>
								{mostAdvancedObjective.current.toLocaleString()} /{" "}
								{mostAdvancedObjective.required.toLocaleString()}
							</span>
						</div>
					) : null}
				</div>
			</div>
		),
		{
			id: `quest-progress-${questId}`,
			duration: 3000,
			unstyled: true,
		},
	);
}

// ─── Quest Claimable Toast ────────────────────────────────────────────────────
//
// Emerald left accent — mirrors the success ::before color in tokens.css.
// Inline "Claim →" button avoids Sonner's native action API so the button
// can be styled to match the NV shell.

export function showQuestClaimableToast(args: QuestClaimableToastArgs) {
	const { title, questId, onClaim } = args;

	toast.custom(
		(t) => (
			<div style={SHELL}>
				<AccentBar color="rgba(52,211,153,0.7)" />

				{/* Checkmark icon */}
				<div
					style={{
						width: "16px",
						height: "16px",
						flexShrink: 0,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						marginTop: "1px",
					}}
				>
					<svg
						fill="none"
						height="14"
						viewBox="0 0 14 14"
						width="14"
						xmlns="http://www.w3.org/2000/svg"
					>
						<circle cx="7" cy="7" r="5.5" stroke="rgba(52,211,153,0.6)" strokeWidth="1.25" />
						<polyline
							points="4.5,7 6.2,8.8 9.5,5.2"
							stroke="rgba(52,211,153,0.85)"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="1.25"
						/>
					</svg>
				</div>

				<div style={{ flex: 1, minWidth: 0 }}>
					<ToastTitle>{title}</ToastTitle>
					<ToastDescription mb={10}>Quest complete — claim your reward</ToastDescription>
					<ClaimQuestButton onClaim={onClaim} toastId={t} />
				</div>
			</div>
		),
		{
			id: `quest-claimable-${questId}`,
			duration: Infinity,
			unstyled: true,
		},
	);
}

// ─── Quest Activated Toast ────────────────────────────────────────────────────
//
// Cyan left accent — matches the default ::before color in tokens.css.

export function showQuestActivatedToast(args: QuestActivatedToastArgs) {
	const { title, questId, onView } = args;

	toast.custom(
		(t) => (
			<div style={SHELL}>
				<AccentBar color="rgba(61,217,255,0.55)" />

				{/* Play / unlock icon */}
				<div
					style={{
						width: "16px",
						height: "16px",
						flexShrink: 0,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						marginTop: "1px",
					}}
				>
					<svg
						fill="none"
						height="14"
						viewBox="0 0 14 14"
						width="14"
						xmlns="http://www.w3.org/2000/svg"
					>
						<polygon
							fill="rgba(61,217,255,0.7)"
							points="4,2.5 11.5,7 4,11.5"
							stroke="rgba(61,217,255,0.5)"
							strokeLinejoin="round"
							strokeWidth="0.75"
						/>
					</svg>
				</div>

				<div style={{ flex: 1, minWidth: 0 }}>
					<ToastTitle>{title}</ToastTitle>
					<ToastDescription mb={onView ? 10 : 0}>New quest unlocked</ToastDescription>
					{onView ? (
						<button
							onClick={() => {
								toast.dismiss(t);
								onView();
							}}
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: "4px",
								padding: "4px 10px",
								fontSize: "11px",
								fontWeight: 600,
								color: "rgba(61,217,255,0.9)",
								background: "rgba(61,217,255,0.08)",
								border: "1px solid rgba(61,217,255,0.2)",
								borderRadius: "5px",
								cursor: "pointer",
								letterSpacing: "0.01em",
								transition: "background 0.15s, border-color 0.15s",
							}}
							type="button"
						>
							View →
						</button>
					) : null}
				</div>
			</div>
		),
		{
			id: `quest-activated-${questId}`,
			duration: 4000,
			unstyled: true,
		},
	);
}
