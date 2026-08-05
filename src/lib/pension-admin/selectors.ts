import { PENSION_DEMO_MEMBERSHIPS, PENSION_DEMO_PLAN, PENSION_DEMO_PROFILES } from "@/lib/pension/fixtures";
import type { PensionMembership, PensionMembershipStatus, PensionConsumption } from "@/lib/pension/types";
import type { PensionAdminRow, PensionAdminSummary } from "@/lib/pension-admin/types";

export const PENSION_ADMIN_STATUS_LABELS: Record<PensionMembershipStatus, string> = {
  pending: "Pendiente",
  active: "Activo",
  suspended: "Suspendido",
  expired: "Vencido",
  cancelled: "Cancelado",
};

export function getPensionAdminRows(memberships: PensionMembership[] = PENSION_DEMO_MEMBERSHIPS, consumptions: PensionConsumption[] = []): PensionAdminRow[] {
  return memberships.flatMap((membership) => {
    const profile = PENSION_DEMO_PROFILES.find((candidate) => candidate.id === membership.profileId);
    if (!profile) return [];
    return [{ profileId: profile.id, profileName: profile.name, membership, plan: PENSION_DEMO_PLAN, consumptions: consumptions.filter((consumption) => consumption.membershipId === membership.id).length, surplusTotal: consumptions.filter((consumption) => consumption.membershipId === membership.id).reduce((sum, consumption) => sum + consumption.surplus.totalAdditional, 0) }];
  });
}

export function getPensionAdminSummary(memberships: PensionMembership[] = PENSION_DEMO_MEMBERSHIPS, today = "2026-08-04"): PensionAdminSummary {
  const byStatus = { pending: 0, active: 0, suspended: 0, expired: 0, cancelled: 0 } satisfies Record<PensionMembershipStatus, number>;
  memberships.forEach((membership) => { byStatus[membership.status] += 1; });
  const expiringSoon = memberships.filter((membership) => membership.status === "active" && membership.expiresAt && membership.expiresAt >= today && membership.expiresAt <= `${today.slice(0, 8)}31`).length;
  return { byStatus, pending: byStatus.pending, expiringSoon };
}
