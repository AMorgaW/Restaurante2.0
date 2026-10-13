/**
 * Entrada lateral de la tarjeta compacta completa.
 * 96 px esta dentro de la banda ya calibrada (90-110).
 * 360 ms esta dentro de la banda de tarjetas (250-400).
 * La curva es la ease-out del catalogo: cubic-bezier(0.22, 1, 0.36, 1).
 */
export const COMPACT_CARD_SLIDE_PX = 96;
export const COMPACT_CARD_SLIDE_MS = 360;
export const COMPACT_CARD_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/** La tarjeta ya se lee cuando empieza el deslizamiento. */
export const COMPACT_CARD_ENTER_RATIO = 0.65;

/** Asomo vertical que enciende la entrada aunque el ratio de área no llegue a 0.65. */
export const COMPACT_PEEK_PX = 48;

export type CompactVisibility = "play" | "done" | "hold";

/**
 * Alto visible dentro del viewport o del scroller, no el ratio de área.
 * 67 px con un ratio menor de 0.65 ya es `play`. Fuera de pantalla sigue en `hold`.
 */
export function compactVisibilityDecision(input: {
  top: number;
  bottom: number;
  height: number;
  boundsTop: number;
  boundsBottom: number;
  areaRatio?: number;
}): CompactVisibility {
  if (input.height < 1) return "hold";
  if (input.bottom < input.boundsTop + 8) return "done";
  const shown = Math.max(0, Math.min(input.bottom, input.boundsBottom) - Math.max(input.top, input.boundsTop));
  const peeking = shown >= COMPACT_PEEK_PX && input.top < input.boundsBottom;
  const heightRatio = shown / input.height;
  if (heightRatio >= COMPACT_CARD_ENTER_RATIO || peeking || (input.areaRatio ?? 0) >= COMPACT_CARD_ENTER_RATIO) {
    return "play";
  }
  return "hold";
}

/** Altura minima de la tarjeta. El contenido puede crecer por encima. */
export const COMPACT_CARD_MIN_HEIGHT_PX = 152;

export const COMPACT_PHOTO_NARROW_PX = 96;
export const COMPACT_PHOTO_WIDE_PX = 104;

export function compactSlideTransform(): string {
  return `translateX(${COMPACT_CARD_SLIDE_PX}px)`;
}

type HoldEntry = {
  shell: HTMLElement;
  notify: (next: "play" | "done") => void;
};

type HoldGroup = {
  root: HTMLElement | null;
  entries: Set<HoldEntry>;
  frame: number;
  onScroll: () => void;
};

const holdGroups = new Map<EventTarget, HoldGroup>();

function scrollTarget(root: HTMLElement | null): EventTarget {
  return root ?? window;
}

function boundsOf(root: HTMLElement | null): { top: number; bottom: number } {
  if (!root) return { top: 0, bottom: window.innerHeight };
  const box = root.getBoundingClientRect();
  return { top: box.top, bottom: box.bottom };
}

function readHold(shell: HTMLElement, root: HTMLElement | null): CompactVisibility {
  const rect = shell.getBoundingClientRect();
  const bounds = boundsOf(root);
  return compactVisibilityDecision({
    top: rect.top,
    bottom: rect.bottom,
    height: rect.height,
    boundsTop: bounds.top,
    boundsBottom: bounds.bottom,
  });
}

function flushHold(group: HoldGroup, target: EventTarget) {
  group.frame = 0;
  for (const entry of [...group.entries]) {
    if (!entry.shell.isConnected) {
      group.entries.delete(entry);
      continue;
    }
    const next = readHold(entry.shell, group.root);
    if (next === "hold") continue;
    group.entries.delete(entry);
    entry.notify(next);
  }
  if (group.entries.size === 0) releaseHoldGroup(target, group);
}

function releaseHoldGroup(target: EventTarget, group: HoldGroup) {
  if (group.frame) window.cancelAnimationFrame(group.frame);
  target.removeEventListener("scroll", group.onScroll);
  holdGroups.delete(target);
}

/**
 * Un scroll por viewport o por scroller de Visual Lab.
 * Solo mide las tarjetas que siguen en hold y se retira cuando no queda ninguna.
 */
export function watchCompactHold(
  shell: HTMLElement,
  root: HTMLElement | null,
  notify: (next: "play" | "done") => void,
): () => void {
  const target = scrollTarget(root);
  let group = holdGroups.get(target);
  if (!group) {
    const created: HoldGroup = { root, entries: new Set(), frame: 0, onScroll: () => {} };
    created.onScroll = () => {
      if (created.frame) return;
      created.frame = window.requestAnimationFrame(() => flushHold(created, target));
    };
    target.addEventListener("scroll", created.onScroll, { passive: true });
    holdGroups.set(target, created);
    group = created;
  }
  const entry: HoldEntry = { shell, notify };
  group.entries.add(entry);
  group.onScroll();
  return () => {
    const current = holdGroups.get(target);
    if (!current) return;
    current.entries.delete(entry);
    if (current.entries.size === 0) releaseHoldGroup(target, current);
  };
}
