/**
 * Tratamiento editorial POR PLATO para el lenguaje circular del rediseño
 * (ver references/analysis/VISUAL_CONTRACT.md §0).
 *
 * Las seis fotos locales no son cenitales perfectas: cada una necesita su
 * punto focal (`objectPosition`) y un acercamiento (`zoom`) para que el
 * recorte circular quede lleno de comida, más un color de halo cálido
 * elegido a mano del propio plato. Presentación pura: no toca datos.
 */
export interface DishVisual {
  /** Punto focal del recorte circular (object-position). */
  objectPosition: string;
  /** Acercamiento dentro del círculo (transform: scale). */
  zoom: number;
  /** Color del halo ambiental (radial tenue detrás del círculo). */
  halo: string;
}

const DISH_VISUALS: Record<string, DishVisual> = {
  "arroz-amarillo-carne-asada-frijoles": {
    objectPosition: "52% 56%",
    zoom: 1.3,
    halo: "rgba(233, 150, 63, 0.30)",
  },
  "carne-asada-falda-de-res-con-ensalada-arroz-frijoles-y-jalapenos": {
    objectPosition: "46% 54%",
    zoom: 1.32,
    halo: "rgba(206, 74, 58, 0.28)",
  },
  "carne-asada-plato-con-cebolleta": {
    objectPosition: "46% 52%",
    zoom: 1.12,
    halo: "rgba(122, 176, 92, 0.28)",
  },
  "carne-asada-ternera-a-la-parrilla-con-cebollas-jalapeno-frijoles-arroz-pico-de": {
    objectPosition: "42% 48%",
    zoom: 1.26,
    halo: "rgba(228, 152, 60, 0.30)",
  },
  "plato-de-carne-asada": {
    objectPosition: "40% 52%",
    zoom: 1.2,
    halo: "rgba(186, 214, 96, 0.26)",
  },
  "sopa-de-maiz-con-arroz-y-frijoles": {
    objectPosition: "52% 52%",
    zoom: 1.3,
    halo: "rgba(142, 192, 94, 0.28)",
  },
};

export const DEFAULT_DISH_VISUAL: DishVisual = {
  objectPosition: "50% 50%",
  zoom: 1.15,
  halo: "rgba(233, 150, 63, 0.24)",
};

export function getDishVisual(slug: string): DishVisual {
  return DISH_VISUALS[slug] ?? DEFAULT_DISH_VISUAL;
}
