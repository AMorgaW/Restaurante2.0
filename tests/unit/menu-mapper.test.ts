import { describe, expect, it } from "vitest";
import {
  CatalogMappingError,
  mapCatalogCategories,
  mapCatalogImage,
  mapCatalogMenuItem,
  mapModifierGroups,
  resolveBranchCommerce,
  sortCatalogMenuItems,
  type CatalogBranchMenuRow,
  type CatalogMenuItemRow,
} from "@/server/repositories/menu-mapper";
import type { MenuItem } from "@/types/menu";

const baseItem: CatalogMenuItemRow = {
  id: "plato-test",
  slug: "plato-test",
  name: "Plato test",
  short_name: null,
  category_slug: "carnes",
  short_description: "Descripción",
  description: null,
  base_price: 25000,
  available: true,
  featured: false,
  tags: [],
  ingredients: null,
  allergens: null,
  preparation_minutes: null,
  display_order: 10,
  image_path: "/generated/menu/plato-test.jpg",
  image_width: 800,
  image_height: 600,
  image_blur_data_url: null,
  original_filename: "plato-test.jpg",
};

describe("menu-mapper", () => {
  it("excluye categorías inactivas y ordena", () => {
    const categories = mapCatalogCategories([
      { slug: "b", name: "B", description: null, display_order: 2, is_active: true },
      { slug: "a", name: "A", description: null, display_order: 1, is_active: true },
      { slug: "x", name: "X", description: null, display_order: 0, is_active: false },
    ]);
    expect(categories.map((category) => category.slug)).toEqual(["a", "b"]);
  });

  it("usa placeholder cuando no hay imagen", () => {
    const image = mapCatalogImage({ ...baseItem, image_path: "  " });
    expect(image.publicPath).toBe("/icon.svg");
  });

  it("precio por sucursal y no listado sin branch_menu_items", () => {
    expect(resolveBranchCommerce(baseItem, undefined)).toEqual({
      price: 25000,
      available: false,
      listed: false,
    });
    const branch: CatalogBranchMenuRow = { menu_item_id: baseItem.id, price: 27000, available: true };
    expect(resolveBranchCommerce(baseItem, branch)).toEqual({
      price: 27000,
      available: true,
      listed: true,
    });
  });

  it("producto sin configuración de sucursal no se mapea", () => {
    expect(mapCatalogMenuItem(baseItem, undefined, [], [])).toBeNull();
  });

  it("producto no disponible en sucursal queda listed=false disponible", () => {
    const mapped = mapCatalogMenuItem(
      baseItem,
      { menu_item_id: baseItem.id, price: null, available: false },
      [],
      [],
    );
    expect(mapped?.available).toBe(false);
    expect(mapped?.price).toBe(25000);
  });

  it("rechaza precios no enteros", () => {
    expect(() => resolveBranchCommerce({ ...baseItem, base_price: 12.5 }, {
      menu_item_id: baseItem.id,
      price: null,
      available: true,
    })).toThrow(CatalogMappingError);
  });

  it("mapea grupos/opciones ordenados y rechaza opción de otro grupo vía filtrado", () => {
    const groups = mapModifierGroups(
      [{
        id: "g1",
        menu_item_id: baseItem.id,
        name: "Extras",
        minimum_selections: 0,
        maximum_selections: 1,
        required: false,
        display_order: 1,
      }],
      [
        {
          id: "o2",
          modifier_group_id: "g1",
          name: "B",
          additional_price: 1000,
          available: true,
          display_order: 2,
        },
        {
          id: "o1",
          modifier_group_id: "g1",
          name: "A",
          additional_price: 0,
          available: true,
          display_order: 1,
        },
        {
          id: "other",
          modifier_group_id: "g-other",
          name: "Ajeno",
          additional_price: 0,
          available: true,
          display_order: 1,
        },
      ],
    );
    expect(groups[0]?.options.map((option) => option.id)).toEqual(["o1", "o2"]);
  });

  it("ordena productos por categoría y display_order", () => {
    const items = sortCatalogMenuItems(
      [
        { id: "2", slug: "2", fullName: "B", categorySlug: "carnes", shortDescription: "", price: 1, available: true, featured: false, tags: [], displayOrder: 20, image: mapCatalogImage(baseItem), modifierGroups: [] },
        { id: "1", slug: "1", fullName: "A", categorySlug: "carnes", shortDescription: "", price: 1, available: true, featured: false, tags: [], displayOrder: 10, image: mapCatalogImage(baseItem), modifierGroups: [] },
      ] as MenuItem[],
      [{ slug: "carnes", name: "Carnes", description: "", displayOrder: 1 }],
    );
    expect(items.map((item) => item.id)).toEqual(["1", "2"]);
  });
});
