import type { Transition, Variants } from "motion/react";

/**
 * Variantes de Motion centralizadas. Duraciones y curvas según la guía:
 * feedback 80–140ms · chips 120–180ms · fades 180–260ms · tarjetas
 * 250–400ms · sheets 250–350ms · vistas 280–450ms · onboarding 600–1000ms.
 * Entradas ease-out, salidas ease-in, springs moderados sin rebote excesivo.
 */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN = [0.4, 0, 1, 1] as const;

export const springGentle: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 0.9,
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.22, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.16, ease: EASE_IN } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
  exit: { opacity: 0, y: 12, transition: { duration: 0.18, ease: EASE_IN } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: springGentle },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.16, ease: EASE_IN } },
};

/** Contenedor con stagger ligero para listas y grupos de chips. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
};

export const sheetSlideUp: Variants = {
  hidden: { y: "100%" },
  visible: { y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
  exit: { y: "100%", transition: { duration: 0.24, ease: EASE_IN } },
};

/** Variantes reducidas: solo crossfade corto (prefers-reduced-motion). */
export const reducedFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

/** Revelado corto de paneles (filtros): opacity + translate pequeño, sin height. */
export const filterReveal: Variants = {
  hidden: { opacity: 0, y: -6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.16, ease: EASE_IN } },
};

/** Selecciona variantes según la preferencia de movimiento. */
export function pickVariants(reduced: boolean, full: Variants): Variants {
  return reduced ? reducedFade : full;
}
