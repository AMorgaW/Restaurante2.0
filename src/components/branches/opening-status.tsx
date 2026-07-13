"use client";

import { useEffect, useState } from "react";
import { getOpeningStatus } from "@/lib/menu/opening-hours";
import { cn } from "@/lib/utils";
import type { Branch, OpeningStatus } from "@/types/restaurant";

/**
 * Estado abierto/cerrado de una sucursal. Se calcula tras el montaje
 * (usa la hora actual) y se refresca cada minuto.
 */
export function OpeningStatusChip({ branch, className }: { branch: Branch; className?: string }) {
  const [status, setStatus] = useState<OpeningStatus | null>(null);

  useEffect(() => {
    const update = () => setStatus(getOpeningStatus(branch));
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, [branch]);

  if (!status) {
    return (
      <span
        aria-hidden
        className={cn("skeleton inline-block h-7 w-36 rounded-full", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold",
        status.open
          ? "border-success/30 bg-success/12 text-success"
          : "border-error/30 bg-error/12 text-error",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", status.open ? "bg-success" : "bg-error")}
      />
      {status.open
        ? `Abierto · hasta las ${status.closesAt}`
        : status.reason === "before-opening" && status.opensAt
          ? `Cerrado · abre a las ${status.opensAt}`
          : "Cerrado en este momento"}
    </span>
  );
}
