"use client";

import { useLayoutEffect } from "react";
import { getMenuScrollStorageKey, type MenuScrollScope } from "@/lib/menu/view-scope";

/** Restaura una sola vez el scroll del listado que acaba de volver del detalle. */
export function useMenuScrollRestoration(scope: MenuScrollScope, ready = true): void {
  useLayoutEffect(() => {
    if (!ready) return;
    const key = getMenuScrollStorageKey(scope);
    let frame = 0;
    const restore = () => {
      let stored: string | null = null;
      try {
        stored = sessionStorage.getItem(key);
      } catch {
        return;
      }
      if (stored === null) return;
      const y = Number(stored);
      if (!Number.isFinite(y) || y <= 0) return;
      // No borrar la clave hasta aplicar el scroll: en development React
      // Strict Mode monta→limpia→remonta y cancelaría el rAF dejando arriba.
      window.cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: "instant" });
        try {
          sessionStorage.removeItem(key);
        } catch {
          /* ignore */
        }
      });
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) restore();
    };
    window.addEventListener("pageshow", handlePageShow);
    restore();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [ready, scope]);
}
