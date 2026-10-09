/** Rutas públicas del catálogo. El detalle, el carrito y las páginas legales quedan fuera. */
export function isPublicCatalogPath(pathname: string): boolean {
  return (
    pathname === "/menu" ||
    pathname.startsWith("/menu/") ||
    pathname === "/buscar" ||
    pathname === "/favoritos"
  );
}
