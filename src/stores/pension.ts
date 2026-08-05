"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PENSION_DEMO_PROFILES } from "@/lib/pension/fixtures";
import { registerPensionConsumption } from "@/lib/pension/operations";
import { usePensionAdminStore } from "@/stores/pension-admin";
import type { PensionConsumption } from "@/lib/pension/types";
import type { PensionDailyMenu, PensionSelection } from "@/lib/pension/types";

interface PensionState {
  selectedProfileId: string;
  demoSessionActive: boolean;
  consumptions: PensionConsumption[];
  mealBalances: Record<string, number>;
  setDemoProfile: (profileId: string) => void;
  registerConsumption: (menu: PensionDailyMenu, selections: PensionSelection[], now: string) => PensionConsumption;
}

export const usePensionStore = create<PensionState>()(
  persist(
    (set, get) => ({
      selectedProfileId: PENSION_DEMO_PROFILES[2]!.id,
      demoSessionActive: false,
      consumptions: [],
      mealBalances: { "membership-active": 22, "membership-suspended": 12, "membership-expired": 0, "membership-cancelled": 4 },
      setDemoProfile: (profileId) => {
        if (PENSION_DEMO_PROFILES.some((profile) => profile.id === profileId)) set({ selectedProfileId: profileId, demoSessionActive: true });
      },
  registerConsumption: (menu, selections, now) => {
        const memberships = usePensionAdminStore.getState().memberships;
        const baseMembership = memberships.find((candidate) => candidate.profileId === get().selectedProfileId);
        if (!baseMembership) throw new Error("No existe una membresía demo para este perfil.");
        const membership = { ...baseMembership, ...(get().mealBalances[baseMembership.id] !== undefined ? { mealsAvailable: get().mealBalances[baseMembership.id] } : {}) };
        const consumption = registerPensionConsumption({ membership, menu, selections, existing: get().consumptions, now });
        set((state) => ({ consumptions: [consumption, ...state.consumptions], mealBalances: { ...state.mealBalances, [membership.id]: Math.max(0, (membership.mealsAvailable ?? 0) - consumption.mealsUsed) } }));
        return consumption;
      },
    }),
    {
      name: "rb-pension",
      version: 2,
      migrate: (state) => ({ ...(state as object), demoSessionActive: true }) as PensionState,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function syncPensionBalance(membershipId: string, mealsAvailable: number): void {
  usePensionStore.setState((state) => ({ mealBalances: { ...state.mealBalances, [membershipId]: mealsAvailable } }));
}

export function resetPensionDemo(): void {
  usePensionStore.setState({ selectedProfileId: PENSION_DEMO_PROFILES[2]!.id, demoSessionActive: false, consumptions: [], mealBalances: { "membership-active": 22, "membership-suspended": 12, "membership-expired": 0, "membership-cancelled": 4 } });
}
