import { describe, expect, it } from "vitest";
import { shouldPlayResultsSettle } from "@/lib/menu/results-motion";

describe("shouldPlayResultsSettle", () => {
  const todas = "todas::::recomendados";
  const carnes = "carnes::::recomendados";
  const sopas = "sopas::::recomendados";
  const busqueda = "carnes::sopa::recomendados";
  const otraBusqueda = "carnes::sopa de::recomendados";
  const orden = "carnes::::nombre";

  it("no anima la primera identidad ni una búsqueda", () => {
    expect(shouldPlayResultsSettle(todas, todas, 0, 100)).toBe(false);
    expect(shouldPlayResultsSettle(carnes, busqueda, 0, 100)).toBe(false);
    expect(shouldPlayResultsSettle(busqueda, otraBusqueda, 0, 100)).toBe(false);
  });

  it("anima un cambio de categoría o de orden", () => {
    expect(shouldPlayResultsSettle(todas, carnes, 0, 100)).toBe(true);
    expect(shouldPlayResultsSettle(carnes, orden, 0, 400)).toBe(true);
  });

  it("no repite el asentamiento si el filtro cambia enseguida", () => {
    expect(shouldPlayResultsSettle(carnes, sopas, 100, 200)).toBe(false);
    expect(shouldPlayResultsSettle(carnes, sopas, 100, 320)).toBe(true);
  });
});