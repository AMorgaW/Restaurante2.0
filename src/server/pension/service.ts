import "server-only";

import { restaurantConfig } from "@/config/restaurant";
import { adminRoleCan, isAdminRole } from "@/lib/admin/authorization";
import { getResolvedDataMode } from "@/lib/env/server";
import { resolveServerSession } from "@/lib/session/server-resolver";
import { PensionPersistenceError } from "@/server/pension/errors";
import { SupabasePensionRepository } from "@/server/pension/repository";
import {
  activatePensionMembershipSchema,
  changePensionMembershipStatusSchema,
  closePensionMenuSchema,
  createAndActivatePensionMembershipSchema,
  createPensionOrderSchema,
  publishPensionMenuSchema,
  renewPensionMembershipSchema,
  savePensionMenuDraftSchema,
  setPensionDeliveryFeeSchema,
  upsertPensionMenuItemSchema,
} from "@/server/pension/schemas";
import type {
  CreatePensionOrderResult,
  PensionAdminSnapshot,
  PensionCustomerSnapshot,
  PensionDayAvailability,
  PensionMenuView,
} from "@/server/pension/types";

function requireSupabaseDataMode() {
  if (getResolvedDataMode() !== "supabase") {
    throw new PensionPersistenceError(
      "Esta operación solo está disponible con DATA_MODE=supabase.",
      "data-mode",
      503,
    );
  }
}

function parseOrThrow<T>(
  schema: {
    safeParse: (
      value: unknown,
    ) => { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } };
  },
  input: unknown,
): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new PensionPersistenceError(
      parsed.error.issues[0]?.message ?? "Los datos no son válidos.",
      "validation",
      422,
    );
  }
  return parsed.data;
}

async function requirePensionManager() {
  requireSupabaseDataMode();
  const session = await resolveServerSession();
  if (session.kind === "anonymous" || !session.profile) {
    throw new PensionPersistenceError("Debes iniciar sesión.", "unauthorized", 401);
  }
  if (
    session.kind === "suspended_staff" ||
    session.profile.status === "suspended" ||
    session.profile.status === "inactive" ||
    session.profile.status === "invited"
  ) {
    throw new PensionPersistenceError("Tu cuenta de personal no está activa.", "forbidden", 403);
  }
  if (!isAdminRole(session.profile.role) || !adminRoleCan(session.profile.role, "manage-pension-memberships")) {
    throw new PensionPersistenceError("Tu rol no puede gestionar pensionados.", "forbidden", 403);
  }
  return session;
}

async function requirePensionCustomer() {
  requireSupabaseDataMode();
  const session = await resolveServerSession();
  if (session.kind === "anonymous" || !session.userId) {
    throw new PensionPersistenceError("Debes iniciar sesión para pedir como pensionado.", "unauthorized", 401);
  }
  if (
    session.kind !== "customer_with_membership" &&
    session.kind !== "customer_without_membership" &&
    // Auth-disabled paths may resolve as plain customer-like kinds; RPC still enforces role.
    session.profile?.role !== "customer"
  ) {
    throw new PensionPersistenceError("Solo un cliente puede crear pedidos pensionados.", "forbidden", 403);
  }
  return session;
}

function emptyDay(): PensionDayAvailability {
  return { lunch: null, dinner: null, lunchConsumed: false, dinnerConsumed: false };
}

function groupMenusByDate(menus: PensionMenuView[]): Record<string, PensionDayAvailability> {
  const byDate: Record<string, PensionDayAvailability> = {};
  for (const menu of menus) {
    const day = byDate[menu.serviceDate] ?? emptyDay();
    if (menu.period === "lunch") {
      day.lunch = menu;
      day.lunchConsumed = Boolean(menu.consumedByMe);
    } else {
      day.dinner = menu;
      day.dinnerConsumed = Boolean(menu.consumedByMe);
    }
    byDate[menu.serviceDate] = day;
  }
  return byDate;
}

