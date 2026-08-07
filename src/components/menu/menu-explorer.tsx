"use client";

import { m, useReducedMotion } from "motion/react";
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CategoryChips } from "@/components/menu/category-chips";
import { LunchSoupBanner } from "@/components/menu/lunch-soup-banner";
import { MenuGrid } from "@/components/menu/menu-grid";
import { SearchField } from "@/components/menu/search-field";
import { ServiceStatus } from "@/components/menu/service-status";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { filterMenuItems } from "@/features/menu/filtering";
import { track } from "@/lib/analytics";
import { EASE_OUT } from "@/components/motion/variants";
import { useMenuItemsWithAdminOverrides } from "@/hooks/use-menu-items";
import { useServicePeriod } from "@/hooks/use-service-period";
import { getIncludedLunchSoups, isSoupItem } from "@/lib/menu/included-soups";
import { DEFAULT_SERVICE_SNAPSHOT, type ServiceSnapshot } from "@/lib/menu/service-period";
import { useMenuViewStore, type MenuSort } from "@/stores/menu-view";
import type { CategoryInfo, MenuItem } from "@/types/menu";

const SORT_OPTIONS: Array<{ value: MenuSort; label: string }> = [
  { value: "recomendados", label: "Recomendados" },
  { value: "precio-asc", label: "Precio: menor a mayor" },
  { value: "precio-desc", label: "Precio: mayor a menor" },
  { value: "nombre", label: "Nombre A–Z" },
];

// Se consume en la primera entrada real de /menu de esta pestaña. No se
// reinicia con router.back(), favoritos ni mutaciones del carrito.
let sessionMenuEntranceDone = false;

/**
 * Explorador de menú reutilizado en inicio, /menu y /menu/[categoria].
 * El estado (búsqueda, categoría, orden) vive en un store de sesión:
 * volver desde un detalle conserva filtros y scroll.
 */
