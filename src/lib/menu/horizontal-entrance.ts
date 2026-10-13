/** La foto ya está dentro del viewport cuando empieza el deslizamiento. */
export const SLIDE_START = 0.35;
/** La tarjeta sigue visible y queda en reposo antes de salir de pantalla. */
export const SLIDE_END = 0.9;

/** Por debajo de este ancho el catálogo es de una columna y entra en horizontal. */
export const ENTRANCE_BREAKPOINT = 1024;

/**
 * Móvil: el eje aprobado de 64 px. Escritorio: la subida vertical existente.
 * El corte coincide con `lg:grid-cols-2`.
 */
export function entranceAxis(width: number): "x" | "y" {
  return width < ENTRANCE_BREAKPOINT ? "x" : "y";
}

/**
 * Una tarjeta que ya avanzó termina en su eje. Sin progreso, adopta el eje
 * del viewport. Así un cambio de orientación no mezcla X e Y.
 */
export function resolveCardAxis(
  viewportAxis: "x" | "y",
  committed: number,
  locked: "x" | "y" | null,
): "x" | "y" {
  if (committed > 0 && locked) return locked;
  return viewportAxis;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function sampleBezier(t: number, p1: number, p2: number): number {
  const u = 1 - t;
  return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
}

function sampleBezierDerivative(t: number, p1: number, p2: number): number {
  const u = 1 - t;
  return 3 * u * u * p1 + 6 * u * t * (p2 - p1) + 3 * t * t * (1 - p2);
}

/**
 * La categoría entra hacia el 49 % de la tarjeta y el precio hacia el 89 %.
 * Esta ventana sigue abierta cuando esas piezas ya se leen.
 */
export const CALIBRATION_SLIDE_START = 0.2;
export const CALIBRATION_SLIDE_END = 1.15;
export const CALIBRATION_SLIDE_MIN = 90;
export const CALIBRATION_SLIDE_MAX = 110;

/** En la columna móvil de 358 px da 100 px, dentro de la banda 90–110. */
const CALIBRATION_WIDTH_RATIO = 0.28;

function easeCubic(
  progress: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const x = clamp01(progress);
  if (x === 0 || x === 1) return x;
  let t = x;
  for (let step = 0; step < 8; step += 1) {
    const current = sampleBezier(t, x1, x2);
    const slope = sampleBezierDerivative(t, x1, x2);
    if (Math.abs(slope) < 1e-6) break;
    t = clamp01(t - (current - x) / slope);
  }
  return sampleBezier(t, y1, y2);
}

/**
 * `cubic-bezier(0.22, 1, 0.36, 1)`, la ease-out ya usada en el catálogo.
 * El avance lineal del viewport entra aquí para que el tramo final se asiente.
 */
export function easeOutSettle(progress: number): number {
  return easeCubic(progress, 0.22, 1, 0.36, 1);
}

/**
 * `cubic-bezier(0.3, 0.05, 0.55, 0.45)`. Conserva desplazamiento mientras
 * entran el título y el precio, y solo al final se asienta.
 */
export function easeHoldSettle(progress: number): number {
  return easeCubic(progress, 0.3, 0.05, 0.55, 0.45);
}

/**
 * Distancia del piloto según el ancho real de la tarjeta.
 * 90 px es el suelo de la banda; 110 px el techo, para no sacar
 * del todo el botón cuando el precio ya se está leyendo.
 */
export function calibrationSlideDistance(cardWidth: number): number {
  if (!Number.isFinite(cardWidth) || cardWidth <= 0) return 100;
  const raw = cardWidth * CALIBRATION_WIDTH_RATIO;
  if (raw <= CALIBRATION_SLIDE_MIN) return CALIBRATION_SLIDE_MIN;
  if (raw >= CALIBRATION_SLIDE_MAX) return CALIBRATION_SLIDE_MAX;
  return Math.round(raw);
}

/**
 * Entrada de duración fija de la ternera. 100 px y 360 ms, dentro de
 * la banda de tarjetas. La ease-out del catálogo suelta el recorrido
 * en los primeros ~140 ms: a 200 px/s, 22 px de adelanto dejan el
 * precio dentro de ese tramo. No es el 52 % de la tarjeta: ahí el
 * título acaba de asomar y, en un scroll lento, los 360 ms terminan
 * antes del precio.
 *
 * Si el dedo se detiene con el corazón ya en pantalla, la misma
 * animación arranca en ese momento. 160 ms solo distinguen una parada
 * de un scroll lento; no hay delay en la animación.
 */
export const TIMED_SLIDE_PX = 100;
export const TIMED_SLIDE_MS = 360;
export const TIMED_SLIDE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
export const TIMED_PRICE_LEAD_PX = 22;
export const TIMED_IDLE_MS = 160;
const TIMED_ALREADY_READ_PX = 96;

export function timedSlideFrom(): string {
  return `translateX(${TIMED_SLIDE_PX}px)`;
}

export function timedSlidePhase(input: {
  prepared: boolean;
  priceTop: number;
  viewportHeight: number;
  cardTop: number;
  cardBottom: number;
  heartTop: number;
  heartBottom: number;
  idle: boolean;
}): "hold" | "play" | "rest" {
  if (input.cardBottom < -8) return "rest";
  const priceClose = input.priceTop <= input.viewportHeight + TIMED_PRICE_LEAD_PX;
  const priceAlreadyRead = input.priceTop < input.viewportHeight - TIMED_ALREADY_READ_PX;
  if (priceClose) {
    if (priceAlreadyRead && !input.prepared) return "rest";
    return "play";
  }
  const heartVisible = input.heartBottom > 8 && input.heartTop < input.viewportHeight - 8;
  if (input.idle && heartVisible && input.cardTop < input.viewportHeight - 8) return "play";
  return "hold";
}

/**
 * Un solo eje. El progreso lineal se guarda monótono; la curva
 * solo afecta al desplazamiento horizontal.
 */
export function entranceOffset(
  axis: "x" | "y",
  linear: number,
  distance: number,
  curve: "catalog" | "hold" = "catalog",
): { x: number; y: number } {
  const progress = clamp01(linear);
  const eased =
    axis === "x" ? (curve === "hold" ? easeHoldSettle(progress) : easeOutSettle(progress)) : progress;
  const amount = (1 - eased) * distance;
  return axis === "x" ? { x: amount, y: 0 } : { x: 0, y: amount };
}
