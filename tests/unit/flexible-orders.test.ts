import { describe, expect, it } from "vitest";
import { menuItems } from "@/data/menu";
import {
  flexibleOrderCatalog,
  purchasableCatalogItems,
  STANDALONE_PORTIONS_PENDING_COPY,
} from "@/lib/menu/flexible-orders";
import { isSoupItem } from "@/lib/menu/included-soups";

describe("pedidos flexibles del catálogo", () => {
  it("documenta que sopa sola, arroz y arroz con sopa siguen pendientes", () => {
    expect(flexibleOrderCatalog).toEqual({
      standaloneSoup: false,
      ricePortion: false,
      riceWithSoup: false,
    });
    expect(STANDALONE_PORTIONS_PENDING_COPY).toMatch(/todavía no los ofrece/);
  });

  it("deja las sopas fuera del listado comprable y no tiene porciones de arroz", () => {
    const soups = menuItems.filter(isSoupItem);
    const listed = purchasableCatalogItems(menuItems);
    expect(soups.length).toBeGreaterThan(0);
    expect(listed.some(isSoupItem)).toBe(false);
    expect(menuItems.some((item) => item.categorySlug === "arroz")).toBe(false);
    expect(
      menuItems.some((item) => item.fullName.localeCompare("Arroz", "es", { sensitivity: "accent" }) === 0),
    ).toBe(false);
  });
});