function addDays(dateIso: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  if (!match) return dateIso;
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  utc.setUTCDate(utc.getUTCDate() + days);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function placePensionOrder(input: unknown): Promise<CreatePensionOrderResult> {
  await requirePensionCustomer();
  const parsed = parseOrThrow(createPensionOrderSchema, input);
  const repo = new SupabasePensionRepository();
  return repo.createPensionOrder(parsed);
}

export async function loadCustomerPensionSnapshot(userId: string): Promise<PensionCustomerSnapshot> {
  requireSupabaseDataMode();
  const repo = new SupabasePensionRepository();
  const [membership, plans] = await Promise.all([
    repo.getRelevantMembershipForProfile(userId),
    repo.listPlans(),
  ]);

  if (!membership) {
    return {
      membership: null,
      plans,
      menusByDate: {},
      deliveryFee: null,
      consumptions: [],
      branchId: null,
      branchSlug: null,
      commercialDate: null,
    };
  }

  const branch = await repo.getBranchMeta(membership.branchId);
  const commercialDate = repo.commercialDateForTimezone(branch.timezone);
  const fromDate = commercialDate;
  const toDate = addDays(commercialDate, 2);
  const menus = await repo.listMenus(membership.branchId, fromDate, toDate);
  const published = menus.filter((menu) => menu.status === "published");
  const withConsumption = await repo.markMenusConsumedByMe(published, membership.id);
  const consumptions = await repo.listConsumptionsForMembership(membership.id);

  return {
    membership,
    plans,
    menusByDate: groupMenusByDate(withConsumption),
    deliveryFee: branch.deliveryFee,
    consumptions,
    branchId: branch.id,
    branchSlug: branch.slug,
    commercialDate,
  };
}

export async function loadAdminPensionSnapshot(options?: {
  search?: string;
  branchId?: string;
}): Promise<PensionAdminSnapshot> {
  requireSupabaseDataMode();
  const session = await resolveServerSession();
  if (session.kind === "anonymous" || !session.profile || !isAdminRole(session.profile.role)) {
    throw new PensionPersistenceError("Debes iniciar sesión como personal.", "unauthorized", 401);
  }
  if (!adminRoleCan(session.profile.role, "read-pension-memberships")) {
    throw new PensionPersistenceError("Tu rol no puede consultar pensionados.", "forbidden", 403);
  }

  const repo = new SupabasePensionRepository();
  const defaultBranchId = options?.branchId ?? restaurantConfig.defaultBranchId;
  const [memberships, plans, menus, branches, catalogMenuItems] = await Promise.all([
    repo.listMembershipsForAdmin(options?.search),
    repo.listPlans(),
    repo.listMenus(defaultBranchId),
    repo.listBranchesWithDeliveryFee(),
    repo.listCatalogMenuItemsForPicker(),
  ]);

  return { memberships, plans, menus, branches, catalogMenuItems };
}

export async function createAndActivatePensionMembership(input: unknown): Promise<string> {
  await requirePensionManager();
  const parsed = parseOrThrow(createAndActivatePensionMembershipSchema, input);
  return new SupabasePensionRepository().createAndActivateMembership(parsed);
}

export async function activatePensionMembership(input: unknown): Promise<string> {
  await requirePensionManager();
  const parsed = parseOrThrow(activatePensionMembershipSchema, input);
  return new SupabasePensionRepository().activateMembership(parsed);
}

export async function renewPensionMembership(input: unknown): Promise<string> {
  await requirePensionManager();
  const parsed = parseOrThrow(renewPensionMembershipSchema, input);
  return new SupabasePensionRepository().renewMembership(parsed);
}

export async function changePensionMembershipStatus(input: unknown): Promise<string> {
  await requirePensionManager();
  const parsed = parseOrThrow(changePensionMembershipStatusSchema, input);
  return new SupabasePensionRepository().changeMembershipStatus(parsed);
}

export async function savePensionMenuDraft(input: unknown): Promise<string> {
  await requirePensionManager();
  const parsed = parseOrThrow(savePensionMenuDraftSchema, input);
  return new SupabasePensionRepository().saveMenuDraft(parsed);
}

export async function upsertPensionMenuItem(input: unknown): Promise<string> {
  await requirePensionManager();
  const parsed = parseOrThrow(upsertPensionMenuItemSchema, input);
  return new SupabasePensionRepository().upsertMenuItem(parsed);
}

export async function publishPensionMenu(input: unknown): Promise<string> {
  await requirePensionManager();
  const parsed = parseOrThrow(publishPensionMenuSchema, input);
  return new SupabasePensionRepository().publishMenu(parsed);
}

export async function closePensionMenu(input: unknown): Promise<string> {
  await requirePensionManager();
  const parsed = parseOrThrow(closePensionMenuSchema, input);
  return new SupabasePensionRepository().closeMenu(parsed);
}

export async function setPensionDeliveryFee(input: unknown): Promise<number> {
  await requirePensionManager();
  const parsed = parseOrThrow(setPensionDeliveryFeeSchema, input);
  return new SupabasePensionRepository().setDeliveryFee(parsed);
}

export async function searchPensionCustomers(query: string) {
  await requirePensionManager();
  return new SupabasePensionRepository().searchCustomers(query);
}
