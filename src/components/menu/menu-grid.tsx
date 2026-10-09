"use client";

import { m } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FoodCardSkeleton } from "@/components/menu/food-card-skeleton";
import { MenuDishRow } from "@/components/menu/menu-dish-row";
import { EASE_OUT } from "@/components/motion/variants";
import { useHydratedReducedMotion } from "@/hooks/use-hydrated-reduced-motion";
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

// WebKit uses a full document navigation for the detail link. The marker lives
// in the tab session so the list can settle on return, but it is read only
// after the first render: the server has no sessionStorage, and reading it
// while the client module evaluates makes Motion's opacity/transform differ
// from the SSR markup.
let sessionFirstGridDone = false;
// Survives Strict Mode's second layout pass. A later remount clears it so
// the stored visit can settle the list instead of replaying the entrance.
let entranceDecision: boolean | null = null;

function readSessionGridVisited(): boolean {
  try {
    return window.sessionStorage.getItem(GRID_VISITED_KEY) === "1";
  } catch {
    return false;
  }
}

type AnimateMode = "in-view" | "none";

function settleMenuGridRows() {
  document.querySelectorAll<HTMLElement>('[data-testid="menu-grid"] > div').forEach((row) => {
    row.getAnimations().forEach((animation) => animation.cancel());
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
  const reduced = useHydratedReducedMotion();
  const [restoredFromHistory, setRestoredFromHistory] = useState(false);
  // Stays false for the server render and the client's first render so the
  // entrance styles match. A previous visit suppresses them before paint.
  const [suppressEntrance, setSuppressEntrance] = useState(false);
  const initialFilterKey = useRef(filterKey);

  useLayoutEffect(() => {
    if (entranceDecision === null) {
      entranceDecision = !(sessionFirstGridDone || readSessionGridVisited());
    }
    if (!entranceDecision) setSuppressEntrance(true);
  }, []);

  useLayoutEffect(() => {
    if (!suppressEntrance && !reduced) return;
    settleMenuGridRows();
  }, [reduced, suppressEntrance]);

  useEffect(() => {
    const alreadyVisited = entranceDecision === false;
    sessionFirstGridDone = true;
    try {
      window.sessionStorage.setItem(GRID_VISITED_KEY, "1");
    } catch {
      /* La navegación sigue siendo correcta aunque sessionStorage falle. */
    }
    const resetDecision = window.setTimeout(() => {
      entranceDecision = null;
    }, 0);
    if (!alreadyVisited) return () => window.clearTimeout(resetDecision);
    const frame = window.requestAnimationFrame(settleMenuGridRows);
    return () => {
      window.clearTimeout(resetDecision);
      window.cancelAnimationFrame(frame);
    };
  }, []);

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

  // Filtros y restauraciones mantienen la lista asentada.
  const mode: AnimateMode =
    !suppressEntrance && !restoredFromHistory && filterKey === initialFilterKey.current
      ? "in-view"
      : "none";
  const settled = suppressEntrance || reduced || restoredFromHistory;

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
    if (reduced) return { initial: false as const };
    if (mode === "in-view") {
      return {
        initial: { opacity: 1, y: 28 },
        whileInView: { opacity: 1, y: 0 },
        // El margen superior enorme cuenta como "en viewport" todo lo que
        // ya quedó ARRIBA: un scroll rápido que salta tarjetas no puede
        // dejarlas invisibles (once + IO solo dispara al intersectar).
        viewport: { once: true, margin: "4000px 0px -8% 0px" },
        transition: {
          duration: 0.48,
          ease: EASE_OUT,
          delay: entranceDelay + Math.min(index * 0.065, 0.34),
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
        <m.div
          key={item.slug}
          {...itemMotion(index)}
          // Motion puede reescribir el transform de entrada después de suprimirlo.
          className={settled ? "!transform-none !opacity-100" : undefined}
        >
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
