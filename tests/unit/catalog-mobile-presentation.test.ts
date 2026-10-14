import { describe, expect, it } from "vitest";
import { getCatalogMobilePresentation } from "@/lib/menu/catalog-mobile-presentation";

describe("getCatalogMobilePresentation", () => {
  it("mantiene compacto el menú completo", () => {
    expect(getCatalogMobilePresentation({ kind: "menu" })).toBe("compact");
  });

  it("habilita compacto en la búsqueda sin convertir rutas en categorías", () => {
    expect(getCatalogMobilePresentation({ kind: "search" })).toBe("compact");
  });

  it("habilita cualquier categoría ya resuelta, sin una lista piloto", () => {
    expect(
      getCatalogMobilePresentation({
        kind: "category",
        category: { slug: "carnes", name: "Carnes", description: "A la brasa", displayOrder: 10 },
      }),
    ).toBe("compact");
    expect(
      getCatalogMobilePresentation({
        kind: "category",
        category: { slug: "sopas", name: "Sopas", description: "Incluidas", displayOrder: 3 },
      }),
    ).toBe("compact");
    expect(
      getCatalogMobilePresentation({
        kind: "category",
        category: {
          slug: "hamburguesas",
          name: "Hamburguesas",
          description: "Caso sintético",
          displayOrder: 5,
        },
      }),
    ).toBe("compact");
  });
});
