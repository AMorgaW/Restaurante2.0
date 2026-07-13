"use client";

import { useEffect, useState } from "react";

/**
 * Devuelve true tras el montaje en cliente. Se usa para renderizar
 * valores que dependen de almacenamiento local (badge del carrito,
 * favoritos) sin provocar diferencias de hidratación SSR/cliente.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
