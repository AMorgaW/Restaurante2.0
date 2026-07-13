import { getSupabaseAnonClient, getSupabaseServiceClient } from "@/lib/supabase/client";
import { CATEGORIES } from "@/lib/menu/categories";
import type { CategoryInfo, MenuItem } from "@/types/menu";
import type { Order, Reservation } from "@/types/order";
import type { MenuRepository, OrderRepository, ReservationRepository } from "./types";

/**
 * Implementaciones de PRODUCCIÓN sobre Supabase (PostgreSQL + RLS).
 * Solo se instancian cuando DATA_MODE=supabase con credenciales válidas.
 * El esquema corresponde a supabase/migrations/0001_initial.sql.
 */

interface MenuItemRow {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  category_slug: string;
  short_description: string | null;
  description: string | null;
  base_price: number;
  available: boolean;
  featured: boolean;
  tags: string[] | null;
  ingredients: string[] | null;
  allergens: string[] | null;
  preparation_minutes: number | null;
  display_order: number;
  image_path: string;
  image_width: number | null;
  image_height: number | null;
  image_blur_data_url: string | null;
  original_filename: string | null;
}

function mapMenuItemRow(row: MenuItemRow): MenuItem {
  const width = row.image_width ?? 1200;
  const height = row.image_height ?? 800;
  return {
    id: row.id,
    slug: row.slug,
    fullName: row.name,
    ...(row.short_name ? { shortName: row.short_name } : {}),
    categorySlug: row.category_slug,
    shortDescription: row.short_description ?? "",
    ...(row.description ? { description: row.description } : {}),
    price: row.base_price,
    available: row.available,
    featured: row.featured,
    tags: row.tags ?? [],
    ...(row.ingredients ? { ingredients: row.ingredients } : {}),
    ...(row.allergens ? { allergens: row.allergens } : {}),
    ...(row.preparation_minutes != null ? { preparationMinutes: row.preparation_minutes } : {}),
    displayOrder: row.display_order,
    image: {
      originalFilename: row.original_filename ?? row.image_path,
      publicPath: row.image_path,
      width,
      height,
      aspectRatio: Math.round((width / height) * 1000) / 1000,
      hasAlpha: false,
      blurDataURL: row.image_blur_data_url ?? "",
      bytes: 0,
    },
    modifierGroups: [],
  };
}

export class SupabaseMenuRepository implements MenuRepository {
  async getMenuItems(): Promise<MenuItem[]> {
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase
      .from("menu_items")
      .select(
        "id, slug, name, short_name, category_slug, short_description, description, base_price, available, featured, tags, ingredients, allergens, preparation_minutes, display_order, image_path, image_width, image_height, image_blur_data_url, original_filename",
      )
      .order("display_order", { ascending: true });
    if (error) {
      throw new Error(`Supabase: no se pudo leer el menú (${error.message}).`);
    }
    return (data as MenuItemRow[]).map(mapMenuItemRow);
  }

  async getMenuItemBySlug(slug: string): Promise<MenuItem | null> {
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase
      .from("menu_items")
      .select(
        "id, slug, name, short_name, category_slug, short_description, description, base_price, available, featured, tags, ingredients, allergens, preparation_minutes, display_order, image_path, image_width, image_height, image_blur_data_url, original_filename",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      throw new Error(`Supabase: no se pudo leer el plato (${error.message}).`);
    }
    return data ? mapMenuItemRow(data as MenuItemRow) : null;
  }

  async getCategories(): Promise<CategoryInfo[]> {
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase
      .from("categories")
      .select("slug, name, description, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (error) {
      throw new Error(`Supabase: no se pudieron leer las categorías (${error.message}).`);
    }
    if (!data || data.length === 0) return CATEGORIES;
    return data.map((row) => ({
      slug: row.slug as string,
      name: row.name as string,
      description: (row.description as string | null) ?? "",
      displayOrder: row.display_order as number,
    }));
  }
}

