import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SweepProps = {
	className?: string;
};

function Sweep({ className }: SweepProps) {
	return (
		<div
			className={cn("nv-loading-sweep rounded-xl border border-white/10 bg-white/3", className)}
		/>
	);
}

function ColonyPageSkeletonFrame({ children }: { children: ReactNode }) {
	return (
		<div
			className="
   mx-auto w-full max-w-[1440px] px-4 pt-4 pb-12 text-white
 "
		>
			{children}
		</div>
	);
}

function ColonyTwoColumnSkeleton(args: { left: ReactNode; right: ReactNode }) {
	return (
		<ColonyPageSkeletonFrame>
			<div
				className="
      grid gap-5
      lg:grid-cols-[minmax(0,1fr)_450px]
    "
			>
				<div className="space-y-5">{args.left}</div>
				<div className="space-y-5">{args.right}</div>
			</div>
		</ColonyPageSkeletonFrame>
	);
}

export function ResourcesRouteSkeleton() {
	return (
		<ColonyTwoColumnSkeleton
			left={
				<>
					<Sweep className="h-40 rounded-2xl" />
					<Sweep className="h-72 rounded-2xl" />
					<Sweep className="h-72 rounded-2xl" />
				</>
			}
			right={
				<>
					<Sweep className="h-64 rounded-2xl" />
					<Sweep className="h-56 rounded-2xl" />
				</>
			}
		/>
	);
}

export function FacilitiesRouteSkeleton() {
	return (
		<ColonyTwoColumnSkeleton
			left={
				<>
					<Sweep className="h-[560px] rounded-2xl" />
				</>
			}
			right={
				<>
					<Sweep className="h-64 rounded-2xl" />
					<Sweep className="h-56 rounded-2xl" />
				</>
			}
		/>
	);
}

export function ShipyardRouteSkeleton() {
	return (
		<ColonyTwoColumnSkeleton
			left={
				<>
					<Sweep className="h-40 rounded-2xl" />
					<Sweep className="h-80 rounded-2xl" />
				</>
			}
			right={
				<>
					<Sweep className="h-64 rounded-2xl" />
					<Sweep className="h-56 rounded-2xl" />
				</>
			}
		/>
	);
}

export function DefensesRouteSkeleton() {
	return (
		<ColonyTwoColumnSkeleton
			left={
				<>
					<Sweep className="h-40 rounded-2xl" />
					<Sweep className="h-[540px] rounded-2xl" />
				</>
			}
			right={
				<>
					<Sweep className="h-64 rounded-2xl" />
					<Sweep className="h-56 rounded-2xl" />
				</>
			}
		/>
	);
}

export function FleetRouteSkeleton() {
	return (
		<ColonyTwoColumnSkeleton
			left={
				<>
					<Sweep className="h-[520px] rounded-2xl" />
				</>
			}
			right={
				<>
					<Sweep className="h-64 rounded-2xl" />
					<Sweep className="h-56 rounded-2xl" />
				</>
			}
		/>
	);
}