export function MenuExplorer({
  items: baseItems,
  categories,
  lockedCategory = null,
  showSearch = true,
  showSort = false,
  title,
  initialServiceSnapshot = DEFAULT_SERVICE_SNAPSHOT,
  excludeSlugs = [],
  entrance: _legacyEntrance = false,
  entranceDelay = 0,
  allowDemoOverrides = true,
}: {
  items: MenuItem[];
  categories: CategoryInfo[];
  /** Fija la categoría (página /menu/[categoria]) y oculta los chips. */
  lockedCategory?: string | null;
  showSearch?: boolean;
  showSort?: boolean;
  /** Título contextual, animado únicamente en el primer montaje válido. */
  title?: string;
  initialServiceSnapshot?: ServiceSnapshot;
  excludeSlugs?: string[];
  /** Compatibilidad con antiguos consumidores; la entrada se decide por sesión. */
  entrance?: boolean;
  entranceDelay?: number;
  /** Solo DATA_MODE=local puede aplicar overrides demo del panel. */
  allowDemoOverrides?: boolean;
}) {
  const items = useMenuItemsWithAdminOverrides(baseItems, allowDemoOverrides);
  const query = useMenuViewStore((state) => state.query);
  const setQuery = useMenuViewStore((state) => state.setQuery);
  const storedCategory = useMenuViewStore((state) => state.categorySlug);
  const setCategory = useMenuViewStore((state) => state.setCategory);
  const sort = useMenuViewStore((state) => state.sort);
  const setSort = useMenuViewStore((state) => state.setSort);
  const reduced = useReducedMotion() ?? false;
  const [menuEntrance] = useState(() => !sessionMenuEntranceDone);
  const service = useServicePeriod(initialServiceSnapshot);

  useEffect(() => {
    sessionMenuEntranceDone = true;
  }, []);

  useLayoutEffect(() => {
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem("rb-menu-scroll-y");
      if (stored !== null) sessionStorage.removeItem("rb-menu-scroll-y");
    } catch {
      return;
    }
    if (stored === null) return;
    const y = Number(stored);
    if (!Number.isFinite(y) || y <= 0) return;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, []);

  const catalogItems = useMemo(() => items.filter((item) => !isSoupItem(item)), [items]);
  const includedSoups = useMemo(() => getIncludedLunchSoups(items), [items]);
  const visibleCategories = useMemo(
    () => categories.filter((category) => catalogItems.some((item) => item.categorySlug === category.slug)),
    [categories, catalogItems],
  );
  const categorySlug = lockedCategory ?? storedCategory;
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (!lockedCategory && storedCategory && !visibleCategories.some((entry) => entry.slug === storedCategory)) {
      setCategory(null);
    }
  }, [lockedCategory, setCategory, storedCategory, visibleCategories]);

  // Telemetría de búsqueda sin PII, con debounce natural del deferred value.
  const lastTracked = useRef("");
  useEffect(() => {
    const trimmed = deferredQuery.trim();
    if (trimmed.length >= 3 && trimmed !== lastTracked.current) {
      lastTracked.current = trimmed;
      track("search_menu", { length: trimmed.length });
    }
  }, [deferredQuery]);

  const filtered = useMemo(() => {
    const excluded = new Set(excludeSlugs);
    const source = excluded.size > 0 ? catalogItems.filter((item) => !excluded.has(item.slug)) : catalogItems;
    return filterMenuItems(source, { query: deferredQuery, categorySlug, sort });
  }, [catalogItems, deferredQuery, categorySlug, sort, excludeSlugs]);

  // Identidad del filtro activo: al cambiar, el grid re-anima brevemente.
  const filterKey = `${categorySlug ?? "todas"}::${deferredQuery.trim().toLowerCase()}::${sort}`;

  const hasActiveFilters = deferredQuery.trim().length > 0 || (categorySlug && !lockedCategory);

  const reveal = (delay: number) =>
    reduced
      ? { initial: false as const }
      : menuEntrance
      ? {
          initial: { opacity: 1, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.32, delay, ease: EASE_OUT },
        }
      : { initial: false as const };

  return (
    <div className="menu-explorer flex flex-col gap-4">
      <m.div {...reveal(0.08)}>
        <ServiceStatus period={service.period} />
      </m.div>
      {service.period === "lunch" ? (
        <m.div {...reveal(0.16)}>
          <LunchSoupBanner soups={includedSoups} />
        </m.div>
      ) : null}
      {title ? (
        <m.div {...reveal(service.period === "lunch" ? 0.24 : 0.16)} className="menu-heading relative isolate overflow-hidden rounded-[1.4rem] px-4 py-3.5 sm:px-5">
          <h1 className="text-screen-title font-extrabold tracking-[-0.04em]">{title}</h1>
        </m.div>
      ) : null}
      {showSearch ? (
        <m.div {...reveal(service.period === "lunch" ? 0.32 : 0.24)}>
          <SearchField
          value={query}
          onValueChange={setQuery}
          placeholder="Busca platos, categorías…"
          />
        </m.div>
      ) : null}

      {!lockedCategory ? (
        <m.div {...reveal(service.period === "lunch" ? 0.4 : 0.32)}>
          <CategoryChips
          categories={visibleCategories}
          selected={storedCategory}
          onSelect={setCategory}
          entrance={menuEntrance && !reduced}
          entranceDelay={entranceDelay}
          />
        </m.div>
      ) : null}

      <m.div {...reveal(service.period === "lunch" ? 0.48 : 0.4)} className="menu-toolbar flex min-h-12 items-center justify-between gap-3 rounded-[1.15rem] px-3 py-1.5 sm:px-4">
        <p aria-live="polite" className="shrink-0 text-[13px] font-semibold text-muted">
          {filtered.length === 1 ? "1 plato" : `${filtered.length} platos`}
        </p>
        {showSort ? (
          <div className="flex items-center gap-2">
            <label htmlFor="menu-sort" className="sr-only">
              Ordenar por
            </label>
            <select
              id="menu-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as MenuSort)}
              className="menu-sort-control h-10 min-w-0 max-w-[13.5rem] rounded-chip border border-border-soft bg-white/6 px-3 text-[13px] font-semibold text-foreground outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-background-secondary">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </m.div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title="No encontramos platos con esa búsqueda"
          description="Prueba con otro nombre o revisa todas las categorías."
          action={
            hasActiveFilters ? (
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setQuery("");
                  if (!lockedCategory) setCategory(null);
                }}
              >
                Limpiar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <MenuGrid
          items={filtered}
          filterKey={filterKey}
          entranceDelay={menuEntrance ? Math.max(entranceDelay, service.period === "lunch" ? 0.56 : 0.48) : 0}
          servicePeriod={service.period}
          hasAvailableSoup={includedSoups.some((soup) => soup.available)}
        />
      )}
    </div>
  );
}
