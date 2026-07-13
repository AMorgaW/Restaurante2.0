import { describe, expect, it } from "vitest";
import {
  getCategoriesInUse,
  getFeaturedItems,
  getMenuItemBySlug,
  getRelatedItems,
  menuItems,
} from "@/data/menu";
import { menuManifest } from "@/data/generated/menu-manifest";

describe("manifiesto generado", () => {
  it("contiene todas las imágenes válidas de images/", () => {
    expect(menuManifest.length).toBe(6);
  });

  it("tiene slugs únicos y metadatos completos", () => {
    const slugs = new Set(menuManifest.map((item) => item.slug));
    expect(slugs.size).toBe(menuManifest.length);
    for (const item of menuManifest) {
      expect(item.image.width).toBeGreaterThan(0);
      expect(item.image.height).toBeGreaterThan(0);
      expect(item.image.blurDataURL.startsWith("data:image/")).toBe(true);
      expect(item.image.publicPath.startsWith("/generated/menu/")).toBe(true);
      expect(item.image.originalFilename.length).toBeGreaterThan(0);
    }
  });
});

describe("menú fusionado", () => {
  it("todos los platos tienen precio, descripción y categoría válida", () => {
    const categorySlugs = new Set(getCategoriesInUse().map((category) => category.slug));
    for (const item of menuItems) {
      expect(item.price).toBeGreaterThan(0);
      expect(item.shortDescription.length).toBeGreaterThan(0);
      expect(categorySlugs.has(item.categorySlug)).toBe(true);
    }
  });

  it("aplica overrides (destacados y modificadores)", () => {
    const featured = getFeaturedItems();
    expect(featured.length).toBeGreaterThanOrEqual(2);

    const withModifiers = menuItems.find((item) => item.modifierGroups.length > 0);
    expect(withModifiers).toBeDefined();
    expect(withModifiers?.modifierGroups[0]?.options.length).toBeGreaterThan(0);
  });

  it("busca por slug y calcula relacionados sin incluir el propio plato", () => {
    const first = menuItems[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(getMenuItemBySlug(first.slug)?.slug).toBe(first.slug);
    expect(getMenuItemBySlug("no-existe")).toBeUndefined();

    const related = getRelatedItems(first, 4);
    expect(related.length).toBeGreaterThan(0);
    expect(related.every((item) => item.slug !== first.slug)).toBe(true);
  });
});
