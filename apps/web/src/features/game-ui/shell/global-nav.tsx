import { Bell, Settings } from "lucide-react";

import { NvIconButton } from "@/features/game-ui/primitives";

import { ColonySwitcher } from "./colony-switcher";

type GlobalNavProps = {
	activeColonyId: string;
	colonies: {
		addressLabel?: string;
		id: string;
		name: string;
	}[];
	onColonyChange: (colonyId: string) => void;
	title: string;
};

export function GlobalNav({ activeColonyId, colonies, onColonyChange, title }: GlobalNavProps) {
	return (
		<div
			className="
     relative isolate z-(--nv-z-popover) grid grid-cols-[1fr_auto_1fr]
     items-center gap-3 px-4 py-3
   "
		>
			<div className="flex items-center gap-3 justify-self-start">
				<img
					alt="Nullvector logo"
					className="
       size-11 rounded-md border border-(--nv-glass-highlight)
       bg-[rgba(255,255,255,0.05)] object-contain p-1
     "
					src="/game-icons/logo.png"
				/>
				<div>
					<p className="nv-caps text-[10px] text-(--nv-text-muted)">NullVector</p>
					<h1 className="nv-display text-xl font-semibold text-(--nv-text-primary)">{title}</h1>
				</div>
			</div>

			<div className="justify-self-center">
				<button
					className="
       nv-starmap-hero nv-transition relative flex h-12 min-w-[190px]
       items-center justify-center gap-2 rounded-(--nv-r-sm) border
       border-[rgba(61,217,255,0.42)]
       bg-[linear-gradient(165deg,rgba(61,217,255,0.18),rgba(61,217,255,0.06))]
       px-4 text-sm font-semibold text-[#e9fbff]
       shadow-[0_0_0_1px_rgba(61,217,255,0.12),0_8px_22px_rgba(4,8,20,0.46)]
       hover:border-[rgba(61,217,255,0.6)]
     "
					type="button"
				>
					<span className="nv-starmap-stars" />
					<span className="nv-starmap-stars is-slower" />
					<img
						alt="Star map icon"
						className="
        relative z-10 size-6 object-contain
        drop-shadow-[0_0_8px_rgba(61,217,255,0.55)]
      "
						src="/game-icons/nav/starmap.png"
					/>
					<span className="relative z-10">Star Map</span>
				</button>
			</div>

			<div className="flex items-center gap-2 justify-self-end">
				<ColonySwitcher
					activeColonyId={activeColonyId}
					colonies={colonies}
					onColonyChange={onColonyChange}
				/>
				<NvIconButton label="Notifications" variant="ghost">
					<Bell className="size-4" />
				</NvIconButton>
				<NvIconButton label="Settings" variant="ghost">
					<Settings className="size-4" />
				</NvIconButton>
			</div>
		</div>
	);
}
