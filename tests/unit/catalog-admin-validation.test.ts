import { describe, expect, it } from "vitest";
import {
  createCategorySchema,
  createModifierGroupSchema,
  updateMenuItemSchema,
  updateModifierGroupSchema,
  updateModifierOptionSchema,
  upsertBranchCommerceSchema,
} from "@/server/catalog/admin-schemas";
import { CatalogAdminError, toSafeCatalogAdminMessage } from "@/server/catalog/admin-errors";
import { canAccessAdminPath, adminRoleCan } from "@/lib/admin/authorization";

describe("allowlist y validación admin catálogo", () => {
  it("rechaza campos desconocidos en update de plato", () => {
    const parsed = updateMenuItemSchema.safeParse({
      id: "plato-1",
      shortDescription: "ok",
      base_price: 1,
    });
    expect(parsed.success).toBe(false);
  });

  it("rechaza precio negativo o no entero en sucursal", () => {
    expect(upsertBranchCommerceSchema.safeParse({
      menuItemId: "a",
      branchId: "branch-centro",
      price: -1,
    }).success).toBe(false);
    expect(upsertBranchCommerceSchema.safeParse({
      menuItemId: "a",
      branchId: "branch-centro",
      price: 12.5,
    }).success).toBe(false);
  });

  it("acepta allowlist mínima de plato y sucursal", () => {
    expect(updateMenuItemSchema.safeParse({ id: "a", featured: true }).success).toBe(true);
    expect(upsertBranchCommerceSchema.safeParse({
      menuItemId: "a",
      branchId: "branch-centro",
      price: 22000,
      available: true,
    }).success).toBe(true);
  });

  it("valida min/max de grupo de modificadores", () => {
    expect(updateModifierGroupSchema.safeParse({
      id: "g1",
      menuItemId: "p1",
      minimumSelections: 2,
      maximumSelections: 1,
    }).success).toBe(false);
    expect(createModifierGroupSchema.safeParse({
      id: "extra",
      menuItemId: "p1",
      name: "Extra",
      minimumSelections: 0,
      maximumSelections: 1,
    }).success).toBe(true);
  });

  it("valida opción y categoría", () => {
    expect(updateModifierOptionSchema.safeParse({
      id: "o1",
      groupId: "g1",
      additionalPrice: -5,
    }).success).toBe(false);
    expect(createCategorySchema.safeParse({
      slug: "Bad Slug",
      name: "Carnes",
    }).success).toBe(false);
    expect(createCategorySchema.safeParse({
      slug: "carnes-test",
      name: "Carnes",
    }).success).toBe(true);
  });

  it("no expone detalles internos en errores seguros", () => {
    const safe = toSafeCatalogAdminMessage(new Error("relation menu_items does not exist"));
    expect(safe.message).not.toMatch(/relation|sql|menu_items/i);
    expect(toSafeCatalogAdminMessage(new CatalogAdminError("Sin permiso", "forbidden")).code).toBe(
      "forbidden",
    );
  });
});

describe("roles admin catálogo", () => {
  it("owner admin manager editor pueden catálogo; kitchen/cashier/support no", () => {
    for (const role of ["owner", "admin", "manager", "editor"] as const) {
      expect(canAccessAdminPath(role, "/admin/platos")).toBe(true);
      expect(adminRoleCan(role, "edit-catalog")).toBe(true);
    }
    for (const role of ["kitchen", "cashier", "support"] as const) {
      expect(canAccessAdminPath(role, "/admin/platos")).toBe(false);
    }
  });

  it("manager tiene evidencia explícita de edit-catalog y edit-prices", () => {
    expect(adminRoleCan("manager", "edit-catalog")).toBe(true);
    expect(adminRoleCan("manager", "edit-prices")).toBe(true);
  });
});
