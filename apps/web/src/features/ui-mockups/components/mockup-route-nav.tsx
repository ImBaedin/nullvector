import { Link } from "@tanstack/react-router";

const mockupLinks = [
  { label: "Mockup 1", to: "/ui-mockups/1" },
  { label: "Mockup 2", to: "/ui-mockups/2" },
  { label: "Mockup 3", to: "/ui-mockups/3" },
  { label: "Mockup 4", to: "/ui-mockups/4" },
  { label: "Mockup 5", to: "/ui-mockups/5" },
  { label: "Mockup 6", to: "/ui-mockups/6" },
] as const;

export function MockupRouteNav({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {mockupLinks.map((item) => (
          <Link
            activeProps={{ className: "bg-white text-black" }}
            className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-white/90 transition hover:bg-white/20"
            key={item.to}
            to={item.to}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
