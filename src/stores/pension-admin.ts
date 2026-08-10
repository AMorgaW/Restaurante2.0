"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createAdminAuditEntry, type AdminAuditEntry } from "@/lib/admin/audit";
import { PENSION_DEMO_MEMBERSHIPS, PENSION_DEMO_PLAN, PENSION_DEMO_PROFILES } from "@/lib/pension/fixtures";
import {
  activatePensionMembership,
  cancelPensionMembership,
  createAndActivatePensionMembership,
  reactivatePensionMembership,
  recordPensionPayment,
  renewPensionMembership,
  suspendPensionMembership,
} from "@/lib/pension-admin/operations";
import type { PensionCycleInput, PensionPaymentInput } from "@/lib/pension-admin/types";
import type { PensionMembership } from "@/lib/pension/types";
import type { AdminRole } from "@/lib/admin/authorization";

interface PensionAdminState {
  memberships: PensionMembership[];
  audit: AdminAuditEntry[];
  recordPayment: (membershipId: string, input: PensionPaymentInput, actor: { role: AdminRole | null | undefined; id: string; now: string }) => void;
  activate: (membershipId: string, input: PensionCycleInput, actor: { role: AdminRole | null | undefined; id: string; now: string }) => void;
  createAndActivate: (profileId: string, input: PensionCycleInput, actor: { role: AdminRole | null | undefined; id: string; now: string }) => void;
  renew: (membershipId: string, input: PensionCycleInput, actor: { role: AdminRole | null | undefined; id: string; now: string }) => void;
  suspend: (membershipId: string, reason: string, actor: { role: AdminRole | null | undefined; id: string; now: string }) => void;
  reactivate: (membershipId: string, reason: string, actor: { role: AdminRole | null | undefined; id: string; now: string }) => void;
  cancel: (membershipId: string, reason: string, actor: { role: AdminRole | null | undefined; id: string; now: string }) => void;
  reset: () => void;
}

function findMembership(memberships: PensionMembership[], id: string): PensionMembership {
  const membership = memberships.find((candidate) => candidate.id === id);
  if (!membership) throw new Error("No encontramos esa membresía demo.");
  return membership;
}

function replace(memberships: PensionMembership[], updated: PensionMembership): PensionMembership[] {
  return memberships.map((membership) => membership.id === updated.id ? updated : membership);
}

function audit(action: AdminAuditEntry["action"], actor: { id: string; now: string }, entityId: string, summary: string, reason?: string): AdminAuditEntry {
  return createAdminAuditEntry({ action, actor: actor.id, entity: "pension_membership", entityId, createdAt: actor.now, summary, ...(reason?.trim() ? { reason: reason.trim() } : {}) });
}

function setWithAudit(set: (updater: (state: PensionAdminState) => Partial<PensionAdminState>) => void, membershipId: string, actor: { id: string; now: string }, action: AdminAuditEntry["action"], update: (membership: PensionMembership) => PensionMembership, summary: string, reason?: string): void {
  set((state) => ({ memberships: replace(state.memberships, update(findMembership(state.memberships, membershipId))), audit: [...state.audit, audit(action, actor, membershipId, summary, reason)] }));
}

export const usePensionAdminStore = create<PensionAdminState>()(
  persist(
    (set) => ({
      memberships: PENSION_DEMO_MEMBERSHIPS,
      audit: [],
      recordPayment: (membershipId, input, actor) => set((state) => {
        const current = findMembership(state.memberships, membershipId);
        const updated = recordPensionPayment(current, actor, input);
        const entries = [audit("pension_payment_recorded", actor, membershipId, "Pago presencial registrado.")];
        if (current.agreedPrice !== updated.agreedPrice || current.publicPrice !== updated.publicPrice) entries.push(audit("pension_price_changed", actor, membershipId, "Precio negociado actualizado."));
        return { memberships: replace(state.memberships, updated), audit: [...state.audit, ...entries] };
      }),
      activate: (membershipId, input, actor) => set((state) => {
        const current = findMembership(state.memberships, membershipId);
        const profile = PENSION_DEMO_PROFILES.find((candidate) => candidate.id === current.profileId) ?? null;
        const updated = activatePensionMembership(current, profile, PENSION_DEMO_PLAN, actor, input);
        return { memberships: replace(state.memberships, updated), audit: [...state.audit, audit("pension_activated", actor, membershipId, "Membresía activada por el jefe.")] };
      }),
      createAndActivate: (profileId, input, actor) => set((state) => {
        const profile = PENSION_DEMO_PROFILES.find((candidate) => candidate.id === profileId) ?? null;
        const created = createAndActivatePensionMembership(
          profile,
          PENSION_DEMO_PLAN,
          actor,
          input,
          state.memberships,
        );
        return {
          memberships: [...state.memberships, created],
          audit: [...state.audit, audit("pension_activated", actor, created.id, "Membresía creada y activada por el jefe.")],
        };
      }),
      renew: (membershipId, input, actor) => set((state) => {
        const current = findMembership(state.memberships, membershipId);
        const updated = renewPensionMembership(current, PENSION_DEMO_PLAN, actor, input);
        const entries = [audit("pension_renewed", actor, membershipId, "Membresía renovada por el jefe.")];
        if (current.agreedPrice !== updated.agreedPrice || current.publicPrice !== updated.publicPrice) entries.push(audit("pension_price_changed", actor, membershipId, "Precio histórico actualizado durante renovación."));
        return { memberships: replace(state.memberships, updated), audit: [...state.audit, ...entries] };
      }),
      suspend: (membershipId, reason, actor) => setWithAudit(set, membershipId, actor, "pension_suspended", (membership) => suspendPensionMembership(membership, actor, reason), "Membresía suspendida.", reason),
      reactivate: (membershipId, reason, actor) => setWithAudit(set, membershipId, actor, "pension_reactivated", (membership) => reactivatePensionMembership(membership, actor, reason), "Membresía reactivada.", reason),
      cancel: (membershipId, reason, actor) => setWithAudit(set, membershipId, actor, "pension_cancelled", (membership) => cancelPensionMembership(membership, actor, reason), "Membresía finalizada.", reason),
      reset: () => set({ memberships: PENSION_DEMO_MEMBERSHIPS, audit: [] }),
    }),
    { name: "rb-pension-admin", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

export function resetPensionAdminDemo(): void {
  usePensionAdminStore.getState().reset();
}
