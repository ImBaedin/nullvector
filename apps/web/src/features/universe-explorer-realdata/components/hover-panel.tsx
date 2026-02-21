import type { HoverPanelState } from "../types";

export function HoverPanel({ hover }: { hover: HoverPanelState | null }) {

  if (!hover) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed z-50 rounded-md border border-white/25 bg-[#0a1220]/95 px-3 py-2 text-xs shadow-[0_6px_24px_rgba(0,0,0,0.45)]"
      style={{
        left: hover.screenX + 12,
        top: hover.screenY - 12,
        transform: "translateY(-100%)",
      }}
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/85">
        {hover.entityType}
      </p>
      <p className="mt-1 text-sm font-medium text-white">{hover.name}</p>
      <p className="mt-1 font-mono text-[11px] text-slate-300">{hover.addressLabel}</p>
    </div>
  );
}
