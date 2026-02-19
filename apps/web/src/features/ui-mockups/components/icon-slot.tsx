export function IconSlot({ label }: { label: string }) {
  return (
    <span
      aria-label={`${label} icon slot`}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/35 bg-white/10 text-[10px] font-semibold tracking-[0.08em] text-white/80"
      title={`${label} icon slot`}
    >
      ICON
    </span>
  );
}
