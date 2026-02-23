import { motion } from "motion/react";
import { ArrowUp, Hammer } from "lucide-react";
import { forwardRef, useEffect, useRef, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";

type UpgradeArrow = {
  drift: number;
  duration: number;
  id: number;
  left: number;
  scale: number;
};

type UpgradeButtonProps = ComponentPropsWithoutRef<"button"> & {
  actionDurationText?: string;
  disabled?: boolean;
  icon?: "arrow" | "hammer";
  label?: string;
};

export const UpgradeButton = forwardRef<HTMLButtonElement, UpgradeButtonProps>(
  function UpgradeButton(
    {
      actionDurationText,
      className,
      disabled = false,
      icon = "arrow",
      label = "Upgrade generator",
      onBlur,
      onFocus,
      onMouseEnter,
      onMouseLeave,
      type = "button",
      ...props
    },
    ref
  ) {
    const [hovered, setHovered] = useState(false);
    const [arrows, setArrows] = useState<UpgradeArrow[]>([]);
    const timerRef = useRef<number | null>(null);
    const idRef = useRef(0);
    const showArrowParticles = icon === "arrow";

    useEffect(() => {
      if (!hovered || disabled || !showArrowParticles) {
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
            scale: 0.75 + Math.random() * 0.75,
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
    }, [disabled, hovered, showArrowParticles]);

    return (
      <button
        {...props}
        className={`group/upgrade relative min-w-[220px] overflow-hidden rounded-md border border-amber-200/55 bg-[linear-gradient(180deg,rgba(255,222,152,0.32),rgba(255,165,86,0.18))] px-4 py-2 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_18px_rgba(255,159,67,0.26)] transition duration-300 hover:border-amber-100/80 hover:bg-[linear-gradient(180deg,rgba(255,230,169,0.4),rgba(255,174,95,0.22))] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_12px_28px_rgba(255,159,67,0.4)] aria-disabled:cursor-not-allowed aria-disabled:border-rose-300/65 aria-disabled:bg-[linear-gradient(180deg,rgba(255,138,138,0.28),rgba(176,50,50,0.2))] aria-disabled:text-rose-100 aria-disabled:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_6px_18px_rgba(109,25,25,0.32)] ${
          className ?? ""
        }`}
        aria-disabled={disabled}
        onBlur={(event) => {
          setHovered(false);
          onBlur?.(event);
        }}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          props.onClick?.(event);
        }}
        onFocus={(event) => {
          setHovered(!disabled);
          onFocus?.(event);
        }}
        onMouseEnter={(event) => {
          setHovered(!disabled);
          onMouseEnter?.(event);
        }}
        onMouseLeave={(event) => {
          setHovered(false);
          onMouseLeave?.(event);
        }}
        ref={ref}
        type={type}
      >
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
          <span className="absolute inset-x-0 bottom-0 h-5" />
          {showArrowParticles
            ? arrows.map((arrow) => (
                <motion.span
                  animate={{
                    opacity: [0, 0.95, 0.78, 0],
                    scale: [
                      arrow.scale * 0.88,
                      arrow.scale,
                      arrow.scale * 0.96,
                      arrow.scale * 1.03,
                    ],
                    x: arrow.drift,
                    y: -72,
                  }}
                  className="absolute bottom-[-16px]"
                  initial={{ opacity: 0, scale: 0.9, x: 0, y: 0 }}
                  key={arrow.id}
                  onAnimationComplete={() =>
                    setArrows((prev) =>
                      prev.filter((item) => item.id !== arrow.id)
                    )
                  }
                  style={{
                    left: `${arrow.left}%`,
                  }}
                  transition={{ duration: arrow.duration, ease: "linear" }}
                >
                  <ArrowUp
                    className="size-3 text-[rgba(255,247,226,0.94)] drop-shadow-[0_0_6px_rgba(255,214,140,0.55)]"
                    strokeWidth={2.8}
                  />
                </motion.span>
              ))
            : null}
        </span>
        <span className="relative z-10 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 text-center">
          <span className="self-center">
            {icon === "hammer" ? (
              <Hammer className="size-4" strokeWidth={2.5} />
            ) : (
              <ArrowUp className="size-4" strokeWidth={2.8} />
            )}
          </span>
          <span className="text-xs uppercase tracking-[0.15em]">{label}</span>
          {actionDurationText ? (
            <span className="justify-self-end text-right text-[10px] font-semibold tracking-[0.08em] text-amber-100/90">
              {actionDurationText}
            </span>
          ) : null}
        </span>
      </button>
    );
  }
);
