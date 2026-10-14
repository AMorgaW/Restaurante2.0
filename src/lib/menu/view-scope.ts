export type MenuViewScope = "catalog" | "search";
export type MenuScrollScope = MenuViewScope | "favorites";

const VIEW_STORAGE_KEYS: Record<MenuViewScope, string> = {
  catalog: "rb-menu-view",
  search: "rb-search-view",
};

const SCROLL_STORAGE_KEYS: Record<MenuScrollScope, string> = {
  catalog: "rb-menu-scroll-y",
  search: "rb-search-scroll-y",
  favorites: "rb-favorites-scroll-y",
};

export function getMenuViewStorageKey(scope: MenuViewScope): string {
  return VIEW_STORAGE_KEYS[scope];
}

export function getMenuScrollStorageKey(scope: MenuScrollScope): string {
  return SCROLL_STORAGE_KEYS[scope];
}

/** El listado de favoritos conserva su propio scroll, sin crear un view store. */
export function menuScrollScopeForPathname(pathname: string): MenuScrollScope {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/buscar") return "search";
  if (normalized === "/favoritos") return "favorites";
  return "catalog";
}

/** Search is the only public catalog surface with an isolated view session. */
export function menuViewScopeForPathname(pathname: string): MenuViewScope {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === "/buscar" ? "search" : "catalog";
}
