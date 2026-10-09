"use client";

import { useLayoutEffect, useState } from "react";

/**
 * Preferencia de movimiento reducido sin divergencia de hidratación.
 *
 * El primer render es false en el servidor y en el cliente. `useReducedMotion`
 * de Motion guarda en su estado el `null` del servidor y no vuelve a leer
 * `matchMedia`, así que no sirve para este corte. La preferencia real se
 * aplica en `useLayoutEffect`, antes del paint posterior a la hidratación.
 * El paint del HTML, anterior a JavaScript, lo corrige el CSS
 * `@media (prefers-reduced-motion: reduce)` para que el primer frame visible
 * tampoco arranque desplazado.
 */
export function useHydratedReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return reduced;
}
