"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AdminItemOverride } from "@/types/menu";

export type AdminRole =
  | "owner"
  | "admin"
  | "manager"
  | "kitchen"
  | "cashier"
  | "editor"
  | "support";

/** Permisos por rol, listos para conectarse a autorización real. */
export const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<string>> = {
  owner: new Set(["view", "edit-menu", "edit-prices", "edit-orders", "edit-settings", "manage-users"]),
  admin: new Set(["view", "edit-menu", "edit-prices", "edit-orders", "edit-settings", "manage-users"]),
  manager: new Set(["view", "edit-menu", "edit-prices", "edit-orders"]),
  kitchen: new Set(["view", "edit-orders"]),
  cashier: new Set(["view", "edit-orders"]),
  editor: new Set(["view", "edit-menu"]),
  support: new Set(["view"]),
};

export function roleCan(role: AdminRole | null, permission: string): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

interface AdminState {
  /** Sesión DEMO explícita (sin credenciales). Con Supabase se usa Auth real. */
  demoRole: AdminRole | null;
  /** Ajustes demo aplicados por navegador sobre el menú generado. */
  overrides: Record<string, AdminItemOverride>;
  loginDemo: (role: AdminRole) => void;
  logout: () => void;
  setOverride: (slug: string, patch: AdminItemOverride) => void;
  clearOverride: (slug: string) => void;
  clearAllOverrides: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      demoRole: null,
      overrides: {},
      loginDemo: (role) => set({ demoRole: role }),
      logout: () => set({ demoRole: null }),
      setOverride: (slug, patch) => {
        set((state) => ({
          overrides: {
            ...state.overrides,
            [slug]: { ...state.overrides[slug], ...patch },
          },
        }));
      },
      clearOverride: (slug) => {
        set((state) => {
          const next = { ...state.overrides };
          delete next[slug];
          return { overrides: next };
        });
      },
      clearAllOverrides: () => set({ overrides: {} }),
    }),
    {
      name: "rb-admin",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
