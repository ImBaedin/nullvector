import { Switch } from "@base-ui/react/switch";

import { NvDivider } from "@/features/game-ui/primitives";
import { cn } from "@/lib/utils";

export function NvSwitch({
	checked,
	onCheckedChange,
	disabled,
}: {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	disabled?: boolean;
}) {
	return (
		<Switch.Root
			checked={checked}
			className={cn(
				`
    relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center
    rounded-full border transition-colors
    focus-visible:ring-2 focus-visible:ring-(--nv-focus-ring)
    focus-visible:outline-none
    disabled:cursor-not-allowed disabled:opacity-40
  `,
				checked ? "border-cyan-400/40 bg-cyan-400/24" : `
    border-white/16 bg-white/8
  `,
			)}
			disabled={disabled}
			onCheckedChange={onCheckedChange}
		>
			<Switch.Thumb
				className={cn(
					`
     pointer-events-none block size-3.5 rounded-full shadow-sm
     transition-transform
   `,
					checked ? "translate-x-[18px] bg-cyan-300" : `
     translate-x-[3px] bg-white/50
   `,
				)}
			/>
		</Switch.Root>
	);
}

export function SettingsRow({
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

export function SettingsSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
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
