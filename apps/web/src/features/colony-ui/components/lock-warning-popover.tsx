import { Popover } from "@base-ui/react/popover";
import { AlertTriangle } from "lucide-react";

const POPOVER_PANEL_CLASS =
	"origin-[var(--transform-origin)] w-[240px] rounded-xl border border-white/30 bg-[rgba(5,10,18,0.82)] p-3 text-xs text-white/90 shadow-[0_20px_45px_rgba(0,0,0,0.5)] outline-none backdrop-blur-md transition-[transform,scale,opacity] duration-200 data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0";

export function LockWarningPopover({ message }: { message: string }) {
	return (
		<Popover.Root>
			<Popover.Trigger
				closeDelay={90}
				delay={60}
				openOnHover
				render={
					<button
						aria-label="Show lock warning"
						className="
        rounded-full border border-amber-100/35 bg-amber-300/20 p-1
        text-amber-100
      "
						type="button"
					>
						<AlertTriangle className="size-3.5" />
					</button>
				}
			/>
			<Popover.Portal>
				<Popover.Positioner align="end" className="z-90" sideOffset={8}>
					<Popover.Popup className={POPOVER_PANEL_CLASS}>{message}</Popover.Popup>
				</Popover.Positioner>
			</Popover.Portal>
		</Popover.Root>
	);
}
