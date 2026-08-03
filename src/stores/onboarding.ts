"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface OnboardingState {
  seen: boolean;
  /** Indica que Zustand ya terminó de recuperar rb-onboarding. No se persiste. */
  hasHydrated: boolean;
  /**
   * true solo durante la transición onboarding→home de ESTA carga: activa
   * la coreografía de entrada del home una única vez. No se persiste.
   */
  justCompleted: boolean;
  markSeen: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  /** Consume el flag de entrada tras reproducir la coreografía. */
  consumeEntrance: () => void;
  /** Permite volver a ver la bienvenida desde el perfil. */
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      seen: false,
      hasHydrated: false,
      justCompleted: false,
      markSeen: () => set({ seen: true, justCompleted: true }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      consumeEntrance: () => set({ justCompleted: false }),
      reset: () => set({ seen: false, justCompleted: false }),
    }),
    {
      name: "rb-onboarding",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ seen: state.seen }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
