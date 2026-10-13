"use client";

import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CatalogMasthead } from "@/components/menu/catalog-masthead";
import { CategoryChips } from "@/components/menu/category-chips";
import { LunchSoupBanner } from "@/components/menu/lunch-soup-banner";
import { MenuGrid } from "@/components/menu/menu-grid";
import { SearchField } from "@/components/menu/search-field";
import { ServiceStatus } from "@/components/menu/service-status";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { filterMenuItems } from "@/features/menu/filtering";
import { track } from "@/lib/analytics";
import { useHydratedReducedMotion } from "@/hooks/use-hydrated-reduced-motion";
import { useMenuItemsWithAdminOverrides } from "@/hooks/use-menu-items";
import { useServicePeriod } from "@/hooks/use-service-period";
import { purchasableCatalogItems } from "@/lib/menu/flexible-orders";
import { getIncludedLunchSoups } from "@/lib/menu/included-soups";
import { shouldPlayResultsSettle } from "@/lib/menu/results-motion";
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
  mobilePresentation = "row",
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
  /** Solo /menu móvil usa la tarjeta compacta. El default conserva la fila. */
  mobilePresentation?: "row" | "compact";
}) {
  const items = useMenuItemsWithAdminOverrides(baseItems, allowDemoOverrides);
  const query = useMenuViewStore((state) => state.query);
  const setQuery = useMenuViewStore((state) => state.setQuery);
  const storedCategory = useMenuViewStore((state) => state.categorySlug);
  const setCategory = useMenuViewStore((state) => state.setCategory);
  const sort = useMenuViewStore((state) => state.sort);
  const setSort = useMenuViewStore((state) => state.setSort);
  const reduced = useHydratedReducedMotion();
  const [menuEntrance] = useState(() => !sessionMenuEntranceDone);
  const service = useServicePeriod(initialServiceSnapshot);

  useEffect(() => {
    sessionMenuEntranceDone = true;
  }, []);

  useLayoutEffect(() => {
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem("rb-menu-scroll-y");
    } catch {
      return;
    }
    if (stored === null) return;
    const y = Number(stored);
    if (!Number.isFinite(y) || y <= 0) return;
    // No borrar la clave hasta aplicar el scroll: en development React Strict Mode
    // monta→limpia→remonta y cancelaría el rAF dejando el listado arriba.
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: "instant" });
      try {
        sessionStorage.removeItem("rb-menu-scroll-y");
      } catch {
        /* ignore */
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const catalogItems = useMemo(() => purchasableCatalogItems(items), [items]);
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

  // Categoría, búsqueda y orden. La lista cambia en este mismo render.
  const filterKey = `${categorySlug ?? "todas"}::${deferredQuery.trim().toLowerCase()}::${sort}`;
  // `at` vive en el estado: un ref se adelantaría en el doble render de desarrollo
  // y el cambio real parecería un filtro repetido.
  const [resultsMotion, setResultsMotion] = useState({ key: filterKey, play: false, at: 0 });
  if (filterKey !== resultsMotion.key) {
    const now = performance.now();
    const play = shouldPlayResultsSettle(resultsMotion.key, filterKey, resultsMotion.at, now);
    setResultsMotion({ key: filterKey, play, at: play ? now : resultsMotion.at });
  }

  const hasActiveFilters = deferredQuery.trim().length > 0 || (categorySlug && !lockedCategory);
  const resultsClassName = resultsMotion.play ? "menu-results-swap" : undefined;

  return (
    <div className="menu-explorer flex flex-col gap-4">
      <CatalogMasthead title={title} period={service.period}>
          <ServiceStatus period={service.period} />
          {service.period === "lunch" ? <LunchSoupBanner soups={includedSoups} /> : null}
          {showSearch ? (
            <SearchField
              value={query}
              onValueChange={setQuery}
              placeholder="Busca platos, categorías…"
            />
          ) : null}
          {!lockedCategory ? (
            <CategoryChips
              categories={visibleCategories}
              selected={storedCategory}
              onSelect={setCategory}
              entrance={menuEntrance && !reduced}
              entranceDelay={entranceDelay}
            />
          ) : null}
          <div className="menu-toolbar flex min-h-12 items-center justify-between gap-3 px-1 pt-1">
            <p aria-live="polite" className="shrink-0 text-[13px] font-semibold text-muted">
              {filtered.length === 1 ? "1 plato" : `${filtered.length} platos`}
            </p>
            {showSort ? (
              <div className="flex min-w-0 items-center gap-2">
                <label htmlFor="menu-sort" className="sr-only">
                  Ordenar por
                </label>
                <select
                  id="menu-sort"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as MenuSort)}
                  className="menu-sort-control h-11 min-w-0 max-w-[13.5rem] rounded-chip border border-border-soft bg-white px-3 text-[13px] font-semibold text-foreground outline-none"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
      </CatalogMasthead>

      {filtered.length === 0 ? (
        <div className={resultsClassName} data-results-motion={resultsMotion.play ? "settle" : "instant"}>
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
        </div>
      ) : (
        <MenuGrid
          items={filtered}
          filterKey={filterKey}
          settleResults={resultsMotion.play}
          entranceDelay={menuEntrance ? Math.max(entranceDelay, service.period === "lunch" ? 0.56 : 0.48) : 0}
          servicePeriod={service.period}
          hasAvailableSoup={includedSoups.some((soup) => soup.available)}
          mobilePresentation={mobilePresentation}
        />
      )}
    </div>
  );
}
