import { COMPACT_ENTER_CSS, COMPACT_ENTER_STYLE_ID } from "@/lib/menu/catalog-enter-session";

/**
 * Se emite antes del explorador compacto para que una visita ya conocida,
 * reduced motion o escritorio no pinte los 96 px iniciales antes de hidratar.
 * Es intencionalmente el mismo contrato que tenía /menu antes de compartirse.
 */
export function CompactCatalogPrepaint() {
  const source = `(function(){try{var reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;var wide=window.matchMedia("(min-width: 1024px)").matches;var visited=false;try{visited=window.sessionStorage.getItem("rb-menu-grid-visited")==="1";}catch(e){}var id=${JSON.stringify(COMPACT_ENTER_STYLE_ID)};var node=document.getElementById(id);if(reduce||wide||visited){if(!node){var style=document.createElement("style");style.id=id;style.textContent=${JSON.stringify(COMPACT_ENTER_CSS)};document.head.appendChild(style);}}else if(node){node.remove();}}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: source }} />;
}
