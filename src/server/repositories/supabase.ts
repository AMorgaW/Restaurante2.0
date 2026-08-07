import "server-only";

import { getSupabaseAnonClient } from "@/lib/supabase/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  mapCatalogCategories,
  mapCatalogMenuItem,
  sortCatalogMenuItems,
  type CatalogBranchMenuRow,
  type CatalogCategoryRow,
  type CatalogMenuItemRow,
  type CatalogModifierGroupRow,
  type CatalogModifierOptionRow,
} from "@/server/repositories/menu-mapper";
import { createIncludedLunchSoupGroup, getIncludedLunchSoups, isSoupItem } from "@/lib/menu/included-soups";
import { requireConfiguredBranch } from "@/server/catalog/branch-config";
import { mapCreateCustomerOrderError, OrderPersistenceError } from "@/server/orders/rpc-errors";
import {
  isOrderStatus,
  mapOrderRowsToOrders,
  type BranchSlugRow,
  type OrderItemRow,
  type OrderRow,
} from "@/server/orders/order-mapper";
import { mapOrderStatusDbError } from "@/server/orders/staff-errors";
import type { Database } from "@/types/database.generated";
import type { CategoryInfo, MenuItem } from "@/types/menu";
import type { MenuRepository } from "./types";
import type { Order } from "@/types/order";
import type { OrderRepository, UpdateOrderStatusInput, UpdateOrderStatusResult } from "./types";

const ORDER_SELECT =
  "id, order_number, user_id, branch_id, status, payment_status, payment_method, fulfillment_type, subtotal, discount, tax, service_fee, delivery_fee, tip, total, currency, coupon_code, customer_name, customer_phone, customer_email, address_snapshot, notes, created_at";

const ORDER_ITEM_SELECT =
  "id, order_id, menu_item_id, name_snapshot, unit_price, quantity, modifiers_snapshot, notes, total";

async function loadBranchSlugMap(
  client: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  branchIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(branchIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data, error } = await client.from("branches").select("id, slug").in("id", unique);
  if (error) throw new Error("No se pudieron resolver las sucursales de los pedidos.");
  return new Map(((data ?? []) as BranchSlugRow[]).map((row) => [row.id, row.slug]));
}

async function hydrateOrders(
  client: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  orderRows: OrderRow[],
): Promise<Order[]> {
  if (orderRows.length === 0) return [];
  const orderIds = orderRows.map((row) => row.id);
  const { data: itemData, error: itemError } = await client
    .from("order_items")
    .select(ORDER_ITEM_SELECT)
    .in("order_id", orderIds);
  if (itemError) throw new Error("No se pudieron leer los ítems del pedido.");
  const slugByUuid = await loadBranchSlugMap(
    client,
    orderRows.map((row) => row.branch_id),
  );
  return mapOrderRowsToOrders(orderRows, (itemData ?? []) as OrderItemRow[], slugByUuid);
}

const menuSelect =
  "id, slug, name, short_name, category_slug, short_description, description, base_price, available, featured, tags, ingredients, allergens, preparation_minutes, display_order, image_path, image_width, image_height, image_blur_data_url, original_filename";

export class CatalogReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogReadError";
  }
}

