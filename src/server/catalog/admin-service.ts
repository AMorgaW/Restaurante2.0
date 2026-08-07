import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { adminRoleCan, isAdminRole, type AdminRole } from "@/lib/admin/authorization";
import { getResolvedDataMode } from "@/lib/env/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveServerSession } from "@/lib/session/server-resolver";
import { requireConfiguredBranch } from "@/server/catalog/branch-config";
import { CatalogAdminError } from "@/server/catalog/admin-errors";
import {
  createCategorySchema,
  createModifierGroupSchema,
  createModifierOptionSchema,
  updateCategorySchema,
  updateMenuItemSchema,
  updateModifierGroupSchema,
  updateModifierOptionSchema,
  upsertBranchCommerceSchema,
  type CreateCategoryInput,
  type CreateModifierGroupInput,
  type CreateModifierOptionInput,
  type UpdateCategoryInput,
  type UpdateMenuItemInput,
  type UpdateModifierGroupInput,
  type UpdateModifierOptionInput,
  type UpsertBranchCommerceInput,
} from "@/server/catalog/admin-schemas";

const CATALOG_ADMIN_ROLES = new Set<AdminRole>(["owner", "admin", "manager", "editor"]);

/**
 * Cliente de escritura tipado de forma laxa: el generador actual estrecha
 * algunas mutaciones a `never` en el client SSR; RLS sigue siendo la autoridad
 * y Zod acota el payload.
 */
type CatalogWriter = SupabaseClient;

async function requireCatalogSession(capability: "edit-catalog" | "edit-prices" = "edit-catalog") {
  if (getResolvedDataMode() !== "supabase") {
    throw new CatalogAdminError(
      "Esta operación solo está disponible con DATA_MODE=supabase.",
      "data-mode",
    );
  }

  const session = await resolveServerSession();
  if (session.kind === "anonymous" || !session.profile) {
    throw new CatalogAdminError("Debes iniciar sesión para administrar el catálogo.", "unauthorized");
  }
  if (
    session.kind === "suspended_staff" ||
    session.profile.status === "suspended" ||
    session.profile.status === "inactive" ||
    session.profile.status === "invited"
  ) {
    throw new CatalogAdminError("Tu cuenta de personal no está activa.", "forbidden");
  }
  if (!isAdminRole(session.profile.role) || !CATALOG_ADMIN_ROLES.has(session.profile.role)) {
    throw new CatalogAdminError("No tienes permiso para administrar el catálogo.", "forbidden");
  }
  if (!adminRoleCan(session.profile.role, capability)) {
    throw new CatalogAdminError("Tu rol no permite esta operación del catálogo.", "forbidden");
  }

  const client = (await createServerSupabaseClient()) as unknown as CatalogWriter;
  return { session, client, role: session.profile.role };
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
    const message = parsed.error.issues[0]?.message ?? "Los datos del catálogo no son válidos.";
    throw new CatalogAdminError(message, "validation");
  }
  return parsed.data;
}

