import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "lime" | "action" | "muted" | "error" | "success" | "warning";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  lime: "bg-lime/15 text-lime border border-lime/25",
  action: "bg-action text-action-foreground",
  muted: "bg-white/8 text-muted border border-border-soft",
  error: "bg-error/15 text-error border border-error/30",
  success: "bg-success/15 text-success border border-success/30",
  warning: "bg-warning/15 text-warning border border-warning/30",
};

export function Badge({
  variant = "muted",
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Insignia de disponibilidad de un plato. */
export function AvailabilityBadge({ available }: { available: boolean }) {
  if (available) return null;
  return <Badge variant="error">Agotado</Badge>;
}

/** Etiqueta dietaria/descriptiva (solo con datos confiables). */
export function DietaryTag({ children }: { children: ReactNode }) {
  return <Badge variant="lime">{children}</Badge>;
}
