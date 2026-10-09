import { describe, expect, it } from "vitest";
import { isPublicCatalogPath } from "@/lib/navigation/public-catalog";

describe("isPublicCatalogPath", () => {
  it("incluye menú, categorías, búsqueda y favoritos", () => {
    expect(isPublicCatalogPath("/menu")).toBe(true);
    expect(isPublicCatalogPath("/menu/carnes")).toBe(true);
    expect(isPublicCatalogPath("/buscar")).toBe(true);
    expect(isPublicCatalogPath("/favoritos")).toBe(true);
  });

  it("deja fuera carrito, detalle, administración y portada", () => {
    expect(isPublicCatalogPath("/carrito")).toBe(false);
    expect(isPublicCatalogPath("/plato/sopa")).toBe(false);
    expect(isPublicCatalogPath("/admin")).toBe(false);
    expect(isPublicCatalogPath("/empleado")).toBe(false);
    expect(isPublicCatalogPath("/")).toBe(false);
    expect(isPublicCatalogPath("/sucursales")).toBe(false);
  });
});
