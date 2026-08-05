import { isPensionMembershipInDateRange } from "@/lib/pension/selectors";
import type { PensionMembership, PensionMembershipCycle, PensionDemoProfile, PensionPlan } from "@/lib/pension/types";
import type { PensionAdminActor, PensionCycleInput, PensionPaymentInput } from "@/lib/pension-admin/types";

export type PensionAdminErrorCode = "forbidden" | "profile_invalid" | "membership_not_found" | "invalid_state" | "invalid_price" | "payment_required" | "invalid_dates" | "confirmation_required" | "reason_required" | "plan_invalid";

export class PensionAdminDomainError extends Error {
  constructor(public readonly code: PensionAdminErrorCode, message: string) {
    super(message);
    this.name = "PensionAdminDomainError";
  }
}

function requireOwner(actor: PensionAdminActor): void {
  if (actor.role !== "owner") throw new PensionAdminDomainError("forbidden", "Solo el jefe puede modificar membresías pensionadas.");
}

function money(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new PensionAdminDomainError("invalid_price", `${label} debe ser un valor no negativo.`);
  return Math.round(value);
}

export function calculateNegotiatedPrice(publicPrice: number, agreedPrice: number, allowSurcharge = false): { publicPrice: number; agreedPrice: number; discount: number } {
  const reference = money(publicPrice, "El precio público");
  const finalPrice = money(agreedPrice, "El precio acordado");
  if (finalPrice > reference && !allowSurcharge) throw new PensionAdminDomainError("invalid_price", "El precio acordado no puede superar el público sin confirmar un recargo.");
  return { publicPrice: reference, agreedPrice: finalPrice, discount: Math.max(0, reference - finalPrice) };
}

function validatePayment(input: PensionPaymentInput): ReturnType<typeof calculateNegotiatedPrice> {
  if (!input.paymentDate || !input.paymentMethod) throw new PensionAdminDomainError("payment_required", "Registra método y fecha del pago presencial.");
  return calculateNegotiatedPrice(input.publicPrice, input.agreedPrice, input.allowSurcharge);
}

function validateDates(input: PensionCycleInput, plan: PensionPlan): void {
  if (!input.confirmed) throw new PensionAdminDomainError("confirmation_required", "Confirma explícitamente la operación.");
  if (!input.startsAt) throw new PensionAdminDomainError("invalid_dates", "La fecha de inicio es obligatoria.");
  if (input.expiresAt && input.expiresAt < input.startsAt) throw new PensionAdminDomainError("invalid_dates", "La fecha final no puede ser anterior al inicio.");
  const meals = input.mealsAvailable;
  const modality = input.modality ?? plan.modality;
  if ((modality === "meal_count" || modality === "hybrid") && (!Number.isFinite(meals) || (meals ?? 0) <= 0)) throw new PensionAdminDomainError("invalid_dates", "La modalidad requiere un saldo de comidas positivo.");
  if ((modality === "calendar_period" || modality === "hybrid") && !input.expiresAt) throw new PensionAdminDomainError("invalid_dates", "La modalidad requiere fecha de vencimiento.");
}

function paymentPatch(input: PensionPaymentInput) {
  const price = validatePayment(input);
  return { ...price, paymentMethod: input.paymentMethod, paymentDate: input.paymentDate, ...(input.paymentReference?.trim() ? { paymentReference: input.paymentReference.trim() } : {}), ...(input.observations?.trim() ? { observations: input.observations.trim() } : {}) };
}

export function recordPensionPayment(membership: PensionMembership, actor: PensionAdminActor, input: PensionPaymentInput): PensionMembership {
  requireOwner(actor);
  if (membership.status !== "pending") throw new PensionAdminDomainError("invalid_state", "Solo una solicitud pendiente puede registrar pago antes de activar.");
  return { ...membership, ...paymentPatch(input) };
}

