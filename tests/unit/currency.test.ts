import { describe, expect, it } from "vitest";
import { formatCurrency, minorUnitsToMajor } from "@/lib/format/currency";

describe("formatCurrency (COP, sin decimales)", () => {
  it("formatea pesos colombianos con separador de miles", () => {
    const formatted = formatCurrency(38500);
    expect(formatted).toContain("38.500");
    expect(formatted).toMatch(/\$/);
  });

  it("no muestra decimales para COP", () => {
    expect(formatCurrency(1000)).not.toContain(",00");
  });

  it("maneja cero e importes inválidos con seguridad", () => {
    expect(formatCurrency(0)).toContain("0");
    expect(formatCurrency(Number.NaN)).toContain("0");
  });

  it("respeta configuraciones con decimales (p. ej. USD)", () => {
    const usd = { code: "USD", locale: "en-US", decimals: 2 };
    expect(formatCurrency(1250, usd)).toBe("$12.50");
  });
});

describe("minorUnitsToMajor", () => {
  it("convierte según los decimales configurados", () => {
    expect(minorUnitsToMajor(38500)).toBe(38500); // COP: 0 decimales
    expect(minorUnitsToMajor(1250, { code: "USD", locale: "en-US", decimals: 2 })).toBe(12.5);
  });
});
