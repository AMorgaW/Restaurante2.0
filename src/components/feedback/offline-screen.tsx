"use client";

import { CloudOff, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Contenido de la página /offline con reintento de conexión. */
export function OfflineScreen() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="rounded-full bg-white/6 p-5 text-muted">
        <CloudOff aria-hidden className="size-10" />
      </div>
      <h1 className="text-screen-title font-extrabold tracking-tight text-balance">
        Sin conexión a internet
      </h1>
      <p className="max-w-xs text-sm leading-relaxed text-muted">
        No pudimos cargar esta página. Revisa tu conexión; el menú que ya visitaste sigue
        disponible sin red.
      </p>
      <Button size="md" onClick={() => window.location.reload()}>
        <RefreshCcw aria-hidden className="size-4" />
        Reintentar
      </Button>
    </div>
  );
}
