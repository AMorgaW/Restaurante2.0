"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { restaurantConfig } from "@/config/restaurant";
import { cn } from "@/lib/utils";

/**
 * Selector de cantidad accesible: botones reales, valor anunciado con
 * aria-live y protección contra cantidades inválidas.
 */
export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = restaurantConfig.checkout.maxQuantityPerLine,
  label = "Cantidad",
  size = "md",
  emphasize = false,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label?: string;
  size?: "sm" | "md";
  /** Pulso visual del número. El carrito no lo activa. */
  emphasize?: boolean;
  className?: string;
}) {
  const skipPulse = useRef(true);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (!emphasize) return;
    if (skipPulse.current) {
      skipPulse.current = false;
      return;
    }
    setPulse((current) => current + 1);
  }, [emphasize, value]);

  const buttonClasses = cn(
    "inline-flex items-center justify-center rounded-full bg-white/8 border border-border-soft text-foreground",
    "transition-[background-color,transform] duration-150 active:scale-[0.92] motion-reduce:active:scale-100",
    "hover:bg-white/14 disabled:opacity-40 disabled:pointer-events-none",
    size === "md" ? "size-11" : "size-10",
  );

  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex items-center gap-3", className)}
    >
      <button
        type="button"
        aria-label="Reducir cantidad"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className={buttonClasses}
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <span
        aria-live="polite"
        className={cn(
          "min-w-7 text-center font-bold tabular-nums",
          size === "md" ? "text-lg" : "text-base",
        )}
      >
        {emphasize && pulse > 0 ? (
          <span key={pulse} className="qty-tick">
            {value}
          </span>
        ) : (
          value
        )}
      </span>
      <button
        type="button"
        aria-label="Aumentar cantidad"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className={buttonClasses}
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  );
}
