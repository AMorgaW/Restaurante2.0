"use client";

import { CloudOff, PackageOpen, RefreshCcw, SearchX, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { cn } from "@/lib/utils";

/** Estado vacío genérico (sin resultados, carrito vacío, etc.). */
export function EmptyState({
  icon = "package",
  title,
  description,
  action,
  className,
}: {
  icon?: "package" | "search";
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = icon === "search" ? SearchX : PackageOpen;
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-14 text-center", className)}>
      <div className="rounded-full bg-white/6 p-4 text-muted">
        <Icon aria-hidden className="size-8" />
      </div>
      <h2 className="text-lg font-bold text-balance">{title}</h2>
      {description ? <p className="max-w-xs text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Estado de error con acción de reintento. */
export function ErrorState({
  title = "Algo no salió como esperábamos",
  description = "Intenta de nuevo en unos segundos.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 px-6 py-14 text-center", className)}>
      <div className="rounded-full bg-error/12 p-4 text-error">
        <TriangleAlert aria-hidden className="size-8" />
      </div>
      <h2 className="text-lg font-bold text-balance">{title}</h2>
      <p className="max-w-xs text-sm text-muted">{description}</p>
      {onRetry ? (
        <Button variant="secondary" size="md" onClick={onRetry} className="mt-2">
          <RefreshCcw aria-hidden className="size-4" />
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}

/** Aviso persistente cuando el dispositivo pierde conexión. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-warning px-4 py-2 text-[13px] font-bold text-action-foreground"
    >
      <CloudOff aria-hidden className="size-4" />
      Sin conexión: mostrando la última información disponible.
    </div>
  );
}
