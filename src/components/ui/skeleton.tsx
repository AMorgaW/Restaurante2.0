import { cn } from "@/lib/utils";

/** Bloque skeleton con dimensiones estables (sin layout shift). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-xl", className)} />;
}
