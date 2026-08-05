import { getSupabaseAnonClient } from "@/lib/supabase/client";
import { CATEGORIES } from "@/lib/menu/categories";
import type { CategoryInfo, MenuItem } from "@/types/menu";
import type { Order } from "@/types/order";
import type { MenuRepository, OrderRepository } from "./types";

/** Implementación de catálogo público en Supabase (sin sesión persistente). */
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

const menuSelect =
  "id, slug, name, short_name, category_slug, short_description, description, base_price, available, featured, tags, ingredients, allergens, preparation_minutes, display_order, image_path, image_width, image_height, image_blur_data_url, original_filename";

export class SupabaseMenuRepository implements MenuRepository {
  async getMenuItems(): Promise<MenuItem[]> {
    const { data, error } = await getSupabaseAnonClient()
      .from("menu_items")
      .select(menuSelect)
      .order("display_order", { ascending: true });
    if (error) throw new Error(`Supabase: no se pudo leer el menú (${error.message}).`);
    return (data as MenuItemRow[]).map(mapMenuItemRow);
  }

  async getMenuItemBySlug(slug: string): Promise<MenuItem | null> {
    const { data, error } = await getSupabaseAnonClient()
      .from("menu_items")
      .select(menuSelect)
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(`Supabase: no se pudo leer el plato (${error.message}).`);
    return data ? mapMenuItemRow(data as MenuItemRow) : null;
  }

  async getCategories(): Promise<CategoryInfo[]> {
    const { data, error } = await getSupabaseAnonClient()
      .from("categories")
      .select("slug, name, description, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (error) throw new Error(`Supabase: no se pudieron leer las categorías (${error.message}).`);
    if (!data || data.length === 0) return CATEGORIES;
    return data.map((row) => ({
      slug: row.slug as string,
      name: row.name as string,
      description: (row.description as string | null) ?? "",
      displayOrder: row.display_order as number,
    }));
  }
}

/**
 * Las escrituras remotas de pedidos siguen fuera de alcance. La ruta
 * públicas las rechazan en Supabase mode y nunca llegan a service_role.
 */
export class SupabaseApplicationWriteDisabledError extends Error {
  constructor(resource: "pedido") {
    super(`La persistencia remota de ${resource} aún no está habilitada.`);
    this.name = "SupabaseApplicationWriteDisabledError";
  }
}

export class SupabaseOrderRepository implements OrderRepository {
  async saveOrder(_order: Order): Promise<Order> {
    throw new SupabaseApplicationWriteDisabledError("pedido");
  }

  async getOrderById(_id: string): Promise<Order | null> {
    return null;
  }
}
