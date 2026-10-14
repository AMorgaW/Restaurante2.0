"use client";

import type { MouseEvent } from "react";
import { isWebKitBrowser } from "@/lib/browser-engine";
import { getMenuScrollStorageKey, menuScrollScopeForPathname } from "@/lib/menu/view-scope";

function plainPrimaryClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function rememberMenuScroll(): void {
  try {
    const scope = menuScrollScopeForPathname(window.location.pathname);
    sessionStorage.setItem(getMenuScrollStorageKey(scope), String(window.scrollY));
  } catch {
    /* La navegación sigue funcionando aunque sessionStorage no esté disponible. */
  }
}

/**
 * Misma salida que la tarjeta del catálogo: recuerda el scroll, suelta
 * el transform antes del viaje y, en WebKit, asigna la URL a mano.
 */
export function openDishFromCard(
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
  release: (anchor: HTMLElement) => void,
): void {
  rememberMenuScroll();
  if (!plainPrimaryClick(event)) return;
  release(event.currentTarget);
  if (isWebKitBrowser()) {
    event.preventDefault();
    window.location.assign(href);
  }
}
