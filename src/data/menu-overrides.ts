import type { MenuItemOverride } from "@/types/menu";

/**
 * ============================================================
 * Overrides manuales del menú, editables por el restaurante.
 *
 * La clave es el `slug` generado (ver src/data/generated/menu-manifest.ts
 * o artifacts/image-report.json). Aquí se corrigen nombres, categorías,
 * precios, descripciones, etiquetas, disponibilidad, destacados,
 * ingredientes, alérgenos y modificadores sin tocar el generador.
 *
 * ⚠ Los ingredientes listados provienen EXPLÍCITAMENTE del nombre del
 * archivo original; no se inventan datos alimentarios.
 * ============================================================
 */
export const menuOverrides: Record<string, MenuItemOverride> = {
  "carne-asada-ternera-a-la-parrilla-con-cebollas-jalapeno-frijoles-arroz-pico-de": {
    featured: true,
    shortName: "Parrillada de ternera completa",
    tags: ["Parrilla", "Para compartir"],
    ingredients: [
      "Ternera a la parrilla",
      "Cebollas",
      "Jalapeño",
      "Frijoles",
      "Arroz",
      "Pico de gallo",
      "Guacamole",
      "Crema",
      "Lima",
    ],
  },
  "plato-de-carne-asada": {
    featured: true,
    tags: ["Clásico de la casa"],
  },
  "sopa-de-maiz-con-arroz-y-frijoles": {
    tags: ["Receta tradicional"],
    ingredients: ["Maíz", "Arroz", "Frijoles"],
  },
  "carne-asada-falda-de-res-con-ensalada-arroz-frijoles-y-jalapenos": {
    ingredients: ["Falda de res", "Ensalada", "Arroz", "Frijoles", "Jalapeños"],
  },
  "carne-asada-plato-con-cebolleta": {
    preparationMinutes: 20,
  },
};
