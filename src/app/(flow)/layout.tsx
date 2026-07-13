import type { ReactNode } from "react";
import { SkipLink } from "@/components/ui/skip-link";
import { OfflineBanner } from "@/components/ui/states";

/**
 * Estructura mínima para flujos con CTA inferior propio (detalle de
 * plato, checkout, confirmación): sin navegación inferior para no
 * competir con la acción principal.
 */
export default function FlowLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <OfflineBanner />
      <main id="contenido" className="mx-auto w-full max-w-2xl flex-1">
        {children}
      </main>
    </div>
  );
}
