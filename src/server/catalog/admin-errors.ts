/** Error de negocio seguro para administración de catálogo (sin SQL/stack). */
export class CatalogAdminError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "unauthorized"
      | "forbidden"
      | "data-mode"
      | "validation"
      | "not-found"
      | "conflict"
      | "persist",
  ) {
    super(message);
    this.name = "CatalogAdminError";
  }
}

export function toSafeCatalogAdminMessage(error: unknown): { message: string; code: string } {
  if (error instanceof CatalogAdminError) {
    return { message: error.message, code: error.code };
  }
  return {
    message: "No pudimos guardar el cambio del catálogo. Intenta de nuevo.",
    code: "persist",
  };
}
