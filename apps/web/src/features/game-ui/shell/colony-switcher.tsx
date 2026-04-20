import { Check, ChevronDown, Pencil, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { ColonyOption } from "@/features/game-ui/contracts/navigation";

import { cn } from "@/lib/utils";

type ColonySwitcherProps = {
	activeColonyId: string;
	colonies: ColonyOption[];
	onColonyChange: (colonyId: string) => void;
	variant?: "compact" | "identity";
	isCompact?: boolean;
	onBeginRename?: () => void;
};

export function ColonySwitcher({
	activeColonyId,
	colonies,
	onColonyChange,
	variant = "compact",
	isCompact = false,
	onBeginRename,
}: ColonySwitcherProps) {
	const rootRef = useRef<HTMLDivElement | null>(null);
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [menuStyle, setMenuStyle] = useState<{
		left: number;
		top: number;
		width: number;
	} | null>(null);

	const activeColony = colonies.find((colony) => colony.id === activeColonyId) ?? colonies[0];

	const filteredColonies = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (!normalized) return colonies;

		return colonies.filter((colony) => {
			const haystack = [colony.name, colony.addressLabel, colony.details, colony.status]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();

			return haystack.includes(normalized);
		});
	}, [colonies, query]);

	useEffect(() => {
		if (!isOpen) return;

		const updateMenuPosition = () => {
			const trigger = triggerRef.current;
			if (!trigger) {
				return;
			}

			const rect = trigger.getBoundingClientRect();
			const viewportPadding = 8;
			const width = Math.min(420, Math.max(300, window.innerWidth - viewportPadding * 2));
			const left =
				variant === "identity"
					? Math.min(
							Math.max(viewportPadding, rect.left),
							window.innerWidth - width - viewportPadding,
						)
					: Math.min(
							Math.max(viewportPadding, rect.right - width),
							window.innerWidth - width - viewportPadding,
						);
			const top = rect.bottom + 8;

			setMenuStyle({
				left,
				top,
				width,
			});
		};

		const onWindowClick = (event: MouseEvent) => {
			const target = event.target as Node | null;
			if (!target) {
				return;
			}
			if (
				(rootRef.current && rootRef.current.contains(target)) ||
				(menuRef.current && menuRef.current.contains(target))
			) {
				return;
			}
			setIsOpen(false);
		};

		updateMenuPosition();
		window.addEventListener("mousedown", onWindowClick);
		window.addEventListener("resize", updateMenuPosition);
		window.addEventListener("scroll", updateMenuPosition, true);
		return () => {
			window.removeEventListener("mousedown", onWindowClick);
			window.removeEventListener("resize", updateMenuPosition);
			window.removeEventListener("scroll", updateMenuPosition, true);
		};
	}, [isOpen]);

	const selectColony = (colonyId: string) => {
		onColonyChange(colonyId);
		setIsOpen(false);
		setQuery("");
	};

	const menu = (
		<div
			className="
     fixed z-(--nv-z-tooltip) overflow-hidden rounded-xl border border-white/12
     bg-[rgba(8,14,26,0.97)] shadow-[0_12px_40px_rgba(0,0,0,0.55)]
   "
			ref={menuRef}
			style={
				menuStyle
					? {
							left: menuStyle.left,
							top: menuStyle.top,
							width: menuStyle.width,
						}
					: undefined
			}
		>
			<div className="border-b border-white/8 p-2">
				<div className="relative">
					<Search
						className="
        pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2
        text-white/30
      "
					/>
					<input
						autoFocus
						className="
        h-8 w-full rounded-lg border border-white/10 bg-black/30 pr-3 pl-8
        text-xs text-white outline-none
        placeholder:text-white/25
        focus:border-cyan-300/30
      "
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search colonies"
						value={query}
					/>
				</div>
			</div>

			<div className="max-h-[300px] overflow-y-auto p-1.5">
				{filteredColonies.length > 0 ? (
					filteredColonies.map((colony) => (
						<button
							className="
         flex w-full items-center justify-between rounded-lg px-2.5 py-2
         text-left transition-colors
         hover:bg-white/4
       "
							key={colony.id}
							onClick={() => selectColony(colony.id)}
							type="button"
						>
							<ColonyRow colony={colony} />
							{colony.id === activeColonyId ? (
								<Check className="size-3.5 shrink-0 text-cyan-300" />
							) : null}
						</button>
					))
				) : (
					<p className="px-2 py-3 text-xs text-white/30">No colonies found.</p>
				)}
			</div>
		</div>
	);

	if (variant === "identity") {
		return (
			<div
				className="
     group relative z-(--nv-z-popover) flex min-w-0 items-center gap-1
   "
				ref={rootRef}
			>
				<button
					aria-label={`Switch colony${activeColony ? `, currently ${activeColony.name}` : ""}`}
					className="
       flex min-w-0 cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1
       text-left transition-colors
       hover:bg-white/4
     "
					onClick={() => setIsOpen((open) => !open)}
					ref={triggerRef}
					type="button"
				>
					{activeColony?.imageUrl ? (
						<img
							alt={`${activeColony.name} thumbnail`}
							className={cn(
								"shrink-0 rounded-md border border-white/12 object-cover",
								isCompact ? "size-6" : "size-8",
							)}
							src={activeColony.imageUrl}
						/>
					) : activeColony ? (
						<div className={cn(`
          flex shrink-0 items-center justify-center rounded-md border
          border-white/10
        `, `
          bg-[linear-gradient(150deg,rgba(61,217,255,0.15),rgba(255,145,79,0.15))]
        `, "text-[9px] font-bold text-white/70", isCompact ? "size-6" : "size-8")}>{activeColony.name.slice(0, 2).toUpperCase()}</div>
					) : null}
					<div className="min-w-0">
						<p
							className="
        text-[8px] font-semibold tracking-[0.14em] text-white/25 uppercase
      "
						>
							NullVector
						</p>
						<div className="flex items-center gap-1">
							<span
								className={cn(
									"truncate font-(family-name:--nv-font-display) font-bold text-white transition-colors",
									"group-hover:text-cyan-50",
									isCompact ? "text-sm" : "text-[15px]",
								)}
							>
								{activeColony?.name ?? "Select colony"}
							</span>
							<ChevronDown
								className={cn(
									"size-3 shrink-0 text-white/30 transition-transform",
									isOpen ? "rotate-180" : null,
								)}
							/>
						</div>
					</div>
				</button>

				{onBeginRename ? (
					<button
						aria-label="Rename colony"
						className="
              flex size-6 shrink-0 items-center justify-center rounded-md
              text-white/25 opacity-0 transition-all
              group-hover:opacity-100 hover:bg-white/6
              hover:text-white/60
            "
						onClick={() => {
							setIsOpen(false);
							onBeginRename();
						}}
						type="button"
					>
						<Pencil className="size-3" />
					</button>
				) : null}

				{isOpen && menuStyle && typeof document !== "undefined"
					? createPortal(menu, document.body)
					: null}
			</div>
		);
	}

	return (
		<div className="relative z-(--nv-z-popover) min-w-[220px]" ref={rootRef}>
			<button className={cn(`
     flex h-9 w-full items-center justify-between rounded-lg border px-2.5
     text-left transition-all
     focus-visible:ring-2 focus-visible:ring-cyan-400/30
     focus-visible:outline-none
   `, isOpen ? "border-cyan-300/30 bg-white/6" : `
     border-white/10 bg-white/2.5
     hover:border-white/18 hover:bg-white/4
   `)} ref={triggerRef} onClick={() => setIsOpen((open) => !open)} type="button">
				{activeColony ? (
					<ColonyRow colony={activeColony} compact />
				) : (
					<span className="text-xs text-white/40">Select colony</span>
				)}
				<ChevronDown
					className={cn(
						"ml-2 size-3.5 text-white/25 transition-transform",
						isOpen ? "rotate-180" : null,
					)}
				/>
			</button>

			{isOpen && menuStyle && typeof document !== "undefined"
				? createPortal(menu, document.body)
				: null}
		</div>
	);
}

function ColonyRow({ colony, compact = false }: { colony: ColonyOption; compact?: boolean }) {
	return (
		<div className="flex min-w-0 items-center gap-2">
			{colony.imageUrl ? (
				<img
					alt={`${colony.name} thumbnail`}
					className={cn(
						"shrink-0 rounded-md border border-white/10 object-cover",
						compact ? "size-6" : "size-7",
					)}
					src={colony.imageUrl}
				/>
			) : (
				<div className={cn(`
      flex shrink-0 items-center justify-center rounded-md border
      border-white/10
      bg-[linear-gradient(150deg,rgba(61,217,255,0.15),rgba(255,145,79,0.15))]
      text-[9px] font-bold text-white/70
    `, compact ? "size-6" : "size-7")}>{colony.name.slice(0, 2).toUpperCase()}</div>
			)}
			<div className="min-w-0">
				<p className={cn("truncate font-semibold text-white", compact ? "text-xs" : `
      text-[13px]
    `)}>{colony.name}</p>
				<p
					className="
       truncate font-(family-name:--nv-font-mono) text-[10px] text-white/25
     "
				>
					{colony.addressLabel}
					{!compact && colony.status ? ` · ${colony.status}` : ""}
				</p>
			</div>
		</div>
	);
}
