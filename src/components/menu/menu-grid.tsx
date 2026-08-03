"use client";

import { m, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { FoodCardSkeleton } from "@/components/menu/food-card-skeleton";
import { MenuDishRow } from "@/components/menu/menu-dish-row";
import { EASE_OUT } from "@/components/motion/variants";
import type { MenuItem } from "@/types/menu";
import type { ServicePeriod } from "@/lib/menu/service-period";

/**
 * Materialización de tarjetas calibrada con el video de referencia
 * (references/analysis/MOTION_SPEC.md, escenas 3–4):
 *
 * - Primera aparición de la sesión: cada tarjeta se revela UNA sola vez
 *   al entrar al viewport (whileInView + once), también bajo el pliegue.
 * - Cambio de filtro/búsqueda: stagger corto de entrada (≤200 ms total).
 * - Regreso desde el detalle u otros remontajes: SIN animación (el
 *   prompt maestro prohíbe re-animar al volver; prevalece sobre el video).
 */
const GRID_VISITED_KEY = "rb-menu-grid-visited";

// WebKit uses a full document navigation for the detail link. Persisting the
// one-time entrance marker in the tab session keeps the list settled when the
// browser returns, while the SSR branch remains deterministic (no window
// access on the server).
let sessionFirstGridDone = false;
if (typeof window !== "undefined") {
  try {
    sessionFirstGridDone = window.sessionStorage.getItem(GRID_VISITED_KEY) === "1";
  } catch {
    /* La animación inicial sigue siendo válida si sessionStorage no existe. */
  }
}

type AnimateMode = "in-view" | "none";

function settleMenuGridRows() {
  document.querySelectorAll<HTMLElement>('[data-testid="menu-grid"] > div').forEach((row) => {
    row.style.opacity = "1";
    row.style.transform = "none";
  });
}

export function MenuGrid({
  items,
  loading = false,
  skeletonCount = 6,
  filterKey = "",
  entranceDelay = 0,
  servicePeriod = "dinner",
  hasAvailableSoup = false,
}: {
  items: MenuItem[];
  loading?: boolean;
  skeletonCount?: number;
  /** Identidad del filtro activo; al cambiar, re-anima brevemente la entrada. */
  filterKey?: string;
  /** Retraso base (s) para la coreografía post-onboarding del home. */
  entranceDelay?: number;
  servicePeriod?: ServicePeriod;
  hasAvailableSoup?: boolean;
}) {
  const reduced = useReducedMotion() ?? false;
  const gridWasVisited = sessionFirstGridDone;

  const [restoredFromHistory, setRestoredFromHistory] = useState(false);

  useEffect(() => {
    sessionFirstGridDone = true;
    try {
      window.sessionStorage.setItem(GRID_VISITED_KEY, "1");
    } catch {
      /* La navegación sigue siendo correcta aunque sessionStorage falle. */
    }
    if (gridWasVisited) {
      const frame = window.requestAnimationFrame(settleMenuGridRows);
      return () => window.cancelAnimationFrame(frame);
    }
  }, [gridWasVisited]);

  useEffect(() => {
    const settleBeforeHistory = () => {
      setRestoredFromHistory(true);
      settleMenuGridRows();
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) settleBeforeHistory();
    };
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("pagehide", settleBeforeHistory);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("pagehide", settleBeforeHistory);
    };
  }, []);

  // Filtros y restauraciones mantienen su geometría asentada: no se vuelve
  // a animar la lista completa al cambiar categoría, volver o mutar acciones.
  const mode: AnimateMode = !restoredFromHistory && !sessionFirstGridDone ? "in-view" : "none";

  if (loading) {
    return (
      <div
        aria-busy="true"
        aria-label="Cargando platos"
        className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4"
      >
        {Array.from({ length: skeletonCount }, (_, index) => (
          <FoodCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  const itemMotion = (index: number) => {
    if (mode === "in-view") {
      return {
        initial: reduced ? { opacity: 0 } : { opacity: 0, y: 16 },
        whileInView: { opacity: 1, y: 0 },
        // El margen superior enorme cuenta como "en viewport" todo lo que
        // ya quedó ARRIBA: un scroll rápido que salta tarjetas no puede
        // dejarlas invisibles (once + IO solo dispara al intersectar).
        viewport: { once: true, margin: "4000px 0px -8% 0px" },
        transition: {
          duration: reduced ? 0.15 : 0.3,
          ease: EASE_OUT,
          delay: entranceDelay + (reduced ? 0 : Math.min(index * 0.065, 0.34)),
        },
      };
    }
    return { initial: false as const };
  };

  return (
    // Lista editorial en móvil (filas de la referencia); en escritorio las
    // MISMAS filas en rejilla 2–3 cols (nunca DOM duplicado por breakpoint:
    // rompería la unicidad de viewTransitionName por plato).
    <div
      key={filterKey}
      data-testid="menu-grid"
      className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4"
    >
      {items.map((item, index) => (
        <m.div key={item.slug} {...itemMotion(index)}>
          <MenuDishRow
            item={item}
            priority={index < 2}
            servicePeriod={servicePeriod}
            hasAvailableSoup={hasAvailableSoup}
          />
        </m.div>
      ))}
    </div>
  );
}
