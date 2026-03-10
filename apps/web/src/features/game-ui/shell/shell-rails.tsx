import { NvPanel } from "@/features/game-ui/primitives";

type ShellRailProps = {
	children: React.ReactNode;
	title: string;
};

export function ShellRail({ children, title }: ShellRailProps) {
	return (
		<NvPanel className="h-full min-h-0 overflow-visible" density="compact">
			<p className="nv-caps mb-2 text-[10px] text-(--nv-text-muted)">{title}</p>
			<div
				className="
      h-full min-h-0 overflow-x-visible overflow-y-auto px-0.5 py-1 pr-1
    "
			>
				{children}
			</div>
		</NvPanel>
	);
}
