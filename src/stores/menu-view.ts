"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type MenuSort = "recomendados" | "precio-asc" | "precio-desc" | "nombre";

/**
 * Estado de exploración del menú (categoría, búsqueda, orden) persistido
 * en sessionStorage: al volver desde un detalle se conservan los filtros
 * y no se reinicia la vista.
 */
interface MenuViewState {
  categorySlug: string | null;
  query: string;
  sort: MenuSort;
  setCategory: (slug: string | null) => void;
  setQuery: (query: string) => void;
  setSort: (sort: MenuSort) => void;
}

export const useMenuViewStore = create<MenuViewState>()(
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
      name: "rb-menu-view",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
