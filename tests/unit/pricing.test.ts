import { describe, expect, it } from "vitest";
import { demoDescriptionFor, demoPriceFor, stableHash } from "@/lib/demo/pricing";

describe("stableHash", () => {
  it("es determinista y distinto para entradas distintas", () => {
    expect(stableHash("carne-asada")).toBe(stableHash("carne-asada"));
    expect(stableHash("carne-asada")).not.toBe(stableHash("sopa-de-maiz"));
  });
});

describe("demoPriceFor", () => {
  it("genera precios deterministas en múltiplos de 500", () => {
    const price = demoPriceFor("carne-asada-plato", "carnes");
    expect(price).toBe(demoPriceFor("carne-asada-plato", "carnes"));
    expect(price % 500).toBe(0);
  });

  it("respeta el rango de la categoría", () => {
    const price = demoPriceFor("cualquier-plato", "sopas");
    expect(price).toBeGreaterThanOrEqual(15000);
    expect(price).toBeLessThanOrEqual(28000);
  });

  it("usa el rango de especialidades para categorías desconocidas", () => {
    const price = demoPriceFor("x", "categoria-inventada");
    expect(price).toBeGreaterThanOrEqual(25000);
    expect(price).toBeLessThanOrEqual(48000);
  });
});

describe("demoDescriptionFor", () => {
  it("es determinista y no vacía", () => {
    const description = demoDescriptionFor("carne-asada", "carnes");
    expect(description).toBe(demoDescriptionFor("carne-asada", "carnes"));
    expect(description.length).toBeGreaterThan(10);
  });
});