async function resolveBranchUuid(client: CatalogWriter, branchConfigId: string): Promise<string> {
  const configured = requireConfiguredBranch(branchConfigId);
  const { data, error } = await client
    .from("branches")
    .select("id")
    .eq("slug", configured.slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new CatalogAdminError("No se pudo resolver la sucursal.", "persist");
  const row = data as { id: string } | null;
  if (!row?.id) throw new CatalogAdminError("La sucursal no existe en el catálogo remoto.", "not-found");
  return row.id;
}

async function requireRestaurantId(client: CatalogWriter): Promise<string> {
  const { data, error } = await client
    .from("restaurants")
    .select("id")
    .eq("status", "active")
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new CatalogAdminError("No se pudo resolver el restaurante.", "persist");
  const row = data as { id: string } | null;
  if (!row?.id) throw new CatalogAdminError("No hay restaurante activo configurado.", "not-found");
  return row.id;
}

export async function updateMenuItemAdmin(raw: unknown): Promise<{ id: string }> {
  const input = parseOrThrow<UpdateMenuItemInput>(updateMenuItemSchema, raw);
  const { client } = await requireCatalogSession("edit-catalog");

  if (input.categorySlug) {
    const { data: category, error: categoryError } = await client
      .from("categories")
      .select("slug")
      .eq("slug", input.categorySlug)
      .maybeSingle();
    if (categoryError) throw new CatalogAdminError("No se pudo validar la categoría.", "persist");
    if (!category) throw new CatalogAdminError("La categoría indicada no existe.", "validation");
  }

  const patch: Record<string, string | number | boolean | null> = {};
  if (input.shortDescription !== undefined) patch.short_description = input.shortDescription;
  if (input.available !== undefined) patch.available = input.available;
  if (input.featured !== undefined) patch.featured = input.featured;
  if (input.name !== undefined) patch.name = input.name;
  if (input.displayOrder !== undefined) patch.display_order = input.displayOrder;
  if (input.categorySlug !== undefined) patch.category_slug = input.categorySlug;

  const { data, error } = await client
    .from("menu_items")
    .update(patch)
    .eq("id", input.id)
    .select("id")
    .maybeSingle();
  if (error) throw new CatalogAdminError("No se pudo actualizar el plato.", "persist");
  const row = data as { id: string } | null;
  if (!row) throw new CatalogAdminError("El plato ya no existe.", "not-found");
  return { id: row.id };
}

export async function upsertBranchCommerceAdmin(
  raw: unknown,
): Promise<{ menuItemId: string; branchId: string }> {
  const input = parseOrThrow<UpsertBranchCommerceInput>(upsertBranchCommerceSchema, raw);
  const { client } = await requireCatalogSession(
    input.price !== undefined ? "edit-prices" : "edit-catalog",
  );

  const { data: item, error: itemError } = await client
    .from("menu_items")
    .select("id")
    .eq("id", input.menuItemId)
    .maybeSingle();
  if (itemError) throw new CatalogAdminError("No se pudo validar el plato.", "persist");
  if (!item) throw new CatalogAdminError("El plato indicado no existe.", "not-found");

  const branchUuid = await resolveBranchUuid(client, input.branchId);
  const row: Record<string, string | number | boolean> = {
    branch_id: branchUuid,
    menu_item_id: input.menuItemId,
  };
  if (input.price !== undefined) row.price = input.price;
  if (input.available !== undefined) row.available = input.available;

  const { data, error } = await client
    .from("branch_menu_items")
    .upsert(row, { onConflict: "branch_id,menu_item_id" })
    .select("menu_item_id")
    .maybeSingle();
  if (error) {
    throw new CatalogAdminError(
      "No se pudo guardar precio o disponibilidad de la sucursal (revisa permisos de sucursal).",
      "persist",
    );
  }
  if (!data) throw new CatalogAdminError("No se confirmó el guardado por sucursal.", "persist");
  return { menuItemId: input.menuItemId, branchId: input.branchId };
}

export async function updateCategoryAdmin(raw: unknown): Promise<{ slug: string }> {
  const input = parseOrThrow<UpdateCategoryInput>(updateCategorySchema, raw);
  const { client } = await requireCatalogSession("edit-catalog");

  const patch: Record<string, string | number | boolean | null> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.displayOrder !== undefined) patch.display_order = input.displayOrder;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { data, error } = await client
    .from("categories")
    .update(patch)
    .eq("slug", input.slug)
    .select("slug")
    .maybeSingle();
  if (error) throw new CatalogAdminError("No se pudo actualizar la categoría.", "persist");
  const row = data as { slug: string } | null;
  if (!row) throw new CatalogAdminError("La categoría ya no existe.", "not-found");
  return { slug: row.slug };
}

export async function createCategoryAdmin(raw: unknown): Promise<{ slug: string }> {
  const input = parseOrThrow<CreateCategoryInput>(createCategorySchema, raw);
  const { client } = await requireCatalogSession("edit-catalog");
  const restaurantId = await requireRestaurantId(client);

  const { data: existing } = await client
    .from("categories")
    .select("slug")
    .eq("slug", input.slug)
    .maybeSingle();
  if (existing) throw new CatalogAdminError("Ya existe una categoría con ese slug.", "conflict");

  const { data, error } = await client
    .from("categories")
    .insert({
      restaurant_id: restaurantId,
      slug: input.slug,
      name: input.name,
      description: input.description,
      display_order: input.displayOrder,
      is_active: input.isActive,
    })
    .select("slug")
    .maybeSingle();
  if (error) throw new CatalogAdminError("No se pudo crear la categoría.", "persist");
  const row = data as { slug: string } | null;
  if (!row) throw new CatalogAdminError("No se confirmó la creación de la categoría.", "persist");
  return { slug: row.slug };
}

