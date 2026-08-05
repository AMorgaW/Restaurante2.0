/**
 * Acepta únicamente rutas relativas internas. Rechaza URLs absolutas, protocol
 * relative (`//`) y barras invertidas para evitar open redirects.
 */
const KNOWN_PATHS = [
  "/",
  "/menu",
  "/buscar",
  "/favoritos",
  "/carrito",
  "/checkout",
  "/pedido",
  "/plato",
  "/sucursales",
  "/promociones",
  "/contacto",
  "/preguntas-frecuentes",
  "/alergenos",
  "/privacidad",
  "/terminos",
  "/cookies",
  "/login",
  "/registro",
  "/recuperar-contrasena",
  "/actualizar-contrasena",
  "/cuenta",
  "/admin",
  "/empleado",
  "/pensionado",
];

function isSafeRelativePath(value: string): boolean {
  if (!value || value.length > 512 || /[\u0000-\u001f\u007f\\]/.test(value)) return false;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return false;
  let decoded = value;
  for (let index = 0; index < 3; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return false;
    }
  }
  if (decoded.startsWith("//") || decoded.includes("://") || /[\u0000-\u001f\u007f\\]/.test(decoded)) return false;
  const parsed = new URL(decoded, "https://brisas.local");
  if (parsed.origin !== "https://brisas.local") return false;
  if (!KNOWN_PATHS.some((prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`))) return false;
  const nestedNext = parsed.searchParams.getAll("next");
  return nestedNext.every((nested) => isSafeRelativePath(nested));
}

export function safeNextPath(value: string | null | undefined, fallback = "/cuenta"): string {
  return value && isSafeRelativePath(value) ? value : fallback;
}
