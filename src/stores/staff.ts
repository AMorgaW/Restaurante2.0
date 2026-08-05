"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { branches } from "@/config/restaurant";
import { createAdminAuditEntry, type AdminAuditEntry } from "@/lib/admin/audit";
import { changeStaffRole, assignStaffBranches, setStaffStatus, type StaffDomainError } from "@/lib/staff/operations";
import { DEMO_STAFF_MEMBERS } from "@/lib/staff/fixtures";
import type { AdminRole } from "@/lib/admin/authorization";
import type { StaffMember, StaffStatus } from "@/lib/staff/types";

interface StaffState {
  members: StaffMember[];
  audit: AdminAuditEntry[];
  selectedEmployeeId: string | null;
  setSelectedEmployee: (id: string | null) => void;
  changeRole: (employeeId: string, nextRole: unknown, actorRole: AdminRole | null | undefined, actorId: string, now: string) => void;
  assignBranches: (employeeId: string, branchIds: string[], actorRole: AdminRole | null | undefined, actorId: string, now: string) => void;
  setStatus: (employeeId: string, status: StaffStatus, reason: string, actorRole: AdminRole | null | undefined, actorId: string, now: string) => void;
  reset: () => void;
}

function appendAudit(state: StaffState, entry: AdminAuditEntry): Pick<StaffState, "audit"> {
  return { audit: [...state.audit, entry] };
}

export const useStaffStore = create<StaffState>()(
  persist(
    (set) => ({
      members: DEMO_STAFF_MEMBERS,
      audit: [],
      selectedEmployeeId: null,
      setSelectedEmployee: (id) => set({ selectedEmployeeId: id }),
      changeRole: (employeeId, nextRole, actorRole, actorId, now) => set((state) => {
        const members = changeStaffRole(state.members, actorRole, employeeId, nextRole);
        return { members, selectedEmployeeId: employeeId, ...appendAudit(state, createAdminAuditEntry({ action: "employee_role_changed", actor: actorId, entity: "employee", entityId: employeeId, createdAt: now, summary: "Cargo demo actualizado." })) };
      }),
      assignBranches: (employeeId, branchIds, actorRole, actorId, now) => set((state) => {
        const members = assignStaffBranches(state.members, actorRole, employeeId, branchIds, branches.map((branch) => branch.id));
        const branchNames = branchIds.map((id) => branches.find((branch) => branch.id === id)?.name ?? id);
        return { members: members.map((member) => member.id === employeeId ? { ...member, branchNames } : member), selectedEmployeeId: employeeId, ...appendAudit(state, createAdminAuditEntry({ action: "employee_branch_changed", actor: actorId, entity: "employee", entityId: employeeId, createdAt: now, summary: "Sucursal(es) demo actualizada." })) };
      }),
      setStatus: (employeeId, status, reason, actorRole, actorId, now) => set((state) => {
        const cleanReason = reason.trim();
        if (!cleanReason) throw new Error("La razón es obligatoria para cambiar el estado.");
        const members = setStaffStatus(state.members, actorRole, employeeId, status);
        const action = status === "suspended" ? "employee_suspended" : status === "active" ? "employee_reactivated" : "employee_deactivated";
        return { members, selectedEmployeeId: employeeId, ...appendAudit(state, createAdminAuditEntry({ action, actor: actorId, entity: "employee", entityId: employeeId, createdAt: now, summary: `Estado demo: ${status}.`, reason: cleanReason })) };
      }),
      reset: () => set({ members: DEMO_STAFF_MEMBERS, audit: [], selectedEmployeeId: null }),
    }),
    { name: "rb-staff", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

export function resetStaffDemo(): void {
  useStaffStore.getState().reset();
}

export type { StaffDomainError };
