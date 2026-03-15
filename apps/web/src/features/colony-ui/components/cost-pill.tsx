type CostKind = "alloy" | "crystal" | "fuel";

function resourceIcon(kind: CostKind): string {
	if (kind === "alloy") {
		return "/game-icons/alloy.png";
	}
	if (kind === "crystal") {
		return "/game-icons/crystal.png";
	}
	return "/game-icons/deuterium.png";
}

export function CostPill(props: { amount: number; kind: CostKind; label: string }) {
	const { amount, kind, label } = props;

	return (
		<span
			className="
     inline-flex items-center gap-1 rounded-md border border-white/20
     bg-black/35 px-2 py-1 text-[11px] font-semibold text-slate-100
   "
		>
			<img alt={`${label} icon`} className="size-3.5 object-contain" src={resourceIcon(kind)} />
			{amount.toLocaleString()}
		</span>
	);
}
