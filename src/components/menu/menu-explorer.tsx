"use client";

import { useDeferredValue, useEffect, useMemo, useRef } from "react";
import { CategoryChips } from "@/components/menu/category-chips";
import { FeaturedDishRow } from "@/components/menu/featured-dish-row";
import { MenuGrid } from "@/components/menu/menu-grid";
import { SearchField } from "@/components/menu/search-field";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { filterMenuItems } from "@/features/menu/filtering";
import { track } from "@/lib/analytics";
import { useMenuItemsWithAdminOverrides } from "@/hooks/use-menu-items";
import { useMenuViewStore, type MenuSort } from "@/stores/menu-view";
import type { CategoryInfo, MenuItem } from "@/types/menu";

const SORT_OPTIONS: Array<{ value: MenuSort; label: string }> = [
  { value: "recomendados", label: "Recomendados" },
  { value: "precio-asc", label: "Precio: menor a mayor" },
  { value: "precio-desc", label: "Precio: mayor a menor" },
  { value: "nombre", label: "Nombre A–Z" },
];

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
  excludeSlugs = [],
  entrance = false,
  entranceDelay = 0,
}: {
  items: MenuItem[];
  categories: CategoryInfo[];
  /** Fija la categoría (página /menu/[categoria]) y oculta los chips. */
  lockedCategory?: string | null;
  showSearch?: boolean;
  showSort?: boolean;
  excludeSlugs?: string[];
  /** Coreografía de primera entrada (post-onboarding): chips en stagger. */
  entrance?: boolean;
  entranceDelay?: number;
}) {
  const items = useMenuItemsWithAdminOverrides(baseItems);
  const query = useMenuViewStore((state) => state.query);
  const setQuery = useMenuViewStore((state) => state.setQuery);
  const storedCategory = useMenuViewStore((state) => state.categorySlug);
  const setCategory = useMenuViewStore((state) => state.setCategory);
  const sort = useMenuViewStore((state) => state.sort);
  const setSort = useMenuViewStore((state) => state.setSort);

  const categorySlug = lockedCategory ?? storedCategory;
  const deferredQuery = useDeferredValue(query);

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
    const source = excluded.size > 0 ? items.filter((item) => !excluded.has(item.slug)) : items;
    return filterMenuItems(source, { query: deferredQuery, categorySlug, sort });
  }, [items, deferredQuery, categorySlug, sort, excludeSlugs]);

  // Identidad del filtro activo: al cambiar, el grid re-anima brevemente.
  const filterKey = `${categorySlug ?? "todas"}::${deferredQuery.trim().toLowerCase()}::${sort}`;

  const hasActiveFilters = deferredQuery.trim().length > 0 || (categorySlug && !lockedCategory);

  // Bloque destacado editorial (VISUAL_CONTRACT §4.5): solo en estado de
  // exploración (sin búsqueda y con el orden por defecto) para no
  // distorsionar resultados ni ordenamientos explícitos.
  const highlight =
    sort === "recomendados" && deferredQuery.trim().length === 0
      ? filtered.find((item) => item.featured && item.available)
      : undefined;
  const listItems = highlight
    ? filtered.filter((item) => item.slug !== highlight.slug)
    : filtered;

  return (
    <div className="flex flex-col gap-4">
      {showSearch ? (
        <SearchField
          value={query}
          onValueChange={setQuery}
          placeholder="Busca platos, categorías…"
        />
      ) : null}

      {!lockedCategory ? (
        <CategoryChips
          categories={categories}
          selected={storedCategory}
          onSelect={setCategory}
          entrance={entrance}
          entranceDelay={entranceDelay}
        />
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" className="text-[13px] font-semibold text-muted">
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
              className="h-10 rounded-chip border border-border-soft bg-white/6 px-3 text-[13px] font-semibold text-foreground outline-none transition-colors focus:border-lime/60"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-background-secondary">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

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
        <>
          {highlight ? (
            <FeaturedDishRow
              item={highlight}
              size="block"
              priority
              trackSource="menu-destacado"
            />
          ) : null}
          <MenuGrid items={listItems} filterKey={filterKey} entranceDelay={entranceDelay} />
        </>
      )}
    </div>
  );
}
