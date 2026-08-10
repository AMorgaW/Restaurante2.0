"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const SCROLL_STEP_RATIO = 0.7;
const OVERFLOW_EPS = 2;

type ScrollEdges = {
  overflow: boolean;
  canLeft: boolean;
  canRight: boolean;
};

function readEdges(el: HTMLElement | null): ScrollEdges {
  if (!el) {
    return { overflow: false, canLeft: false, canRight: false };
  }
  const { scrollLeft, scrollWidth, clientWidth } = el;
  const maxScroll = scrollWidth - clientWidth;
  const overflow = maxScroll > OVERFLOW_EPS;
  return {
    overflow,
    canLeft: overflow && scrollLeft > OVERFLOW_EPS,
    canRight: overflow && scrollLeft < maxScroll - OVERFLOW_EPS,
  };
}

function edgesEqual(a: ScrollEdges, b: ScrollEdges): boolean {
  return a.overflow === b.overflow && a.canLeft === b.canLeft && a.canRight === b.canRight;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Mobile horizontal admin nav with overflow affordance.
 * Desktop (md+) stays a plain vertical list — no scroller chrome.
 */
export function AdminNavScroller({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLUListElement>(null);
  const rafRef = useRef<number | null>(null);
  const [edges, setEdges] = useState<ScrollEdges>({
    overflow: false,
    canLeft: false,
    canRight: false,
  });

  const updateEdges = useCallback(() => {
    const next = readEdges(scrollerRef.current);
    setEdges((prev) => (edgesEqual(prev, next) ? prev : next));
  }, []);

  /** Coalesce scroll/resize/observer noise to one read per frame. */
  const scheduleUpdate = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      updateEdges();
    });
  }, [updateEdges]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    updateEdges();

    el.addEventListener("scroll", scheduleUpdate, { passive: true });

    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleUpdate) : null;
    ro?.observe(el);

    // childList is enough for nav item mount/unmount; avoid characterData thrash.
    const mo =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(scheduleUpdate)
        : null;
    mo?.observe(el, { childList: true, subtree: true });

    window.addEventListener("resize", scheduleUpdate);

    return () => {
      el.removeEventListener("scroll", scheduleUpdate);
      ro?.disconnect();
      mo?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [scheduleUpdate, updateEdges]);

  const scrollByPage = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.max(120, el.clientWidth * SCROLL_STEP_RATIO) * direction;
    el.scrollBy({
      left: delta,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  return (
    <div className={cn("relative", className)} data-admin-nav-scroller>
      {edges.overflow && edges.canLeft ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background-secondary to-transparent md:hidden"
        />
      ) : null}
      {edges.overflow && edges.canRight ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background-secondary to-transparent md:hidden"
        />
      ) : null}

      {edges.overflow && edges.canLeft ? (
        <button
          type="button"
          aria-label="Desplazar navegación a la izquierda"
          onClick={() => scrollByPage(-1)}
          className="absolute left-0 top-1/2 z-20 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border-soft bg-surface/95 text-foreground shadow-sm md:hidden"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </button>
      ) : null}
      {edges.overflow && edges.canRight ? (
        <button
          type="button"
          aria-label="Desplazar navegación a la derecha"
          onClick={() => scrollByPage(1)}
          className="absolute right-0 top-1/2 z-20 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border-soft bg-surface/95 text-foreground shadow-sm md:hidden"
        >
          <ChevronRight aria-hidden className="size-4" />
        </button>
      ) : null}

      <ul
        ref={scrollerRef}
        className="no-scrollbar flex gap-1 overflow-x-auto md:flex-col md:overflow-visible"
      >
        {children}
      </ul>
    </div>
  );
}
