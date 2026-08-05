"use client";

import { createContext, useContext } from "react";
import type { AdminRole } from "@/stores/admin";

const AdminRoleContext = createContext<{ mode: "local" | "supabase"; role: AdminRole | null } | null>(null);

export function AdminRoleProvider({
  mode,
  role,
  children,
}: {
  mode: "local" | "supabase";
  role: AdminRole | null;
  children: React.ReactNode;
}) {
  return <AdminRoleContext.Provider value={{ mode, role }}>{children}</AdminRoleContext.Provider>;
}

/** En Supabase el rol validado por servidor prevalece sobre localStorage/Zustand. */
export function useEffectiveAdminRole(localRole: AdminRole | null): AdminRole | null {
  const context = useContext(AdminRoleContext);
  if (!context || context.mode === "local") return localRole;
  return context.role;
}
