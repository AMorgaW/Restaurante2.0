/** Detección mínima para el fallback de navegación que evita VT colgada en WebKit. */
export function isWebKitBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const agent = navigator.userAgent;
  return /AppleWebKit/i.test(agent) && !/(Chrome|Chromium|CriOS|Edg|OPR)/i.test(agent);
}
