import { describe, expect, it } from "vitest";
import {
  PENSION_DEMO_MEMBERSHIPS,
  PENSION_DEMO_MENUS,
  PENSION_DEMO_PLAN,
  PENSION_DEMO_PROFILES,
} from "@/lib/pension/fixtures";
import { PensionDomainError, registerPensionConsumption, validatePensionSelection } from "@/lib/pension/operations";
import { calculatePensionSurplus } from "@/lib/pension/pricing";
import { getPensionMenu, getPensionMembershipStatus, resolvePensionContext } from "@/lib/pension/selectors";
import type { PensionDailyMenu, PensionSelection } from "@/lib/pension/types";

const lunch = PENSION_DEMO_MENUS.find((menu) => menu.date === "2026-08-04" && menu.period === "lunch")!;
const active = PENSION_DEMO_MEMBERSHIPS.find((membership) => membership.status === "active")!;
const includedSelection: PensionSelection[] = [
  { categoryId: "main", optionId: "main-current" },
  { categoryId: "soup", optionId: "soup-current" },
];

describe("contrato local de pensionado", () => {
  it("resuelve customer sin membresía y cada estado comercial", () => {
    expect(getPensionMembershipStatus(resolvePensionContext("customer-no-membership")!.membership)).toBe("none");
    for (const [profileId, status] of [
      ["customer-pending", "pending"],
      ["customer-active", "active"],
      ["customer-suspended", "suspended"],
      ["customer-expired", "expired"],
      ["customer-cancelled", "cancelled"],
    ] as const) {
      expect(resolvePensionContext(profileId)?.membership?.status).toBe(status);
    }
    expect(resolvePensionContext("admin-demo")).toBeNull();
    expect(PENSION_DEMO_PROFILES.every((profile) => profile.role === "customer")).toBe(true);
  });

  it("calcula precio público, descuento y excedente sin negativos", () => {
    const included = calculatePensionSurplus(lunch, includedSelection);
    expect(included.totalAdditional).toBe(0);
    const premium = calculatePensionSurplus(lunch, [...includedSelection.slice(1), { categoryId: "main", optionId: "main-premium" }]);
    expect(premium.totalAdditional).toBe(8000);
    expect(PENSION_DEMO_PLAN.publicPrice - active.agreedPrice!).toBe(active.discount);
    expect(calculatePensionSurplus(lunch, [{ categoryId: "main", optionId: "missing" }]).totalAdditional).toBeGreaterThanOrEqual(0);
  });

  it("distingue menú publicado, no publicado y servicio cerrado", () => {
    expect(getPensionMenu("2026-08-04", "lunch")?.published).toBe(true);
    expect(getPensionMenu("2026-08-05", "lunch")?.published).toBe(false);
    expect(getPensionMenu("2026-08-06", "lunch")?.serviceOpen).toBe(false);
  });

  it("valida categorías obligatorias, disponibilidad y configuración", () => {
    expect(() => validatePensionSelection(lunch, [{ categoryId: "main", optionId: "main-current" }])).toThrowError(PensionDomainError);
    expect(() => validatePensionSelection(lunch, [...includedSelection, { categoryId: "main", optionId: "main-premium" }])).toThrowError(PensionDomainError);
    expect(() => validatePensionSelection(lunch, [{ categoryId: "main", optionId: "main-pollo" }, { categoryId: "soup", optionId: "soup-current" }])).toThrowError(PensionDomainError);
    expect(() => validatePensionSelection(lunch, includedSelection)).not.toThrow();
  });

  it("confirma una comida activa una sola vez", () => {
    const consumption = registerPensionConsumption({ membership: active, menu: lunch, selections: includedSelection, existing: [], now: "2026-08-04T12:00:00-05:00" });
    expect(consumption.mealsUsed).toBe(1);
    expect(consumption.status).toBe("confirmed");
    expect(() => registerPensionConsumption({ membership: active, menu: lunch, selections: includedSelection, existing: [consumption], now: "2026-08-04T12:01:00-05:00" })).toThrowError("Ya existe un consumo");
  });

  it("rechaza estados no activos, vigencia, saldo y menú inválido", () => {
    const expired = PENSION_DEMO_MEMBERSHIPS.find((membership) => membership.status === "expired")!;
    expect(() => registerPensionConsumption({ membership: expired, menu: lunch, selections: includedSelection, existing: [], now: "2026-08-04T12:00:00-05:00" })).toThrowError("beneficios");
    const outside: PensionDailyMenu = { ...lunch, date: "2026-09-01", id: "outside" };
    expect(() => registerPensionConsumption({ membership: active, menu: outside, selections: includedSelection, existing: [], now: "2026-08-04T12:00:00-05:00" })).toThrowError("vigencia");
    const noBalance = { ...active, mealsAvailable: 0 };
    expect(() => registerPensionConsumption({ membership: noBalance, menu: lunch, selections: includedSelection, existing: [], now: "2026-08-04T12:00:00-05:00" })).toThrowError("comidas disponibles");
    const unpublished = { ...lunch, published: false };
    expect(() => registerPensionConsumption({ membership: active, menu: unpublished, selections: includedSelection, existing: [], now: "2026-08-04T12:00:00-05:00" })).toThrowError("publicado");
  });
});
