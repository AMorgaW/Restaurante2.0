"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface FavoritesState {
  slugs: string[];
  toggle: (slug: string) => void;
  isFavorite: (slug: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      slugs: [],
      toggle: (slug) => {
        set((state) => ({
          slugs: state.slugs.includes(slug)
            ? state.slugs.filter((candidate) => candidate !== slug)
            : [...state.slugs, slug],
        }));
      },
      isFavorite: (slug) => get().slugs.includes(slug),
    }),
    {
      name: "rb-favorites",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
