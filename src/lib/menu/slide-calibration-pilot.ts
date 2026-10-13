/**
 * Comparación móvil bajo el pliegue. La cebolleta conserva la entrada
 * geométrica de 100 px. La ternera prueba la de duración fija. El resto
 * del menú, el revelado fotográfico y el escritorio no entran aquí.
 */
export const GEOMETRIC_SLIDE_PILOT_SLUG = "carne-asada-plato-con-cebolleta";

export const TIMED_SLIDE_PILOT_SLUG =
  "carne-asada-ternera-a-la-parrilla-con-cebollas-jalapeno-frijoles-arroz-pico-de";

export function isGeometricSlidePilot(slug: string): boolean {
  return slug === GEOMETRIC_SLIDE_PILOT_SLUG;
}

export function isTimedSlidePilot(slug: string): boolean {
  return slug === TIMED_SLIDE_PILOT_SLUG;
}
