"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FoodCardSkeleton } from "@/components/menu/food-card-skeleton";
import { MenuDishRow } from "@/components/menu/menu-dish-row";
import { useHydratedReducedMotion } from "@/hooks/use-hydrated-reduced-motion";
import type { MenuItem } from "@/types/menu";
import type { ServicePeriod } from "@/lib/menu/service-period";

/**
 * Una sola entrada por tarjeta, en `.menu-card-rise`.
 *
 * El HTML y el primer render no desplazan nada. Así una visita ya
 * guardada no salta antes de leer sessionStorage. La subida sigue el
 * avance dentro del viewport y no se repite al volver a pasar.
 */
const GRID_VISITED_KEY = "rb-menu-grid-visited";

let sessionFirstGridDone = false;
let entranceDecision: boolean | null = null;

type EntranceEngine = "off" | "observer";

const RISE_START = 0.06;
const RISE_END = 0.62;

function entryRaw(card: HTMLElement) {
  const rect = card.getBoundingClientRect();
  if (rect.height <= 0) return 1;
  return (window.innerHeight - rect.top) / rect.height;
}

function riseDistance() {
  const host = document.querySelector(".catalog-shell");
  const raw = getComputedStyle(host ?? document.documentElement).getPropertyValue("--menu-card-rise");
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 22;
}

function atScrollEnd() {
  const root = document.documentElement;
  return window.scrollY + window.innerHeight >= root.scrollHeight - 4;
}

function bindScroll(update: () => void) {
  update();
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  return () => {
    window.cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
  };
}

function watchViewportEntry(root: HTMLElement) {
  const seen = new WeakMap<HTMLElement, number>();
  const distance = riseDistance();
  return bindScroll(() => {
    const finished = atScrollEnd();
    root.querySelectorAll<HTMLElement>(".menu-card-rise:not([data-rise='done'])").forEach((card) => {
      const raw = entryRaw(card);
      const previous = seen.get(card) ?? 0;
      if (raw <= RISE_START) {
        if (previous > 0 || card.getBoundingClientRect().bottom < -8) {
          card.style.transform = "";
          card.dataset.rise = "done";
          return;
        }
        card.style.transform = `translateY(${distance}px)`;
        return;
      }
      const progress = Math.min(1, (raw - RISE_START) / (RISE_END - RISE_START));
      if (progress >= 1 || finished) {
        card.style.transform = "";
        card.dataset.rise = "done";
        return;
      }
      const shown = Math.max(previous, progress);
      seen.set(card, shown);
      card.style.transform = `translateY(${((1 - shown) * distance).toFixed(2)}px)`;
    });
  });
}

function readSessionGridVisited(): boolean {
  try {
    return window.sessionStorage.getItem(GRID_VISITED_KEY) === "1";
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function settleMenuCards() {
  document.querySelectorAll<HTMLElement>(".menu-card-rise").forEach((card) => {
    card.getAnimations().forEach((animation) => animation.cancel());
    card.style.transform = "";
    card.dataset.rise = "done";
  });
  document.querySelector("[data-testid='menu-grid']")?.setAttribute("data-menu-entrance", "settled");
}

export function MenuGrid({
  items,
  loading = false,
  skeletonCount = 6,
  filterKey = "",
  servicePeriod = "dinner",
  hasAvailableSoup = false,
}: {
  items: MenuItem[];
  loading?: boolean;
  skeletonCount?: number;
  /** Identidad del filtro activo. Al cambiar, la lista queda en reposo. */
  filterKey?: string;
  /** Conservado por la coreografía del masthead; la tarjeta ya no lo usa para desplazarse. */
  entranceDelay?: number;
  servicePeriod?: ServicePeriod;
  hasAvailableSoup?: boolean;
}) {
  const reduced = useHydratedReducedMotion();
  const [restoredFromHistory, setRestoredFromHistory] = useState(false);
  const [visitSettled, setVisitSettled] = useState(false);
  const [engine, setEngine] = useState<EntranceEngine>("off");
  const initialFilterKey = useRef(filterKey);
  const gridRef = useRef<HTMLDivElement>(null);
  const filterChanged = filterKey !== initialFilterKey.current;
  const entranceMode =
    visitSettled || reduced || restoredFromHistory || filterChanged ? "settled" : engine;

  useLayoutEffect(() => {
    if (entranceDecision === null) {
      entranceDecision = !(sessionFirstGridDone || readSessionGridVisited());
    }
    if (!entranceDecision || prefersReducedMotion()) {
      setVisitSettled(true);
      return;
    }
    setEngine("observer");
  }, []);

  useLayoutEffect(() => {
    if (entranceMode === "settled") settleMenuCards();
  }, [entranceMode, filterKey]);

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
    return () => {
      window.clearTimeout(resetDecision);
      if (alreadyVisited) settleMenuCards();
    };
  }, []);

  useLayoutEffect(() => {
    const root = gridRef.current;
    if (!root || entranceMode === "off" || entranceMode === "settled") return;
    return watchViewportEntry(root);
  }, [entranceMode, filterKey, items.length]);

  useEffect(() => {
    const settleBeforeHistory = () => {
      setRestoredFromHistory(true);
      settleMenuCards();
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

  return (
    <div
      key={filterKey}
      ref={gridRef}
      data-testid="menu-grid"
      data-menu-entrance={entranceMode}
      className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4"
    >
      {items.map((item, index) => (
        <div key={item.slug} className="!transform-none !opacity-100">
          <MenuDishRow
            item={item}
            priority={index < 2}
            servicePeriod={servicePeriod}
            hasAvailableSoup={hasAvailableSoup}
          />
        </div>
      ))}
    </div>
  );
}
