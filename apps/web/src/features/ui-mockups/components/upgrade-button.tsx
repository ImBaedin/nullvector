import { motion } from "motion/react";
import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type UpgradeArrow = {
  drift: number;
  duration: number;
  id: number;
  left: number;
  size: number;
};

type UpgradeButtonProps = {
  disabled?: boolean;
  label?: string;
  onClick?: () => void;
};

export function UpgradeButton({
  disabled = false,
  label = "Upgrade generator",
  onClick,
}: UpgradeButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [arrows, setArrows] = useState<UpgradeArrow[]>([]);
  const timerRef = useRef<number | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    if (!hovered || disabled) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const spawnArrow = () => {
      setArrows((prev) => [
        ...prev,
        {
          drift: Math.random() * 16 - 8,
          duration: 1.05 + Math.random() * 0.9,
          id: idRef.current++,
          left: 10 + Math.random() * 80,
          size: 9 + Math.random() * 4,
        },
      ]);
      timerRef.current = window.setTimeout(
        spawnArrow,
        110 + Math.random() * 240
      );
    };

    spawnArrow();
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [disabled, hovered]);

  return (
    <button
      className="group/upgrade relative overflow-hidden rounded-md border border-amber-200/55 bg-[linear-gradient(180deg,rgba(255,222,152,0.32),rgba(255,165,86,0.18))] px-3.5 py-1.5 text-xs uppercase tracking-[0.15em] text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_18px_rgba(255,159,67,0.26)] transition duration-300 hover:border-amber-100/80 hover:bg-[linear-gradient(180deg,rgba(255,230,169,0.4),rgba(255,174,95,0.22))] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_12px_28px_rgba(255,159,67,0.4)] disabled:cursor-not-allowed disabled:border-rose-300/65 disabled:bg-[linear-gradient(180deg,rgba(255,138,138,0.28),rgba(176,50,50,0.2))] disabled:text-rose-100 disabled:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_6px_18px_rgba(109,25,25,0.32)]"
      disabled={disabled}
      onBlur={() => setHovered(false)}
      onClick={onClick}
      onFocus={() => setHovered(!disabled)}
      onMouseEnter={() => setHovered(!disabled)}
      onMouseLeave={() => setHovered(false)}
      type="button"
    >
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
        <span className="absolute inset-x-0 bottom-0 h-5" />
        {arrows.map((arrow) => (
          <motion.span
            animate={{
              opacity: [0, 0.95, 0.78, 0],
              scale: [0.9, 1, 1, 1.04],
              x: arrow.drift,
              y: -72,
            }}
            className="absolute bottom-[-16px] leading-none text-[rgba(255,247,226,0.94)] [text-shadow:0_0_7px_rgba(255,214,140,0.55)]"
            initial={{ opacity: 0, scale: 0.9, x: 0, y: 0 }}
            key={arrow.id}
            onAnimationComplete={() =>
              setArrows((prev) => prev.filter((item) => item.id !== arrow.id))
            }
            style={{
              fontSize: `${arrow.size}px`,
              left: `${arrow.left}%`,
            }}
            transition={{ duration: arrow.duration, ease: "linear" }}
          >
            ↑
          </motion.span>
        ))}
      </span>
      <span className="relative z-10 flex items-center gap-1.5">
        <ArrowUp className="size-3.5" strokeWidth={2.8} />
        <span>{label}</span>
      </span>
    </button>
  );
}
