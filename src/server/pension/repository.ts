import "server-only";

import { branches as configuredBranches } from "@/config/restaurant";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapPensionRpcError, PensionPersistenceError } from "@/server/pension/errors";
import {
  commercialDateInTimezone,
  mapPensionConsumptionRow,
  mapPensionMembershipRow,
  mapPensionMenuCategoryRow,
  mapPensionMenuItemRow,
  mapPensionMenuRow,
  mapPensionPlanRow,
  type MenuItemNameRow,
  type PensionConsumptionRow,
  type PensionMembershipRow,
  type PensionMenuCategoryRow,
  type PensionMenuItemRow,
  type PensionMenuRow,
  type PensionPlanRow,
} from "@/server/pension/mapper";
import type {
  ActivatePensionMembershipInput,
  ChangePensionMembershipStatusInput,
  ClosePensionMenuInput,
  CreateAndActivatePensionMembershipInput,
  CreatePensionOrderInput,
  CreatePensionOrderResult,
  PensionCatalogMenuItemView,
  PensionConsumptionView,
  PensionCustomerSearchHit,
  PensionMembershipView,
  PensionMenuView,
  PensionPlanView,
  PublishPensionMenuInput,
  RenewPensionMembershipInput,
  ReversePensionOrderConsumptionInput,
  SavePensionMenuDraftInput,
  SetPensionDeliveryFeeInput,
  UpsertPensionMenuItemInput,
} from "@/server/pension/types";
import type { Database } from "@/types/database.generated";

const PLAN_SELECT =
  "id, name, description, public_price, currency, modality, included_periods, default_meal_limit, duration_days, is_active";

const MEMBERSHIP_SELECT =
  "id, profile_id, plan_id, branch_id, status, modality, public_price_snapshot, agreed_price, payment_method, payment_date, starts_at, ends_at, meal_limit, meals_consumed, activated_at";

const MENU_SELECT = "id, branch_id, service_date, period, status, note";
const CATEGORY_SELECT = "id, menu_id, category, label, is_required, max_selections, display_order";
const MENU_ITEM_SELECT =
  "id, menu_category_id, menu_item_id, is_included, surcharge_amount, is_available, display_order";
const CONSUMPTION_SELECT =
  "id, membership_id, menu_id, order_id, status, meals_used, surplus_total, created_at, reversed_at";

type ServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

type RpcError = { message?: string; code?: string; details?: string; hint?: string } | null;

/**
 * createServerClient tipa Functions de forma incompleta frente a RETURNS TABLE / Args;
 * el contrato vive en Database y se valida aquí en tiempo de compilación vía genéricos.
 */
type PensionRpc = {
  rpc: <TArgs, TData>(
    fn: string,
    args: TArgs,
  ) => Promise<{ data: TData | null; error: RpcError }>;
};

/** Args allow null ends_at/meal_limit for calendar_period (SQL accepts; codegen marks required). */
type ActivatePensionArgs = Omit<
  Database["public"]["Functions"]["activate_pension_membership"]["Args"],
  "target_ends_at" | "target_meal_limit"
> & {
  target_ends_at: string | null;
  target_meal_limit: number | null;
};

type RenewPensionArgs = Omit<
  Database["public"]["Functions"]["renew_pension_membership"]["Args"],
  "target_ends_at" | "target_meal_limit"
> & {
  target_ends_at: string | null;
  target_meal_limit: number | null;
};

type CreatePensionOrderArgs = Database["public"]["Functions"]["create_pension_order"]["Args"];
type CreatePensionOrderRow = Database["public"]["Functions"]["create_pension_order"]["Returns"][number];

