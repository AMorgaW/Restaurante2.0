/**
 * Compartir con Web Share API y fallback a portapapeles.
 * Devuelve el mecanismo usado para que la interfaz informe al usuario.
 */
export type ShareResult = "shared" | "copied" | "failed" | "dismissed";

export async function shareOrCopy(data: {
  title: string;
  text: string;
  url: string;
}): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (error) {
      // AbortError = el usuario cerró la hoja de compartir; no es un fallo.
      if (error instanceof DOMException && error.name === "AbortError") {
        return "dismissed";
      }
      // Otros errores: probar portapapeles.
    }
  }
  try {
    await navigator.clipboard.writeText(data.url);
    return "copied";
  } catch {
    return "failed";
  }
}
