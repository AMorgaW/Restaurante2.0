import { calculatePensionSurplus } from "@/lib/pension/pricing";
import { isPensionMembershipInDateRange } from "@/lib/pension/selectors";
import type { PensionConsumption, PensionDailyMenu, PensionMembership, PensionSelection } from "@/lib/pension/types";

export class PensionDomainError extends Error {
  constructor(public readonly code: "membership_inactive" | "outside_validity" | "menu_unavailable" | "required_category" | "invalid_selection" | "duplicate_consumption" | "insufficient_balance") {
    super({
      membership_inactive: "Los beneficios no están disponibles para este estado.",
      outside_validity: "La fecha está fuera de la vigencia del plan.",
      menu_unavailable: "El menú no está publicado o el servicio está cerrado.",
      required_category: "Completa las categorías obligatorias.",
      invalid_selection: "La selección no está disponible o aún está por configurar.",
      duplicate_consumption: "Ya existe un consumo para este periodo.",
      insufficient_balance: "No tienes comidas disponibles para este consumo.",
    }[code]);
    this.name = "PensionDomainError";
  }
}

export function validatePensionSelection(menu: PensionDailyMenu, selections: PensionSelection[]): void {
  if (!menu.published || !menu.serviceOpen) throw new PensionDomainError("menu_unavailable");
  const selectedCategories = new Set<string>();
  for (const selection of selections) {
    if (selectedCategories.has(selection.categoryId)) throw new PensionDomainError("invalid_selection");
    const category = menu.categories.find((candidate) => candidate.id === selection.categoryId);
    const option = category?.options.find((candidate) => candidate.id === selection.optionId);
    if (!category || !option || !option.configured || !option.available) throw new PensionDomainError("invalid_selection");
    selectedCategories.add(selection.categoryId);
  }
  if (menu.categories.some((category) => category.required && !selectedCategories.has(category.id))) throw new PensionDomainError("required_category");
}

export function registerPensionConsumption({ membership, menu, selections, existing, now, id }: { membership: PensionMembership; menu: PensionDailyMenu; selections: PensionSelection[]; existing: PensionConsumption[]; now: string; id?: string }): PensionConsumption {
  if (membership.status !== "active") throw new PensionDomainError("membership_inactive");
  if (!isPensionMembershipInDateRange(membership, menu.date)) throw new PensionDomainError("outside_validity");
  if (existing.some((consumption) => consumption.membershipId === membership.id && consumption.date === menu.date && consumption.period === menu.period && consumption.status === "confirmed")) throw new PensionDomainError("duplicate_consumption");
  if ((membership.mealsAvailable ?? 0) <= 0) throw new PensionDomainError("insufficient_balance");
  validatePensionSelection(menu, selections);
  return { id: id ?? `pension-consumption-${membership.id}-${menu.date}-${menu.period}`, membershipId: membership.id, date: menu.date, period: menu.period, selections, mealsUsed: 1, surplus: calculatePensionSurplus(menu, selections), status: "confirmed", createdAt: now, demoOnly: true };
}
