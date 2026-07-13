"use client";

import { m, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { FoodCardSkeleton } from "@/components/menu/food-card-skeleton";
import { MenuDishRow } from "@/components/menu/menu-dish-row";
import { EASE_OUT } from "@/components/motion/variants";
import type { MenuItem } from "@/types/menu";

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
let sessionFirstGridDone = false;

type AnimateMode = "in-view" | "filter" | "none";

export function MenuGrid({
  items,
  loading = false,
  skeletonCount = 6,
  filterKey = "",
  entranceDelay = 0,
}: {
  items: MenuItem[];
  loading?: boolean;
  skeletonCount?: number;
  /** Identidad del filtro activo; al cambiar, re-anima brevemente la entrada. */
  filterKey?: string;
  /** Retraso base (s) para la coreografía post-onboarding del home. */
  entranceDelay?: number;
}) {
  const reduced = useReducedMotion() ?? false;

  const isFirstInstance = useRef(!sessionFirstGridDone);
  const prevFilter = useRef(filterKey);
  const inViewDisabled = useRef(false);

  useEffect(() => {
    sessionFirstGridDone = true;
  }, []);

  const filterChanged = filterKey !== prevFilter.current;
  if (filterChanged) {
    inViewDisabled.current = true;
  }
  useEffect(() => {
    prevFilter.current = filterKey;
  });

  const mode: AnimateMode = filterChanged
    ? "filter"
    : isFirstInstance.current && !inViewDisabled.current
      ? "in-view"
      : "none";

  if (loading) {
    return (
      <div
        aria-busy="true"
        aria-label="Cargando platos"
        className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3"
      >
        {Array.from({ length: skeletonCount }, (_, index) => (
          <FoodCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  const itemMotion = (index: number) => {
    if (mode === "filter") {
      return {
        initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: reduced ? 0.1 : 0.22,
          ease: EASE_OUT,
          delay: reduced ? 0 : Math.min(index * 0.03, 0.18),
        },
      };
    }
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
          delay: entranceDelay + (reduced ? 0 : (index % 4) * 0.06),
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
      className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3"
    >
      {items.map((item, index) => (
        <m.div key={item.slug} {...itemMotion(index)}>
          <MenuDishRow item={item} priority={index < 2} />
        </m.div>
      ))}
    </div>
  );
}
