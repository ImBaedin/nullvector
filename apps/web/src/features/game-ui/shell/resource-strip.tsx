import type { ResourceDatum } from "@/features/game-ui/contracts/navigation";
import { NvProgress } from "@/features/game-ui/primitives";
import { cn } from "@/lib/utils";

const ACCENT_FILL_BY_RESOURCE = {
  alloy: "from-cyan-300/35 to-cyan-400/10",
  crystal: "from-sky-300/35 to-indigo-300/10",
  fuel: "from-amber-300/35 to-orange-300/10",
  energy: "from-rose-300/35 to-pink-300/10",
} as const;

const RESOURCE_ICON_BY_KEY = {
  alloy: "/game-icons/alloy.png",
  crystal: "/game-icons/crystal.png",
  fuel: "/game-icons/deuterium.png",
  energy: "/game-icons/energy.png",
} as const;

type ResourceStripProps = {
  className?: string;
  resources: ResourceDatum[];
  storageUsagePercent?: number;
};

function formatResourceValue(units: number) {
  if (units >= 1_000_000) {
    return `${(units / 1_000_000).toFixed(1)}M`;
  }
  if (units >= 1_000) {
    return `${(units / 1_000).toFixed(1)}k`;
  }
  return units.toString();
}

export function ResourceStrip({
  className,
  resources,
  storageUsagePercent = 58,
}: ResourceStripProps) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {resources.map((resource) => {
          const overflowAmount = resource.overflowAmount ?? 0;
          const hasOverflow = overflowAmount > 0;
          const storedAmount = resource.storageCurrentAmount ?? resource.valueAmount;
          const capAmount = resource.storageCapAmount;
          const isStorageFull =
            resource.key !== "energy" &&
            storedAmount !== undefined &&
            capAmount !== undefined &&
            storedAmount >= capAmount;
          const displayAmount =
            resource.key !== "energy" && storedAmount !== undefined
              ? storedAmount + overflowAmount
              : resource.valueAmount;
          const displayValue =
            resource.key !== "energy" && displayAmount !== undefined
              ? formatResourceValue(displayAmount)
              : resource.value;
          const valueTitle =
            resource.key !== "energy"
              ? displayAmount !== undefined
                ? displayAmount.toLocaleString()
                : resource.value
              : resource.value;

          return (
            <div
              className="relative min-h-[68px] min-w-[220px] overflow-hidden rounded-[var(--nv-r-sm)] border border-[color:var(--nv-glass-stroke)] bg-[rgba(255,255,255,0.03)] px-3 py-2"
              key={resource.key}
            >
              {resource.key !== "energy" ? (
                <>
                  <div
                    className={`pointer-events-none absolute inset-y-0 left-0 rounded-r-[var(--nv-r-sm)] bg-gradient-to-r ${
                      ACCENT_FILL_BY_RESOURCE[resource.key]
                    }`}
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          hasOverflow || isStorageFull
                            ? 100
                            : resource.storagePercent ?? 0,
                        )
                      )}%`,
                    }}
                  />
                  <div
                    className="pointer-events-none absolute inset-0 nv-progress-stripes opacity-30"
                    style={
                      hasOverflow || isStorageFull
                        ? { animationPlayState: "paused", opacity: 0.18 }
                        : undefined
                    }
                  />
                </>
              ) : null}

              <div className="relative z-10 flex h-full items-center gap-3">
                <img
                  alt={`${resource.key} icon`}
                  className="h-10 w-10 rounded-md border border-[color:var(--nv-glass-highlight)] bg-[rgba(255,255,255,0.1)] object-cover"
                  src={RESOURCE_ICON_BY_KEY[resource.key]}
                />
                <div className="min-w-0">
                  <p className="nv-caps text-[10px] text-[color:var(--nv-text-muted)]">
                    {resource.key}
                  </p>
                  <p
                    className={cn(
                      "nv-mono text-base",
                      hasOverflow
                        ? "text-rose-200"
                        : "text-[color:var(--nv-text-primary)]",
                    )}
                    title={valueTitle}
                  >
                    {displayValue}
                    {resource.key !== "energy" &&
                    resource.storageCurrentLabel &&
                    resource.storageCapLabel ? (
                      <span
                        className={cn(
                          "ml-2 text-[11px]",
                          hasOverflow
                            ? "text-rose-200/80"
                            : "text-[color:var(--nv-text-muted)]",
                        )}
                      >
                        / {resource.storageCapLabel}
                      </span>
                    ) : null}
                  </p>
                  {resource.key !== "energy" &&
                  (hasOverflow || isStorageFull || resource.deltaPerMinute) ? (
                    <p
                      className={cn(
                        "text-[11px]",
                        hasOverflow || resource.pausedByOverflow
                          ? "text-amber-200"
                          : isStorageFull
                            ? "text-rose-200"
                          : "text-[color:var(--nv-text-secondary)]",
                      )}
                    >
                      {hasOverflow
                        ? resource.deltaPerMinute ?? "Paused by overflow"
                        : isStorageFull
                          ? "Storage full"
                          : resource.deltaPerMinute}
                    </p>
                  ) : null}
                  {resource.key === "energy" ? (
                    <p
                      className={cn(
                        "text-[11px]",
                        (resource.energyBalance ?? 0) < 0
                          ? "text-[color:var(--nv-danger)]"
                          : "text-[color:var(--nv-success)]"
                      )}
                    >
                      {(resource.energyBalance ?? 0) < 0
                        ? `${resource.energyBalance} MW`
                        : `${resource.energyBalance ?? 0} MW`}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
