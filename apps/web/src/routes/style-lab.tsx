import { createFileRoute } from "@tanstack/react-router";

import { MEDIA_SLOT_SPECS } from "@/features/game-ui/contracts/media-slots";
import {
	NvBadge,
	NvButton,
	NvChip,
	NvDivider,
	NvPanel,
	NvProgress,
	NvTable,
} from "@/features/game-ui/primitives";
import { GameShell } from "@/features/game-ui/shell";
import "@/features/game-ui/theme";

export const Route = createFileRoute("/style-lab")({
	component: StyleLabRoute,
});

function StyleLabRoute() {
	return (
		<div className="h-full min-h-0 overflow-hidden">
			<GameShell
				alerts={[
					{
						id: "a1",
						message: "Incoming attack signature near Cinder Nest",
						severity: "danger",
					},
					{
						id: "a2",
						message: "Fuel overflow paused refinery on Helion Drift",
						severity: "warning",
					},
					{
						id: "a3",
						message: "Transport NV-311 docked successfully",
						severity: "info",
					},
				]}
			>
				<div className="space-y-3 p-1">
					<section
						className="
        grid gap-3
        lg:grid-cols-2
      "
					>
						<NvPanel>
							<p className="nv-caps text-[10px] text-(--nv-text-muted)">Buttons + Badges</p>
							<div className="mt-3 flex flex-wrap gap-2">
								<NvButton variant="solid">Primary Action</NvButton>
								<NvButton variant="ghost">Secondary</NvButton>
								<NvButton variant="warning">Queue Upgrade</NvButton>
								<NvButton variant="danger">Abort Fleet</NvButton>
							</div>
							<div className="mt-3 flex flex-wrap gap-2">
								<NvBadge tone="info">info</NvBadge>
								<NvBadge tone="success">success</NvBadge>
								<NvBadge tone="warning">warning</NvBadge>
								<NvBadge tone="danger">danger</NvBadge>
							</div>
						</NvPanel>

						<NvPanel>
							<p className="nv-caps text-[10px] text-(--nv-text-muted)">Chips + Progress</p>
							<div className="mt-3 flex flex-wrap gap-2">
								<NvChip accent="cyan">Crystal +259/m</NvChip>
								<NvChip accent="orange">Fuel +148/m</NvChip>
								<NvChip accent="neutral">Energy Balanced</NvChip>
							</div>
							<div className="mt-3 space-y-2">
								<NvProgress tone="neutral" value={42} />
								<NvProgress tone="warning" value={76} />
								<NvProgress tone="danger" value={91} />
							</div>
						</NvPanel>
					</section>

					<NvPanel>
						<p className="nv-caps text-[10px] text-(--nv-text-muted)">Data Table</p>
						<div className="mt-3">
							<NvTable>
								<thead>
									<tr>
										<th>Transport</th>
										<th>Status</th>
										<th>Route</th>
										<th>ETA</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td>NV-204</td>
										<td>
											<NvBadge tone="info">In Transit</NvBadge>
										</td>
										<td>G2:S4:SYS8 -&gt; G2:S5:SYS3</td>
										<td className="nv-mono">03:12</td>
									</tr>
									<tr>
										<td>NV-311</td>
										<td>
											<NvBadge tone="warning">Launching</NvBadge>
										</td>
										<td>G2:S2:SYS5 -&gt; G2:S5:SYS3</td>
										<td className="nv-mono">11:44</td>
									</tr>
								</tbody>
							</NvTable>
						</div>
					</NvPanel>

					<NvPanel>
						<p className="nv-caps text-[10px] text-(--nv-text-muted)">Media Slot Contracts</p>
						<NvDivider className="my-3" />
						<div
							className="
         grid gap-3
         sm:grid-cols-2
         xl:grid-cols-3
       "
						>
							{Object.values(MEDIA_SLOT_SPECS).map((spec) => (
								<NvPanel className="bg-[rgba(255,255,255,0.03)]" density="compact" key={spec.slot}>
									<p className="text-sm font-semibold">{spec.slot}</p>
									<p className="mt-1 text-xs text-(--nv-text-muted)">Ratio {spec.ratio}</p>
									<p className="text-xs text-(--nv-text-muted)">
										Min {spec.minWidth}x{spec.minHeight}
									</p>
									<p className="text-xs text-(--nv-text-muted)">Fallback: {spec.fallback}</p>
									<div
										className="
            nv-loading-sweep mt-2 h-16 rounded-(--nv-r-sm) border
            border-(--nv-glass-stroke)
          "
									/>
								</NvPanel>
							))}
						</div>
					</NvPanel>
				</div>
			</GameShell>
		</div>
	);
}
