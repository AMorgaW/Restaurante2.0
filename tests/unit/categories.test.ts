import { describe, expect, it } from "vitest";
import { FALLBACK_CATEGORY_SLUG, getCategoryBySlug, inferCategorySlug } from "@/lib/menu/categories";

describe("inferCategorySlug", () => {
  it("clasifica sopas solo cuando el nombre empieza por sopa/crema/caldo", () => {
    expect(inferCategorySlug("Sopa de maíz con arroz y frijoles")).toBe("sopas");
    expect(inferCategorySlug("Crema de tomate")).toBe("sopas");
    // "sopa" como acompañamiento no reclasifica
    expect(inferCategorySlug("Carne asada con sopa pequeña")).toBe("carnes");
  });

  it("clasifica ensaladas solo al inicio del nombre", () => {
    expect(inferCategorySlug("Ensalada César")).toBe("ensaladas");
    expect(inferCategorySlug("Carne asada falda de res con ensalada, arroz")).toBe("carnes");
  });

  it("clasifica carnes por palabras clave", () => {
    expect(inferCategorySlug("Carne asada plato con cebolleta")).toBe("carnes");
    expect(inferCategorySlug("Churrasco argentino")).toBe("carnes");
    expect(inferCategorySlug("Costillas BBQ")).toBe("carnes");
  });

  it("no clasifica como mexicana por ingredientes (guacamole, jalapeño)", () => {
    expect(
      inferCategorySlug(
        "Carne asada ternera a la parrilla con cebollas, jalapeño, frijoles, arroz, pico de gallo, guacamole, crema y lima",
      ),
    ).toBe("carnes");
  });

  it("clasifica mexicana por tipos de plato", () => {
    expect(inferCategorySlug("Tacos de carne (especial)")).toBe("mexicana");
    expect(inferCategorySlug("Burrito supremo")).toBe("mexicana");
    expect(inferCategorySlug("Quesadillas de queso")).toBe("mexicana");
  });

  it("clasifica el resto de categorías conocidas", () => {
    expect(inferCategorySlug("Hamburguesa doble artesanal")).toBe("hamburguesas");
    expect(inferCategorySlug("Pizza margarita")).toBe("pizzas");
    expect(inferCategorySlug("Spaghetti bolognese")).toBe("pastas");
    expect(inferCategorySlug("Pollo a la parrilla")).toBe("pollo");
    expect(inferCategorySlug("Salmón al horno")).toBe("pescados-y-mariscos");
    expect(inferCategorySlug("Brownie con helado")).toBe("postres");
    expect(inferCategorySlug("Limonada natural")).toBe("bebidas");
    expect(inferCategorySlug("Empanadas de la casa")).toBe("entradas");
  });

  it("usa Especialidades cuando no hay coincidencia confiable", () => {
    expect(inferCategorySlug("Delicia sorpresa del chef")).toBe(FALLBACK_CATEGORY_SLUG);
  });

  it("ignora tildes y mayúsculas", () => {
    expect(inferCategorySlug("SALMÓN A LA PLANCHA")).toBe("pescados-y-mariscos");
  });
});

describe("getCategoryBySlug", () => {
  it("devuelve la categoría pedida", () => {
    expect(getCategoryBySlug("carnes").name).toBe("Carnes");
  });

  it("cae a Especialidades para slugs desconocidos", () => {
    expect(getCategoryBySlug("no-existe").slug).toBe(FALLBACK_CATEGORY_SLUG);
  });
});