async function callPensionRpc<TArgs, TData>(
  client: ServerClient,
  fn: string,
  args: TArgs,
): Promise<TData> {
  const { data, error } = await (client as unknown as PensionRpc).rpc<TArgs, TData>(fn, args);
  if (error) throw mapPensionRpcError(error);
  if (data == null) {
    throw new PensionPersistenceError(
      "No pudimos confirmar la operación pensionada con el servidor.",
      "persistence-error",
      503,
    );
  }
  return data;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function resolveConfiguredSlug(branchIdOrSlug: string): string | null {
  if (isUuid(branchIdOrSlug)) return null;
  const byId = configuredBranches.find((branch) => branch.id === branchIdOrSlug);
  if (byId) return byId.slug;
  const bySlug = configuredBranches.find((branch) => branch.slug === branchIdOrSlug);
  if (bySlug) return bySlug.slug;
  if (branchIdOrSlug.startsWith("branch-")) return branchIdOrSlug.slice("branch-".length);
  return branchIdOrSlug;
}

/**
 * Persistencia remota pensionada vía RLS + RPC 0012.
 * Sin service_role ni INSERT directo en tablas pensionadas.
 */
export class SupabasePensionRepository {
  private async client(): Promise<ServerClient> {
    return createServerSupabaseClient();
  }

  async resolveBranchUuid(branchIdOrSlug: string): Promise<string> {
    if (isUuid(branchIdOrSlug)) return branchIdOrSlug;
    const slug = resolveConfiguredSlug(branchIdOrSlug);
    if (!slug) throw new PensionPersistenceError("La sucursal no es válida.", "unavailable", 422);
    const client = await this.client();
    const { data, error } = await client
      .from("branches")
      .select("id")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new PensionPersistenceError("No se pudo resolver la sucursal.", "unavailable");
    const row = data as { id: string } | null;
    if (!row?.id) {
      throw new PensionPersistenceError("La sucursal no existe en el catálogo remoto.", "unavailable");
    }
    return row.id;
  }

  async listPlans(): Promise<PensionPlanView[]> {
    const client = await this.client();
    const { data, error } = await client
      .from("pension_plans")
      .select(PLAN_SELECT)
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) throw new PensionPersistenceError("No se pudieron leer los planes.", "unavailable");
    return ((data ?? []) as PensionPlanRow[]).map(mapPensionPlanRow);
  }

  async getRelevantMembershipForProfile(profileId: string): Promise<PensionMembershipView | null> {
    const client = await this.client();
    const open = await client
      .from("pension_memberships")
      .select(MEMBERSHIP_SELECT)
      .eq("profile_id", profileId)
      .in("status", ["pending", "active", "suspended"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (open.error) {
      throw new PensionPersistenceError("No se pudo leer la membresía.", "unavailable");
    }
    let row = (open.data as PensionMembershipRow | null) ?? null;
    if (!row) {
      const closed = await client
        .from("pension_memberships")
        .select(MEMBERSHIP_SELECT)
        .eq("profile_id", profileId)
        .in("status", ["expired", "cancelled"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (closed.error) {
        throw new PensionPersistenceError("No se pudo leer la membresía.", "unavailable");
      }
      row = (closed.data as PensionMembershipRow | null) ?? null;
    }
    if (!row) return null;
    const extras = await this.loadMembershipExtras(client, [row]);
    return mapPensionMembershipRow(row, extras.get(row.id));
  }

  async listMembershipsForAdmin(search?: string): Promise<PensionMembershipView[]> {
    const client = await this.client();
    const { data, error } = await client
      .from("pension_memberships")
      .select(MEMBERSHIP_SELECT)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) {
      throw new PensionPersistenceError("No se pudieron leer las membresías.", "unavailable");
    }
    const rows = (data ?? []) as PensionMembershipRow[];
    const extras = await this.loadMembershipExtras(client, rows);
    let mapped = rows.map((row) => mapPensionMembershipRow(row, extras.get(row.id)));
    const needle = search?.trim().toLowerCase();
    if (needle) {
      mapped = mapped.filter((membership) => {
        const haystack = [
          membership.profileName,
          membership.profileEmail,
          membership.planName,
          membership.id,
          membership.profileId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      });
    }
    return mapped;
  }

  async searchCustomers(query: string): Promise<PensionCustomerSearchHit[]> {
    const needle = query.trim().replace(/[%_,]/g, " ");
    if (needle.length < 2) return [];
    const client = await this.client();
    const pattern = `%${needle}%`;
    const [{ data: byName, error: nameError }, { data: byEmail, error: emailError }] =
      await Promise.all([
        client
          .from("profiles")
          .select("id, name, email")
          .eq("role", "customer")
          .ilike("name", pattern)
          .order("name", { ascending: true })
          .limit(20),
        client
          .from("profiles")
          .select("id, name, email")
          .eq("role", "customer")
          .ilike("email", pattern)
          .order("email", { ascending: true })
          .limit(20),
      ]);
    if (nameError || emailError) {
      throw new PensionPersistenceError("No se pudieron buscar clientes.", "unavailable");
    }
    const byId = new Map<string, PensionCustomerSearchHit>();
    for (const row of [
      ...((byName ?? []) as Array<{ id: string; name: string | null; email: string | null }>),
      ...((byEmail ?? []) as Array<{ id: string; name: string | null; email: string | null }>),
    ]) {
      byId.set(row.id, { id: row.id, name: row.name, email: row.email });
    }
    return [...byId.values()].slice(0, 20);
  }

  async listMenus(
    branchId: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<PensionMenuView[]> {
    const branchUuid = await this.resolveBranchUuid(branchId);
    const client = await this.client();
    let query = client
      .from("pension_menus")
      .select(MENU_SELECT)
      .eq("branch_id", branchUuid)
      .order("service_date", { ascending: false })
      .order("period", { ascending: true })
      .limit(60);
    if (fromDate) query = query.gte("service_date", fromDate);
    if (toDate) query = query.lte("service_date", toDate);
    const { data, error } = await query;
    if (error) throw new PensionPersistenceError("No se pudieron leer los menús.", "unavailable");
    const rows = (data ?? []) as PensionMenuRow[];
    return this.hydrateMenus(client, rows);
  }

  async getPublishedMenusForDate(branchId: string, serviceDate: string): Promise<PensionMenuView[]> {
    const branchUuid = await this.resolveBranchUuid(branchId);
    const client = await this.client();
    const { data, error } = await client
      .from("pension_menus")
      .select(MENU_SELECT)
      .eq("branch_id", branchUuid)
      .eq("service_date", serviceDate)
      .eq("status", "published");
    if (error) {
      throw new PensionPersistenceError("No se pudieron leer los menús publicados.", "unavailable");
    }
    return this.hydrateMenus(client, (data ?? []) as PensionMenuRow[]);
  }

  async listConsumptionsForMembership(membershipId: string): Promise<PensionConsumptionView[]> {
    const client = await this.client();
    const { data, error } = await client
      .from("pension_consumptions")
      .select(CONSUMPTION_SELECT)
      .eq("membership_id", membershipId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      throw new PensionPersistenceError("No se pudieron leer los consumos.", "unavailable");
    }
    const rows = (data ?? []) as PensionConsumptionRow[];
    const menuIds = [...new Set(rows.map((row) => row.menu_id))];
    const menuById = new Map<string, PensionMenuRow>();
    if (menuIds.length > 0) {
      const { data: menus, error: menusError } = await client
        .from("pension_menus")
        .select(MENU_SELECT)
        .in("id", menuIds);
      if (menusError) {
        throw new PensionPersistenceError("No se pudieron leer los menús de consumo.", "unavailable");
      }
      for (const menu of (menus ?? []) as PensionMenuRow[]) menuById.set(menu.id, menu);
    }
    return rows.map((row) => mapPensionConsumptionRow(row, menuById.get(row.menu_id) ?? null));
  }

  async getBranchPensionDeliveryFee(branchId: string): Promise<number | null> {
    const branchUuid = await this.resolveBranchUuid(branchId);
    const client = await this.client();
    const { data, error } = await client
      .from("branches")
      .select("pension_delivery_fee")
      .eq("id", branchUuid)
      .maybeSingle();
    if (error) {
      throw new PensionPersistenceError("No se pudo leer el fee de domicilio.", "unavailable");
    }
    const fee = (data as { pension_delivery_fee: number | null } | null)?.pension_delivery_fee;
    return fee ?? null;
  }

  async getBranchMeta(
    branchId: string,
  ): Promise<{ id: string; slug: string; name: string; timezone: string; deliveryFee: number | null }> {
    const branchUuid = await this.resolveBranchUuid(branchId);
    const client = await this.client();
    const { data, error } = await client
      .from("branches")
      .select("id, slug, name, timezone, pension_delivery_fee")
      .eq("id", branchUuid)
      .maybeSingle();
    if (error || !data) {
      throw new PensionPersistenceError("No se pudo leer la sucursal.", "unavailable");
    }
    const row = data as {
      id: string;
      slug: string;
      name: string;
      timezone: string;
      pension_delivery_fee: number | null;
    };
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      timezone: row.timezone,
      deliveryFee: row.pension_delivery_fee,
    };
  }

  async listBranchesWithDeliveryFee(): Promise<
    Array<{ id: string; slug: string; name: string; deliveryFee: number | null }>
  > {
    const client = await this.client();
    const { data, error } = await client
      .from("branches")
      .select("id, slug, name, pension_delivery_fee")
      .eq("status", "active")
      .order("name", { ascending: true });
    if (error) {
      throw new PensionPersistenceError("No se pudieron leer las sucursales.", "unavailable");
    }
    return ((data ?? []) as Array<{
      id: string;
      slug: string;
      name: string;
      pension_delivery_fee: number | null;
    }>).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      deliveryFee: row.pension_delivery_fee,
    }));
  }

  async listCatalogMenuItemsForPicker(): Promise<PensionCatalogMenuItemView[]> {
    const client = await this.client();
    const { data, error } = await client
      .from("menu_items")
      .select("id, name, category_slug, base_price, image_path, available")
      .eq("available", true)
      .order("display_order", { ascending: true })
      .limit(500);
    if (error) {
      throw new PensionPersistenceError("No se pudo leer el catálogo.", "unavailable");
    }
    return ((data ?? []) as Array<{
      id: string;
      name: string;
      category_slug: string;
      base_price: number;
      image_path: string | null;
      available: boolean;
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      categorySlug: row.category_slug,
      basePrice: row.base_price,
      imagePath: row.image_path,
      available: row.available,
    }));
  }

  async createPensionOrder(input: CreatePensionOrderInput): Promise<CreatePensionOrderResult> {
    const client = await this.client();
    const rpcArgs = {
      p_idempotency_key: input.idempotencyKey,
      p_menu_id: input.menuId,
      p_pension_menu_item_ids: input.pensionMenuItemIds,
      p_fulfillment_type: input.fulfillmentType,
      p_customer_name: input.customerName,
      p_customer_phone: input.customerPhone,
      p_customer_email: input.customerEmail,
      p_address: input.address
        ? {
            street: input.address.street,
            details: input.address.details ?? "",
            neighborhood: input.address.neighborhood ?? "",
          }
        : null,
      p_notes: input.notes ?? null,
      p_tip_percent: input.tipPercent ?? 0,
      ...(input.fulfillmentType === "local" && input.tableQrToken
        ? { p_table_qr_token: input.tableQrToken }
        : {}),
    } as CreatePensionOrderArgs;

    const data = await callPensionRpc<
      CreatePensionOrderArgs,
      CreatePensionOrderRow[] | CreatePensionOrderRow
    >(client, "create_pension_order", rpcArgs);

    const row = Array.isArray(data) ? data[0] : data;
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.order_id !== "string" ||
      typeof row.order_number !== "string" ||
      typeof row.status !== "string" ||
      typeof row.total !== "number" ||
      typeof row.created_at !== "string" ||
      typeof row.consumption_id !== "string" ||
      typeof row.replay !== "boolean"
    ) {
      throw new PensionPersistenceError(
        "No pudimos confirmar el pedido pensionado con el servidor.",
        "persistence-error",
        503,
      );
    }

    return {
      orderId: row.order_id,
      orderNumber: row.order_number,
      status: row.status,
      total: row.total,
      createdAt: row.created_at,
      consumptionId: row.consumption_id,
      replay: row.replay,
      paymentStatus: "pending",
    };
  }

  async createAndActivateMembership(input: CreateAndActivatePensionMembershipInput): Promise<string> {
    const branchUuid = await this.resolveBranchUuid(input.branchId);
    const client = await this.client();
    const data = await callPensionRpc<
      Database["public"]["Functions"]["create_and_activate_pension_membership"]["Args"],
      string
    >(client, "create_and_activate_pension_membership", {
      target_customer: input.customerId,
      target_plan: input.planId,
      target_branch: branchUuid,
      target_agreed_price: input.agreedPrice,
      target_payment_method: input.paymentMethod,
      target_payment_reference: input.paymentReference ?? "",
      target_payment_date: input.paymentDate,
      target_starts_at: input.startsAt,
      target_meal_limit: input.mealLimit ?? 0,
      target_allow_surcharge: input.allowSurcharge ?? false,
      target_reason: input.reason,
      target_idempotency_key: input.idempotencyKey,
    });
    if (typeof data !== "string") {
      throw new PensionPersistenceError("No se pudo activar la membresía.", "persistence-error", 503);
    }
    return data;
  }

  async activateMembership(input: ActivatePensionMembershipInput): Promise<string> {
    const client = await this.client();
    const args: ActivatePensionArgs = {
      target_membership: input.membershipId,
      target_agreed_price: input.agreedPrice,
      target_payment_method: input.paymentMethod,
      target_payment_reference: input.paymentReference ?? "",
      target_payment_date: input.paymentDate,
      target_starts_at: input.startsAt,
      target_ends_at: input.endsAt ?? null,
      target_meal_limit: input.mealLimit ?? null,
      target_allow_surcharge: input.allowSurcharge ?? false,
      target_reason: input.reason,
      target_idempotency_key: input.idempotencyKey,
    };
    const data = await callPensionRpc<ActivatePensionArgs, string>(
      client,
      "activate_pension_membership",
      args,
    );
    if (typeof data !== "string") {
      throw new PensionPersistenceError("No se pudo activar la membresía.", "persistence-error", 503);
    }
    return data;
  }

  async renewMembership(input: RenewPensionMembershipInput): Promise<string> {
    const client = await this.client();
    const args: RenewPensionArgs = {
      target_membership: input.membershipId,
      target_agreed_price: input.agreedPrice,
      target_payment_method: input.paymentMethod,
      target_payment_reference: input.paymentReference ?? "",
      target_payment_date: input.paymentDate,
      target_starts_at: input.startsAt,
      target_ends_at: input.endsAt ?? null,
      target_meal_limit: input.mealLimit ?? null,
      target_allow_surcharge: input.allowSurcharge ?? false,
      target_reason: input.reason,
      target_idempotency_key: input.idempotencyKey,
    };
    const data = await callPensionRpc<RenewPensionArgs, string>(
      client,
      "renew_pension_membership",
      args,
    );
    if (typeof data !== "string") {
      throw new PensionPersistenceError("No se pudo renovar la membresía.", "persistence-error", 503);
    }
    return data;
  }

  async changeMembershipStatus(input: ChangePensionMembershipStatusInput): Promise<string> {
    const client = await this.client();
    const data = await callPensionRpc<
      Database["public"]["Functions"]["change_pension_membership_status"]["Args"],
      string
    >(client, "change_pension_membership_status", {
      target_membership: input.membershipId,
      target_action: input.action,
      target_reason: input.reason,
      target_idempotency_key: input.idempotencyKey,
    });
    if (typeof data !== "string") {
      throw new PensionPersistenceError("No se pudo cambiar el estado.", "persistence-error", 503);
    }
    return data;
  }

  async saveMenuDraft(input: SavePensionMenuDraftInput): Promise<string> {
    const branchUuid = await this.resolveBranchUuid(input.branchId);
    const client = await this.client();
    const data = await callPensionRpc<
      Database["public"]["Functions"]["save_pension_menu_draft"]["Args"],
      string
    >(client, "save_pension_menu_draft", {
      target_branch: branchUuid,
      target_service_date: input.serviceDate,
      target_period: input.period,
      target_note: input.note ?? "",
      target_idempotency_key: input.idempotencyKey,
    });
    if (typeof data !== "string") {
      throw new PensionPersistenceError("No se pudo guardar el borrador.", "persistence-error", 503);
    }
    return data;
  }

  async upsertMenuItem(input: UpsertPensionMenuItemInput): Promise<string> {
    const client = await this.client();
    const data = await callPensionRpc<
      Database["public"]["Functions"]["upsert_pension_menu_item"]["Args"],
      string
    >(client, "upsert_pension_menu_item", {
      target_menu: input.menuId,
      target_category: input.category,
      target_category_label: input.categoryLabel,
      target_is_required: input.isRequired,
      target_max_selections: input.maxSelections,
      target_menu_item_id: input.menuItemId,
      target_is_included: input.isIncluded,
      target_surcharge_amount: input.surchargeAmount,
      target_is_available: input.isAvailable,
      target_display_order: input.displayOrder,
    });
    if (typeof data !== "string") {
      throw new PensionPersistenceError("No se pudo guardar el ítem del menú.", "persistence-error", 503);
    }
    return data;
  }

  async publishMenu(input: PublishPensionMenuInput): Promise<string> {
    const client = await this.client();
    const data = await callPensionRpc<
      Database["public"]["Functions"]["publish_pension_menu"]["Args"],
      string
    >(client, "publish_pension_menu", {
      target_menu: input.menuId,
      expected_status: input.expectedStatus,
      target_idempotency_key: input.idempotencyKey,
    });
    if (typeof data !== "string") {
      throw new PensionPersistenceError("No se pudo publicar el menú.", "persistence-error", 503);
    }
    return data;
  }

  async closeMenu(input: ClosePensionMenuInput): Promise<string> {
    const client = await this.client();
    const data = await callPensionRpc<
      Database["public"]["Functions"]["close_pension_menu"]["Args"],
      string
    >(client, "close_pension_menu", {
      target_menu: input.menuId,
      expected_status: input.expectedStatus,
      target_idempotency_key: input.idempotencyKey,
    });
    if (typeof data !== "string") {
      throw new PensionPersistenceError("No se pudo cerrar el menú.", "persistence-error", 503);
    }
    return data;
  }

  async setDeliveryFee(input: SetPensionDeliveryFeeInput): Promise<number> {
    const branchUuid = await this.resolveBranchUuid(input.branchId);
    const client = await this.client();
    const data = await callPensionRpc<
      Database["public"]["Functions"]["set_pension_delivery_fee"]["Args"],
      number
    >(client, "set_pension_delivery_fee", {
      target_branch: branchUuid,
      target_fee: input.fee,
      target_idempotency_key: input.idempotencyKey,
    });
    if (typeof data !== "number") {
      throw new PensionPersistenceError("No se pudo guardar el fee.", "persistence-error", 503);
    }
    return data;
  }

  /** Exposed for mapping/tests; staff cancel coordination uses the same RPC. */
  async reversePensionOrderConsumption(input: ReversePensionOrderConsumptionInput): Promise<string> {
    const client = await this.client();
    const data = await callPensionRpc<
      Database["public"]["Functions"]["reverse_pension_order_consumption"]["Args"],
      string
    >(client, "reverse_pension_order_consumption", {
      target_order: input.orderId,
      target_reason: input.reason,
      target_idempotency_key: input.idempotencyKey,
    });
    if (typeof data !== "string") {
      throw new PensionPersistenceError("No se pudo revertir el consumo.", "persistence-error", 503);
    }
    return data;
  }

  async markMenusConsumedByMe(
    menus: PensionMenuView[],
    membershipId: string | null,
  ): Promise<PensionMenuView[]> {
    if (!membershipId || menus.length === 0) return menus;
    const client = await this.client();
    const menuIds = menus.map((menu) => menu.id);
    const { data, error } = await client
      .from("pension_consumptions")
      .select("menu_id, status")
      .eq("membership_id", membershipId)
      .in("menu_id", menuIds)
      .eq("status", "confirmed");
    if (error) return menus.map((menu) => ({ ...menu, consumedByMe: false }));
    const consumed = new Set(
      ((data ?? []) as Array<{ menu_id: string }>).map((row) => row.menu_id),
    );
    return menus.map((menu) => ({ ...menu, consumedByMe: consumed.has(menu.id) }));
  }

  commercialDateForTimezone(timezone: string): string {
    return commercialDateInTimezone(timezone);
  }

  private async loadMembershipExtras(
    client: ServerClient,
    rows: PensionMembershipRow[],
  ): Promise<
    Map<string, { profileName?: string | null; profileEmail?: string | null; planName?: string | null }>
  > {
    const result = new Map<
      string,
      { profileName?: string | null; profileEmail?: string | null; planName?: string | null }
    >();
    if (rows.length === 0) return result;

    const profileIds = [...new Set(rows.map((row) => row.profile_id))];
    const planIds = [...new Set(rows.map((row) => row.plan_id))];

    const [{ data: profiles }, { data: plans }] = await Promise.all([
      client.from("profiles").select("id, name, email").in("id", profileIds),
      client.from("pension_plans").select("id, name").in("id", planIds),
    ]);

    const profileById = new Map(
      ((profiles ?? []) as Array<{ id: string; name: string | null; email: string | null }>).map(
        (row) => [row.id, row],
      ),
    );
    const planById = new Map(
      ((plans ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row]),
    );

    for (const row of rows) {
      const profile = profileById.get(row.profile_id);
      const plan = planById.get(row.plan_id);
      result.set(row.id, {
        profileName: profile?.name ?? null,
        profileEmail: profile?.email ?? null,
        planName: plan?.name ?? null,
      });
    }
    return result;
  }

  private async hydrateMenus(
    client: ServerClient,
    rows: PensionMenuRow[],
  ): Promise<PensionMenuView[]> {
    if (rows.length === 0) return [];
    const menuIds = rows.map((row) => row.id);
    const { data: categoryData, error: categoryError } = await client
      .from("pension_menu_categories")
      .select(CATEGORY_SELECT)
      .in("menu_id", menuIds)
      .order("display_order", { ascending: true });
    if (categoryError) {
      throw new PensionPersistenceError("No se pudieron leer las categorías del menú.", "unavailable");
    }
    const categories = (categoryData ?? []) as PensionMenuCategoryRow[];
    const categoryIds = categories.map((row) => row.id);

    let items: PensionMenuItemRow[] = [];
    if (categoryIds.length > 0) {
      const { data: itemData, error: itemError } = await client
        .from("pension_menu_items")
        .select(MENU_ITEM_SELECT)
        .in("menu_category_id", categoryIds)
        .order("display_order", { ascending: true });
      if (itemError) {
        throw new PensionPersistenceError("No se pudieron leer los ítems del menú.", "unavailable");
      }
      items = (itemData ?? []) as PensionMenuItemRow[];
    }

    const menuItemIds = [...new Set(items.map((item) => item.menu_item_id))];
    const nameById = new Map<string, MenuItemNameRow>();
    if (menuItemIds.length > 0) {
      const { data: names, error: namesError } = await client
        .from("menu_items")
        .select("id, name, image_path")
        .in("id", menuItemIds);
      if (namesError) {
        throw new PensionPersistenceError("No se pudieron leer los nombres de platos.", "unavailable");
      }
      for (const row of (names ?? []) as MenuItemNameRow[]) nameById.set(row.id, row);
    }

    const itemsByCategory = new Map<string, PensionMenuItemRow[]>();
    for (const item of items) {
      const list = itemsByCategory.get(item.menu_category_id) ?? [];
      list.push(item);
      itemsByCategory.set(item.menu_category_id, list);
    }

    const categoriesByMenu = new Map<string, PensionMenuCategoryRow[]>();
    for (const category of categories) {
      const list = categoriesByMenu.get(category.menu_id) ?? [];
      list.push(category);
      categoriesByMenu.set(category.menu_id, list);
    }

    return rows.map((menu) => {
      const menuCategories = (categoriesByMenu.get(menu.id) ?? []).map((category) =>
        mapPensionMenuCategoryRow(
          category,
          (itemsByCategory.get(category.id) ?? []).map((item) =>
            mapPensionMenuItemRow(item, nameById.get(item.menu_item_id)),
          ),
        ),
      );
      return mapPensionMenuRow(menu, menuCategories);
    });
  }
}
