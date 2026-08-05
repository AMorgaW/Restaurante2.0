import { PENSION_DEMO_MEMBERSHIPS, PENSION_DEMO_PLAN, PENSION_DEMO_PROFILES, PENSION_MENU_DATES, PENSION_DEMO_MENUS } from "@/lib/pension/fixtures";
import type { PensionCalendarDay, PensionContext, PensionDailyMenu, PensionDemoProfile, PensionMembership, PensionPlan, PensionSelection, PensionConsumption } from "@/lib/pension/types";

export const PENSION_STATUS_LABELS: Record<PensionMembership["status"] | "none", string> = {
  none: "Sin membresía",
  pending: "Pendiente de activación",
  active: "Plan activo",
  suspended: "Suspendido",
  expired: "Vencido",
  cancelled: "Cancelado",
};

export function resolvePensionContext(profileId: string | null | undefined, memberships: PensionMembership[] = PENSION_DEMO_MEMBERSHIPS): PensionContext | null {
  const profile = PENSION_DEMO_PROFILES.find((candidate) => candidate.id === profileId);
  if (!profile || profile.role !== "customer") return null;
  const membership = memberships.find((candidate) => candidate.profileId === profile.id) ?? null;
  return { profile, membership, plan: PENSION_DEMO_PLAN };
}

export function getPensionMembershipStatus(membership: PensionMembership | null): PensionMembership["status"] | "none" {
  return membership?.status ?? "none";
}

export function getPensionMenu(date: string, period: PensionDailyMenu["period"]): PensionDailyMenu | null {
  return PENSION_DEMO_MENUS.find((menu) => menu.date === date && menu.period === period) ?? null;
}

export function getPensionMenuDates(): readonly string[] {
  return PENSION_MENU_DATES;
}

export function getPensionRemaining(membership: PensionMembership | null, plan: PensionPlan): string {
  if (!membership) return "Solicita tu plan";
  if (membership.status !== "active") return PENSION_STATUS_LABELS[membership.status];
  if (plan.modality === "calendar_period") return membership.expiresAt ? `Vigente hasta ${membership.expiresAt}` : "Vigencia activa";
  if (membership.mealsAvailable !== undefined) return `${membership.mealsAvailable} comidas disponibles`;
  return "Beneficio activo";
}

export function isPensionMembershipInDateRange(membership: PensionMembership, date: string): boolean {
  if (!membership.startsAt || !membership.expiresAt) return false;
  return date >= membership.startsAt && date <= membership.expiresAt;
}

export function getPensionCalendar(membership: PensionMembership | null, consumptions: PensionConsumption[]): PensionCalendarDay[] {
  return PENSION_MENU_DATES.map((date) => ({
    date,
    menuPublished: PENSION_DEMO_MENUS.some((menu) => menu.date === date && menu.published),
    consumed: Boolean(membership && consumptions.some((consumption) => consumption.membershipId === membership.id && consumption.date === date && consumption.status === "confirmed")),
    available: Boolean(membership && membership.status === "active" && isPensionMembershipInDateRange(membership, date)),
  }));
}

export function getPensionSelectedOptions(menu: PensionDailyMenu | null, selections: PensionSelection[]) {
  if (!menu) return [];
  return selections.flatMap((selection) => {
    const category = menu.categories.find((candidate) => candidate.id === selection.categoryId);
    const option = category?.options.find((candidate) => candidate.id === selection.optionId);
    return option ? [option] : [];
  });
}

export function getPensionDisplayName(profile: PensionDemoProfile | null): string {
  return profile?.name ?? "Cliente";
}
