"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  children: ReactNode;
}

/** Chip seleccionable (categorías, filtros) con estado accesible. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-chip px-4 text-sm whitespace-nowrap select-none",
        "transition-[background-color,color,border-color,transform] duration-150",
        "active:scale-[0.97] motion-reduce:active:scale-100",
        // Seleccionado: relleno claro con texto navy (chips del video);
        // el amarillo queda reservado para las acciones (CTA/añadir).
        selected
          ? "bg-white/92 text-action-foreground font-bold"
          : "bg-white/6 text-muted font-medium border border-border-soft hover:text-foreground hover:border-border-strong",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