export class SupabaseOrderRepository implements OrderRepository {
  async saveOrder(order: Order): Promise<Order> {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.from("orders").insert({
      id: order.id,
      order_number: order.orderNumber,
      branch_id: order.branchId,
      status: order.status,
      payment_status: order.paymentStatus,
      payment_method: order.paymentMethod,
      fulfillment_type: order.fulfillmentType,
      subtotal: order.totals.subtotal,
      discount: order.totals.discount,
      tax: order.totals.tax,
      service_fee: order.totals.serviceFee,
      delivery_fee: order.totals.deliveryFee,
      tip: order.totals.tip,
      total: order.totals.total,
      currency: order.currency,
      coupon_code: order.couponCode ?? null,
      customer_name: order.customer.name,
      customer_phone: order.customer.phone,
      customer_email: order.customer.email,
      address_snapshot: order.address ?? null,
      notes: order.notes,
      created_at: order.createdAt,
    });
    if (error) {
      // 23505 = unique_violation: reintento idempotente, el pedido ya existe.
      if (error.code === "23505") {
        const existing = await this.getOrderById(order.id);
        if (existing) return existing;
      }
      throw new Error(`Supabase: no se pudo guardar el pedido (${error.message}).`);
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      order.items.map((item) => ({
        order_id: order.id,
        menu_item_id: item.itemId,
        name_snapshot: item.nameSnapshot,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        modifiers_snapshot: item.modifiers,
        notes: item.notes,
        total: item.total,
      })),
    );
    if (itemsError) {
      throw new Error(`Supabase: no se pudieron guardar las líneas (${itemsError.message}).`);
    }
    return order;
  }

  async getOrderById(id: string): Promise<Order | null> {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;

    interface OrderItemRow {
      menu_item_id: string;
      name_snapshot: string;
      unit_price: number;
      quantity: number;
      modifiers_snapshot: Order["items"][number]["modifiers"] | null;
      notes: string | null;
      total: number;
    }

    return {
      id: data.id,
      orderNumber: data.order_number,
      branchId: data.branch_id,
      status: data.status,
      paymentStatus: data.payment_status,
      paymentMethod: data.payment_method,
      fulfillmentType: data.fulfillment_type,
      items: ((data.order_items as OrderItemRow[]) ?? []).map((item) => ({
        itemId: item.menu_item_id,
        slug: item.menu_item_id,
        nameSnapshot: item.name_snapshot,
        unitPrice: item.unit_price,
        quantity: item.quantity,
        modifiers: item.modifiers_snapshot ?? [],
        notes: item.notes ?? "",
        total: item.total,
      })),
      totals: {
        subtotal: data.subtotal,
        discount: data.discount,
        tax: data.tax,
        serviceFee: data.service_fee,
        deliveryFee: data.delivery_fee,
        tip: data.tip,
        total: data.total,
      },
      currency: data.currency,
      ...(data.coupon_code ? { couponCode: data.coupon_code } : {}),
      customer: {
        name: data.customer_name,
        phone: data.customer_phone,
        email: data.customer_email,
      },
      ...(data.address_snapshot ? { address: data.address_snapshot } : {}),
      notes: data.notes ?? "",
      createdAt: data.created_at,
    };
  }
}

export class SupabaseReservationRepository implements ReservationRepository {
  async saveReservation(reservation: Reservation): Promise<Reservation> {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.from("reservations").insert({
      id: reservation.id,
      branch_id: reservation.branchId,
      customer_name: reservation.customerName,
      phone: reservation.phone,
      email: reservation.email,
      date: reservation.date,
      time: reservation.time,
      party_size: reservation.partySize,
      occasion: reservation.occasion ?? null,
      notes: reservation.notes ?? null,
      status: reservation.status,
      created_at: reservation.createdAt,
    });
    if (error) {
      throw new Error(`Supabase: no se pudo guardar la reserva (${error.message}).`);
    }
    return reservation;
  }

  async getReservationById(id: string): Promise<Reservation | null> {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      branchId: data.branch_id,
      customerName: data.customer_name,
      phone: data.phone,
      email: data.email,
      date: data.date,
      time: data.time,
      partySize: data.party_size,
      ...(data.occasion ? { occasion: data.occasion } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
      status: data.status,
      createdAt: data.created_at,
    };
  }

  async cancelReservation(id: string): Promise<Reservation | null> {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) return null;
    return this.getReservationById(id);
  }
}
