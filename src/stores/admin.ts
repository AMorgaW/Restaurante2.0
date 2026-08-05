"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AdminItemOverride } from "@/types/menu";
import { ADMIN_ROLES, adminRoleCan, type AdminCapability, type AdminRole } from "@/lib/admin/authorization";

export type { AdminRole } from "@/lib/admin/authorization";

/** Permisos por rol, listos para conectarse a autorización real. */
const LEGACY_PERMISSION_MAP: Record<string, AdminCapability> = {
  view: "view-dashboard",
  "edit-menu": "edit-catalog",
  "edit-prices": "edit-prices",
  "edit-orders": "transition-orders",
  "edit-settings": "edit-settings",
  "manage-users": "manage-users",
};

export const ROLE_PERMISSIONS = ADMIN_ROLES.reduce<Record<AdminRole, ReadonlySet<string>>>(
  (result, role) => {
    result[role] = new Set(Object.entries(LEGACY_PERMISSION_MAP)
      .filter(([, capability]) => adminRoleCan(role, capability))
      .map(([permission]) => permission));
    return result;
  },
  {} as Record<AdminRole, ReadonlySet<string>>,
);

export function roleCan(role: AdminRole | null, permission: string): boolean {
  const capability = LEGACY_PERMISSION_MAP[permission];
  return capability ? adminRoleCan(role, capability) : false;
}

interface AdminState {
  /** Sesión DEMO explícita (sin credenciales). Con Supabase se usa Auth real. */
  demoRole: AdminRole | null;
  demoSessionActive: boolean;
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
      demoSessionActive: false,
      overrides: {},
      loginDemo: (role) => set({ demoRole: role, demoSessionActive: true }),
      logout: () => set({ demoRole: null, demoSessionActive: false }),
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
      version: 2,
      migrate: (state) => ({ ...(state as object), demoSessionActive: true }) as AdminState,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