async function resolveBranchUuid(branchId: string): Promise<string> {
  const configured = requireConfiguredBranch(branchId);
  const { data, error } = await getSupabaseAnonClient()
    .from("branches")
    .select("id, slug, status")
    .eq("slug", configured.slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new CatalogReadError("No se pudo resolver la sucursal del catálogo.");
  if (!data?.id) throw new CatalogReadError("La sucursal no existe en el catálogo remoto.");
  return data.id as string;
}

function attachIncludedSoups(items: MenuItem[]): MenuItem[] {
  const soups = getIncludedLunchSoups(items);
  if (soups.length === 0) return items;
  const group = createIncludedLunchSoupGroup(soups);
  return items.map((item) => (isSoupItem(item) ? item : {
    ...item,
    modifierGroups: [...item.modifierGroups.filter((candidate) => candidate.id !== group.id), group],
  }));
}

async function loadModifiers(menuItemIds: string[]): Promise<{
  groups: CatalogModifierGroupRow[];
  options: CatalogModifierOptionRow[];
}> {
  if (menuItemIds.length === 0) return { groups: [], options: [] };
  const client = getSupabaseAnonClient();
  const { data: groups, error: groupsError } = await client
    .from("modifier_groups")
    .select("id, menu_item_id, name, minimum_selections, maximum_selections, required, display_order")
    .in("menu_item_id", menuItemIds);
  if (groupsError) throw new CatalogReadError("No se pudieron leer los modificadores.");
  const groupRows = (groups ?? []) as CatalogModifierGroupRow[];
  const groupIds = groupRows.map((group) => group.id);
  if (groupIds.length === 0) return { groups: groupRows, options: [] };
  const { data: options, error: optionsError } = await client
    .from("modifier_options")
    .select("id, modifier_group_id, name, additional_price, available, display_order")
    .in("modifier_group_id", groupIds);
  if (optionsError) throw new CatalogReadError("No se pudieron leer las opciones de modificador.");
  return { groups: groupRows, options: (options ?? []) as CatalogModifierOptionRow[] };
}

export class SupabaseMenuRepository implements MenuRepository {
  async getCategories(): Promise<CategoryInfo[]> {
    const { data, error } = await getSupabaseAnonClient()
      .from("categories")
      .select("slug, name, description, display_order, is_active")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (error) throw new CatalogReadError("No se pudieron leer las categorías.");
    return mapCatalogCategories((data ?? []) as CatalogCategoryRow[]);
  }

  async getMenuItems(options: { branchId: string }): Promise<MenuItem[]> {
    const branchUuid = await resolveBranchUuid(options.branchId);
    const client = getSupabaseAnonClient();
    const categories = await this.getCategories();

    const [{ data: items, error: itemsError }, { data: branchRows, error: branchError }] = await Promise.all([
      client.from("menu_items").select(menuSelect).eq("available", true).order("display_order", { ascending: true }),
      client.from("branch_menu_items").select("menu_item_id, price, available").eq("branch_id", branchUuid),
    ]);
    if (itemsError) throw new CatalogReadError("No se pudo leer el menú.");
    if (branchError) throw new CatalogReadError("No se pudo leer la disponibilidad por sucursal.");

    const itemRows = (items ?? []) as CatalogMenuItemRow[];
    const branchByItem = new Map(
      ((branchRows ?? []) as CatalogBranchMenuRow[]).map((row) => [row.menu_item_id, row]),
    );
    const { groups, options: modifierOptions } = await loadModifiers(itemRows.map((row) => row.id));

    const mapped = itemRows
      .map((row) => mapCatalogMenuItem(row, branchByItem.get(row.id), groups, modifierOptions))
      .filter((item): item is MenuItem => item !== null);

    return attachIncludedSoups(sortCatalogMenuItems(mapped, categories));
  }

  async getMenuItemBySlug(slug: string, options: { branchId: string }): Promise<MenuItem | null> {
    const branchUuid = await resolveBranchUuid(options.branchId);
    const client = getSupabaseAnonClient();
    const { data: item, error } = await client
      .from("menu_items")
      .select(menuSelect)
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new CatalogReadError("No se pudo leer el plato.");
    if (!item) return null;

    const row = item as CatalogMenuItemRow;
    const { data: branchRow, error: branchError } = await client
      .from("branch_menu_items")
      .select("menu_item_id, price, available")
      .eq("branch_id", branchUuid)
      .eq("menu_item_id", row.id)
      .maybeSingle();
    if (branchError) throw new CatalogReadError("No se pudo leer la disponibilidad del plato.");

    const { groups, options: modifierOptions } = await loadModifiers([row.id]);
    const mapped = mapCatalogMenuItem(
      row,
      (branchRow as CatalogBranchMenuRow | null) ?? undefined,
      groups,
      modifierOptions,
    );
    if (!mapped) return null;

    // Sopa incluida: necesita el resto del catálogo de la sucursal.
    if (!isSoupItem(mapped)) {
      const all = await this.getMenuItems(options);
      return all.find((candidate) => candidate.slug === slug) ?? mapped;
    }
    return mapped;
  }
}

/**
 * Persistencia remota de pedidos vía RPC `create_customer_order` (11B-2B).
 * Una sola llamada RPC por intento; sin INSERT directo ni service_role.
 */
export class SupabaseOrderRepository implements OrderRepository {
  async saveOrder(order: Order, options?: { tipPercent?: number }): Promise<Order> {
    const branchUuid = await resolveBranchUuid(order.branchId);
    const client = await createServerSupabaseClient();

    // La clave de intento viaja en order.id hasta que la RPC devuelve el id real.
    const idempotencyKey = order.id;

    const itemsPayload = order.items.map((item) => ({
      menu_item_id: item.itemId,
      quantity: item.quantity,
      notes: item.notes ?? "",
      modifier_option_ids: item.modifiers.map((modifier) => modifier.optionId),
    }));

    const rpcArgs: Database["public"]["Functions"]["create_customer_order"]["Args"] = {
      p_idempotency_key: idempotencyKey,
      p_branch_id: branchUuid,
      p_fulfillment_type: order.fulfillmentType,
      p_customer_name: order.customer.name,
      p_customer_phone: order.customer.phone,
      p_customer_email: order.customer.email,
      p_items: itemsPayload,
      p_address: order.address
        ? {
            street: order.address.street,
            details: order.address.details,
            neighborhood: order.address.neighborhood,
          }
        : null,
      p_notes: order.notes || null,
      p_tip_percent: options?.tipPercent ?? 0,
      p_coupon_code: order.couponCode ?? null,
    };

    // createServerClient tipa Functions de forma incompleta frente a RETURNS TABLE;
    // el contrato Args/Returns vive en Database y se valida aquí en tiempo de compilación.
    type CreateOrderRpc = {
      rpc: (
        fn: "create_customer_order",
        args: Database["public"]["Functions"]["create_customer_order"]["Args"],
      ) => Promise<{
        data:
          | Database["public"]["Functions"]["create_customer_order"]["Returns"]
          | Array<Database["public"]["Functions"]["create_customer_order"]["Returns"]>
          | null;
        error: { message?: string; code?: string; details?: string; hint?: string } | null;
      }>;
    };
    const { data, error } = await (client as unknown as CreateOrderRpc).rpc(
      "create_customer_order",
      rpcArgs,
    );

    if (error) {
      throw mapCreateCustomerOrderError(error);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (
      !row ||
      typeof row !== "object" ||
      typeof (row as { order_id?: unknown }).order_id !== "string" ||
      typeof (row as { order_number?: unknown }).order_number !== "string" ||
      typeof (row as { status?: unknown }).status !== "string" ||
      typeof (row as { total?: unknown }).total !== "number" ||
      typeof (row as { created_at?: unknown }).created_at !== "string" ||
      typeof (row as { replay?: unknown }).replay !== "boolean"
    ) {
      throw new OrderPersistenceError(
        "No pudimos confirmar el pedido con el servidor.",
        "persistence-error",
        503,
      );
    }

    const result = row as {
      order_id: string;
      order_number: string;
      status: string;
      total: number;
      created_at: string;
      replay: boolean;
    };

    return {
      ...order,
      id: result.order_id,
      orderNumber: result.order_number,
      status: isOrderStatus(result.status) ? result.status : "pending",
      paymentStatus: "pending",
      paymentMethod: "demo",
      totals: {
        ...order.totals,
        total: result.total,
      },
      createdAt: result.created_at,
      replay: result.replay,
    };
  }

  async getOrderById(id: string): Promise<Order | null> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
    if (error) throw new Error("No se pudo leer el pedido.");
    if (!data) return null;
    const orders = await hydrateOrders(client, [data as OrderRow]);
    return orders[0] ?? null;
  }

  async listOrders(options?: { limit?: number }): Promise<Order[]> {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
    const client = await createServerSupabaseClient();
    const { data, error } = await client
      .from("orders")
      .select(ORDER_SELECT)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error("No se pudieron leer los pedidos.");
    return hydrateOrders(client, (data ?? []) as OrderRow[]);
  }

  async updateOrderStatus(input: UpdateOrderStatusInput): Promise<UpdateOrderStatusResult> {
    const client = await createServerSupabaseClient();
    // El generador estrecha Updates de orders a `never` en el client tipado;
    // RLS + trigger siguen siendo la autoridad; solo enviamos `status`.
    type OrdersWriter = {
      from: (table: "orders") => {
        update: (values: { status: string }) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => {
              select: (columns: string) => {
                maybeSingle: () => Promise<{
                  data: OrderRow | null;
                  error: { message?: string; code?: string; details?: string } | null;
                }>;
              };
            };
          };
        };
      };
    };

    const { data: updated, error } = await (client as unknown as OrdersWriter)
      .from("orders")
      .update({ status: input.nextStatus })
      .eq("id", input.orderId)
      .eq("status", input.expectedStatus)
      .select(ORDER_SELECT)
      .maybeSingle();

    if (error) {
      throw mapOrderStatusDbError(error);
    }

    if (updated) {
      const orders = await hydrateOrders(client, [updated]);
      const order = orders[0];
      if (!order) return { ok: false, reason: "not-found" };
      return { ok: true, order };
    }

    const current = await this.getOrderById(input.orderId);
    if (!current) return { ok: false, reason: "not-found" };
    if (current.status !== input.expectedStatus) return { ok: false, reason: "stale" };
    return { ok: false, reason: "forbidden" };
  }
}