export async function updateModifierGroupAdmin(raw: unknown): Promise<{ id: string }> {
  const input = parseOrThrow<UpdateModifierGroupInput>(updateModifierGroupSchema, raw);
  const { client } = await requireCatalogSession("edit-catalog");

  const { data: group, error: groupError } = await client
    .from("modifier_groups")
    .select("id, menu_item_id, minimum_selections, maximum_selections")
    .eq("id", input.id)
    .maybeSingle();
  if (groupError) throw new CatalogAdminError("No se pudo leer el grupo de modificadores.", "persist");
  const groupRow = group as {
    id: string;
    menu_item_id: string;
    minimum_selections: number;
    maximum_selections: number;
  } | null;
  if (!groupRow || groupRow.menu_item_id !== input.menuItemId) {
    throw new CatalogAdminError("El grupo no pertenece al plato indicado.", "validation");
  }

  const nextMin = input.minimumSelections ?? groupRow.minimum_selections;
  const nextMax = input.maximumSelections ?? groupRow.maximum_selections;
  if (nextMax < nextMin) {
    throw new CatalogAdminError("El máximo no puede ser menor que el mínimo.", "validation");
  }

  const patch: Record<string, string | number | boolean> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.required !== undefined) patch.required = input.required;
  if (input.minimumSelections !== undefined) patch.minimum_selections = input.minimumSelections;
  if (input.maximumSelections !== undefined) patch.maximum_selections = input.maximumSelections;
  if (input.displayOrder !== undefined) patch.display_order = input.displayOrder;

  const { data, error } = await client
    .from("modifier_groups")
    .update(patch)
    .eq("id", input.id)
    .eq("menu_item_id", input.menuItemId)
    .select("id")
    .maybeSingle();
  if (error) throw new CatalogAdminError("No se pudo actualizar el grupo.", "persist");
  const row = data as { id: string } | null;
  if (!row) throw new CatalogAdminError("El grupo ya no existe.", "not-found");
  return { id: row.id };
}

export async function updateModifierOptionAdmin(raw: unknown): Promise<{ id: string }> {
  const input = parseOrThrow<UpdateModifierOptionInput>(updateModifierOptionSchema, raw);
  const { client } = await requireCatalogSession(
    input.additionalPrice !== undefined ? "edit-prices" : "edit-catalog",
  );

  const { data: option, error: optionError } = await client
    .from("modifier_options")
    .select("id, modifier_group_id")
    .eq("id", input.id)
    .maybeSingle();
  if (optionError) throw new CatalogAdminError("No se pudo leer la opción.", "persist");
  const optionRow = option as { id: string; modifier_group_id: string } | null;
  if (!optionRow || optionRow.modifier_group_id !== input.groupId) {
    throw new CatalogAdminError("La opción no pertenece al grupo indicado.", "validation");
  }

  const patch: Record<string, string | number | boolean> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.additionalPrice !== undefined) patch.additional_price = input.additionalPrice;
  if (input.available !== undefined) patch.available = input.available;
  if (input.displayOrder !== undefined) patch.display_order = input.displayOrder;

  const { data, error } = await client
    .from("modifier_options")
    .update(patch)
    .eq("id", input.id)
    .eq("modifier_group_id", input.groupId)
    .select("id")
    .maybeSingle();
  if (error) throw new CatalogAdminError("No se pudo actualizar la opción.", "persist");
  const row = data as { id: string } | null;
  if (!row) throw new CatalogAdminError("La opción ya no existe.", "not-found");
  return { id: row.id };
}

export async function createModifierGroupAdmin(raw: unknown): Promise<{ id: string }> {
  const input = parseOrThrow<CreateModifierGroupInput>(createModifierGroupSchema, raw);
  const { client } = await requireCatalogSession("edit-catalog");

  const { data: item, error: itemError } = await client
    .from("menu_items")
    .select("id")
    .eq("id", input.menuItemId)
    .maybeSingle();
  if (itemError) throw new CatalogAdminError("No se pudo validar el plato.", "persist");
  if (!item) throw new CatalogAdminError("El plato indicado no existe.", "not-found");

  const { data, error } = await client
    .from("modifier_groups")
    .insert({
      id: input.id,
      menu_item_id: input.menuItemId,
      name: input.name,
      required: input.required,
      minimum_selections: input.minimumSelections,
      maximum_selections: input.maximumSelections,
      display_order: input.displayOrder,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new CatalogAdminError("No se pudo crear el grupo de modificadores.", "persist");
  const row = data as { id: string } | null;
  if (!row) throw new CatalogAdminError("No se confirmó la creación del grupo.", "persist");
  return { id: row.id };
}

export async function createModifierOptionAdmin(raw: unknown): Promise<{ id: string }> {
  const input = parseOrThrow<CreateModifierOptionInput>(createModifierOptionSchema, raw);
  const { client } = await requireCatalogSession(
    input.additionalPrice > 0 ? "edit-prices" : "edit-catalog",
  );

  const { data: group, error: groupError } = await client
    .from("modifier_groups")
    .select("id")
    .eq("id", input.groupId)
    .maybeSingle();
  if (groupError) throw new CatalogAdminError("No se pudo validar el grupo.", "persist");
  if (!group) throw new CatalogAdminError("El grupo indicado no existe.", "not-found");

  const { data, error } = await client
    .from("modifier_options")
    .insert({
      id: input.id,
      modifier_group_id: input.groupId,
      name: input.name,
      additional_price: input.additionalPrice,
      available: input.available,
      display_order: input.displayOrder,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new CatalogAdminError("No se pudo crear la opción.", "persist");
  const row = data as { id: string } | null;
  if (!row) throw new CatalogAdminError("No se confirmó la creación de la opción.", "persist");
  return { id: row.id };
}
