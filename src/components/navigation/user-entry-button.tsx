"use client";

import { UserRound } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Entrada visual futura: no navega, no abre sesión y comunica su estado. */
export function UserEntryButton({
  className,
  ...props
}: { className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      aria-label="Acceso de usuario, próximamente"
      aria-disabled="true"
      title="Acceso de usuario disponible próximamente"
      onClick={(event) => event.preventDefault()}
      className={cn(
        "group/user relative inline-flex size-11 shrink-0 items-center justify-center rounded-full",
        "border border-white/14 bg-white/[0.07] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        "transition-[transform,background-color,border-color,box-shadow] duration-200",
        "hover:border-lime/35 hover:bg-white/[0.11] hover:shadow-[0_12px_30px_-18px_rgba(183,255,60,0.7)]",
        "active:scale-[0.95] motion-reduce:active:scale-100",
        className,
      )}
    >
      <UserRound
        aria-hidden
        className="size-5 transition-transform duration-200 group-hover/user:scale-105 motion-reduce:transition-none"
      />
    </button>
  );
}
