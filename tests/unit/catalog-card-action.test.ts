import { describe, expect, it } from "vitest";
import { catalogCardAction, compactCardPresentsSoup, showsIncludedSoupHint } from "@/lib/menu/catalog-card-action";
import type { MenuItem } from "@/types/menu";

function item(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: "carne-asada",
    slug: "carne-asada",
    fullName: "Carne asada",
    categorySlug: "carnes",
    shortDescription: "De la casa",
    price: 40000,
    available: true,
    featured: false,
    tags: [],
    displayOrder: 0,
    image: {
      originalFilename: "carne.jpg",
      publicPath: "/generated/menu/carne-asada.jpg",
      width: 800,
      height: 600,
      aspectRatio: 1.333,
      hasAlpha: false,
      blurDataURL: "data:image/webp;base64,x",
      bytes: 1,
    },
    modifierGroups: [],
    ...overrides,
  };
}

describe("catalogCardAction", () => {
  it("en almuerzo disponible abre la sopa y no añade directo", () => {
    expect(showsIncludedSoupHint("lunch")).toBe(true);
    expect(catalogCardAction(item(), "lunch", true)).toEqual({
      kind: "choose-soup",
      href: "/plato/carne-asada#sopa-incluida",
      label: "Elegir sopa para Carne asada",
    });
    expect(catalogCardAction(item(), "lunch", false).kind === "choose-soup" && catalogCardAction(item(), "lunch", false)).toMatchObject({
      label: "Elegir sin sopa para Carne asada",
    });
  });

  it("en cena sin modificadores de servicio añade al carrito", () => {
    expect(showsIncludedSoupHint("dinner")).toBe(false);
    expect(catalogCardAction(item(), "dinner", true)).toEqual({
      kind: "quick-add",
      label: "Añadir Carne asada al carrito",
    });
  });

  it("no añade directo si hay modificadores o el plato está agotado", () => {
    const withModifier = item({
      modifierGroups: [
        {
          id: "termino",
          name: "Término",
          required: true,
          minSelections: 1,
          maxSelections: 1,
          options: [{ id: "medio", name: "Medio", additionalPrice: 0, available: true }],
        },
      ],
    });
    expect(catalogCardAction(withModifier, "dinner", true)).toEqual({ kind: "none" });
    expect(catalogCardAction(item({ available: false }), "dinner", true)).toEqual({ kind: "none" });
    expect(catalogCardAction(item({ available: false }), "lunch", true)).toEqual({ kind: "none" });
  });

  it("con el restaurante cerrado deja el botón inactivo", () => {
    expect(showsIncludedSoupHint("closed")).toBe(false);
    expect(catalogCardAction(item(), "closed", true)).toEqual({
      kind: "closed",
      label: "No se puede añadir Carne asada: el restaurante está cerrado",
    });
  });

  it("la compacta ofrece sopa solo si el plato la admite y está disponible", () => {
    const soupGroup = {
      id: "included-lunch-soup",
      kind: "includedLunchSoup" as const,
      name: "Sopa incluida",
      required: false,
      minSelections: 0,
      maxSelections: 1,
      options: [{ id: "sopa", name: "Sopa de maíz", additionalPrice: 0, available: true }],
    };
    const main = item({ modifierGroups: [soupGroup] });
    expect(compactCardPresentsSoup(main, "lunch", true)).toBe(true);
    expect(compactCardPresentsSoup(item({ ...main, available: false }), "lunch", true)).toBe(false);
    expect(compactCardPresentsSoup(item({ categorySlug: "sopas" }), "lunch", true)).toBe(false);
    expect(compactCardPresentsSoup(main, "dinner", true)).toBe(false);
  });
});