export function activatePensionMembership(membership: PensionMembership, profile: PensionDemoProfile | null, plan: PensionPlan, actor: PensionAdminActor, input: PensionCycleInput): PensionMembership {
  requireOwner(actor);
  if (!profile || profile.role !== "customer") throw new PensionAdminDomainError("profile_invalid", "La membresía debe pertenecer a un customer válido.");
  if (membership.status !== "pending") throw new PensionAdminDomainError("invalid_state", "La membresía ya fue activada o no está pendiente.");
  if (!plan.isActive) throw new PensionAdminDomainError("plan_invalid", "El plan no está activo.");
  validateDates(input, plan);
  const payment = paymentPatch(input);
  const modality = input.modality ?? plan.modality;
  const cycle: PensionMembershipCycle = { id: `cycle-${membership.id}-1`, startsAt: input.startsAt, modality, ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}), ...(input.mealsAvailable !== undefined ? { mealsGranted: input.mealsAvailable } : {}), ...payment, createdAt: actor.now, createdBy: actor.id, demoOnly: true };
  return { ...membership, ...payment, modality, status: "active", startsAt: input.startsAt, ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}), ...(input.mealsAvailable !== undefined ? { mealsAvailable: input.mealsAvailable } : {}), activatedAt: actor.now, activatedBy: actor.id, cycles: [...(membership.cycles ?? []), cycle] };
}

export function renewPensionMembership(membership: PensionMembership, plan: PensionPlan, actor: PensionAdminActor, input: PensionCycleInput): PensionMembership {
  requireOwner(actor);
  if (!["active", "expired"].includes(membership.status)) throw new PensionAdminDomainError("invalid_state", "Solo una membresía activa o vencida puede renovarse.");
  validateDates(input, plan);
  const payment = paymentPatch(input);
  const modality = input.modality ?? plan.modality;
  const previous: PensionMembershipCycle = { id: `cycle-${membership.id}-${(membership.cycles?.length ?? 0) + 1}`, startsAt: membership.startsAt, modality: membership.modality ?? plan.modality, ...(membership.expiresAt ? { expiresAt: membership.expiresAt } : {}), ...(membership.mealsAvailable !== undefined ? { mealsGranted: membership.mealsAvailable } : {}), publicPrice: membership.publicPrice, agreedPrice: membership.agreedPrice, discount: membership.discount, paymentMethod: membership.paymentMethod, paymentDate: membership.paymentDate, createdAt: membership.activatedAt ?? actor.now, createdBy: membership.activatedBy ?? actor.id, demoOnly: true };
  const nextCycle: PensionMembershipCycle = { id: `cycle-${membership.id}-${(membership.cycles?.length ?? 0) + 2}`, startsAt: input.startsAt, modality, ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}), ...(input.mealsAvailable !== undefined ? { mealsGranted: input.mealsAvailable } : {}), ...payment, createdAt: actor.now, createdBy: actor.id, demoOnly: true };
  return { ...membership, ...payment, modality, status: "active", startsAt: input.startsAt, ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}), ...(input.mealsAvailable !== undefined ? { mealsAvailable: input.mealsAvailable } : {}), activatedAt: actor.now, activatedBy: actor.id, cycles: [...(membership.cycles ?? []), previous, nextCycle] };
}

export function suspendPensionMembership(membership: PensionMembership, actor: PensionAdminActor, reason: string): PensionMembership {
  requireOwner(actor);
  if (membership.status !== "active") throw new PensionAdminDomainError("invalid_state", "Solo una membresía activa puede suspenderse.");
  if (!reason.trim()) throw new PensionAdminDomainError("reason_required", "La razón de suspensión es obligatoria.");
  return { ...membership, status: "suspended", suspensionReason: reason.trim() };
}

export function reactivatePensionMembership(membership: PensionMembership, actor: PensionAdminActor, reason: string): PensionMembership {
  requireOwner(actor);
  if (membership.status !== "suspended") throw new PensionAdminDomainError("invalid_state", "Solo una membresía suspendida puede reactivarse.");
  if (!reason.trim()) throw new PensionAdminDomainError("reason_required", "La razón de reactivación es obligatoria.");
  const today = actor.now.slice(0, 10);
  if (!isPensionMembershipInDateRange({ ...membership, status: "active" }, today)) throw new PensionAdminDomainError("invalid_dates", "La vigencia terminó; renueva la membresía en lugar de reactivarla.");
  return { ...membership, status: "active", suspensionReason: undefined, observations: `${membership.observations ?? ""} Reactivada: ${reason.trim()}`.trim() };
}

export function cancelPensionMembership(membership: PensionMembership, actor: PensionAdminActor, reason: string): PensionMembership {
  requireOwner(actor);
  if (membership.status === "cancelled") throw new PensionAdminDomainError("invalid_state", "La membresía ya está cancelada.");
  if (!reason.trim()) throw new PensionAdminDomainError("reason_required", "La razón de cancelación es obligatoria.");
  return { ...membership, status: "cancelled", observations: `${membership.observations ?? ""} Cancelada: ${reason.trim()}`.trim() };
}
