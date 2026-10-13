"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CompactDishCard } from "@/components/menu/compact-dish-card";
import "./catalog-presentation.css";
import { FoodCardSkeleton } from "@/components/menu/food-card-skeleton";
import { MenuDishRow } from "@/components/menu/menu-dish-row";
import { useHydratedReducedMotion } from "@/hooks/use-hydrated-reduced-motion";
import { disarmCompactEnterOffset, releaseCompactEntranceDecision } from "@/lib/menu/catalog-enter-session";
import {
  CALIBRATION_SLIDE_END,
  CALIBRATION_SLIDE_START,
  calibrationSlideDistance,
  ENTRANCE_BREAKPOINT,
  entranceAxis,
  entranceOffset,
  resolveCardAxis,
  SLIDE_END,
  SLIDE_START,
  TIMED_IDLE_MS,
  TIMED_SLIDE_EASING,
  TIMED_SLIDE_MS,
  timedSlideFrom,
  timedSlidePhase,
} from "@/lib/menu/horizontal-entrance";
import type { MenuItem } from "@/types/menu";
import type { ServicePeriod } from "@/lib/menu/service-period";

/**
 * Una sola entrada por tarjeta, en `.menu-card-rise`.
 *
 * El HTML y el primer render no desplazan nada. Así una visita ya
 * guardada no salta antes de leer sessionStorage. El observador
 * prepara el recorrido mientras la tarjeta sigue fuera de pantalla y
 * deja en reposo las que ya se ven al montar. En móvil el eje es X
 * (64 px). «Plato con cebolleta» conserva los 100 px geométricos.
 * La ternera, solo en móvil, espera en esos 100 px y los recorre
 * con una animación de 360 ms. Desde 1024 px se conserva la subida
 * en Y, también en esas tarjetas.
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

function cssDistance(name: string, fallback: number) {
  const host = document.querySelector(".catalog-shell");
  const raw = getComputedStyle(host ?? document.documentElement).getPropertyValue(name);
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

function stopRiseMotion(card: HTMLElement) {
  card.getAnimations().forEach((animation) => animation.cancel());
  card.style.willChange = "";
}

function beginTimedSlide(card: HTMLElement) {
  if (card.dataset.rise === "playing" || card.dataset.rise === "done") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    stopRiseMotion(card);
    card.style.transform = "";
    card.dataset.rise = "done";
    return;
  }
  const from = timedSlideFrom();
  card.style.transform = from;
  card.style.willChange = "transform";
  card.dataset.rise = "playing";
  const animation = card.animate(
    [{ transform: from }, { transform: "translateX(0px)" }],
    { duration: TIMED_SLIDE_MS, easing: TIMED_SLIDE_EASING, fill: "both" },
  );
  const releaseInline = () => {
    card.style.transform = "";
  };
  window.requestAnimationFrame(() => {
    if (card.dataset.rise !== "playing") return;
    releaseInline();
  });
  animation.onfinish = () => {
    if (card.dataset.rise !== "playing") return;
    releaseInline();
    card.style.willChange = "";
    animation.cancel();
    card.style.transform = "";
    card.dataset.rise = "done";
  };
}

function syncTimedCard(card: HTMLElement, idle: boolean) {
  if (card.dataset.rise === "playing" || card.dataset.rise === "done") return;
  const rect = card.getBoundingClientRect();
  const price = card.querySelector<HTMLElement>(".tabular-nums");
  const heart = card.querySelector<HTMLElement>(".menu-card-favorite");
  const heartRect = heart?.getBoundingClientRect();
  const phase = timedSlidePhase({
    prepared: card.dataset.timedPrepared === "1",
    priceTop: price?.getBoundingClientRect().top ?? rect.bottom,
    viewportHeight: window.innerHeight,
    cardTop: rect.top,
    cardBottom: rect.bottom,
    heartTop: heartRect?.top ?? rect.top,
    heartBottom: heartRect?.bottom ?? rect.top,
    idle,
  });
  if (phase === "rest") {
    stopRiseMotion(card);
    card.style.transform = "";
    card.dataset.rise = "done";
    delete card.dataset.timedPrepared;
    return;
  }
  if (phase === "play") {
    card.dataset.timedPrepared = "1";
    beginTimedSlide(card);
    return;
  }
  card.dataset.timedPrepared = "1";
  card.style.transform = timedSlideFrom();
}

function paintAxis(card: HTMLElement, axis: "x" | "y", pixels: number) {
  const amount = Math.max(0, pixels);
  if (amount < 0.4) {
    card.style.transform = "";
    return;
  }
  const value = amount.toFixed(2);
  card.style.transform = axis === "x" ? `translateX(${value}px)` : `translateY(${value}px)`;
}

function cardIntersectsViewport(rect: DOMRect) {
  return rect.height > 0 && rect.bottom > 8 && rect.top < window.innerHeight - 8;
}

function atScrollEnd() {
  const root = document.documentElement;
  return window.scrollY + window.innerHeight >= root.scrollHeight - 4;
}

function bindScroll(update: () => void, root: HTMLElement) {
  update();
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", schedule);
  const resize = new ResizeObserver(schedule);
  resize.observe(root);
  root.querySelectorAll("img").forEach((img) => {
    if (!img.complete) img.addEventListener("load", schedule, { once: true });
  });
  return () => {
    window.cancelAnimationFrame(frame);
    window.removeEventListener("scroll", update);
    window.removeEventListener("resize", schedule);
    resize.disconnect();
  };
}

function watchViewportEntry(root: HTMLElement) {
  const seen = new WeakMap<HTMLElement, number>();
  const lockedAxis = new WeakMap<HTMLElement, "x" | "y">();
  let locked = false;
  let idle = false;
  let idleTimer = 0;
  let lastScrollY = window.scrollY;
  let viewportAxis = entranceAxis(window.innerWidth);
  let width = window.innerWidth;
  const armIdle = () => {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      if (Math.abs(window.scrollY - lastScrollY) > 0.5) {
        lastScrollY = window.scrollY;
        armIdle();
        return;
      }
      idle = true;
      update();
    }, TIMED_IDLE_MS);
  };
  const noteScroll = () => {
    idle = false;
    lastScrollY = window.scrollY;
    armIdle();
  };
  const update = () => {
    const nextAxis = entranceAxis(window.innerWidth);
    const axisChanged = nextAxis !== viewportAxis;
    const widthChanged = window.innerWidth !== width;
    viewportAxis = nextAxis;
    width = window.innerWidth;
    const finished = atScrollEnd();
    const risePx = cssDistance("--menu-card-rise", 22);
    const slidePx = cssDistance("--menu-card-slide", 64);
    if (!locked && window.scrollY > 2) locked = true;
    if (widthChanged) {
      root.querySelectorAll<HTMLElement>(".menu-card-rise").forEach((card) => {
        stopRiseMotion(card);
        delete card.dataset.timedPrepared;
        if (card.dataset.rise === "playing") delete card.dataset.rise;
        if (card.dataset.rise === "done") {
          card.style.transform = "";
          seen.delete(card);
          lockedAxis.delete(card);
          return;
        }
        if (!axisChanged) return;
        const visible = cardIntersectsViewport(card.getBoundingClientRect());
        seen.delete(card);
        lockedAxis.delete(card);
        card.style.transform = "";
        if (visible) card.dataset.rise = "done";
      });
    }
    if (!locked && !widthChanged) {
      root.querySelectorAll<HTMLElement>(".menu-card-rise").forEach((card) => {
        const rect = card.getBoundingClientRect();
        if (cardIntersectsViewport(rect)) {
          card.style.transform = "";
          card.dataset.rise = "done";
          seen.delete(card);
          lockedAxis.delete(card);
          return;
        }
        if (rect.top >= window.innerHeight + 4 && card.dataset.rise === "done") {
          delete card.dataset.rise;
          seen.delete(card);
          lockedAxis.delete(card);
        }
      });
    }
    root.querySelectorAll<HTMLElement>(".menu-card-rise:not([data-rise='done'])").forEach((card) => {
      const previous = seen.get(card) ?? 0;
      const axis = resolveCardAxis(viewportAxis, previous, lockedAxis.get(card) ?? null);
      if (axis === "x" && card.dataset.slideTimed === "pilot") {
        syncTimedCard(card, idle);
        return;
      }
      const rect = card.getBoundingClientRect();
      const pilot = axis === "x" && card.dataset.slideCalibration === "pilot";
      const distance = pilot
        ? calibrationSlideDistance(card.offsetWidth)
        : axis === "x"
          ? slidePx
          : risePx;
      const start = pilot ? CALIBRATION_SLIDE_START : axis === "x" ? SLIDE_START : RISE_START;
      const end = pilot ? CALIBRATION_SLIDE_END : axis === "x" ? SLIDE_END : RISE_END;
      const curve = pilot ? "hold" : "catalog";
      const raw = entryRaw(card);
      const held = entranceOffset(axis, previous, distance, curve);
      const heldPixels = axis === "x" ? held.x : held.y;
      if (raw <= start) {
        if (rect.bottom < -8) {
          card.style.transform = "";
          card.dataset.rise = "done";
          seen.delete(card);
          lockedAxis.delete(card);
          return;
        }
        const implied = start + previous * (end - start);
        const selfDip = (distance + 12) / Math.max(rect.height, 1);
        if (previous > 0 && implied - raw > selfDip && rect.top >= window.innerHeight - 8) {
          seen.delete(card);
          lockedAxis.delete(card);
          paintAxis(card, axis, distance);
          return;
        }
        if (previous > 0) lockedAxis.set(card, axis);
        paintAxis(card, axis, previous > 0 ? heldPixels : distance);
        return;
      }
      const progress = Math.min(1, (raw - start) / (end - start));
      if (progress >= 1 || finished) {
        card.style.transform = "";
        card.dataset.rise = "done";
        seen.delete(card);
        lockedAxis.delete(card);
        return;
      }
      const shown = Math.max(previous, progress);
      seen.set(card, shown);
      lockedAxis.set(card, axis);
      const travel = entranceOffset(axis, shown, distance, curve);
      paintAxis(card, axis, axis === "x" ? travel.x : travel.y);
    });
  };
  window.addEventListener("scroll", noteScroll, { passive: true });
  const stop = bindScroll(update, root);
  return () => {
    window.clearTimeout(idleTimer);
    window.removeEventListener("scroll", noteScroll);
    stop();
  };
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
    stopRiseMotion(card);
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
  settleResults = false,
  servicePeriod = "dinner",
  hasAvailableSoup = false,
  mobilePresentation = "row",
}: {
  items: MenuItem[];
  loading?: boolean;
  skeletonCount?: number;
  /** Identidad del filtro activo. Al cambiar, la subida de scroll queda en reposo. */
  filterKey?: string;
  /** Asentamiento corto. La búsqueda y los cambios seguidos lo dejan en false. */
  settleResults?: boolean;
  /** Conservado por la coreografía del masthead; la tarjeta ya no lo usa para desplazarse. */
  entranceDelay?: number;
  servicePeriod?: ServicePeriod;
  hasAvailableSoup?: boolean;
  /**
   * `compact` pinta la tarjeta horizontal bajo 1024 px y conserva la fila
   * desde ese ancho. Las dos piezas están en el HTML; el CSS muestra una.
   */
  mobilePresentation?: "row" | "compact";
}) {
  const reduced = useHydratedReducedMotion();
  const [restoredFromHistory, setRestoredFromHistory] = useState(false);
  const [visitSettled, setVisitSettled] = useState(false);
  const [engine, setEngine] = useState<EntranceEngine>("off");
  const initialFilterKey = useRef(filterKey);
  const gridRef = useRef<HTMLDivElement>(null);
  const rowPaneRef = useRef<HTMLDivElement>(null);
  const compactPaneRef = useRef<HTMLDivElement>(null);
  const filterChanged = filterKey !== initialFilterKey.current;
  const entranceMode =
    visitSettled || reduced || restoredFromHistory || filterChanged ? "settled" : engine;
  const animateCompact = mobilePresentation === "compact" && entranceMode !== "settled" && !reduced;

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
      releaseCompactEntranceDecision();
    }, 0);
    return () => {
      window.clearTimeout(resetDecision);
      if (alreadyVisited) settleMenuCards();
    };
  }, []);

  useLayoutEffect(() => {
    const root = mobilePresentation === "compact" ? rowPaneRef.current : gridRef.current;
    if (!root || entranceMode === "off" || entranceMode === "settled") return;
    if (mobilePresentation !== "compact") return watchViewportEntry(root);
    const media = window.matchMedia(`(min-width: ${ENTRANCE_BREAKPOINT}px)`);
    if (!media.matches) return;
    let stop = watchViewportEntry(root);
    const bind = () => {
      stop();
      stop = () => {};
      if (media.matches) {
        stop = watchViewportEntry(root);
        return;
      }
      settleMenuCards();
      media.removeEventListener("change", bind);
    };
    media.addEventListener("change", bind);
    return () => {
      media.removeEventListener("change", bind);
      stop();
    };
  }, [entranceMode, filterKey, items.length, mobilePresentation]);

  useLayoutEffect(() => {
    if (mobilePresentation !== "compact") return;
    const compactPane = compactPaneRef.current;
    const rowPane = rowPaneRef.current;
    if (!compactPane || !rowPane) return;
    const media = window.matchMedia(`(min-width: ${ENTRANCE_BREAKPOINT}px)`);
    const sync = () => {
      const wide = media.matches;
      compactPane.toggleAttribute("inert", wide);
      rowPane.toggleAttribute("inert", !wide);
      if (wide) disarmCompactEnterOffset();
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
      disarmCompactEnterOffset();
    };
  }, [mobilePresentation, filterKey]);

  useEffect(() => {
    const settleBeforeHistory = () => {
      disarmCompactEnterOffset();
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

  const rows = items.map((item, index) => (
    <div key={item.slug} className="!transform-none !opacity-100">
      <MenuDishRow
        item={item}
        priority={index < 2}
        servicePeriod={servicePeriod}
        hasAvailableSoup={hasAvailableSoup}
        photoReveal={entranceMode === "observer"}
      />
    </div>
  ));

  return (
    <div
      key={filterKey}
      ref={gridRef}
      data-testid="menu-grid"
      data-menu-entrance={entranceMode}
      data-results-motion={settleResults ? "settle" : "instant"}
      data-mobile-presentation={mobilePresentation}
      className={
        mobilePresentation === "compact"
          ? settleResults
            ? "menu-results-swap"
            : undefined
          : `flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4${settleResults ? " menu-results-swap" : ""}`
      }
    >
      {mobilePresentation === "compact" ? (
        <>
          <div
            ref={compactPaneRef}
            data-catalog-pane="compact"
            data-catalog-compact=""
            className="flex flex-col gap-3 overflow-x-clip lg:hidden"
          >
            {items.map((item, index) => (
              <CompactDishCard
                key={item.slug}
                item={item}
                priority={index < 2}
                servicePeriod={servicePeriod}
                hasAvailableSoup={hasAvailableSoup}
                animateEntrance={animateCompact}
                reducedMotion={reduced}
              />
            ))}
          </div>
          <div
            ref={rowPaneRef}
            data-catalog-pane="row"
            className="hidden lg:grid lg:grid-cols-2 lg:gap-4"
          >
            {rows}
          </div>
        </>
      ) : (
        rows
      )}
    </div>
  );
}
