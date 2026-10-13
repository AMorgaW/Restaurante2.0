import { describe, expect, it } from "vitest";
import { getCatalogMobilePresentation } from "@/lib/menu/catalog-mobile-presentation";

describe("getCatalogMobilePresentation", () => {
  it("mantiene compacto el menú completo y habilita solo el piloto carnes", () => {
    expect(getCatalogMobilePresentation()).toBe("compact");
    expect(getCatalogMobilePresentation("carnes")).toBe("compact");
  });

  it("deja las demás rutas de categoría en la fila existente", () => {
    expect(getCatalogMobilePresentation("sopas")).toBe("row");
    expect(getCatalogMobilePresentation("hamburguesas")).toBe("row");
  });
});
