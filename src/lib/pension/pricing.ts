import type { PensionDailyMenu, PensionSelection, PensionSurplusCalculation } from "@/lib/pension/types";

function money(value: number): number {
  return Math.max(0, Math.round(value));
}

export function calculatePensionSurplus(menu: PensionDailyMenu | null, selections: PensionSelection[]): PensionSurplusCalculation {
  if (!menu) return { basePrice: 0, includedCredit: 0, surplus: 0, totalAdditional: 0 };
  const options = selections.flatMap((selection) => {
    const category = menu.categories.find((candidate) => candidate.id === selection.categoryId);
    const option = category?.options.find((candidate) => candidate.id === selection.optionId);
    return option ? [option] : [];
  });
  const basePrice = money(options.reduce((sum, option) => sum + option.price, 0));
  const includedCredit = money(options.filter((option) => option.included).reduce((sum, option) => sum + option.price, 0));
  const surplus = money(options.reduce((sum, option) => sum + Math.max(0, option.surplusPrice ?? 0), 0));
  return { basePrice, includedCredit, surplus, totalAdditional: surplus };
}

export function formatPensionMoney(value: number): string {
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}
