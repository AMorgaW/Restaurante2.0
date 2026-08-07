"use server";

import { revalidatePath } from "next/cache";
import { CatalogAdminError, toSafeCatalogAdminMessage } from "@/server/catalog/admin-errors";
import {
  createCategoryAdmin,
  createModifierGroupAdmin,
  createModifierOptionAdmin,
  updateCategoryAdmin,
  updateMenuItemAdmin,
  updateModifierGroupAdmin,
  updateModifierOptionAdmin,
  upsertBranchCommerceAdmin,
} from "@/server/catalog/admin-service";

export type CatalogAdminActionResult =
  | { ok: true }
  | { ok: false; message: string; code: string };

function revalidateCatalogSurfaces() {
  revalidatePath("/admin/platos");
  revalidatePath("/admin/categorias");
  revalidatePath("/menu");
  revalidatePath("/buscar");
  revalidatePath("/carrito");
  revalidatePath("/favoritos");
}

async function runCatalogAction(operation: () => Promise<unknown>): Promise<CatalogAdminActionResult> {
  try {
    await operation();
    revalidateCatalogSurfaces();
    return { ok: true };
  } catch (error) {
    if (!(error instanceof CatalogAdminError)) {
      console.error("[catalog-admin] Error inesperado");
    }
    const safe = toSafeCatalogAdminMessage(error);
    return { ok: false, message: safe.message, code: safe.code };
  }
}

export async function updateMenuItemAction(input: unknown): Promise<CatalogAdminActionResult> {
  return runCatalogAction(() => updateMenuItemAdmin(input));
}

export async function upsertBranchCommerceAction(input: unknown): Promise<CatalogAdminActionResult> {
  return runCatalogAction(() => upsertBranchCommerceAdmin(input));
}

export async function updateCategoryAction(input: unknown): Promise<CatalogAdminActionResult> {
  return runCatalogAction(() => updateCategoryAdmin(input));
}

export async function createCategoryAction(input: unknown): Promise<CatalogAdminActionResult> {
  return runCatalogAction(() => createCategoryAdmin(input));
}

export async function updateModifierGroupAction(input: unknown): Promise<CatalogAdminActionResult> {
  return runCatalogAction(() => updateModifierGroupAdmin(input));
}

export async function updateModifierOptionAction(input: unknown): Promise<CatalogAdminActionResult> {
  return runCatalogAction(() => updateModifierOptionAdmin(input));
}

export async function createModifierGroupAction(input: unknown): Promise<CatalogAdminActionResult> {
  return runCatalogAction(() => createModifierGroupAdmin(input));
}

export async function createModifierOptionAction(input: unknown): Promise<CatalogAdminActionResult> {
  return runCatalogAction(() => createModifierOptionAdmin(input));
}
