import { describe, expect, it } from "vitest";
import { PENSION_DEMO_MEMBERSHIPS, PENSION_DEMO_PLAN, PENSION_DEMO_PROFILES, PENSION_DEMO_NOW } from "@/lib/pension/fixtures";
import { activatePensionMembership, calculateNegotiatedPrice, cancelPensionMembership, recordPensionPayment, reactivatePensionMembership, renewPensionMembership, suspendPensionMembership, PensionAdminDomainError } from "@/lib/pension-admin/operations";

const owner = { role: "owner" as const, id: "demo-jefe", now: PENSION_DEMO_NOW };
const admin = { role: "admin" as const, id: "demo-admin", now: PENSION_DEMO_NOW };
const payment = { publicPrice: 300000, agreedPrice: 284000, paymentMethod: "cash" as const, paymentDate: "2026-08-04" };

describe("administración local de pensionados", () => {
  it("calcula precio negociado sin aceptar negativos ni recargos silenciosos", () => {
    expect(calculateNegotiatedPrice(300000, 284000)).toEqual({ publicPrice: 300000, agreedPrice: 284000, discount: 16000 });
    expect(() => calculateNegotiatedPrice(300000, 0 - 1)).toThrowError(PensionAdminDomainError);
    expect(() => calculateNegotiatedPrice(300000, 301000)).toThrowError(PensionAdminDomainError);
  });

  it("exige jefe y pago antes de activar, con modalidad explícita", () => {
    const pending = PENSION_DEMO_MEMBERSHIPS.find((membership) => membership.status === "pending")!;
    const profile = PENSION_DEMO_PROFILES.find((candidate) => candidate.id === pending.profileId)!;
    expect(() => recordPensionPayment(pending, admin, payment)).toThrowError(PensionAdminDomainError);
    const paid = recordPensionPayment(pending, owner, payment);
    const active = activatePensionMembership(paid, profile, PENSION_DEMO_PLAN, owner, { ...payment, modality: "meal_count", startsAt: "2026-08-04", mealsAvailable: 30, confirmed: true });
    expect(active.status).toBe("active");
    expect(active.modality).toBe("meal_count");
    expect(active.cycles).toHaveLength(1);
    expect(() => activatePensionMembership(active, profile, PENSION_DEMO_PLAN, owner, { ...payment, startsAt: "2026-08-04", expiresAt: "2026-09-02", mealsAvailable: 30, confirmed: true })).toThrowError(PensionAdminDomainError);
  });

  it("conserva ciclos y exige razones para suspensión, reactivación y cancelación", () => {
    const active = PENSION_DEMO_MEMBERSHIPS.find((membership) => membership.status === "active")!;
    const renewed = renewPensionMembership(active, PENSION_DEMO_PLAN, owner, { ...payment, modality: "hybrid", startsAt: "2026-08-01", expiresAt: "2026-09-04", mealsAvailable: 30, confirmed: true });
    expect(renewed.status).toBe("active");
    expect(renewed.cycles?.length).toBeGreaterThan(1);
    const suspended = suspendPensionMembership(renewed, owner, "Revisión presencial");
    expect(suspended.status).toBe("suspended");
    const reactivated = reactivatePensionMembership(suspended, owner, "Pago confirmado");
    expect(reactivated.status).toBe("active");
    expect(cancelPensionMembership(reactivated, owner, "Finalización solicitada").status).toBe("cancelled");
    expect(() => suspendPensionMembership(renewed, owner, "")).toThrowError(PensionAdminDomainError);
  });
});
