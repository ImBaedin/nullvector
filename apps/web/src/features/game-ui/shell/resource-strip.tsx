import { Fragment } from "react";

import type { ResourceDatum } from "@/features/game-ui/contracts/navigation";
import { cn } from "@/lib/utils";

const RESOURCE_ICON_BY_KEY = {
  alloy: "/game-icons/alloy.png",
  crystal: "/game-icons/crystal.png",
  fuel: "/game-icons/deuterium.png",
  energy: "/game-icons/energy.png",
} as const;

const ACCENT_BAR = {
  alloy: "bg-cyan-400/50",
  crystal: "bg-indigo-400/50",
  fuel: "bg-amber-400/50",
  energy: "bg-emerald-400/50",
} as const;

const ACCENT_RATE = {
  alloy: "text-cyan-200/55",
  crystal: "text-indigo-200/55",
  fuel: "text-amber-200/55",
  energy: "text-emerald-200/55",
} as const;

function formatResourceValue(units: number) {
  if (units >= 1_000_000) {
    return `${(units / 1_000_000).toFixed(1)}M`;
  }
  if (units >= 1_000) {
    return `${(units / 1_000).toFixed(1)}k`;
  }
  return units.toString();
}

type ResourceStripProps = {
  className?: string;
  resources: ResourceDatum[];
  storageUsagePercent?: number;
};

export function ResourceStrip({ className, resources }: ResourceStripProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-1 gap-y-2", className)}>
      {resources.map((resource, i) => {
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

        const isEnergy = resource.key === "energy";
        const percent = isEnergy
          ? 100
          : Math.max(
              0,
              Math.min(100, hasOverflow || isStorageFull ? 100 : resource.storagePercent ?? 0)
            );

        return (
          <Fragment key={resource.key}>
            {i > 0 && <div className="hidden h-5 w-px shrink-0 bg-white/6 sm:block" />}
            <div className="flex items-center gap-2">
              <img
                alt={`${resource.key} icon`}
                className="size-7 shrink-0 rounded-md border border-white/10 bg-black/30 object-contain p-0.5"
                src={RESOURCE_ICON_BY_KEY[resource.key]}
              />
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-white/30">
                    {resource.key}
                  </span>
                  <span
                    className={cn(
                      "font-(family-name:--nv-font-mono) text-[13px] font-bold leading-none",
                      hasOverflow ? "text-rose-200" : "text-white"
                    )}
                    title={valueTitle}
                  >
                    {displayValue}
                  </span>
                  {!isEnergy && capAmount !== undefined && (
                    <span className="font-(family-name:--nv-font-mono) text-[10px] text-white/20">
                      / {formatResourceValue(capAmount)}
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      isEnergy
                        ? (resource.energyBalance ?? 0) < 0
                          ? "text-rose-300/70"
                          : "text-emerald-300/55"
                        : hasOverflow || resource.pausedByOverflow
                          ? "text-amber-200/70"
                          : isStorageFull
                            ? "text-rose-300/55"
                            : ACCENT_RATE[resource.key]
                    )}
                  >
                    {isEnergy
                      ? `${resource.energyBalance ?? 0} MW`
                      : hasOverflow
                        ? resource.deltaPerMinute ?? "Overflow"
                        : isStorageFull
                          ? "Storage full"
                          : resource.deltaPerMinute}
                  </span>
                </div>
                {!isEnergy && (
                  <div className="mt-0.5 h-[2px] w-full min-w-[72px] overflow-hidden rounded-full bg-white/8">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        hasOverflow || isStorageFull ? "bg-rose-400/40" : ACCENT_BAR[resource.key]
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
