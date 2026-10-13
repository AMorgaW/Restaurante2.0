const VISITED_KEY = "rb-menu-grid-visited";

/**
 * La decisión se cachea en el primer layout. Así el doble montaje de
 * desarrollo no lee el sessionStorage que el efecto acaba de escribir
 * y no cancela la entrada que el segundo montaje debe mostrar.
 */
let compactEnterDecision: boolean | null = null;

export const COMPACT_ENTER_STYLE_ID = "menu-compact-settle";

/** Anula el desplazamiento del CSS cuando la visita no debe entrar. */
export const COMPACT_ENTER_CSS =
  '[data-testid="compact-dish-card"]{animation:none!important;transform:none!important}';

export function compactEntranceAllowed(): boolean {
  if (compactEnterDecision === null) {
    let visited = false;
    try {
      visited = window.sessionStorage.getItem(VISITED_KEY) === "1";
    } catch {
      visited = false;
    }
    compactEnterDecision = !visited;
  }
  return compactEnterDecision;
}

export function releaseCompactEntranceDecision(): void {
  compactEnterDecision = null;
}

export function armCompactEnterOffset(): void {
  document.getElementById(COMPACT_ENTER_STYLE_ID)?.remove();
}

export function disarmCompactEnterOffset(): void {
  if (document.getElementById(COMPACT_ENTER_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = COMPACT_ENTER_STYLE_ID;
  style.textContent = COMPACT_ENTER_CSS;
  document.head.appendChild(style);
}
