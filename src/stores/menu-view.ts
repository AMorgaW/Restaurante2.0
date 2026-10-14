"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getMenuViewStorageKey, type MenuViewScope } from "@/lib/menu/view-scope";

export type MenuSort = "recomendados" | "precio-asc" | "precio-desc" | "nombre";

/**
 * Estado de exploración del menú (categoría, búsqueda, orden) persistido
 * en sessionStorage: al volver desde un detalle se conservan los filtros
 * y no se reinicia la vista.
 */
export interface MenuViewState {
  categorySlug: string | null;
  query: string;
  sort: MenuSort;
  setCategory: (slug: string | null) => void;
  setQuery: (query: string) => void;
  setSort: (sort: MenuSort) => void;
}

function createMenuViewStore(scope: MenuViewScope) {
  return create<MenuViewState>()(
    persist(
      (set) => ({
        categorySlug: null,
        query: "",
        sort: "recomendados",
        setCategory: (slug) => set({ categorySlug: slug }),
        setQuery: (query) => set({ query }),
        setSort: (sort) => set({ sort }),
      }),
      {
        name: getMenuViewStorageKey(scope),
        version: 1,
        storage: createJSONStorage(() => sessionStorage),
      },
    ),
  );
}

/** Existing catalog state; keep this export stable for /menu and home. */
export const useMenuViewStore = createMenuViewStore("catalog");

/** Search-only state, sharing the same store mechanism with a separate key. */
export const useSearchViewStore = createMenuViewStore("search");
